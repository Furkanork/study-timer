// Sign in (Google or email) and sync through Firebase. Plugs into the timer's existing sync code
// by providing the small database interface it expects (window.claude.use("db") / ("user")).
const V = "10.12.2";
const cfg = window.FIREBASE_CONFIG;
const ST = window.StudyTimer;
const box = document.getElementById("acct");
const G_ICON = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.5 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.4 0-11.7-4-13.6-9.6l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const friendly = e => {
  const c = (e && e.code) || "";
  if (c.includes("popup-closed") || c.includes("cancelled-popup")) return "";
  if (c.includes("popup-blocked")) return "Your browser blocked the sign-in window — trying a full-page sign-in instead…";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Wrong email or password.";
  if (c.includes("email-already-in-use")) return "That email already has an account — use Sign in.";
  if (c.includes("weak-password")) return "Password needs at least 6 characters.";
  if (c.includes("invalid-email")) return "That email doesn't look right.";
  if (c.includes("network")) return "No internet connection.";
  if (c.includes("unauthorized-domain")) return "This site isn't allowed yet — add it under Authentication → Settings → Authorized domains in Firebase.";
  return "Sign-in didn't work (" + (c || "unknown error") + ").";
};

if (cfg && ST && box) { window.__fbAuth = "pending"; start().catch(() => { window.__fbAuth = "failed"; box.hidden = true; }); }

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  let fs;
  try { fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { fs = F.getFirestore(app); }
  A.getRedirectResult(auth).catch(e => showSignedOut(friendly(e)));

  let started = false;
  A.onAuthStateChanged(auth, user => {
    window.__fbAuth = user ? "in" : "out";
    try { localStorage.setItem("studyTimer.signedIn", JSON.stringify(!!user)); } catch (e) {}
    if (!user) { showSignedOut(); window.dispatchEvent(new Event("studytimer:change")); return; }
    showSignedIn(user);
    if (started) return;
    started = true;
    const db = {
      collection(path) {
        const uid = path.split("/").pop();
        const col = F.collection(fs, "users", uid, "items");
        return {
          onSnapshot(cb, err) {
            return F.onSnapshot(col, { includeMetadataChanges: true }, s => cb({
              docs: s.docs.map(d => ({ id: d.id, exists: true, data: () => d.data() })),
              metadata: { fromCache: s.metadata.fromCache },
            }), err);
          },
          doc(id) { const r = F.doc(col, id); return { set: obj => F.setDoc(r, obj) }; },
        };
      },
    };
    window.claude = { use: async what => what === "db" ? db : { id: async () => user.uid } };
    ST.startSync();
    // shared Firestore access for the friends feature (social.js)
    window.FB = { F, fs, uid: user.uid };
    window.dispatchEvent(new Event("fb:ready"));
  });

  function showSignedOut(err) {
    box.hidden = false;
    box.innerHTML = `<span>Use the same progress on all your devices</span>
      <button class="g-btn" id="gIn">${G_ICON}Sign in with Google</button>
      <button class="linkish" id="eToggle">or use email &amp; password</button>
      <form id="eForm" hidden>
        <input type="email" id="eMail" placeholder="Email" autocomplete="email" required>
        <input type="password" id="ePass" placeholder="Password (6+ characters)" autocomplete="current-password" minlength="6" required>
        <div class="row2"><button class="btn go" type="submit" data-act="in">Sign in</button><button class="btn" type="submit" data-act="up">Create account</button></div>
      </form>
      ${err ? `<span class="err">${esc(err)}</span>` : ""}`;
    document.getElementById("gIn").onclick = async () => {
      const prov = new A.GoogleAuthProvider();
      prov.setCustomParameters({ prompt: "select_account" });
      try { await A.signInWithPopup(auth, prov); }
      catch (e) {
        const msg = friendly(e);
        if (e && e.code && /popup-blocked|operation-not-supported|web-storage/.test(e.code)) { showSignedOut(msg); A.signInWithRedirect(auth, prov); }
        else if (msg) showSignedOut(msg + (navigator.standalone ? " On iPhone home-screen apps, email & password is more reliable." : ""));
      }
    };
    document.getElementById("eToggle").onclick = () => { document.getElementById("eForm").hidden = false; document.getElementById("eToggle").hidden = true; };
    let act = "in";
    box.querySelectorAll("[data-act]").forEach(b => b.onclick = () => { act = b.dataset.act; });
    document.getElementById("eForm").onsubmit = async ev => {
      ev.preventDefault();
      const m = document.getElementById("eMail").value.trim(), p = document.getElementById("ePass").value;
      try { await (act === "up" ? A.createUserWithEmailAndPassword : A.signInWithEmailAndPassword)(auth, m, p); }
      catch (e) { showSignedOut(friendly(e)); document.getElementById("eToggle").click(); document.getElementById("eMail").value = m; }
    };
  }
  function showSignedIn(user) {
    box.hidden = false;
    box.innerHTML = `<span>Signed in as <b>${esc(user.email || user.displayName || "you")}</b></span><button class="linkish" id="sOut">Sign out</button>`;
    document.getElementById("sOut").onclick = async () => {
      if (!confirm("Sign out? This device keeps its own copy, but stops syncing until you sign in again.")) return;
      await A.signOut(auth);
      location.reload();
    };
  }
}
