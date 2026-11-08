import { $, esc, ICON, toast, debounce } from "../util.js";
import { film, filmCount, searchFilms } from "../films.js";
import { api } from "../api/index.js";
import { S, loadSession, rankedCount, updateMe, rankedIds, myRows } from "../state.js";
import { cardHTML, userRowHTML, avatarHTML, confirmDialog } from "../ui.js";
import { followBtnHTML } from "./feed.js";

const onboardKey = () => `movi.onboarded.${S.me?.id}`;
export const needsOnboarding = () => { try { return !localStorage.getItem(onboardKey()); } catch { return false; } };
const finishOnboarding = () => { try { localStorage.setItem(onboardKey(), "1"); } catch {} };

let authTab = "signup";

export function renderWelcome(view) {
  const demo = api.mode === "demo";
  view.innerHTML = `
    <div class="welcome">
      <div class="w-copy">
        <span class="logo big">movi</span>
        <h1>Rank every movie you've ever seen.</h1>
        <p class="lead">No more stars. Pick which film you liked more, a few times, and Movi builds your personal 0–10 scores and a ranked list that's truly yours.</p>
        <ul class="w-feats">
          <li>${ICON.rank}<span><b>Head-to-head ranking</b> — about 5 quick picks per film</span></li>
          <li>${ICON.users}<span><b>Friends & feed</b> — see what they watch, like and comment</span></li>
          <li>${ICON.sparkle}<span><b>Rec scores</b> — predicted scores from friends with your taste</span></li>
          <li>${ICON.trophy}<span><b>Leaderboards, streaks & badges</b> — make watching a habit</span></li>
        </ul>
        <p class="muted small">${filmCount().toLocaleString()} films · Watchlist · Taste match · Watch together</p>
      </div>
      <div class="auth">
        <div class="seg" role="tablist"><button role="tab" class="${authTab === "signup" ? "on" : ""}" data-atab="signup">Create account</button><button role="tab" class="${authTab === "signin" ? "on" : ""}" data-atab="signin">Sign in</button></div>
        ${authTab === "signup" ? `
        <form id="auth-form" novalidate>
          <label>Your name<input name="display_name" maxlength="40" autocomplete="name" required placeholder="Alex Kim"></label>
          <label>Username<span class="field"><span class="at">@</span><input name="username" maxlength="20" autocomplete="username" required placeholder="alexwatches" pattern="[a-z0-9_.]{3,20}"></span><small id="u-hint" class="hint">3–20 characters: lowercase letters, numbers, _ and .</small></label>
          <label>Email<input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
          <label>Password<input name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="At least 6 characters"></label>
          <p class="form-err" id="auth-err" role="alert"></p>
          <button class="btn primary block" id="auth-go">Create account</button>
        </form>` : `
        <form id="auth-form" novalidate>
          <label>Email<input name="email" type="email" autocomplete="email" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
          <p class="form-err" id="auth-err" role="alert"></p>
          <button class="btn primary block" id="auth-go">Sign in</button>
          ${demo ? "" : `<button type="button" class="linkish center-t" data-act="forgot">Forgot password?</button>`}
        </form>`}
        ${demo ? `<div class="demo-note">${ICON.lock}<span><b>Demo mode.</b> Accounts and rankings are saved only in this browser, alongside a sample community. Connect Supabase in <code>config.js</code> to go live.</span></div>` : ""}
        <a class="linkish center-t" href="#/discover">Browse without an account</a>
      </div>
    </div>`;
  view.querySelectorAll("[data-atab]").forEach((b) => b.addEventListener("click", () => { authTab = b.dataset.atab; renderWelcome(view); }));
  const form = $("#auth-form");
  const err = $("#auth-err");
  const u = form.username;
  if (u) {
    u.addEventListener("input", () => { u.value = u.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""); checkName(); });
    const nameField = form.display_name;
    nameField.addEventListener("input", () => {
      if (!u.dataset.touched) { u.value = nameField.value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20); checkName(); }
    });
    u.addEventListener("keydown", () => { u.dataset.touched = "1"; });
  }
  const checkName = debounce(async () => {
    const hint = $("#u-hint");
    if (!hint || !u.value) return;
    if (!/^[a-z0-9_.]{3,20}$/.test(u.value)) { hint.textContent = "3–20 characters: lowercase letters, numbers, _ and ."; hint.className = "hint"; return; }
    const ok = await api.usernameAvailable(u.value).catch(() => true);
    hint.textContent = ok ? `@${u.value} is available` : `@${u.value} is taken`;
    hint.className = ok ? "hint good" : "hint bad";
  }, 300);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const fd = Object.fromEntries(new FormData(form));
    if (authTab === "signup") {
      if (!fd.display_name.trim()) return (err.textContent = "Tell us your name");
      if (!/^[a-z0-9_.]{3,20}$/.test(fd.username)) return (err.textContent = "Pick a username with 3–20 lowercase letters, numbers, _ or .");
      if (!/^\S+@\S+\.\S+$/.test(fd.email)) return (err.textContent = "Enter a valid email");
      if ((fd.password || "").length < 6) return (err.textContent = "Password should be at least 6 characters");
    } else if (!fd.email || !fd.password) return (err.textContent = "Enter your email and password");
    const btn = $("#auth-go");
    btn.disabled = true;
    btn.textContent = authTab === "signup" ? "Creating account…" : "Signing in…";
    try {
      if (authTab === "signup") {
        if (!(await api.usernameAvailable(fd.username))) throw new Error("That username is taken");
        const res = await api.signUp({ email: fd.email, password: fd.password, username: fd.username, displayName: fd.display_name.trim() });
        if (res.needsConfirm) {
          view.querySelector(".auth").innerHTML = `<h2>Check your email</h2><p class="muted">We sent a confirmation link to <b>${esc(fd.email)}</b>. Open it to finish creating your account, then sign in.</p><button class="btn block" data-atab-reset>Back to sign in</button>`;
          view.querySelector("[data-atab-reset]").addEventListener("click", () => { authTab = "signin"; renderWelcome(view); });
          return;
        }
      } else {
        await api.signIn({ email: fd.email, password: fd.password });
      }
      await loadSession();
      document.dispatchEvent(new CustomEvent("movi:auth"));
      location.hash = needsOnboarding() && rankedCount() === 0 ? "#/onboarding" : "#/feed";
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = authTab === "signup" ? "Create account" : "Sign in";
    }
  });
}

export async function forgotPassword() {
  const email = $("#auth-form")?.email?.value?.trim() || prompt("Your account email:");
  if (!email) return;
  try {
    await api.resetPassword(email);
    toast("Check your email for a reset link");
  } catch (e) { toast(e.message); }
}

// ---------- Onboarding ----------
let obStep = 1;
export async function renderOnboarding(view) {
  const n = rankedCount();
  const steps = `<div class="ob-steps">${[1, 2].map((i) => `<i class="${obStep >= i ? "on" : ""}"></i>`).join("")}</div>`;
  if (obStep === 1) {
    const taken = new Set([...rankedIds(), ...S.skip]);
    const picks = searchFilms({}).filter((f) => !taken.has(f.id)).slice(0, 18);
    view.innerHTML = `<div class="ob">${steps}
      <h1>Rank 3 films you've seen</h1>
      <p class="muted">Pick films you know well. ${n ? `<b>${Math.min(n, 3)} of 3 done.</b>` : "It takes a few seconds each."}</p>
      <div class="row-c"><button class="btn" data-act="quick-add">${ICON.search} Search for a film</button>${n >= 3 ? `<button class="btn primary" data-act="ob-next">Next: find friends ${ICON.chevron}</button>` : `<button class="btn ghost" data-act="ob-next">Skip for now</button>`}</div>
      <div class="grid quick" style="margin-top:22px">${picks.map((f) => cardHTML(f, { acts: `<div class="acts"><button data-act="rank" data-id="${f.id}">Seen it</button><button data-act="skip" data-id="${f.id}">Not seen</button></div>` })).join("")}</div></div>`;
    return;
  }
  view.innerHTML = `<div class="ob">${steps}<h1>Follow people</h1><p class="muted">Their rankings power your feed, rec scores and leaderboard.</p><div id="ob-people" class="ulist"></div>
    <div class="row-c"><button class="btn primary" data-act="ob-done">Go to my feed ${ICON.chevron}</button></div></div>`;
  const ps = (await api.listProfiles({ limit: 30 })).filter((p) => p.id !== S.me.id);
  $("#ob-people").innerHTML = ps.map((p) => userRowHTML(p, followBtnHTML(p), `${p.ranked_count} ranked`)).join("") || `<p class="muted">No one else is here yet — invite your friends from your profile.</p>`;
}
export function onboardingNext() { obStep = 2; renderOnboarding($("#view")); }
export function onboardingDone() { finishOnboarding(); obStep = 1; location.hash = "#/feed"; }

// ---------- Settings ----------
export function renderSettings(view) {
  const me = S.me;
  const demo = api.mode === "demo";
  view.innerHTML = `<div class="list-head"><h1>Settings</h1></div>
    <form class="panel-card form" id="prof-form">
      <h3>Profile</h3>
      <div class="av-edit"><span id="av-prev">${avatarHTML(me, 72)}</span><label>Avatar color<input type="range" name="avatar_hue" min="0" max="359" value="${me.avatar_hue}"></label></div>
      <label>Name<input name="display_name" maxlength="40" value="${esc(me.display_name)}" required></label>
      <label>Username<span class="field"><span class="at">@</span><input name="username" maxlength="20" value="${esc(me.username)}" pattern="[a-z0-9_.]{3,20}" required></span></label>
      <label>Bio<textarea name="bio" maxlength="160" rows="2" placeholder="What do you love to watch?">${esc(me.bio)}</textarea></label>
      <label>${new Date().getFullYear()} goal<span class="field"><input name="yearly_goal" type="number" min="1" max="1000" value="${me.yearly_goal}"><span class="at">films</span></span></label>
      <label class="switch"><input type="checkbox" name="is_private" ${me.is_private ? "checked" : ""}><span><b>Private account</b><small>Only approved followers see your rankings, watchlist and activity.</small></span></label>
      <p class="form-err" id="prof-err" role="alert"></p>
      <button class="btn primary">Save profile</button>
    </form>
    <form class="panel-card form" id="pw-form">
      <h3>Password</h3>
      <label>New password<input name="password" type="password" minlength="6" autocomplete="new-password" required></label>
      <button class="btn">Update password</button>
    </form>
    <div class="panel-card form">
      <h3>Your data</h3>
      <p class="muted">Download everything you've ranked, noted and saved.</p>
      <div class="settings"><button class="btn sm" data-act="export">Export my data</button></div>
    </div>
    <div class="panel-card form">
      <h3>Account</h3>
      <p class="muted">${demo ? "Demo mode: this account lives only in this browser." : "Signed in to Movi."}</p>
      <div class="settings"><button class="btn sm" data-act="sign-out">${ICON.logout} Sign out</button><button class="btn sm danger" data-act="delete-account">${ICON.trash} Delete account</button>
      ${demo ? `<button class="btn sm ghost" data-act="reset-demo">Reset demo data</button>` : ""}</div>
    </div>
    <p class="muted small center-t">Film data from Wikipedia (CC BY-SA). Posters from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB. ${demo ? "Running in demo mode." : "Connected to Supabase."}</p>`;
  const pf = $("#prof-form");
  pf.avatar_hue.addEventListener("input", () => { $("#av-prev").innerHTML = avatarHTML({ ...me, display_name: pf.display_name.value, avatar_hue: Number(pf.avatar_hue.value) }, 72); });
  pf.username.addEventListener("input", () => { pf.username.value = pf.username.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""); });
  pf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#prof-err");
    err.textContent = "";
    const fd = new FormData(pf);
    const patch = {
      display_name: String(fd.get("display_name")).trim().slice(0, 40),
      username: String(fd.get("username")).trim(),
      bio: String(fd.get("bio")).trim().slice(0, 160),
      avatar_hue: Number(fd.get("avatar_hue")),
      yearly_goal: Math.max(1, Math.min(1000, Number(fd.get("yearly_goal")) || 52)),
      is_private: fd.get("is_private") === "on",
    };
    if (!patch.display_name) return (err.textContent = "Name can't be empty");
    if (!/^[a-z0-9_.]{3,20}$/.test(patch.username)) return (err.textContent = "Username needs 3–20 lowercase letters, numbers, _ or .");
    try {
      if (patch.username !== me.username && !(await api.usernameAvailable(patch.username))) throw new Error("That username is taken");
      await updateMe(patch);
      document.dispatchEvent(new CustomEvent("movi:auth"));
      toast("Profile saved");
    } catch (ex) {
      err.textContent = /duplicate|unique/i.test(ex.message) ? "That username is taken" : ex.message;
    }
  });
  $("#pw-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.updatePassword(e.target.password.value);
      e.target.reset();
      toast("Password updated");
    } catch (ex) { toast(ex.message); }
  });
}

export function exportData() {
  const data = {
    exported_at: new Date().toISOString(),
    profile: S.me,
    rankings: myRows().map((r) => ({ ...r, title: film(r.film_id).title, year: film(r.film_id).year })),
    watchlist: S.watch.map((w) => ({ ...w, title: film(w.film_id).title, year: film(w.film_id).year })),
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `movi-${S.me.username}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function deleteAccount() {
  const ok = await confirmDialog({ title: "Delete your account?", text: "This permanently deletes your profile, rankings, notes, watchlist, follows and activity. This can't be undone.", ok: "Delete forever", danger: true });
  if (!ok) return;
  try {
    await api.deleteAccount();
    toast("Account deleted");
    document.dispatchEvent(new CustomEvent("movi:signedout"));
  } catch (e) { toast(e.message); }
}
