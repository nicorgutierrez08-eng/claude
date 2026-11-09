# Movi

Beli for movies. Rank every film you've seen by picking which one you liked more. Follow friends, see what they're watching, and find what to watch next.

The app lives in [`docs/`](docs/). It's plain HTML, CSS and JavaScript modules with no build step, plus a database of **36,115 films**. It runs in two modes:

- **Demo mode** (the default). Everything is saved in your browser, alongside a small made-up community of sample members so the social features have something to show. No server needed.
- **Live mode.** Real accounts and real friends, backed by [Supabase](https://supabase.com). You turn it on by pasting two values into `docs/config.js`; the steps are below.

## Features

**Ranking**
- **Gut check, then head-to-heads.** You say whether you loved a film, thought it was fine, or didn't like it, then pick between it and films you've already ranked. Placing a film takes about log₂(n) picks, around 5 for a 30-film list. There's a "Too close to call" button and a Back button.
- **Scores build themselves** from a film's position in your list. Loved films score 6.8–10, fine ones 3.4–6.7, and films you didn't like 0–3.3.
- **Watch details on every film:** date watched, where (Theater, Streaming, Home, TV, Plane), who you watched it with, a rewatch flag and notes.
- **Re-rank or remove** any film. A quick-add search lets you rank from anywhere (the red **+**).

**Lists**
- **Been**, your ranked list. Filter by Loved / Fine / Didn't like, genre, decade and year watched. Sort by rank, recently ranked, recently watched, release year or title, or search within the list.
- **Want to watch**, your watchlist.
- **Recs for you**, films friends sent you with a message.
- **Share your top 10.**

**Social**
- **Feed** of what the people you follow rank and save, with likes, comments, and one-tap save to your watchlist. Following and Everyone tabs.
- **Follow people**, including **private accounts** that approve each follow request.
- **Notifications** for new followers, follow requests, likes, comments and recommendations.
- **Recommend** a film to friends.
- **Leaderboard** of who has ranked the most films, among friends or across everyone.
- **Find people**, ranked by how many films you have in common, plus an invite link.

**Taste**
- **Rec score:** a predicted score for any film you haven't ranked. It comes from friends' scores, weighted by how closely their taste matches yours.
- **Friends' scores and the Movi-wide average** on every film page.
- **Taste match %** with anyone, and a **Compare** tab showing where you agree, where you clash, and films they loved that you haven't ranked.
- **Taste profile:** a movie personality type, genre and decade breakdowns, where you watch, your top 4, weekly streaks, a yearly goal, and 17 badges.
- **Watch together:** pick friends and Movi suggests films nobody in the group has seen that everyone is likely to enjoy.

**Discover**
- **Quick picks:** popular films with "Seen it / Save / Skip" buttons, the fastest way to build your list.
- **Recommended for you, Trending with friends, Top rated on Movi, Because you loved…**, and rows by genre.
- **Search** 36k films by title or year with genre and decade filters, and search people.

**Account**
- Sign up, sign in, password reset (live mode), and onboarding: rank 3 films, then follow people.
- Settings for name, username, bio, avatar color, private account and yearly goal. Change your password, export your data, or delete your account.

## Run it locally

```bash
cd docs
python3 -m http.server 8000
# open http://localhost:8000
```

It opens in demo mode. Create an account and start ranking.

## Go live with Supabase (about 10 minutes)

1. **Create a project** at [supabase.com](https://supabase.com). The free tier is fine.
2. **Create the database.** In the dashboard, open **SQL Editor → New query**, paste the whole of [`supabase/migrations/20261106000000_movi.sql`](supabase/migrations/20261106000000_movi.sql), and click **Run**. This creates the tables, the security rules that decide who can see and change what, and the notification triggers.
   - If you prefer the CLI: `npx supabase link --project-ref <your-ref>` then `npx supabase db push`.
3. **Connect the app.** In **Project Settings → API**, copy the **Project URL** and the **anon public** key into [`docs/config.js`](docs/config.js):
   ```js
   window.MOVI_CONFIG = {
     supabaseUrl: "https://YOUR-PROJECT.supabase.co",
     supabaseAnonKey: "eyJ...",
   };
   ```
   Both values are safe to publish. The database's security rules protect the data, not the key.
4. **Set up email links.** In **Authentication → URL Configuration**, set **Site URL** to wherever the app is hosted, for example `https://nicorgutierrez08-eng.github.io/claude/`. Add the same address under **Redirect URLs**. This makes sign-up confirmation and password-reset emails link back to your site.
   - Supabase asks new users to confirm their email by default. To let people in right away while testing, turn off **Authentication → Providers → Email → Confirm email**.
5. Reload the app. The "Demo mode" note disappears and accounts are now real.

## Publish with GitHub Pages

In the repo, go to **Settings → Pages**. Under Source, pick **Deploy from a branch**, then choose the branch and the **/docs** folder. The site appears at `https://<user>.github.io/<repo>/`. On phones you can add it to the home screen and it opens full-screen like an app.

## How the code is organized

```
docs/
  index.html, styles.css, config.js
  data/               film database (index.json + 73 detail files, loaded on demand)
  js/app.js           router, header and tab bar, button handling
  js/state.js         the signed-in user's data and the actions that change it
  js/model.js         scoring, taste match, rec score, streaks, goals, badges
  js/films.js         film database loading and search
  js/rank-flow.js     the ranking flow and quick-add search
  js/film-sheet.js    film page, watch details, recommend, share
  js/views/           feed, discover/search, lists, profile, social, account
  js/api/demo.js      demo data layer (browser storage + sample community)
  js/api/supabase.js  live data layer (same functions, backed by Supabase)
supabase/
  migrations/         database schema, security rules, functions, triggers
  config.toml         config for running Supabase locally (npx supabase start)
tests/                browser tests (demo + live) and database rule checks
tools/                film database build script
```

Scores are computed the same way in `model.js` and in the database function `movi_score`, so leaderboards and averages always agree with what users see.

## Tests

```bash
cd docs && python3 -m http.server 8765        # in one terminal
cd tests && npm install
npm run e2e:demo                              # full demo-mode walkthrough in a browser
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run schema    # 33 checks of the database rules
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run e2e:live  # two users interacting on a live backend
```

Point the live tests at a local stack (`npx supabase start`) or a throwaway project, because they create test accounts.

## The film database

`docs/data/index.json` holds every film's title, year, genres, poster and popularity rank. Plots, cast and Wikipedia links are split into small files under `docs/data/details/`, loaded only when a film page opens. To rebuild it:

```bash
curl -o /tmp/movies.json https://raw.githubusercontent.com/prust/wikipedia-movie-data/master/movies.json
python3 tools/build_movie_db.py /tmp/movies.json docs/data
```

Posters come from TMDB where it has a match (most films), falling back to Wikipedia's poster. To refresh them, get a free API key at themoviedb.org (Settings → API), then:

```bash
TMDB_API_KEY=your_key python3 tools/fetch_tmdb_posters.py   # fills tools/tmdb_posters.json (resumable)
python3 tools/build_movie_db.py /tmp/movies.json docs/data
```

The key is only used by this script; it never goes into the website. This product uses the TMDB API but is not endorsed or certified by TMDB.

`tools/canon.txt` is a hand-picked list of well-known films that the build script puts near the top of Discover and search. Film data comes from Wikipedia under CC BY-SA, via [wikipedia-movie-data](https://github.com/prust/wikipedia-movie-data). It mostly covers American films up to 2023.

Each film's ID is its position in the database, and rankings are saved by that ID. If you rebuild the database after people have ranked films, check that existing films keep their positions.
