// Study Timer extras: focus sounds, calendar reminders, year heatmap, monthly recap card.
(() => {
  "use strict";
  const ST = window.StudyTimer;
  if (!ST) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const dk = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const kd = k => new Date(k + "T12:00:00");
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const fmtH = secs => { const m = Math.round(secs / 60); return m < 60 ? m + "m" : Math.floor(m / 60) + "h" + (m % 60 ? " " + pad(m % 60) + "m" : ""); };
  const get = (k, d) => { try { const v = localStorage.getItem("studyTimer." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem("studyTimer." + k, JSON.stringify(v)); } catch (e) {} };

  // ================= focus sounds (generated, work offline) =================
  const SOUNDS = [["off", "Off"], ["rain", "Rain"], ["ocean", "Ocean"], ["brown", "Brown noise"], ["pink", "Pink noise"], ["white", "White noise"]];
  const amb = Object.assign({ kind: "off", vol: .5, onlyRunning: true }, get("ambient", {}));
  let ac = null, out = null, nodes = [];
  function noiseBuffer(type) {
    const len = ac.sampleRate * 8, buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (type === "white") d[i] = w * .35;
        else if (type === "brown") { last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
        else {
          b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
          b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .09; b6 = w * .115926;
        }
      }
      // fade the loop seam
      for (let i = 0; i < 2000; i++) { const g = i / 2000; d[i] *= g; d[len - 1 - i] *= g; }
    }
    return buf;
  }
  function src(type) { const s = ac.createBufferSource(); s.buffer = noiseBuffer(type); s.loop = true; s.start(); nodes.push(s); return s; }
  function stopSound() { nodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} }); nodes = []; }
  function startSound() {
    stopSound();
    if (amb.kind === "off") return;
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    if (!out) { out = ac.createGain(); out.connect(ac.destination); }
    out.gain.value = amb.vol * amb.vol;
    if (amb.kind === "rain") {
      const s = src("pink"), hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 450; lp.type = "lowpass"; lp.frequency.value = 7000;
      s.connect(hp); hp.connect(lp); lp.connect(out);
      const r = src("brown"), g = ac.createGain(); g.gain.value = .35; r.connect(g); g.connect(out);
      nodes.push(hp, lp, g);
    } else if (amb.kind === "ocean") {
      const s = src("brown"), g = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain(), lp = ac.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 1200;
      g.gain.value = .55; lfo.frequency.value = .085; depth.gain.value = .45;
      lfo.connect(depth); depth.connect(g.gain); lfo.start();
      s.connect(lp); lp.connect(g); g.connect(out);
      nodes.push(g, lfo, depth, lp);
    } else src(amb.kind).connect(out);
  }
  const isRunning = () => document.body.classList.contains("running");
  function applySound() {
    const want = amb.kind !== "off" && (!amb.onlyRunning || isRunning());
    if (want && !nodes.length) startSound();
    else if (!want && nodes.length) stopSound();
    $("ambBtn").classList.toggle("on", amb.kind !== "off");
  }
  new MutationObserver(applySound).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  const util = document.querySelector(".util");
  const ambBtn = document.createElement("button");
  ambBtn.className = "round toggle"; ambBtn.id = "ambBtn"; ambBtn.title = "Focus sounds";
  ambBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>`;
  util.insertBefore(ambBtn, $("sound"));
  const pop = document.createElement("div");
  pop.className = "amb-pop"; pop.id = "ambPop"; pop.hidden = true;
  document.body.appendChild(pop);
  function renderPop() {
    pop.innerHTML = `<div class="amb-title">Focus sounds</div>
      <div class="amb-chips">${SOUNDS.map(([k, l]) => `<button class="chip${amb.kind === k ? " on" : ""}" data-k="${k}">${l}</button>`).join("")}</div>
      <label class="amb-row">Volume<input type="range" id="ambVol" min="0" max="1" step=".02" value="${amb.vol}"></label>
      <label class="amb-row chk"><input type="checkbox" id="ambOnly" ${amb.onlyRunning ? "checked" : ""}> Only while the timer runs</label>
      <p class="amb-note">Made on your device, so they work offline. Phones may pause them when the screen locks.</p>`;
  }
  ambBtn.onclick = e => {
    e.stopPropagation();
    if (!pop.hidden) { pop.hidden = true; return; }
    renderPop();
    const r = ambBtn.getBoundingClientRect();
    pop.hidden = false;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left + r.width / 2 - pop.offsetWidth / 2)) + "px";
    pop.style.top = (r.top - pop.offsetHeight - 12) + "px";
  };
  pop.addEventListener("click", e => {
    e.stopPropagation();
    const c = e.target.closest("[data-k]");
    if (c) {
      amb.kind = c.dataset.k; set("ambient", amb);
      pop.querySelectorAll("[data-k]").forEach(b => b.classList.toggle("on", b === c));
      stopSound();
      if (amb.kind !== "off" && amb.onlyRunning && !isRunning()) { startSound(); setTimeout(applySound, 2500); }   // short preview
      applySound();
    }
  });
  pop.addEventListener("input", e => {
    if (e.target.id === "ambVol") { amb.vol = +e.target.value; if (out) out.gain.value = amb.vol * amb.vol; set("ambient", amb); }
    if (e.target.id === "ambOnly") { amb.onlyRunning = e.target.checked; set("ambient", amb); applySound(); }
  });
  document.addEventListener("click", e => { if (!pop.hidden && !pop.contains(e.target) && e.target !== ambBtn) pop.hidden = true; });
  applySound();

  // ================= Year tab: heatmap, monthly recap, reminders =================
  const sec = $("tab-year");
  const dayTotal = (h, k) => +((h[k] || {}).f || 0);
  function renderYear() {
    const h = ST.getHistory();
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const end = new Date(today); end.setDate(end.getDate() + (6 - (end.getDay() + 6) % 7));     // Sunday this week
    const start = new Date(end); start.setDate(start.getDate() - 7 * 53 + 1);                     // Monday 53 weeks ago
    const cells = [], months = [];
    let tot = 0, best = null, active = 0, lastMonth = -1;
    for (let d = new Date(start), i = 0; d <= end; d.setDate(d.getDate() + 1), i++) {
      const k = dk(d), s = d > today ? -1 : dayTotal(h, k);
      if (s > 0) { tot += s; active++; if (!best || s > best.s) best = { k, s }; }
      if (d.getDate() <= 7 && d.getDay() === 1 && d.getMonth() !== lastMonth) { months.push([Math.floor(i / 7), MONTHS[d.getMonth()].slice(0, 3)]); lastMonth = d.getMonth(); }
      const lv = s < 0 ? -1 : s === 0 ? 0 : s < 3600 ? 1 : s < 7200 ? 2 : s < 4 * 3600 ? 3 : s < 6 * 3600 ? 4 : 5;
      cells.push(`<i class="l${lv}" title="${k}: ${s > 0 ? fmtH(s) : "no study"}"></i>`);
    }
    // streaks (days with any focus time)
    let cur = 0, longest = 0, run = 0;
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      if (dayTotal(h, dk(d)) > 0) { run++; longest = Math.max(longest, run); } else run = 0;
    }
    for (let d = new Date(today); dayTotal(h, dk(d)) > 0 || dk(d) === dk(today); d.setDate(d.getDate() - 1)) { if (dayTotal(h, dk(d)) > 0) cur++; else if (dk(d) !== dk(today)) break; if (cur > 400) break; }
    // months with data, newest first
    const ms = new Set();
    for (const k in h) if (dayTotal(h, k) > 0) ms.add(k.slice(0, 7));
    ms.add(dk(today).slice(0, 7));
    const monthOpts = [...ms].sort().reverse().map(m => `<option value="${m}">${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</option>`).join("");
    const rem = Object.assign({ days: [0, 1, 2, 3, 4], time: "09:00", mins: 30 }, get("reminders", {}));
    sec.innerHTML = `
      <div class="yr-stats">
        <div><b>${fmtH(tot)}</b><span>last 12 months</span></div>
        <div><b>${active}</b><span>study days</span></div>
        <div><b>${cur}</b><span>day streak</span></div>
        <div><b>${longest}</b><span>longest streak</span></div>
        <div><b>${best ? fmtH(best.s) : "—"}</b><span>${best ? "best day · " + kd(best.k).getDate() + " " + MONTHS[kd(best.k).getMonth()].slice(0, 3) : "best day"}</span></div>
      </div>
      <div class="heat-wrap"><div class="heat-months">${months.map(([c, l]) => `<span style="grid-column:${c + 1}">${l}</span>`).join("")}</div>
        <div class="heat-body"><div class="heat-days"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span></span></div>
        <div class="heat">${cells.join("")}</div></div>
        <div class="heat-legend">less <i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><i class="l5"></i> more</div></div>

      <h3 class="yr-h">Monthly recap</h3>
      <div class="yr-row"><select id="recapMonth">${monthOpts}</select><button class="btn go" id="recapMake">Make recap card</button></div>

      <h3 class="yr-h">Study reminders</h3>
      <p class="help">Adds a repeating event to your phone's calendar, which alerts you even when this app is closed.</p>
      <div class="rem-days">${DAYS.map((d, i) => `<button class="chip${rem.days.includes(i) ? " on" : ""}" data-day="${i}">${d}</button>`).join("")}</div>
      <div class="yr-row"><label>At <input type="time" id="remTime" value="${rem.time}"></label>
        <label>for <select id="remMins">${[25, 30, 45, 60, 90, 120].map(m => `<option value="${m}" ${m === rem.mins ? "selected" : ""}>${m < 60 ? m + " min" : m / 60 + " h"}</option>`).join("")}</select></label></div>
      <div class="yr-row"><button class="btn go" id="remGoogle">Add to Google Calendar</button><button class="btn" id="remIcs">Apple / other calendar (.ics)</button></div>`;
    const hw = sec.querySelector(".heat-wrap"); if (hw) hw.scrollLeft = hw.scrollWidth;   // show the most recent weeks first
  }
  sec.addEventListener("click", e => {
    const d = e.target.closest("[data-day]");
    if (d) {
      const rem = Object.assign({ days: [0, 1, 2, 3, 4], time: "09:00", mins: 30 }, get("reminders", {}));
      const i = +d.dataset.day;
      rem.days = rem.days.includes(i) ? rem.days.filter(x => x !== i) : rem.days.concat(i).sort();
      set("reminders", rem); d.classList.toggle("on");
    }
    if (e.target.id === "recapMake") makeRecap($("recapMonth").value);
    if (e.target.id === "remGoogle" || e.target.id === "remIcs") addReminder(e.target.id === "remGoogle");
  });
  sec.addEventListener("change", e => {
    if (e.target.id === "remTime" || e.target.id === "remMins") {
      const rem = Object.assign({ days: [0, 1, 2, 3, 4], time: "09:00", mins: 30 }, get("reminders", {}));
      rem.time = $("remTime").value || "09:00"; rem.mins = +$("remMins").value; set("reminders", rem);
    }
  });
  window.Extras = { renderYear };

  // ---------- calendar reminders ----------
  const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  function addReminder(google) {
    const rem = Object.assign({ days: [0, 1, 2, 3, 4], time: "09:00", mins: 30 }, get("reminders", {}));
    if (!rem.days.length) { ST.toast("Pick at least one day", "#eb8c6a"); return; }
    const [hh, mm] = rem.time.split(":").map(Number);
    const first = new Date(); first.setHours(hh, mm, 0, 0);
    while (!rem.days.includes((first.getDay() + 6) % 7) || first < new Date()) first.setDate(first.getDate() + 1);
    const endT = new Date(first.getTime() + rem.mins * 60000);
    const stamp = d => d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "T" + pad(d.getHours()) + pad(d.getMinutes()) + "00";
    const rule = "FREQ=WEEKLY;BYDAY=" + rem.days.map(i => BYDAY[i]).join(",");
    const url = location.origin + location.pathname;
    const title = "Study time", details = "Open your Study Timer: " + url;
    if (google) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const q = new URLSearchParams({ action: "TEMPLATE", text: title, dates: stamp(first) + "/" + stamp(endT), details, recur: "RRULE:" + rule, ctz: tz });
      window.open("https://calendar.google.com/calendar/render?" + q.toString(), "_blank");
      return;
    }
    const now = new Date();
    const utc = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Study Timer//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
      "UID:study-timer-" + now.getTime() + "@study-timer", "DTSTAMP:" + utc, "DTSTART:" + stamp(first), "DTEND:" + stamp(endT),
      "RRULE:" + rule, "SUMMARY:" + title, "DESCRIPTION:" + details, "URL:" + url,
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Time to study", "TRIGGER:-PT0M", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "study-reminders.ics";
    document.body.appendChild(a); a.click(); a.remove();
    ST.toast("Open the downloaded file to add it to your calendar", "#6fcf97");
  }

  // ---------- monthly recap card ----------
  function makeRecap(month) {
    const h = ST.getHistory(), subs = ST.getSubjects();
    const y = +month.slice(0, 4), m = +month.slice(5) - 1;
    const first = new Date(y, m, 1, 12), last = new Date(y, m + 1, 0, 12), days = last.getDate();
    let tot = 0, sessions = 0, active = 0, best = null;
    const by = {}, perDay = [];
    for (let i = 1; i <= days; i++) {
      const k = month + "-" + pad(i), r = h[k] || {}, f = +r.f || 0;
      perDay.push(f); tot += f; sessions += +r.s || 0;
      if (f > 0) active++;
      if (f > 0 && (!best || f > best.f)) best = { i, f };
      for (const sid in (r.by || {})) by[sid] = (by[sid] || 0) + (+r.by[sid] || 0);
    }
    const emp = window.Empire && window.Empire.summary ? window.Empire.summary(dk(first), dk(last)) : null;
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1350;
    const g = c.getContext("2d");
    const bg = g.createLinearGradient(0, 0, 0, 1350); bg.addColorStop(0, "#141313"); bg.addColorStop(1, "#050505");
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    const accent = emp ? emp.color : "#e2b43c";
    const glow = g.createRadialGradient(540, 330, 10, 540, 330, 520); glow.addColorStop(0, accent + "33"); glow.addColorStop(1, "transparent");
    g.fillStyle = glow; g.fillRect(0, 0, 1080, 800);
    g.textAlign = "left"; g.fillStyle = "#8d8a8c"; g.font = "600 34px Inter, sans-serif";
    g.fillText("MONTHLY RECAP", 80, 120);
    g.fillStyle = "#f3f1f2"; g.font = "800 84px Inter, sans-serif";
    g.fillText(MONTHS[m] + " " + y, 80, 210);
    g.fillStyle = accent; g.font = "800 190px Inter, sans-serif";
    g.fillText(fmtH(tot).replace(" ", ""), 72, 420);
    g.fillStyle = "#a5a2a4"; g.font = "500 36px Inter, sans-serif";
    g.fillText(`of focus · ${sessions} sessions · ${active} study days`, 80, 480);
    // subjects
    let yy = 570;
    const rows = Object.entries(by).filter(([, s]) => s >= 60).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxS = rows.length ? rows[0][1] : 1;
    for (const [sid, s] of rows) {
      const sub = subs[sid], col = sub ? sub.color : "#888";
      g.fillStyle = "#e6e3e5"; g.font = "600 36px Inter, sans-serif"; g.fillText(sub ? sub.name : "Other", 80, yy);
      g.textAlign = "right"; g.fillStyle = "#a5a2a4"; g.fillText(fmtH(s), 1000, yy); g.textAlign = "left";
      g.fillStyle = "rgba(255,255,255,.08)"; round(g, 80, yy + 18, 920, 16, 8); g.fill();
      g.fillStyle = col; round(g, 80, yy + 18, Math.max(16, 920 * s / maxS), 16, 8); g.fill();
      yy += 92;
    }
    // calendar strip
    yy = Math.max(yy + 20, 900);
    const cw = 920 / 31, mx = Math.max(1, ...perDay);
    perDay.forEach((f, i) => {
      g.fillStyle = f > 0 ? accent : "rgba(255,255,255,.07)"; g.globalAlpha = f > 0 ? .25 + .75 * f / mx : 1;
      round(g, 80 + i * cw, yy, cw - 6, 90, 6); g.fill(); g.globalAlpha = 1;
    });
    g.fillStyle = "#8d8a8c"; g.font = "500 28px Inter, sans-serif";
    g.fillText(best ? `Best day: ${best.i} ${MONTHS[m].slice(0, 3)} — ${fmtH(best.f)}` : "No study logged this month", 80, yy + 140);
    // empire
    if (emp) {
      g.fillStyle = "rgba(255,255,255,.06)"; round(g, 80, 1130, 920, 130, 24); g.fill();
      g.fillStyle = accent; g.beginPath(); g.arc(140, 1195, 18, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f3f1f2"; g.font = "700 38px Inter, sans-serif"; g.fillText(`${emp.rank} of ${emp.name}`, 180, 1185);
      g.fillStyle = "#a5a2a4"; g.font = "500 30px Inter, sans-serif";
      const won = emp.wars.filter(w => w.won).length;
      g.fillText(`${emp.era} · ${emp.provinces} provinces${emp.gained != null ? ` (${emp.gained >= 0 ? "+" : ""}${emp.gained} this month)` : ""}${emp.wars.length ? ` · ${won}/${emp.wars.length} wars won` : ""}`, 180, 1230);
    }
    g.fillStyle = "#4a4849"; g.font = "500 26px Inter, sans-serif"; g.fillText("Study Timer", 80, 1310);
    showRecap(c, MONTHS[m] + "-" + y);
  }
  function round(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function showRecap(c, name) {
    let ov = $("recapOv");
    if (!ov) { ov = document.createElement("div"); ov.id = "recapOv"; ov.className = "recap-ov"; document.body.appendChild(ov); }
    const url = c.toDataURL("image/png");
    ov.innerHTML = `<div class="recap-box"><img src="${url}" alt="Monthly recap"><div class="yr-row">
      <button class="btn" id="rcClose">Close</button>${navigator.canShare ? `<button class="btn" id="rcShare">Share</button>` : ""}<button class="btn go" id="rcSave">Save image</button></div></div>`;
    ov.hidden = false;
    ov.onclick = async e => {
      if (e.target === ov || e.target.id === "rcClose") ov.hidden = true;
      if (e.target.id === "rcSave") { const a = document.createElement("a"); a.href = url; a.download = "study-recap-" + name.toLowerCase() + ".png"; document.body.appendChild(a); a.click(); a.remove(); }
      if (e.target.id === "rcShare") {
        c.toBlob(async b => { const f = new File([b], "study-recap.png", { type: "image/png" }); try { if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: "My study month" }); } catch (err) {} });
      }
    };
  }
})();

// ================= "How everything works" guide (timer) =================
(() => {
  const ST = window.StudyTimer, $ = id => document.getElementById(id);
  if (!ST || !$("syncNote")) return;
  const b = document.createElement("button");
  b.className = "linkish guide-link"; b.id = "guideBtn"; b.textContent = "How everything works";
  $("syncNote").before(b);
  const ov = document.createElement("div"); ov.className = "recap-ov"; ov.id = "guideOv"; ov.hidden = true;
  ov.innerHTML = `<div class="guide">
    <h2>How everything works</h2>
    <h3>The timer</h3>
    <ul>
      <li><b>Pick a subject</b> above the clock, then press Start. Focus time is logged to that subject. Subjects with skills (e.g. English) show each skill in the menu — pick one, like <i>English · Writing</i>.</li>
      <li><b>Focus / Short break / Long break</b> switch automatically after each session; the loop button starts the next one by itself.</li>
      <li><b>Focus sounds</b> (headphones): rain, ocean or noise, made on your device. By default they only play while the timer runs.</li>
      <li>While a session runs the controls fade away — move the mouse or tap to bring them back.</li>
    </ul>
    <h3>Progress panel (bar-chart button)</h3>
    <ul>
      <li><b>This week</b>: hours per subject against your weekly targets, per skill too. <b>Log time manually</b> adds study you did away from the timer.</li>
      <li><b>History</b> and <b>Notes</b>: past days and the notes you wrote after sessions.</li>
      <li><b>Subjects</b>: add or remove subjects, set a weekly target, an exam date, skills, and the subject's <b>role in your empire</b>.</li>
      <li><b>Year</b>: a 12-month heatmap and streaks, a <b>monthly recap card</b> to save or share, and <b>study reminders</b> you add to your phone's calendar.</li>
    </ul>
    <h3>Your empire (castle button)</h3>
    <ul>
      <li>Every focus minute becomes gold and subject points to grow a kingdom on a map. Weekly targets defend your borders, exam dates start wars, and total hours move you through history. Open it and tap <b>?</b> for the full rules.</li>
    </ul>
    <h3>Your data</h3>
    <ul>
      <li><b>Sign in</b> (bottom of this panel) with Google or email to have the same hours, subjects, notes and empire on every device.</li>
      <li>Without signing in, everything stays on this device; <b>Save / Load backup file</b> moves it by hand.</li>
      <li><b>Import old data</b> brings hours and notes from the old claude.ai link or the Study Timer file on your Desktop — it's merged in, never counted twice.</li>
      <li>Add the page to your home screen to use it like an app; it keeps working offline.</li>
    </ul>
    <h3>Keyboard</h3>
    <p class="keys">Space start/pause · ↑ ↓ ±1 min · S skip · R reset · 1 2 3 modes · H progress · L log time · N notes · E empire · F fullscreen · M mute</p>
    <div class="yr-row" style="justify-content:flex-end"><button class="btn go" id="guideClose">Got it</button></div>
  </div>`;
  document.body.appendChild(ov);
  b.onclick = () => { ov.hidden = false; };
  ov.onclick = e => { if (e.target === ov || e.target.id === "guideClose") ov.hidden = true; };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !ov.hidden) { ov.hidden = true; e.stopPropagation(); } }, true);
})();
