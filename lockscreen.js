// Lock-screen timer: while the timer runs, the phone's lock screen / notification shade shows a media panel with the
// time left, the subject, a moving progress bar and pause / skip buttons. Phones only show that panel for playing audio,
// so a near-silent sound loops while the timer runs (this also keeps the timer and end chime working in the background).
(() => {
  "use strict";
  const ST = window.StudyTimer;
  if (!ST || !("mediaSession" in navigator)) return;
  const $ = id => document.getElementById(id);
  const get = (k, d) => { try { const v = localStorage.getItem("studyTimer." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem("studyTimer." + k, JSON.stringify(v)); } catch (e) {} };
  const pad = n => String(n).padStart(2, "0");
  let enabled = get("lockscreen", true);

  // 8 seconds of almost-silent noise (inaudible, but counts as "playing audio")
  function quietWav() {
    const rate = 8000, n = rate * 8, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round((Math.random() * 2 - 1) * 3), true);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }
  const audio = document.createElement("audio");
  audio.loop = true; audio.preload = "auto"; audio.setAttribute("playsinline", ""); audio.src = quietWav();
  document.body.appendChild(audio);

  const ART = [192, 512].map(s => ({ src: new URL(`icon-${s}.png?v=2`, location.href).href, sizes: `${s}x${s}`, type: "image/png" }));
  const fmt = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ":" + pad(m) : m) + ":" + pad(s % 60); };
  let lastTitle = "";
  function update() {
    if (!enabled) return;
    const t = ST.timerState(), s = ST.getSubjects()[ST.currentSubject()];
    const what = t.mode === "focus" ? (s ? s.name : "Focus") : t.mode === "short" ? "Short break" : "Long break";
    const title = t.running ? `${fmt(t.remaining)} left · ${what}` : `Paused · ${fmt(t.remaining)} left · ${what}`;
    if (title !== lastTitle) {
      lastTitle = title;
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: t.mode === "focus" ? "Study Timer · focus" : "Study Timer · break", album: "Study Timer", artwork: ART });
    }
    try { if (t.total > 0) navigator.mediaSession.setPositionState({ duration: t.total, position: Math.min(t.total, Math.max(0, t.total - t.remaining)), playbackRate: 1 }); } catch (e) {}
    navigator.mediaSession.playbackState = t.running ? "playing" : "paused";
  }
  let wasRunning = false;
  function syncState() {
    const running = document.body.classList.contains("running");
    if (!enabled) { if (!audio.paused) audio.pause(); return; }
    if (running && audio.paused) audio.play().catch(() => {});
    if (!running && !audio.paused && wasRunning) audio.pause();
    wasRunning = running;
    lastTitle = ""; update();
  }
  // phones only allow audio to start from a tap: start the (silent) loop on the tap that starts the timer
  const prime = () => { if (enabled && document.body.classList.contains("running") && audio.paused) audio.play().catch(() => {}); };
  document.addEventListener("click", () => setTimeout(prime, 0), true);
  document.addEventListener("keydown", e => { if (e.key === " ") setTimeout(prime, 0); }, true);
  new MutationObserver(syncState).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  setInterval(update, 1000);

  const act = (name, fn) => { try { navigator.mediaSession.setActionHandler(name, fn); } catch (e) {} };
  act("play", () => { if (!ST.timerState().running) ST.toggleTimer(); audio.play().catch(() => {}); update(); });
  act("pause", () => { if (ST.timerState().running) ST.toggleTimer(); update(); });
  act("nexttrack", () => { ST.skipTimer(); update(); });
  act("stop", () => { if (ST.timerState().running) ST.toggleTimer(); audio.pause(); });

  // on/off switch at the bottom of the progress panel
  const row = document.createElement("div");
  row.className = "theme-row";
  const paint = () => { row.innerHTML = `Lock-screen timer <button class="chip${enabled ? " on" : ""}" data-ls="1">On</button><button class="chip${enabled ? "" : " on"}" data-ls="0">Off</button>`; };
  paint();
  const anchor = document.querySelector(".theme-row") || $("syncNote");
  if (anchor) anchor.after(row);
  row.addEventListener("click", e => {
    const b = e.target.closest("[data-ls]"); if (!b) return;
    enabled = b.dataset.ls === "1"; set("lockscreen", enabled); paint();
    if (!enabled) { audio.pause(); navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = "none"; } else syncState();
  });

  window.LockScreen = { audio, update };
})();
