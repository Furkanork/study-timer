// Study Empire — turn focus time into land, buildings and eras.
// Reads focus history from the timer (window.StudyTimer) and keeps its own state in localStorage ("studyTimer.empire"),
// so the timer's backup file includes it.
(() => {
  "use strict";
  const ST = window.StudyTimer;
  if (!ST) return;

  const KEY = "studyTimer.empire";
  const W = 1200, H = 800, CELL = 52;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const dk = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const kd = k => new Date(k + "T12:00:00");
  const addDays = (k, n) => { const d = kd(k); d.setDate(d.getDate() + n); return dk(d); };
  const weekOf = k => { const d = kd(k); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dk(d); };
  const todayK = () => dk(new Date());
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortDate = k => { const d = kd(k); return d.getDate() + " " + MONTHS[d.getMonth()]; };
  const fmtH = secs => { const m = Math.round(secs / 60); return m < 60 ? m + "m" : (m / 60).toFixed(m % 60 ? 1 : 0) + "h"; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- eras ----------
  const ERAS = [
    { name: "Antiquity", hours: 0, font: "Cinzel", weight: 700, paper: .5, tint: .72, grain: 14,
      water: "#2c5361", shallow: "#4f8088", neutral: "#cdb98f", ink: "#3a2614", halo: "rgba(240,226,190,.55)", waves: true,
      rivals: ["#b5654a", "#7a8f4e", "#8a6aa3", "#c49a3f", "#4f7f9e", "#a8505f"] },
    { name: "Medieval", hours: 60, font: "IM Fell English SC", weight: 400, paper: .6, tint: .66, grain: 16,
      water: "#6d8d88", shallow: "#9db4a6", neutral: "#e0cfa5", ink: "#2e1f10", halo: "rgba(245,234,205,.6)", waves: true,
      rivals: ["#a33b32", "#2f5d8a", "#3d7a45", "#c9a227", "#6b3f86", "#b86b2e"] },
    { name: "Renaissance", hours: 250, font: "Cormorant Garamond", weight: 700, paper: .35, tint: .68, grain: 10,
      water: "#3f6f92", shallow: "#6c9bb8", neutral: "#e6dcc0", ink: "#2a1c12", halo: "rgba(250,244,228,.6)", waves: true,
      rivals: ["#b8463f", "#3b6ea8", "#4f9a5a", "#d9a53a", "#8a5bab", "#d07f4c"] },
    { name: "Industrial", hours: 600, font: "Oswald", weight: 500, paper: .2, tint: .72, grain: 18,
      water: "#3a464e", shallow: "#56636a", neutral: "#b9ad96", ink: "#1d1a17", halo: "rgba(225,215,195,.5)", waves: false,
      rivals: ["#8c4a3c", "#4d6273", "#5e7350", "#a68a4a", "#6d5a78", "#8a6b55"] },
    { name: "Modern", hours: 1200, font: "Inter", weight: 800, paper: 0, tint: .9, grain: 5,
      water: "#0b1721", shallow: "#15293a", neutral: "#3b4047", ink: "#f1f1f1", halo: "rgba(0,0,0,.55)", waves: false,
      rivals: ["#e0565b", "#4c8dde", "#46b97a", "#e8b84a", "#a07ae0", "#e98a4f"] },
  ];
  const PLAYER_COLORS = ["#e2b43c", "#d1495b", "#3a86c8", "#2fa36b", "#8e5cc7", "#e07a3a", "#2bb3b1", "#f0f0f0"];

  // ---------- buildings (one type per subject) ----------
  const KINDS = {
    law:    { label: "Courthouse", effect: "50% chance to repel raiders here",
              names: ["Forum", "Royal Court", "Palace of Justice", "Ministry of Law", "Supreme Court"],
              icon: "M12 3v17M7 20h10M4 7h16M7 7l-3 7h6zM17 7l-3 7h6z" },
    trade:  { label: "Market", effect: "+5% gold from all study (up to +50%)",
              names: ["Agora", "Market Town", "Merchant Embassy", "Stock Exchange", "Trade Consulate"],
              icon: "M3 10l2-5h14l2 5M5 10v9h14v-9M3 10h18M10 19v-5h4v5" },
    health: { label: "Healer", effect: "+50% population in this province",
              names: ["Herb Garden", "Monastery Infirmary", "Apothecary", "Hospital", "Medical Centre"],
              icon: "M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7" },
    math:   { label: "Mint", effect: "+6% gold from all study (up to +60%)",
              names: ["Treasury", "Royal Mint", "Counting House", "Central Bank", "Reserve Bank"],
              icon: "M17 5H7l6 7-6 7h10" },
    science:{ label: "Laboratory", effect: "Technologies cost 8% less (up to 48%)",
              names: ["Observatory", "Alchemist's Tower", "Academy of Sciences", "Laboratory", "Research Lab"],
              icon: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.5 15h9" },
    arts:   { label: "Theatre", effect: "+25% population; this province never revolts",
              names: ["Amphitheatre", "Cathedral", "Opera House", "Museum", "Arts Centre"],
              icon: "M4 5h16v5a8 8 0 0 1-16 0zM9 9h.01M15 9h.01M9 13a4 4 0 0 0 6 0" },
    write:  { label: "Chancery", effect: "Peace treaties 15% cheaper and 1 week longer (up to 3)",
              names: ["Scribes' Hall", "Chancery", "Ministry of Letters", "Press Office", "Communications Office"],
              icon: "M4 20l4-1 11-11-3-3L5 16zM14 6l3 3" },
    listen: { label: "Spy network", effect: "Repels 20% of raids here; spies reveal raid targets",
              names: ["Listening Post", "Spy Network", "Secret Service", "Intelligence Bureau", "Signals Agency"],
              icon: "M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
    learn:  { label: "Library", effect: "+3% subject points from all study (up to +30%)",
              names: ["Library", "Scriptorium", "Academy", "University", "Research Institute"],
              icon: "M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" },
  };
  // what role a subject plays: chosen in Progress → Subjects, or guessed from its name
  const ROLES = [
    ["law", "Law & politics", "Courthouses — protect provinces from raids"],
    ["trade", "Languages & business", "Markets — more gold, and pay for peace treaties"],
    ["health", "Medicine & biology", "Healers — population boom"],
    ["math", "Math & economics", "Mints — the most gold"],
    ["science", "Science & tech", "Laboratories — cheaper technology"],
    ["arts", "History, literature & arts", "Theatres — population, no revolts"],
    ["write", "Writing & communication", "Chanceries — cheaper, longer peace treaties"],
    ["listen", "Listening & intelligence", "Spy networks — see and resist raids"],
    ["learn", "Anything else", "Libraries — more subject points"],
  ];
  // skills inside a subject (e.g. English · Writing) each become their own unit with their own building
  const skillKind = name => {
    const n = name.toLowerCase();
    if (/writ|essay|composit|redac/.test(n)) return "write";
    if (/listen|hear|audio|écoute|horen|hören/.test(n)) return "listen";
    if (/read|lecture|lesen|grammar|vocab/.test(n)) return "learn";
    if (/speak|oral|conversat|pronunc|parl/.test(n)) return "trade";
    return null;
  };
  // subjects plus their skill units, keyed "subjectId~Skill"
  function SUBJ() {
    const subs = ST.getSubjects(), out = Object.assign({}, subs);
    for (const id in subs) {
      const s = subs[id], sk = s.skills || [];
      sk.forEach(k => { out[id + "~" + k] = { name: s.name + " · " + k, short: k, color: s.color, target: (s.target || 0) / sk.length, archived: s.archived, parent: id, skill: k }; });
    }
    return out;
  }
  // what earns points and builds: plain subjects, or the skills of subjects that have them
  function UNITS() {
    const all = SUBJ(), out = [];
    for (const [id, s] of ST.activeSubjects()) {
      if (s.skills && s.skills.length) s.skills.forEach(k => out.push([id + "~" + k, all[id + "~" + k]]));
      else out.push([id, s]);
    }
    return out;
  }
  function guessKind(sid, name) {
    const n = (name || sid || "").toLowerCase();
    if (sid === "law" || /law|legal|jur|politic|recht|droit/.test(n)) return "law";
    if (/literat|histor|philos|poetry|classics/.test(n)) return "arts";
    if (sid === "french" || /french|english|spanish|german|italian|dutch|turkish|arabic|chinese(?! med)|japanese|language|langue|business|marketing|management/.test(n)) return "trade";
    if (sid === "tcm" || /tcm|medic|health|bio|chinese med|anat|nurs|pharm|physio/.test(n)) return "health";
    if (/math|calcul|algebra|statist|econ|financ|account|geometr/.test(n)) return "math";
    if (/physic|chem|engineer|computer|program|coding|informat|tech|electr|science/.test(n)) return "science";
    if (/histor|literat|art|philos|music|design|religio|classic|poetry|writing/.test(n)) return "arts";
    return "learn";
  }
  function kindOf(sid) {
    if (sid && sid.includes("~")) {
      const [pid, k] = sid.split("~");
      return skillKind(k) || kindOf(pid);
    }
    const s = ST.getSubjects()[sid];
    if (s && s.kind && KINDS[s.kind]) return s.kind;
    return guessKind(sid, s && s.name);
  }
  const CROWN = new Path2D("M3 18h18M4 18L3 7l5 4 4-7 4 7 5-4-1 11");
  const STAR = new Path2D("M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z");
  const ICONS = {}; for (const k in KINDS) ICONS[k] = new Path2D(KINDS[k].icon);

  const TERRAIN = {
    plains:    { label: "Plains", cost: 1, pop: 12, tint: null },
    forest:    { label: "Forest", cost: 1.15, pop: 8, tint: [46, 82, 44], a: .22 },
    hills:     { label: "Hills", cost: 1.25, pop: 7, tint: [120, 100, 70], a: .12 },
    mountains: { label: "Mountains", cost: 1.6, pop: 4, tint: [150, 145, 140], a: .3 },
    desert:    { label: "Dry steppe", cost: .9, pop: 4, tint: [214, 186, 120], a: .28 },
  };
  const RANKS = [[70, "Great Empire"], [30, "Empire"], [12, "Kingdom"], [5, "Principality"], [1, "Chiefdom"]];
  const rankOf = n => (RANKS.find(r => n >= r[0]) || RANKS[4])[1];

  // ---------- seeded randomness ----------
  function mulberry32(a) {
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function makeNoise(rand) {
    const N = 256, g = new Float32Array(N * N);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    const f = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const x0 = xi & 255, x1 = (xi + 1) & 255, y0 = (yi & 255) * N, y1 = ((yi + 1) & 255) * N;
      const a = g[y0 + x0], b = g[y0 + x1], c = g[y1 + x0], d = g[y1 + x1];
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y, oct) => { let s = 0, amp = 1, fr = 1, norm = 0; for (let o = 0; o < oct; o++) { s += amp * f(x * fr + o * 17.3, y * fr + o * 9.1); norm += amp; amp *= .5; fr *= 2; } return s / norm; };
  }
  const SYL1 = ["ar", "bel", "cor", "dra", "el", "fen", "gal", "hel", "is", "kar", "lor", "mar", "nor", "or", "pel", "ral", "sar", "tor", "ul", "val", "wen", "xan", "yr", "zan", "ash", "bran", "cel", "dun", "eth", "fal", "gor", "hal", "ith", "kel", "lys", "mor", "nim", "ost", "rhe", "sil", "tam", "vor", "an", "es", "ob", "tal"];
  const SYL2 = ["a", "e", "i", "o", "ae", "ia", "io", "u"];
  const SYL3 = ["ria", "dor", "mar", "nia", "lon", "thas", "vel", "gard", "heim", "mos", "rin", "nor", "tia", "wyn", "oth", "ara", "esh", "ium", "yr", "ica", "sund", "burg", "ton", "is", "ene", "atha"];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function nameGen(rand) {
    const used = new Set();
    const pick = a => a[Math.floor(rand() * a.length)];
    return (long) => {
      for (let i = 0; i < 50; i++) {
        const n = cap(pick(SYL1) + (long || rand() < .35 ? pick(SYL2) : "") + pick(SYL3));
        if (!used.has(n) && n.length <= 12) { used.add(n); return n; }
      }
      return cap(pick(SYL1) + pick(SYL3)) + " " + used.size;
    };
  }

  // ---------- map generation (deterministic from seed) ----------
  function generate(seed) {
    const rand = mulberry32(seed);
    const nEl = makeNoise(rand), nMo = makeNoise(rand), nWx = makeNoise(rand), nWy = makeNoise(rand);
    const val = new Float32Array(W * H);
    const blobs = [];
    for (let i = 0; i < 3; i++) blobs.push({ x: (.28 + rand() * .44) * W, y: (.3 + rand() * .4) * H, r: (.3 + rand() * .14) * H });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let f = 0;
      for (const b of blobs) { const dx = x - b.x, dy = y - b.y; f = Math.max(f, 1 - Math.sqrt(dx * dx + dy * dy) / b.r); }
      const e = Math.min(1, Math.min(x, W - x, y, H - y) / (.16 * H));
      val[y * W + x] = nEl(x / 210, y / 210, 5) * .95 + f * .7 - (1 - e) * (1 - e) * 1.4;
    }
    const sample = [];
    for (let i = 0; i < val.length; i += 13) sample.push(val[i]);
    sample.sort((a, b) => a - b);
    const thr = sample[Math.floor(sample.length * .56)];

    // seeds on a jittered grid
    const gx = Math.ceil(W / CELL), gy = Math.ceil(H / CELL);
    const grid = new Int32Array(gx * gy).fill(-1);
    let seeds = [];
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
      const sx = Math.floor((i + .15 + rand() * .7) * CELL), sy = Math.floor((j + .15 + rand() * .7) * CELL);
      if (sx < W && sy < H && val[sy * W + sx] > thr) { grid[j * gx + i] = seeds.length; seeds.push({ x: sx, y: sy, on: true }); }
    }
    const prov = new Int16Array(W * H);
    const warpX = new Float32Array(W * H), warpY = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      warpX[i] = x + (nWx(x / 45, y / 45, 2) - .5) * 44;
      warpY[i] = y + (nWy(x / 45, y / 45, 2) - .5) * 44;
    }
    const assign = () => {
      const cnt = new Int32Array(seeds.length);
      for (let i = 0; i < W * H; i++) {
        prov[i] = -1;
        if (val[i] <= thr) continue;
        const wx = warpX[i], wy = warpY[i];
        const bi = Math.floor(wx / CELL), bj = Math.floor(wy / CELL);
        let best = -1, bd = 1e12;
        for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
          const ii = bi + di, jj = bj + dj;
          if (ii < 0 || jj < 0 || ii >= gx || jj >= gy) continue;
          const s = grid[jj * gx + ii];
          if (s < 0 || !seeds[s].on) continue;
          const dx = seeds[s].x - wx, dy = seeds[s].y - wy, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = s; }
        }
        prov[i] = best;
        if (best >= 0) cnt[best]++;
      }
      return cnt;
    };
    let cnt = assign();
    let dropped = false;
    seeds.forEach((s, i) => { if (cnt[i] < 300) { s.on = false; dropped = true; } });
    if (dropped) cnt = assign();
    // compact ids
    const remap = new Int32Array(seeds.length).fill(-1);
    let N = 0;
    seeds.forEach((s, i) => { if (s.on && cnt[i] > 0) remap[i] = N++; });
    for (let i = 0; i < W * H; i++) {
      if (prov[i] >= 0) prov[i] = remap[prov[i]];
      if (prov[i] < 0 && val[i] > thr) val[i] = thr - .001;   // stray land with no province becomes sea
    }

    const P = Array.from({ length: N }, () => ({ n: 0, sx: 0, sy: 0, el: 0, coastal: false, nb: new Set(), minx: W, miny: H, maxx: 0, maxy: 0 }));
    const flags = new Uint8Array(W * H);   // 1 = coast, 2 = province edge
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, p = prov[i];
      if (p < 0) continue;
      const o = P[p];
      o.n++; o.sx += x; o.sy += y; o.el += val[i];
      if (x < o.minx) o.minx = x; if (x > o.maxx) o.maxx = x; if (y < o.miny) o.miny = y; if (y > o.maxy) o.maxy = y;
      const nbrs = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nbrs) {
        if (j < 0 || prov[j] < 0) { flags[i] |= 1; o.coastal = true; continue; }
        if (prov[j] !== p) { flags[i] |= 2; o.nb.add(prov[j]); }
      }
    }
    P.forEach(o => { o.cx = o.sx / o.n; o.cy = o.sy / o.n; o.el /= o.n; o.best = 1e12; });
    // anchor point: province pixel closest to its centroid
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const p = prov[y * W + x]; if (p < 0) continue;
      const o = P[p], d = (x - o.cx) ** 2 + (y - o.cy) ** 2;
      if (d < o.best) { o.best = d; o.ax = x; o.ay = y; }
    }
    P.forEach(o => { if (o.ax === undefined) { o.ax = o.cx; o.ay = o.cy; } });

    // terrain from elevation and moisture ranks
    const byEl = P.map((o, i) => i).sort((a, b) => P[b].el - P[a].el);
    byEl.forEach((p, r) => { P[p].elRank = r / N; });
    const mo = P.map(o => nMo(o.cx / 260, o.cy / 260, 3));
    const byMo = P.map((o, i) => i).sort((a, b) => mo[b] - mo[a]);
    byMo.forEach((p, r) => { P[p].moRank = r / N; });
    P.forEach(o => {
      o.t = o.elRank < .09 ? "mountains" : o.elRank < .22 ? "hills"
        : o.moRank < .3 ? "forest" : (o.moRank > .82 && o.cy > H * .45) ? "desert" : "plains";
    });

    // connect islands to the main land by sea routes
    const comp = new Int32Array(N).fill(-1), sizes = [];
    for (let s = 0; s < N; s++) {
      if (comp[s] >= 0) continue;
      const c = sizes.length; let k = 0; const q = [s]; comp[s] = c;
      while (q.length) { const p = q.pop(); k++; for (const n of P[p].nb) if (comp[n] < 0) { comp[n] = c; q.push(n); } }
      sizes.push(k);
    }
    const main = sizes.indexOf(Math.max(...sizes));
    const seaLinks = [];
    for (let c = 0; c < sizes.length; c++) {
      if (c === main) continue;
      let best = null, bd = 1e12;
      for (let a = 0; a < N; a++) if (comp[a] === c) for (let b = 0; b < N; b++) if (comp[b] === main && P[b].coastal) {
        const d = (P[a].cx - P[b].cx) ** 2 + (P[a].cy - P[b].cy) ** 2;
        if (d < bd) { bd = d; best = [a, b]; }
      }
      if (best) { P[best[0]].nb.add(best[1]); P[best[1]].nb.add(best[0]); seaLinks.push(best); }
    }
    const names = nameGen(mulberry32(seed ^ 0x5bd1e995));
    P.forEach((o, i) => { o.name = names(false); o.nb = [...o.nb]; o.main = comp[i] === main; });
    // rivers: from high ground, follow the slope down to the sea
    const rr = mulberry32(seed ^ 0x2545f491), rivers = [], landHigh = [];
    for (let k = 0; k < 2500; k++) {
      const x = 20 + Math.floor(rr() * (W - 40)), y = 20 + Math.floor(rr() * (H - 40));
      if (prov[y * W + x] >= 0) landHigh.push([x, y, val[y * W + x]]);
    }
    landHigh.sort((a, b) => b[2] - a[2]);
    const srcs = [];
    for (const c of landHigh.slice(0, Math.floor(landHigh.length * .3))) {
      if (srcs.length >= 14) break;
      if (srcs.every(s => (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2 > 110 * 110) && rr() < .5) srcs.push(c);
    }
    for (const [sx, sy] of srcs) {
      let x = sx, y = sy;
      const pts = [[x, y]], seen = new Set();
      for (let step = 0; step < 400; step++) {
        const cur = val[y * W + x];
        let best = null, bv = cur + .004;
        for (let a = 0; a < 12; a++) {
          const ang = a / 12 * Math.PI * 2, nx = Math.round(x + Math.cos(ang) * 5), ny = Math.round(y + Math.sin(ang) * 5);
          if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1 || seen.has(ny * W + nx)) continue;
          const v = val[ny * W + nx] + (rr() - .5) * .006;
          if (v < bv) { bv = v; best = [nx, ny]; }
        }
        if (!best) break;
        [x, y] = best; seen.add(y * W + x); pts.push(best);
        if (val[y * W + x] <= thr) break;
      }
      if (pts.length > 18 && val[y * W + x] <= thr) rivers.push(pts);
    }
    return { seed, val, thr, prov, flags, P, N, seaLinks, rivers, nameGen: names };
  }

  // nations: player start + rival nations, used once when the empire is founded
  function foundNations(map, seed) {
    const rand = mulberry32(seed ^ 0x9e3779b9);
    const { P, N } = map;
    const owner = new Array(N).fill(-1);
    const cands = P.map((o, i) => i).filter(i => P[i].main && P[i].t !== "mountains" && P[i].nb.length >= 4)
      .sort((a, b) => ((P[a].cx - W / 2) ** 2 + (P[a].cy - H / 2) ** 2) - ((P[b].cx - W / 2) ** 2 + (P[b].cy - H / 2) ** 2));
    const capital = cands.length ? cands[Math.floor(rand() * Math.min(10, cands.length))] : 0;
    // graph distance from the capital
    const dist = new Array(N).fill(1e9); dist[capital] = 0;
    const q = [capital];
    while (q.length) { const p = q.shift(); for (const n of P[p].nb) if (dist[n] > dist[p] + 1) { dist[n] = dist[p] + 1; q.push(n); } }
    owner[capital] = 0;
    P[capital].nb.filter(n => P[n].t !== "mountains").slice(0, 2).forEach(n => { owner[n] = 0; });
    // rival capitals: spread far apart
    const rivals = [], picked = [capital];
    for (let r = 0; r < 6; r++) {
      let best = -1, bd = -1;
      for (let i = 0; i < N; i++) {
        if (!P[i].main || dist[i] < 4 || picked.includes(i)) continue;
        const d = Math.min(...picked.map(p => (P[i].cx - P[p].cx) ** 2 + (P[i].cy - P[p].cy) ** 2)) * (.8 + rand() * .4);
        if (d > bd) { bd = d; best = i; }
      }
      if (best < 0) break;
      picked.push(best); owner[best] = r + 1;
      rivals.push({ cap: best, front: [best], goal: Math.round(N * (.065 + rand() * .045)), size: 1 });
    }
    let grew = true;
    while (grew) {
      grew = false;
      for (let r = 0; r < rivals.length; r++) {
        const R = rivals[r];
        if (R.size >= R.goal) continue;
        const opts = [];
        for (const p of R.front) for (const n of P[p].nb) if (owner[n] === -1 && dist[n] > 2) opts.push(n);
        if (!opts.length) continue;
        const n = opts[Math.floor(rand() * opts.length)];
        owner[n] = r + 1; R.front.push(n); R.size++; grew = true;
      }
    }
    const names = map.nameGen;
    return { owner, capital, rivals: rivals.map(R => ({ name: names(true), cap: R.cap })) };
  }

  // ---------- state ----------
  let st = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.v === 1 ? s : null; } catch (e) { return null; }
  }
  const encOwner = o => o.map(v => v < 0 ? "." : String(v)).join("");
  const decOwner = s => [...s].map(c => c === "." ? -1 : +c);
  function snapshot() {
    st.hist = st.hist || [];
    const o = encOwner(st.owner), last = st.hist[st.hist.length - 1], d = todayK();
    if (last && last.o === o) return;
    if (last && last.d === d && st.hist.length > 1) last.o = o; else st.hist.push({ d, o });
    if (st.hist.length > 400) st.hist = st.hist.filter((x, i) => i % 2 === 0 || i > st.hist.length - 100);
  }
  function save() {
    if (st.owner) snapshot();
    st.updated = Date.now();
    const json = JSON.stringify(st);
    try { localStorage.setItem(KEY, json); } catch (e) {}
    if (ST.pushEmpire) ST.pushEmpire(json, st.updated);
  }
  // newest version wins between devices; only push after hearing from the server so a stale device can't overwrite
  function applyRemote(r, fromCache) {
    const ru = r ? +r.updated || 0 : 0, lu = st ? +st.updated || 0 : 0;
    if (r && ru > lu && typeof r.json === "string") {
      let s = null;
      try { s = JSON.parse(r.json); } catch (e) {}
      if (!s || s.v !== 1) return;
      const seedChanged = !st || st.seed !== s.seed;
      st = s;
      try { localStorage.setItem(KEY, r.json); } catch (e) {}
      if (seedChanged) { ready = false; sel = -1; selMask = null; map = null; }
      if (isOpen()) {
        if (waitingForAccount) { waitingForAccount = false; closeModal(); }
        if (!ready) { $("empLoading").hidden = false; setTimeout(() => { $("empLoading").hidden = true; start(); }, 30); }
        else refresh();
      }
    } else if (st && lu > ru && !fromCache && ST.pushEmpire) ST.pushEmpire(JSON.stringify(st), st.updated);
    if (!fromCache && waitingForAccount && !st) { waitingForAccount = false; closeModal(); showFounding(); }
  }
  let waitingForAccount = false;
  let map = null;
  function ensureMap() { if (st && (!map || map.seed !== st.seed)) map = generate(st.seed); return map; }

  const ownedList = () => st.owner.map((o, i) => o === 0 ? i : -1).filter(i => i >= 0);
  function countKind(kind) {
    let n = 0;
    for (const p in st.bld) for (const sid in st.bld[p]) if (st.owner[p] === 0 && kindOf(sid) === kind) n++;
    return n;
  }
  const merchantPeace = () => st && st.rivals ? st.rivals.filter((R, i) => persona(i + 1) === "merchant" && atPeace(i + 1)).length * .05 : 0;
  const seasonVal = k => { const s = st ? season() : null; return s && s[k] || 0; };
  const goldMult = () => 1 + seasonVal("gold") + merchantPeace() + Math.min(.5, countKind("trade") * (tech("guilds") ? .07 : .05)) + (st && st.decrees ? streakBonus() : 0)
    + (tech("banking") ? .1 : 0) + (tech("internet") ? .15 : 0) + (wonderDone("trade") ? .15 : 0)
    + Math.min(.6, countKind("math") * .06) + (wonderDone("math") ? .2 : 0);
  const ptsMult = () => 1 + seasonVal("pts") + (tech("printing") ? .1 : 0) + (wonderDone("learn") ? .1 : 0) + Math.min(.3, countKind("learn") * .03);
  const techDiscount = () => Math.min(.48, countKind("science") * .08) + (wonderDone("science") ? .25 : 0);
  const repelChance = () => Math.min(.85, .5 + (tech("fortify") ? .1 : 0) + (wonderDone("law") ? .25 : 0));
  function provPop(p) {
    const o = map.P[p]; let pop = TERRAIN[o.t].pop + (o.coastal ? 4 : 0);
    let m = 1;
    for (const sid in (st.bld[p] || {})) { const k = kindOf(sid); if (k === "health") m += tech("herbal") ? .75 : .5; else if (k === "arts") m += .25; }
    const g = (tech("medicine") ? 1.2 : 1) * (tech("healthcare") ? 1.5 : 1) * (wonderDone("health") ? 1.25 : 1) * (wonderDone("arts") ? 1.15 : 1);
    return pop * m * g * [1, 1.6, 2.5, 4, 7][eraIdx()] * 1000;
  }
  const fmtPop = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : Math.round(n / 1000) + "k";
  function claimCost(p) {
    let c = (40 + 10 * (ownedList().length - 1)) * TERRAIN[map.P[p].t].cost * (tech("survey") ? .9 : 1) * (tech("rail") ? .85 : 1);
    if (st.owner[p] > 0) c *= persona(st.owner[p]) === "peaceful" ? 1.25 : 1.5;
    const se = season(); if (se && se.claim) c *= se.claim;
    return Math.round(c);
  }
  function buildCost(sid) {
    let n = 0;
    for (const p in st.bld) if (st.bld[p][sid]) n++;
    return kindOf(sid) === "law" ? Math.round((120 + 30 * n) * (tech("codified") ? .75 : 1)) : 60 + 15 * n;
  }
  const isClaimable = p => st.owner[p] !== 0 && map.P[p].nb.some(n => st.owner[n] === 0);

  // totals from the timer's history (all devices combined, or one device's history)
  function totals(h) {
    h = h || ST.getHistory();
    const t = {};
    let all = 0;
    for (const k in h) {
      const r = h[k]; if (!r) continue;
      const f = +r.f || 0; all += f;
      let s = 0;
      const by = r.by || {};
      for (const id in by) {
        if (id === "_none") continue;
        const v = +by[id] || 0; s += v;
        const subj = ST.getSubjects()[id], sk = (subj && subj.skills) || [];
        if (!sk.length) { t[id] = (t[id] || 0) + v; continue; }
        // a subject with skills: tagged time goes to its skill, untagged time is shared between the skills
        const tagged = ((r.sk || {})[id]) || {};
        let used = 0;
        sk.forEach(k => { const x = +tagged[k] || 0; used += x; t[id + "~" + k] = (t[id + "~" + k] || 0) + x; });
        const rest = Math.max(0, v - used) / sk.length;
        sk.forEach(k => { t[id + "~" + k] += rest; });
      }
      t._none = (t._none || 0) + Math.max(0, f - s);
    }
    return { t, all };
  }
  function weekSecs(monday, sid) {
    const h = ST.getHistory(); let s = 0;
    for (let i = 0; i < 7; i++) { const r = h[addDays(monday, i)]; if (r && r.by) s += +r.by[sid] || 0; }
    return s;
  }
  function eraIdx() {
    const hrs = totals().all / 3600;
    let i = 0; ERAS.forEach((e, j) => { if (hrs >= e.hours) i = j; });
    return i;
  }
  const viewEra = () => st && st.viewEra != null && st.viewEra <= eraIdx() ? st.viewEra : eraIdx();
  function logEvent(text, kind) {
    st.log.unshift({ d: todayK(), t: text, k: kind || "" });
    st.log.length = Math.min(st.log.length, 80);
  }

  // turn new study time into gold and subject points
  // credited time is tracked per device: a device whose data hasn't loaded yet is simply skipped
  function credit(silent) {
    const devs = ST.deviceHistories ? ST.deviceHistories() : { local: ST.getHistory() };
    const myKey = Object.keys(devs)[0];
    if (Object.values(st.credited).some(v => typeof v === "number")) st.credited = { [myKey]: st.credited };   // older format
    const mult = goldMult();
    let g = 0; const gained = {};
    for (const dev in devs) {
      const { t } = totals(devs[dev]);
      const cr = st.credited[dev] || (st.credited[dev] = {});
      for (const id of new Set([...Object.keys(t), ...Object.keys(cr)])) {
        const now = t[id] || 0, was = cr[id] || 0, d = now - was;
        if (Math.abs(d) < 1) continue;
        cr[id] = now;
        const mins = d / 60;
        g += d > 0 ? mins * mult : mins;
        if (id !== "_none") { const pm = mins * (d > 0 ? ptsMult() : 1); st.pts[id] = (st.pts[id] || 0) + pm; gained[id] = (gained[id] || 0) + pm; }
      }
    }
    const parts = Object.entries(gained).filter(([, m]) => m >= 1);
    if (!g && !Object.keys(gained).length) return;
    st.gold += g;
    save();
    if (!silent && g >= 1) coinToast(g, parts);
  }

  // weekly border check: missed targets → rivals take border provinces
  function processWeeks() {
    if (ST.syncReady && !ST.syncReady()) return;   // wait until other devices' hours have loaded
    const lastDone = addDays(weekOf(todayK()), -7);
    let w = addDays(st.raidWeek, 7), guard = 0;
    if (w <= lastDone) ensureMap();
    while (w <= lastDone && guard++ < 60) {
      if (kd(w) >= kd(addDays(lastDone, -7 * 8))) evaluateWeek(w);   // only the last 8 weeks if you've been away long
      st.raidWeek = w;
      w = addDays(w, 7);
    }
  }
  // each week every rival nation takes one free province next to it (same result on every device)
  function rivalsGrow(w, rep) {
    const rand = mulberry32(st.seed ^ (kd(w).getTime() / 86400000 | 0));
    const took = [];
    st.rivals.forEach((R, i) => {
      const r = i + 1, opts = [];
      for (let p = 0; p < map.N; p++) if (st.owner[p] === r) for (const n of map.P[p].nb) if (st.owner[n] === -1 && !opts.includes(n)) opts.push(n);
      if (!opts.length) return;
      const kind = persona(r);
      if (kind === "peaceful" && ((kd(w).getTime() / 604800000) | 0) % 2) return;   // grows every other week
      for (let n = kind === "expansionist" ? 2 : 1; n > 0 && opts.length; n--) {
        const i = Math.floor(rand() * opts.length), p = opts.splice(i, 1)[0];
        st.owner[p] = r;
        took.push({ p, by: R.name });
      }
    });
    if (took.length) {
      rep.grew = took;
      logEvent(`Week of ${shortDate(w)}: rival nations expanded into ${took.length} free province${took.length > 1 ? "s" : ""}`, "rival");
    }
  }
  function evaluateWeek(w) {
    const subs = ST.activeSubjects().filter(([, s]) => s.target > 0);
    const rep = { week: w, lines: [], tribute: 0 };
    rivalsGrow(w, rep);
    resolveEvent(w, rep);
    for (const [sid, s] of subs) {
      const done = weekSecs(w, sid) / 3600;
      if (done >= s.target) { rep.tribute += 20; rep.lines.push({ sid, done, target: s.target, ok: true }); continue; }
      const aidLeft = (st.aid || {})[w] ? 2 - (rep.aidUsed || 0) : 0;
      const raw = Math.max(0, Math.min(4, Math.ceil((1 - done / s.target) * 4)) - (tech("police") ? 1 : 0) - (wonderDone("listen") ? 1 : 0));
      const blocked = Math.min(aidLeft, raw);
      rep.aidUsed = (rep.aidUsed || 0) + blocked;
      const n = raw - blocked;
      const { lost, repelled } = seizeBorder(n, null, w);
      const shielded = repelled.length > 0;
      rep.lines.push({ sid, done, target: s.target, ok: false, lost, shielded, repelled: repelled.map(p => map.P[p].name) });
      const held = repelled.length ? ` · courthouses repelled raiders at ${repelled.map(p => map.P[p].name).join(", ")}` : "";
      if (lost.length) logEvent(`Week of ${shortDate(w)}: ${SUBJ()[sid].name} target missed (${done.toFixed(1)}/${s.target}h) — lost ${lost.map(l => map.P[l.p].name).join(", ")}${held}`, "raid");
      else logEvent(`Week of ${shortDate(w)}: ${SUBJ()[sid].name} target missed, but ${shielded ? "your courthouses repelled every raid" : "there was nothing to take"}`, "raid");
    }
    if (subs.length && rep.lines.length && rep.lines.every(l => l.ok)) st.perfectWeeks = (st.perfectWeeks || 0) + 1;
    if (rep.tribute) { st.gold += rep.tribute; logEvent(`Week of ${shortDate(w)}: targets met — +${rep.tribute} gold tribute`, "good"); }
    st.reports.push(rep);
    st.reports = st.reports.slice(-6);
  }
  const hasKind = (p, kind) => Object.keys(st.bld[p] || {}).some(sid => kindOf(sid) === kind);

  // Take up to n of your border provinces. enemy = a specific rival (war) or null (any hostile neighbour / rebels).
  // Rivals you have a treaty with never take land; courthouses repel 50% of attempts.
  function seizeBorder(n, enemy, day) {
    const lost = [], tried = [], repelled = [];
    const hostile = r => r > 0 && (enemy ? r === enemy : !atPeace(r, day));
    const canTake = p => map.P[p].nb.some(nb => hostile(st.owner[nb]) || (!enemy && st.owner[nb] === -1));
    for (let i = 0; i < n; i++) {
      const owned = ownedList();
      if (owned.length <= 1) break;
      let cands = owned.filter(p => p !== st.capital && !tried.includes(p) && canTake(p));
      if (!cands.length && enemy) cands = owned.filter(p => p !== st.capital && !tried.includes(p) && map.P[p].nb.some(nb => st.owner[nb] !== 0));
      if (!cands.length) break;
      const score = p => map.P[p].nb.filter(nb => hostile(st.owner[nb])).length + Math.random() * .9;
      cands.sort((a, b) => score(b) - score(a));
      const p = cands[0];
      tried.push(p);
      if ((hasKind(p, "law") && Math.random() < repelChance()) || (hasKind(p, "listen") && Math.random() < .2)) { repelled.push(p); continue; }
      let taker = enemy;
      if (!taker) {
        const tally = {};
        map.P[p].nb.forEach(nb => { const r = st.owner[nb]; if (hostile(r)) tally[r] = (tally[r] || 0) + 1; });
        taker = +(Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || 0);
      }
      st.owner[p] = taker || -1;
      lost.push({ p, by: taker ? st.rivals[taker - 1].name : "Rebels" });
    }
    return { lost, repelled };
  }

  // ---------- achievements ----------
  const ACH = [
    ["h1", "First hour", "Study for 1 hour in total", () => hoursAll() >= 1],
    ["h10", "Getting serious", "10 hours of study", () => hoursAll() >= 10],
    ["h50", "Dedicated", "50 hours of study", () => hoursAll() >= 50],
    ["h100", "Centurion", "100 hours of study", () => hoursAll() >= 100],
    ["h250", "Scholar", "250 hours of study", () => hoursAll() >= 250],
    ["h500", "Master", "500 hours of study", () => hoursAll() >= 500],
    ["h1000", "Legend", "1,000 hours of study", () => hoursAll() >= 1000],
    ["day6", "Marathon day", "6 hours of study in one day", () => bestDay() >= 6],
    ["day9", "Iron will", "9 hours of study in one day", () => bestDay() >= 9],
    ["p10", "Growing realm", "Rule 10 provinces", () => ownedList().length >= 10],
    ["p30", "Empire builder", "Rule 30 provinces", () => ownedList().length >= 30],
    ["p70", "Conqueror of the continent", "Rule 70 provinces", () => ownedList().length >= 70],
    ["conq", "First conquest", "Take a province from a rival nation", () => (st.conquests || 0) >= 1],
    ["b10", "Builder", "Raise 10 buildings", () => Object.values(st.bld).reduce((a, b) => a + Object.keys(b).length, 0) >= 10],
    ["s7", "Week of discipline", "Fulfil every decree 7 days in a row", () => streak() >= 7],
    ["s30", "Unbreakable", "Fulfil every decree 30 days in a row", () => streak() >= 30],
    ["perfect", "Perfect week", "Hit every weekly target in one week", () => (st.perfectWeeks || 0) >= 1],
    ["perfect4", "Perfect month", "Four perfect weeks", () => (st.perfectWeeks || 0) >= 4],
    ["war", "Victorious", "Win an exam campaign", () => (st.trophies || []).some(t => t.won)],
    ["war3", "Warlord", "Win three exam campaigns", () => (st.trophies || []).filter(t => t.won).length >= 3],
    ["peace", "Diplomat", "Sign a peace treaty", () => Object.keys(st.treaties || {}).length >= 1],
    ["tech5", "Inventive", "Make 5 discoveries", () => Object.keys(st.techs || {}).length >= 5],
    ["wonder", "Wonder of the world", "Complete a wonder", () => Object.keys(WONDERS).some(wonderDone)],
    ["era1", "Middle Ages", "Reach the Medieval era", () => eraIdx() >= 1],
    ["era2", "Rebirth", "Reach the Renaissance", () => eraIdx() >= 2],
    ["era3", "Age of steam", "Reach the Industrial era", () => eraIdx() >= 3],
    ["era4", "Modern times", "Reach the Modern era", () => eraIdx() >= 4],
  ];
  const hoursAll = () => totals().all / 3600;
  function bestDay() { const h = ST.getHistory(); let m = 0; for (const k in h) m = Math.max(m, +h[k].f || 0); return m / 3600; }
  function checkAchievements(silent) {
    st.ach = st.ach || {};
    const fresh = [];
    for (const [id, name, , test] of ACH) {
      if (st.ach[id]) continue;
      let ok = false; try { ok = test(); } catch (e) {}
      if (!ok) continue;
      st.ach[id] = todayK(); st.gold += 50; fresh.push(name);
      logEvent(`Achievement: ${name} (+50 gold)`, "good");
    }
    if (fresh.length && !silent) {
      ST.toast(fresh.length === 1 ? `Achievement unlocked: ${fresh[0]} · +50 gold` : `${fresh.length} achievements unlocked · +${fresh.length * 50} gold`, "#f2c94c");
      ST.confetti && ST.confetti(["#f2c94c", "#ffffff", st.color]);
    }
  }
  function showTrophies() {
    const got = st.ach || {}, n = ACH.filter(a => got[a[0]]).length;
    const wars = (st.trophies || []).slice().reverse();
    modal(`${realmTabs("tro")}<p class="tip"><b>${n}</b> of ${ACH.length} achievements · each one pays 50 gold.</p>
      <div class="ach-grid">${ACH.map(([id, name, desc]) => `<div class="ach ${got[id] ? "got" : ""}"><b>${got[id] ? "★" : "☆"} ${esc(name)}</b><small>${esc(desc)}${got[id] ? " · " + shortDate(got[id]) : ""}</small></div>`).join("")}</div>
      ${wars.length ? `<h3 class="t-head" style="margin-top:16px">Exam campaigns</h3>${wars.map(t => `<div class="tech"><span><b>${t.won ? "Victory" : "Defeat"} vs ${esc(t.enemy)}</b><small>${esc(t.name)} exam · ${shortDate(t.exam)} · ${t.hours}/${t.goal}h</small></span><em class="${t.won ? "good" : "bad"}">${t.won ? "won" : "lost"}</em></div>`).join("")}` : ""}
      <div class="m-actions"><button class="btn go" data-x>Close</button></div>`, e => { if (tabClick(e)) return; if (e.target.closest("[data-x]")) closeModal(); });
  }

  // ---------- rival personalities (fixed per map) ----------
  const PERS = {
    warlike:      { label: "Warlike", desc: "Peace costs 50% more; first to declare exam wars" },
    expansionist: { label: "Expansionist", desc: "Grabs two free provinces a week" },
    merchant:     { label: "Merchants", desc: "Peace costs 40% less; +5% gold while at peace with them" },
    peaceful:     { label: "Peaceful", desc: "Grows slowly, rarely goes to war; their land costs only 25% extra" },
  };
  let persCache = null;
  function persona(r) {
    if (!persCache || persCache.seed !== st.seed) {
      const rand = mulberry32(st.seed ^ 0x7e1a), list = ["warlike", "expansionist", "merchant", "peaceful", "warlike", "merchant"];
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      persCache = { seed: st.seed, list };
    }
    return persCache.list[(r - 1) % 6];
  }

  // ---------- seasons: bonus weeks on the calendar ----------
  const SEASONS = [
    { id: "newyear", name: "New Year festival", from: "12-28", to: "01-04", effect: "+25% gold from all study", gold: .25 },
    { id: "exams1", name: "Winter exam season", from: "01-05", to: "01-31", effect: "Decree rewards doubled", decree: 2 },
    { id: "spring", name: "Spring renewal", from: "03-20", to: "04-05", effect: "Claiming land 20% cheaper", claim: .8 },
    { id: "exams2", name: "Summer exam season", from: "05-20", to: "06-30", effect: "Decree rewards doubled", decree: 2 },
    { id: "harvest", name: "Harvest festival", from: "09-20", to: "10-10", effect: "+20% subject points from all study", pts: .2 },
  ];
  function season(k = todayK()) {
    const md = k.slice(5);
    const s = SEASONS.find(x => x.from <= x.to ? md >= x.from && md <= x.to : md >= x.from || md <= x.to);
    if (s) return s;
    // your own exam week: an exam within 7 days
    for (const [, x] of ST.activeSubjects()) if (x.exam && x.exam >= k && x.exam <= addDays(k, 7)) return { id: "examweek", name: "Your exam week", effect: "+20% gold from all study", gold: .2 };
    return null;
  }

  // ---------- spies: with a spy network, see which provinces raiders would hit if the week ended now ----------
  function spyTargets() {
    if (!st || !countKind("listen")) return [];
    const mon = weekOf(todayK());
    let n = 0;
    for (const [sid, s] of ST.activeSubjects()) {
      if (!(s.target > 0)) continue;
      const done = weekSecs(mon, sid) / 3600;
      if (done < s.target) n += Math.max(0, Math.min(4, Math.ceil((1 - done / s.target) * 4)) - (tech("police") ? 1 : 0) - (wonderDone("listen") ? 1 : 0));
    }
    if (!n) return [];
    const hostile = r => r > 0 && !atPeace(r);
    const c = ownedList().filter(p => p !== st.capital && map.P[p].nb.some(nb => hostile(st.owner[nb]) || st.owner[nb] === -1));
    c.sort((a, b) => map.P[b].nb.filter(nb => hostile(st.owner[nb])).length - map.P[a].nb.filter(nb => hostile(st.owner[nb])).length || a - b);
    return c.slice(0, n);
  }

  // ---------- diplomacy: French (trade) points buy peace treaties ----------
  const TREATY_WEEKS = 4;
  const treatyWeeks = () => (tech("telegraph") ? 6 : TREATY_WEEKS) + Math.min(3, countKind("write")) + (wonderDone("write") ? 2 : 0);
  const atPeace = (r, day) => !!(st.treaties && st.treaties[r] && st.treaties[r] > (day || todayK()));
  const activeTreaties = () => Object.keys(st.treaties || {}).filter(r => atPeace(+r)).length;
  const treatyCost = r => Math.round((150 + 50 * activeTreaties()) * (1 - Math.min(.45, countKind("write") * .15)) * ({ warlike: 1.5, merchant: .6 }[r ? persona(r) : ""] || 1));
  function tradeSubject() {
    const t = UNITS().filter(([id]) => kindOf(id) === "trade" || kindOf(id) === "write");
    t.sort((a, b) => (st.pts[b[0]] || 0) - (st.pts[a[0]] || 0));
    return t[0] ? t[0][0] : null;
  }
  function bordersYou(r) {
    for (let p = 0; p < map.N; p++) if (st.owner[p] === r && map.P[p].nb.some(n => st.owner[n] === 0)) return true;
    return false;
  }
  function warWith(r) { return Object.values(st.wars || {}).find(w => !w.resolved && w.enemy === r); }
  function signTreaty(r) {
    const sid = tradeSubject(), c = treatyCost(r);
    if (!sid || (st.pts[sid] || 0) < c || atPeace(r) || warWith(r)) return;
    st.pts[sid] -= c;
    st.treaties = st.treaties || {};
    st.treaties[r] = addDays(todayK(), 7 * treatyWeeks());
    logEvent(`Peace treaty signed with ${st.rivals[r - 1].name} until ${shortDate(st.treaties[r])}`, "peace");
    save();
    ST.toast(`Peace with ${st.rivals[r - 1].name} for ${treatyWeeks()} weeks`, "#6fcf97");
  }

  // ---------- technologies ----------
  const TECHS = [
    { id: "survey",    era: 0, name: "Surveying",        effect: "Claiming land costs 10% less",                   cost: { gold: 300 } },
    { id: "codified",  era: 0, name: "Written Law",      effect: "Courthouses cost 25% less",                       cost: { kind: "law", n: 150 } },
    { id: "herbal",    era: 0, name: "Herbalism",        effect: "Healers give +75% population instead of +50%",   cost: { kind: "health", n: 150 } },
    { id: "fortify",   era: 1, name: "Fortifications",   effect: "Courthouses repel raiders 60% of the time",       cost: { kind: "law", n: 300 } },
    { id: "guilds",    era: 1, name: "Merchant Guilds",  effect: "Markets give +7% gold each instead of +5%",      cost: { kind: "trade", n: 300 } },
    { id: "monastery", era: 1, name: "Monastic Orders",  effect: "Decree rewards are doubled",                      cost: { kind: "health", n: 300 } },
    { id: "printing",  era: 2, name: "Printing Press",   effect: "+10% subject points from all study",              cost: { gold: 600 } },
    { id: "banking",   era: 2, name: "Banking",          effect: "+10% gold from all study",                        cost: { kind: "trade", n: 500 } },
    { id: "medicine",  era: 2, name: "Anatomy",          effect: "+20% population everywhere",                      cost: { kind: "health", n: 500 } },
    { id: "rail",      era: 3, name: "Railways",         effect: "Claiming land costs another 15% less",            cost: { gold: 1200 } },
    { id: "police",    era: 3, name: "Police Force",     effect: "Raids take one province fewer",                   cost: { kind: "law", n: 800 } },
    { id: "telegraph", era: 3, name: "Telegraph",        effect: "Peace treaties last 6 weeks",                     cost: { kind: "trade", n: 800 } },
    { id: "internet",  era: 4, name: "Internet",         effect: "+15% gold from all study",                        cost: { gold: 2000 } },
    { id: "court",     era: 4, name: "Constitutional Court", effect: "Lost exam wars cost 2 provinces fewer",       cost: { kind: "law", n: 1200 } },
    { id: "healthcare",era: 4, name: "Public Healthcare", effect: "+50% population everywhere",                     cost: { kind: "health", n: 1200 } },
  ];
  const tech = id => !!(st && st.techs && st.techs[id]);
  // the subject that pays for a kind of cost (the one with most points); none → pay double in gold
  function payer(kind) {
    const t = UNITS().filter(([id]) => kindOf(id) === kind).sort((a, b) => (st.pts[b[0]] || 0) - (st.pts[a[0]] || 0));
    return t[0] ? t[0][0] : null;
  }
  // science subjects pay for gold-priced discoveries with their own points; laboratories make everything cheaper
  function priceOf(cost) {
    const k = 1 - techDiscount();
    if (cost.gold) { const sci = payer("science"); return sci ? { sid: sci, n: Math.round(cost.gold * k) } : { gold: Math.round(cost.gold * k) }; }
    const sid = payer(cost.kind);
    return sid ? { sid, n: Math.round(cost.n * k) } : { gold: Math.round(cost.n * 2 * k) };
  }
  const canPay = pr => pr.gold ? st.gold >= pr.gold : (st.pts[pr.sid] || 0) >= pr.n;
  const pay = pr => { if (pr.gold) st.gold -= pr.gold; else st.pts[pr.sid] -= pr.n; };
  const priceLabel = pr => pr.gold ? `${COIN}${pr.gold}` : `${pr.n} ${esc((SUBJ()[pr.sid] || {}).name || "")}`;
  function research(id) {
    const T = TECHS.find(t => t.id === id); if (!T || tech(id) || T.era > eraIdx()) return;
    const pr = priceOf(T.cost); if (!canPay(pr)) return;
    pay(pr); (st.techs = st.techs || {})[id] = todayK();
    logEvent(`Discovered ${T.name}: ${T.effect.toLowerCase()}`, "tech");
    save(); ST.toast(`Discovered ${T.name}`, "#56b4e9");
  }

  // ---------- wonders: one great project per kind of subject ----------
  const WONDERS = {
    law:    { name: "Grand Tribunal",      effect: "Courthouses repel raiders 25% more often" },
    trade:  { name: "Great Bazaar",        effect: "+15% gold from all study" },
    health: { name: "Garden of Remedies",  effect: "+25% population everywhere" },
    math:   { name: "Royal Mint",          effect: "+20% gold from all study" },
    science:{ name: "Grand Observatory",   effect: "Technologies cost 25% less" },
    arts:   { name: "Great Amphitheatre",  effect: "+15% population everywhere and decree rewards +50%" },
    write:  { name: "Royal Archive",       effect: "Peace treaties last 2 weeks longer" },
    listen: { name: "Watchtower Network",  effect: "Raids take one province fewer" },
    learn:  { name: "Great Library",       effect: "+10% subject points from all study" },
  };
  const WONDER_COST = 2400;   // 40 hours of that subject
  const wonderDone = kind => !!(st && st.wonders && st.wonders[kind] >= WONDER_COST);
  function invest(kind, all) {
    const sid = payer(kind); if (!sid || wonderDone(kind)) return;
    st.wonders = st.wonders || {};
    const room = WONDER_COST - (st.wonders[kind] || 0);
    const amt = Math.floor(Math.min(room, all ? (st.pts[sid] || 0) : 60, st.pts[sid] || 0));
    if (amt <= 0) return;
    st.pts[sid] -= amt; st.wonders[kind] = (st.wonders[kind] || 0) + amt;
    if (wonderDone(kind)) {
      logEvent(`The ${WONDERS[kind].name} is complete! ${WONDERS[kind].effect}`, "era");
      ST.confetti && ST.confetti(["#f2c94c", st.color, "#ffffff"]);
      ST.toast(`${WONDERS[kind].name} completed`, "#f2c94c");
    }
    save();
  }

  // ---------- weekly events: a challenge for one subject, decided by that week's study ----------
  const EVENTS = {
    plague:  { kind: "health", title: "Plague in {p}", text: "Sickness spreads through {p}. Study {g} of {s} this week to contain it.", win: "+120 gold, and {p} is saved", lose: "{p} loses one of its buildings" },
    boom:    { kind: "trade", title: "Trade boom", text: "Merchants flock to your markets. Study {g} of {s} this week to cash in.", win: "+250 gold", lose: "the boom passes you by" },
    revolt:  { kind: "law", title: "Unrest in {p}", text: "The people of {p} are restless. Study {g} of {s} this week to restore order.", win: "+80 gold and a free courthouse in {p}", lose: "{p} breaks away and becomes free land" },
    audit:   { kind: "math", title: "Treasury audit", text: "The royal accounts are a mess. Study {g} of {s} this week to balance the books.", win: "+250 gold", lose: "15% of your gold goes missing" },
    invent:  { kind: "science", title: "Inventor at court", text: "An inventor seeks your patronage. Study {g} of {s} this week to fund the work.", win: "+150 points for every science subject", lose: "the inventor leaves for a rival court" },
    scholar: { kind: null, title: "Wandering scholars", text: "Scholars visit your court. Study {g} in total this week to impress them.", win: "+60 points for every subject", lose: "they move on" },
  };
  function makeEvent(w) {
    const rand = mulberry32(st.seed ^ 0x51ed ^ ((kd(w).getTime() / 86400000) | 0));
    if (rand() < .25) return null;   // quiet week
    const owned = ownedList().filter(p => p !== st.capital);
    const types = Object.keys(EVENTS).filter(t => {
      const k = EVENTS[t].kind;
      if (k && !payer(k)) return false;
      if ((t === "plague" || t === "revolt") && !owned.length) return false;
      if (t === "plague" && !owned.some(p => Object.keys(st.bld[p] || {}).length)) return false;
      return true;
    });
    if (!types.length) return null;
    const type = types[Math.floor(rand() * types.length)], E = EVENTS[type];
    let sid = null, goal;
    if (E.kind) { sid = payer(E.kind); const t = SUBJ()[sid].target || 0; goal = Math.max(2, Math.round(t * .6 * 2) / 2 || 3); }
    else { const tot = ST.activeSubjects().reduce((s, [, x]) => s + (x.target || 0), 0); goal = Math.max(4, Math.round(tot * .7 * 2) / 2 || 6); }
    let p = -1;
    if (type === "plague") { const c = owned.filter(q => Object.keys(st.bld[q] || {}).length); p = c[Math.floor(rand() * c.length)]; }
    if (type === "revolt") { const c = owned.filter(q => !hasKind(q, "law") && !hasKind(q, "arts")); p = (c.length ? c : owned)[Math.floor(rand() * (c.length || owned.length))]; }
    return { type, sid, goal, p, resolved: false, seen: false };
  }
  function eventText(ev, field) {
    const sub = ev.sid ? SUBJ()[ev.sid] : null;
    return EVENTS[ev.type][field].replace(/\{p\}/g, ev.p >= 0 ? map.P[ev.p].name : "").replace(/\{g\}/g, ev.goal + "h").replace(/\{s\}/g, sub ? sub.name : "");
  }
  const eventHours = (ev, w) => { let s = 0; for (let i = 0; i < 7; i++) s += daySecs(addDays(w, i), ev.sid); return s / 3600; };
  function updateEvents() {
    if (ST.syncReady && !ST.syncReady()) return;
    st.events = st.events || {};
    const w = weekOf(todayK());
    if (w > st.founded && !(w in st.events)) st.events[w] = makeEvent(w);
    for (const k in st.events) if (k < addDays(w, -7 * 10)) delete st.events[k];
  }
  function resolveEvent(w, rep) {
    const ev = st.events && st.events[w];
    if (!ev || ev.resolved) return;
    const hrs = eventHours(ev, w);
    ev.resolved = true; ev.hours = Math.round(hrs * 10) / 10; ev.won = hrs >= ev.goal;
    if (ev.won) {
      if (ev.type === "plague") st.gold += 120;
      if (ev.type === "boom") st.gold += 250;
      if (ev.type === "revolt") { st.gold += 80; if (st.owner[ev.p] === 0 && ev.sid) (st.bld[ev.p] = st.bld[ev.p] || {})[ev.sid] = 1; }
      if (ev.type === "scholar") for (const [id] of UNITS()) st.pts[id] = (st.pts[id] || 0) + 60;
      if (ev.type === "audit") st.gold += 250;
      if (ev.type === "invent") for (const [id] of UNITS()) if (kindOf(id) === "science") st.pts[id] = (st.pts[id] || 0) + 150;
    } else {
      if (ev.type === "plague" && st.bld[ev.p]) { const k = Object.keys(st.bld[ev.p]); if (k.length) delete st.bld[ev.p][k[Math.floor(Math.random() * k.length)]]; }
      if (ev.type === "revolt" && st.owner[ev.p] === 0 && ev.p !== st.capital && !hasKind(ev.p, "arts")) st.owner[ev.p] = -1;
      if (ev.type === "audit") st.gold = Math.max(0, st.gold * .85);
    }
    const line = `${eventText(ev, "title")}: ${ev.won ? "success — " + eventText(ev, "win") : "failed — " + eventText(ev, "lose")}`;
    logEvent(`Week of ${shortDate(w)}: ${line}`, ev.won ? "good" : "raid");
    rep.event = { text: line, won: ev.won };
  }

  // ---------- daily decrees (built from weekly targets) ----------
  const daySecs = (day, sid) => {
    const r = ST.getHistory()[day]; if (!r) return 0;
    if (!sid) return +r.f || 0;
    if (sid.includes("~")) { const [pid, k] = sid.split("~"); return +(((r.sk || {})[pid] || {})[k]) || 0; }
    return +(r.by || {})[sid] || 0;
  };
  function makeDecrees(day) {
    // if you made a weekly plan, today's decrees follow it
    const planned = window.Tools && window.Tools.planFor ? window.Tools.planFor(day).filter(x => x.secs >= 600) : [];
    if (planned.length) return { items: planned.sort((a, b) => b.secs - a.secs).slice(0, 2).map(x => ({ sid: x.sid, secs: Math.min(4 * 3600, x.secs), done: false })), all: false, fromPlan: true };
    const mon = weekOf(day), idx = Math.round((kd(day) - kd(mon)) / 86400000), left = 7 - idx;
    const items = [];
    for (const [sid, s] of ST.activeSubjects()) {
      if (!(s.target > 0)) continue;
      let before = 0;
      for (let i = 0; i < idx; i++) before += daySecs(addDays(mon, i), sid);
      const need = Math.max(0, s.target * 3600 - before) / left;
      if (need >= 600) items.push({ sid, secs: Math.min(4 * 3600, Math.max(1200, Math.round(need / 300) * 300)), done: false });
    }
    items.sort((a, b) => b.secs - a.secs);
    const pick = items.slice(0, 2);
    if (!pick.length) pick.push({ sid: null, secs: ST.activeSubjects().some(([, s]) => s.target > 0) ? 1800 : 3600, done: false });
    return { items: pick, all: false };
  }
  function streak() {
    let n = 0, d = todayK();
    const D = st.decrees || {};
    if (D[d] && D[d].all) n++;
    for (d = addDays(d, -1); D[d] && D[d].all; d = addDays(d, -1)) n++;
    return n;
  }
  const streakBonus = () => Math.min(.3, streak() * .03);
  function updateDecrees(silent) {
    if (ST.syncReady && !ST.syncReady()) return;
    st.decrees = st.decrees || {};
    const today = todayK();
    let from = addDays(today, -13);
    if (from < st.founded) from = st.founded;
    for (let d = from; d <= today; d = addDays(d, 1)) {
      if (!st.decrees[d]) st.decrees[d] = makeDecrees(d);
      const D = st.decrees[d];
      for (const it of D.items) {
        if (it.done || daySecs(d, it.sid) < it.secs) continue;
        it.done = true;
        const reward = Math.round((25 + 5 * Math.min(10, streak())) * (tech("monastery") ? 2 : 1) * (wonderDone("arts") ? 1.5 : 1) * (seasonVal("decree") || 1));
        st.gold += reward;
        if (!silent && d === today) setTimeout(() => ST.toast(`Decree fulfilled: ${decreeText(it)} · +${reward} gold`, "#f2c94c"), 900);
      }
      if (!D.all && D.items.every(i => i.done)) {
        D.all = true;
        if (d === today) logEvent(`All of today's decrees fulfilled — ${streak()}-day streak`, "good");
      }
    }
    for (const k in st.decrees) if (k < addDays(today, -40)) delete st.decrees[k];
  }
  function decreeText(it) {
    const s = it.sid ? SUBJ()[it.sid] : null;
    return `${s ? s.name : "Any subject"} ${fmtH(it.secs)}`;
  }

  // ---------- exam campaigns ----------
  const WAR_DAYS = 28;
  function updateWars() {
    if (ST.syncReady && !ST.syncReady()) return;
    st.wars = st.wars || {};
    const today = todayK(), subs = SUBJ();
    for (const [sid, s] of ST.activeSubjects()) {
      if (!s.exam || s.exam <= today) continue;
      const key = sid + "@" + s.exam;
      let start = addDays(s.exam, -WAR_DAYS);
      if (st.wars[key] || today < start) continue;
      if (start < st.founded) start = st.founded;
      const enemy = pickEnemy();
      if (!enemy) continue;
      const weeks = Math.max(1, (kd(s.exam) - kd(start)) / (7 * 86400000));
      const goal = Math.max(2, Math.round((s.target > 0 ? s.target : 3) * weeks * 2) / 2);
      st.wars[key] = { sid, exam: s.exam, start, enemy, goal, resolved: false, seen: false };
      if (st.treaties) delete st.treaties[enemy];
      logEvent(`${st.rivals[enemy - 1].name} declared war! Study ${goal}h of ${s.name} before your exam on ${shortDate(s.exam)} to win`, "war");
    }
    for (const key in st.wars) {
      const w = st.wars[key];
      if (w.resolved) continue;
      const s = subs[w.sid];
      if (!s || s.archived || (s.exam !== w.exam && today < w.exam)) { delete st.wars[key]; continue; }   // exam moved or removed
      if (today < w.exam) continue;
      resolveWar(w);
    }
  }
  function pickEnemy() {
    const busy = new Set(Object.values(st.wars || {}).filter(w => !w.resolved).map(w => w.enemy));
    let best = 0, bs = -1;
    st.rivals.forEach((R, i) => {
      const r = i + 1;
      if (busy.has(r)) return;
      let border = 0, size = 0;
      for (let p = 0; p < map.N; p++) if (st.owner[p] === r) { size++; if (map.P[p].nb.some(n => st.owner[n] === 0)) border++; }
      if (!size) return;
      const sc = border * 10 + size + ({ warlike: 1000, peaceful: -1000 }[persona(r)] || 0);
      if (sc > bs) { bs = sc; best = r; }
    });
    return best;
  }
  const warHours = w => { let s = 0; for (let d = w.start; d < w.exam; d = addDays(d, 1)) s += daySecs(d, w.sid); return s / 3600; };
  function resolveWar(w) {
    const hrs = warHours(w), name = st.rivals[w.enemy - 1].name, sname = (SUBJ()[w.sid] || {}).name || "Subject";
    w.hours = Math.round(hrs * 10) / 10;
    w.resolved = true; w.seen = false;
    w.won = hrs >= w.goal;
    if (w.won) {
      const n = 3 + (hrs >= w.goal * 1.25 ? 2 : 0);
      const taken = [];
      for (let i = 0; i < n; i++) {
        let cands = [];
        for (let p = 0; p < map.N; p++) if (st.owner[p] === w.enemy && map.P[p].nb.some(nb => st.owner[nb] === 0)) cands.push(p);
        if (!cands.length) for (let p = 0; p < map.N; p++) if (st.owner[p] === w.enemy) cands.push(p);
        if (!cands.length) break;
        const p = cands[Math.floor(Math.random() * cands.length)];
        st.owner[p] = 0; taken.push(map.P[p].name);
      }
      st.gold += 150;
      w.taken = taken;
      logEvent(`Victory over ${name}! ${sname} exam campaign won (${w.hours}/${w.goal}h) — took ${taken.join(", ") || "their treasury"} and 150 gold`, "war");
    } else {
      const n = Math.max(1, 3 + Math.round((1 - hrs / w.goal) * 3) - (tech("court") ? 2 : 0));
      const { lost, repelled } = seizeBorder(n, w.enemy, w.exam);
      w.lost = lost.map(l => map.P[l.p].name); w.repelled = repelled.map(p => map.P[p].name);
      logEvent(`Defeat against ${name} — ${sname} exam campaign lost (${w.hours}/${w.goal}h)${w.lost.length ? ", lost " + w.lost.join(", ") : ""}`, "war");
    }
    (st.trophies = st.trophies || []).push({ sid: w.sid, name: sname, exam: w.exam, won: w.won, hours: w.hours, goal: w.goal, enemy: name });
  }

  function checkEra() {
    const e = eraIdx();
    if (e > st.eraSeen) {
      st.eraSeen = e; st.viewEra = null;
      logEvent(`Your empire entered the ${ERAS[e].name} era`, "era");
      st.pendingEra = e;
      save();
      if (ready) { baseDirty = true; }
      if (isOpen()) showEraUnlock(); else ST.toast("New era unlocked: " + ERAS[e].name + " — open your empire", "#e2b43c");
    }
  }

  function sync(silent) {
    if (!st) return;
    if (ST.syncReady && !ST.syncReady()) return;   // don't touch a possibly stale copy until the account has loaded
    const before = JSON.stringify(st);
    credit(silent);
    processWeeks();
    if (map || (st.wars && Object.keys(st.wars).length) || ST.activeSubjects().some(([, s]) => s.exam)) { ensureMap(); updateWars(); }
    updateDecrees(silent);
    if (st.founded < weekOf(todayK())) { ensureMap(); updateEvents(); }
    if (map) checkAchievements(silent && !st.ach);
    if (JSON.stringify(st) !== before) save();
    renderStrip();
    checkEra();
    if (isOpen()) { if (st.reports.some(r => !r.seen)) showReports(); else showWarNews(); refresh(); }
    else if (st.reports.some(r => !r.seen && r.lines.some(l => !l.ok && l.lost && l.lost.length))) $("empireBtn").classList.add("alert");
  }

  // ---------- DOM ----------
  const root = document.createElement("div");
  root.className = "emp"; root.id = "emp"; root.hidden = true;
  root.innerHTML = `
    <canvas id="empCanvas"></canvas>
    <div class="emp-top">
      <div class="emp-title"><div class="emp-name" id="empName"></div><div class="emp-sub" id="empSub"></div></div>
      <div class="emp-btns">
        <button class="eb" id="empDipBtn" title="Realm: wonders, technology, diplomacy"><svg viewBox="0 0 24 24"><path d="M3 18h18M4 18L3 7l5 4 4-7 4 7 5-4-1 11"/></svg></button>
        <button class="eb" id="empLogBtn" title="Chronicle"><svg viewBox="0 0 24 24"><path d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V5"/><path d="M8 8h7M8 12h7M8 16h4"/></svg></button>
        <button class="eb" id="empHelpBtn" title="How it works"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.3-2.4 3.8M12 17h.01"/></svg></button>
        <button class="eb" id="empSetBtn" title="Settings"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>
        <button class="eb" id="empClose" title="Back to timer (E)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="emp-res" id="empRes"></div>
    </div>
    <div class="emp-zoom">
      <button class="eb" id="empZin" title="Zoom in">+</button>
      <button class="eb" id="empZout" title="Zoom out">−</button>
      <button class="eb" id="empHome" title="Go to capital"><svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z"/></svg></button>
    </div>
    <div class="emp-bottom">
      <div class="emp-sheet" id="empSheet" hidden></div>
      <div class="emp-watch" id="empWatch"></div>
    </div>
    <div class="emp-modal" id="empModal" hidden><div class="emp-card" id="empCard"></div></div>
    <div class="emp-loading" id="empLoading" hidden><span>Charting the continent…</span></div>`;
  document.body.appendChild(root);
  const coinEl = document.createElement("div");
  coinEl.className = "coin-toast"; coinEl.id = "coinToast";
  document.body.appendChild(coinEl);

  const cv = $("empCanvas"), ctx = cv.getContext("2d");
  const base = document.createElement("canvas"); base.width = W; base.height = H;
  const bctx = base.getContext("2d");
  let ready = false, baseDirty = true, sel = -1, selMask = null;
  const view = { s: 1, tx: 0, ty: 0, fit: 1 };
  const isOpen = () => !root.hidden;

  let coinTimer = null;
  function coinToast(g, parts) {
    const subs = SUBJ();
    coinEl.innerHTML = `<span class="coin"></span><b>+${Math.round(g)}</b> gold`
      + parts.map(([id, m]) => subs[id] ? ` <i style="background:${subs[id].color}"></i>+${Math.round(m)} ${esc(subs[id].name)}` : "").join("");
    coinEl.classList.add("show");
    clearTimeout(coinTimer);
    coinTimer = setTimeout(() => coinEl.classList.remove("show"), 4200);
  }

  // ---------- rendering ----------
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  // rival colours for an era, skipping any that look too much like your own colour
  const EXTRA = ["#5f8c8a", "#8a5f6e", "#7a7f3a", "#5a5f8c"];
  function rivalColors(E) {
    const me = hex(st.color);
    const far = c => { const x = hex(c); return Math.hypot(x[0] - me[0], x[1] - me[1], x[2] - me[2]) > 95; };
    return E.rivals.filter(far).concat(EXTRA.filter(far), E.rivals).slice(0, 6);
  }
  function nationColor(o, E) {
    return o === 0 ? hex(st.color) : o > 0 ? hex(rivalColors(E)[(o - 1) % 6]) : hex(E.neutral);
  }
  function renderBase(ownerOverride) {
    const E = ERAS[viewEra()];
    const { val, thr, prov, flags, P } = map;
    const img = bctx.createImageData(W, H), d = img.data;
    const deep = hex(E.water), shallow = hex(E.shallow), ink = hex(E.ink), neutral = hex(E.neutral);
    const paperC = [236, 224, 192];
    const owner = ownerOverride || st.owner;
    const claim = new Uint8Array(map.N);
    if (!ownerOverride) for (let p = 0; p < map.N; p++) claim[p] = isClaimable(p) ? 1 : 0;
    const cols = [];
    for (let p = 0; p < map.N; p++) {
      let c = nationColor(owner[p], E);
      if (owner[p] !== 0) c = mix(neutral, c, owner[p] < 0 ? 1 : E.tint);
      else c = mix(neutral, c, Math.min(1, E.tint + .2));
      if (E.paper && owner[p] !== 0) c = mix(c, paperC, E.paper * .25);
      const T = TERRAIN[P[p].t];
      if (T.tint) c = mix(c, T.tint, T.a);
      cols.push(c);
    }
    const dark = E.name === "Modern";
    let h = 1234567;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, o = i * 4, p = prov[i];
      h = (h * 1103515245 + 12345) & 0x7fffffff;
      const grain = ((h >> 8) & 255) / 255 - .5;
      let c;
      if (p < 0) {
        const sh = clamp((val[i] - thr + .13) / .13, 0, 1);
        c = mix(deep, shallow, sh * sh);
        if (E.waves && val[i] > thr - .045 && val[i] < thr - .036) c = mix(c, ink, .22);
        if (E.waves && val[i] > thr - .085 && val[i] < thr - .079) c = mix(c, ink, .12);
        const g = grain * E.grain * .6;
        d[o] = c[0] + g; d[o + 1] = c[1] + g; d[o + 2] = c[2] + g; d[o + 3] = 255;
        continue;
      }
      c = cols[p];
      // relief shading from the elevation field
      const xa = x > 0 ? val[i - 1] : val[i], ya = y > 0 ? val[i - W] : val[i];
      const shade = clamp(1 + ((val[i] - xa) + (val[i] - ya)) * 16, .86, 1.14);
      c = [c[0] * shade, c[1] * shade, c[2] * shade];
      const op = owner[p];
      // nation borders (thick) and inner glow ring
      let nb1 = false, nb2 = false;
      for (const [dx, dy, r] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [2, 0, 2], [-2, 0, 2], [0, 2, 2], [0, -2, 2], [3, 0, 3], [-3, 0, 3], [0, 3, 3], [0, -3, 3]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const q = prov[yy * W + xx];
        if (q < 0 || owner[q] === op) continue;
        if (r === 1) nb1 = true; else nb2 = true;
      }
      if (nb1) c = mix(c, ink, dark ? .55 : .75);
      else if (nb2) c = op === 0 ? mix(c, [255, 255, 255], .35) : mix(c, nationColor(op, E), .6);
      else if (flags[i] & 2) c = mix(c, ink, dark ? .3 : .28);
      if (flags[i] & 1) c = mix(c, ink, .6);
      if (claim[p] && !nb1 && ((x + y) & 7) < 2) c = mix(c, [255, 255, 255], dark ? .18 : .28);
      const g = grain * E.grain;
      d[o] = c[0] + g; d[o + 1] = c[1] + g; d[o + 2] = c[2] + g; d[o + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
    // rivers
    bctx.save(); bctx.lineCap = "round"; bctx.lineJoin = "round";
    for (const r of map.rivers) {
      for (let i = 1; i < r.length; i++) {
        const t = i / r.length;
        bctx.strokeStyle = E.shallow; bctx.globalAlpha = .95; bctx.lineWidth = .8 + t * 2.4;
        bctx.beginPath(); bctx.moveTo(r[i - 1][0], r[i - 1][1]); bctx.lineTo(r[i][0], r[i][1]); bctx.stroke();
      }
    }
    bctx.restore();
    baseDirty = false;
  }
  function makeSelMask(p) {
    const o = map.P[p];
    const x0 = Math.max(0, o.minx - 1), y0 = Math.max(0, o.miny - 1), w = Math.min(W, o.maxx + 2) - x0, h = Math.min(H, o.maxy + 2) - y0;
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"), img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y + y0) * W + (x + x0);
      if (map.prov[i] !== p) continue;
      const edge = map.flags[i] & 3;
      const o4 = (y * w + x) * 4;
      img.data[o4] = img.data[o4 + 1] = img.data[o4 + 2] = 255;
      img.data[o4 + 3] = edge ? 255 : 70;
    }
    g.putImageData(img, 0, 0);
    return { c, x0, y0 };
  }

  let rafId = 0;
  let replay = null;   // { i, timer, owner }
  const dispOwner = () => replay ? replay.owner : st.owner;
  function startReplay() {
    closeModal(); select(-1);
    const H = st.hist || [];
    if (H.length < 2) { ST.toast("Not enough history yet — come back after a few days of conquest", "#d9d6d8"); return; }
    replay = { i: 0, owner: decOwner(H[0].o), timer: null };
    root.classList.add("replaying");
    let bar = $("empReplay");
    if (!bar) {
      bar = document.createElement("div"); bar.id = "empReplay"; bar.className = "emp-replay";
      bar.innerHTML = `<button class="eb" id="rpPlay"></button><div class="rp-mid"><div class="rp-date" id="rpDate"></div><input type="range" id="rpSlider" min="0" step="1"></div><button class="eb" id="rpClose" title="Exit replay"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
      root.appendChild(bar);
      $("rpPlay").onclick = () => replay && (replay.timer ? pauseReplay() : playReplay());
      $("rpClose").onclick = stopReplay;
      $("rpSlider").oninput = e => { pauseReplay(); showFrame(+e.target.value); };
    }
    bar.hidden = false;
    $("rpSlider").max = H.length - 1;
    view.fit = Math.min(cv.clientWidth / W, cv.clientHeight / 800);
    view.s = view.fit; clampView();
    showFrame(0); playReplay();
  }
  function showFrame(i) {
    const H = st.hist; replay.i = i; replay.owner = decOwner(H[i].o);
    $("rpSlider").value = i;
    const n = replay.owner.filter(o => o === 0).length;
    $("rpDate").textContent = `${shortDate(H[i].d)} ${H[i].d.slice(0, 4)} · ${n} province${n === 1 ? "" : "s"}`;
    renderBase(replay.owner); redraw();
  }
  function playReplay() {
    if (replay.i >= st.hist.length - 1) showFrame(0);
    $("rpPlay").innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>`;
    replay.timer = setInterval(() => { if (replay.i >= st.hist.length - 1) pauseReplay(); else showFrame(replay.i + 1); }, Math.max(120, 6000 / st.hist.length));
  }
  function pauseReplay() {
    if (!replay) return;
    clearInterval(replay.timer); replay.timer = null;
    $("rpPlay").innerHTML = `<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>`;
  }
  function stopReplay() {
    if (!replay) return;
    pauseReplay(); replay = null;
    root.classList.remove("replaying");
    $("empReplay").hidden = true;
    baseDirty = true; centerOn(st.capital, cv.clientWidth < 700 ? 2.4 : 1.6); refresh();
  }
  function draw() {
    rafId = 0;
    if (!ready || !isOpen()) return;
    if (baseDirty && !replay) renderBase();
    const dpr = window.devicePixelRatio || 1;
    const cw = cv.clientWidth, ch = cv.clientHeight;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    const E = ERAS[viewEra()];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = E.water; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.tx, dpr * view.ty);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, 0, 0);
    const showLive = !replay;
    // roads: a tree from the capital through your provinces
    if (showLive) {
      const style = [[[1.5, 4], .55, 1.6], [[5, 4], .6, 1.8], [[], .55, 1.8], [[7, 3], .75, 2], [[], .5, 2.6]][viewEra()];
      ctx.save(); ctx.setLineDash(style[0]); ctx.strokeStyle = E.name === "Modern" ? "#9aa3ad" : E.ink; ctx.globalAlpha = style[1]; ctx.lineWidth = style[2]; ctx.lineCap = "round";
      const seenR = new Set([st.capital]), q = [st.capital];
      ctx.beginPath();
      while (q.length) {
        const a = q.shift();
        for (const b of map.P[a].nb) if (st.owner[b] === 0 && !seenR.has(b) && !map.seaLinks.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) {
          seenR.add(b); q.push(b);
          const A = map.P[a], B = map.P[b], mx = (A.ax + B.ax) / 2 + (A.ay - B.ay) * .12, my = (A.ay + B.ay) / 2 + (B.ax - A.ax) * .12;
          ctx.moveTo(A.ax, A.ay); ctx.quadraticCurveTo(mx, my, B.ax, B.ay);
        }
      }
      ctx.stroke(); ctx.restore();
    }
    // sea routes to islands
    ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = E.ink; ctx.globalAlpha = .45; ctx.lineWidth = 1.4;
    for (const [a, b] of map.seaLinks) { ctx.beginPath(); ctx.moveTo(map.P[a].ax, map.P[a].ay); ctx.lineTo(map.P[b].ax, map.P[b].ay); ctx.stroke(); }
    ctx.restore();
    if (sel >= 0 && selMask) {
      const t = performance.now() / 1000;
      ctx.globalAlpha = .55 + .35 * Math.sin(t * 3.2);
      ctx.drawImage(selMask.c, selMask.x0, selMask.y0);
      ctx.globalAlpha = 1;
    }
    // screen-space overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = (x, y) => [x * view.s + view.tx, y * view.s + view.ty];
    // nation labels
    const agg = {};
    for (let p = 0; p < map.N; p++) {
      const o = dispOwner()[p]; if (o < 0) continue;
      const a = agg[o] || (agg[o] = { x: 0, y: 0, n: 0 });
      const P = map.P[p]; a.x += P.cx * P.n; a.y += P.cy * P.n; a.n += P.n;
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const o in agg) {
      const a = agg[o];
      const sz = clamp(Math.sqrt(a.n) * .085, 13, 54) * view.s;
      if (sz < 8 || (view.s / view.fit > 3.2 && +o !== 0)) continue;
      const label = +o === 0 ? st.name : st.rivals[o - 1].name;
      const [x, y] = S(a.x / a.n, a.y / a.n);
      ctx.font = `${E.weight} ${Math.min(sz, 46)}px "${E.font}", Georgia, serif`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = Math.round(Math.min(sz, 46) * .18) + "px";
      ctx.lineWidth = 3; ctx.strokeStyle = E.halo; ctx.fillStyle = E.ink; ctx.globalAlpha = +o === 0 ? .95 : .72;
      ctx.strokeText(label.toUpperCase(), x, y); ctx.fillText(label.toUpperCase(), x, y);
      ctx.globalAlpha = 1;
      const tag = +o > 0 ? (warWith(+o) ? ["AT WAR", "#e0565b"] : atPeace(+o) ? ["AT PEACE", "#3f9d6a"] : null) : null;
      if (tag) {
        const ts = clamp(Math.min(sz, 46) * .38, 9, 14);
        ctx.font = `800 ${ts}px Inter, sans-serif`;
        if ("letterSpacing" in ctx) ctx.letterSpacing = "1.5px";
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,.55)"; ctx.fillStyle = tag[1];
        ctx.strokeText(tag[0], x, y + Math.min(sz, 46) * .72); ctx.fillText(tag[0], x, y + Math.min(sz, 46) * .72);
      }
    }
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    // province names when zoomed in
    if (view.s / view.fit >= 2.6) {
      ctx.font = `${E.weight >= 700 ? 600 : E.weight} 11px "${E.font}", Georgia, serif`;
      for (let p = 0; p < map.N; p++) {
        const [x, y] = S(map.P[p].ax, map.P[p].ay);
        if (x < -40 || y < -20 || x > cw + 40 || y > ch + 20) continue;
        ctx.lineWidth = 3; ctx.strokeStyle = E.halo; ctx.fillStyle = E.ink; ctx.globalAlpha = .85;
        ctx.strokeText(map.P[p].name, x, y + 15); ctx.fillText(map.P[p].name, x, y + 15);
      }
      ctx.globalAlpha = 1;
    }
    // towns that grow with population, and rival capitals
    if (showLive && view.s / view.fit >= 1.5) {
      const ink = E.name === "Modern" ? "#e8e8e8" : E.ink, fill = E.name === "Modern" ? "#2a2f36" : E.halo.replace(/[\d.]+\)$/, "1)");
      const base = [1, 1.6, 2.5, 4, 7][eraIdx()] * 1000;
      for (let p = 0; p < map.N; p++) {
        if (st.owner[p] !== 0) continue;
        const [x, y] = S(map.P[p].ax, map.P[p].ay);
        if (x < -40 || y < -40 || x > cw + 40 || y > ch + 40) continue;
        const pop = provPop(p) / base;
        const n = pop >= 24 ? 5 : pop >= 16 ? 4 : pop >= 11 ? 3 : pop >= 7 ? 2 : 1;
        drawTown(x, y - clamp(4 + view.s * 3.2, 7, 12) - 9, n, ink, fill, viewEra());
      }
      st.rivals.forEach((R, i) => {
        if (st.owner[R.cap] !== i + 1) return;
        const [x, y] = S(map.P[R.cap].ax, map.P[R.cap].ay);
        drawCastle(x, y, ink, rivalColors(E)[i]);
      });
    }
    if (!showLive) { if (replay) rafId = 0; return; }
    // spy reports: likely raid targets
    const spied = spyTargets();
    if (spied.length) {
      const t = performance.now() / 1000;
      ctx.save(); ctx.strokeStyle = "#e0565b"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
      for (const p of spied) {
        const [x, y] = S(map.P[p].ax, map.P[p].ay);
        ctx.globalAlpha = .6 + .4 * Math.sin(t * 4);
        ctx.beginPath(); ctx.arc(x, y, 16 + 2 * Math.sin(t * 4), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    // buildings + capital
    const r = clamp(4 + view.s * 3.2, 7, 12);
    const subs = SUBJ();
    for (let p = 0; p < map.N; p++) {
      const sids = st.owner[p] === 0 ? Object.keys(st.bld[p] || {}) : [];
      const isCap = p === st.capital;
      if (!sids.length && !isCap) continue;
      const [x, y] = S(map.P[p].ax, map.P[p].ay);
      if (x < -50 || y < -50 || x > cw + 50 || y > ch + 50) continue;
      const items = (isCap ? ["_cap"].concat(Object.keys(WONDERS).filter(wonderDone).map(k => "_w_" + k)) : []).concat(sids);
      const tot = items.length * (r * 2 + 3) - 3;
      items.forEach((sid, k) => {
        const bx = x - tot / 2 + r + k * (r * 2 + 3), by = y;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fillStyle = sid === "_cap" ? st.color : sid.startsWith("_w_") ? "#f2c94c" : (subs[sid] ? subs[sid].color : "#999");
        ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 4; ctx.fill(); ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(10,10,10,.85)"; ctx.stroke();
        ctx.save(); ctx.translate(bx - r * .62, by - r * .62); ctx.scale(r * 1.24 / 24, r * 1.24 / 24);
        if (sid === "_cap") { ctx.fillStyle = "#111"; ctx.fill(STAR); }
        else { ctx.strokeStyle = "#111"; ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(sid.startsWith("_w_") ? CROWN : ICONS[kindOf(sid)]); }
        ctx.restore();
      });
    }
    if (sel >= 0 || spied.length) rafId = requestAnimationFrame(draw);
  }
  function drawTown(cx, cy, n, ink, fill, era) {
    const w = 5, gap = 1.2, tot = n * w + (n - 1) * gap;
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = ink; ctx.fillStyle = fill;
    for (let i = 0; i < n; i++) {
      const x = cx - tot / 2 + i * (w + gap), hgt = era >= 3 ? 5 + ((i * 7 + n) % 3) * 3 : 5 + (i % 2) * 1.5;
      ctx.beginPath();
      if (era >= 3) ctx.rect(x, cy - hgt, w, hgt);                      // flat-roofed blocks
      else { ctx.moveTo(x, cy); ctx.lineTo(x, cy - hgt); ctx.lineTo(x + w / 2, cy - hgt - 3); ctx.lineTo(x + w, cy - hgt); ctx.lineTo(x + w, cy); ctx.closePath(); }
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function drawCastle(cx, cy, ink, col) {
    ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = ink; ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy + 5); ctx.lineTo(cx - 7, cy - 4); ctx.lineTo(cx - 5, cy - 4); ctx.lineTo(cx - 5, cy - 2); ctx.lineTo(cx - 2, cy - 2);
    ctx.lineTo(cx - 2, cy - 7); ctx.lineTo(cx + 2, cy - 7); ctx.lineTo(cx + 2, cy - 2); ctx.lineTo(cx + 5, cy - 2); ctx.lineTo(cx + 5, cy - 4);
    ctx.lineTo(cx + 7, cy - 4); ctx.lineTo(cx + 7, cy + 5); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  }
  const redraw = () => { if (!rafId) rafId = requestAnimationFrame(draw); };

  // ---------- view: pan & zoom ----------
  function clampView() {
    const cw = cv.clientWidth, ch = cv.clientHeight;
    view.s = clamp(view.s, view.fit * .9, view.fit * 9);
    const mw = W * view.s, mh = H * view.s;
    view.tx = mw < cw ? (cw - mw) / 2 : clamp(view.tx, cw - mw - cw * .3, cw * .3);
    view.ty = mh < ch ? (ch - mh) / 2 : clamp(view.ty, ch - mh - ch * .3, ch * .3);
  }
  function zoomAt(f, sx, sy) {
    const ns = clamp(view.s * f, view.fit * .9, view.fit * 9);
    view.tx = sx - (sx - view.tx) * ns / view.s; view.ty = sy - (sy - view.ty) * ns / view.s; view.s = ns;
    clampView(); redraw();
  }
  function centerOn(p, zoom) {
    const cw = cv.clientWidth, ch = cv.clientHeight;
    view.fit = Math.min(cw / W, ch / H);
    if (zoom) view.s = view.fit * zoom;
    view.tx = cw / 2 - map.P[p].ax * view.s; view.ty = ch / 2 - map.P[p].ay * view.s;
    clampView(); redraw();
  }
  const ptrs = new Map();
  let gest = null;
  cv.addEventListener("pointerdown", e => {
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) gest = { x: e.clientX, y: e.clientY, t: Date.now(), moved: 0 };
    else gest && (gest.moved = 99);
  });
  cv.addEventListener("pointermove", e => {
    const prev = ptrs.get(e.pointerId); if (!prev) return;
    if (ptrs.size === 1) {
      view.tx += e.clientX - prev.x; view.ty += e.clientY - prev.y;
      if (gest) gest.moved += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      clampView(); redraw();
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...ptrs.values()];
      const d1 = Math.hypot(c.x - d.x, c.y - d.y);
      const rect = cv.getBoundingClientRect();
      const mx = (c.x + d.x) / 2 - rect.left, my = (c.y + d.y) / 2 - rect.top;
      const pmx = (a.x + b.x) / 2 - rect.left, pmy = (a.y + b.y) / 2 - rect.top;
      view.tx += mx - pmx; view.ty += my - pmy;
      if (d0 > 0) zoomAt(d1 / d0, mx, my); else { clampView(); redraw(); }
    }
  });
  const ptrEnd = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size === 0 && gest && gest.moved < 8 && Date.now() - gest.t < 600 && e.type === "pointerup") {
      const rect = cv.getBoundingClientRect();
      tapAt((e.clientX - rect.left - view.tx) / view.s, (e.clientY - rect.top - view.ty) / view.s);
    }
    if (ptrs.size === 0) gest = null;
  };
  cv.addEventListener("pointerup", ptrEnd);
  cv.addEventListener("pointercancel", ptrEnd);
  cv.addEventListener("wheel", e => {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0018)), e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });
  $("empZin").onclick = () => zoomAt(1.4, cv.clientWidth / 2, cv.clientHeight / 2);
  $("empZout").onclick = () => zoomAt(1 / 1.4, cv.clientWidth / 2, cv.clientHeight / 2);
  $("empHome").onclick = () => { select(st.capital); centerOn(st.capital, Math.max(view.s / view.fit, 2.2)); };
  window.addEventListener("resize", () => { if (isOpen() && ready) { const f = view.s / view.fit; view.fit = Math.min(cv.clientWidth / W, cv.clientHeight / H); view.s = view.fit * f; clampView(); redraw(); } });

  function tapAt(mx, my) {
    if (replay) return;
    const x = Math.floor(mx), y = Math.floor(my);
    const p = x >= 0 && y >= 0 && x < W && y < H ? map.prov[y * W + x] : -1;
    select(p === sel ? -1 : p);
  }
  function select(p) {
    sel = p;
    selMask = p >= 0 ? makeSelMask(p) : null;
    renderSheet();
    redraw();
  }

  // ---------- HUD ----------
  const COIN = `<span class="coin"></span>`;
  function refresh() {
    if (!st || !ready) return;
    const owned = ownedList();
    const pop = owned.reduce((s, p) => s + provPop(p), 0);
    const E = ERAS[eraIdx()], next = ERAS[eraIdx() + 1];
    $("empName").textContent = st.name;
    const hrs = totals().all / 3600;
    $("empSub").innerHTML = `${rankOf(owned.length)} · <span class="era-chip">${ERAS[viewEra()].name}</span>`
      + (next ? ` <span class="era-next" title="Total focus hours unlock the next era">${next.name} in ${Math.max(0, next.hours - hrs).toFixed(1)}h</span>` : "");
    const subs = ST.activeSubjects(), units = UNITS();
    $("empRes").innerHTML =
      `<span class="pill" title="Gold — 1 per focus minute${goldMult() > 1 ? ", +" + Math.round((goldMult() - 1) * 100) + "% from markets" : ""}. Spend it to claim land.">${COIN}<b>${Math.floor(st.gold)}</b></span>`
      + units.map(([id, s]) => `<span class="pill" title="${esc(s.name)} points — 1 per minute studied. Builds ${KINDS[kindOf(id)].label.toLowerCase()}s."><i style="background:${s.color}"></i><svg viewBox="0 0 24 24"><path d="${KINDS[kindOf(id)].icon}"/></svg><b>${Math.floor(st.pts[id] || 0)}</b></span>`).join("")
      + `<span class="pill dim" title="Provinces · population"><b>${owned.length}</b> prov · ${fmtPop(pop)}</span>`
      + courtPills();
    // border watch
    const monday = weekOf(todayK());
    const left = 7 - ((new Date().getDay() + 6) % 7);
    const tg = subs.filter(([, s]) => s.target > 0);
    $("empWatch").innerHTML = tg.length
      ? `<span class="w-head">Border watch · raids in ${left === 1 ? "1 day" : left + " days"}</span>` + tg.map(([id, s]) => {
          const done = weekSecs(monday, id) / 3600, pct = Math.min(1, done / s.target);
          const state = pct >= 1 ? "safe" : pct >= (8 - left) / 7 - .05 ? "ok" : "risk";
          return `<span class="w-item ${state}"><i style="background:${s.color}"></i>${esc(s.name)} <b>${done.toFixed(1)}</b>/${s.target}h<span class="w-bar"><span style="width:${pct * 100}%;background:${s.color}"></span></span></span>`;
        }).join("")
      + (spyTargets().length ? `<span class="w-spy">Spies report raiders eyeing ${spyTargets().map(p => esc(map.P[p].name)).join(", ")}</span>` : "")
      : `<span class="w-head">No weekly targets yet — set them in Progress → Subjects. Each missed target lets rivals raid your borders.</span>`;
    renderSheet();
    baseDirty = true;
    redraw();
  }

  function renderSheet() {
    const sh = $("empSheet");
    if (sel < 0 || !ready) { sh.hidden = true; return; }
    const p = sel, P = map.P[p], o = st.owner[p];
    const subs = SUBJ(), era = viewEra();
    const ownerName = o === 0 ? esc(st.name) : o > 0 ? esc(st.rivals[o - 1].name) : "Unclaimed wilds";
    let body = "";
    if (o === 0) {
      const blds = Object.keys(st.bld[p] || {});
      body += blds.length ? `<div class="s-blds">${blds.map(sid => { const k = KINDS[kindOf(sid)]; return `<span class="s-b"><i style="background:${subs[sid] ? subs[sid].color : "#999"}"></i>${k.names[era]}<small>${k.effect}</small></span>`; }).join("")}</div>` : "";
      const opts = UNITS().filter(([id]) => !(st.bld[p] || {})[id]);
      body += opts.map(([id, s]) => {
        const k = KINDS[kindOf(id)], c = buildCost(id), have = Math.floor(st.pts[id] || 0);
        return `<button class="s-act" data-build="${esc(id)}" ${have >= c ? "" : "disabled"}>
          <span><i style="background:${s.color}"></i>Build ${k.names[era]}<small>${k.effect}</small></span>
          <em>${c} ${esc(s.name)}${have < c ? ` <u>need ${c - have} more min</u>` : ""}</em></button>`;
      }).join("");
      if (!opts.length && !blds.length) body += `<p class="s-note">Add subjects to unlock buildings.</p>`;
      body += `<p class="s-note">Population ${fmtPop(provPop(p))}${p === st.capital ? " · Capital — can never be lost" : hasKind(p, "law") ? " · Courthouse: 50% chance to repel raiders" : ""}</p>`;
    } else if (o > 0 && atPeace(o)) {
      body += `<p class="s-note">At peace with ${esc(st.rivals[o - 1].name)} until ${shortDate(st.treaties[o])} — you can't conquer their land until then.</p>`;
    } else if (isClaimable(p)) {
      const c = claimCost(p);
      if (o > 0 && warWith(o)) body += `<p class="s-note war-note">You're at war with ${esc(st.rivals[o - 1].name)} — win the exam campaign to take their land.</p>`;
      body += `<button class="s-act claim" data-claim="${p}" ${st.gold >= c ? "" : "disabled"}>
        <span>${o > 0 ? "Conquer" : "Claim"} ${esc(P.name)}<small>${o > 0 ? "Rival land costs 50% more" : "Expand your borders"} · ${TERRAIN[P.t].label}${TERRAIN[P.t].cost !== 1 ? " ×" + TERRAIN[P.t].cost : ""}</small></span>
        <em>${COIN}${c}${st.gold < c ? ` <u>need ${Math.ceil(c - st.gold)} more min</u>` : ""}</em></button>`;
    } else {
      body += `<p class="s-note">Not on your border yet — expand towards it first.</p>`;
    }
    sh.innerHTML = `<div class="s-head"><div><div class="s-name">${esc(P.name)}</div>
      <div class="s-meta">${TERRAIN[P.t].label}${P.coastal ? " · Coast" : ""} · <span style="color:${o === 0 ? st.color : o > 0 ? rivalColors(ERAS[era])[(o - 1) % 6] : "inherit"}">${ownerName}</span>${o > 0 ? ` · <em class="pers" title="${esc(PERS[persona(o)].desc)}">${PERS[persona(o)].label}</em>` : ""}</div></div>
      <button class="eb sm" id="sheetX" title="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>${body}`;
    sh.hidden = false;
  }
  $("empSheet").addEventListener("click", e => {
    if (e.target.closest("#sheetX")) { select(-1); return; }
    const b = e.target.closest("button[data-claim],button[data-build]");
    if (!b || b.disabled) return;
    if (b.dataset.claim) {
      const p = +b.dataset.claim, c = claimCost(p);
      if (!isClaimable(p) || st.gold < c || (st.owner[p] > 0 && atPeace(st.owner[p]))) return;
      const was = st.owner[p];
      st.gold -= c; st.owner[p] = 0;
      if (was > 0) st.conquests = (st.conquests || 0) + 1;
      logEvent(`${was > 0 ? "Conquered" : "Claimed"} ${map.P[p].name}${was > 0 ? " from " + st.rivals[was - 1].name : ""}`, "claim");
      save();
      ST.toast(`${map.P[p].name} is yours`, st.color);
      const before = rankOf(ownedList().length - 1), after = rankOf(ownedList().length);
      if (before !== after) { ST.confetti && ST.confetti([st.color, "#ffffff", "#f2c94c"]); logEvent(`Your realm became a ${after}`, "era"); save(); }
      select(p);
      refresh();
    } else {
      const sid = b.dataset.build, p = sel, c = buildCost(sid);
      if ((st.pts[sid] || 0) < c || st.owner[p] !== 0) return;
      st.pts[sid] -= c;
      (st.bld[p] || (st.bld[p] = {}))[sid] = 1;
      const nm = KINDS[kindOf(sid)].names[viewEra()];
      logEvent(`Built a ${nm} in ${map.P[p].name}`, "build");
      save();
      ST.toast(`${nm} built in ${map.P[p].name}`, SUBJ()[sid] ? SUBJ()[sid].color : "#ddd");
      refresh();
    }
  });

  // ---------- court: decrees, wars, diplomacy ----------
  const SCROLL = `<svg viewBox="0 0 24 24"><path d="M8 21h10a2 2 0 0 0 2-2v-1H10v1a2 2 0 0 1-4 0V5a2 2 0 0 0-2-2h12a2 2 0 0 1 2 2v13"/><path d="M10 8h5M10 12h5"/></svg>`;
  const SWORDS = `<svg viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/><path d="M9.5 17.5L21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2"/></svg>`;
  const EVENT_ICO = `<svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>`;
  const curEvent = () => { const e = (st.events || {})[weekOf(todayK())]; return e && !e.resolved ? e : null; };
  function showEvent() {
    const ev = curEvent(); if (!ev) return;
    ev.seen = true; save();
    const hrs = eventHours(ev, weekOf(todayK()));
    const left = 7 - ((new Date().getDay() + 6) % 7);
    modal(`<h2>${EVENT_ICO.replace("<svg", '<svg class="h-ico ev"')} ${esc(eventText(ev, "title"))}</h2>
      <p class="tip">${esc(eventText(ev, "text"))}</p>
      <div class="war-bar"><span style="width:${Math.min(100, hrs / ev.goal * 100)}%;background:#f2c94c"></span></div>
      <p class="tip"><b>${hrs.toFixed(1)}h</b> of ${ev.goal}h · ${left} day${left === 1 ? "" : "s"} left this week</p>
      <p class="tip"><b>Succeed:</b> ${esc(eventText(ev, "win"))}.<br><b>Fail:</b> ${esc(eventText(ev, "lose"))}.</p>
      <div class="m-actions"><button class="btn go" data-x>Got it</button></div>`, e => { if (e.target.closest("[data-x]")) closeModal(); });
  }
  const activeWars = () => Object.entries(st.wars || {}).filter(([, w]) => !w.resolved);
  function courtPills() {
    const D = (st.decrees || {})[todayK()];
    let out = "";
    const se = season();
    if (se) out += `<span class="pill court season" title="${esc(se.effect)}">✦ ${esc(se.name)} · ${esc(se.effect)}</span>`;
    if (D) {
      const done = D.items.filter(i => i.done).length, s = streak();
      out += `<button class="pill court${D.all ? " ok" : ""}" data-open="decrees" title="Today's decrees">${SCROLL}<b>${done}/${D.items.length}</b> decrees${s ? ` · <span class="streak">${s}-day streak</span>` : ""}</button>`;
    }
    const ev = curEvent();
    if (ev) { const eh = eventHours(ev, weekOf(todayK()));
      out += `<button class="pill court ev${eh >= ev.goal ? " ok" : ""}" data-open="event" title="This week's event — settled at the end of the week">${EVENT_ICO}${esc(eventText(ev, "title"))} <b>${eh.toFixed(1)}</b>/${ev.goal}h${eh >= ev.goal ? " ✓" : ""}</button>`; }
    for (const [key, w] of activeWars()) {
      const hrs = warHours(w), days = Math.round((kd(w.exam) - kd(todayK())) / 86400000);
      const sub = SUBJ()[w.sid];
      out += `<button class="pill court war" data-open="war" data-key="${esc(key)}" title="Exam campaign">${SWORDS}vs ${esc(st.rivals[w.enemy - 1].name)} · ${esc(sub ? sub.name : "")} <b>${hrs.toFixed(1)}</b>/${w.goal}h · ${days}d</button>`;
    }
    return out;
  }
  function renderStrip() {
    let el = $("empStrip");
    const below = document.querySelector(".below");
    if (!el && below) { el = document.createElement("div"); el.id = "empStrip"; el.className = "emp-strip link"; below.appendChild(el); el.onclick = () => open(); }
    if (!el) return;
    if (!st) { el.hidden = true; return; }
    const D = (st.decrees || {})[todayK()];
    const parts = [];
    if (D) parts.push(D.items.map(i => { const s = i.sid ? SUBJ()[i.sid] : null;
      return `<span class="${i.done ? "done" : ""}">${i.done ? "✓ " : ""}${esc(s ? s.name : "Any subject")} ${i.done ? fmtH(i.secs) : fmtH(daySecs(todayK(), i.sid)) + "/" + fmtH(i.secs)}</span>`; }).join(" · ") + (streak() ? ` · ${streak()}-day streak` : ""));
    const ev = curEvent();
    if (ev) parts.push(`<span class="ev">${esc(eventText(ev, "title"))}: ${eventHours(ev, weekOf(todayK())).toFixed(1)}/${ev.goal}h</span>`);
    for (const [, w] of activeWars()) parts.push(`<span class="war">War vs ${esc(st.rivals[w.enemy - 1].name)}: ${warHours(w).toFixed(1)}/${w.goal}h</span>`);
    el.innerHTML = parts.length ? `${SCROLL}${parts.join(" · ")}` : "";
    el.hidden = !parts.length;
  }
  $("empRes").addEventListener("click", e => {
    const b = e.target.closest("[data-open]"); if (!b) return;
    if (b.dataset.open === "decrees") showDecrees();
    else if (b.dataset.open === "event") showEvent();
    else showWar(b.dataset.key);
  });
  function showDecrees() {
    const D = (st.decrees || {})[todayK()]; if (!D) return;
    const subs = SUBJ(), s = streak();
    const week = Array.from({ length: 14 }, (_, i) => addDays(todayK(), i - 13));
    modal(`<h2>Today's decrees</h2>
      <p class="tip">Set each morning from your weekly targets — doing them keeps you on pace, so you're never raided. Each one pays ${25 + 5 * Math.min(10, s)} gold, and every day you complete them all adds +3% to all study gold (up to +30%).</p>
      ${D.items.map(it => { const sec = daySecs(todayK(), it.sid), pct = Math.min(1, sec / it.secs), c = it.sid && subs[it.sid] ? subs[it.sid].color : "#d9d6d8";
        return `<div class="dec ${it.done ? "done" : ""}"><i style="background:${c}"></i><span>${esc(decreeText(it))}</span><small>${it.done ? "fulfilled" : fmtH(sec) + " done"}</small>
          <span class="w-bar wide"><span style="width:${pct * 100}%;background:${c}"></span></span></div>`; }).join("")}
      <div class="streak-row">${week.map(d => { const x = (st.decrees || {})[d]; return `<i class="${x && x.all ? "on" : x ? "off" : ""}${d === todayK() ? " today" : ""}" title="${shortDate(d)}"></i>`; }).join("")}</div>
      <p class="tip">${s ? `<b>${s}-day streak</b> — +${Math.round(streakBonus() * 100)}% gold on all study.` : "Complete all decrees today to start a streak."}</p>
      <div class="m-actions"><button class="btn go" data-x>Close</button></div>`, e => { if (e.target.closest("[data-x]")) closeModal(); });
  }
  function showWar(key) {
    const w = (st.wars || {})[key]; if (!w) return;
    const sub = SUBJ()[w.sid], hrs = warHours(w), days = Math.round((kd(w.exam) - kd(todayK())) / 86400000);
    const total = Math.round((kd(w.exam) - kd(w.start)) / 86400000), gone = total - days;
    const pace = w.goal * gone / total;
    modal(`<h2>${SWORDS.replace("<svg", '<svg class="h-ico"')} War with ${esc(st.rivals[w.enemy - 1].name)}</h2>
      <p class="tip">Your ${esc(sub ? sub.name : "")} exam is on <b>${shortDate(w.exam)}</b> (${days} day${days === 1 ? "" : "s"} left). Study <b>${w.goal}h</b> of ${esc(sub ? sub.name : "it")} between ${shortDate(w.start)} and the exam to win.</p>
      <div class="war-bar"><span style="width:${Math.min(100, hrs / w.goal * 100)}%"></span><em style="left:${Math.min(100, pace / w.goal * 100)}%" title="Where you should be today"></em></div>
      <p class="tip"><b>${hrs.toFixed(1)}h</b> of ${w.goal}h · ${hrs >= pace ? `<span class="good">ahead of pace</span>` : `<span class="bad">${(pace - hrs).toFixed(1)}h behind pace</span>`}</p>
      <p class="tip"><b>Win:</b> take 3 of their provinces (5 if you reach ${Math.round(w.goal * 1.25)}h) and 150 gold.<br><b>Lose:</b> they take 3–6 of your border provinces (courthouses still get their 50% chance).</p>
      <div class="m-actions"><button class="btn go" data-x>To arms</button></div>`, e => { if (e.target.closest("[data-x]")) closeModal(); });
  }
  function showWarNews() {
    const news = Object.entries(st.wars || {}).filter(([, w]) => !w.seen);
    if (!news.length) { const ev = curEvent(); if (ev && !ev.seen && $("empModal").hidden) showEvent(); return; }
    if (!$("empModal").hidden) return;
    const [key, w] = news[0];
    w.seen = true; save();
    if (!w.resolved) { showWar(key); $("empCard").querySelector("h2").innerHTML = `${SWORDS.replace("<svg", '<svg class="h-ico"')} ${esc(st.rivals[w.enemy - 1].name)} declared war!`; return; }
    const sub = SUBJ()[w.sid];
    if (w.won) ST.confetti && ST.confetti([st.color, "#f2c94c", "#ffffff"]);
    modal(`<h2>${w.won ? "Victory!" : "Defeat"}</h2>
      <p class="tip">${esc(sub ? sub.name : "")} exam campaign against ${esc(st.rivals[w.enemy - 1].name)}: <b>${w.hours}h</b> of ${w.goal}h.</p>
      <p class="tip">${w.won ? `You took ${w.taken.length ? w.taken.map(esc).join(", ") : "their treasury"} and 150 gold. Good luck on the exam!`
        : `They took ${w.lost.length ? w.lost.map(esc).join(", ") : "nothing — your courthouses held"}.${w.repelled && w.repelled.length ? " Courthouses held " + w.repelled.map(esc).join(", ") + "." : ""} Good luck on the exam anyway!`}</p>
      <div class="m-actions"><button class="btn go" data-x>Onwards</button></div>`, e => { if (e.target.closest("[data-x]")) { closeModal(); showWarNews(); } });
  }
  function showDiplomacy() {
    const sid = tradeSubject(), have = sid ? Math.floor(st.pts[sid] || 0) : 0, sname = sid ? SUBJ()[sid].name : "";
    const E = ERAS[viewEra()], cols = rivalColors(E);
    const rows = st.rivals.map((R, i) => {
      const r = i + 1;
      let size = 0; for (let p = 0; p < map.N; p++) if (st.owner[p] === r) size++;
      if (!size) return `<div class="dip"><i style="background:${cols[i]}"></i><span>${esc(R.name)}<small>fallen</small></span></div>`;
      const war = warWith(r), peace = atPeace(r), border = bordersYou(r), c = treatyCost(r), P = PERS[persona(r)];
      const status = war ? `<em class="bad">At war</em>` : peace ? `<em class="good">Peace until ${shortDate(st.treaties[r])}</em>`
        : `<button class="btn" data-treaty="${r}" ${sid && have >= c ? "" : "disabled"}>Sign peace · ${c} ${esc(sname || "French")}</button>`;
      return `<div class="dip"><i style="background:${cols[i]}"></i><span>${esc(R.name)} <em class="pers" title="${esc(P.desc)}">${P.label}</em><small>${size} provinces${border ? " · borders you" : ""} · ${esc(P.desc)}</small></span>${status}</div>`;
    }).join("");
    modal(`${realmTabs("dip")}
      <p class="tip">${sid ? `Spend ${esc(sname)} points on ${treatyWeeks()}-week peace treaties. A nation at peace won't raid you when you miss a target, but you can't conquer its land either. Each extra active treaty costs 50 more; warlike nations charge more, merchants less. You have <b>${have}</b> ${esc(sname)} points.`
        : "Add a language subject (like French) to unlock diplomacy."} Exam wars cancel treaties with the enemy.</p>
      <div class="dips">${rows}</div>
      <div class="m-actions"><button class="btn go" data-x>Close</button></div>`, e => {
      const t = e.target.closest("[data-treaty]");
      if (t && !t.disabled) { signTreaty(+t.dataset.treaty); refresh(); showDiplomacy(); }
      else if (tabClick(e)) return;
      else if (e.target.closest("[data-x]")) closeModal();
    });
  }
  let realmTab = "won";
  const realmTabs = cur => `<div class="rtabs">${[["won", "Wonders"], ["tech", "Tech"], ["dip", "Diplomacy"], ["tro", "Trophies"]].map(([k, l]) => `<button class="${k === cur ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>`;
  function tabClick(e) { const t = e.target.closest("[data-tab]"); if (!t) return false; showRealm(t.dataset.tab); return true; }
  function showRealm(tab) {
    realmTab = tab;
    if (tab === "dip") return showDiplomacy();
    if (tab === "tech") return showTech();
    if (tab === "tro") return showTrophies();
    showWonders();
  }
  function showWonders() {
    const rows = Object.keys(WONDERS).map(kind => {
      const W = WONDERS[kind], sid = payer(kind), inv = (st.wonders || {})[kind] || 0, done = inv >= WONDER_COST;
      const sub = sid ? SUBJ()[sid] : null, have = sid ? Math.floor(st.pts[sid] || 0) : 0;
      if (!sid && !done) return "";
      return `<div class="wonder ${done ? "done" : ""}"><div class="w-top"><span><b>${W.name}</b><small>${W.effect}</small></span>${done ? `<em class="good">Complete</em>` : ""}</div>
        ${done ? "" : `<div class="war-bar thin"><span style="width:${inv / WONDER_COST * 100}%;background:${sub.color}"></span></div>
        <div class="w-row"><small>${Math.floor(inv)} / ${WONDER_COST} ${esc(sub.name)} points · you have ${have}</small>
        <span><button class="btn" data-inv="${kind}" ${have >= 1 ? "" : "disabled"}>+60</button> <button class="btn go" data-invall="${kind}" ${have >= 1 ? "" : "disabled"}>Invest all</button></span></div>`}</div>`;
    }).join("");
    modal(`${realmTabs("won")}<p class="tip">Each subject can raise one great wonder — 40 hours of that subject's points. Invest a little at a time or everything at once; points spent here can't be used for buildings.</p>${rows || `<p class="tip">Add subjects to unlock wonders.</p>`}
      <div class="m-actions"><button class="btn go" data-x>Close</button></div>`, e => {
      const a = e.target.closest("[data-inv],[data-invall]");
      if (a && !a.disabled) { invest(a.dataset.inv || a.dataset.invall, !!a.dataset.invall); refresh(); showWonders(); }
      else if (tabClick(e)) return;
      else if (e.target.closest("[data-x]")) closeModal();
    });
  }
  function showTech() {
    const cur = eraIdx();
    const rows = ERAS.map((E, ei) => `<div class="t-era ${ei > cur ? "locked" : ""}"><div class="t-head">${E.name}${ei > cur ? ` · unlocks at ${E.hours}h` : ""}</div>`
      + TECHS.filter(t => t.era === ei).map(T => {
        const pr = priceOf(T.cost), got = tech(T.id);
        return `<div class="tech ${got ? "got" : ""}"><span><b>${T.name}</b><small>${T.effect}</small></span>${got ? `<em class="good">Known</em>`
          : ei > cur ? `<em>${priceLabel(pr)}</em>` : `<button class="btn" data-tech="${T.id}" ${canPay(pr) ? "" : "disabled"}>${priceLabel(pr)}</button>`}</div>`;
      }).join("") + `</div>`).join("");
    modal(`${realmTabs("tech")}<p class="tip">Each era unlocks three discoveries, paid with gold or a subject's points. Their effects last forever.</p>${rows}
      <div class="m-actions"><button class="btn go" data-x>Close</button></div>`, e => {
      const t = e.target.closest("[data-tech]");
      if (t && !t.disabled) { research(t.dataset.tech); refresh(); showTech(); }
      else if (tabClick(e)) return;
      else if (e.target.closest("[data-x]")) closeModal();
    });
  }
  $("empDipBtn").onclick = () => showRealm(realmTab);

  // ---------- modals ----------
  function modal(html, onClick) {
    $("empCard").innerHTML = html;
    $("empModal").hidden = false;
    $("empCard").onclick = onClick || null;
  }
  const closeModal = () => { $("empModal").hidden = true; };
  $("empModal").addEventListener("click", e => { if (e.target === $("empModal")) closeModal(); });
  function showHelp() {
    modal(`<h2>How your empire works</h2>
      <ul class="help-list">
        <li><span class="coin"></span><div><b>Study earns gold.</b> Every focus minute = 1 gold (more with markets). Spend gold to claim provinces on your border — wild land is cheapest, rival land costs 50% more, mountains and hills cost extra. Each new province costs a bit more than the last.</div></li>
        <li><i style="background:#56b4e9"></i><div><b>Each subject builds its own thing.</b> Minutes studied in a subject become that subject's points:
          What a subject builds depends on its <b>role</b>, which you can set per subject in Progress → Subjects: law → <b>courthouses</b> (50% chance to repel raiders), languages & business → <b>markets</b> (+5% gold, pay for treaties), medicine → <b>healers</b> (+50% population), math & economics → <b>mints</b> (+6% gold), physics & science → <b>laboratories</b> (cheaper technology, and science points pay for gold-priced discoveries), history & arts → <b>theatres</b> (+25% population, no revolts), writing → <b>chanceries</b> (cheaper, longer peace treaties), listening → <b>spy networks</b> (repel 20% of raids, and show which provinces raiders are eyeing), anything else → <b>libraries</b> (+3% subject points). A subject split into skills (e.g. English: Writing, Listening, Reading) gets one building type per skill; reading counts as a library, speaking as a market.</div></li>
        <li><i style="background:#eb8c6a"></i><div><b>Miss a weekly target, get raided.</b> Every Monday each subject's target from last week is checked. Fall short and rival nations seize border provinces — 1 to 4, depending on how short you were. The week you found your empire is never checked, so you always get a full week first. Your capital is always safe; courthouses give a 50% chance to hold. Hit a target and you get 20 gold tribute. Rivals also grab one free province each every week, so claim the wilds before they do.</div></li>
        <li><i style="background:#d9d6d8"></i><div><b>Daily decrees.</b> Each day you get 1–2 tasks based on your weekly targets (e.g. "Law 2h20"). Each fulfilled decree pays gold, and every day you complete them all adds +3% to all study gold, up to +30% for a 10-day streak.</div></li>
        <li><i style="background:#e0565b"></i><div><b>Exam campaigns.</b> Set an exam date for a subject (Progress → Subjects) and 4 weeks before it a rival declares war. Study that subject's weekly target × 4 weeks by exam day to win 3–5 of their provinces and 150 gold. Fall short and they take 3–6 of yours.</div></li>
        <li><i style="background:#6fcf97"></i><div><b>Diplomacy</b> (crown button → Diplomacy). Points from a language or writing subject buy peace treaties (4 weeks, longer with chanceries). Nations at peace won't raid you, but you can't conquer them either. Exam wars cancel the treaty with the enemy.</div></li>
        <li><i style="background:#bb86fc"></i><div><b>The realm</b> (crown button). <b>Wonders</b>: one great project per subject, 40 hours of its points, with a permanent bonus. <b>Technology</b>: three discoveries per era. <b>Weekly events</b>: most weeks bring a plague, a trade boom, unrest or visiting scholars — study the named subject enough that week to come out ahead.</div></li>
        <li><i style="background:#f2c94c"></i><div><b>Eras.</b> Total focus hours move history forward: Antiquity → Medieval (60h) → Renaissance (250h) → Industrial (600h) → Modern (1200h). At ~30h a week that's roughly a year of study. Each era redraws the map and renames your buildings. You can look back at earlier eras in settings.</div></li>
        <li><i style="background:#bb86fc"></i><div><b>Rival nations have personalities.</b> Warlike ones charge more for peace and start exam wars first; expansionists grab two free provinces a week; merchants sell cheap peace and pay you +5% gold while it lasts; peaceful ones grow slowly and their land is cheaper to take.</div></li>
        <li><i style="background:#f2c94c"></i><div><b>Seasons.</b> New Year (+25% gold), winter and summer exam seasons (double decree rewards), spring (cheaper land), harvest (+20% points) — and your own exam week gives +20% gold.</div></li>
        <li><i style="background:#f2c94c"></i><div><b>Achievements</b> (crown → Trophies): 27 milestones, each worth 50 gold, plus a record of every exam campaign.</div></li>
        <li><i style="background:#e0565b"></i><div><b>Spies.</b> With a spy network (from a listening subject or skill), provinces raiders would hit if the week ended now get a pulsing red ring, and Border watch names them.</div></li>
        <li><i style="background:#888"></i><div><b>Chronicle</b> (scroll button) lists everything that happened, and <b>Replay your history</b> plays back your borders over time.</div></li>
      </ul>
      <p class="tip">Tap a province to see it. Drag to move, pinch or scroll to zoom. The striped provinces are the ones you can claim next. Your capital (star) can never be lost.</p>
      <div class="m-actions"><button class="btn go" data-x>Got it</button></div>`, e => { if (e.target.closest("[data-x]")) closeModal(); });
  }
  function showLog() {
    const icon = { tech: "#56b4e9", war: "#e0565b", peace: "#6fcf97", rival: "#bb86fc", raid: "#eb8c6a", good: "#6fcf97", claim: st.color, build: "#56b4e9", era: "#f2c94c" };
    modal(`<h2>Chronicle</h2><button class="btn go replay-btn" data-replay><svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>Replay your history</button><div class="chron">${st.log.length ? st.log.map(l => `<div class="c-row"><i style="background:${icon[l.k] || "#888"}"></i><span>${esc(l.t)}</span><small>${shortDate(l.d)}</small></div>`).join("") : `<p class="tip">Nothing has happened yet. Study, then claim your first province.</p>`}</div>
      <div class="m-actions"><button class="btn" data-x>Close</button></div>`, e => { if (e.target.closest("[data-replay]")) startReplay(); else if (e.target.closest("[data-x]")) closeModal(); });
  }
  function showSettings() {
    const unlocked = eraIdx();
    modal(`<h2>Settings</h2>
      <label class="f-row">Empire name<input type="text" id="setName" maxlength="20" value="${esc(st.name)}"></label>
      <div class="f-row">Colour<div class="swatches" id="setColor">${PLAYER_COLORS.map(c => `<button class="sw${c === st.color ? " on" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")}</div></div>
      <div class="f-row">Map style (eras you've reached)<div class="eras">${ERAS.map((e, i) => `<button class="chip${i === viewEra() ? " on" : ""}" data-era="${i}" ${i > unlocked ? "disabled" : ""}>${e.name}${i > unlocked ? " · " + e.hours + "h" : ""}</button>`).join("")}</div></div>
      ${ownedList().length <= 3 && !Object.keys(st.bld).length ? `<div class="f-row">Don't like this continent?<button class="btn" data-reroll>New map</button></div>` : ""}
      <div class="m-actions"><button class="btn go" data-x>Done</button></div>`, e => {
      const c = e.target.closest("[data-c]"), er = e.target.closest("[data-era]");
      if (c) { st.color = c.dataset.c; save(); document.querySelectorAll("#setColor .sw").forEach(b => b.classList.toggle("on", b === c)); refresh(); }
      else if (er && !er.disabled) { const i = +er.dataset.era; st.viewEra = i === unlocked ? null : i; save(); document.querySelectorAll("[data-era]").forEach(b => b.classList.toggle("on", b === er)); refresh(); }
      else if (e.target.closest("[data-reroll]")) { reroll(); }
      else if (e.target.closest("[data-x]")) closeModal();
    });
    $("setName").addEventListener("change", () => { const v = $("setName").value.trim(); if (v) { st.name = v; save(); refresh(); } });
  }
  function showReports() {
    const reps = st.reports.filter(r => !r.seen);
    if (!reps.length) return;
    const subs = SUBJ();
    const anyLost = reps.some(r => r.lines.some(l => l.lost && l.lost.length));
    ensureMap();
    modal(`<h2>${anyLost ? "Your borders were raided" : "Weekly report"}</h2>` + reps.map(r => `<div class="rep"><div class="rep-w">Week of ${shortDate(r.week)}</div>`
      + r.lines.map(l => `<div class="rep-l ${l.ok ? "ok" : "bad"}"><i style="background:${subs[l.sid] ? subs[l.sid].color : "#888"}"></i>
        <span>${esc(subs[l.sid] ? subs[l.sid].name : "Subject")} ${l.done.toFixed(1)}/${l.target}h</span>
        <small>${l.ok ? "target met" : (l.lost && l.lost.length ? "lost " + l.lost.map(x => esc(map.P[x.p].name) + " to " + esc(x.by)).join(", ") : l.shielded ? "" : "nothing to take")
          + (l.repelled && l.repelled.length ? `${l.lost && l.lost.length ? " · " : ""}<span class="saved">courthouse repelled raiders at ${l.repelled.map(esc).join(", ")}</span>` : "")}</small></div>`).join("")
      + (r.event ? `<div class="rep-e ${r.event.won ? "ok" : "bad"}">${esc(r.event.text)}</div>` : "")
      + (r.grew && r.grew.length ? `<div class="rep-g">Rivals expanded: ${r.grew.map(x => `${esc(x.by)} took ${esc(map.P[x.p].name)}`).join(" · ")}</div>` : "")
      + (r.tribute ? `<div class="rep-t">${COIN} +${r.tribute} gold tribute</div>` : "") + `</div>`).join("")
      + `<div class="m-actions"><button class="btn go" data-x>${anyLost ? "Rebuild" : "Onwards"}</button></div>`, e => {
        if (e.target.closest("[data-x]")) { reps.forEach(r => { r.seen = true; }); save(); closeModal(); $("empireBtn").classList.remove("alert"); if (st.pendingEra != null) showEraUnlock(); }
      });
  }
  function showEraUnlock() {
    const e = st.pendingEra; if (e == null) return;
    st.pendingEra = null; save();
    baseDirty = true; refresh();
    ST.confetti && ST.confetti(["#f2c94c", st.color, "#ffffff"]);
    modal(`<div class="era-big" style="font-family:'${ERAS[e].font}',Georgia,serif">${ERAS[e].name}</div>
      <p class="tip">${totals().all / 3600 | 0} hours of focus carried ${esc(st.name)} into a new age. The map has been redrawn and your buildings have been modernised.</p>
      <div class="m-actions"><button class="btn go" data-x>Enter the ${ERAS[e].name}</button></div>`, ev => { if (ev.target.closest("[data-x]")) closeModal(); });
  }
  $("empHelpBtn").onclick = showHelp;
  $("empLogBtn").onclick = showLog;
  $("empSetBtn").onclick = showSettings;
  $("empClose").onclick = () => close();

  // ---------- founding ----------
  function showFounding() {
    const seed = (Math.random() * 2 ** 31) | 0;
    const suggest = nameGen(mulberry32(seed))(true);
    modal(`<h2>Found your empire</h2>
      <p class="tip">Every focus minute becomes gold to claim land. Each subject raises its own buildings. Miss a weekly target and rivals raid your borders. Your past study time is your starting treasury.</p>
      ${window.FIREBASE_CONFIG && ST.syncState && ST.syncState() === "local" ? `<p class="tip"><b>Tip:</b> sign in first (Progress panel, bottom) so the same empire is on all your devices.</p>` : ""}
      <label class="f-row">Name<input type="text" id="fName" maxlength="20" value="${esc(suggest)}"></label>
      <div class="f-row">Colour<div class="swatches" id="fColor">${PLAYER_COLORS.map((c, i) => `<button class="sw${i ? "" : " on"}" data-c="${c}" style="background:${c}"></button>`).join("")}</div></div>
      <div class="m-actions"><button class="btn" data-cancel>Not now</button><button class="btn go" data-found>Found empire</button></div>`, e => {
      const c = e.target.closest("[data-c]");
      if (c) { document.querySelectorAll("#fColor .sw").forEach(b => b.classList.toggle("on", b === c)); return; }
      if (e.target.closest("[data-cancel]")) { closeModal(); close(); return; }
      if (e.target.closest("[data-found]")) {
        const name = $("fName").value.trim() || suggest;
        const color = (document.querySelector("#fColor .sw.on") || {}).dataset?.c || PLAYER_COLORS[0];
        closeModal();
        found(seed, name, color);
      }
    });
  }
  function found(seed, name, color) {
    $("empLoading").hidden = false;
    setTimeout(() => {
      const m = generate(seed); map = m;
      const n = foundNations(m, seed);
      const today = todayK();
      st = { v: 1, seed, name, color, capital: n.capital, owner: n.owner, rivals: n.rivals, bld: {}, gold: 0, pts: {}, credited: {},
        founded: today, raidWeek: weekOf(today), eraSeen: 0, viewEra: null, log: [], reports: [], pendingEra: null };
      credit(true);
      st.eraSeen = eraIdx();
      logEvent(`${name} was founded`, "era");
      save();
      $("empLoading").hidden = true;
      start();
      sync(true);
      setTimeout(showHelp, 400);
    }, 30);
  }
  function reroll() {
    const keep = { name: st.name, color: st.color };
    const seed = (Math.random() * 2 ** 31) | 0;
    closeModal();
    sel = -1; selMask = null; ready = false;
    $("empLoading").hidden = false;
    setTimeout(() => {
      map = generate(seed);
      const n = foundNations(map, seed);
      Object.assign(st, { seed, capital: n.capital, owner: n.owner, rivals: n.rivals, bld: {} });
      save();
      $("empLoading").hidden = true;
      start();
    }, 30);
  }

  function start() {
    ensureMap();
    ready = true; baseDirty = true;
    view.fit = Math.min(cv.clientWidth / W, cv.clientHeight / H);
    centerOn(st.capital, cv.clientWidth < 700 ? 2.4 : 1.6);
    refresh();
    if (st.reports.some(r => !r.seen)) showReports();
    else if (st.pendingEra != null) showEraUnlock();
    else showWarNews();
  }

  // ---------- open / close ----------
  function open() {
    root.hidden = false;
    document.body.classList.add("empire-open");
    $("empireBtn") && $("empireBtn").classList.remove("alert");
    if (!st) {
      const s = ST.syncState ? ST.syncState() : "local";
      if ((s === "connecting" || s === "slow" || s === "synced") && ST.serverSeen && !ST.serverSeen()) {
        waitingForAccount = true;
        modal(`<h2>Loading your empire…</h2><p class="tip">Checking your account for an empire you started on another device.</p>
          <div class="m-actions"><button class="btn" data-x>Close</button></div>`, e => { if (e.target.closest("[data-x]")) { waitingForAccount = false; closeModal(); close(); } });
        return;
      }
      showFounding(); return;
    }
    if (!ready) {
      $("empLoading").hidden = false;
      setTimeout(() => { sync(true); $("empLoading").hidden = true; start(); }, 30);
    } else { sync(true); clampView(); refresh(); if (st.reports.some(r => !r.seen)) showReports(); }
  }
  function close() {
    stopReplay();
    root.hidden = true; closeModal(); select(-1);
    document.body.classList.remove("empire-open");
  }
  document.addEventListener("keydown", e => {
    if (!isOpen()) {
      const t = e.target.tagName;
      if (e.key.toLowerCase() === "e" && t !== "INPUT" && t !== "SELECT" && t !== "TEXTAREA" && !e.ctrlKey && !e.metaKey && !e.altKey
          && $("panel").hidden && $("noteCard").hidden) { e.preventDefault(); open(); }
      return;
    }
    if (e.target.tagName === "INPUT") { if (e.key === "Escape") e.target.blur(); return; }
    const k = e.key.toLowerCase();
    if (k === "escape") { if (replay) stopReplay(); else if (!$("empModal").hidden) closeModal(); else if (sel >= 0) select(-1); else close(); }
    else if (k === "e") close();
    else if (k === "+" || k === "=") zoomAt(1.3, cv.clientWidth / 2, cv.clientHeight / 2);
    else if (k === "-") zoomAt(1 / 1.3, cv.clientWidth / 2, cv.clientHeight / 2);
    else return;
    e.preventDefault();
  });

  window.addEventListener("studytimer:change", () => sync(false));
  setInterval(() => { if (st) sync(true); }, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && st) sync(true); });
  if (st) setTimeout(() => sync(true), 500);

  // load the era fonts early so map labels render in them
  if (document.fonts) ERAS.forEach(e => document.fonts.load(`${e.weight} 16px "${e.font}"`).catch(() => {}));

  // read-only numbers for the monthly recap
  function summary(from, to) {
    if (!st) return null;
    const cnt = o => [...o].filter(c => c === "0").length;
    const H = st.hist || [];
    const at = d => { let o = null; for (const x of H) if (x.d <= d) o = x.o; return o; };
    const a = at(addDays(from, -1)), b = at(to);
    return { name: st.name, color: st.color, era: ERAS[eraIdx()].name, rank: rankOf(ownedList().length),
      provinces: b ? cnt(b) : ownedList().length, gained: a && b ? cnt(b) - cnt(a) : null,
      wars: Object.values(st.wars || {}).filter(w => w.resolved && w.exam >= from && w.exam <= to).map(w => ({ won: w.won, enemy: st.rivals[w.enemy - 1].name })) };
  }
  // ---------- hooks for friends & alliances (social.js) ----------
  function publicInfo() {
    if (!st) return null;
    return { name: st.name, color: st.color, provinces: ownedList().length, era: ERAS[eraIdx()].name, rank: rankOf(ownedList().length), streak: st.decrees ? streak() : 0 };
  }
  function grant(gold, text) { if (!st) return false; st.gold += gold; logEvent(text, "good"); save(); if (isOpen()) refresh(); return true; }
  function spend(gold) { if (!st || st.gold < gold) return false; st.gold -= gold; save(); if (isOpen()) refresh(); return true; }
  function receiveAid(week, from) {
    if (!st || (st.aid || {})[week]) return false;
    (st.aid = st.aid || {})[week] = from; logEvent(`${from} sent reinforcements — this week's raids take 2 provinces fewer`, "peace"); save(); return true;
  }
  window.Empire = { open, close, applyRemote, summary, publicInfo, grant, spend, receiveAid, gold: () => st ? st.gold : 0, ROLES, guessKind, KINDS, toggle: () => (isOpen() ? close() : open()), _debug: { map: () => map, view, state: () => st } };
})();
