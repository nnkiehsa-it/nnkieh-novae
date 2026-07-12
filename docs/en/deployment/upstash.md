# Upstash setup

[繁體中文](../../deployment/upstash.md) · [Deployment overview](../deployment-guide.md)

Novae uses Upstash Redis for short-lived operation counters that protect sign-in synchronization, posts, comments, images, and sensitive actions. It does not store proposal content.

1. Sign in to [Upstash Console](https://console.upstash.com/), select **Redis → Create database**, name it `novae-production`, and choose a region near Supabase.
2. Select the free plan for an initial school deployment. Avoid eviction unless you understand that rate-limit keys may disappear under pressure.
3. In the database **Details / REST API** section, copy the HTTPS URL into `UPSTASH_REDIS_REST_URL` and the **Standard** token into `UPSTASH_REDIS_REST_TOKEN`.

Novae increments counters, so a Read-only token does not work. Use the `https://...upstash.io` REST endpoint, not a `redis://` TCP endpoint. See [Upstash REST credentials](https://upstash.com/docs/redis/features/restapi#get-started).

Create a separate database for `development`; sharing one database allows tests to consume production limits. Never expose the Standard token through a `VITE_*` value. If compromised, reset the database credentials, update GitHub, and redeploy the backend.

Next: [Vercel and first deployment](vercel-github.md).
