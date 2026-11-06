// Demo backend: same contract as api/supabase.js, stored in this browser's localStorage.
// It seeds a small fictional community so the social side of Movi can be tried without a server.
import { allFilms, genres } from "../films.js";
import { scoreFor, ORDER } from "../model.js";
import { rng } from "../util.js";

const KEY = "movi.demo.world.v1";
const SESSION = "movi.demo.session";
const DAY = 86400000;

const PEOPLE = [
  ["maya.watches", "Maya Ortiz", "Horror lifer. If it has a final girl, I've seen it.", 350, ["Horror", "Thriller", "Supernatural", "Slasher"], 0],
  ["deshawn.films", "DeShawn Carter", "Big screen, big explosions, bigger popcorn.", 210, ["Action", "Superhero", "Adventure"], 0],
  ["priya.reels", "Priya Nair", "Romance apologist. Will cry at anything with a good score.", 330, ["Romance", "Drama", "Musical"], 0],
  ["theo.cinema", "Theo Lindqvist", "Mostly black and white. Occasionally color.", 30, ["Noir", "Drama", "Western", "Crime"], -1],
  ["lucia.frames", "Lucía Romero", "Animation is cinema.", 280, ["Animated", "Family", "Fantasy"], 0],
  ["kenji.screens", "Kenji Watanabe", "Space, time, and everything in between.", 190, ["Science Fiction", "Adventure", "Thriller"], 0],
  ["amara.reviews", "Amara Okafor", "Tough grader. A 9 from me means something.", 0, ["Drama", "Biography", "Historical"], 1],
  ["sam.popcorn", "Sam Rivera", "Here for a good laugh and a better snack.", 50, ["Comedy", "Teen", "Family"], 0],
  ["noor.nightly", "Noor Haddad", "Whodunits, heists and slow-burn mysteries.", 260, ["Mystery", "Crime", "Thriller"], 0],
  ["jules.indie", "Jules Moreau", "Private account. Festival circuit regular.", 160, ["Independent", "Drama", "Comedy"], 1, true],
];

const NOTES = {
  loved: ["Instant all-timer.", "Rewatched and it hits even harder.", "The score alone is worth it.", "Couldn't stop thinking about it for days.", "Pure cinema.", "Every frame could be a painting.", "Saw it in a packed theater. Unforgettable.", "Better than I remembered."],
  fine: ["Solid, but the third act dragged.", "Fun enough for a Sunday.", "Great cast, messy script.", "Some great scenes, didn't fully land for me.", "Worth it for the visuals alone."],
  disliked: ["Not for me at all.", "Way too long.", "I wanted to like this so much.", "The hype did not match the movie."],
};
const COMMENTS = ["Agreed, top tier.", "Ok I need to rewatch this.", "Bold ranking.", "Hard disagree, but respect.", "Adding this to my watchlist.", "That ending though.", "Finally someone said it.", "Where does it land vs the sequel?", "We should watch this together."];
const PLACES = ["Theater", "Streaming", "Streaming", "Home", "TV"];

const clone = (x) => (x == null ? x : structuredClone(x));
const iso = (t) => new Date(t).toISOString();

async function hashPw(pw) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("movi:" + pw));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0;
    for (const c of "movi:" + pw) h = (h * 33 + c.charCodeAt(0)) | 0;
    return "w" + h;
  }
}

function seedWorld() {
  const w = { v: 1, seq: 1, users: {}, rankings: {}, watch: {}, follows: [], activities: [], likes: [], comments: [], recs: [], notifications: [] };
  const now = Date.now();
  const pool = allFilms().slice(0, 900).filter((f) => f.g.length);
  const ids = PEOPLE.map((_, i) => `demo-${i + 1}`);
  const G = genres();

  PEOPLE.forEach(([username, name, bio, hue, likes, harsh, priv], i) => {
    const id = ids[i];
    const r = rng(1000 + i * 77);
    w.users[id] = {
      email: null,
      profile: { id, username, display_name: name, bio, avatar_hue: hue, is_private: !!priv, yearly_goal: 52 + i * 8, ranked_count: 0, created_at: iso(now - (200 + i * 9) * DAY), demo: true },
    };
    const weighted = pool.map((f) => {
      const match = f.g.filter((g) => likes.includes(G[g])).length;
      const era = harsh === -1 ? (f.year < 1970 ? 3 : 0) : 0;
      return [f, (1 + match * 4 + era) * (0.4 + r()) * (1 + f.pop / 120)];
    });
    const n = 28 + Math.floor(r() * 34);
    const picked = [];
    const avail = weighted.slice();
    while (picked.length < n && avail.length) {
      const total = avail.reduce((t, x) => t + x[1], 0);
      let x = r() * total, k = 0;
      while (k < avail.length - 1 && (x -= avail[k][1]) > 0) k++;
      const [f, wt] = avail.splice(k, 1)[0];
      picked.push([f, wt + r() * 3 - (harsh === 1 ? 1.5 : 0)]);
    }
    picked.sort((a, b) => b[1] - a[1]);
    const split = harsh === 1 ? [0.35, 0.75] : [0.55, 0.85];
    const lists = { loved: [], fine: [], disliked: [] };
    picked.forEach(([f], k) => {
      const p = k / picked.length;
      lists[p < split[0] ? "loved" : p < split[1] ? "fine" : "disliked"].push(f.id);
    });
    const rows = [];
    for (const b of ORDER) {
      lists[b].forEach((fid, pos) => {
        const created = now - Math.floor(r() * 75 * DAY) - Math.floor(r() * DAY);
        const note = r() < 0.35 ? NOTES[b][Math.floor(r() * NOTES[b].length)] : "";
        rows.push({
          user_id: id, film_id: fid, bucket: b, pos, score: scoreFor(b, pos, lists[b].length), note,
          watched_on: iso(created).slice(0, 10), watched_where: PLACES[Math.floor(r() * PLACES.length)], watched_with: "", rewatch: r() < 0.12,
          created_at: iso(created), updated_at: iso(created),
        });
      });
    }
    w.rankings[id] = rows;
    w.users[id].profile.ranked_count = rows.length;
    for (const row of rows) {
      if (now - new Date(row.created_at).getTime() < 40 * DAY) {
        w.activities.push({ id: w.seq++, user_id: id, kind: "ranked", film_id: row.film_id, bucket: row.bucket, score: row.score, note: row.note, created_at: row.created_at });
      }
    }
    const taken = new Set(rows.map((x) => x.film_id));
    w.watch[id] = [];
    for (let k = 0; k < 8; k++) {
      const f = pool[Math.floor(r() * 300)];
      if (taken.has(f.id) || w.watch[id].some((x) => x.film_id === f.id)) continue;
      const created = iso(now - Math.floor(r() * 30 * DAY));
      w.watch[id].push({ film_id: f.id, from_user: null, created_at: created });
      if (k < 3) w.activities.push({ id: w.seq++, user_id: id, kind: "want", film_id: f.id, bucket: null, score: null, note: "", created_at: created });
    }
  });

  const r = rng(4242);
  ids.forEach((a) => {
    const others = ids.filter((b) => b !== a).sort(() => r() - 0.5).slice(0, 4 + Math.floor(r() * 4));
    for (const b of others) w.follows.push({ follower: a, followee: b, status: "accepted", created_at: iso(now - Math.floor(r() * 100) * DAY) });
  });
  for (const act of w.activities) {
    const fans = w.follows.filter((f) => f.followee === act.user_id).map((f) => f.follower);
    for (const u of fans) if (r() < 0.3) w.likes.push({ activity_id: act.id, user_id: u, created_at: act.created_at });
    if (act.kind === "ranked" && fans.length && r() < 0.14) {
      const u = fans[Math.floor(r() * fans.length)];
      w.comments.push({ id: w.seq++, activity_id: act.id, user_id: u, body: COMMENTS[Math.floor(r() * COMMENTS.length)], created_at: iso(new Date(act.created_at).getTime() + 3600000) });
    }
  }
  return w;
}

export async function createDemoApi() {
  let w;
  try { w = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!w || w.v !== 1) w = seedWorld();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(w)); } catch {} };
  save();
  let uid = null;
  try { uid = localStorage.getItem(SESSION); } catch {}
  if (uid && !w.users[uid]) uid = null;

  const prof = (id) => w.users[id]?.profile || null;
  const canView = (target) => {
    const p = prof(target);
    if (!p) return false;
    return target === uid || !p.is_private || w.follows.some((f) => f.follower === uid && f.followee === target && f.status === "accepted");
  };
  const notify = (user_id, actor_id, kind, extra = {}) => {
    if (user_id === actor_id) return;
    w.notifications.push({ id: w.seq++, user_id, actor_id, kind, activity_id: null, film_id: null, body: "", read: false, created_at: iso(Date.now()), ...extra });
  };
  const requireUser = () => { if (!uid) throw new Error("Please sign in first"); };
  const isDemo = (id) => !!prof(id)?.demo;
  const demoIds = () => Object.keys(w.users).filter(isDemo);
  const later = (ms, fn) => setTimeout(() => { fn(); save(); api.onChange?.(); }, ms);

  const enrich = (a) => ({
    ...clone(a),
    profile: clone(prof(a.user_id)),
    likes: w.likes.filter((l) => l.activity_id === a.id).length,
    comments: w.comments.filter((c) => c.activity_id === a.id).length,
    liked: w.likes.some((l) => l.activity_id === a.id && l.user_id === uid),
  });

  const api = {
    mode: "demo",
    onChange: null,
    get uid() { return uid; },

    async signUp({ email, password, username, displayName }) {
      email = email.trim().toLowerCase();
      if (Object.values(w.users).some((u) => u.email === email)) throw new Error("An account with that email already exists");
      if (!(await api.usernameAvailable(username))) throw new Error("That username is taken");
      if (password.length < 6) throw new Error("Password should be at least 6 characters");
      const id = "u-" + Math.random().toString(36).slice(2, 10);
      w.users[id] = {
        email, pw: await hashPw(password),
        profile: { id, username, display_name: displayName || username, bio: "", avatar_hue: Math.floor(Math.random() * 360), is_private: false, yearly_goal: 52, ranked_count: 0, created_at: iso(Date.now()) },
      };
      w.rankings[id] = [];
      w.watch[id] = [];
      uid = id;
      try { localStorage.setItem(SESSION, id); } catch {}
      save();
      return { needsConfirm: false };
    },
    async signIn({ email, password }) {
      email = email.trim().toLowerCase();
      const entry = Object.entries(w.users).find(([, u]) => u.email === email);
      if (!entry || entry[1].pw !== (await hashPw(password))) throw new Error("Wrong email or password");
      uid = entry[0];
      try { localStorage.setItem(SESSION, uid); } catch {}
    },
    async signOut() { uid = null; try { localStorage.removeItem(SESSION); } catch {} },
    async resetPassword() { throw new Error("Password reset needs a server. In demo mode, create a new account instead."); },
    async updatePassword(password) {
      requireUser();
      if (password.length < 6) throw new Error("Password should be at least 6 characters");
      w.users[uid].pw = await hashPw(password);
      save();
    },
    async usernameAvailable(name) {
      return /^[a-z0-9_.]{3,20}$/.test(name) && !Object.values(w.users).some((u) => u.profile.username === name);
    },
    async deleteAccount() {
      requireUser();
      const id = uid;
      delete w.users[id];
      delete w.rankings[id];
      delete w.watch[id];
      const acts = new Set(w.activities.filter((a) => a.user_id === id).map((a) => a.id));
      w.activities = w.activities.filter((a) => a.user_id !== id);
      w.likes = w.likes.filter((l) => l.user_id !== id && !acts.has(l.activity_id));
      w.comments = w.comments.filter((c) => c.user_id !== id && !acts.has(c.activity_id));
      w.follows = w.follows.filter((f) => f.follower !== id && f.followee !== id);
      w.recs = w.recs.filter((x) => x.from_user !== id && x.to_user !== id);
      w.notifications = w.notifications.filter((n) => n.user_id !== id && n.actor_id !== id);
      save();
      await api.signOut();
    },

    async getProfile(id) { return clone(prof(id)); },
    async getProfileByUsername(username) { return clone(Object.values(w.users).find((u) => u.profile.username === username)?.profile || null); },
    async updateProfile(patch) {
      requireUser();
      if (patch.username && patch.username !== prof(uid).username && !(await api.usernameAvailable(patch.username))) throw new Error("That username is taken");
      const allowed = ["username", "display_name", "bio", "avatar_hue", "is_private", "yearly_goal"];
      for (const k of allowed) if (k in patch) w.users[uid].profile[k] = patch[k];
      if (patch.is_private === false) w.follows.forEach((f) => { if (f.followee === uid && f.status === "pending") f.status = "accepted"; });
      save();
      return clone(prof(uid));
    },
    async searchUsers(q, limit = 20) {
      const s = q.trim().toLowerCase();
      if (!s) return [];
      return clone(Object.values(w.users).map((u) => u.profile).filter((p) => p.username.includes(s) || p.display_name.toLowerCase().includes(s)).slice(0, limit));
    },
    async listProfiles({ ids = null, limit = 50 } = {}) {
      let ps = Object.values(w.users).map((u) => u.profile);
      if (ids) ps = ps.filter((p) => ids.includes(p.id));
      return clone(ps.sort((a, b) => b.ranked_count - a.ranked_count).slice(0, limit));
    },

    async getRankings(userId) { return canView(userId) ? clone(w.rankings[userId] || []) : []; },
    async rankingsOfUsers(ids) {
      return ids.filter(canView).flatMap((id) => (w.rankings[id] || []).map(({ user_id, film_id, bucket, score, created_at }) => ({ user_id, film_id, bucket, score, created_at })));
    },
    async rankingsForFilm(filmId) {
      const out = [];
      for (const id of Object.keys(w.rankings)) {
        if (!canView(id)) continue;
        const r = w.rankings[id].find((x) => x.film_id === filmId);
        if (r) out.push({ ...clone(r), profile: clone(prof(id)) });
      }
      return out;
    },
    async saveLists(lists) {
      requireUser();
      const all = [...lists.loved, ...lists.fine, ...lists.disliked];
      if (new Set(all).size !== all.length) throw new Error("A film can only appear once");
      const old = new Map((w.rankings[uid] || []).map((r) => [r.film_id, r]));
      const now = iso(Date.now());
      const rows = [];
      for (const b of ORDER) {
        lists[b].forEach((fid, pos) => {
          const prev = old.get(fid);
          rows.push({
            note: "", watched_on: null, watched_where: "", watched_with: "", rewatch: false, created_at: now, updated_at: now,
            ...prev, user_id: uid, film_id: fid, bucket: b, pos, score: scoreFor(b, pos, lists[b].length),
            ...(prev && prev.bucket !== b && { updated_at: now }),
          });
        });
      }
      w.rankings[uid] = rows;
      w.users[uid].profile.ranked_count = rows.length;
      save();
    },
    async updateEntry(filmId, patch) {
      requireUser();
      const r = (w.rankings[uid] || []).find((x) => x.film_id === filmId);
      if (!r) return;
      for (const k of ["note", "watched_on", "watched_where", "watched_with", "rewatch"]) if (k in patch) r[k] = patch[k];
      save();
    },

    async getWatchlist(userId) {
      if (!canView(userId)) return [];
      return clone([...(w.watch[userId] || [])].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    },
    async addWatch(filmId, fromUser = null) {
      requireUser();
      const list = (w.watch[uid] ||= []);
      if (!list.some((x) => x.film_id === filmId)) list.push({ film_id: filmId, from_user: fromUser, created_at: iso(Date.now()) });
      save();
    },
    async removeWatch(filmId) {
      requireUser();
      w.watch[uid] = (w.watch[uid] || []).filter((x) => x.film_id !== filmId);
      save();
    },

    async follow(id) {
      requireUser();
      if (id === uid) throw new Error("You can't follow yourself");
      let f = w.follows.find((x) => x.follower === uid && x.followee === id);
      if (!f) {
        f = { follower: uid, followee: id, status: prof(id).is_private ? "pending" : "accepted", created_at: iso(Date.now()) };
        w.follows.push(f);
        notify(id, uid, f.status === "pending" ? "follow_request" : "follow");
        if (isDemo(id) && !isDemo(uid)) {
          if (f.status === "pending") {
            later(5000, () => {
              const g = w.follows.find((x) => x.follower === uid && x.followee === id);
              if (g && g.status === "pending") { g.status = "accepted"; notify(uid, id, "follow_accepted"); }
            });
          } else if (Math.random() < 0.7) {
            later(3500, () => {
              if (w.users[uid] && !w.follows.some((x) => x.follower === id && x.followee === uid)) {
                w.follows.push({ follower: id, followee: uid, status: prof(uid).is_private ? "pending" : "accepted", created_at: iso(Date.now()) });
                notify(uid, id, prof(uid).is_private ? "follow_request" : "follow");
              }
            });
          }
        }
        save();
      }
      return f.status;
    },
    async unfollow(id) { w.follows = w.follows.filter((x) => !(x.follower === uid && x.followee === id)); save(); },
    async removeFollower(id) { w.follows = w.follows.filter((x) => !(x.follower === id && x.followee === uid)); save(); },
    async approveFollower(id) {
      const f = w.follows.find((x) => x.follower === id && x.followee === uid);
      if (f && f.status === "pending") {
        f.status = "accepted";
        w.notifications = w.notifications.filter((n) => !(n.user_id === uid && n.actor_id === id && n.kind === "follow_request"));
        notify(id, uid, "follow_accepted");
        save();
      }
    },
    async getFollows(userId) {
      const row = (id, f) => ({ id, status: f.status, created_at: f.created_at, profile: clone(prof(id)) });
      return {
        following: w.follows.filter((f) => f.follower === userId && prof(f.followee)).map((f) => row(f.followee, f)),
        followers: w.follows.filter((f) => f.followee === userId && prof(f.follower)).map((f) => row(f.follower, f)),
      };
    },

    async postActivity(a) {
      requireUser();
      const act = { id: w.seq++, user_id: uid, kind: a.kind, film_id: a.film_id, bucket: a.bucket ?? null, score: a.score ?? null, note: a.note || "", created_at: iso(Date.now()) };
      w.activities.push(act);
      save();
      if (!isDemo(uid) && act.kind === "ranked") {
        const fans = w.follows.filter((f) => f.followee === uid && f.status === "accepted" && isDemo(f.follower)).map((f) => f.follower);
        const pool = fans.length ? fans : demoIds().slice(0, 3);
        const who = pool.sort(() => Math.random() - 0.5).slice(0, Math.min(2, pool.length));
        who.forEach((u, k) => later(4000 + k * 3000, () => {
          if (!w.activities.some((x) => x.id === act.id) || w.likes.some((l) => l.activity_id === act.id && l.user_id === u)) return;
          w.likes.push({ activity_id: act.id, user_id: u, created_at: iso(Date.now()) });
          notify(uid, u, "like", { activity_id: act.id, film_id: act.film_id });
          if (k === 0 && Math.random() < 0.5) {
            const body = COMMENTS[Math.floor(Math.random() * COMMENTS.length)];
            w.comments.push({ id: w.seq++, activity_id: act.id, user_id: u, body, created_at: iso(Date.now()) });
            notify(uid, u, "comment", { activity_id: act.id, film_id: act.film_id, body });
          }
        }));
      }
      return clone(act);
    },
    async getFeed({ userIds = null, before = null, limit = 20 } = {}) {
      return w.activities
        .filter((a) => (userIds ? userIds.includes(a.user_id) : true) && canView(a.user_id) && (!before || a.created_at < before))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit)
        .map(enrich);
    },
    async deleteActivity(id) {
      const a = w.activities.find((x) => x.id === id);
      if (!a || a.user_id !== uid) return;
      w.activities = w.activities.filter((x) => x.id !== id);
      w.likes = w.likes.filter((l) => l.activity_id !== id);
      w.comments = w.comments.filter((c) => c.activity_id !== id);
      w.notifications = w.notifications.filter((n) => n.activity_id !== id);
      save();
    },
    async like(id) {
      requireUser();
      const a = w.activities.find((x) => x.id === id);
      if (!a || !canView(a.user_id) || w.likes.some((l) => l.activity_id === id && l.user_id === uid)) return;
      w.likes.push({ activity_id: id, user_id: uid, created_at: iso(Date.now()) });
      notify(a.user_id, uid, "like", { activity_id: id, film_id: a.film_id });
      save();
    },
    async unlike(id) { w.likes = w.likes.filter((l) => !(l.activity_id === id && l.user_id === uid)); save(); },
    async getComments(activityId) {
      return w.comments.filter((c) => c.activity_id === activityId).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => ({ ...clone(c), profile: clone(prof(c.user_id)) }));
    },
    async addComment(activityId, body) {
      requireUser();
      const a = w.activities.find((x) => x.id === activityId);
      if (!a || !canView(a.user_id)) throw new Error("That post is no longer available");
      const c = { id: w.seq++, activity_id: activityId, user_id: uid, body: body.slice(0, 500), created_at: iso(Date.now()) };
      w.comments.push(c);
      notify(a.user_id, uid, "comment", { activity_id: activityId, film_id: a.film_id, body: c.body.slice(0, 140) });
      save();
      return { ...clone(c), profile: clone(prof(uid)) };
    },
    async deleteComment(id) {
      const c = w.comments.find((x) => x.id === id);
      const a = c && w.activities.find((x) => x.id === c.activity_id);
      if (c && (c.user_id === uid || a?.user_id === uid)) { w.comments = w.comments.filter((x) => x.id !== id); save(); }
    },

    async getNotifications(limit = 50) {
      return w.notifications.filter((n) => n.user_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).map((n) => ({ ...clone(n), actor: clone(prof(n.actor_id)) }));
    },
    async unreadCount() { return w.notifications.filter((n) => n.user_id === uid && !n.read).length; },
    async markNotificationsRead() { w.notifications.forEach((n) => { if (n.user_id === uid) n.read = true; }); save(); },

    async sendRec(toId, filmId, message) {
      requireUser();
      w.recs.push({ id: w.seq++, from_user: uid, to_user: toId, film_id: filmId, message: message.slice(0, 280), created_at: iso(Date.now()) });
      notify(toId, uid, "rec", { film_id: filmId, body: message.slice(0, 140) });
      save();
    },
    async getRecsForMe() {
      return w.recs.filter((x) => x.to_user === uid).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((x) => ({ ...clone(x), profile: clone(prof(x.from_user)) }));
    },
    async deleteRec(id) { w.recs = w.recs.filter((x) => !(x.id === id && (x.to_user === uid || x.from_user === uid))); save(); },

    async filmStats(ids) {
      const set = new Set(ids);
      const acc = new Map();
      for (const rows of Object.values(w.rankings)) for (const r of rows) {
        if (!set.has(r.film_id)) continue;
        const e = acc.get(r.film_id) || { film_id: r.film_id, sum: 0, n: 0 };
        e.sum += r.score; e.n++;
        acc.set(r.film_id, e);
      }
      return new Map([...acc.values()].map((e) => [e.film_id, { film_id: e.film_id, avg_score: Math.round((e.sum / e.n) * 10) / 10, n: e.n }]));
    },
    async topFilms(minCount = 2, limit = 30) {
      const all = await api.filmStats([...new Set(Object.values(w.rankings).flat().map((r) => r.film_id))]);
      return [...all.values()].filter((e) => e.n >= minCount).sort((a, b) => b.avg_score - a.avg_score || b.n - a.n).slice(0, limit);
    },

    resetDemo() { localStorage.removeItem(KEY); localStorage.removeItem(SESSION); },
  };
  return api;
}
