// Study tools: flashcards with spaced repetition, a weekly plan (with "next up"), and an exam overview.
// Cards and plan are saved on the device and, when signed in, synced to the account (newest version wins).
(() => {
  "use strict";
  const ST = window.StudyTimer;
  if (!ST) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const dk = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const kd = k => new Date(k + "T12:00:00");
  const todayK = () => dk(new Date());
  const addDays = (k, n) => { const d = kd(k); d.setDate(d.getDate() + n); return dk(d); };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const shortDate = k => { const d = kd(k); return d.getDate() + " " + MONTHS[d.getMonth()]; };
  const fmtM = m => { m = Math.round(m); return m < 60 ? m + "m" : Math.floor(m / 60) + "h" + (m % 60 ? pad(m % 60) : ""); };
  const subs = () => ST.activeSubjects();
  const subj = id => ST.getSubjects()[id];
  const weekday = (k = todayK()) => (kd(k).getDay() + 6) % 7;

  // ---------- synced local documents ----------
  function doc(name, empty) {
    let v;
    try { v = JSON.parse(localStorage.getItem("studyTimer." + name)); } catch (e) {}
    const d = { name, data: v && v.data ? v.data : empty(), updated: v && v.updated || 0 };
    d.save = () => {
      d.updated = Date.now();
      try { localStorage.setItem("studyTimer." + name, JSON.stringify({ data: d.data, updated: d.updated })); } catch (e) {}
      ST.pushDoc && ST.pushDoc(name, { json: JSON.stringify(d.data), updated: d.updated });
    };
    return d;
  }
  const cards = doc("cards", () => ({ list: [] }));
  const plan = doc("plan", () => ({ days: [[], [], [], [], [], [], []] }));
  window.addEventListener("studytimer:docs", e => {
    const { docs, fromCache } = e.detail;
    for (const d of [cards, plan]) {
      const r = docs[d.name];
      if (r && +r.updated > d.updated) {
        try { d.data = JSON.parse(r.json); d.updated = +r.updated; localStorage.setItem("studyTimer." + d.name, JSON.stringify({ data: d.data, updated: d.updated })); } catch (err) {}
      } else if (!fromCache && d.updated > (r ? +r.updated || 0 : 0)) {
        ST.pushDoc(d.name, { json: JSON.stringify(d.data), updated: d.updated });
      }
    }
    refresh();
  });

  // ================= flashcards (spaced repetition) =================
  const due = () => cards.data.list.filter(c => c.due <= todayK());
  function schedule(c, grade) {          // grade 0 again, 1 hard, 2 good, 3 easy
    const iv = c.iv || 0, ease = c.ease || 2.5, reps = c.reps || 0;
    let n = iv, e = ease, r = reps + 1;
    if (grade === 0) { n = 0; e = Math.max(1.3, ease - .2); r = 0; }
    else if (grade === 1) { n = Math.max(1, Math.round(iv * 1.2)); e = Math.max(1.3, ease - .15); }
    else if (grade === 2) { n = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(iv * ease); }
    else { n = reps === 0 ? 3 : Math.round(Math.max(iv, 1) * ease * 1.3); e = ease + .15; }
    return { iv: Math.min(n, 365), ease: e, reps: r };
  }
  const ivLabel = n => n === 0 ? "again today" : n === 1 ? "1 day" : n < 30 ? n + " days" : Math.round(n / 30) + " mo";
  function addCard(sid, front, back) {
    cards.data.list.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), sid, front: front.slice(0, 300), back: back.slice(0, 600), due: todayK(), iv: 0, ease: 2.5, reps: 0, created: todayK() });
    cards.save();
  }
  function subjOptions(sel) {
    return subs().map(([id, s]) => `<option value="${esc(id)}" ${id === sel ? "selected" : ""}>${esc(s.name)}</option>`).join("") + `<option value="" ${!sel ? "selected" : ""}>No subject</option>`;
  }
  function recentNotes() {
    const out = [], h = ST.getNotes ? ST.getNotes() : {};
    for (const k of Object.keys(h).sort().reverse()) for (const n of (h[k] || []).slice().reverse()) { out.push(Object.assign({ day: k }, n)); if (out.length >= 15) return out; }
    return out;
  }
  let cardFilter = "";
  function renderCards() {
    const sec = $("tab-cards"); if (!sec) return;
    const list = cards.data.list, d = due();
    const bySubj = {};
    list.forEach(c => { (bySubj[c.sid || ""] = bySubj[c.sid || ""] || []).push(c); });
    const shown = list.filter(c => !cardFilter || (c.front + " " + c.back).toLowerCase().includes(cardFilter.toLowerCase())).slice(-60).reverse();
    const notes = recentNotes();
    sec.innerHTML = `
      <div class="cards-head">
        <div><b>${list.length}</b> card${list.length === 1 ? "" : "s"} · <b>${d.length}</b> due today</div>
        <button class="btn go" id="cardReview" ${d.length ? "" : "disabled"}>Review ${d.length || ""}</button>
      </div>
      <p class="help">Each card comes back just before you'd forget it — sooner if you got it wrong, later if it was easy. Review time counts as study time for the card's subject.</p>
      <div class="card-form">
        <select id="cardSubj">${subjOptions(ST.currentSubject())}</select>
        <input type="text" id="cardFront" placeholder="Question / front" maxlength="300">
        <textarea id="cardBack" rows="2" placeholder="Answer / back" maxlength="600"></textarea>
        <button class="btn go" id="cardAdd">Add card</button>
      </div>
      ${notes.length ? `<details class="card-notes"><summary>Make cards from your session notes</summary>
        ${notes.map((n, i) => `<div class="cn-row"><span><small>${shortDate(n.day)} · ${esc((subj(n.sid) || {}).name || "")}</small>${esc(n.t)}</span><button class="btn" data-note="${i}">+ card</button></div>`).join("")}
        <p class="help">Tip: write a note like <i>offer :: a proposal that can be accepted</i> and both sides are filled in for you.</p></details>` : ""}
      <div class="yr-row"><input type="search" id="cardSearch" placeholder="Search cards…" value="${esc(cardFilter)}"></div>
      <div class="card-list">${shown.map(c => `<div class="cl-row"><i style="background:${(subj(c.sid) || {}).color || "#888"}"></i>
        <span><b>${esc(c.front)}</b><small>${esc(c.back)}</small></span>
        <em>${c.due <= todayK() ? "due" : shortDate(c.due)}</em><button class="linkish" data-del="${esc(c.id)}">delete</button></div>`).join("") || `<div class="empty">No cards yet — add your first one above.</div>`}</div>`;
    sec._notes = notes;
  }
  document.addEventListener("click", e => {
    const sec = $("tab-cards"); if (!sec || !sec.contains(e.target)) return;
    if (e.target.id === "cardAdd") {
      const f = $("cardFront").value.trim(), b = $("cardBack").value.trim();
      if (!f || !b) { ST.toast("Fill in both sides", "#eb8c6a"); return; }
      addCard($("cardSubj").value, f, b); renderCards(); ST.toast("Card added", "#6fcf97");
      setTimeout(() => $("cardFront") && $("cardFront").focus(), 0);
    }
    if (e.target.id === "cardReview") startReview();
    const n = e.target.closest("[data-note]");
    if (n) {
      const note = sec._notes[+n.dataset.note], parts = note.t.split("::");
      $("cardSubj").value = note.sid || "";
      $("cardFront").value = parts.length > 1 ? parts[0].trim() : "";
      $("cardBack").value = (parts.length > 1 ? parts.slice(1).join("::") : note.t).trim();
      $("cardFront").focus(); $("cardFront").scrollIntoView({ block: "center", behavior: "smooth" });
    }
    const del = e.target.closest("[data-del]");
    if (del && confirm("Delete this card?")) { cards.data.list = cards.data.list.filter(c => c.id !== del.dataset.del); cards.save(); renderCards(); }
  });
  document.addEventListener("input", e => { if (e.target.id === "cardSearch") { cardFilter = e.target.value; const pos = e.target.selectionStart; renderCards(); const s = $("cardSearch"); s.focus(); s.setSelectionRange(pos, pos); } });

  // review session
  const rv = document.createElement("div"); rv.className = "recap-ov review"; rv.hidden = true; document.body.appendChild(rv);
  let queue = [], cur = null, shownAt = 0, spent = {}, count = 0;
  function startReview() {
    queue = due().sort(() => Math.random() - .5); spent = {}; count = 0;
    ST.closePanel && ST.closePanel();
    rv.hidden = false; next();
  }
  function next() {
    cur = queue.shift();
    if (!cur) return finishReview();
    shownAt = Date.now();
    const s = subj(cur.sid);
    rv.innerHTML = `<div class="rv-card"><div class="rv-top"><span><i style="background:${s ? s.color : "#888"}"></i>${esc(s ? s.name : "")}</span><span>${queue.length + 1} left</span><button class="linkish" data-rvx>end</button></div>
      <div class="rv-front">${esc(cur.front)}</div><div class="rv-back" hidden>${esc(cur.back)}</div>
      <div class="rv-actions"><button class="btn go" data-show>Show answer <small>space</small></button></div></div>`;
  }
  function reveal() {
    if (!cur || !rv.querySelector(".rv-back").hidden) return;
    rv.querySelector(".rv-back").hidden = false;
    rv.querySelector(".rv-actions").innerHTML = ["Again", "Hard", "Good", "Easy"].map((l, g) =>
      `<button class="btn g${g}" data-grade="${g}">${l}<small>${ivLabel(schedule(cur, g).iv)} · ${g + 1}</small></button>`).join("");
  }
  function grade(g) {
    if (!cur) return;
    const secs = Math.min(120, (Date.now() - shownAt) / 1000);
    spent[cur.sid || ""] = (spent[cur.sid || ""] || 0) + secs;
    const live = cards.data.list.find(c => c.id === cur.id);
    if (live) { Object.assign(live, schedule(cur, g)); live.due = addDays(todayK(), live.iv); }
    if (g === 0) queue.push(live || cur);
    count++;
    cards.save();
    next();
  }
  function finishReview() {
    let logged = 0;
    for (const sid in spent) if (spent[sid] >= 20) { ST.logStudy(sid || null, spent[sid]); logged += spent[sid]; }
    cur = null;
    rv.innerHTML = `<div class="rv-card"><div class="rv-front">${count ? "Nice work" : "All done"}</div>
      <p class="onb-p" style="text-align:center">${count} card${count === 1 ? "" : "s"} reviewed${logged >= 60 ? ` · ${fmtM(logged / 60)} added to your study time` : ""}.</p>
      <div class="rv-actions"><button class="btn go" data-rvx>Close</button></div></div>`;
    spent = {};
  }
  rv.addEventListener("click", e => {
    if (e.target.closest("[data-show]")) reveal();
    const g = e.target.closest("[data-grade]"); if (g) grade(+g.dataset.grade);
    if (e.target.closest("[data-rvx]")) { if (cur) { queue = []; finishReview(); } else { rv.hidden = true; refresh(); } }
  });
  document.addEventListener("keydown", e => {
    if (rv.hidden) return;
    e.stopPropagation(); e.preventDefault();
    if (e.key === " " || e.key === "Enter") { if (cur && rv.querySelector(".rv-back").hidden) reveal(); else if (!cur) { rv.hidden = true; refresh(); } }
    else if (/^[1-4]$/.test(e.key) && cur && !rv.querySelector(".rv-back").hidden) grade(+e.key - 1);
    else if (e.key === "Escape") { if (cur) { queue = []; finishReview(); } else rv.hidden = true; }
  }, true);

  // ================= weekly plan =================
  const planDay = (k = todayK()) => (plan.data.days[weekday(k)] || []).filter(x => subj(x.sid) && !subj(x.sid).archived);
  function nextUp() {
    for (const x of planDay()) {
      const left = x.mins - ST.todaySecs(x.sid) / 60;
      if (left >= 5) return { sid: x.sid, left };
    }
    return null;
  }
  function autoPlan() {
    const days = [[], [], [], [], [], [], []];
    for (const [id, s] of subs()) {
      if (!(s.target > 0)) continue;
      const per = Math.round(s.target * 60 / 6 / 15) * 15;    // spread over 6 days, Sunday light
      for (let d = 0; d < 7; d++) {
        const m = d === 6 ? Math.max(0, Math.round((s.target * 60 - per * 6) / 15) * 15) : per;
        if (m > 0) days[d].push({ sid: id, mins: m });
      }
    }
    plan.data.days = days; plan.save(); renderPlan();
  }
  function renderPlan() {
    const sec = $("tab-plan"); if (!sec) return;
    const wd = weekday(), nu = nextUp();
    const tot = d => (plan.data.days[d] || []).reduce((a, x) => a + x.mins, 0);
    sec.innerHTML = `
      ${nu ? `<div class="plan-next"><span>Next up</span><b>${esc(subj(nu.sid).name)}</b><em>${fmtM(nu.left)} left today</em><button class="btn go" data-start="${esc(nu.sid)}">Select</button></div>`
        : planDay().length ? `<div class="plan-next done"><span>Today's plan</span><b>All done ✓</b></div>` : ""}
      <p class="help">Your plan repeats every week. The timer shows what's next, and your empire's daily decrees follow today's plan.</p>
      <div class="yr-row"><button class="btn" id="planAuto">Fill from weekly targets</button><button class="btn" id="planClear">Clear</button></div>
      <div class="plan-days">${DAYS.map((name, d) => `<div class="plan-day${d === wd ? " today" : ""}">
        <div class="pd-head"><b>${name}${d === wd ? " · today" : ""}</b><small>${tot(d) ? fmtM(tot(d)) : ""}</small></div>
        <div class="pd-items">${(plan.data.days[d] || []).map((x, i) => { const s = subj(x.sid); if (!s) return "";
          const done = d === wd ? ST.todaySecs(x.sid) / 60 : 0;
          return `<span class="pd-chip${d === wd && done >= x.mins ? " ok" : ""}"><i style="background:${s.color}"></i>${esc(s.name)} ${d === wd ? fmtM(Math.min(done, x.mins)) + "/" : ""}${fmtM(x.mins)}<button data-rm="${d}:${i}" title="Remove">×</button></span>`; }).join("")}
          <span class="pd-add"><select data-addsub="${d}"><option value="">+ add</option>${subs().map(([id, s]) => `<option value="${esc(id)}">${esc(s.name)}</option>`).join("")}</select></span></div></div>`).join("")}</div>
      <h3 class="yr-h">Exams</h3>${renderExams()}`;
  }
  function renderExams() {
    const rows = [];
    for (const [id, s] of subs()) {
      const x = ST.examInfo(id); if (!x) continue;
      // recent pace: hours per week over the last 14 days
      const h = ST.getHistory(); let rec = 0;
      for (let i = 0; i < 14; i++) { const r = h[addDays(todayK(), -i)]; if (r && r.by) rec += +r.by[id] || 0; }
      const pace = rec / 3600 / 2;
      let verdict, cls;
      if (!x.goal) { verdict = `Set "hours before exam" in Subjects for a verdict`; cls = ""; }
      else if (x.done >= x.goal) { verdict = "Goal reached ✓"; cls = "ok"; }
      else if (pace >= x.suggest) { verdict = `On track — you do ${pace.toFixed(1)}h/week, need ${x.suggest}h`; cls = "ok"; }
      else { verdict = `Behind — need ${x.suggest}h/week, you're doing ${pace.toFixed(1)}h`; cls = "bad"; }
      rows.push([x.days, `<div class="ex-row"><div class="ex-days ${x.days <= 14 ? "soon" : ""}"><b>${x.days}</b><small>day${x.days === 1 ? "" : "s"}</small></div>
        <div class="ex-mid"><div><i style="background:${s.color}"></i><b>${esc(s.name)}</b> · ${shortDate(s.exam)}</div>
        ${x.goal ? `<div class="track"><div style="width:${Math.min(100, x.done / x.goal * 100)}%;background:${s.color}"></div></div><small>${(x.done / 3600).toFixed(1)} of ${x.goal / 3600}h studied</small>` : ""}
        <div class="ex-v ${cls}">${verdict}</div></div></div>`]);
    }
    rows.sort((a, b) => a[0] - b[0]);
    return rows.map(r => r[1]).join("") || `<p class="help">No upcoming exams. Add exam dates in Subjects to see a countdown here.</p>`;
  }
  document.addEventListener("click", e => {
    const sec = $("tab-plan"); if (!sec || !sec.contains(e.target)) return;
    if (e.target.id === "planAuto") { if (!plan.data.days.some(d => d.length) || confirm("Replace your plan with one built from your weekly targets?")) autoPlan(); }
    if (e.target.id === "planClear" && confirm("Clear the whole plan?")) { plan.data.days = [[], [], [], [], [], [], []]; plan.save(); renderPlan(); }
    const rm = e.target.closest("[data-rm]");
    if (rm) { const [d, i] = rm.dataset.rm.split(":").map(Number); plan.data.days[d].splice(i, 1); plan.save(); renderPlan(); }
    const st = e.target.closest("[data-start]");
    if (st) { ST.setSubject(st.dataset.start); ST.closePanel(); }
  });
  document.addEventListener("change", e => {
    const a = e.target.closest("[data-addsub]"); if (!a || !a.value) return;
    const d = +a.dataset.addsub, sid = a.value;
    const raw = prompt(`How long for ${subj(sid).name} on ${DAYS[d]}? (minutes like 45, or hours like 1.5h)`, "60") || "";
    const m = parseFloat(raw.replace(",", "."));
    if (m > 0) {
      const mins = /h/i.test(raw) || m <= 12 ? m * 60 : m;
      const ex = plan.data.days[d].find(x => x.sid === sid);
      if (ex) ex.mins += Math.round(mins); else plan.data.days[d].push({ sid, mins: Math.round(mins) });
      plan.save();
    }
    renderPlan();
  });

  // "next up" on the timer screen
  function renderNext() {
    let el = $("planNext");
    const below = document.querySelector(".below");
    if (!el && below) { el = document.createElement("div"); el.id = "planNext"; el.className = "emp-strip link plan-strip"; below.appendChild(el); }
    if (!el) return;
    const nu = nextUp();
    el.hidden = !nu || nu.sid === ST.currentSubject();
    if (nu) el.innerHTML = `Next up: <b>${esc(subj(nu.sid).name)}</b> · ${fmtM(nu.left)} left`;
    el.onclick = () => { if (nu) ST.setSubject(nu.sid); };
  }
  function refresh() {
    renderNext();
    const p = $("panel");
    if (p && !p.hidden) { if (!$("tab-plan").hidden) renderPlan(); if (!$("tab-cards").hidden && !$("tab-cards").contains(document.activeElement)) renderCards(); }
  }
  window.addEventListener("studytimer:change", refresh);
  setInterval(renderNext, 60000);
  setTimeout(renderNext, 300);

  window.Tools = {
    renderPlan, renderCards,
    // planned minutes per subject for a given day (used by the empire's daily decrees)
    planFor: k => planDay(k).map(x => ({ sid: x.sid, secs: x.mins * 60 })),
    dueCount: () => due().length,
  };
})();
