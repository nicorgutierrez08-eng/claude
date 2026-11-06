import { $, esc, ICON, toast, copyText } from "../util.js";
import { film } from "../films.js";
import { rowsWithScores, tasteMatch, tasteStats, archetype, streaks, goalProgress, badges } from "../model.js";
import { api } from "../api/index.js";
import { S, myRows } from "../state.js";
import { avatarHTML, cardHTML, emptyHTML, spinnerHTML, sectionHTML, scoreHTML, posterHTML, railHTML, userRowHTML, openModal, demoTag } from "../ui.js";
import { postHTML, followBtnHTML } from "./feed.js";
import { listRowsHTML, filterRows, listControlsHTML, bindListControls } from "./lists.js";

const PQ = { bucket: "all", genre: "", decade: "", sort: "rank", q: "", year: "" };

export async function renderProfile(view, username, tab = "rankings") {
  view.innerHTML = spinnerHTML();
  const p = await api.getProfileByUsername(username);
  if (!p) {
    view.innerHTML = emptyHTML({ title: "No one by that name", text: `There's no member called @${esc(username)}.`, action: `<a class="btn" href="#/search?tab=people">Search people</a>` });
    return;
  }
  const own = S.me?.id === p.id;
  const follows = await api.getFollows(p.id);
  const st = S.me ? follows.followers.find((f) => f.id === S.me.id)?.status || null : null;
  if (S.me && !own) {
    if (st) S.following.set(p.id, st);
    else S.following.delete(p.id);
  }
  const canSee = own || !p.is_private || st === "accepted";
  const [rowsRaw, watch, board] = await Promise.all([
    own ? myRows() : canSee ? api.getRankings(p.id) : [],
    own ? S.watch : canSee ? api.getWatchlist(p.id) : [],
    api.listProfiles({ limit: 1000 }).catch(() => []),
  ]);
  const rows = own ? rowsRaw : rowsWithScores(rowsRaw);
  const followers = follows.followers.filter((f) => f.status === "accepted");
  const following = follows.following.filter((f) => f.status === "accepted");
  const place = board.findIndex((x) => x.id === p.id) + 1;
  const match = !own && S.me && rows.length ? tasteMatch(myRows(), rows) : null;

  const tabs = [["rankings", `Rankings · ${rows.length}`], ["want", `Watchlist · ${watch.length}`], ["activity", "Activity"], ["taste", "Taste"]];
  if (!own && S.me && canSee) tabs.push(["compare", "Compare"]);
  if (!tabs.some(([k]) => k === tab)) tab = "rankings";
  const base = `#/u/${encodeURIComponent(p.username)}`;

  view.innerHTML = `
    <div class="phead">
      ${avatarHTML(p, 92)}
      <div class="pinfo">
        <h1>${esc(p.display_name || p.username)} ${p.is_private ? `<span class="lock" title="Private account">${ICON.lock}</span>` : ""}${demoTag(p)}</h1>
        <div class="muted">@${esc(p.username)} · <span class="archetype">${esc(archetype(rows))}</span></div>
        ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ""}
        <div class="pstats">
          <a href="${base}/rankings"><b>${p.ranked_count}</b> ranked</a>
          <button data-act="show-follows" data-uid="${p.id}" data-kind="followers"><b>${followers.length}</b> followers</button>
          <button data-act="show-follows" data-uid="${p.id}" data-kind="following"><b>${following.length}</b> following</button>
          ${place ? `<a href="#/leaderboard"><b>#${place}</b> on Movi</a>` : ""}
        </div>
        ${match?.pct != null ? `<div class="match"><b>${match.pct}%</b> taste match <span class="muted">· ${match.common.length} films in common</span></div>` : match ? `<div class="match muted">Rank more of the same films to see your taste match (${match.common.length} in common so far)</div>` : ""}
      </div>
      <div class="pacts">
        ${own ? `<a class="btn sm" href="#/settings">${ICON.gear} Edit profile</a>` : followBtnHTML(p, "")}
        <button class="btn sm ghost" data-act="share-profile" data-username="${esc(p.username)}" aria-label="Share profile">${ICON.link} Share</button>
      </div>
    </div>
    ${own && S.followers.some((f) => f.status === "pending") ? `<a class="banner" href="#/notifications">${ICON.users} You have follow requests waiting</a>` : ""}
    <div class="seg big" role="tablist">${tabs.map(([k, v]) => `<a role="tab" class="${tab === k ? "on" : ""}" href="${base}/${k}">${v}</a>`).join("")}</div>
    <div id="ptab"></div>`;

  const box = $("#ptab");
  if (!canSee) {
    box.innerHTML = emptyHTML({ title: "This account is private", text: st === "pending" ? "Your follow request is waiting for approval." : `Follow @${esc(p.username)} to see their rankings and activity.`, action: S.me ? followBtnHTML(p, "") : `<a class="btn primary" href="#/welcome">Join Movi</a>` });
    return;
  }
  if (tab === "rankings") {
    if (!rows.length) { box.innerHTML = emptyHTML({ title: own ? "You haven't ranked anything yet" : "No rankings yet", action: own ? `<button class="btn primary" data-act="quick-add">${ICON.plus} Rank a film</button>` : "" }); return; }
    box.innerHTML = listControlsHTML(rows, PQ, "plc") + `<div class="rows" id="prow"></div>`;
    const draw = () => { $("#prow").innerHTML = listRowsHTML(filterRows(rows, PQ), { owner: true }); };
    bindListControls(box, PQ, draw);
    draw();
  } else if (tab === "want") {
    box.innerHTML = watch.length ? `<div class="grid" style="margin-top:18px">${watch.map((w) => cardHTML(film(w.film_id))).join("")}</div>` : emptyHTML({ title: "Watchlist is empty" });
  } else if (tab === "activity") {
    const items = await api.getFeed({ userIds: [p.id], limit: 30 });
    box.innerHTML = items.length ? `<div class="posts">${items.map(postHTML).join("")}</div>` : emptyHTML({ title: "No activity yet" });
  } else if (tab === "taste") {
    box.innerHTML = tasteHTML(rows, p, { followers: followers.length, following: following.length, own });
  } else if (tab === "compare") {
    box.innerHTML = compareHTML(rows, p, match);
  }
}

function bars(items, max) {
  return `<div class="bars">${items.map(([label, val, right]) => `<div class="bar"><span>${esc(label)}</span><div class="track"><div class="fill" style="width:${(val / max) * 100}%"></div></div><span class="v">${right}</span></div>`).join("")}</div>`;
}

function tasteHTML(rows, p, { followers, following, own }) {
  if (!rows.length) return emptyHTML({ title: "No taste profile yet", text: own ? "Rank a few films to see your genres, decades and movie personality." : "" });
  const avg = rows.reduce((t, r) => t + Number(r.score), 0) / rows.length;
  const st = streaks(rows);
  const goal = goalProgress(rows, p.yearly_goal);
  const stats = tasteStats(rows);
  const maxG = Math.max(1, ...stats.map((e) => e.n));
  const dec = new Map();
  rows.forEach((r) => { const d = Math.floor(film(r.film_id).year / 10) * 10; dec.set(d, (dec.get(d) || 0) + 1); });
  const decs = [...dec].sort((a, b) => b[0] - a[0]);
  const maxD = Math.max(1, ...decs.map((d) => d[1]));
  const places = new Map();
  rows.forEach((r) => r.watched_where && places.set(r.watched_where, (places.get(r.watched_where) || 0) + 1));
  const bs = badges({ rows, followers, following });
  const earned = bs.filter((b) => b.earned).length;
  const top4 = [...rows].sort((a, b) => a.overall - b.overall).slice(0, 4).map((r) => film(r.film_id));
  const ring = `<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5"/><circle cx="18" cy="18" r="15.5" style="stroke-dasharray:${goal.pct * 0.974} 100"/></svg>`;
  return `
    <div class="tiles">
      <div class="tile"><b>${avg.toFixed(1)}</b><span>Avg score</span></div>
      <div class="tile"><b>${rows.filter((r) => r.bucket === "loved").length}</b><span>Loved</span></div>
      <div class="tile"><b>${st.current}<small>wk</small></b><span>Streak · best ${st.longest}</span></div>
      <div class="tile goal-tile"><span class="goal">${ring}<em>${goal.pct}%</em></span><div><b>${goal.done}/${goal.goal}</b><span>${goal.year} goal</span></div></div>
    </div>
    ${sectionHTML("Top 4", "The very top of the list", `<div class="top4">${top4.map((f) => cardHTML(f)).join("")}</div>`)}
    <div class="two">
      ${sectionHTML("Genres", "Films ranked · average score", bars(stats.slice(0, 8).map((e) => [e.g, e.n, `${e.n} · ${(e.sum / e.n).toFixed(1)}`]), maxG))}
      ${sectionHTML("Decades", "When the films came out", bars(decs.slice(0, 8).map(([d, c]) => [`${d}s`, c, c]), maxD))}
    </div>
    ${places.size ? sectionHTML("Where they watch", "", bars([...places].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, v]), Math.max(...places.values()))) : ""}
    ${sectionHTML("Badges", `${earned} of ${bs.length} earned`, `<div class="badges">${bs.map((b) => `<div class="bdg ${b.earned ? "on" : ""}" title="${esc(b.desc)}"><i>${b.earned ? ICON.trophy : ICON.lock}</i><b>${esc(b.name)}</b><small>${esc(b.desc)}</small>${b.earned ? "" : `<div class="track"><div class="fill" style="width:${(b.value / b.target) * 100}%"></div></div><small>${b.value} / ${b.target}</small>`}</div>`).join("")}</div>`)}`;
}

function compareHTML(rows, p, match) {
  const mine = new Map(myRows().map((r) => [r.film_id, r]));
  const common = rows.filter((r) => mine.has(r.film_id)).map((r) => ({ id: r.film_id, them: Number(r.score), me: mine.get(r.film_id).score }));
  const theirLoved = rows.filter((r) => r.bucket === "loved" && !mine.has(r.film_id)).sort((a, b) => a.overall - b.overall).slice(0, 16).map((r) => film(r.film_id));
  const name = esc(p.display_name || p.username);
  const row = (c) => {
    const f = film(c.id);
    const d = Math.abs(c.them - c.me);
    return `<button class="crow" data-film="${f.id}">${posterHTML(f)}<span class="t">${esc(f.title)}<small>${f.year}</small></span><span class="cs"><small>${name}</small>${scoreHTML(c.them)}</span><span class="cs"><small>You</small>${scoreHTML(c.me)}</span><span class="cd ${d < 1 ? "agree" : d > 3 ? "clash" : ""}">${d < 1 ? "Agree" : `±${d.toFixed(1)}`}</span></button>`;
  };
  const agree = [...common].sort((a, b) => Math.abs(a.them - a.me) - Math.abs(b.them - b.me)).slice(0, 8);
  const clash = [...common].sort((a, b) => Math.abs(b.them - b.me) - Math.abs(a.them - a.me)).filter((c) => Math.abs(c.them - c.me) >= 1.5).slice(0, 8);
  return `
    <div class="compare-hero"><div>${avatarHTML(S.me, 56)}<b>You</b></div><div class="big-match">${match?.pct != null ? `${match.pct}%` : "–"}<small>taste match</small></div><div>${avatarHTML(p, 56)}<b>${name}</b></div></div>
    <p class="muted center-t">${common.length} film${common.length === 1 ? "" : "s"} you've both ranked</p>
    ${theirLoved.length ? sectionHTML(`${name} loved these — you haven't ranked them`, "", railHTML(theirLoved)) : ""}
    ${common.length ? sectionHTML("You agree on", "", `<div class="crows">${agree.map(row).join("")}</div>`) : emptyHTML({ title: "Nothing in common yet", text: "Rank some of the same films to compare." })}
    ${clash.length ? sectionHTML("Where you disagree", "", `<div class="crows">${clash.map(row).join("")}</div>`) : ""}`;
}

export async function showFollows(uid, kind) {
  const { followers, following } = await api.getFollows(uid);
  const list = (kind === "followers" ? followers : following).filter((x) => x.status === "accepted" && x.profile);
  const own = uid === S.me?.id;
  openModal(`<h2 class="dlg-title">${kind === "followers" ? "Followers" : "Following"}</h2>
    <div class="ulist">${list.length ? list.map((x) => userRowHTML(x.profile, own && kind === "followers" ? `${followBtnHTML(x.profile)}<button class="btn sm ghost" data-act="remove-follower" data-uid="${x.id}">Remove</button>` : followBtnHTML(x.profile), `${x.profile.ranked_count} ranked`)).join("") : `<p class="muted">No one yet.</p>`}</div>`);
}

export async function shareProfile(username) {
  const url = `${location.origin}${location.pathname}#/u/${encodeURIComponent(username)}`;
  try {
    if (navigator.share) return await navigator.share({ title: `@${username} on Movi`, url });
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  toast((await copyText(url)) ? "Profile link copied" : url);
}
