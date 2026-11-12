import { $, esc, ICON, debounce } from "../util.js";
import { film, filmCount, genres, searchFilms, topByGenre } from "../films.js";
import { api } from "../api/index.js";
import { S, rankedIds, rankedCount, avgScore, loadFriendRows, followingIds, myRows } from "../state.js";
import { cardHTML, railHTML, sectionHTML, emptyHTML, userRowHTML, spinnerHTML } from "../ui.js";
import { recommendFor, similarFilms } from "../film-sheet.js";
import { beginPage, sample, byPopularity } from "../variety.js";
import { genreAffinity } from "../model.js";
import { followBtnHTML } from "./feed.js";

const GENRE_RAILS = [
  ["Science Fiction", "Sci-fi to rank"], ["Animated", "Animation favorites"], ["Horror", "Horror"], ["Comedy", "Comedies"],
  ["Crime", "Crime & gangsters"], ["Romance", "Romance"], ["Superhero", "Superheroes"], ["Western", "Westerns"],
  ["Thriller", "Thrillers"], ["Drama", "Dramas"], ["Action", "Action"], ["Adventure", "Adventures"], ["Fantasy", "Fantasy"],
  ["Mystery", "Mysteries"], ["Musical", "Musicals"], ["War", "War films"], ["Noir", "Film noir"], ["Biography", "True stories"],
  ["Family", "Family night"], ["Sports", "Sports films"],
];
const RAILS_PER_VISIT = 6;

// A different set of genre rows each visit, leaning toward genres the user scores highly.
function pickGenreRails() {
  const aff = S.me ? genreAffinity(myRows(), genres().length) : [];
  const weighted = GENRE_RAILS.map((r) => [Math.exp(Math.max(-2, Math.min(3, (aff[genres().indexOf(r[0])] || 0) / 2))) * (0.5 + Math.random()), r]);
  return weighted.sort((a, b) => b[0] - a[0]).slice(0, RAILS_PER_VISIT).map((x) => x[1]);
}

export async function renderDiscover(view) {
  const me = S.me;
  const n = me ? rankedCount() : 0;
  const hero = !me
    ? `<div class="hero"><h1>Stop rating movies.<br>Start <em>ranking</em> them.</h1>
        <p>Pick which film you liked more, a few times, and Movi builds your 0–10 scores and ranked list. See what your friends think, compare taste, and find what to watch next.</p>
        <div class="row"><a class="btn primary" href="#/welcome">Create your account</a><a class="btn" href="#/search">Browse ${filmCount().toLocaleString()} films</a></div></div>`
    : n === 0
      ? `<div class="hero"><h1>Let's build your list, <em>${esc(me.display_name || me.username)}</em>.</h1>
          <p>Start with films you know well. Each one takes a few seconds: a gut check, then a couple of head-to-heads.</p>
          <div class="row"><button class="btn primary" data-act="quick-add">${ICON.plus} Rank a film</button><a class="btn" href="#quick">Quick picks</a></div></div>`
      : `<div class="hero compact"><div><h1>Discover</h1><p>${rankedCount()} ranked · ${avgScore().toFixed(1)} average. Find your next favorite.</p></div>
          <div class="row"><button class="btn primary" data-act="quick-add">${ICON.plus} Rank a film</button><a class="btn" href="#/together">${ICON.users} Watch together</a></div></div>`;

  beginPage();
  if (me) pickQuick();
  const favorites = me ? S.lists.loved.slice(0, 6) : [];
  const topLoved = favorites.length ? film(favorites[Math.floor(Math.random() * favorites.length)]) : null;
  const exclude = me ? notNewIds() : null;
  view.innerHTML = `${hero}
    <a class="searchbar fake" href="#/search">${ICON.search}<span>Search films or people</span></a>
    ${me ? `<section class="section quick" id="quick"></section>` : ""}
    ${me && n >= 3 ? sectionHTML("Recommended for you", "Based on the genres you score highest", railHTML(recommendFor(18))) : ""}
    <div id="friends-trending"></div>
    <div id="top-movi"></div>
    ${topLoved ? sectionHTML(`Because you loved ${esc(topLoved.title)}`, "Similar genres and era", railHTML(similarFilms(topLoved, 16, { vary: true }))) : ""}
    ${pickGenreRails().map(([g, t]) => sectionHTML(t, "", railHTML(sample(byPopularity(topByGenre(g, 160, exclude), 1.3), 20)), `<a class="link" href="#/search?genre=${encodeURIComponent(g)}">See all</a>`)).join("")}`;
  if (me) drawQuick();
  loadTrending();
}

// Films the user has ranked or said they're not interested in never appear as suggestions.
const notNewIds = () => new Set([...rankedIds(), ...S.skip]);

let quickIds = [];
const QUICK_COUNT = 12;
const quickTaken = () => new Set([...rankedIds(), ...S.watch.map((w) => w.film_id), ...S.skip]);
const quickPool = (taken) => byPopularity(searchFilms({}).filter((f) => !taken.has(f.id)).slice(0, 450));

function pickQuick() {
  quickIds = sample(quickPool(quickTaken()), QUICK_COUNT).map((f) => f.id);
}

function drawQuick() {
  const el = $("#quick");
  if (!el) return;
  const acts = (f) => ({ acts: `<div class="acts"><button data-act="rank" data-id="${f.id}">Seen it</button><button data-act="watch" data-id="${f.id}">Save</button><button data-act="skip" data-id="${f.id}" aria-label="Not interested">Skip</button></div>` });
  el.innerHTML = `<div class="section-head"><div><h2>Seen any of these?</h2><p>Rank what you've watched, save what you want to. The fastest way to build your list.</p></div>
      <button class="btn sm ghost" data-act="shuffle-quick">${ICON.repeat} Shuffle</button></div>
    <div class="grid">${quickIds.map((id) => cardHTML(film(id), acts(film(id)))).join("")}</div>`;
}

export function shuffleQuick() {
  pickQuick();
  drawQuick();
}

// After Save / Skip / ranking: swap out only the cards that no longer belong, keeping the rest in place.
export function refreshQuick() {
  const taken = quickTaken();
  const keep = new Set(quickIds.filter((id) => !taken.has(id)));
  const fresh = sample(quickPool(new Set([...taken, ...keep])), QUICK_COUNT - keep.size).map((f) => f.id);
  quickIds = quickIds.map((id) => (keep.has(id) ? id : fresh.shift())).filter((id) => id != null);
  drawQuick();
}

async function loadTrending() {
  const [top, friendRows] = await Promise.all([
    api.topFilms(2, 100).catch(() => []),
    S.me ? loadFriendRows().catch(() => []) : [],
  ]);
  const hide = S.me ? notNewIds() : new Set();
  const topNew = top.filter((t) => !hide.has(t.film_id));
  const tbox = $("#top-movi");
  if (tbox && topNew.length) {
    tbox.innerHTML = sectionHTML("Top rated on Movi", "Highest average score across members", railHTML(sample(topNew.filter((t) => film(t.film_id)).map((t) => [Math.exp((Number(t.avg_score) - Number(topNew[0].avg_score)) / 1.2) * Math.log2(1 + Number(t.n)), film(t.film_id)]), 18), (f) => {
      const t = top.find((x) => x.film_id === f.id);
      return { label: `${Number(t.avg_score).toFixed(1)} avg · ${t.n} members` };
    }));
  }
  const fbox = $("#friends-trending");
  if (!fbox || !friendRows.length) return;
  const since = Date.now() - 45 * 86400000;
  const agg = new Map();
  for (const r of friendRows) {
    if (new Date(r.created_at).getTime() < since || hide.has(r.film_id)) continue;
    const e = agg.get(r.film_id) || { id: r.film_id, n: 0, sum: 0 };
    e.n++; e.sum += Number(r.score);
    agg.set(r.film_id, e);
  }
  const list = [...agg.values()].sort((a, b) => b.n - a.n || b.sum / b.n - a.sum / a.n).slice(0, 120);
  if (list.length) {
    fbox.innerHTML = sectionHTML("Trending with friends", `What the ${followingIds().length} people you follow ranked lately`, railHTML(sample(list.map((e) => [Math.pow(e.n, 1.3) * (e.sum / e.n / 10 + 0.3), film(e.id)]), 16), (f) => {
      const e = agg.get(f.id);
      return { label: `${e.n} friend${e.n === 1 ? "" : "s"} · ${(e.sum / e.n).toFixed(1)} avg` };
    }));
  }
}

// ---------- Search ----------
const SQ = { q: "", genre: "", decade: "", sort: "pop", page: 1, tab: "films" };

export function renderSearch(view, params) {
  if (params.get("genre") !== null) { SQ.genre = params.get("genre"); SQ.q = ""; SQ.page = 1; SQ.tab = "films"; }
  if (params.get("tab")) SQ.tab = params.get("tab");
  const decades = [];
  for (let d = 2020; d >= 1900; d -= 10) decades.push(d);
  view.innerHTML = `
    <div class="searchbar">${ICON.search}<input id="q" type="search" placeholder="${SQ.tab === "films" ? `Search ${filmCount().toLocaleString()} films by title or year` : "Search people by name or username"}" autocomplete="off" value="${esc(SQ.q)}"></div>
    <div class="seg" style="margin-top:14px" role="tablist">${["films", "people"].map((t) => `<button role="tab" class="${SQ.tab === t ? "on" : ""}" data-stab="${t}">${t === "films" ? "Films" : "People"}</button>`).join("")}</div>
    ${SQ.tab === "films" ? `<div class="filters">
      <select id="decade" aria-label="Decade"><option value="">Any decade</option>${decades.map((d) => `<option value="${d}" ${SQ.decade == d ? "selected" : ""}>${d}s</option>`).join("")}</select>
      <select id="sort" aria-label="Sort"><option value="pop">Most popular</option><option value="new">Newest</option><option value="old">Oldest</option><option value="az">A–Z</option></select>
    </div>
    <div class="chips" id="gchips"><button class="chip ${SQ.genre ? "" : "on"}" data-g="">All genres</button>${genres().filter((g) => g !== "Short").map((g) => `<button class="chip ${SQ.genre === g ? "on" : ""}" data-g="${esc(g)}">${esc(g)}</button>`).join("")}</div>` : ""}
    <div id="results"></div>`;
  const q = $("#q");
  q.addEventListener("input", debounce(() => { SQ.q = q.value; SQ.page = 1; drawResults(); }, 140));
  view.querySelectorAll("[data-stab]").forEach((b) => b.addEventListener("click", () => { SQ.tab = b.dataset.stab; renderSearch(view, new URLSearchParams()); }));
  if (SQ.tab === "films") {
    $("#sort").value = SQ.sort;
    $("#decade").addEventListener("change", (e) => { SQ.decade = e.target.value; SQ.page = 1; drawResults(); });
    $("#sort").addEventListener("change", (e) => { SQ.sort = e.target.value; SQ.page = 1; drawResults(); });
    $("#gchips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-g]");
      if (!b) return;
      SQ.genre = b.dataset.g; SQ.page = 1;
      $("#gchips").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === b));
      drawResults();
    });
    $("#gchips .chip.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }
  drawResults();
  if (matchMedia("(hover: hover)").matches) q.focus();
}

let peopleSeq = 0;
export async function drawResults() {
  const el = $("#results");
  if (!el) return;
  if (SQ.tab === "people") {
    const seq = ++peopleSeq;
    el.innerHTML = spinnerHTML();
    const list = SQ.q.trim() ? await api.searchUsers(SQ.q.trim().toLowerCase(), 30) : await api.listProfiles({ limit: 30 });
    if (seq !== peopleSeq) return;
    el.innerHTML = list.length
      ? `<div class="count">${SQ.q.trim() ? `${list.length} match${list.length === 1 ? "" : "es"}` : "Most active members"}</div><div class="ulist">${list.map((p) => userRowHTML(p, followBtnHTML(p), `${p.ranked_count} ranked`)).join("")}</div>`
      : emptyHTML({ title: "No one found", text: "Try a different name or username." });
    return;
  }
  const all = searchFilms(SQ);
  const shown = all.slice(0, SQ.page * 60);
  el.innerHTML = all.length
    ? `<div class="count">${all.length.toLocaleString()} film${all.length === 1 ? "" : "s"}</div>
       <div class="grid">${shown.map((f) => cardHTML(f)).join("")}</div>
       ${shown.length < all.length ? `<div class="more"><button class="btn" data-act="more">Show more</button></div>` : ""}`
    : emptyHTML({ title: "No films found", text: "Try a shorter title, or clear the genre and decade filters." });
}
export function moreResults() { SQ.page++; drawResults(); }

