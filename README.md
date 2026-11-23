# Indo-Bhutan Veteran Football — live scores

Live-score website for the **CST Silver Jubilee Indo-Bhutan Friendship Open Veteran Football Tournament 2026**, College of Science and Technology (CST), Phuentsholing · Tue 24 Nov – Thu 17 Dec 2026.

- **Fans** (no login, mostly on phones) see live scores, match details, results and fixtures, the two group tables and the knockout bracket, updated within about a second.
- **One admin** enters everything from the sideline on a phone: kick-off, goals and scorers, own goals, cards, substitutions, half time, full time, extra time, penalties kick by kick, corrections, kick-off changes, announcements, squads and team names.

It reuses the app built for the CST Silver Jubilee Departmental Football Tournament. It runs entirely on accounts you control: your GitHub repository, your Supabase project and your Vercel project. It does not use, and must never touch, the departmental tournament's repository, database or website.

## Tournament format

| | |
|---|---|
| Teams | 10, in Group A (GCBS FC, Star Bro Veteran FC, CST Veteran, PSB Traders, Phuenthrom Legends Veteran) and Group B (Doors Rhino Veterans FC, Jaigaon Veterans, Gomtu Veterans FC, Samtse Veteran FC, Rinpung United) |
| Group stage | Single round-robin, matches 1–20; win 3, draw 1, loss 0; order: points → goal difference → goals scored → admin override (head-to-head or lots) |
| Knockouts | SF1 (21): Winner A v Runner-up B · SF2 (22): Winner B v Runner-up A · Final (23). No 3rd place match |
| Knockout draw | Admin chooses: extra time (any length) or straight to penalties |
| Substitutions | No re-entry |
| Cards | Two yellows in a match or a straight red: banned for the next match. Two yellows in different matches: banned for the next match. Single yellows wiped after the group stage |

## Technology

Next.js (App Router, TypeScript), Tailwind CSS, Supabase (Postgres, Realtime, Auth), Vercel. One app, no separate backend: the admin's taps call `admin_*` database functions directly, protected by Row Level Security and `is_admin()`. Tournament logic (standings, knockouts, clock, discipline) is in `src/lib/tournament.ts`; names and venue in `src/lib/brand.ts`; team display names in `src/data/team-names.ts`. `CLAUDE.md` is the detailed handbook.

## Setting it up from scratch

You need Node.js 20+ and Git. Steps 1–7 take about an hour.

### 1. Your GitHub repository

1. On GitHub, create a new **private, empty** repository `cst-veteran-tournament` (no README, no .gitignore).
2. Point this folder at it. This folder's `origin` currently points at `Namgay282004/cst-tournament`; if that is not the repository you want for the veteran tournament, change it:

   ```bash
   git remote -v                                   # check where it points now
   git remote set-url origin https://github.com/<your-username>/cst-veteran-tournament.git
   git push -u origin main
   ```

   Never push this code to the departmental tournament's repository: its Vercel site deploys every push to `main` and would break.
3. `npm install`

### 2. Your Supabase project

1. <https://supabase.com> → **New project**, region **Singapore (`ap-southeast-1`)**, a strong database password (keep it in a password manager).
2. From **Project Settings**, collect: the **Project ref** (in `https://<project-ref>.supabase.co`), **API → Project URL**, **API keys → Publishable key** (`sb_publishable_…`), **API keys → Secret / service role key**.
3. `cp .env.example .env.local` and fill it in (`.env.local` is Git-ignored; never commit it):

   | Variable | Where it comes from | Used by |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL | the website (local **and** Vercel) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key | the website (local **and** Vercel) |
   | `NEXT_PUBLIC_SITE_URL` | your site address (optional) | link-preview images (local and Vercel) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret / service role key | local scripts only, **never Vercel** |
   | `SUPABASE_DB_PASSWORD` | database password (optional) | full backups only, **never Vercel** |
   | `ADMIN_EMAIL` | the admin's sign-in email | `npm run seed`, local only |

4. Link the CLI: `npx supabase login`, then `npx supabase link --project-ref <project-ref>`.

### 3. Create the database (all migrations)

```bash
npx supabase db push     # applies every file in supabase/migrations, in order
npm run db:types         # regenerates src/lib/supabase/database.types.ts from your project
```

If `db push` fails with a connection error (the college network blocks ports 5432/6543), apply them over HTTPS instead, then record them so `db push` knows:

```bash
for f in supabase/migrations/*.sql; do echo "Applying $f"; npx supabase db query --linked --file "$f" || break; done
```

Then in Supabase → SQL editor:

```sql
insert into supabase_migrations.schema_migrations (version, name) values
  ('20261003150000', 'initial_schema'),
  ('20261003170000', 'realtime_players'),
  ('20261004090000', 'admin_live_controls'),
  ('20261004120000', 'match_corrections'),
  ('20261004140000', 'knockout_advancement'),
  ('20261004160000', 'qualifier_override'),
  ('20261004180000', 'undo_coverage'),
  ('20261004200000', 'demo_knockouts'),
  ('20261006090000', 'player_edits_and_substitutions'),
  ('20261006100000', 'match_officials'),
  ('20261006110000', 'squads'),
  ('20261006120000', 'reset_clears_history'),
  ('20261007090000', 'clock_staff_team_names'),
  ('20261008090000', 'result_holds'),
  ('20261010090000', 'schedule_changes_and_notices'),
  ('20261010130000', 'match_stoppages'),
  ('20261012090000', 'shirt_number_zero'),
  ('20261016090000', 'team_kits'),
  ('20261020090000', 'extra_time'),
  ('20261020093000', 'substitution_minutes_extra_time'),
  ('20261021090000', 'penalty_kicks'),
  ('20261021160000', 'man_of_the_match'),
  ('20261021161000', 'extra_time_break'),
  ('20261124090000', 'veteran_tournament');
```

If that says `supabase_migrations.schema_migrations` doesn't exist, create it first, then rerun the insert:

```sql
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
```

Afterwards `npx supabase migration list --linked` should show every migration as applied both locally and remotely. The last migration, `20261124090000_veteran_tournament.sql`, sets the allowed kick-off dates to 24 Nov – 31 Dec 2026 and makes "Fill semi-finals" fill the semi-finals from the group tables.

### 4. The admin account

1. Supabase → **Authentication → Users → Add user → Create new user**: the admin's email (same as `ADMIN_EMAIL`) and a strong password, **Auto Confirm User** ticked.
2. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". Only the admin may ever have an account.
3. To change the admin's email or password later: `npm run admin:update`.

### 5. Load the fixtures

1. Save the organisers' `CST_Silver_Jubilee_Football_Fixtures_2026_Revised.xlsx` as **`data/Veteran_Tournament_Fixtures_2026.xlsx`** (sheet `Schedule`).
2. Check it without touching the database: `npm run test:veteran` (the last lines check the real file: 10 teams, 23 matches, every pairing once, SF1/SF2/Final).
3. `npm run seed`. It writes nothing unless the file passes those checks, then creates the 10 teams and 23 matches and registers the admin from `ADMIN_EMAIL`. Expected: `Seeded 10 teams and 23 matches.`, `Group matches: A=10 B=10`, `Admin registered: …`. Safe to rerun: it updates fixture details only, never scores or status.
4. Read-only check: `npm run verify:standings`.

Matches already played before the site was live: admin → open the match → **Correct → Set final score**. Scorers and cards can be added from the event log afterwards.

### 6. Your Vercel project

Follow **DEPLOY.md**: import `cst-veteran-tournament`, add only the three `NEXT_PUBLIC_*` variables, production branch `main`, region `sin1` (already in `vercel.json`). Then set Supabase **Authentication → URL Configuration**: Site URL = your Vercel address, Redirect URLs = `https://<your-address>/**`.

### 7. Check it (read-only)

DEPLOY.md, section 4: the site loads with two groups and the semi-finals/Final, `/admin` redirects to sign-in when signed out, the admin can sign in and open a match without tapping anything, the WhatsApp link preview shows the new name.

## Everyday commands

| Command | What it does | Touches the database? |
|---|---|---|
| `npm run dev` | Site on <http://localhost:3000> (use a 375 px-wide window: fans use phones) | reads |
| `npm run dev:lan` | Same, reachable from phones on the same Wi-Fi | reads |
| `npm run lint` / `npm run build` | Code checks / production build | no |
| `npm run test:veteran` | Fixture parser, two groups of five, semi-final fill, bracket, no re-entry | no |
| `npm run test:discipline` | Card and suspension rules | no |
| `npm run test:days` / `npm run test:minutes` | Every match row shows day and time / admin sheets pre-fill the clock's minute | no |
| `npm run seed` | Load fixtures and register the admin | writes fixtures |
| `npm run verify:standings` | App tables = database tables | reads |
| `npm run backup:live` | Copy of every table to `~/cst-live-backups/` (run before any database change) | reads |
| `npm run logos` | Team logos from `design/team-logos-raw/` (named after the team) | no |
| `npm run sponsors` | Sponsor logos from `design/sponsors-raw/`, then add a line to `src/data/sponsors.ts` | no |

**Never run against the live database without a deliberate decision:** `seed:demo`, `reset:demo`, `seed:results`, `npm test`, `npm run rehearsal`, the Playwright tests. `seed:demo`, `test:admin` and `rehearsal` were written for the departmental tournament's 68 fixtures and refuse to run here until adapted.

## During the tournament

- **After the group stage:** Admin → Knockouts → **Fill semi-finals** (preview first). If teams are level on points, goal difference and goals scored, set the order (head-to-head or lots, as the organisers decide) on Admin → Groups.
- **Rescheduled match:** open the match → Correct → **Change kick-off** (24 Nov – 31 Dec), with a reason. Bigger news: an announcement on the admin's Today page.
- **Knockout draw at full time:** "Full time: extra time next" or "Full time: straight to penalties"; penalties can be recorded kick by kick.
- **Squads, managers, kit colours, names on screen:** Admin → Teams. Squads make entry faster and are needed for suspensions to be tracked (Admin → Teams → Discipline).

## Team logos

Put each team's logo in **`design/team-logos-raw/`**, named after the team: its official name as in the fixtures file (any case, e.g. `Jaigaon Veterans.png`, `GCBS FC.jpg`) or its code (`JGV.png`, `GCB.jpg`). PNG, JPG, WebP or SVG; the bigger and cleaner the better (a transparent or plain background works best). Then:

```bash
npm run logos     # writes public/teams/<CODE>.webp and src/data/team-logos.ts; prints a report
```

Check the report (every file matched to a team, background removed as expected), look at the site, then commit `design/team-logos-raw/`, `public/teams/` and `src/data/team-logos.ts` and push. Teams without a logo show a neat code badge. A file with more than the logo in it can be cropped with `CROPS` in `scripts/team-logos.ts`; a logo you don't want shown yet goes in `USE_CODE_BADGE`.

## Banner and branding

The Live page banner and link preview come from `design/banner.png` (the tournament artwork). After replacing it: `python3 scripts/brand-assets.py` (needs `pip install pillow`); if its size changes, update the `aspect-[…]` classes in `src/components/live/live-banner.tsx` to the sizes it prints. Names, venue and dates: `src/lib/brand.ts`.

## Still to collect from the organisers

- Sponsors and their logos (`design/sponsors-raw/`, `npm run sponsors`, a line in `src/data/sponsors.ts`).
- Team logos, kit colours, squads and managers (these can come during the tournament).

## Security

- `.env.local` is Git-ignored. The secret/service-role key and database password are used only by `scripts/` on your machine; never put them in code, GitHub or Vercel.
- The publishable key is public by design; Row Level Security and `is_admin()` allow writes only by the user in `public.admins`. Keep public sign-ups off.
- Admin pages are protected three times: `src/proxy.ts`, `requireAdmin()` in the admin layout, and the database.
