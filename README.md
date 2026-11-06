# Movi

Rank movies by picking which one you liked more. Movi turns those picks into a personal 0–10 score and a ranked list.

The web app lives in [`docs/`](docs/). It's plain HTML, CSS and JavaScript with no build step, and it ships with a database of **36,115 films**.

## Features

- **Head-to-head ranking.** Say whether you loved a film, thought it was fine, or didn't like it. Then pick between it and films you've already ranked. The app uses binary search, so placing a film takes about log₂(n) picks: around 5 for a 30-film list.
- **Scores that build themselves.** Each film's score comes from its spot in your list. Loved films score 6.8–10, fine ones 3.4–6.7, and films you didn't like 0–3.3.
- **Discover.** A "Seen any of these?" quick-pick grid, a "Because you loved…" row, picks based on the genres you score highest, and rows by genre.
- **Search.** Search all 36k films by title or year, and filter by genre and decade.
- **Film pages.** Poster, plot, cast, genres, a link to Wikipedia, "More like this", and your score, rank and notes.
- **My List, Watchlist and Profile.** The profile shows your taste type, a genre and decade breakdown, and your top 4. You can export and import a backup.

Your data is saved in the browser (localStorage). There are no accounts and no server.

## Run locally

```bash
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

You need a local server like this, because opening `index.html` directly blocks the data from loading.

## Publish with GitHub Pages

In the repo, go to Settings → Pages. Under Source, pick **Deploy from a branch**, then choose this branch and the **/docs** folder. The site will be at `https://<user>.github.io/<repo>/`.

## The movie database

`docs/data/index.json` holds every film's title, year, genres, poster and popularity rank. Plots, cast and Wikipedia links are split into 73 files in `docs/data/details/`, and the app only loads the one it needs.

To rebuild the database:

```bash
curl -o /tmp/movies.json https://raw.githubusercontent.com/prust/wikipedia-movie-data/master/movies.json
python3 tools/build_movie_db.py /tmp/movies.json docs/data
```

`tools/canon.txt` is a hand-picked list of well-known films. The build script puts them near the top of Discover and search results.

Film data and posters come from Wikipedia under CC BY-SA, via [wikipedia-movie-data](https://github.com/prust/wikipedia-movie-data). It mostly covers American films up to 2023.

Each film's ID is its position in the database. If you rebuild the database, any rankings already saved in a browser may point to the wrong films.
