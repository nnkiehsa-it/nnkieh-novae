# Supabase setup

[繁體中文](../../deployment/supabase.md) · [Deployment overview](../deployment-guide.md)

## Create a project

Sign in at [Supabase Dashboard](https://supabase.com/dashboard), create an organization and a `novae-production` project, choose an appropriate region, and generate a strong database password. Save that password in a password manager. Do not create application tables manually; the backend workflow applies repository migrations.

## Values to collect

- From **Connect** or **Settings → API Keys**, copy Project URL to `VITE_SUPABASE_URL` and the publishable `sb_publishable_...` key to `VITE_SUPABASE_PUBLISHABLE_KEY`.
- From **Settings → General**, copy Reference ID to `SUPABASE_PROJECT_REF`.
- Put the project database password in `SUPABASE_DB_PASSWORD`. If lost, reset it under Database settings and update the secret.
- From **Settings → API Keys → Legacy API Keys**, reveal `service_role` and put it in `SUPABASE_SERVICE_ROLE_KEY`. Do not use `anon`, publishable, or `sb_secret_...` for this current workflow.
- From [Account Access Tokens](https://supabase.com/dashboard/account/tokens), generate a token named `novae-github-production` and put it in `SUPABASE_ACCESS_TOKEN`.

Publishable keys are browser-safe only when backed by correct RLS. The service-role key bypasses RLS and must never enter a `VITE_*` value. See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Hosted Edge Functions automatically receive `SUPABASE_URL`; do not create it as a GitHub secret. The `.env.example` entry only documents unusual manual hosting outside Supabase. See [default Edge secrets](https://supabase.com/docs/guides/functions/secrets#default-secrets).

Next: [Cloudinary](cloudinary.md).
