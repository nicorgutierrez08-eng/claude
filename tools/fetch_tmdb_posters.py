#!/usr/bin/env python3
"""Look up a TMDB poster for every film in docs/data/index.json.

Usage: TMDB_API_KEY=... python3 tools/fetch_tmdb_posters.py
Writes tools/tmdb_posters.json ({"Title|Year": "/posterPath.jpg" or ""}). The file is a cache:
re-running only looks up films that aren't in it yet. build_movie_db.py reads it.
"""
import concurrent.futures as cf
import json
import os
import ssl
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "docs", "data", "index.json")
CACHE = os.path.join(ROOT, "tools", "tmdb_posters.json")
KEY = os.environ.get("TMDB_API_KEY")

ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)


def get(params):
    url = "https://api.themoviedb.org/3/search/movie?" + urllib.parse.urlencode({"api_key": KEY, "include_adult": "false", **params})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=20, context=ctx) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 + attempt * 2)
                continue
            if e.code >= 500:
                time.sleep(1 + attempt)
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            time.sleep(1 + attempt)
    return {"results": []}


def norm(s):
    return "".join(c for c in s.lower() if c.isalnum())


def find_poster(title, year):
    def pick(results, strict):
        ok = []
        for r in results:
            ry = int((r.get("release_date") or "0")[:4] or 0)
            if r.get("poster_path") and (ry == year if strict else abs(ry - year) <= 1):
                ok.append(r)
        for r in ok:
            if norm(title) in (norm(r.get("title", "")), norm(r.get("original_title", ""))):
                return r["poster_path"]
        # Same title search and exact year: TMDB's top hit is almost always the film.
        return ok[0]["poster_path"] if strict and ok else ""

    hit = pick(get({"query": title, "primary_release_year": year}).get("results", []), True)
    if hit:
        return hit
    return pick(get({"query": title}).get("results", []), False)


def main():
    if not KEY:
        sys.exit("Set TMDB_API_KEY")
    films = json.load(open(INDEX))["films"]
    cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
    todo = [(t, y) for t, y, *_ in films if f"{t}|{y}" not in cache]
    print(f"{len(films)} films, {len(todo)} to look up", flush=True)
    done = 0
    with cf.ThreadPoolExecutor(max_workers=16) as pool:
        futures = {pool.submit(find_poster, t, y): (t, y) for t, y in todo}
        for fut in cf.as_completed(futures):
            t, y = futures[fut]
            try:
                cache[f"{t}|{y}"] = fut.result()
            except Exception as e:  # keep going; a re-run retries anything missing
                print("error", t, y, e, flush=True)
            done += 1
            if done % 1000 == 0:
                json.dump(cache, open(CACHE, "w"), ensure_ascii=False, separators=(",", ":"))
                print(f"{done}/{len(todo)}", flush=True)
    json.dump(cache, open(CACHE, "w"), ensure_ascii=False, separators=(",", ":"))
    found = sum(1 for v in cache.values() if v)
    print(f"done: {found}/{len(cache)} films have a TMDB poster")


if __name__ == "__main__":
    main()
