#!/usr/bin/env python3
"""Build Movi's static movie database from the Wikipedia movie dataset.

Usage: python3 tools/build_movie_db.py path/to/movies.json docs/data
Source: https://github.com/prust/wikipedia-movie-data (CC BY-SA, from Wikipedia)
"""
import json
import os
import re
import sys

SHARD_SIZE = 500
POSTER_PREFIX = "https://upload.wikimedia.org/wikipedia/"

GENRE_ALIASES = {"Sport": "Sports", "Sci-Fi": "Science Fiction", "Animation": "Animated"}
GENRES = [
    "Drama", "Comedy", "Action", "Thriller", "Romance", "Crime", "Horror", "Adventure",
    "Science Fiction", "Fantasy", "Animated", "Mystery", "Western", "Musical", "War",
    "Noir", "Biography", "Historical", "Documentary", "Sports", "Family", "Superhero",
    "Supernatural", "Slasher", "Spy", "Teen", "Satire", "Martial Arts", "Disaster",
    "Political", "Independent", "Silent", "Short",
]
GENRE_INDEX = {g: i for i, g in enumerate(GENRES)}

BOOSTS = [
    (r"greatest films", 6), (r"Best Picture", 5), (r"highest-grossing", 4),
    (r"Academy Award", 4), (r"National Film Registry", 4), (r"Oscar", 2),
    (r"Golden Globe", 2), (r"acclaim", 2), (r"cult (film|classic|following)", 2),
    (r"box office (success|hit)", 2), (r"franchise", 2), (r"sequel", 1),
    (r"Cannes", 2), (r"Pixar|Marvel|Star Wars|Disney", 2),
]


def norm(title):
    return re.sub(r"[^a-z0-9]", "", title.lower().replace("&", "and"))


def load_canon():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "canon.txt")
    canon = {}
    for rank, line in enumerate(open(path, encoding="utf-8")):
        title, _, year = line.strip().rpartition("|")
        if title:
            canon.setdefault((norm(title), int(year)), rank)
    return canon


def canon_bonus(m, canon):
    key = norm(m["title"])
    for dy in (0, -1, 1):
        rank = canon.get((key, m["year"] + dy))
        if rank is not None:
            return 60 - rank / 20
    return 0


def popularity(m):
    text = m.get("extract", "")
    score = min(len(text), 1500) / 150
    score += sum(w for pat, w in BOOSTS if re.search(pat, text))
    score += 3 if m.get("thumbnail") else 0
    score += min(len(m.get("cast", [])), 12) / 3
    score += max(0, m["year"] - 1930) / 15
    if "Silent" in m.get("genres", []) or "Short" in m.get("genres", []):
        score -= 5
    if "upcoming" in text[:200]:
        score -= 3
    return score


def clean_extract(text, limit=700):
    text = re.sub(r"\s+", " ", text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = cut.rfind(". ")
    return cut[: end + 1] if end > 200 else cut.rstrip() + "…"


def load_tmdb():
    # Poster paths from tools/fetch_tmdb_posters.py; stored as "~/path.jpg" and served from TMDB's image CDN.
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tmdb_posters.json")
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}


def main(src, out):
    raw = json.load(open(src, encoding="utf-8"))
    tmdb = load_tmdb()
    canon = load_canon()
    seen = set()
    films = []
    for m in raw:
        key = m.get("href") or f"{m['title']}|{m['year']}"
        if key in seen or not m.get("title"):
            continue
        seen.add(key)
        genres = []
        for g in m.get("genres", []):
            g = GENRE_ALIASES.get(g, g)
            if g in GENRE_INDEX and GENRE_INDEX[g] not in genres:
                genres.append(GENRE_INDEX[g])
        films.append((popularity(m) + canon_bonus(m, canon), m, genres))

    films.sort(key=lambda f: -f[0])
    top = films[0][0]

    index, shards = [], {}
    for fid, (pop, m, genres) in enumerate(films):
        poster = m.get("thumbnail") or ""
        if tmdb.get(f"{m['title']}|{m['year']}"):
            poster = "~" + tmdb[f"{m['title']}|{m['year']}"]
        if "/thumb/" in poster:
            # Wikimedia only serves thumbnails at standard widths; 320px now returns 400.
            poster = re.sub(r"/\d+px-([^/]+)$", r"/330px-\1", poster)
        if poster.startswith(POSTER_PREFIX):
            poster = poster[len(POSTER_PREFIX):]
        index.append([m["title"], m["year"], genres, poster, round(max(pop, 0) / top * 100)])
        shards.setdefault(fid // SHARD_SIZE, []).append(
            [m.get("cast", [])[:10], clean_extract(m.get("extract")), m.get("href") or ""]
        )

    os.makedirs(os.path.join(out, "details"), exist_ok=True)
    with open(os.path.join(out, "index.json"), "w", encoding="utf-8") as f:
        json.dump({"genres": GENRES, "shard": SHARD_SIZE, "posterBase": POSTER_PREFIX, "films": index},
                  f, ensure_ascii=False, separators=(",", ":"))
    for n, rows in shards.items():
        with open(os.path.join(out, "details", f"{n}.json"), "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(index)} films, {len(shards)} detail shards")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
