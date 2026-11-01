# MoroShow email accounts

This integration is opt-in. The current interface continues in legacy mode until
Supabase configuration is supplied. Do not enable the browser configuration before
preparing the backend and database.

## 1. Database

Open your Supabase project's **SQL Editor**, create a query and run the complete file
[`supabase/migrations/20261101_accounts.sql`](supabase/migrations/20261101_accounts.sql).
It creates account storage with row-level security and a revision-checked write function.
Only the signed-in user can read or change their own row. No service-role key is used.

## 2. Authentication

In **Authentication → URL Configuration** set Site URL to
`https://moro-show.vercel.app` and add `https://moro-show.vercel.app/**` to Redirect URLs.
Enable Email provider and **Confirm email**. Configure custom SMTP for public signups;
the built-in Supabase sender is restricted and is intended for testing.

The app supports email/password (including Gmail addresses), confirmation, password
reset, account name, email change, sign-out and optional email-update consent.
Google OAuth is not enabled; it needs a Google OAuth application and provider setup.

## 3. Backend environment

Set these variables in your backend host or Mac project's `.env`:

```dotenv
SUPABASE_URL=https://jjbexklnupmthgqcqqso.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
NETSHOW_ALLOWED_ORIGINS=https://moro-show.vercel.app
```

Use the publishable key supplied by your own project; never put a secret/service-role
key in a VITE variable. Restart the backend with the updated GitHub source and run
`npm ci` to install the auth client dependency. Preserve your existing TMDB settings.
`/api/auth/config` must return `{"enabled":true}`. An unauthenticated request to
`/api/profiles` returns only the non-persistent Guest profile. Guest catalog browsing
and playback are allowed; guest writes to profiles, history and favorites return HTTP 401.

## 4. Vercel environment

Add these two **Config** environment variables to Production:

```dotenv
VITE_SUPABASE_URL=https://jjbexklnupmthgqcqqso.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Keep `VITE_NETSHOW_API_BASE` pointed at the current working backend. Redeploy.
Supabase stores accounts and viewing data; it does not host this Express media backend.
A Mac tunnel still requires the Mac and tunnel to stay online.

## Validation

Create a real test account yourself, confirm the email and sign in. Create a profile,
save a title, sign out, then sign into a second account. It must have its own profile
and no favorites/history from the first account. Sign back into the first account
and confirm its data remains. Do not migrate the shared legacy profile automatically:
its owner cannot be established safely.

The administrator can view registered emails in Supabase **Authentication → Users**.
No email list is exposed to viewers. Optional marketing consent is recorded separately
in user metadata and defaults to false. The signup page explains account data use.

## Checks executed during implementation

- Backend tests with simulated Supabase: invalid sessions, separate concurrent account
  contexts, cross-account profile rejection, cloud write failure and revision conflict.
- Existing profile persistence/migration tests and TypeScript/production builds.
- Live email delivery and the SQL migration require your project configuration and
  must be verified after activation; no test emails are sent automatically.

## Guest browsing

Visitors browse and watch without signing in. Saving a title or opening My Moro requests sign-in or signup. Guest favorites and cloud watch history are never persisted. Guest requests cannot read any account profile.
