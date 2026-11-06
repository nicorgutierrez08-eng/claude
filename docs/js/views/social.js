import { $, esc, ICON, timeAgo, toast } from "../util.js";
import { film, allFilms, genres } from "../films.js";
import { genreAffinity } from "../model.js";
import { api } from "../api/index.js";
import { S, followingIds, myRows, pendingRequests, approveFollower, removeFollower, refreshUnread, reloadFollows } from "../state.js";
import { avatarHTML, emptyHTML, spinnerHTML, userRowHTML, userHref, posterHTML, cardHTML, demoTag } from "../ui.js";
import { followBtnHTML } from "./feed.js";

let boardTab = "following";

export async function renderLeaderboard(view) {
  view.innerHTML = `<div class="list-head"><div><h1>Leaderboard</h1><p class="muted" style="margin:4px 0 0">Who's ranked the most films.</p></div></div>
    <div class="seg big" role="tablist">${["following", "everyone"].map((t) => `<button role="tab" class="${boardTab === t ? "on" : ""}" data-btab="${t}">${t === "following" ? "Friends" : "Everyone"}</button>`).join("")}</div>
    <div id="board">${spinnerHTML()}</div>`;
  view.querySelectorAll("[data-btab]").forEach((b) => b.addEventListener("click", () => { boardTab = b.dataset.btab; renderLeaderboard(view); }));
  if (S.me) await reloadFollows().catch(() => {});
  const ids = boardTab === "following" && S.me ? [S.me.id, ...followingIds()] : null;
  const list = await api.listProfiles({ ids, limit: 100 });
  const box = $("#board");
  if (!box) return;
  if (boardTab === "following" && list.length <= 1) {
    box.innerHTML = emptyHTML({ title: "Follow people to compete", text: "Your friends leaderboard shows you and everyone you follow.", action: `<a class="btn primary" href="#/people">${ICON.users} Find people</a>` });
    return;
  }
  const meIdx = list.findIndex((p) => p.id === S.me?.id);
  box.innerHTML = `${meIdx >= 0 ? `<div class="banner gold">${ICON.trophy} You're #${meIdx + 1} ${boardTab === "following" ? "among friends" : "on Movi"} with ${list[meIdx].ranked_count} films ranked</div>` : ""}
    <ol class="board">${list.map((p, i) => `<li class="${p.id === S.me?.id ? "me" : ""}"><span class="place p${i + 1}">${i + 1}</span>
      <a class="urow-main" href="${userHref(p)}">${avatarHTML(p, 42)}<span><b>${esc(p.display_name || p.username)}</b>${demoTag(p)}<small>@${esc(p.username)}</small></span></a>
      <span class="count-big">${p.ranked_count}<small>ranked</small></span></li>`).join("")}</ol>`;
}

const NOTE_TEXT = {
  follow: () => "started following you",
  follow_request: () => "wants to follow you",
  follow_accepted: () => "accepted your follow request",
  like: (n) => `liked your ranking of <b>${esc(film(n.film_id)?.title || "a film")}</b>`,
  comment: (n) => `commented on <b>${esc(film(n.film_id)?.title || "your post")}</b>: “${esc(n.body)}”`,
  rec: (n) => `recommended <b>${esc(film(n.film_id)?.title || "a film")}</b>${n.body ? `: “${esc(n.body)}”` : ""}`,
};

export async function renderNotifications(view) {
  view.innerHTML = `<div class="list-head"><h1>Notifications</h1></div><div id="nbox">${spinnerHTML()}</div>`;
  await reloadFollows().catch(() => {});
  const items = await api.getNotifications(60);
  const reqs = pendingRequests();
  const box = $("#nbox");
  if (!box) return;
  box.innerHTML = `
    ${reqs.length ? `<div class="panel-card"><h3>Follow requests</h3>${reqs.map((r) => userRowHTML(r.profile, `<button class="btn sm primary" data-act="approve" data-uid="${r.id}">Approve</button><button class="btn sm ghost" data-act="decline" data-uid="${r.id}">Decline</button>`)).join("")}</div>` : ""}
    ${items.length ? `<div class="notes">${items.map((n) => {
      const a = n.actor;
      if (!a) return "";
      const target = n.film_id != null ? `data-film="${n.film_id}"` : "";
      const right = ["follow", "follow_accepted"].includes(n.kind) ? followBtnHTML(a) : n.film_id != null && film(n.film_id) ? `<button class="nposter" ${target}>${posterHTML(film(n.film_id))}</button>` : "";
      return `<div class="note-row ${n.read ? "" : "unread"}"><a href="${userHref(a)}">${avatarHTML(a, 40)}</a>
        <div><a class="uname" href="${userHref(a)}">${esc(a.display_name || a.username)}</a> ${NOTE_TEXT[n.kind]?.(n) || ""}<small>${timeAgo(n.created_at)}</small></div>${right}</div>`;
    }).join("")}</div>` : reqs.length ? "" : emptyHTML({ title: "No notifications yet", text: "Likes, comments, new followers and recommendations show up here." })}`;
  if (items.some((n) => !n.read)) {
    await api.markNotificationsRead().catch(() => {});
    refreshUnread();
  }
}

export async function handleRequest(uid, approve) {
  try {
    if (approve) await approveFollower(uid); else await removeFollower(uid);
    toast(approve ? "Request approved" : "Request declined");
  } catch (e) { toast(e.message); }
}

export async function renderPeople(view) {
  view.innerHTML = `<div class="list-head"><div><h1>Find people</h1><p class="muted" style="margin:4px 0 0">Follow friends to fill your feed, get rec scores and compare taste.</p></div></div>
    <a class="searchbar fake" href="#/search?tab=people">${ICON.search}<span>Search by name or username</span></a>
    <div class="panel-card invite"><div><b>Invite friends to Movi</b><small>Share your profile link so they can follow you.</small></div><button class="btn sm primary" data-act="share-profile" data-username="${esc(S.me.username)}">${ICON.link} Copy invite link</button></div>
    <div id="pbox">${spinnerHTML()}</div>`;
  const all = await api.listProfiles({ limit: 100 });
  const mine = myRows();
  let theirRows = [];
  try { theirRows = await api.rankingsOfUsers(all.filter((p) => p.id !== S.me.id && !p.is_private).map((p) => p.id).slice(0, 40)); } catch {}
  const byUser = new Map();
  theirRows.forEach((r) => (byUser.get(r.user_id) || byUser.set(r.user_id, []).get(r.user_id)).push(r));
  const mineSet = new Set(mine.map((r) => r.film_id));
  const scored = all.filter((p) => p.id !== S.me.id).map((p) => {
    const rows = byUser.get(p.id) || [];
    const common = rows.filter((r) => mineSet.has(r.film_id)).length;
    return { p, common };
  });
  const suggest = scored.filter((x) => !S.following.has(x.p.id)).sort((a, b) => b.common - a.common || b.p.ranked_count - a.p.ranked_count);
  const box = $("#pbox");
  if (!box) return;
  box.innerHTML = suggest.length
    ? `<h2 class="h2m">Suggested for you</h2><div class="ulist">${suggest.map(({ p, common }) => userRowHTML(p, followBtnHTML(p), common ? `${common} films in common` : `${p.ranked_count} ranked`)).join("")}</div>`
    : emptyHTML({ title: "You're following everyone", text: "Invite friends to grow your feed." });
}

// ---------- Watch together ----------
const picked = new Set();
export async function renderTogether(view) {
  view.innerHTML = `<div class="list-head"><div><h1>Watch together</h1><p class="muted" style="margin:4px 0 0">Pick who's watching. Movi finds films nobody has seen that the group is likely to love.</p></div></div><div id="tbox">${spinnerHTML()}</div>`;
  const { following } = await api.getFollows(S.me.id);
  const friends = following.filter((f) => f.status === "accepted" && f.profile);
  const box = $("#tbox");
  if (!box) return;
  if (!friends.length) {
    box.innerHTML = emptyHTML({ title: "Follow some friends first", text: "Watch together uses your friends' rankings and watchlists.", action: `<a class="btn primary" href="#/people">${ICON.users} Find people</a>` });
    return;
  }
  box.innerHTML = `<div class="pick-people inline">${friends.map((f) => `<label class="pp ${picked.has(f.id) ? "on" : ""}">${avatarHTML(f.profile, 40)}<span>${esc(f.profile.display_name || f.profile.username)}<small>@${esc(f.profile.username)}</small></span><input type="checkbox" value="${esc(f.id)}" ${picked.has(f.id) ? "checked" : ""}></label>`).join("")}</div>
    <div class="row-c"><button class="btn primary" id="t-go">${ICON.sparkle} Find films for us</button></div>
    <div id="t-out"></div>`;
  box.querySelectorAll(".pp input").forEach((c) => c.addEventListener("change", () => {
    c.checked ? picked.add(c.value) : picked.delete(c.value);
    c.closest(".pp").classList.toggle("on", c.checked);
  }));
  $("#t-go").addEventListener("click", () => suggestTogether());
  if (picked.size) suggestTogether();
}

async function suggestTogether() {
  const out = $("#t-out");
  const ids = [...picked];
  if (!ids.length) { out.innerHTML = `<p class="muted center-t">Pick at least one friend.</p>`; return; }
  out.innerHTML = spinnerHTML("Comparing tastes…");
  const [rows, watches] = await Promise.all([api.rankingsOfUsers(ids), Promise.all(ids.map((id) => api.getWatchlist(id)))]);
  const G = genres().length;
  const members = [{ id: S.me.id, rows: myRows(), watch: S.watch }, ...ids.map((id, i) => ({ id, rows: rows.filter((r) => r.user_id === id), watch: watches[i] }))];
  const seen = new Set(members.flatMap((m) => m.rows.map((r) => r.film_id)));
  const affs = members.map((m) => genreAffinity(m.rows, G));
  const wantCount = new Map();
  members.forEach((m) => m.watch.forEach((w) => wantCount.set(w.film_id, (wantCount.get(w.film_id) || 0) + 1)));
  const films = allFilms();
  const scored = [];
  for (let i = 0; i < Math.min(films.length, 5000); i++) {
    const f = films[i];
    if (seen.has(f.id) || !f.g.length) continue;
    const fit = affs.map((a) => f.g.reduce((t, g) => t + a[g], 0) / Math.sqrt(f.g.length));
    const minFit = Math.min(...fit);
    const s = fit.reduce((a, b) => a + b, 0) / fit.length + minFit * 0.5 + f.pop / 25 + (wantCount.get(f.id) || 0) * 3;
    scored.push([s, f, wantCount.get(f.id) || 0]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const top = scored.slice(0, 18);
  out.innerHTML = `<h2 class="h2m">Tonight's picks for ${members.length} of you</h2>
    <div class="grid">${top.map(([, f, w]) => cardHTML(f, { label: w ? `On ${w} watchlist${w === 1 ? "" : "s"}` : `${f.year}` })).join("")}</div>`;
}
