# בקסדה 🪖

**"מה נכנס בקסדה?"** — משחק מילים אסינכרוני לשני שחקנים בעברית.

בכל תור שולחים עד **3 מילים** שמתחילות באות שנבחרה — וכולן חייבות להיכנס בקסדה.
מילה לא יכולה לחזור פעמיים באותו משחק. מי שנתקע בלי מילים — מפסיד!

Built with React + Vite, Tailwind CSS v4, Lucide icons, and Supabase for async
turn-based multiplayer. Fully RTL, mobile-first, deployable to GitHub Pages.

## How it works

- **Player 1** creates a room, picks (or rolls) a Hebrew letter, and shares the
  room link via WhatsApp or the clipboard.
- **Player 2** opens the link, enters a name, and the game starts.
- Turns are **asynchronous** — close the tab and come back later; state lives in
  Supabase and updates in realtime (with a polling fallback). Your player
  identity per room is kept in `localStorage`, so refreshing is seamless.
- The activity feed shows every turn ("דנה שלחה: בננה, בטריה, במבה").
- A player with no words left taps **"אין לי מילים"** (with confirmation).
  With fewer or equal points than the opponent — they lose immediately. While
  **leading on points**, the game instead becomes a **chase**: the opponent
  keeps taking turns (up to 3 words each) and wins the moment they EXCEED the
  passer's score (target = passer's score + 1); giving up during the chase
  loses. Scores count total valid words per player.
- Client-side validation enforces: Hebrew only, must start with the room's
  letter, max 3 words per turn, and no repeats across the whole game
  (final letters ך/ם/ן/ף/ץ are normalized so "אבנים"/"אבנימ" style dupes are caught).
- **Dictionary check**: on submit each word is looked up on he.wiktionary and
  he.wikipedia (free MediaWiki APIs, CORS-enabled). A word found on neither is
  blocked once; submitting again sends it anyway (dictionaries miss slang and
  some inflections). Network failures fail open so offline play never gets stuck.
- **Active games & history**: the home page lists your open rooms with a
  "תורך!" badge, and finished games appear in a scrollable history section with
  a win/loss tally. In online mode both lists come from the database, keyed by
  an anonymous per-browser player id — finished rooms are kept in Supabase as
  the history record (local pass-and-play mode keeps history in localStorage).

### No backend? Local mode

If Supabase env vars are missing, the app runs in **local device mode**
(a badge appears in the header): rooms are stored in `localStorage`, so both
players share one browser (pass-and-play). Great for trying the app before
wiring up a backend.

## Development

```bash
npm install
cp .env.example .env   # fill in Supabase keys (optional — local mode works without)
npm run dev
```

## Backend setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run the contents of [`supabase/schema.sql`](supabase/schema.sql)
   (creates `rooms` + `turns`, permissive RLS policies for anonymous play, and
   enables Realtime on both tables).
   - Already ran an older schema.sql? Run
     [`supabase/upgrade-db-history.sql`](supabase/upgrade-db-history.sql)
     once instead — it adds the player-id and score columns used by the
     "my games" / history lists.
3. Copy **Project Settings → API → Project URL** and the **anon public key** into:
   - Local dev: `.env` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - GitHub deploy: repository **Settings → Secrets and variables → Actions →
     New repository secret** — add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

> The anon key is safe to expose in a static frontend; access is governed by the
> RLS policies in the schema. This game intentionally allows anonymous
> read/write on rooms — fine for a casual game, not for sensitive data.

## Optional: Google sign-in

Signing in is never required — guests play with an anonymous per-browser id.
With Google sign-in enabled, a player's games and history follow their account
across devices (the account id is stored in the same `player1_id`/`player2_id`
columns, so **no extra SQL is needed**). Games played as a guest on the same
browser remain visible after signing in.

One-time dashboard setup (no code or env changes):

1. **Google Cloud Console** → APIs & Services → Credentials → Create
   Credentials → OAuth client ID (type: Web application). Add the authorized
   redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
2. **Supabase** → Authentication → Sign In / Providers → Google → enable, and
   paste the client ID + client secret from step 1.
3. **Supabase** → Authentication → URL Configuration → set **Site URL** to
   `https://<user>.github.io/Bekasda/` and add the same URL to
   **Redirect URLs** (add `http://localhost:5173/Bekasda/` too for local dev).

Until this is configured, the "התחברות" button will show a provider error from
Supabase when clicked — everything else keeps working.

## Optional: turn notifications (Web Push)

Two tiers, both behind the 🔔 button in the header:

- **Tier 1 (no setup):** while a game tab is open somewhere, the app fires a
  browser notification when it becomes your turn. Works immediately once the
  player grants permission.
- **Tier 2 (setup below):** real push through a service worker — arrives even
  with the site closed. Android/desktop work from the browser; iPhone requires
  adding the app to the home screen (iOS 16.4+) first.

One-time setup for Tier 2:

1. Generate a VAPID keypair: `npx web-push generate-vapid-keys`.
2. GitHub → repo **Settings → Secrets → Actions** → add `VITE_VAPID_PUBLIC_KEY`
   with the **public** key (then redeploy).
3. Run [`supabase/upgrade-push.sql`](supabase/upgrade-push.sql) in the SQL
   Editor (creates the `push_subscriptions` table).
4. Create the Edge Function: Supabase → **Edge Functions → Deploy a new
   function** → name it `notify-turn`, paste
   [`supabase/functions/notify-turn/index.ts`](supabase/functions/notify-turn/index.ts)
   (or `supabase functions deploy notify-turn` with the CLI). In the function's
   settings, **disable "Enforce JWT verification"** so the webhook can call it.
5. Set the function's secrets (Edge Functions → Secrets): `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY` (the private key lives **only** here), and
   `VAPID_SUBJECT` (e.g. `mailto:you@example.com`).
6. Create the webhook: Supabase → **Database → Webhooks → Create** → table
   `rooms`, event **Update**, type **Supabase Edge Function** → `notify-turn`.

Players are notified when the opponent joins, when it becomes their turn, and
when they win. Dead subscriptions are pruned automatically.

## Deploying to GitHub Pages

1. Push to `main` — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   builds the app and publishes it to Pages.
2. One-time repo setup: **Settings → Pages → Build and deployment → Source →
   GitHub Actions**.
3. Add the two Supabase secrets (see above) so the deployed build is online-enabled.
4. The site will be served at `https://<user>.github.io/Bekasda/`.

The app uses **hash routing** (`#/room/CODE`), so deep links into rooms work on
GitHub Pages without any 404 tricks. If you serve from a custom domain or a
different repo name, set `VITE_BASE_PATH` accordingly at build time
(e.g. `VITE_BASE_PATH=/ npm run build`).

## Project structure

```
├── index.html                 # RTL shell, Hebrew (Rubik) font
├── vite.config.js             # base path for GitHub Pages
├── supabase/schema.sql        # DB schema + RLS + realtime
├── .github/workflows/deploy.yml
└── src/
    ├── main.jsx               # HashRouter entry
    ├── App.jsx                # layout, local-mode badge, routes
    ├── index.css              # Tailwind v4 theme + animations
    ├── lib/
    │   ├── gameLogic.js       # letters, validation, scoring, room codes
    │   ├── backend.js         # Supabase backend + localStorage fallback
    │   └── storage.js         # per-room player identity persistence
    ├── pages/
    │   ├── Home.jsx           # create game (letter picker) / join by code
    │   └── Room.jsx           # waiting / playing / finished states
    └── components/
        ├── ScoreBoard.jsx     # players, scores, letter, turn indicator
        ├── HistoryFeed.jsx    # chat-like turn history
        ├── TurnComposer.jsx   # 3 word inputs, live validation, give-up flow
        └── ShareInvite.jsx    # copy link + WhatsApp share
```
