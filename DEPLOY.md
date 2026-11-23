# Deploying to Vercel

The site runs on **your own** Vercel project, built from **your own** GitHub repository (`cst-veteran-tournament`), talking to **your own** Supabase project in Singapore. Nothing here touches the departmental tournament's repository, Supabase project or Vercel site.

Deploying only publishes the app; it changes nothing in the database. Database setup (migrations, fixtures, admin) is in the README, steps 3–6.

## 1. Import the repository

Vercel → **Add New → Project → Import** `cst-veteran-tournament` (sign in to Vercel with your GitHub account and give it access to that repository only).

- **Framework, build command, Node:** leave the defaults (Next.js, `next build`).
- **Production branch:** `main` (Settings → Git). `vercel.json` skips builds for every other branch (`ignoreCommand`).
- **Region:** `vercel.json` sets `sin1` (Singapore), next to the Supabase project (`ap-southeast-1`). Admin taps and live updates go from the browser straight to Supabase, so only page loads and sign-in depend on it.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables, Production and Preview)

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Same as `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the publishable key (`sb_publishable_…`) | Same as `.env.local`. Safe to expose: Row Level Security and `is_admin()` decide what anyone can do |
| `NEXT_PUBLIC_SITE_URL` | the public address, e.g. `https://cst-veterans.vercel.app` | Optional. Used for link-preview images. Without it, Vercel's production domain is used |

**Do not add `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD` or `ADMIN_EMAIL`.** Only the local scripts in `scripts/` use them; the app never does. `NEXT_PUBLIC_*` values are built into the pages, so after changing one, redeploy.

## 3. Supabase Auth URL settings (Supabase → Authentication → URL Configuration)

- **Site URL:** the production address (e.g. `https://cst-veterans.vercel.app`).
- **Redirect URLs:** add `https://<your-address>/**`.

Admin sign-in is email and password, so these only matter for Supabase's own emails (e.g. a password reset), but they must not point at localhost. Keep **"Allow new users to sign up" off** (Authentication → Sign In / Providers): only the admin should ever have an account.

## 4. After deploying: checks (all read-only)

None of these writes to the database. Don't use the admin controls on a real match to "test"; every tap is real data.

1. `https://<your-address>/` loads; **Groups** shows Group A and Group B with five teams each; **Knockouts** shows SF1, SF2 and the Final.
2. `curl -sI https://<your-address>/ | grep -i x-vercel-id` shows `sin1`.
3. Signed out, `https://<your-address>/admin` redirects to `/admin/login`.
4. Sign in with the admin account: the match list loads. Open a match page, look, and leave without tapping anything.
5. Sign out returns to the sign-in page.
6. Share the link in WhatsApp (or a link-preview checker): the banner image and "Indo-Bhutan Veteran Football — live scores" appear.
7. Open the site on two phones on mobile data (not the same Wi-Fi).
8. At the first real match, keep the public page open on a second phone while the admin records the kick-off; it should appear within about a second.

## Things not to run against the live database without agreeing first

`npm run seed:demo`, `reset:demo`, `seed:results`, `npm test`, `npm run rehearsal` and the Playwright tests all write to the database. (`seed:demo`, `test:admin` and `rehearsal` were written for the departmental tournament's 68 fixtures and refuse to run on this one until adapted.) `npm run seed` only writes fixture details and is safe to rerun.
