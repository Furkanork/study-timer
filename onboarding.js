// Welcome flow for new users, and importing data from older versions of the timer.
(() => {
  "use strict";
  const ST = window.StudyTimer;
  if (!ST) return;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const get = (k, d) => { try { const v = localStorage.getItem("studyTimer." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem("studyTimer." + k, JSON.stringify(v)); } catch (e) {} };

  const ov = document.createElement("div");
  ov.className = "recap-ov onb"; ov.id = "onbOv"; ov.hidden = true;
  document.body.appendChild(ov);
  let mode = "";
  const show = (html, m) => { mode = m || ""; ov.innerHTML = `<div class="guide onb-card">${html}</div>`; ov.hidden = false; };
  const hide = () => { ov.hidden = true; };

  // ================= welcome =================
  const SUGGEST = ["English", "French", "Spanish", "German", "Turkish", "Math", "Physics", "Chemistry", "Biology", "Medicine",
    "Law", "History", "Literature", "Economics", "Computer science", "Psychology", "Philosophy", "Art"];
  const LANG = /english|french|spanish|german|turkish|italian|dutch|arabic|chinese|japanese|korean|russian|portuguese/i;
  let picks = [];   // { name, skills: bool, target, exam }
  const roleLabel = name => {
    const E = window.Empire; if (!E || !E.ROLES) return "";
    const k = E.guessKind("", name), r = E.ROLES.find(x => x[0] === k);
    return r ? r[2] : "";
  };

  function step1() {
    show(`<div class="onb-step">1 / 3</div>
      <h2>Welcome to Study Timer</h2>
      <p class="onb-p">A focus timer that turns your study hours into a growing empire. Let's set it up in under a minute.</p>
      <ul class="onb-list">
        <li><b>Time your study</b> per subject with a flip-clock timer.</li>
        <li><b>Track your week</b> against targets you choose.</li>
        <li><b>Grow a kingdom</b>: every focus minute is gold, and each subject builds something different.</li>
      </ul>
      <div class="yr-row onb-actions"><button class="btn" data-signin>I already use it — sign in</button><button class="btn go" data-next>Get started</button></div>`, "welcome");
  }
  function step2() {
    const chosen = new Set(picks.map(p => p.name.toLowerCase()));
    show(`<div class="onb-step">2 / 3</div>
      <h2>What are you studying?</h2>
      <p class="onb-p">Tap your subjects, or type your own. You can change everything later in Progress → Subjects.</p>
      <div class="onb-chips">${SUGGEST.map(n => `<button class="chip${chosen.has(n.toLowerCase()) ? " on" : ""}" data-pick="${esc(n)}">${esc(n)}</button>`).join("")}</div>
      <div class="yr-row"><input type="text" id="onbCustom" placeholder="Another subject…" maxlength="40"><button class="btn" data-add>Add</button></div>
      <div class="onb-picked">${picks.map((p, i) => `<div class="onb-row"><b>${esc(p.name)}</b><small>${esc(roleLabel(p.name))}</small>
        ${LANG.test(p.name) ? `<label class="onb-skill"><input type="checkbox" data-skill="${i}" ${p.skills ? "checked" : ""}> Split into Writing · Listening · Reading</label>` : ""}
        <button class="linkish" data-rm="${i}">remove</button></div>`).join("")}</div>
      <div class="yr-row onb-actions"><button class="btn" data-back>Back</button><button class="btn go" data-next ${picks.length ? "" : "disabled"}>Next</button></div>`);
  }
  function step3() {
    show(`<div class="onb-step">3 / 3</div>
      <h2>Weekly targets</h2>
      <p class="onb-p">How many hours a week do you want to spend on each? Your daily tasks, raids and exam campaigns are built on these. An exam date is optional.</p>
      <div class="onb-targets">${picks.map((p, i) => `<div class="onb-trow"><b>${esc(p.name)}</b>
        <label><input type="number" min="0" max="80" step="0.5" value="${p.target}" data-target="${i}"> h / week</label>
        <label>exam <input type="date" value="${p.exam || ""}" data-exam="${i}"></label></div>`).join("")}</div>
      <div class="yr-row onb-actions"><button class="btn" data-back>Back</button><button class="btn go" data-finish>Start studying</button></div>`);
  }
  function finish(openEmpire) {
    picks.forEach(p => ST.createSubject({ name: p.name, target: +p.target || 0, exam: p.exam || "", skills: p.skills ? ["Writing", "Listening", "Reading"] : [] }));
    set("welcomed", true);
    show(`<h2>You're all set</h2>
      <p class="onb-p">Pick a subject above the clock and press <b>Start</b>. Open <b>Progress</b> (bar-chart button) to see your week, and <b>sign in</b> at the bottom of it to keep your data on all your devices.</p>
      <p class="onb-p">Your empire is waiting too — every minute you've studied will be gold to spend.</p>
      <div class="yr-row onb-actions"><button class="btn" data-close>Start the timer</button><button class="btn go" data-empire>Found my empire</button></div>`);
  }
  ov.addEventListener("click", e => {
    const t = e.target;
    if (t.closest("[data-signin]")) { set("welcomed", true); hide(); ST.openPanel("week"); setTimeout(() => { const a = $("acct"); if (a) a.scrollIntoView({ behavior: "smooth", block: "center" }); }, 200); return; }
    if (t.closest("[data-pick]")) {
      const n = t.closest("[data-pick]").dataset.pick, i = picks.findIndex(p => p.name.toLowerCase() === n.toLowerCase());
      if (i >= 0) picks.splice(i, 1); else picks.push({ name: n, skills: LANG.test(n), target: 5, exam: "" });
      step2(); return;
    }
    if (t.closest("[data-add]")) { addCustom(); return; }
    if (t.closest("[data-rm]")) { picks.splice(+t.closest("[data-rm]").dataset.rm, 1); step2(); return; }
    if (t.closest("[data-skill]")) { picks[+t.dataset.skill].skills = t.checked; return; }
    if (t.closest("[data-finish]")) { finish(); return; }
    if (t.closest("[data-close]")) { hide(); return; }
    if (t.closest("[data-empire]")) { hide(); window.Empire && window.Empire.open(); return; }
    if (t.closest("[data-back]")) { ($("onbCustom") ? step1 : step2)(); return; }
    if (t.closest("[data-next]") && !t.closest("[data-next]").disabled) { ($("onbCustom") ? step3 : step2)(); return; }
  });
  ov.addEventListener("input", e => {
    if (e.target.dataset.target != null) picks[+e.target.dataset.target].target = e.target.value;
    if (e.target.dataset.exam != null) picks[+e.target.dataset.exam].exam = e.target.value;
  });
  ov.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "onbCustom") addCustom(); e.stopPropagation(); });
  function addCustom() {
    const v = ($("onbCustom").value || "").trim().slice(0, 40);
    if (v && !picks.some(p => p.name.toLowerCase() === v.toLowerCase())) picks.push({ name: v, skills: LANG.test(v), target: 5, exam: "" });
    step2();
  }

  const noSubjects = () => !Object.values(ST.getSubjects()).some(s => !s.archived);
  if (noSubjects() && !get("welcomed", false)) setTimeout(() => { if (noSubjects()) step1(); }, 600);
  // if they sign in during the welcome and their subjects arrive, close it
  window.addEventListener("studytimer:change", () => { if (!ov.hidden && mode === "welcome" && !noSubjects()) { set("welcomed", true); hide(); } });

  // ================= import old data =================
  function showImport() {
    show(`<h2>Import old data</h2>
      <p class="onb-p">Bring hours, notes and subjects from an older version of the timer into this one. It's merged with what you have — nothing is deleted, and hours already here aren't counted twice.</p>
      <h3>1 · Get your data out of the old version</h3>
      <ul class="onb-list">
        <li><b>Old claude.ai link:</b> open it, open Progress (bar-chart button), scroll down and tap <b>Export for new app</b>.</li>
        <li><b>Study Timer file on your Desktop:</b> download <a href="export-old-data.html" download>this export page</a>, open it <i>in the same browser you used for the Desktop file</i>, and tap Save.</li>
        <li><b>A backup file</b> from this app on another device also works.</li>
      </ul>
      <h3>2 · Bring it in</h3>
      <div class="yr-row"><button class="btn go" data-file>Choose file…</button><input type="file" id="onbFile" accept=".json,application/json,text/plain" hidden></div>
      <p class="onb-p" style="margin-top:10px">…or paste the exported text:</p>
      <textarea id="onbPaste" rows="4" placeholder='{"app":"study-timer", …}'></textarea>
      <div class="onb-msg" id="onbMsg"></div>
      <div class="yr-row onb-actions"><button class="btn" data-close>Close</button><button class="btn go" data-paste>Import pasted text</button></div>`);
    $("onbFile").onchange = async ev => { const f = ev.target.files[0]; if (f) doImport(await f.text()); };
  }
  function doImport(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { $("onbMsg").textContent = "That doesn't look like exported timer data."; return; }
    if (!obj || obj.app !== "study-timer" || typeof obj.data !== "object") { $("onbMsg").textContent = "That doesn't look like exported timer data."; return; }
    const r = ST.importMerge(obj.data);
    $("onbMsg").innerHTML = `<b>Imported.</b> ${r.days} day${r.days === 1 ? "" : "s"} of study, ${r.notes} note${r.notes === 1 ? "" : "s"} and ${r.subjects} subject${r.subjects === 1 ? "" : "s"} added.`
      + (r.days || r.notes || r.subjects ? "" : " (Everything in it was already here.)");
  }
  ov.addEventListener("click", e => {
    if (e.target.closest("[data-file]")) $("onbFile").click();
    if (e.target.closest("[data-paste]")) doImport(($("onbPaste").value || "").trim());
  });
  const mb = $("bkMerge");
  if (mb) mb.onclick = showImport;
  ov.addEventListener("click", e => { if (e.target === ov) hide(); });

  window.Onboarding = { welcome: () => { picks = []; step1(); }, showImport };
})();
