import { $, esc, ICON, toast, copyText, today } from "./util.js";
import { film, details, genreNames, posterUrl, allFilms } from "./films.js";
import { BUCKETS, recScore, genreAffinity } from "./model.js";
import { api } from "./api/index.js";
import { S, scoreOf, isWatch, rankedCount, followingIds, loadFriendRows, friendRowsFor, myRows, updateDetails, rankedIds } from "./state.js";
import { posterHTML, railHTML, avatarHTML, userHref, scoreHTML, openLayer, closeLayer, openModal, closeModal, demoTag } from "./ui.js";

export const PLACES = ["Theater", "Streaming", "Home", "TV", "Plane", "Other"];

let current = null;

export function similarFilms(seed, limit = 14) {
  const taken = new Set([seed.id, ...(S.me ? [...rankedIds(), ...S.skip] : [])]);
  const out = [];
  const films = allFilms();
  for (let i = 0; i < Math.min(films.length, 6000); i++) {
    const f = films[i];
    if (taken.has(f.id) || !f.g.length) continue;
    const overlap = f.g.filter((g) => seed.g.includes(g)).length;
    if (!overlap) continue;
    out.push([f.pop / 20 + overlap * 2.5 - Math.abs(f.year - seed.year) / 12, f]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
}

export function recommendFor(limit = 18) {
  const rows = myRows();
  const aff = genreAffinity(rows, 64);
  const taken = new Set([...rankedIds(), ...S.skip, ...S.watch.map((w) => w.film_id)]);
  const films = allFilms();
  const out = [];
  for (let i = 0; i < Math.min(films.length, 6000); i++) {
    const f = films[i];
    if (taken.has(f.id) || !f.g.length) continue;
    out.push([f.pop / 20 + f.g.reduce((t, g) => t + aff[g], 0) / Math.sqrt(f.g.length), f]);
  }
  return out.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1]);
}

export async function openFilm(id) {
  const f = film(id);
  if (!f) return;
  current = { id, det: null, stats: null, others: null };
  openLayer("#sheet", sheetHTML(f));
  $("#sheet .panel").scrollTop = 0;
  const token = current;
  const [det, stats, others] = await Promise.all([
    details(id),
    api.filmStats([id]).catch(() => new Map()),
    api.rankingsForFilm(id).catch(() => []),
    S.me ? loadFriendRows().catch(() => []) : null,
  ]);
  if (current !== token) return;
  Object.assign(current, { det, stats: stats.get(id) || null, others });
  rerender();
}

export function refreshFilm() {
  if (current && !$("#sheet").hidden) rerender();
}
export const sheetFilmId = () => (!$("#sheet").hidden && current ? current.id : null);

function rerender() {
  const panel = $("#sheet .panel");
  const top = panel ? panel.scrollTop : 0;
  $("#sheet").innerHTML = sheetHTML(film(current.id), current, false);
  $("#sheet .panel").scrollTop = top;
  bindDetails(current.id);
}

export function closeFilm() {
  current = null;
  closeLayer("#sheet");
}

function sheetHTML(f, data = null, animate = true) {
  const det = data?.det;
  const s = S.me ? scoreOf(f.id) : null;
  const img = posterUrl(f);
  const anim = animate ? "" : ' style="animation:none"';
  const entry = S.me ? S.entries.get(f.id) : null;

  let yours = "";
  if (s) {
    yours = `<div class="yourscore">${scoreHTML(s.score, "lg")}
      <div><b>#${s.overall} of ${rankedCount()}</b> in your list<small>${BUCKETS[s.b].short} · #${s.i + 1} of ${s.n} in that group</small></div></div>
      ${detailsFormHTML(entry)}`;
  } else if (data && S.me) {
    const fr = friendRowsFor(f.id);
    const rec = recScore(fr, S.matches, data.stats);
    if (rec) {
      yours = `<div class="yourscore rec">${scoreHTML(rec.score, "lg")}<div><b>Rec score</b><small>${
        rec.basis === "friends" ? `Predicted for you from ${rec.n} friend${rec.n === 1 ? "" : "s"}, weighted by taste match` : `Average from ${rec.n} member${rec.n === 1 ? "" : "s"}. Follow people to personalize it.`
      }</small></div></div>`;
    }
  }

  const acts = !S.me
    ? `<a class="btn primary" href="#/welcome">${ICON.rank} Join Movi to rank it</a>`
    : s
      ? `<button class="btn primary" data-act="rank" data-id="${f.id}">${ICON.rank} Re-rank</button>
         <button class="btn" data-act="recommend" data-id="${f.id}">${ICON.send} Recommend</button>
         <button class="btn ghost" data-act="share-film" data-id="${f.id}" aria-label="Share">${ICON.share}</button>
         <button class="btn ghost danger" data-act="remove" data-id="${f.id}">Remove</button>`
      : `<button class="btn primary" data-act="rank" data-id="${f.id}">${ICON.rank} I've seen it — rank it</button>
         <button class="btn" data-act="${isWatch(f.id) ? "unwatch" : "watch"}" data-id="${f.id}">${isWatch(f.id) ? ICON.check + " On watchlist" : ICON.bookmark + " Want to watch"}</button>
         <button class="btn" data-act="recommend" data-id="${f.id}">${ICON.send} Recommend</button>
         <button class="btn ghost" data-act="share-film" data-id="${f.id}" aria-label="Share">${ICON.share}</button>`;

  const plot = det ? (det.plot ? `<p class="plot">${esc(det.plot)}</p>` : `<p class="plot muted">No summary available.</p>`) : `<p class="plot muted">Loading details…</p>`;
  const cast = det?.cast?.length ? `<p class="cast"><b>Starring</b> ${esc(det.cast.slice(0, 8).join(", "))}</p>` : "";
  const wiki = det?.href ? `<a class="wiki" href="https://en.wikipedia.org/wiki/${encodeURI(det.href)}" target="_blank" rel="noopener">Read more on Wikipedia</a>` : "";
  const global = data?.stats
    ? `<div class="statline"><span>${ICON.globe}</span><b>${Number(data.stats.avg_score).toFixed(1)}</b> average from ${data.stats.n} member${data.stats.n == 1 ? "" : "s"}</div>`
    : data ? `<div class="statline muted"><span>${ICON.globe}</span>No one on Movi has ranked this yet${S.me && !s ? " — be the first" : ""}.</div>` : "";

  let people = "";
  if (data?.others?.length) {
    const fset = new Set(S.me ? followingIds() : []);
    const others = data.others.filter((r) => r.profile && r.user_id !== S.me?.id);
    const friends = others.filter((r) => fset.has(r.user_id));
    const rest = others.filter((r) => !fset.has(r.user_id));
    const row = (r) => `<a class="who" href="${userHref(r.profile)}">${avatarHTML(r.profile, 36)}<span><span class="un"><b>${esc(r.profile.display_name || r.profile.username)}</b>${demoTag(r.profile)}</span>${r.note ? `<small>“${esc(r.note.slice(0, 90))}${r.note.length > 90 ? "…" : ""}”</small>` : `<small>@${esc(r.profile.username)}</small>`}</span>${scoreHTML(r.score)}</a>`;
    if (friends.length) people += `<div class="film-more"><div class="section-head"><h2>Friends who ranked it</h2></div><div class="whos">${friends.slice(0, 12).map(row).join("")}</div></div>`;
    if (rest.length) people += `<div class="film-more"><div class="section-head"><h2>${friends.length ? "Others on Movi" : "On Movi"}</h2></div><div class="whos">${rest.slice(0, 8).map(row).join("")}</div></div>`;
  }

  const more = similarFilms(f);
  return `<div class="scrim" data-act="close-film"${anim}></div>
    <div class="panel" role="dialog" aria-modal="true" aria-label="${esc(f.title)}"${anim}>
      ${img ? `<div class="backdrop"><img src="${esc(img)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()"></div>` : ""}
      <button class="close" data-act="close-film" aria-label="Close">${ICON.close}</button>
      <div class="film">${posterHTML(f)}
        <div class="body"><h2>${esc(f.title)}</h2>
          <div class="facts"><span class="tag">${f.year}</span>${genreNames(f).map((g) => `<span class="tag">${esc(g)}</span>`).join("")}</div>
          ${yours}<div class="acts">${acts}</div>${global}${plot}${cast}${wiki}</div></div>
      ${people}
      ${more.length ? `<div class="film-more"><div class="section-head"><h2>More like this</h2></div>${railHTML(more)}</div>` : ""}
    </div>`;
}

export function detailsFormHTML(e, { compact = false } = {}) {
  e = e || {};
  return `<form class="details ${compact ? "compact" : ""}" id="details" autocomplete="off">
    <div class="drow"><label>Watched<input type="date" name="watched_on" value="${esc(e.watched_on || "")}" max="${today()}"></label>
      <label class="check"><input type="checkbox" name="rewatch" ${e.rewatch ? "checked" : ""}> ${ICON.repeat} Rewatch</label></div>
    <div class="chips wrap" role="group" aria-label="Where did you watch it?">${PLACES.map((p) => `<button type="button" class="chip ${e.watched_where === p ? "on" : ""}" data-where="${p}">${p}</button>`).join("")}</div>
    <input type="text" name="watched_with" maxlength="120" placeholder="Who did you watch it with?" value="${esc(e.watched_with || "")}">
    <textarea class="note" name="note" maxlength="2000" placeholder="Add a note — what stuck with you?">${esc(e.note || "")}</textarea>
  </form>`;
}

export function readDetails(form) {
  const fd = new FormData(form);
  return {
    watched_on: fd.get("watched_on") || null,
    rewatch: fd.get("rewatch") === "on",
    watched_where: form.querySelector("[data-where].on")?.dataset.where || "",
    watched_with: String(fd.get("watched_with") || "").trim(),
    note: String(fd.get("note") || "").trim(),
  };
}

export function bindWhereChips(form, onChange) {
  form.querySelectorAll("[data-where]").forEach((b) =>
    b.addEventListener("click", () => {
      const on = !b.classList.contains("on");
      form.querySelectorAll("[data-where]").forEach((x) => x.classList.remove("on"));
      if (on) b.classList.add("on");
      onChange?.();
    }),
  );
}

function bindDetails(id) {
  const form = $("#sheet #details");
  if (!form) return;
  let t;
  const saveSoon = () => {
    clearTimeout(t);
    t = setTimeout(() => updateDetails(id, readDetails(form)), 400);
  };
  form.addEventListener("input", saveSoon);
  form.addEventListener("change", saveSoon);
  form.addEventListener("submit", (e) => e.preventDefault());
  bindWhereChips(form, saveSoon);
}

export async function recommendDialog(filmId) {
  const f = film(filmId);
  const { following, followers } = await api.getFollows(S.me.id);
  const seen = new Set();
  const people = [...following, ...followers].filter((x) => x.status === "accepted" && x.profile && !seen.has(x.id) && seen.add(x.id));
  if (!people.length) {
    openModal(`<h2 class="dlg-title">Recommend ${esc(f.title)}</h2><p class="muted">Follow some people first, then you can send them films.</p><div class="dlg-acts"><a class="btn primary" href="#/people" data-act="modal-close-nav">Find people</a></div>`);
    return;
  }
  const dlg = openModal(`<h2 class="dlg-title">Recommend ${esc(f.title)}</h2>
    <p class="muted">They'll get a notification and it'll show up in their Recs.</p>
    <div class="pick-people">${people.map((x) => `<label class="pp">${avatarHTML(x.profile, 36)}<span>${esc(x.profile.display_name || x.profile.username)}<small>@${esc(x.profile.username)}</small></span><input type="checkbox" value="${esc(x.id)}"></label>`).join("")}</div>
    <textarea class="note" id="rec-msg" maxlength="280" placeholder="Why should they watch it? (optional)"></textarea>
    <div class="dlg-acts"><button class="btn" data-act="modal-close">Cancel</button><button class="btn primary" id="rec-send">${ICON.send} Send</button></div>`);
  dlg.querySelector("#rec-send").addEventListener("click", async () => {
    const ids = [...dlg.querySelectorAll("input[type=checkbox]:checked")].map((c) => c.value);
    if (!ids.length) return toast("Pick at least one person");
    const msg = dlg.querySelector("#rec-msg").value.trim();
    try {
      await Promise.all(ids.map((id) => api.sendRec(id, filmId, msg)));
      closeModal();
      toast(`Sent to ${ids.length} ${ids.length === 1 ? "person" : "people"}`);
    } catch (e) {
      toast("Couldn't send: " + e.message);
    }
  });
}

export async function shareFilm(filmId) {
  const f = film(filmId);
  const s = S.me ? scoreOf(filmId) : null;
  const url = `${location.origin}${location.pathname}#/film/${filmId}`;
  const text = s ? `I gave ${f.title} (${f.year}) a ${s.score.toFixed(1)} on Movi` : `${f.title} (${f.year}) on Movi`;
  try {
    if (navigator.share) return await navigator.share({ title: f.title, text, url });
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  toast((await copyText(`${text} ${url}`)) ? "Link copied" : url);
}
