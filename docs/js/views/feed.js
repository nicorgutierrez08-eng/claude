import { $, esc, ICON, timeAgo, toast } from "../util.js";
import { film } from "../films.js";
import { BUCKETS, streaks, goalProgress } from "../model.js";
import { api } from "../api/index.js";
import { S, followingIds, myRows, scoreOf, isWatch } from "../state.js";
import { posterHTML, avatarHTML, nameHTML, scoreHTML, emptyHTML, spinnerHTML, userRowHTML, demoTag } from "../ui.js";

let feedTab = "following";
let cursor = null;
let loading = false;

export async function renderFeed(view) {
  const rows = myRows();
  const st = streaks(rows);
  const goal = goalProgress(rows, S.me.yearly_goal);
  const ring = (pct) => `<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5"/><circle cx="18" cy="18" r="15.5" style="stroke-dasharray:${pct * 0.974} 100"/></svg>`;
  view.innerHTML = `
    <div class="feed-layout">
      <div class="feed-main">
        <div class="feed-head"><h1>Feed</h1>
          <div class="seg" role="tablist">${["following", "everyone"].map((t) => `<button role="tab" class="${feedTab === t ? "on" : ""}" data-feedtab="${t}">${t === "following" ? "Following" : "Everyone"}</button>`).join("")}</div></div>
        <div id="posts">${spinnerHTML()}</div>
        <div class="more" id="feed-more"></div>
      </div>
      <aside class="feed-side">
        <div class="panel-card week">
          <div class="wk"><span class="flame ${st.activeThisWeek ? "on" : ""}">${ICON.flame}</span><div><b>${st.current} week${st.current === 1 ? "" : "s"}</b><small>${st.activeThisWeek ? "Streak is alive this week" : st.current ? "Rank a film to keep your streak" : "Rank a film to start a streak"}</small></div></div>
          <div class="wk"><span class="goal">${ring(goal.pct)}<em>${goal.pct}%</em></span><div><b>${goal.done} of ${goal.goal}</b><small>${goal.year} goal</small></div></div>
          <button class="btn primary block" data-act="quick-add">${ICON.plus} Rank a film</button>
        </div>
        <div class="panel-card" id="suggest"><h3>People to follow</h3><div class="muted">Loading…</div></div>
      </aside>
    </div>`;
  view.querySelectorAll("[data-feedtab]").forEach((b) => b.addEventListener("click", () => { feedTab = b.dataset.feedtab; renderFeed(view); }));
  cursor = null;
  await loadPosts(true);
  loadSuggestions();
}

async function loadPosts(reset) {
  if (loading) return;
  loading = true;
  const box = $("#posts");
  const ids = feedTab === "following" ? [...followingIds(), S.me.id] : null;
  let items = [];
  try {
    items = await api.getFeed({ userIds: ids, before: reset ? null : cursor, limit: 15 });
  } catch (e) {
    loading = false;
    if (box) box.innerHTML = emptyHTML({ title: "Couldn't load the feed", text: esc(e.message) });
    return;
  }
  loading = false;
  if (!box) return;
  if (reset) box.innerHTML = "";
  if (reset && !items.length) {
    box.innerHTML = feedTab === "following"
      ? emptyHTML({ title: "Your feed is quiet", text: followingIds().length ? "The people you follow haven't ranked anything yet." : "Follow people to see what they're watching and how they rank it.", action: `<div class="row-c"><a class="btn primary" href="#/people">${ICON.users} Find people</a><button class="btn" data-feedtab-go="everyone">See everyone</button></div>` })
      : emptyHTML({ title: "Nothing here yet", text: "Be the first to rank something.", action: `<button class="btn primary" data-act="quick-add">${ICON.plus} Rank a film</button>` });
    box.querySelector("[data-feedtab-go]")?.addEventListener("click", () => { feedTab = "everyone"; renderFeed($("#view")); });
  }
  box.insertAdjacentHTML("beforeend", items.map(postHTML).join(""));
  cursor = items.length ? items[items.length - 1].created_at : cursor;
  const more = $("#feed-more");
  if (more) more.innerHTML = items.length === 15 ? `<button class="btn" data-act="feed-more">Load more</button>` : "";
}

export function feedMore() { loadPosts(false); }

export function postHTML(a) {
  const f = film(a.film_id);
  const p = a.profile;
  if (!f || !p) return "";
  const mine = a.user_id === S.me?.id;
  const verb = a.kind === "ranked"
    ? `ranked <a class="ftitle" data-film="${f.id}" href="#/film/${f.id}">${esc(f.title)}</a>`
    : `wants to watch <a class="ftitle" data-film="${f.id}" href="#/film/${f.id}">${esc(f.title)}</a>`;
  const meta = a.kind === "ranked" && a.bucket ? `<small>${BUCKETS[a.bucket].short} · ${f.year}</small>` : `<small>${f.year}</small>`;
  const myS = S.me ? scoreOf(f.id) : null;
  const saveBtn = S.me && !mine && !myS
    ? `<button class="pbtn ${isWatch(f.id) ? "on" : ""}" data-act="${isWatch(f.id) ? "unwatch" : "watch"}" data-id="${f.id}" aria-label="Watchlist">${ICON.bookmark}<span>${isWatch(f.id) ? "Saved" : "Save"}</span></button>`
    : myS && !mine ? `<span class="pmine">You: ${scoreHTML(myS.score)}</span>` : "";
  return `<article class="post" data-post="${a.id}">
    <header>${avatarHTML(p, 42)}<div class="pwho">${nameHTML(p)} ${demoTag(p)}<span class="pverb">${verb}</span>${meta}</div>
      <span class="ptime">${timeAgo(a.created_at)}</span></header>
    <div class="pbody">
      <button class="pposter" data-film="${f.id}" aria-label="${esc(f.title)}">${posterHTML(f)}</button>
      <div class="ptext">${a.kind === "ranked" ? `<div class="pscore">${scoreHTML(a.score, "lg")}</div>` : ""}${a.note ? `<p>“${esc(a.note)}”</p>` : ""}</div>
    </div>
    <footer>
      <button class="pbtn like ${a.liked ? "on" : ""}" data-act="like" data-id="${a.id}" aria-pressed="${a.liked}" ${S.me ? "" : "disabled"}>${ICON.heart}<span>${a.likes || ""}</span></button>
      <button class="pbtn" data-act="comments" data-id="${a.id}">${ICON.comment}<span>${a.comments || ""}</span></button>
      ${saveBtn}
      ${mine ? `<button class="pbtn end" data-act="delete-post" data-id="${a.id}" aria-label="Delete post">${ICON.trash}</button>` : ""}
    </footer>
    <div class="cmts" hidden></div>
  </article>`;
}

export async function toggleLike(btn) {
  const id = Number(btn.dataset.id);
  const on = !btn.classList.contains("on");
  const span = btn.querySelector("span");
  const n = Number(span.textContent || 0) + (on ? 1 : -1);
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-pressed", on);
  span.textContent = n || "";
  try { await (on ? api.like(id) : api.unlike(id)); } catch (e) {
    btn.classList.toggle("on", !on);
    span.textContent = n - (on ? 1 : -1) || "";
    toast("Couldn't update like: " + e.message);
  }
}

export async function toggleComments(btn) {
  const post = btn.closest(".post");
  const box = post.querySelector(".cmts");
  if (!box.hidden) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<div class="muted">Loading…</div>`;
  await drawComments(post);
}

async function drawComments(post) {
  const id = Number(post.dataset.post);
  const box = post.querySelector(".cmts");
  const list = await api.getComments(id);
  const owner = post.querySelector(".delete-post, [data-act=delete-post]") !== null;
  box.innerHTML = list.map((c) => `<div class="cmt">${avatarHTML(c.profile, 28)}<div><b>${c.profile ? nameHTML(c.profile) : "Someone"}</b> ${esc(c.body)}<small>${timeAgo(c.created_at)}${c.user_id === S.me?.id || owner ? ` · <button class="linkish" data-act="del-comment" data-id="${c.id}">Delete</button>` : ""}</small></div></div>`).join("")
    + (S.me ? `<form class="cmt-form"><input name="body" maxlength="500" placeholder="Add a comment…" autocomplete="off" required><button class="btn sm primary">Post</button></form>` : `<p class="muted">Sign in to comment.</p>`);
  const form = box.querySelector("form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = form.body.value.trim();
    if (!body) return;
    form.querySelector("button").disabled = true;
    try {
      await api.addComment(id, body);
      const counter = post.querySelector('[data-act="comments"] span');
      counter.textContent = Number(counter.textContent || 0) + 1;
      await drawComments(post);
      post.querySelector(".cmt-form input")?.focus();
    } catch (err) {
      toast("Couldn't post: " + err.message);
      form.querySelector("button").disabled = false;
    }
  });
}

export async function deleteComment(btn) {
  const post = btn.closest(".post");
  await api.deleteComment(Number(btn.dataset.id));
  const counter = post.querySelector('[data-act="comments"] span');
  counter.textContent = Math.max(0, Number(counter.textContent || 0) - 1) || "";
  await drawComments(post);
}

async function loadSuggestions() {
  const box = $("#suggest");
  if (!box) return;
  const exclude = new Set([S.me.id, ...S.following.keys()]);
  const ps = (await api.listProfiles({ limit: 40 })).filter((p) => !exclude.has(p.id)).slice(0, 5);
  box.innerHTML = `<h3>People to follow</h3>${ps.length ? ps.map((p) => userRowHTML(p, followBtnHTML(p), `${p.ranked_count} ranked`)).join("") : `<p class="muted">You're following everyone. Invite friends to Movi!</p>`}
    <a class="link" href="#/people">See all</a>`;
}

export function followBtnHTML(p, size = "sm") {
  if (!S.me || p.id === S.me.id) return "";
  const st = S.following.get(p.id);
  if (st === "accepted") return `<button class="btn ${size}" data-act="unfollow" data-uid="${p.id}">Following</button>`;
  if (st === "pending") return `<button class="btn ${size}" data-act="unfollow" data-uid="${p.id}">Requested</button>`;
  return `<button class="btn ${size} primary" data-act="follow" data-uid="${p.id}">Follow</button>`;
}

