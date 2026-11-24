// Light / dark / auto theme, and desk mode (a big, always-on progress ring for when the phone sits on your desk).
(() => {
  "use strict";
  const ST = window.StudyTimer;
  if (!ST) return;
  const $ = id => document.getElementById(id);
  const get = (k, d) => { try { const v = localStorage.getItem("studyTimer." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem("studyTimer." + k, JSON.stringify(v)); } catch (e) {} };
  const pad = n => String(n).padStart(2, "0");

  // ---------- theme ----------
  let theme = get("theme", "dark");
  const mq = window.matchMedia ? matchMedia("(prefers-color-scheme: light)") : null;
  function applyTheme() {
    const light = theme === "light" || (theme === "auto" && mq && mq.matches);
    document.body.classList.toggle("light", light);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? "#f3f0eb" : "#050505";
    document.querySelectorAll("[data-theme]").forEach(b => b.classList.toggle("on", b.dataset.theme === theme));
  }
  if (mq && mq.addEventListener) mq.addEventListener("change", applyTheme);
  const row = document.createElement("div");
  row.className = "theme-row";
  row.innerHTML = `Theme <button class="chip" data-theme="auto">Auto</button><button class="chip" data-theme="dark">Dark</button><button class="chip" data-theme="light">Light</button>`;
  const guide = $("guideBtn") || $("syncNote");
  if (guide) guide.after(row);
  row.addEventListener("click", e => { const b = e.target.closest("[data-theme]"); if (!b) return; theme = b.dataset.theme; set("theme", theme); applyTheme(); });
  applyTheme();

  // ---------- desk mode ----------
  const R = 46, C = 2 * Math.PI * R;
  const desk = document.createElement("div");
  desk.className = "desk"; desk.hidden = true;
  desk.innerHTML = `<div class="desk-inner">
      <svg class="ring" viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="${R}" stroke-width="3"/><circle class="ring-fg" cx="50" cy="50" r="${R}" stroke-width="3.4" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
      <div class="desk-center"><div class="desk-time" id="deskTime">25:00</div><div class="desk-sub" id="deskSub"></div><div class="desk-meta" id="deskMeta"></div></div>
    </div>
    <div class="desk-ctl"><button id="deskPlay">Pause</button><button id="deskExit">Exit desk mode</button></div>`;
  document.body.appendChild(desk);
  let tick = null, lock = null, ctlTimer = null, dimTimer = null, drift = 0;
  const fmt = s => { s = Math.ceil(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" + pad(m) : m) + ":" + pad(s % 60); };
  function render() {
    const t = ST.timerState(), subs = ST.getSubjects(), sid = ST.currentSubject(), s = subs[sid];
    const color = getComputedStyle(document.body).getPropertyValue("--glow").trim() || "#d9d6d8";
    $("deskTime").textContent = fmt(t.remaining);
    const fg = desk.querySelector(".ring-fg");
    fg.style.stroke = color; desk.style.setProperty("--dc", color);
    fg.style.strokeDashoffset = String(C * (1 - (t.total ? t.remaining / t.total : 0)));
    $("deskSub").innerHTML = t.mode === "focus" ? (s ? `<i style="background:${s.color}"></i>${s.name.replace(/[<>&]/g, "")}` : "Focus") : t.mode === "short" ? "Short break" : "Long break";
    const today = ST.todaySecs ? ST.todaySecs() : 0;
    $("deskMeta").textContent = (t.running ? "" : "Paused · ") + "Today " + Math.floor(today / 3600) + "h " + pad(Math.floor(today % 3600 / 60)) + "m";
    $("deskPlay").textContent = t.running ? "Pause" : "Start";
  }
  async function wakeLock(on) {
    try {
      if (on && "wakeLock" in navigator && !lock) { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); }
      if (!on && lock) { await lock.release(); lock = null; }
    } catch (e) {}
  }
  function showCtl() {
    desk.classList.add("show-ctl"); desk.classList.remove("dim");
    clearTimeout(ctlTimer); ctlTimer = setTimeout(() => desk.classList.remove("show-ctl"), 3500);
    clearTimeout(dimTimer); dimTimer = setTimeout(() => desk.classList.add("dim"), 15000);
  }
  function open() {
    desk.hidden = false; render(); showCtl();
    tick = setInterval(() => {
      render();
      // nudge the picture a few pixels every minute so nothing burns into the screen
      if (++drift % 240 === 0) desk.querySelector(".desk-inner").style.transform = `translate(${Math.round(Math.random() * 16 - 8)}px, ${Math.round(Math.random() * 16 - 8)}px)`;
    }, 250);
    wakeLock(true);
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  }
  function close() {
    desk.hidden = true; clearInterval(tick); wakeLock(false);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }
  document.addEventListener("visibilitychange", () => { if (!desk.hidden && !document.hidden) wakeLock(true); });
  desk.addEventListener("click", e => {
    if (e.target.id === "deskExit") { close(); return; }
    if (e.target.id === "deskPlay") { ST.toggleTimer(); render(); showCtl(); return; }
    showCtl();
  });
  desk.addEventListener("mousemove", showCtl);
  document.addEventListener("keydown", e => {
    if (!desk.hidden) {
      if (e.key === "Escape" || e.key.toLowerCase() === "d") { e.stopPropagation(); e.preventDefault(); close(); }
      else if (e.key === " ") { e.stopPropagation(); e.preventDefault(); ST.toggleTimer(); render(); showCtl(); }
      return;
    }
    if (e.key.toLowerCase() === "d" && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)
        && $("panel").hidden && !document.body.classList.contains("empire-open")) { e.preventDefault(); open(); }
  }, true);

  // button in the control bar, next to fullscreen
  const btn = document.createElement("button");
  btn.className = "round"; btn.id = "deskBtn"; btn.title = "Desk mode (D) — big ring, screen stays on";
  btn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="11" r="7"/><path d="M12 7v4l2.5 1.5M8 21h8"/></svg>`;
  const fs = $("fs"); if (fs) fs.before(btn);
  btn.onclick = open;

  window.Look = { openDesk: open, closeDesk: close };
})();
