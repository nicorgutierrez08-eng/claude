import { norm } from "./util.js";

let DB = null;
const shardCache = new Map();

export async function loadFilms() {
  const res = await fetch("data/index.json");
  if (!res.ok) throw new Error(`index.json ${res.status}`);
  const raw = await res.json();
  DB = {
    genres: raw.genres,
    shard: raw.shard,
    posterBase: raw.posterBase,
    films: raw.films.map(([title, year, g, poster, pop], id) => ({ id, title, year, g, poster, pop, n: norm(title) })),
  };
  const counts = new Array(DB.genres.length).fill(0);
  DB.films.slice(0, 3000).forEach((f) => f.g.forEach((g) => counts[g]++));
  DB.genreFreq = counts.map((c) => Math.max(c, 1) / 3000);
  return DB;
}

export const genreFreq = (name) => DB.genreFreq[DB.genres.indexOf(name)] ?? 0.05;

export const filmCount = () => DB.films.length;
export const allFilms = () => DB.films;
export const genres = () => DB.genres;
export const film = (id) => DB.films[id];
export const isFilmId = (id) => Number.isInteger(id) && id >= 0 && id < DB.films.length;
const TMDB_IMG = "https://image.tmdb.org/t/p/w342";
export const posterUrl = (f) =>
  !f.poster ? "" : f.poster[0] === "~" ? TMDB_IMG + f.poster.slice(1) : f.poster.startsWith("http") ? f.poster : DB.posterBase + f.poster;
export const genreNames = (f) => f.g.map((i) => DB.genres[i]);
export const genreIndex = (name) => DB.genres.indexOf(name);

export function details(id) {
  const n = Math.floor(id / DB.shard);
  if (!shardCache.has(n)) {
    shardCache.set(
      n,
      fetch(`data/details/${n}.json`)
        .then((r) => r.json())
        .catch(() => {
          shardCache.delete(n);
          return [];
        }),
    );
  }
  return shardCache.get(n).then((rows) => {
    const [cast = [], plot = "", href = ""] = rows[id % DB.shard] || [];
    return { cast, plot, href };
  });
}

const YEAR = /^(19|20)\d\d$/;

export function searchFilms({ q = "", genre = "", decade = "", sort = "pop", exclude = null } = {}) {
  const tokens = norm(q).split(" ").filter(Boolean);
  const years = tokens.filter((t) => YEAR.test(t)).map(Number);
  const words = tokens.filter((t) => !YEAR.test(t));
  const g = genre ? DB.genres.indexOf(genre) : -1;
  const dec = decade ? Number(decade) : null;
  const phrase = words.join(" ");
  const out = [];
  for (const f of DB.films) {
    if (exclude && exclude.has(f.id)) continue;
    if (g >= 0 && !f.g.includes(g)) continue;
    if (dec !== null && (f.year < dec || f.year >= dec + 10)) continue;
    let rel = 0;
    if (years.length) {
      const titleHasYear = years.every((y) => ` ${f.n} `.includes(` ${y} `));
      if (!years.includes(f.year) && !titleHasYear) continue;
      if (titleHasYear) rel += 2;
    }
    if (words.length) {
      if (!words.every((w) => f.n.includes(w))) continue;
      rel += f.n === phrase ? 3 : f.n.startsWith(phrase) ? 2 : ` ${f.n}`.includes(` ${words[0]}`) ? 1 : 0;
    }
    out.push([rel, f]);
  }
  const sorters = {
    pop: (a, b) => b[0] - a[0] || a[1].id - b[1].id,
    new: (a, b) => b[0] - a[0] || b[1].year - a[1].year || a[1].id - b[1].id,
    old: (a, b) => b[0] - a[0] || a[1].year - b[1].year || a[1].id - b[1].id,
    az: (a, b) => a[1].n.localeCompare(b[1].n),
  };
  return out.sort(sorters[sort] || sorters.pop).map((x) => x[1]);
}

export function topByGenre(name, limit = 20, exclude = null) {
  const g = DB.genres.indexOf(name);
  const out = [];
  for (const f of DB.films) {
    if (f.g.includes(g) && !(exclude && exclude.has(f.id))) out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}
