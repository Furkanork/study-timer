// Friends & alliances. Opt-in: you choose a nickname and get a friend code. Your public profile holds only that nickname,
// this week's study hours (total and per subject), your decree streak and a summary of your empire.
// Firestore: profiles/{uid} (readable by signed-in users, writable by the owner), codes/{CODE} → { uid }.
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
  const weekOf = k => { const d = kd(k); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dk(d); };
  const get = (k, d) => { try { const v = localStorage.getItem("studyTimer." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem("studyTimer." + k, JSON.stringify(v)); } catch (e) {} };
  const ALLY_BONUS = 100, AID_COST = 100;

  let FB = window.FB || null;
  let me = null;                    // my profile as stored
  const friends = {};               // uid → profile
  const unsub = {};
  let err = "";
  // my friends list + ally choice live in my private account data (synced like the plan)
  let mine = Object.assign({ friends: [], ally: null, updated: 0 }, get("friends", {}));
  function saveMine() {
    mine.updated = Date.now(); set("friends", mine);
    ST.pushDoc && ST.pushDoc("friends", { json: JSON.stringify({ friends: mine.friends, ally: mine.ally }), updated: mine.updated });
  }
  window.addEventListener("studytimer:docs", e => {
    const r = e.detail.docs.friends;
    if (r && +r.updated > mine.updated) { try { Object.assign(mine, JSON.parse(r.json), { updated: +r.updated }); set("friends", mine); watchAll(); render(); } catch (x) {} }
    else if (!e.detail.fromCache && mine.updated > (r ? +r.updated || 0 : 0)) saveMine();
  });

  // ---------- my public profile ----------
  function weekStats(mon) {
    const h = ST.getHistory(), subs = ST.getSubjects(), by = {};
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const r = h[addDays(mon, i)]; if (!r) continue;
      total += +r.f || 0;
      for (const sid in (r.by || {})) if (subs[sid]) by[subs[sid].name] = (by[subs[sid].name] || 0) + (+r.by[sid] || 0);
    }
    return { total, by };
  }
  function lastWeekAllMet() {
    const mon = addDays(weekOf(todayK()), -7), h = ST.getHistory();
    const tg = ST.activeSubjects().filter(([, s]) => s.target > 0);
    if (!tg.length) return false;
    return tg.every(([sid, s]) => { let x = 0; for (let i = 0; i < 7; i++) { const r = h[addDays(mon, i)]; if (r && r.by) x += +r.by[sid] || 0; } return x >= s.target * 3600; });
  }
  function buildProfile() {
    const mon = weekOf(todayK()), w = weekStats(mon);
    const top = Object.entries(w.by).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, s]) => ({ n: n.slice(0, 30), h: Math.round(s / 360) / 10 }));
    const emp = window.Empire && window.Empire.publicInfo ? window.Empire.publicInfo() : null;
    return {
      name: me.name, code: me.code, updated: Date.now(),
      week: { mon, hours: Math.round(w.total / 360) / 10, top },
      lastWeek: { mon: addDays(mon, -7), allMet: lastWeekAllMet() },
      empire: emp, ally: mine.ally || null, aid: me.aid || null,
    };
  }
  let pubTimer = null;
  function publish(now) {
    if (!FB || !me) return;
    clearTimeout(pubTimer);
    pubTimer = setTimeout(async () => {
      try { me = Object.assign(me, buildProfile()); await FB.F.setDoc(FB.F.doc(FB.fs, "profiles", FB.uid), me); err = ""; }
      catch (e) { err = permErr(e); render(); }
    }, now ? 0 : 20000);
  }
  const permErr = e => e && /permission/i.test(e.code || e.message || "") ? "rules" : "Couldn't reach your account — try again in a moment.";

  // ---------- codes ----------
  const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const newCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
  async function enable(name) {
    if (!FB) return;
    try {
      let code;
      for (let i = 0; i < 5; i++) {
        code = newCode();
        const d = await FB.F.getDoc(FB.F.doc(FB.fs, "codes", code));
        if (!d.exists()) break;
      }
      await FB.F.setDoc(FB.F.doc(FB.fs, "codes", code), { uid: FB.uid });
      me = { name: name.slice(0, 24), code };
      me = Object.assign(me, buildProfile());
      await FB.F.setDoc(FB.F.doc(FB.fs, "profiles", FB.uid), me);
      err = "";
    } catch (e) { err = permErr(e); me = null; }
    render();
  }
  async function addFriend(code) {
    code = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 6) { ST.toast("A friend code has 6 letters/numbers", "#eb8c6a"); return; }
    if (me && code === me.code) { ST.toast("That's your own code", "#eb8c6a"); return; }
    try {
      const d = await FB.F.getDoc(FB.F.doc(FB.fs, "codes", code));
      if (!d.exists()) { ST.toast("No one has that code", "#eb8c6a"); return; }
      const uid = d.data().uid;
      if (!mine.friends.includes(uid)) { mine.friends.push(uid); saveMine(); }
      watchAll(); ST.toast("Friend added", "#6fcf97");
    } catch (e) { err = permErr(e); render(); }
  }
  function watchAll() {
    if (!FB) return;
    for (const uid of mine.friends) {
      if (unsub[uid]) continue;
      unsub[uid] = FB.F.onSnapshot(FB.F.doc(FB.fs, "profiles", uid), d => { friends[uid] = d.exists() ? d.data() : null; checkAlliance(); render(); }, e => { err = permErr(e); render(); });
    }
    for (const uid in unsub) if (!mine.friends.includes(uid)) { unsub[uid](); delete unsub[uid]; delete friends[uid]; }
  }

  // ---------- alliances ----------
  const allyProfile = () => mine.ally && friends[mine.ally];
  const allianceActive = () => { const a = allyProfile(); return !!(a && a.ally === FB.uid); };
  function checkAlliance() {
    if (!FB || !me || !allianceActive()) return;
    const a = allyProfile(), lw = addDays(weekOf(todayK()), -7);
    // weekly bonus: both of you hit every target last week
    const got = get("allyBonus", {});
    if (!got[lw] && a.lastWeek && a.lastWeek.mon === lw && a.lastWeek.allMet && lastWeekAllMet() && window.Empire && window.Empire.grant) {
      if (window.Empire.grant(ALLY_BONUS, `Alliance with ${a.name}: you both hit every target — +${ALLY_BONUS} gold`)) {
        got[lw] = true; set("allyBonus", got); ST.toast(`Alliance bonus: +${ALLY_BONUS} gold`, "#f2c94c");
      }
    }
    // reinforcements your ally sent you this week
    const wk = weekOf(todayK());
    if (a.aid && a.aid.to === FB.uid && a.aid.week === wk && window.Empire && window.Empire.receiveAid) {
      if (window.Empire.receiveAid(wk, a.name)) ST.toast(`${a.name} sent reinforcements to your borders`, "#6fcf97");
    }
  }
  function sendAid() {
    const a = allyProfile(), wk = weekOf(todayK());
    if (!allianceActive() || (me.aid && me.aid.week === wk)) return;
    if (!window.Empire || !window.Empire.spend(AID_COST)) { ST.toast(`You need ${AID_COST} gold`, "#eb8c6a"); return; }
    me.aid = { to: mine.ally, week: wk };
    publish(true); ST.toast(`Reinforcements sent to ${a.name}`, "#6fcf97"); render();
  }

  // ---------- UI ----------
  const fmtH = h => h < 1 ? Math.round(h * 60) + "m" : h.toFixed(1).replace(/\.0$/, "") + "h";
  function render() {
    const sec = $("tab-friends"); if (!sec || sec.hidden) return;
    if (!window.FIREBASE_CONFIG) { sec.innerHTML = `<p class="help">Friends need account sync, which isn't set up for this copy of the app.</p>`; return; }
    if (!FB) { sec.innerHTML = `<div class="fr-empty"><h3>Study with friends</h3><p class="help">Sign in (bottom of this panel) to add friends, compare your weeks and form an alliance between your empires.</p></div>`; return; }
    if (err === "rules") { sec.innerHTML = `<div class="fr-empty"><h3>Almost there</h3><p class="help">The friends feature needs one extra rule in the app's Firebase settings (Firestore → Rules). Whoever set up this app can add it — the timer's owner has the exact text.</p></div>`; return; }
    if (!me) {
      sec.innerHTML = `<div class="fr-empty"><h3>Study with friends</h3>
        <p class="help">Turn this on to get a friend code. Friends you add see only: your nickname, this week's study hours (total and per subject), your decree streak and your empire's name, size and era. Never your email, notes or exact schedule.</p>
        <div class="yr-row"><input type="text" id="frName" maxlength="24" placeholder="Nickname" value="${esc(get("nick", ""))}"><button class="btn go" id="frOn">Turn on friends</button></div>
        ${err ? `<p class="help bad">${esc(err)}</p>` : ""}</div>`;
      return;
    }
    const wk = weekOf(todayK());
    const rows = [{ uid: FB.uid, p: me, self: true }].concat(mine.friends.map(uid => ({ uid, p: friends[uid] })).filter(x => x.p));
    rows.sort((a, b) => ((b.p.week && b.p.week.mon === wk ? b.p.week.hours : 0) - (a.p.week && a.p.week.mon === wk ? a.p.week.hours : 0)));
    const active = allianceActive(), a = allyProfile();
    sec.innerHTML = `
      <div class="fr-code"><span>Your friend code</span><b>${esc(me.code)}</b><button class="btn" id="frShare">Share</button></div>
      <div class="yr-row"><input type="text" id="frAdd" maxlength="8" placeholder="Friend's code" autocapitalize="characters"><button class="btn go" id="frAddBtn">Add friend</button></div>
      ${a ? `<div class="fr-ally ${active ? "on" : ""}"><b>${active ? "Alliance with " + esc(a.name) : "Alliance proposed to " + esc(a.name)}</b>
        <small>${active ? `When you both hit every weekly target you each get +${ALLY_BONUS} gold. Once a week you can send reinforcements (${AID_COST} gold): your ally's raids that week take 2 provinces fewer.`
          : `Waiting for ${esc(a.name)} to choose you as their ally too.`}</small>
        ${active ? `<button class="btn" id="frAid" ${me.aid && me.aid.week === wk ? "disabled" : ""}>${me.aid && me.aid.week === wk ? "Reinforcements sent this week" : `Send reinforcements · ${AID_COST} gold`}</button>` : ""}</div>` : ""}
      <h3 class="yr-h">This week</h3>
      <div class="fr-list">${rows.map((x, i) => { const p = x.p, w = p.week && p.week.mon === wk ? p.week : { hours: 0, top: [] }, e = p.empire;
        const isAlly = mine.ally === x.uid, mutual = isAlly && p.ally === FB.uid, wantsMe = p.ally === FB.uid && !isAlly;
        return `<div class="fr-row${x.self ? " me" : ""}"><div class="fr-rank">${i + 1}</div>
          <div class="fr-mid"><div class="fr-name"><b>${esc(p.name)}${x.self ? " (you)" : ""}</b>${mutual ? `<em class="pers">ally</em>` : ""}${wantsMe ? `<em class="pers">wants to ally</em>` : ""}</div>
            <div class="fr-top">${(w.top || []).slice(0, 4).map(t => `${esc(t.n)} ${fmtH(t.h)}`).join(" · ") || "no study yet this week"}</div>
            ${e ? `<div class="fr-emp"><i style="background:${/^#[0-9a-f]{6}$/i.test(e.color) ? e.color : "#888"}"></i>${esc(e.rank)} of ${esc(e.name)} · ${e.provinces} provinces · ${esc(e.era)}${e.streak ? ` · ${e.streak}-day streak` : ""}</div>` : ""}</div>
          <div class="fr-h"><b>${fmtH(w.hours || 0)}</b>${x.self ? "" : `<span>${isAlly ? `<button class="linkish" data-unally="${x.uid}">end alliance</button>` : `<button class="linkish" data-ally="${x.uid}">${wantsMe ? "accept alliance" : "ally"}</button>`}
            <button class="linkish" data-rm="${x.uid}">remove</button></span>`}</div></div>`; }).join("")}</div>
      ${mine.friends.length ? "" : `<p class="help">Share your code with a friend and add theirs — you'll see each other's week here.</p>`}
      ${err ? `<p class="help bad">${esc(err)}</p>` : ""}
      <p class="help">Your profile updates a few times an hour. <button class="linkish" id="frOff">Turn off friends</button></p>`;
  }
  document.addEventListener("click", e => {
    const sec = $("tab-friends"); if (!sec || !sec.contains(e.target)) return;
    if (e.target.id === "frOn") { const n = $("frName").value.trim(); if (!n) { ST.toast("Pick a nickname", "#eb8c6a"); return; } set("nick", n); enable(n); }
    if (e.target.id === "frAddBtn") addFriend($("frAdd").value);
    if (e.target.id === "frShare") {
      const text = `Add me on Study Timer — my friend code is ${me.code}\n${location.origin + location.pathname}`;
      if (navigator.share) navigator.share({ text }).catch(() => {}); else { try { navigator.clipboard.writeText(text); ST.toast("Copied", "#6fcf97"); } catch (x) {} }
    }
    if (e.target.id === "frAid") sendAid();
    const al = e.target.closest("[data-ally]");
    if (al) { mine.ally = al.dataset.ally; saveMine(); publish(true); render(); }
    if (e.target.closest("[data-unally]")) { mine.ally = null; saveMine(); publish(true); render(); }
    const rm = e.target.closest("[data-rm]");
    if (rm && confirm("Remove this friend?")) { mine.friends = mine.friends.filter(u => u !== rm.dataset.rm); if (mine.ally === rm.dataset.rm) mine.ally = null; saveMine(); watchAll(); publish(true); render(); }
    if (e.target.id === "frOff" && confirm("Turn off friends? Your profile and code are removed; your friends list is kept for later.")) disable();
  });
  async function disable() {
    try {
      if (me && me.code) await FB.F.deleteDoc(FB.F.doc(FB.fs, "codes", me.code));
      await FB.F.deleteDoc(FB.F.doc(FB.fs, "profiles", FB.uid));
    } catch (e) {}
    me = null; render();
  }

  async function start() {
    FB = window.FB;
    try {
      const d = await FB.F.getDoc(FB.F.doc(FB.fs, "profiles", FB.uid));
      me = d.exists() ? d.data() : null;
    } catch (e) { if (/permission/i.test(e.code || e.message || "")) err = "rules"; }
    watchAll();
    if (me) publish(true);
    render();
  }
  if (window.FB) start(); else window.addEventListener("fb:ready", start, { once: true });
  window.addEventListener("studytimer:change", () => { if (me) publish(false); });

  window.Social = { render };
})();
