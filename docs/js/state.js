// The signed-in user's data, cached in memory, plus the actions that change it.
import { api } from "./api/index.js";
import { ORDER, scoreFor, listsFromRows, rowsWithScores, tasteMatch } from "./model.js";
import { toast } from "./util.js";

const blankLists = () => ({ loved: [], fine: [], disliked: [] });

export const S = {
  me: null,
  lists: blankLists(),
  entries: new Map(),
  watch: [],
  following: new Map(),
  followers: [],
  friendRows: null,
  matches: new Map(),
  unread: 0,
  skip: new Set(),
};

const skipKey = () => `movi.skip.${S.me?.id}`;

export async function loadSession() {
  if (!api.uid) return clearSession();
  const uid = api.uid;
  const [me, rows, watch, follows] = await Promise.all([api.getProfile(uid), api.getRankings(uid), api.getWatchlist(uid), api.getFollows(uid)]);
  if (!me) {
    await api.signOut();
    return clearSession();
  }
  S.me = me;
  S.lists = listsFromRows(rows);
  S.entries = new Map(rows.map((r) => [r.film_id, r]));
  S.watch = watch;
  S.following = new Map(follows.following.map((f) => [f.id, f.status]));
  S.followers = follows.followers;
  S.friendRows = null;
  S.matches = new Map();
  try { S.skip = new Set(JSON.parse(localStorage.getItem(skipKey()) || "[]")); } catch { S.skip = new Set(); }
  refreshUnread();
  return me;
}

export function clearSession() {
  Object.assign(S, { me: null, lists: blankLists(), entries: new Map(), watch: [], following: new Map(), followers: [], friendRows: null, matches: new Map(), unread: 0, skip: new Set() });
  return null;
}

export const signedIn = () => !!S.me;
export const rankedIds = () => ORDER.flatMap((b) => S.lists[b]);
export const rankedCount = () => rankedIds().length;
export const myRows = () => rowsWithScores([...S.entries.values()].filter((r) => findBucket(r.film_id)).map((r) => ({ ...r, ...placement(r.film_id) })));
export const isWatch = (id) => S.watch.some((w) => w.film_id === id);
export const followingIds = () => [...S.following].filter(([, s]) => s === "accepted").map(([id]) => id);
export const followStatus = (id) => S.following.get(id) || null;
export const acceptedFollowers = () => S.followers.filter((f) => f.status === "accepted");
export const pendingRequests = () => S.followers.filter((f) => f.status === "pending");

function findBucket(id) {
  for (const b of ORDER) if (S.lists[b].includes(id)) return b;
  return null;
}
function placement(id) {
  const b = findBucket(id);
  return { bucket: b, pos: S.lists[b].indexOf(id) };
}

export function scoreOf(id) {
  let offset = 0;
  for (const b of ORDER) {
    const list = S.lists[b];
    const i = list.indexOf(id);
    if (i >= 0) return { b, i, n: list.length, score: scoreFor(b, i, list.length), overall: offset + i + 1 };
    offset += list.length;
  }
  return null;
}

export const avgScore = () => {
  const ids = rankedIds();
  return ids.length ? ids.reduce((t, id) => t + scoreOf(id).score, 0) / ids.length : 0;
};

async function persistLists(prev) {
  try {
    await api.saveLists(S.lists);
    S.me.ranked_count = rankedCount();
    recomputeMatches();
  } catch (e) {
    S.lists = prev;
    toast("Couldn't save your ranking: " + e.message);
    throw e;
  }
}
const copyLists = () => ({ loved: [...S.lists.loved], fine: [...S.lists.fine], disliked: [...S.lists.disliked] });

export function detachRanking(id) {
  const prev = copyLists();
  const place = scoreOf(id);
  for (const b of ORDER) S.lists[b] = S.lists[b].filter((x) => x !== id);
  return { prev, place };
}
export function restoreLists(prev) { S.lists = prev; }

export async function commitRanking({ filmId, bucket, index, prev }) {
  S.lists[bucket].splice(index, 0, filmId);
  await persistLists(prev);
  const now = new Date().toISOString();
  const entry = { note: "", watched_on: null, watched_where: "", watched_with: "", rewatch: false, created_at: now, ...S.entries.get(filmId), film_id: filmId };
  S.entries.set(filmId, entry);
  if (isWatch(filmId)) await removeWatch(filmId, true);
  S.skip.delete(filmId);
  saveSkip();
}

export async function removeRanking(id) {
  const { prev } = detachRanking(id);
  await persistLists(prev);
  S.entries.delete(id);
}

export async function updateDetails(id, patch) {
  const e = S.entries.get(id);
  if (!e) return;
  Object.assign(e, patch);
  try { await api.updateEntry(id, patch); } catch (err) { toast("Couldn't save details: " + err.message); }
}

export async function addWatch(id, fromUser = null) {
  if (isWatch(id)) return;
  S.watch.unshift({ film_id: id, from_user: fromUser, created_at: new Date().toISOString() });
  try {
    await api.addWatch(id, fromUser);
    api.postActivity({ kind: "want", film_id: id }).catch(() => {});
  } catch (e) {
    S.watch = S.watch.filter((w) => w.film_id !== id);
    toast("Couldn't save: " + e.message);
  }
}
export async function removeWatch(id, quiet = false) {
  const prev = S.watch;
  S.watch = S.watch.filter((w) => w.film_id !== id);
  try { await api.removeWatch(id); } catch (e) { S.watch = prev; if (!quiet) toast("Couldn't remove: " + e.message); }
}

export function skipFilm(id) { S.skip.add(id); saveSkip(); }
function saveSkip() { try { localStorage.setItem(skipKey(), JSON.stringify([...S.skip])); } catch {} }

export async function follow(id) {
  const status = await api.follow(id);
  S.following.set(id, status);
  S.friendRows = null;
  return status;
}
export async function unfollow(id) {
  await api.unfollow(id);
  S.following.delete(id);
  S.friendRows = null;
}
export async function approveFollower(id) {
  await api.approveFollower(id);
  const f = S.followers.find((x) => x.id === id);
  if (f) f.status = "accepted";
}
export async function removeFollower(id) {
  await api.removeFollower(id);
  S.followers = S.followers.filter((x) => x.id !== id);
}
export async function reloadFollows() {
  const f = await api.getFollows(S.me.id);
  S.following = new Map(f.following.map((x) => [x.id, x.status]));
  S.followers = f.followers;
}

export async function loadFriendRows() {
  if (S.friendRows) return S.friendRows;
  S.friendRows = await api.rankingsOfUsers(followingIds());
  recomputeMatches();
  return S.friendRows;
}
function recomputeMatches() {
  if (!S.friendRows) return;
  const mine = myRows();
  const byUser = new Map();
  for (const r of S.friendRows) (byUser.get(r.user_id) || byUser.set(r.user_id, []).get(r.user_id)).push(r);
  S.matches = new Map([...byUser].map(([u, rows]) => [u, tasteMatch(mine, rows).pct]));
}
export const friendRowsFor = (filmId) => (S.friendRows || []).filter((r) => r.film_id === filmId);

export async function refreshUnread() {
  if (!S.me) return 0;
  try { S.unread = await api.unreadCount(); } catch {}
  document.dispatchEvent(new CustomEvent("movi:unread"));
  return S.unread;
}

export async function updateMe(patch) {
  S.me = await api.updateProfile(patch);
  return S.me;
}
