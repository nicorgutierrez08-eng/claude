// Keeps suggestion rows fresh: weighted random picks from a large pool of good matches,
// with films shown in the last few hours pushed back and no repeats within one page.
const KEY = "movi.recentShown";
const FRESH_HOURS = 6;

let recent = loadRecent();
let usedOnPage = new Set();

function loadRecent() {
  try {
    const cutoff = Date.now() - FRESH_HOURS * 3600000;
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return Object.fromEntries(Object.entries(saved).filter(([, t]) => t > cutoff));
  } catch {
    return {};
  }
}

function saveRecent() {
  try { localStorage.setItem(KEY, JSON.stringify(recent)); } catch {}
}

export function beginPage() {
  usedOnPage = new Set();
  recent = loadRecent();
}

// candidates: [weight, film][]; returns up to n films, sampled without replacement by weight.
export function sample(candidates, n) {
  const pool = [];
  for (const [w, f] of candidates) {
    if (usedOnPage.has(f.id)) continue;
    pool.push([Math.max(w, 1e-6) * (recent[f.id] ? 0.12 : 1), f]);
  }
  const out = [];
  let total = pool.reduce((t, x) => t + x[0], 0);
  while (out.length < n && pool.length) {
    let r = Math.random() * total;
    let k = 0;
    while (k < pool.length - 1 && (r -= pool[k][0]) > 0) k++;
    const [w, f] = pool.splice(k, 1)[0];
    total -= w;
    out.push(f);
  }
  const now = Date.now();
  for (const f of out) {
    usedOnPage.add(f.id);
    recent[f.id] = now;
  }
  saveRecent();
  return out;
}

// Turns a best-first score list into sampling weights that still favor the strongest matches.
export const softmax = (scored, temp = 1.5) => {
  const max = scored.length ? Math.max(...scored.map((x) => x[0])) : 0;
  return scored.map(([s, f]) => [Math.exp((s - max) / temp), f]);
};
export const byPopularity = (films, power = 1.6) => films.map((f) => [Math.pow(f.pop / 100, power) + 0.02, f]);
