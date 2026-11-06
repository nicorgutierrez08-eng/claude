const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

const ICON = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  meh: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M9 15h6M9.5 10h.01M14.5 10h.01"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M7 14V4M7 14l4 6a2 2 0 0 0 2-2v-4h5a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 16.8 4H7"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  rank: '<svg viewBox="0 0 24 24"><path d="M8 21V11M16 21V7M12 21V3M4 21h16"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

const BUCKETS = {
  loved: { label: "I loved it", short: "Loved", lo: 6.8, hi: 10, icon: ICON.heart, hint: "Scores 6.8 – 10" },
  fine: { label: "It was fine", short: "Fine", lo: 3.4, hi: 6.7, icon: ICON.meh, hint: "Scores 3.4 – 6.7" },
  disliked: { label: "Didn't like it", short: "Didn't like", lo: 0, hi: 3.3, icon: ICON.down, hint: "Scores 0 – 3.3" },
};
const ORDER = ["loved", "fine", "disliked"];

/* ---------------- Storage ---------------- */
const KEY = "movi.v1";
const blank = () => ({ name: "", lists: { loved: [], fine: [], disliked: [] }, meta: {}, watch: [], skip: [] });
let S = loadStore();

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.lists) return { ...blank(), ...s, lists: { ...blank().lists, ...s.lists } };
  } catch {}
  return blank();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {}
}

/* ---------------- Database ---------------- */
let DB = null;
const shardCache = new Map();

async function loadDB() {
  const res = await fetch("data/index.json");
  if (!res.ok) throw new Error(res.status);
  const raw = await res.json();
  DB = {
    genres: raw.genres,
    shard: raw.shard,
    posterBase: raw.posterBase,
    films: raw.films.map(([title, year, g, poster, pop], id) => ({ id, title, year, g, poster, pop, n: norm(title) })),
  };
}

function details(id) {
  const n = Math.floor(id / DB.shard);
  if (!shardCache.has(n)) {
    shardCache.set(n, fetch(`data/details/${n}.json`).then((r) => r.json()).catch(() => { shardCache.delete(n); return []; }));
  }
  return shardCache.get(n).then((rows) => {
    const [cast = [], plot = "", href = ""] = rows[id % DB.shard] || [];
    return { cast, plot, href };
  });
}

const film = (id) => DB.films[id];
const posterUrl = (f) => (!f.poster ? "" : f.poster.startsWith("http") ? f.poster : DB.posterBase + f.poster);
const genreNames = (f) => f.g.map((i) => DB.genres[i]);

/* ---------------- Ranking model ---------------- */
function scoreFor(bucket, i, n) {
  const { lo, hi } = BUCKETS[bucket];
  const s = n === 1 ? lo + (hi - lo) * 0.75 : hi - (hi - lo) * (i / (n - 1));
  return Math.round(s * 10) / 10;
}
function scoreOf(id) {
  let offset = 0;
  for (const b of ORDER) {
    const list = S.lists[b];
    const i = list.indexOf(id);
    if (i >= 0) return { b, i, n: list.length, score: scoreFor(b, i, list.length), overall: offset + i + 1 };
    offset += list.length;
  }
  return null;
}
const ranked = () => ORDER.flatMap((b) => S.lists[b]);
const rankedCount = () => ranked().length;
const avgScore = () => {
  const ids = ranked();
  return ids.length ? ids.reduce((a, id) => a + scoreOf(id).score, 0) / ids.length : 0;
};
function removeRanked(id) {
  for (const b of ORDER) S.lists[b] = S.lists[b].filter((x) => x !== id);
}

/* ---------------- Recommendations ---------------- */
function affinity() {
  const a = new Array(DB.genres.length).fill(0);
  for (const id of ranked()) {
    const w = (scoreOf(id).score - 5) / 5;
    for (const g of film(id).g) a[g] += w;
  }
  return a;
}
function recommend(limit, seed = null) {
  const taken = new Set([...ranked(), ...S.skip, ...(seed ? [seed.id] : [])]);
  const aff = affinity();
  const out = [];
  const pool = Math.min(DB.films.length, 6000);
  for (let i = 0; i < pool; i++) {
    const f = DB.films[i];
    if (taken.has(f.id) || !f.g.length) continue;
    let s = f.pop / 20;
    if (seed) {
      const overlap = f.g.filter((g) => seed.g.includes(g)).length;
      if (!overlap) continue;
      s += overlap * 2.5 - Math.abs(f.year - seed.year) / 12;
    } else {
      s += f.g.reduce((t, g) => t + aff[g], 0) / Math.sqrt(f.g.length);
    }
    out.push([s, f]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
}
function topByGenre(name, limit = 20) {
  const g = DB.genres.indexOf(name);
  const out = [];
  for (const f of DB.films) {
    if (f.g.includes(g)) out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

const ARCHETYPES = {
  Horror: "The Night Owl", "Science Fiction": "The Futurist", Animated: "The Dreamer", Drama: "The Auteur",
  Comedy: "The Jester", Action: "The Thrill Seeker", Romance: "The Romantic", Crime: "The Detective",
  Thriller: "The Detective", Mystery: "The Detective", Noir: "The Detective", Western: "The Drifter",
  War: "The Historian", Historical: "The Historian", Biography: "The Historian", Musical: "The Showstopper",
  Superhero: "The Hero Collector", Fantasy: "The Myth Maker", Adventure: "The Explorer", Documentary: "The Truth Seeker",
};
function tasteStats() {
  const stats = new Map();
  for (const id of ranked()) {
    const s = scoreOf(id).score;
    for (const g of genreNames(film(id))) {
      const e = stats.get(g) || { g, n: 0, sum: 0 };
      e.n++; e.sum += s;
      stats.set(g, e);
    }
  }
  return [...stats.values()].sort((a, b) => b.n - a.n || b.sum - a.sum);
}
function archetype() {
  if (rankedCount() < 3) return "Just getting started";
  const top = tasteStats().find((e) => ARCHETYPES[e.g]);
  const base = top ? ARCHETYPES[top.g] : "The Explorer";
  const avg = avgScore();
  return avg >= 7.5 ? `${base} · easy to please` : avg <= 4.5 ? `${base} · tough critic` : base;
}

/* ---------------- Rendering helpers ---------------- */
function posterHTML(f) {
  const h = hash(f.title) % 360;
  const img = f.poster ? `<img src="${esc(posterUrl(f))}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : "";
  return `<div class="poster"><div class="fallback" aria-hidden="true" style="background:linear-gradient(160deg,hsl(${h} 45% 30%),hsl(${(h + 50) % 360} 55% 11%))">${esc(f.title)}<small>${f.year}</small></div>${img}</div>`;
}
function cardHTML(f, acts = "") {
  const s = scoreOf(f.id);
  const badge = s ? `<span class="badge ${s.b}">${s.score.toFixed(1)}</span>` : "";
  const rib = !s && S.watch.includes(f.id) ? `<span class="ribbon" title="On your watchlist">${ICON.bookmark}</span>` : "";
  return `<article class="card">${badge}${rib}<button class="hit" data-film="${f.id}" aria-label="${esc(f.title)} (${f.year})">${posterHTML(f)}<div class="meta"><div class="t">${esc(f.title)}</div><div class="y">${f.year}</div></div></button>${acts}</article>`;
}
const railHTML = (films) => `<div class="rail">${films.map((f) => cardHTML(f)).join("")}</div>`;
const sectionHTML = (title, sub, body, link = "") =>
  `<section class="section"><div class="section-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${link}</div>${body}</section>`;

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}
const view = () => $("#view");

/* ---------------- Views ---------------- */
function renderDiscover() {
  const n = rankedCount();
  const name = S.name || "there";
  const hero = n
    ? `<div class="hero"><h1>Welcome back, <em>${esc(name)}</em>.</h1>
        <p>Every film you rank sharpens your list. Keep going — the more you compare, the more your scores mean.</p>
        <div class="row"><a class="btn primary" href="#/search">${ICON.plus} Rank a film</a><a class="btn" href="#/list">See my list</a></div>
        <div class="stats"><div><b>${n}</b><span>Ranked</span></div><div><b>${avgScore().toFixed(1)}</b><span>Avg score</span></div><div><b>${S.watch.length}</b><span>Watchlist</span></div></div></div>`
    : `<div class="hero"><h1>Stop rating movies.<br>Start <em>ranking</em> them.</h1>
        <p>Star ratings are guesswork. On Movi you just pick which film you liked more — a few quick head-to-heads — and your scores build themselves.</p>
        <div class="row"><a class="btn primary" href="#/search">${ICON.plus} Rank your first film</a><a class="btn" href="#quick">Try quick picks</a></div>
        <div class="stats"><div><b>${DB.films.length.toLocaleString()}</b><span>Films</span></div><div><b>0–10</b><span>Your scale</span></div><div><b>~5</b><span>Picks per film</span></div></div></div>`;

  const how = n < 3
    ? sectionHTML("How Movi works", "", `<div class="how">
        <div><b>STEP 1</b><h3>Gut check</h3><p>Loved it, fine, or didn't like it. That sets the range.</p></div>
        <div><b>STEP 2</b><h3>Head-to-head</h3><p>Pick which film you liked more against ones you've ranked. No stars, no overthinking.</p></div>
        <div><b>STEP 3</b><h3>Your score</h3><p>Movi slots it into your list and gives it a 0–10 score based on where it landed.</p></div></div>`)
    : "";

  const topLoved = S.lists.loved[0] != null ? film(S.lists.loved[0]) : null;
  const because = topLoved ? sectionHTML(`Because you loved ${esc(topLoved.title)}`, "Similar genres and era", railHTML(recommend(16, topLoved))) : "";
  const forYou = n >= 3 ? sectionHTML("Picked for you", "Based on the genres you score highest", railHTML(recommend(18))) : "";

  const rails = [
    ["Science Fiction", "Sci-fi essentials"], ["Animated", "Animation favorites"], ["Horror", "Horror to rank"],
    ["Comedy", "Comedies"], ["Crime", "Crime & gangsters"], ["Romance", "Romance"], ["Superhero", "Superheroes"], ["Western", "Westerns"],
  ].map(([g, t]) => sectionHTML(t, "", railHTML(topByGenre(g)), `<a class="link" href="#/search" data-genre="${esc(g)}">See all</a>`)).join("");

  view().innerHTML = hero + how + `<section class="section quick" id="quick"></section>` + because + forYou + rails;
  renderQuick();
}

function renderQuick() {
  const el = $("#quick");
  if (!el) return;
  const taken = new Set([...ranked(), ...S.watch, ...S.skip]);
  const picks = [];
  for (const f of DB.films) {
    if (!taken.has(f.id)) picks.push(f);
    if (picks.length >= 12) break;
  }
  const acts = (f) => `<div class="acts"><button data-act="rank" data-id="${f.id}">Seen it</button><button data-act="watch" data-id="${f.id}">Want to</button><button data-act="skip" data-id="${f.id}" aria-label="Not interested">Skip</button></div>`;
  el.innerHTML = `<div class="section-head"><div><h2>Seen any of these?</h2><p>Rank the ones you've watched, save the ones you want to. Fastest way to build your list.</p></div></div>
    <div class="grid">${picks.map((f) => cardHTML(f, acts(f))).join("")}</div>`;
}

/* ---- Search ---- */
const SQ = { q: "", genre: "", decade: "", sort: "pop", page: 1 };
function renderSearch() {
  const decades = [];
  for (let d = 2020; d >= 1900; d -= 10) decades.push(d);
  view().innerHTML = `
    <div class="searchbar">${ICON.search}<input id="q" type="search" placeholder="Search ${DB.films.length.toLocaleString()} films by title or year" autocomplete="off" value="${esc(SQ.q)}"></div>
    <div class="filters">
      <select id="decade" aria-label="Decade"><option value="">Any decade</option>${decades.map((d) => `<option value="${d}" ${SQ.decade == d ? "selected" : ""}>${d}s</option>`).join("")}</select>
      <select id="sort" aria-label="Sort"><option value="pop">Most popular</option><option value="new">Newest</option><option value="old">Oldest</option><option value="az">A–Z</option></select>
    </div>
    <div class="chips" id="gchips"><button class="chip ${SQ.genre ? "" : "on"}" data-g="">All genres</button>${DB.genres.filter((g) => g !== "Short").map((g) => `<button class="chip ${SQ.genre === g ? "on" : ""}" data-g="${esc(g)}">${esc(g)}</button>`).join("")}</div>
    <div id="results"></div>`;
  $("#sort").value = SQ.sort;
  const q = $("#q");
  let t;
  q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { SQ.q = q.value; SQ.page = 1; renderResults(); }, 120); });
  $("#decade").addEventListener("change", (e) => { SQ.decade = e.target.value; SQ.page = 1; renderResults(); });
  $("#sort").addEventListener("change", (e) => { SQ.sort = e.target.value; SQ.page = 1; renderResults(); });
  $("#gchips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-g]");
    if (!b) return;
    SQ.genre = b.dataset.g; SQ.page = 1;
    $("#gchips").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
    renderResults();
  });
  renderResults();
  if (matchMedia("(hover: hover)").matches) q.focus();
}

function searchFilms() {
  const tokens = norm(SQ.q).split(" ").filter(Boolean);
  const years = tokens.filter((t) => /^(19|20)\d\d$/.test(t)).map(Number);
  const words = tokens.filter((t) => !/^(19|20)\d\d$/.test(t));
  const g = SQ.genre ? DB.genres.indexOf(SQ.genre) : -1;
  const dec = SQ.decade ? Number(SQ.decade) : null;
  const phrase = words.join(" ");
  const out = [];
  for (const f of DB.films) {
    if (g >= 0 && !f.g.includes(g)) continue;
    if (dec !== null && (f.year < dec || f.year >= dec + 10)) continue;
    let rel = 0;
    if (years.length) {
      const titleHasYear = years.every((y) => (" " + f.n + " ").includes(` ${y} `));
      if (!years.includes(f.year) && !titleHasYear) continue;
      if (titleHasYear) rel += 2;
    }
    if (words.length) {
      if (!words.every((w) => f.n.includes(w))) continue;
      rel += f.n === phrase ? 3 : f.n.startsWith(phrase) ? 2 : (" " + f.n).includes(" " + words[0]) ? 1 : 0;
    }
    out.push([rel, f]);
  }
  const sorters = {
    pop: (a, b) => b[0] - a[0] || a[1].id - b[1].id,
    new: (a, b) => b[0] - a[0] || b[1].year - a[1].year || a[1].id - b[1].id,
    old: (a, b) => b[0] - a[0] || a[1].year - b[1].year || a[1].id - b[1].id,
    az: (a, b) => a[1].n.localeCompare(b[1].n),
  };
  return out.sort(sorters[SQ.sort]).map((x) => x[1]);
}

function renderResults() {
  const el = $("#results");
  if (!el) return;
  const all = searchFilms();
  const shown = all.slice(0, SQ.page * 60);
  el.innerHTML = all.length
    ? `<div class="count">${all.length.toLocaleString()} film${all.length === 1 ? "" : "s"}</div>
       <div class="grid">${shown.map((f) => cardHTML(f)).join("")}</div>
       ${shown.length < all.length ? `<div class="more"><button class="btn" data-act="more">Show more</button></div>` : ""}`
    : `<div class="empty"><h3>No films found</h3><p>Try a shorter title, or clear the genre and decade filters.</p></div>`;
}

/* ---- My List ---- */
let listTab = "all";
function renderList() {
  const n = rankedCount();
  if (!n) {
    view().innerHTML = `<div class="list-head"><h1>My List</h1></div>
      <div class="empty" style="margin-top:20px"><h3>Your list is empty</h3><p>Rank a film you've seen and it lands here with a score.</p><a class="btn primary" href="#/search">${ICON.plus} Rank a film</a></div>`;
    return;
  }
  const ids = listTab === "all" ? ranked() : S.lists[listTab];
  const counts = { all: n, loved: S.lists.loved.length, fine: S.lists.fine.length, disliked: S.lists.disliked.length };
  const label = { all: "All", loved: "Loved", fine: "Fine", disliked: "Didn't like" };
  view().innerHTML = `
    <div class="list-head"><div><h1>My List</h1><p class="muted" style="margin:4px 0 0">${n} film${n === 1 ? "" : "s"}, ranked by you. Tap one to re-rank or add a note.</p></div>
      <div class="settings"><button class="btn sm" data-act="share">${ICON.share} Share top 10</button><a class="btn sm primary" href="#/search">${ICON.plus} Rank a film</a></div></div>
    <div class="chips" style="margin-top:18px" id="ltabs">${Object.keys(label).map((k) => `<button class="chip ${listTab === k ? "on" : ""}" data-tab="${k}">${label[k]} · ${counts[k]}</button>`).join("")}</div>
    <div class="rows">${ids.map((id) => rowHTML(id)).join("") || `<div class="empty"><p>Nothing here yet.</p></div>`}</div>`;
  $("#ltabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) { listTab = b.dataset.tab; renderList(); }
  });
}
function rowHTML(id) {
  const f = film(id);
  const s = scoreOf(id);
  const note = S.meta[id]?.note;
  return `<button class="rowi" data-film="${id}"><span class="n">${s.overall}</span>${posterHTML(f)}
    <span><div class="t">${esc(f.title)}</div><div class="sub">${f.year}${f.g.length ? " · " + esc(genreNames(f).slice(0, 2).join(", ")) : ""}${note ? ` · “${esc(note.slice(0, 60))}${note.length > 60 ? "…" : ""}”` : ""}</div></span>
    <span class="score ${s.b}">${s.score.toFixed(1)}</span></button>`;
}

/* ---- Watchlist ---- */
function renderWatchlist() {
  const ids = [...S.watch].reverse();
  const acts = (id) => `<div class="acts"><button data-act="rank" data-id="${id}">Watched</button><button data-act="unwatch" data-id="${id}">Remove</button></div>`;
  view().innerHTML = `<div class="list-head"><div><h1>Watchlist</h1><p class="muted" style="margin:4px 0 0">Films you want to see. Watched one? Rank it.</p></div></div>
    ${ids.length
      ? `<div class="grid quick" style="margin-top:20px">${ids.map((id) => cardHTML(film(id), acts(id))).join("")}</div>`
      : `<div class="empty" style="margin-top:20px"><h3>Nothing saved yet</h3><p>Tap “Want to” on any film to save it for later.</p><a class="btn primary" href="#/discover">Find films</a></div>`}`;
}

/* ---- Profile ---- */
function renderProfile() {
  const n = rankedCount();
  const name = S.name || "You";
  const top4 = ranked().slice(0, 4).map(film);
  const stats = tasteStats();
  const maxG = Math.max(1, ...stats.map((e) => e.n));
  const decades = new Map();
  for (const id of ranked()) {
    const d = Math.floor(film(id).year / 10) * 10;
    decades.set(d, (decades.get(d) || 0) + 1);
  }
  const decs = [...decades.entries()].sort((a, b) => b[0] - a[0]);
  const maxD = Math.max(1, ...decs.map((d) => d[1]));
  const bar = (label, val, max, right) => `<div class="bar"><span>${esc(label)}</span><div class="track"><div class="fill" style="width:${(val / max) * 100}%"></div></div><span class="v">${right}</span></div>`;

  view().innerHTML = `
    <div class="prof"><div class="avatar">${esc(name[0].toUpperCase())}</div>
      <div><h1>${esc(name)}</h1><span class="archetype">${esc(archetype())}</span></div>
      <button class="btn sm" data-act="rename" style="margin-left:auto">Edit name</button></div>
    <div class="tiles">
      <div class="tile"><b>${n}</b><span>Films ranked</span></div>
      <div class="tile"><b>${n ? avgScore().toFixed(1) : "–"}</b><span>Avg score</span></div>
      <div class="tile"><b>${S.lists.loved.length}</b><span>Loved</span></div>
      <div class="tile"><b>${S.watch.length}</b><span>Watchlist</span></div>
    </div>
    ${n ? sectionHTML("Your top 4", "The films at the very top of your list", `<div class="top4">${top4.map((f) => cardHTML(f)).join("")}</div>`) : ""}
    ${n ? `<div class="two">
      ${sectionHTML("Taste by genre", "How many you've ranked, and your average score", `<div class="bars">${stats.slice(0, 8).map((e) => bar(e.g, e.n, maxG, `${e.n} · ${(e.sum / e.n).toFixed(1)}`)).join("")}</div>`)}
      ${sectionHTML("By decade", "When your films came out", `<div class="bars">${decs.slice(0, 8).map(([d, c]) => bar(`${d}s`, c, maxD, c)).join("")}</div>`)}
    </div>` : `<div class="empty" style="margin-top:28px"><h3>Your taste profile appears here</h3><p>Rank a few films to see your genres, decades and movie personality.</p><a class="btn primary" href="#/search">${ICON.plus} Rank a film</a></div>`}
    ${sectionHTML("Your data", "Everything is saved in this browser. Back it up or move it to another device.", `<div class="settings">
      <button class="btn sm" data-act="export">Export backup</button>
      <label class="btn sm">Import backup<input type="file" accept="application/json" id="importer" hidden></label>
      <button class="btn sm danger" data-act="reset">Reset everything</button></div>
      <p class="muted" style="font-size:12.5px;margin-top:18px">Film data and posters from Wikipedia, available under CC BY-SA.</p>`)}`;
  $("#importer").addEventListener("change", importBackup);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "movi-backup.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const valid = (arr) => Array.isArray(arr) && arr.every((x) => Number.isInteger(x) && x >= 0 && x < DB.films.length);
    if (!data.lists || !ORDER.every((b) => valid(data.lists[b]))) throw new Error("bad");
    S = { ...blank(), ...data, watch: valid(data.watch) ? data.watch : [], skip: valid(data.skip) ? data.skip : [], meta: data.meta && typeof data.meta === "object" ? data.meta : {} };
    save();
    toast("Backup imported");
    route();
  } catch {
    toast("That file isn't a Movi backup");
  }
}

/* ---------------- Film sheet ---------------- */
let sheetId = null;
async function openFilm(id) {
  sheetId = id;
  const f = film(id);
  const el = $("#sheet");
  el.hidden = false;
  document.body.classList.add("locked");
  el.innerHTML = sheetHTML(f, null);
  el.querySelector(".panel").scrollTop = 0;
  const det = await details(id);
  if (sheetId === id && !el.hidden) rerenderSheet(id, det);
}
function rerenderSheet(id, det) {
  const panel = $("#sheet .panel");
  const top = panel ? panel.scrollTop : 0;
  $("#sheet").innerHTML = sheetHTML(film(id), det).replace('class="scrim"', 'class="scrim" style="animation:none"').replace('class="panel"', 'class="panel" style="animation:none"');
  $("#sheet .panel").scrollTop = top;
  bindNote(id);
}
function refreshSheet() {
  if (sheetId == null || $("#sheet").hidden) return;
  const id = sheetId;
  details(id).then((det) => { if (sheetId === id) rerenderSheet(id, det); });
}
function closeSheet() {
  sheetId = null;
  $("#sheet").hidden = true;
  $("#sheet").innerHTML = "";
  if ($("#flow").hidden) document.body.classList.remove("locked");
}
function sheetHTML(f, det) {
  const s = scoreOf(f.id);
  const onWatch = S.watch.includes(f.id);
  const img = posterUrl(f);
  const yours = s
    ? `<div class="yourscore"><span class="score ${s.b}">${s.score.toFixed(1)}</span>
        <div><b>#${s.overall} of ${rankedCount()}</b> in your list<small>${BUCKETS[s.b].short} · #${s.i + 1} of ${s.n} in that group</small></div></div>
        <textarea class="note" id="note" placeholder="Add a note — what stuck with you?">${esc(S.meta[f.id]?.note || "")}</textarea>`
    : "";
  const acts = s
    ? `<button class="btn primary" data-act="rank" data-id="${f.id}">${ICON.rank} Re-rank</button><button class="btn danger" data-act="remove" data-id="${f.id}">Remove</button>`
    : `<button class="btn primary" data-act="rank" data-id="${f.id}">${ICON.rank} I've seen it — rank it</button>
       <button class="btn" data-act="${onWatch ? "unwatch" : "watch"}" data-id="${f.id}">${onWatch ? ICON.check + " On watchlist" : ICON.bookmark + " Watchlist"}</button>`;
  const castHTML = det?.cast?.length ? `<p class="cast"><b>Starring</b> ${esc(det.cast.slice(0, 8).join(", "))}</p>` : "";
  const plot = det ? (det.plot ? `<p class="plot">${esc(det.plot)}</p>` : `<p class="plot muted">No summary available.</p>`) : `<p class="plot muted">Loading details…</p>`;
  const wiki = det?.href ? `<a class="wiki" href="https://en.wikipedia.org/wiki/${encodeURI(det.href)}" target="_blank" rel="noopener">Read more on Wikipedia</a>` : "";
  const more = recommend(14, f);
  return `<div class="scrim" data-act="close"></div>
    <div class="panel" role="dialog" aria-modal="true" aria-label="${esc(f.title)}">
      ${img ? `<div class="backdrop"><img src="${esc(img)}" alt=""></div>` : ""}
      <button class="close" data-act="close" aria-label="Close">${ICON.close}</button>
      <div class="film">${posterHTML(f)}
        <div class="body"><h2>${esc(f.title)}</h2>
          <div class="facts"><span class="tag">${f.year}</span>${genreNames(f).map((g) => `<span class="tag">${esc(g)}</span>`).join("")}</div>
          ${yours}<div class="acts">${acts}</div>${plot}${castHTML}${wiki}</div></div>
      ${more.length ? `<div class="film-more"><div class="section-head"><h2>More like this</h2></div>${railHTML(more)}</div>` : ""}
    </div>`;
}
function bindNote(id) {
  const n = $("#note");
  if (!n) return;
  let t;
  n.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      S.meta[id] = { ...(S.meta[id] || {}), note: n.value.trim() };
      save();
    }, 300);
  });
}

/* ---------------- Ranking flow ---------------- */
let F = null;
function startRank(id) {
  const prev = scoreOf(id);
  F = { id, prev: prev ? { b: prev.b, i: prev.i } : null, step: "feel", bucket: null, lo: 0, hi: 0, history: [], comps: 0, busy: false };
  removeRanked(id);
  $("#flow").hidden = false;
  document.body.classList.add("locked");
  renderFlow();
}
function cancelRank() {
  if (F && F.step !== "done" && F.prev) S.lists[F.prev.b].splice(F.prev.i, 0, F.id);
  endFlow();
}
function endFlow() {
  const wasDone = F?.step === "done";
  F = null;
  $("#flow").hidden = true;
  $("#flow").innerHTML = "";
  if ($("#sheet").hidden) document.body.classList.remove("locked");
  save();
  if (wasDone) { route(); refreshSheet(); }
}
function chooseBucket(b) {
  F.bucket = b;
  F.lo = 0;
  F.hi = S.lists[b].length;
  F.max = Math.ceil(Math.log2(F.hi + 1));
  F.step = "duel";
  if (F.lo >= F.hi) return finishRank();
  renderFlow();
}
function pick(newIsBetter, tie = false) {
  if (F.busy) return;
  const mid = (F.lo + F.hi) >> 1;
  F.history.push([F.lo, F.hi]);
  F.comps++;
  if (tie) { F.lo = F.hi = mid + 1; }
  else if (newIsBetter) F.hi = mid;
  else F.lo = mid + 1;
  const chosen = tie ? null : newIsBetter ? "#pick-new" : "#pick-old";
  if (chosen) {
    F.busy = true;
    $(chosen)?.classList.add("chosen");
    $(newIsBetter ? "#pick-old" : "#pick-new")?.classList.add("lost");
    setTimeout(() => { F.busy = false; F.lo >= F.hi ? finishRank() : renderFlow(); }, 260);
  } else {
    F.lo >= F.hi ? finishRank() : renderFlow();
  }
}
function undoPick() {
  if (!F.history.length) { F.step = "feel"; return renderFlow(); }
  [F.lo, F.hi] = F.history.pop();
  F.comps--;
  renderFlow();
}
function finishRank() {
  S.lists[F.bucket].splice(F.lo, 0, F.id);
  S.watch = S.watch.filter((x) => x !== F.id);
  S.skip = S.skip.filter((x) => x !== F.id);
  S.meta[F.id] = { ...(S.meta[F.id] || {}), ranked: Date.now() };
  save();
  F.step = "done";
  renderFlow();
  sparks();
}
function renderFlow() {
  const f = film(F.id);
  const el = $("#flow");
  const top = `<div class="flow-top"><span class="step">${F.step === "feel" ? "Step 1 of 2" : F.step === "duel" ? "Step 2 of 2" : "Ranked"}</span>
    <button class="close" style="position:static" data-act="${F.step === "done" ? "flow-done" : "flow-cancel"}" aria-label="Close">${ICON.close}</button></div>`;
  let body = "";
  if (F.step === "feel") {
    body = `<div class="feel-poster">${posterHTML(f)}</div><h2>How was ${esc(f.title)}?</h2><p class="sub">Go with your gut. You'll fine-tune it next.</p>
      <div class="center"><div class="feels">${ORDER.map((b, i) => `<button class="feel ${b}" data-act="feel" data-b="${b}"><i>${BUCKETS[b].icon}</i>${BUCKETS[b].label}<small>${BUCKETS[b].hint}</small><small aria-hidden="true">Press ${i + 1}</small></button>`).join("")}</div></div>`;
  } else if (F.step === "duel") {
    const mid = (F.lo + F.hi) >> 1;
    const opp = film(S.lists[F.bucket][mid]);
    const dots = Array.from({ length: F.max }, (_, i) => `<i class="${i < F.comps ? "on" : ""}"></i>`).join("");
    body = `<h2>Which did you like more?</h2><p class="sub">Tap one, or use ← and →</p>
      <div class="center"><div class="duel">
        <button class="pick" id="pick-new" data-act="pick-new">${posterHTML(f)}<div class="t">${esc(f.title)}</div><div class="y">${f.year}</div><span class="new">New</span></button>
        <div class="vs">VS</div>
        <button class="pick" id="pick-old" data-act="pick-old">${posterHTML(opp)}<div class="t">${esc(opp.title)}</div><div class="y">${opp.year} · ${scoreOf(opp.id).score.toFixed(1)}</div></button>
      </div><div class="dots" aria-label="Comparison ${F.comps + 1} of about ${F.max}">${dots}</div></div>
      <div class="flow-foot"><button class="btn ghost sm" data-act="undo">${ICON.undo} Back</button><button class="btn sm" data-act="tie">Too close to call</button></div>`;
  } else {
    const s = scoreOf(F.id);
    body = `<div class="reveal"><div class="feel-poster" style="width:120px">${posterHTML(f)}</div>
      <div class="big-score ${s.b}" style="background:var(--${s.b})">${s.score.toFixed(1)}</div>
      <h2 style="margin-top:0">${esc(f.title)}</h2>
      <p class="rank"><b>#${s.overall}</b> of ${rankedCount()} in your list · ${BUCKETS[s.b].short}${F.comps ? ` · ${F.comps} pick${F.comps === 1 ? "" : "s"}` : ""}</p>
      <textarea class="note" id="note" placeholder="Add a note (optional)">${esc(S.meta[F.id]?.note || "")}</textarea>
      <div class="flow-foot"><button class="btn" data-act="flow-another">Rank another</button><button class="btn primary" data-act="flow-done">Done</button></div></div>`;
  }
  el.innerHTML = `<div class="flow-in">${top}${body}</div>`;
  el.scrollTop = 0;
  if (F.step === "done") bindNote(F.id);
}
function sparks() {
  const colors = ["#e2a514", "#fde68a", "#f3f1ea", "#34d399"];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("i");
    s.className = "spark";
    const a = (Math.PI * 2 * i) / 28;
    const r = 120 + Math.random() * 120;
    s.style.cssText = `background:${colors[i % 4]};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px`;
    $("#flow").appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
}

/* ---------------- Actions ---------------- */
function act(name, id, el) {
  switch (name) {
    case "rank": return startRank(id);
    case "watch":
      if (!S.watch.includes(id)) S.watch.push(id);
      save(); toast("Added to your watchlist"); return refresh();
    case "unwatch":
      S.watch = S.watch.filter((x) => x !== id);
      save(); toast("Removed from watchlist"); return refresh();
    case "skip":
      S.skip.push(id); save(); return refresh();
    case "remove":
      if (!confirm(`Remove ${film(id).title} from your list?`)) return;
      removeRanked(id); save(); toast("Removed from your list"); return refresh();
    case "close": return closeSheet();
    case "feel": return chooseBucket(el.dataset.b);
    case "pick-new": return pick(true);
    case "pick-old": return pick(false);
    case "tie": return pick(false, true);
    case "undo": return undoPick();
    case "flow-cancel": return cancelRank();
    case "flow-done": return endFlow();
    case "flow-another": endFlow(); closeSheet(); location.hash = "#/search"; return;
    case "more": SQ.page++; return renderResults();
    case "share": return shareList();
    case "export": return exportBackup();
    case "reset":
      if (!confirm("Delete all your rankings, notes and watchlist from this browser?")) return;
      S = blank(); save(); toast("Everything reset"); return route();
    case "rename": {
      const n = prompt("What should we call you?", S.name || "");
      if (n === null) return;
      S.name = n.trim().slice(0, 40); save(); return route();
    }
  }
}
function refresh() {
  const tab = currentTab();
  if (tab === "discover") renderQuick();
  else if (tab === "search") renderResults();
  else route();
  refreshSheet();
}
async function shareList() {
  const ids = ranked().slice(0, 10);
  const text = `My Movi top ${ids.length}:\n` + ids.map((id, i) => `${i + 1}. ${film(id).title} (${film(id).year}) — ${scoreOf(id).score.toFixed(1)}`).join("\n");
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast("Top 10 copied to clipboard"); }
  } catch (e) {
    if (e.name !== "AbortError") toast("Couldn't share — try again");
  }
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-act]");
  if (a) {
    e.preventDefault();
    return act(a.dataset.act, a.dataset.id != null ? Number(a.dataset.id) : null, a);
  }
  const f = e.target.closest("[data-film]");
  if (f) return openFilm(Number(f.dataset.film));
  const g = e.target.closest("[data-genre]");
  if (g) { SQ.genre = g.dataset.genre; SQ.q = ""; SQ.decade = ""; SQ.page = 1; }
  const q = e.target.closest('a[href="#quick"]');
  if (q) { e.preventDefault(); $("#quick")?.scrollIntoView({ behavior: "smooth" }); }
});
document.addEventListener("keydown", (e) => {
  if (F) {
    if (e.key === "Escape") return F.step === "done" ? endFlow() : cancelRank();
    if (e.target.tagName === "TEXTAREA") return;
    if (F.step === "feel" && ["1", "2", "3"].includes(e.key)) return chooseBucket(ORDER[Number(e.key) - 1]);
    if (F.step === "duel" && e.key === "ArrowLeft") return pick(true);
    if (F.step === "duel" && e.key === "ArrowRight") return pick(false);
    return;
  }
  if (e.key === "Escape" && !$("#sheet").hidden) closeSheet();
});

/* ---------------- Router ---------------- */
const ROUTES = { discover: renderDiscover, search: renderSearch, list: renderList, watchlist: renderWatchlist, profile: renderProfile };
const currentTab = () => {
  const t = location.hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return ROUTES[t] ? t : "discover";
};
function route() {
  const tab = currentTab();
  document.querySelectorAll("#tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
  ROUTES[tab]();
}
window.addEventListener("hashchange", () => {
  if (location.hash === "#quick" || !DB) return;
  closeSheet();
  route();
  window.scrollTo(0, 0);
});

loadDB()
  .then(route)
  .catch(() => {
    view().innerHTML = `<div class="empty" style="margin-top:40px"><h3>Couldn't load the film database</h3>
      <p>If you opened this file directly, run a local server instead: <code>python3 -m http.server</code> inside the <code>docs</code> folder, then visit localhost:8000.</p></div>`;
  });
