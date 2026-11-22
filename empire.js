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
    { name: "Medieval", hours: 25, font: "IM Fell English SC", weight: 400, paper: .6, tint: .66, grain: 16,
      water: "#6d8d88", shallow: "#9db4a6", neutral: "#e0cfa5", ink: "#2e1f10", halo: "rgba(245,234,205,.6)", waves: true,
      rivals: ["#a33b32", "#2f5d8a", "#3d7a45", "#c9a227", "#6b3f86", "#b86b2e"] },
    { name: "Renaissance", hours: 75, font: "Cormorant Garamond", weight: 700, paper: .35, tint: .68, grain: 10,
      water: "#3f6f92", shallow: "#6c9bb8", neutral: "#e6dcc0", ink: "#2a1c12", halo: "rgba(250,244,228,.6)", waves: true,
      rivals: ["#b8463f", "#3b6ea8", "#4f9a5a", "#d9a53a", "#8a5bab", "#d07f4c"] },
    { name: "Industrial", hours: 150, font: "Oswald", weight: 500, paper: .2, tint: .72, grain: 18,
      water: "#3a464e", shallow: "#56636a", neutral: "#b9ad96", ink: "#1d1a17", halo: "rgba(225,215,195,.5)", waves: false,
      rivals: ["#8c4a3c", "#4d6273", "#5e7350", "#a68a4a", "#6d5a78", "#8a6b55"] },
    { name: "Modern", hours: 300, font: "Inter", weight: 800, paper: 0, tint: .9, grain: 5,
      water: "#0b1721", shallow: "#15293a", neutral: "#3b4047", ink: "#f1f1f1", halo: "rgba(0,0,0,.55)", waves: false,
      rivals: ["#e0565b", "#4c8dde", "#46b97a", "#e8b84a", "#a07ae0", "#e98a4f"] },
  ];
  const PLAYER_COLORS = ["#e2b43c", "#d1495b", "#3a86c8", "#2fa36b", "#8e5cc7", "#e07a3a", "#2bb3b1", "#f0f0f0"];

  // ---------- buildings (one type per subject) ----------
  const KINDS = {
    law:    { label: "Courthouse", effect: "Protects this province from raids",
              names: ["Forum", "Royal Court", "Palace of Justice", "Ministry of Law", "Supreme Court"],
              icon: "M12 3v17M7 20h10M4 7h16M7 7l-3 7h6zM17 7l-3 7h6z" },
    trade:  { label: "Market", effect: "+5% gold from all study (up to +50%)",
              names: ["Agora", "Market Town", "Merchant Embassy", "Stock Exchange", "Trade Consulate"],
              icon: "M3 10l2-5h14l2 5M5 10v9h14v-9M3 10h18M10 19v-5h4v5" },
    health: { label: "Healer", effect: "+50% population in this province",
              names: ["Herb Garden", "Monastery Infirmary", "Apothecary", "Hospital", "Medical Centre"],
              icon: "M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7" },
    learn:  { label: "Library", effect: "+25% population in this province",
              names: ["Library", "Scriptorium", "Academy", "University", "Research Institute"],
              icon: "M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" },
  };
  function kindOf(sid) {
    const s = ST.getSubjects()[sid];
    const n = ((s && s.name) || sid).toLowerCase();
    if (sid === "law" || /law|legal|jur/.test(n)) return "law";
    if (sid === "french" || /french|english|spanish|german|language|langue|trade|econ/.test(n)) return "trade";
    if (sid === "tcm" || /tcm|medic|health|bio|chinese med|anat/.test(n)) return "health";
    return "learn";
  }
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
    return { seed, val, thr, prov, flags, P, N, seaLinks, nameGen: names };
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
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  let map = null;
  function ensureMap() { if (st && (!map || map.seed !== st.seed)) map = generate(st.seed); return map; }

  const ownedList = () => st.owner.map((o, i) => o === 0 ? i : -1).filter(i => i >= 0);
  function countKind(kind) {
    let n = 0;
    for (const p in st.bld) for (const sid in st.bld[p]) if (st.owner[p] === 0 && kindOf(sid) === kind) n++;
    return n;
  }
  const goldMult = () => 1 + Math.min(.5, countKind("trade") * .05);
  function provPop(p) {
    const o = map.P[p]; let pop = TERRAIN[o.t].pop + (o.coastal ? 4 : 0);
    let m = 1;
    for (const sid in (st.bld[p] || {})) { const k = kindOf(sid); if (k === "health") m += .5; else if (k === "learn") m += .25; }
    return pop * m * [1, 1.6, 2.5, 4, 7][eraIdx()] * 1000;
  }
  const fmtPop = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : Math.round(n / 1000) + "k";
  function claimCost(p) {
    let c = (30 + 8 * (ownedList().length - 1)) * TERRAIN[map.P[p].t].cost;
    if (st.owner[p] > 0) c *= 1.5;
    return Math.round(c);
  }
  function buildCost(sid) {
    let n = 0;
    for (const p in st.bld) if (st.bld[p][sid]) n++;
    return 60 + 15 * n;
  }
  const isClaimable = p => st.owner[p] !== 0 && map.P[p].nb.some(n => st.owner[n] === 0);

  // totals from the timer's history
  function totals() {
    const h = ST.getHistory(), t = {};
    let all = 0;
    for (const k in h) {
      const r = h[k]; if (!r) continue;
      const f = +r.f || 0; all += f;
      let s = 0;
      const by = r.by || {};
      for (const id in by) { if (id === "_none") continue; const v = +by[id] || 0; t[id] = (t[id] || 0) + v; s += v; }
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
  function credit(silent) {
    const { t } = totals();
    const mult = goldMult();
    let g = 0; const parts = [];
    const ids = new Set([...Object.keys(t), ...Object.keys(st.credited)]);
    for (const id of ids) {
      const now = t[id] || 0, was = st.credited[id] || 0, d = now - was;
      if (Math.abs(d) < 1) continue;
      st.credited[id] = now;
      const mins = d / 60;
      g += d > 0 ? mins * mult : mins;
      if (id !== "_none") { st.pts[id] = (st.pts[id] || 0) + mins; if (mins >= 1) parts.push([id, mins]); }
    }
    if (!g && !parts.length) return;
    st.gold += g;
    save();
    if (!silent && g >= 1) coinToast(g, parts);
  }

  // weekly border check: missed targets → rivals take border provinces
  function processWeeks() {
    const lastDone = addDays(weekOf(todayK()), -7);
    let w = addDays(st.raidWeek, 7), guard = 0;
    if (w <= lastDone) ensureMap();
    while (w <= lastDone && guard++ < 60) {
      if (kd(w) >= kd(addDays(lastDone, -7 * 8))) evaluateWeek(w);   // only the last 8 weeks if you've been away long
      st.raidWeek = w;
      w = addDays(w, 7);
    }
    save();
  }
  function evaluateWeek(w) {
    const subs = ST.activeSubjects().filter(([, s]) => s.target > 0);
    if (!subs.length) return;
    const rep = { week: w, lines: [], tribute: 0 };
    for (const [sid, s] of subs) {
      const done = weekSecs(w, sid) / 3600;
      if (done >= s.target) { rep.tribute += 20; rep.lines.push({ sid, done, target: s.target, ok: true }); continue; }
      const n = Math.min(4, Math.ceil((1 - done / s.target) * 4));
      const lost = [];
      for (let i = 0; i < n; i++) {
        const owned = ownedList();
        if (owned.length <= 1) break;
        const cands = owned.filter(p => p !== st.capital && !hasKind(p, "law") && map.P[p].nb.some(nb => st.owner[nb] !== 0));
        if (!cands.length) break;
        const score = p => map.P[p].nb.filter(nb => st.owner[nb] > 0).length + Math.random() * .9;
        cands.sort((a, b) => score(b) - score(a));
        const p = cands[0];
        const tally = {};
        map.P[p].nb.forEach(nb => { if (st.owner[nb] > 0) tally[st.owner[nb]] = (tally[st.owner[nb]] || 0) + 1; });
        const taker = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
        st.owner[p] = taker ? +taker : -1;
        lost.push({ p, by: taker ? st.rivals[taker - 1].name : "Rebels" });
      }
      const shielded = !lost.length && ownedList().some(p => hasKind(p, "law"));
      rep.lines.push({ sid, done, target: s.target, ok: false, lost, shielded });
      if (lost.length) logEvent(`Week of ${shortDate(w)}: ${ST.getSubjects()[sid].name} target missed (${done.toFixed(1)}/${s.target}h) — lost ${lost.map(l => map.P[l.p].name).join(", ")}`, "raid");
      else logEvent(`Week of ${shortDate(w)}: ${ST.getSubjects()[sid].name} target missed, but ${shielded ? "your courthouses held the border" : "there was nothing to take"}`, "raid");
    }
    if (rep.tribute) { st.gold += rep.tribute; logEvent(`Week of ${shortDate(w)}: targets met — +${rep.tribute} gold tribute`, "good"); }
    st.reports.push(rep);
    st.reports = st.reports.slice(-6);
  }
  const hasKind = (p, kind) => Object.keys(st.bld[p] || {}).some(sid => kindOf(sid) === kind);

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
    credit(silent);
    processWeeks();
    checkEra();
    if (isOpen()) { if (st.reports.some(r => !r.seen)) showReports(); refresh(); }
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
    const subs = ST.getSubjects();
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
  function renderBase() {
    const E = ERAS[viewEra()];
    const { val, thr, prov, flags, P } = map;
    const img = bctx.createImageData(W, H), d = img.data;
    const deep = hex(E.water), shallow = hex(E.shallow), ink = hex(E.ink), neutral = hex(E.neutral);
    const paperC = [236, 224, 192];
    const owner = st.owner;
    const claim = new Uint8Array(map.N);
    for (let p = 0; p < map.N; p++) claim[p] = isClaimable(p) ? 1 : 0;
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
  function draw() {
    rafId = 0;
    if (!ready || !isOpen()) return;
    if (baseDirty) renderBase();
    const dpr = window.devicePixelRatio || 1;
    const cw = cv.clientWidth, ch = cv.clientHeight;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    const E = ERAS[viewEra()];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = E.water; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.tx, dpr * view.ty);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(base, 0, 0);
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
      const o = st.owner[p]; if (o < 0) continue;
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
    // buildings + capital
    const r = clamp(4 + view.s * 3.2, 7, 12);
    const subs = ST.getSubjects();
    for (let p = 0; p < map.N; p++) {
      const sids = st.owner[p] === 0 ? Object.keys(st.bld[p] || {}) : [];
      const isCap = p === st.capital;
      if (!sids.length && !isCap) continue;
      const [x, y] = S(map.P[p].ax, map.P[p].ay);
      if (x < -50 || y < -50 || x > cw + 50 || y > ch + 50) continue;
      const items = (isCap ? ["_cap"] : []).concat(sids);
      const tot = items.length * (r * 2 + 3) - 3;
      items.forEach((sid, k) => {
        const bx = x - tot / 2 + r + k * (r * 2 + 3), by = y;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fillStyle = sid === "_cap" ? st.color : (subs[sid] ? subs[sid].color : "#999");
        ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 4; ctx.fill(); ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(10,10,10,.85)"; ctx.stroke();
        ctx.save(); ctx.translate(bx - r * .62, by - r * .62); ctx.scale(r * 1.24 / 24, r * 1.24 / 24);
        if (sid === "_cap") { ctx.fillStyle = "#111"; ctx.fill(STAR); }
        else { ctx.strokeStyle = "#111"; ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(ICONS[kindOf(sid)]); }
        ctx.restore();
      });
    }
    if (sel >= 0) rafId = requestAnimationFrame(draw);
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
    const subs = ST.activeSubjects();
    $("empRes").innerHTML =
      `<span class="pill" title="Gold — 1 per focus minute${goldMult() > 1 ? ", +" + Math.round((goldMult() - 1) * 100) + "% from markets" : ""}. Spend it to claim land.">${COIN}<b>${Math.floor(st.gold)}</b></span>`
      + subs.map(([id, s]) => `<span class="pill" title="${esc(s.name)} points — 1 per minute studied. Builds ${KINDS[kindOf(id)].label.toLowerCase()}s."><i style="background:${s.color}"></i><svg viewBox="0 0 24 24"><path d="${KINDS[kindOf(id)].icon}"/></svg><b>${Math.floor(st.pts[id] || 0)}</b></span>`).join("")
      + `<span class="pill dim" title="Provinces · population"><b>${owned.length}</b> prov · ${fmtPop(pop)}</span>`;
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
      : `<span class="w-head">No weekly targets yet — set them in Progress → Subjects. Each missed target lets rivals raid your borders.</span>`;
    renderSheet();
    baseDirty = true;
    redraw();
  }

  function renderSheet() {
    const sh = $("empSheet");
    if (sel < 0 || !ready) { sh.hidden = true; return; }
    const p = sel, P = map.P[p], o = st.owner[p];
    const subs = ST.getSubjects(), era = viewEra();
    const ownerName = o === 0 ? esc(st.name) : o > 0 ? esc(st.rivals[o - 1].name) : "Unclaimed wilds";
    let body = "";
    if (o === 0) {
      const blds = Object.keys(st.bld[p] || {});
      body += blds.length ? `<div class="s-blds">${blds.map(sid => { const k = KINDS[kindOf(sid)]; return `<span class="s-b"><i style="background:${subs[sid] ? subs[sid].color : "#999"}"></i>${k.names[era]}<small>${k.effect}</small></span>`; }).join("")}</div>` : "";
      const opts = ST.activeSubjects().filter(([id]) => !(st.bld[p] || {})[id]);
      body += opts.map(([id, s]) => {
        const k = KINDS[kindOf(id)], c = buildCost(id), have = Math.floor(st.pts[id] || 0);
        return `<button class="s-act" data-build="${esc(id)}" ${have >= c ? "" : "disabled"}>
          <span><i style="background:${s.color}"></i>Build ${k.names[era]}<small>${k.effect}</small></span>
          <em>${c} ${esc(s.name)}${have < c ? ` <u>need ${c - have} more min</u>` : ""}</em></button>`;
      }).join("");
      if (!opts.length && !blds.length) body += `<p class="s-note">Add subjects to unlock buildings.</p>`;
      body += `<p class="s-note">Population ${fmtPop(provPop(p))}${p === st.capital ? " · Capital — can never be lost" : hasKind(p, "law") ? " · Protected from raids" : ""}</p>`;
    } else if (isClaimable(p)) {
      const c = claimCost(p);
      body += `<button class="s-act claim" data-claim="${p}" ${st.gold >= c ? "" : "disabled"}>
        <span>${o > 0 ? "Conquer" : "Claim"} ${esc(P.name)}<small>${o > 0 ? "Rival land costs 50% more" : "Expand your borders"} · ${TERRAIN[P.t].label}${TERRAIN[P.t].cost !== 1 ? " ×" + TERRAIN[P.t].cost : ""}</small></span>
        <em>${COIN}${c}${st.gold < c ? ` <u>need ${Math.ceil(c - st.gold)} more min</u>` : ""}</em></button>`;
    } else {
      body += `<p class="s-note">Not on your border yet — expand towards it first.</p>`;
    }
    sh.innerHTML = `<div class="s-head"><div><div class="s-name">${esc(P.name)}</div>
      <div class="s-meta">${TERRAIN[P.t].label}${P.coastal ? " · Coast" : ""} · <span style="color:${o === 0 ? st.color : o > 0 ? rivalColors(ERAS[era])[(o - 1) % 6] : "inherit"}">${ownerName}</span></div></div>
      <button class="eb sm" id="sheetX" title="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>${body}`;
    sh.hidden = false;
  }
  $("empSheet").addEventListener("click", e => {
    if (e.target.closest("#sheetX")) { select(-1); return; }
    const b = e.target.closest("button[data-claim],button[data-build]");
    if (!b || b.disabled) return;
    if (b.dataset.claim) {
      const p = +b.dataset.claim, c = claimCost(p);
      if (!isClaimable(p) || st.gold < c) return;
      const was = st.owner[p];
      st.gold -= c; st.owner[p] = 0;
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
      ST.toast(`${nm} built in ${map.P[p].name}`, ST.getSubjects()[sid] ? ST.getSubjects()[sid].color : "#ddd");
      refresh();
    }
  });

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
          Law builds <b>courthouses</b> (the province can't be raided), French builds <b>markets</b> (+5% gold each), TCM builds <b>healers</b> (+50% population). Other subjects build libraries.</div></li>
        <li><i style="background:#eb8c6a"></i><div><b>Miss a weekly target, get raided.</b> Every Monday each subject's target from last week is checked. Fall short and rival nations seize border provinces — 1 to 4, depending on how short you were. Your capital and provinces with courthouses are safe. Hit every target and you get gold tribute.</div></li>
        <li><i style="background:#f2c94c"></i><div><b>Eras.</b> Total focus hours move history forward: Antiquity → Medieval (25h) → Renaissance (75h) → Industrial (150h) → Modern (300h). Each era redraws the map and renames your buildings. You can look back at earlier eras in settings.</div></li>
      </ul>
      <p class="tip">Tap a province to see it. Drag to move, pinch or scroll to zoom. The striped provinces are the ones you can claim next.</p>
      <div class="m-actions"><button class="btn go" data-x>Got it</button></div>`, e => { if (e.target.closest("[data-x]")) closeModal(); });
  }
  function showLog() {
    const icon = { raid: "#eb8c6a", good: "#6fcf97", claim: st.color, build: "#56b4e9", era: "#f2c94c" };
    modal(`<h2>Chronicle</h2><div class="chron">${st.log.length ? st.log.map(l => `<div class="c-row"><i style="background:${icon[l.k] || "#888"}"></i><span>${esc(l.t)}</span><small>${shortDate(l.d)}</small></div>`).join("") : `<p class="tip">Nothing has happened yet. Study, then claim your first province.</p>`}</div>
      <div class="m-actions"><button class="btn" data-x>Close</button></div>`, e => { if (e.target.closest("[data-x]")) closeModal(); });
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
    const subs = ST.getSubjects();
    const anyLost = reps.some(r => r.lines.some(l => l.lost && l.lost.length));
    modal(`<h2>${anyLost ? "Your borders were raided" : "Weekly report"}</h2>` + reps.map(r => `<div class="rep"><div class="rep-w">Week of ${shortDate(r.week)}</div>`
      + r.lines.map(l => `<div class="rep-l ${l.ok ? "ok" : "bad"}"><i style="background:${subs[l.sid] ? subs[l.sid].color : "#888"}"></i>
        <span>${esc(subs[l.sid] ? subs[l.sid].name : "Subject")} ${l.done.toFixed(1)}/${l.target}h</span>
        <small>${l.ok ? "target met" : l.lost && l.lost.length ? "lost " + l.lost.map(x => esc(map.P[x.p].name) + " to " + esc(x.by)).join(", ") : l.shielded ? "courthouses held the border" : "nothing to take"}</small></div>`).join("")
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
  }

  // ---------- open / close ----------
  function open() {
    root.hidden = false;
    document.body.classList.add("empire-open");
    $("empireBtn") && $("empireBtn").classList.remove("alert");
    if (!st) { showFounding(); return; }
    if (!ready) {
      $("empLoading").hidden = false;
      setTimeout(() => { sync(true); $("empLoading").hidden = true; start(); }, 30);
    } else { sync(true); clampView(); refresh(); if (st.reports.some(r => !r.seen)) showReports(); }
  }
  function close() {
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
    if (k === "escape") { if (!$("empModal").hidden) closeModal(); else if (sel >= 0) select(-1); else close(); }
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

  window.Empire = { open, close, toggle: () => (isOpen() ? close() : open()), _debug: { map: () => map, view, state: () => st } };
})();
