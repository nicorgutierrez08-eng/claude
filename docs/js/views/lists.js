import { $, esc, ICON, norm, timeAgo, toast, copyText } from "../util.js";
import { film, genres, genreNames } from "../films.js";
import { BUCKETS } from "../model.js";
import { api } from "../api/index.js";
import { S, myRows, rankedCount, scoreOf } from "../state.js";
import { posterHTML, cardHTML, scoreHTML, emptyHTML, avatarHTML, nameHTML, spinnerHTML } from "../ui.js";

const LQ = { bucket: "all", genre: "", decade: "", sort: "rank", q: "", year: "" };

export function listRowsHTML(rows, { showNote = true, owner = true } = {}) {
  return rows.map((r) => {
    const f = film(r.film_id);
    const bits = [f.year, ...genreNames(f).slice(0, 2)];
    if (r.watched_where) bits.push(r.watched_where);
    if (r.rewatch) bits.push("Rewatch");
    return `<button class="rowi" data-film="${f.id}"><span class="n">${r.overall}</span>${posterHTML(f)}
      <span class="rinfo"><span class="t">${esc(f.title)}</span><span class="sub">${esc(bits.join(" · "))}</span>${showNote && r.note ? `<span class="rnote">“${esc(r.note.slice(0, 120))}${r.note.length > 120 ? "…" : ""}”</span>` : ""}</span>
      ${scoreHTML(r.score)}</button>`;
  }).join("") || emptyHTML({ title: owner ? "No matches" : "Nothing here", text: owner ? "Try clearing a filter." : "" });
}

export function filterRows(rows, Q) {
  const g = Q.genre ? genres().indexOf(Q.genre) : -1;
  const words = norm(Q.q || "").split(" ").filter(Boolean);
  let out = rows.filter((r) => {
    const f = film(r.film_id);
    if (Q.bucket !== "all" && r.bucket !== Q.bucket) return false;
    if (g >= 0 && !f.g.includes(g)) return false;
    if (Q.decade && Math.floor(f.year / 10) * 10 !== Number(Q.decade)) return false;
    if (Q.year && new Date(r.watched_on || r.created_at).getFullYear() !== Number(Q.year)) return false;
    if (words.length && !words.every((w) => f.n.includes(w))) return false;
    return true;
  });
  const by = {
    rank: (a, b) => a.overall - b.overall,
    recent: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    watched: (a, b) => String(b.watched_on || b.created_at).localeCompare(String(a.watched_on || a.created_at)),
    release: (a, b) => film(b.film_id).year - film(a.film_id).year,
    title: (a, b) => film(a.film_id).n.localeCompare(film(b.film_id).n),
  };
  return out.sort(by[Q.sort] || by.rank);
}

export function listControlsHTML(rows, Q, id = "lc") {
  const decs = [...new Set(rows.map((r) => Math.floor(film(r.film_id).year / 10) * 10))].sort((a, b) => b - a);
  const years = [...new Set(rows.map((r) => new Date(r.watched_on || r.created_at).getFullYear()))].sort((a, b) => b - a);
  const gs = [...new Set(rows.flatMap((r) => genreNames(film(r.film_id))))].sort();
  const counts = { all: rows.length, loved: 0, fine: 0, disliked: 0 };
  rows.forEach((r) => counts[r.bucket]++);
  return `<div class="list-controls" id="${id}">
    <div class="chips" data-ctl="bucket">${["all", "loved", "fine", "disliked"].map((k) => `<button class="chip ${Q.bucket === k ? "on" : ""}" data-v="${k}">${k === "all" ? "All" : BUCKETS[k].short} · ${counts[k]}</button>`).join("")}</div>
    <div class="filters">
      <input type="search" data-ctl="q" placeholder="Search this list" value="${esc(Q.q)}">
      <select data-ctl="genre" aria-label="Genre"><option value="">All genres</option>${gs.map((g) => `<option ${Q.genre === g ? "selected" : ""}>${esc(g)}</option>`).join("")}</select>
      <select data-ctl="decade" aria-label="Decade"><option value="">Any decade</option>${decs.map((d) => `<option value="${d}" ${Q.decade == d ? "selected" : ""}>${d}s</option>`).join("")}</select>
      <select data-ctl="year" aria-label="Year watched"><option value="">Any year watched</option>${years.map((y) => `<option value="${y}" ${Q.year == y ? "selected" : ""}>Watched in ${y}</option>`).join("")}</select>
      <select data-ctl="sort" aria-label="Sort"><option value="rank">Sort: Rank</option><option value="recent">Recently ranked</option><option value="watched">Recently watched</option><option value="release">Release year</option><option value="title">Title</option></select>
    </div></div>`;
}

export function bindListControls(root, Q, redraw) {
  root.querySelector('[data-ctl="sort"]').value = Q.sort;
  root.querySelector('[data-ctl="bucket"]').addEventListener("click", (e) => {
    const b = e.target.closest("[data-v]");
    if (!b) return;
    Q.bucket = b.dataset.v;
    root.querySelectorAll('[data-ctl="bucket"] .chip').forEach((c) => c.classList.toggle("on", c === b));
    redraw();
  });
  root.querySelectorAll("select[data-ctl], input[data-ctl]").forEach((el) => el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => { Q[el.dataset.ctl] = el.value; redraw(); }));
}

export async function renderLists(view, tab = "been") {
  const tabs = { been: `Been · ${rankedCount()}`, want: `Want to watch · ${S.watch.length}`, recs: "Recs for you" };
  view.innerHTML = `<div class="list-head"><div><h1>My Lists</h1></div>
      <div class="settings"><button class="btn sm" data-act="share-list">${ICON.share} Share top 10</button><button class="btn sm primary" data-act="quick-add">${ICON.plus} Rank a film</button></div></div>
    <div class="seg big" role="tablist">${Object.entries(tabs).map(([k, v]) => `<a role="tab" class="${tab === k ? "on" : ""}" href="#/lists/${k}">${v}</a>`).join("")}</div>
    <div id="list-body"></div>`;
  const body = $("#list-body");
  if (tab === "want") return renderWant(body);
  if (tab === "recs") return renderRecs(body);
  const rows = myRows();
  if (!rows.length) {
    body.innerHTML = emptyHTML({ title: "Your list is empty", text: "Rank a film you've seen and it lands here with a score.", action: `<button class="btn primary" data-act="quick-add">${ICON.plus} Rank a film</button>` });
    return;
  }
  body.innerHTML = listControlsHTML(rows, LQ) + `<div class="rows" id="rows"></div>`;
  const draw = () => { $("#rows").innerHTML = listRowsHTML(filterRows(rows, LQ)); };
  bindListControls(body, LQ, draw);
  draw();
}

function renderWant(body) {
  if (!S.watch.length) {
    body.innerHTML = emptyHTML({ title: "Nothing saved yet", text: "Tap “Save” or the bookmark on any film to keep it here.", action: `<a class="btn primary" href="#/discover">Find films</a>` });
    return;
  }
  body.innerHTML = `<p class="muted" style="margin:14px 0 0">Watched one? Tap “Watched” to rank it.</p>
    <div class="grid quick" style="margin-top:16px">${S.watch.map((w) => cardHTML(film(w.film_id), {
      label: w.from_user ? "Recommended" : `Saved ${timeAgo(w.created_at)}`,
      acts: `<div class="acts"><button data-act="rank" data-id="${w.film_id}">Watched</button><button data-act="unwatch" data-id="${w.film_id}">Remove</button></div>`,
    })).join("")}</div>`;
}

async function renderRecs(body) {
  body.innerHTML = spinnerHTML();
  let recs = [];
  try { recs = await api.getRecsForMe(); } catch (e) { body.innerHTML = emptyHTML({ title: "Couldn't load recs", text: esc(e.message) }); return; }
  if (!recs.length) {
    body.innerHTML = emptyHTML({ title: "No recommendations yet", text: "When friends send you a film, it shows up here. You can send them one from any film page." });
    return;
  }
  body.innerHTML = `<div class="recs">${recs.map((r) => {
    const f = film(r.film_id);
    if (!f) return "";
    const s = scoreOf(f.id);
    return `<div class="rec" data-rec="${r.id}">
      <button class="pposter" data-film="${f.id}">${posterHTML(f)}</button>
      <div class="rec-body">
        <div class="rec-from">${avatarHTML(r.profile, 28)} ${r.profile ? nameHTML(r.profile) : "Someone"} <span class="muted">recommended · ${timeAgo(r.created_at)}</span></div>
        <button class="ftitle big" data-film="${f.id}">${esc(f.title)} <span class="muted">${f.year}</span></button>
        ${r.message ? `<p class="rec-msg">“${esc(r.message)}”</p>` : ""}
        <div class="rec-acts">${s ? `<span class="pmine">You ranked it ${scoreHTML(s.score)}</span>` : `<button class="btn sm primary" data-act="rank" data-id="${f.id}">Watched it</button><button class="btn sm" data-act="watch-from" data-id="${f.id}" data-from="${esc(r.from_user)}">${ICON.bookmark} Save</button>`}
          <button class="btn sm ghost" data-act="dismiss-rec" data-id="${r.id}">Dismiss</button></div>
      </div></div>`;
  }).join("")}</div>`;
}

export async function shareList() {
  const rows = myRows().slice(0, 10);
  if (!rows.length) return toast("Rank some films first");
  const url = `${location.origin}${location.pathname}#/u/${encodeURIComponent(S.me.username)}`;
  const text = `My Movi top ${rows.length}:\n` + rows.map((r, i) => `${i + 1}. ${film(r.film_id).title} (${film(r.film_id).year}) — ${r.score.toFixed(1)}`).join("\n") + `\n${url}`;
  try {
    if (navigator.share) return await navigator.share({ text });
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  toast((await copyText(text)) ? "Top 10 copied to clipboard" : "Couldn't copy — try again");
}
