import { ICON } from "./util.js";
import { film, genreNames, genreFreq } from "./films.js";

export const BUCKETS = {
  loved: { label: "I loved it", short: "Loved", lo: 6.8, hi: 10, icon: ICON.heart, hint: "Scores 6.8 – 10" },
  fine: { label: "It was fine", short: "Fine", lo: 3.4, hi: 6.7, icon: ICON.meh, hint: "Scores 3.4 – 6.7" },
  disliked: { label: "Didn't like it", short: "Didn't like", lo: 0, hi: 3.3, icon: ICON.down, hint: "Scores 0 – 3.3" },
};
export const ORDER = ["loved", "fine", "disliked"];

// Keep in sync with public.movi_score() in supabase/migrations.
export function scoreFor(bucket, i, n) {
  const { lo, hi } = BUCKETS[bucket];
  const s = n <= 1 ? lo + (hi - lo) * 0.75 : hi - (hi - lo) * (i / (n - 1));
  return Math.round(s * 10) / 10;
}

export const bucketForScore = (s) => (s >= 6.8 ? "loved" : s >= 3.4 ? "fine" : "disliked");

export function listsFromRows(rows) {
  const lists = { loved: [], fine: [], disliked: [] };
  for (const r of [...rows].sort((a, b) => a.pos - b.pos)) lists[r.bucket]?.push(r.film_id);
  return lists;
}

export function rowsWithScores(rows) {
  const lists = listsFromRows(rows);
  const byId = new Map(rows.map((r) => [r.film_id, r]));
  let offset = 0;
  const out = [];
  for (const b of ORDER) {
    lists[b].forEach((id, i) => out.push({ ...byId.get(id), bucket: b, pos: i, score: scoreFor(b, i, lists[b].length), overall: offset + i + 1 }));
    offset += lists[b].length;
  }
  return out;
}

export function tasteMatch(rowsA, rowsB) {
  const a = new Map(rowsA.map((r) => [r.film_id, Number(r.score)]));
  const common = [];
  for (const r of rowsB) if (a.has(r.film_id)) common.push([r.film_id, a.get(r.film_id), Number(r.score)]);
  if (common.length < 3) return { pct: null, common };
  const diff = common.reduce((t, [, x, y]) => t + Math.abs(x - y), 0) / common.length;
  return { pct: Math.max(0, Math.min(100, Math.round(100 - diff * 11))), common };
}

export function recScore(friendRows, matches, global) {
  if (friendRows.length) {
    let w = 0, s = 0;
    for (const r of friendRows) {
      const m = matches.get(r.user_id);
      const wt = Math.pow((m ?? 60) / 100, 2) + 0.05;
      w += wt;
      s += wt * Number(r.score);
    }
    let score = s / w;
    if (global && global.n > friendRows.length && friendRows.length < 3) score = score * 0.7 + Number(global.avg_score) * 0.3;
    return { score: Math.round(score * 10) / 10, basis: "friends", n: friendRows.length };
  }
  if (global && global.n) return { score: Number(global.avg_score), basis: "everyone", n: Number(global.n) };
  return null;
}

export function genreAffinity(rows, genreCount) {
  const a = new Array(genreCount).fill(0);
  for (const r of rows) {
    const w = (Number(r.score) - 5) / 5;
    for (const g of film(r.film_id).g) a[g] += w;
  }
  return a;
}

export function tasteStats(rows) {
  const stats = new Map();
  for (const r of rows) {
    for (const g of genreNames(film(r.film_id))) {
      const e = stats.get(g) || { g, n: 0, sum: 0 };
      e.n++;
      e.sum += Number(r.score);
      stats.set(g, e);
    }
  }
  return [...stats.values()].sort((a, b) => b.n - a.n || b.sum - a.sum);
}

const ARCHETYPES = {
  Horror: "The Night Owl", "Science Fiction": "The Futurist", Animated: "The Dreamer", Drama: "The Auteur",
  Comedy: "The Jester", Action: "The Thrill Seeker", Romance: "The Romantic", Crime: "The Detective",
  Thriller: "The Detective", Mystery: "The Detective", Noir: "The Detective", Western: "The Drifter",
  War: "The Historian", Historical: "The Historian", Biography: "The Historian", Musical: "The Showstopper",
  Superhero: "The Hero Collector", Fantasy: "The Myth Maker", Adventure: "The Explorer", Documentary: "The Truth Seeker",
};
export function archetype(rows) {
  if (rows.length < 3) return "Just getting started";
  const min = rows.length >= 12 ? 3 : 2;
  const top = tasteStats(rows)
    .filter((e) => ARCHETYPES[e.g] && e.n >= min)
    .map((e) => ({ ...e, lift: (e.n / rows.length / Math.sqrt(genreFreq(e.g))) * (e.sum / e.n / 10) }))
    .sort((a, b) => b.lift - a.lift)[0];
  const base = top ? ARCHETYPES[top.g] : "The Explorer";
  const avg = rows.reduce((t, r) => t + Number(r.score), 0) / rows.length;
  return avg >= 7.5 ? `${base} · easy to please` : avg <= 4.5 ? `${base} · tough critic` : base;
}

const WEEK = 7 * 86400000;
const MONDAY = Date.UTC(1970, 0, 5);
const weekOf = (t) => Math.floor((t - MONDAY) / WEEK);

export function streaks(rows) {
  const weeks = new Set(rows.map((r) => weekOf(new Date(r.created_at).getTime())));
  const now = weekOf(Date.now());
  let cur = 0;
  let w = weeks.has(now) ? now : now - 1;
  while (weeks.has(w)) { cur++; w--; }
  let longest = 0, run = 0, prev = null;
  for (const x of [...weeks].sort((a, b) => a - b)) {
    run = prev !== null && x === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = x;
  }
  return { current: cur, longest, activeThisWeek: weeks.has(now) };
}

export function goalProgress(rows, goal) {
  const year = new Date().getFullYear();
  const done = rows.filter((r) => new Date(r.watched_on || r.created_at).getFullYear() === year).length;
  return { year, done, goal, pct: Math.min(100, Math.round((done / goal) * 100)) };
}

export function badges({ rows, followers = 0, following = 0 }) {
  const n = rows.length;
  const genreSet = new Set(rows.flatMap((r) => genreNames(film(r.film_id))));
  const decades = new Set(rows.map((r) => Math.floor(film(r.film_id).year / 10)));
  const count = (fn) => rows.filter(fn).length;
  const st = streaks(rows);
  const defs = [
    ["first", "First Take", "Rank your first film", n, 1],
    ["ten", "Getting Into It", "Rank 10 films", n, 10],
    ["fifty", "Cinephile", "Rank 50 films", n, 50],
    ["hundred", "Film Buff", "Rank 100 films", n, 100],
    ["twofifty", "Archivist", "Rank 250 films", n, 250],
    ["fivehundred", "Projectionist", "Rank 500 films", n, 500],
    ["genres", "Genre Hopper", "Rank films in 10 genres", genreSet.size, 10],
    ["decades", "Time Traveler", "Rank films from 6 decades", decades.size, 6],
    ["classics", "Golden Age", "Rank 10 films from before 1960", count((r) => film(r.film_id).year < 1960), 10],
    ["loved", "Superfan", "Love 25 films", count((r) => r.bucket === "loved"), 25],
    ["critic", "Tough Crowd", "Dislike 10 films", count((r) => r.bucket === "disliked"), 10],
    ["notes", "Critic's Notebook", "Write 10 notes", count((r) => (r.note || "").trim()), 10],
    ["rewatch", "Rewatcher", "Log 5 rewatches", count((r) => r.rewatch), 5],
    ["theater", "Front Row", "Watch 5 films in a theater", count((r) => r.watched_where === "Theater"), 5],
    ["streak", "On a Roll", "Rank films 4 weeks in a row", st.longest, 4],
    ["social", "Social Butterfly", "Follow 5 people", following, 5],
    ["tastemaker", "Tastemaker", "Get 5 followers", followers, 5],
  ];
  return defs.map(([id, name, desc, value, target]) => ({ id, name, desc, value: Math.min(value, target), target, earned: value >= target }));
}
