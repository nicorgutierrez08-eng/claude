import { $, esc, ICON, toast, debounce, today } from "./util.js";
import { film, searchFilms, filmCount } from "./films.js";
import { BUCKETS, ORDER } from "./model.js";
import { api } from "./api/index.js";
import { S, scoreOf, rankedCount, detachRanking, restoreLists, commitRanking, updateDetails } from "./state.js";
import { posterHTML, openLayer, closeLayer, openModal, closeModal, scoreHTML } from "./ui.js";
import { detailsFormHTML, readDetails, bindWhereChips } from "./film-sheet.js";

let F = null;
let onDone = null;

export const flowActive = () => !!F;
export function setFlowDoneHandler(fn) { onDone = fn; }

export function startRank(id) {
  const { prev, place } = detachRanking(id);
  F = { id, prev, wasRanked: !!place, prevBucket: place?.b ?? null, step: "feel", bucket: null, lo: 0, hi: 0, history: [], comps: 0, max: 0, busy: false, against: [] };
  openLayer("#flow", "");
  render();
}

export function cancelRank() {
  if (!F) return;
  if (F.step !== "done") restoreLists(F.prev);
  F = null;
  closeLayer("#flow");
}

function chooseBucket(b) {
  F.bucket = b;
  F.lo = 0;
  F.hi = S.lists[b].length;
  F.max = Math.ceil(Math.log2(F.hi + 1));
  F.step = "duel";
  if (F.lo >= F.hi) return finish();
  render();
}

function pick(newIsBetter, tie = false) {
  if (!F || F.busy || F.step !== "duel") return;
  const mid = (F.lo + F.hi) >> 1;
  F.history.push([F.lo, F.hi]);
  F.against.push(S.lists[F.bucket][mid]);
  F.comps++;
  if (tie) F.lo = F.hi = mid + 1;
  else if (newIsBetter) F.hi = mid;
  else F.lo = mid + 1;
  const next = () => (F.lo >= F.hi ? finish() : render());
  if (tie) return next();
  F.busy = true;
  $(newIsBetter ? "#pick-new" : "#pick-old")?.classList.add("chosen");
  $(newIsBetter ? "#pick-old" : "#pick-new")?.classList.add("lost");
  setTimeout(() => { if (F) { F.busy = false; next(); } }, 260);
}

function undo() {
  if (!F.history.length) {
    F.step = "feel";
    return render();
  }
  [F.lo, F.hi] = F.history.pop();
  F.against.pop();
  F.comps--;
  render();
}

async function finish() {
  F.step = "saving";
  render();
  try {
    await commitRanking({ filmId: F.id, bucket: F.bucket, index: F.lo, prev: F.prev });
  } catch {
    F = null;
    closeLayer("#flow");
    return;
  }
  F.step = "done";
  const e = S.entries.get(F.id);
  if (!e.watched_on && !F.wasRanked) e.watched_on = today();
  render();
  sparks();
}

async function complete(next = null) {
  if (!F) return;
  const f = F;
  const form = $("#flow #details");
  const det = form ? readDetails(form) : null;
  F = null;
  closeLayer("#flow");
  if (det) await updateDetails(f.id, det);
  if (!f.wasRanked || f.prevBucket !== f.bucket) {
    const s = scoreOf(f.id);
    api.postActivity({ kind: "ranked", film_id: f.id, bucket: s.b, score: s.score, note: det?.note || "" }).catch(() => {});
  }
  onDone?.(f.id);
  if (next === "another") quickAdd();
}

function render() {
  const el = $("#flow");
  if (!F) return;
  const f = film(F.id);
  const stepLabel = { feel: "Step 1 of 2", duel: "Step 2 of 2", saving: "Saving…", done: "Ranked" }[F.step];
  const top = `<div class="flow-top"><span class="step">${stepLabel}</span>
    <button class="close" style="position:static" data-act="${F.step === "done" ? "flow-done" : "flow-cancel"}" aria-label="Close">${ICON.close}</button></div>`;
  let body = "";
  if (F.step === "feel") {
    body = `<div class="feel-poster">${posterHTML(f)}</div><h2>How was ${esc(f.title)}?</h2>
      <p class="sub">${F.wasRanked ? "Re-ranking from scratch. " : ""}Go with your gut — you'll fine-tune it next.</p>
      <div class="center"><div class="feels">${ORDER.map((b, i) => `<button class="feel ${b}" data-act="feel" data-b="${b}"><i>${BUCKETS[b].icon}</i>${BUCKETS[b].label}<small>${BUCKETS[b].hint}</small><kbd>${i + 1}</kbd></button>`).join("")}</div></div>`;
  } else if (F.step === "duel") {
    const mid = (F.lo + F.hi) >> 1;
    const opp = film(S.lists[F.bucket][mid]);
    const dots = Array.from({ length: F.max }, (_, i) => `<i class="${i < F.comps ? "on" : ""}"></i>`).join("");
    body = `<h2>Which did you like more?</h2><p class="sub">Tap one, or use ← and →</p>
      <div class="center"><div class="duel">
        <button class="pick" id="pick-new" data-act="pick-new">${posterHTML(f)}<div class="t">${esc(f.title)}</div><div class="y">${f.year}</div><span class="new">New</span></button>
        <div class="vs">VS</div>
        <button class="pick" id="pick-old" data-act="pick-old">${posterHTML(opp)}<div class="t">${esc(opp.title)}</div><div class="y">${opp.year} · your ${scoreOf(opp.id).score.toFixed(1)}</div></button>
      </div><div class="dots" aria-label="Comparison ${F.comps + 1} of about ${F.max}">${dots}</div></div>
      <div class="flow-foot"><button class="btn ghost sm" data-act="undo">${ICON.undo} Back</button><button class="btn sm" data-act="tie">Too close to call</button></div>`;
  } else if (F.step === "saving") {
    body = `<div class="center"><div class="reel"></div></div>`;
  } else {
    const s = scoreOf(F.id);
    const beat = F.against.filter((id) => scoreOf(id).overall > s.overall).map((id) => film(id).title);
    body = `<div class="reveal">
      <div class="big-score ${s.b}">${s.score.toFixed(1)}</div>
      <h2 style="margin-top:0">${esc(f.title)}</h2>
      <p class="rank"><b>#${s.overall}</b> of ${rankedCount()} in your list · ${BUCKETS[s.b].short}${F.comps ? ` · ${F.comps} pick${F.comps === 1 ? "" : "s"}` : ""}</p>
      ${beat.length ? `<p class="beat">Ranked above ${beat.slice(0, 2).map(esc).join(" and ")}${beat.length > 2 ? ` and ${beat.length - 2} more` : ""}</p>` : ""}
      <div class="reveal-details">${detailsFormHTML(S.entries.get(F.id))}</div>
      <div class="flow-foot"><button class="btn" data-act="flow-another">${ICON.plus} Rank another</button><button class="btn primary" data-act="flow-done">Done</button></div></div>`;
  }
  el.innerHTML = `<div class="flow-in">${top}${body}</div>`;
  el.scrollTop = 0;
  if (F.step === "done") {
    const form = $("#flow #details");
    bindWhereChips(form);
    form.addEventListener("submit", (e) => e.preventDefault());
  }
}

function sparks() {
  const colors = ["#e5484d", "#ff8589", "#f2f0ee", "#6fdcb0"];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("i");
    s.className = "spark";
    const a = (Math.PI * 2 * i) / 28;
    const r = 130 + Math.random() * 120;
    s.style.cssText = `background:${colors[i % 4]};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px`;
    $("#flow").appendChild(s);
    setTimeout(() => s.remove(), 1100);
  }
}

export function flowAction(name, el) {
  switch (name) {
    case "feel": return chooseBucket(el.dataset.b);
    case "pick-new": return pick(true);
    case "pick-old": return pick(false);
    case "tie": return pick(false, true);
    case "undo": return undo();
    case "flow-cancel": return cancelRank();
    case "flow-done": return complete();
    case "flow-another": return complete("another");
  }
}

export function flowKey(e) {
  if (!F) return false;
  if (e.key === "Escape") { F.step === "done" ? complete() : cancelRank(); return true; }
  if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return true;
  if (F.step === "feel" && ["1", "2", "3"].includes(e.key)) chooseBucket(ORDER[Number(e.key) - 1]);
  else if (F.step === "duel" && e.key === "ArrowLeft") pick(true);
  else if (F.step === "duel" && e.key === "ArrowRight") pick(false);
  return true;
}

// ---------- Quick add: search any film and rank it ----------
export function quickAdd() {
  const dlg = openModal(`<h2 class="dlg-title">Rank a film</h2>
    <div class="searchbar">${ICON.search}<input id="qa" type="search" placeholder="Search ${filmCount().toLocaleString()} films" autocomplete="off"></div>
    <div class="qa-results" id="qa-results"></div>`, { wide: true });
  const input = dlg.querySelector("#qa");
  const out = dlg.querySelector("#qa-results");
  const draw = () => {
    const q = input.value.trim();
    const films = q ? searchFilms({ q }).slice(0, 30) : searchFilms({}).filter((f) => !scoreOf(f.id)).slice(0, 12);
    out.innerHTML = (q ? "" : `<p class="muted qa-hint">Popular films you haven't ranked</p>`) + (films.length
      ? films.map((f) => {
          const s = scoreOf(f.id);
          return `<button class="qa-row" data-act="qa-pick" data-id="${f.id}">${posterHTML(f)}<span><b>${esc(f.title)}</b><small>${f.year}${s ? " · in your list" : ""}</small></span>${s ? scoreHTML(s.score) : `<span class="qa-go">${ICON.rank}</span>`}</button>`;
        }).join("")
      : `<p class="muted qa-hint">No films match “${esc(q)}”.</p>`);
  };
  input.addEventListener("input", debounce(draw, 120));
  draw();
}

export function quickPick(id) {
  closeModal();
  startRank(id);
}

export function requireMe() {
  if (!S.me) { toast("Sign in to rank films"); location.hash = "#/welcome"; return false; }
  return true;
}
