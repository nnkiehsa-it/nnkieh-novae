# Cost guide

[繁體中文](../costs.md) · [Documentation home](../README.md)

> Free-tier figures updated on 2026-07-12. The estimate below models normal usage at one school.

## Bottom line

For a school platform with roughly 1,000 monthly active users and 300 daily active users, Novae currently fits within the free allowances of its main services. **Estimated monthly cloud cost: NT$0.**

That includes frontend hosting, database, authentication, push notifications, images, rate limiting, and Notion synchronization. Purchasing a custom domain is not included.

## Example monthly usage

| Item | Estimate |
| --- | ---: |
| Monthly active users | 1,000 |
| Daily active users | About 300 |
| New proposals | 300 |
| Comments | 3,000 |
| Support actions | 12,000 |
| Image uploads | 500 at about 300 KB after compression |
| Image delivery | About 5 GB |
| Web Push messages | 30,000 |
| Backend requests | About 180,000 |
| Realtime messages | About 300,000, with 50 peak connections |
| Rate-limit checks | About 250,000 Redis commands |
| Notion sync requests | About 8,000 |

## Free-tier usage

| Service | Current free allowance | Example usage | Result |
| --- | ---: | ---: | --- |
| Vercel | 100 GB Fast Data Transfer/month | About 8 GB | About 8%; free |
| Supabase database | 500 MB/project | About 120 MB | About 24%; free |
| Supabase egress | 5 GB/month | About 1.5 GB | About 30%; free |
| Supabase Edge Functions | 500,000/month | About 180,000 | About 36%; free |
| Supabase Realtime | 2,000,000 messages/month and 200 peak connections | About 300,000 and 50 peak | About 15%/25%; free |
| Firebase Authentication | 50,000 MAU on Spark | About 1,000 MAU | About 2%; free |
| Firebase Cloud Messaging | No cost | About 30,000 | Free |
| Cloudinary | 25 monthly credits | About 7.2 credits | About 29%; free |
| Upstash Redis | 500,000 commands/month and 256 MB | About 250,000 commands and far below 1 MB | About 50%; free |
| Notion | Unlimited pages and blocks for a one-member Free workspace | About 8,000 sync requests | Free |

Cloudinary combines usage into credits: 1 GB of storage, 1 GB of image bandwidth, or 1,000 transformations each consume one credit. This estimate uses roughly 0.15 GB of new storage, 5 GB of delivery, and 2,000 transformations, for about 7.2 credits. Stored images accumulate over time, so include existing assets in future estimates.

Notion does not charge per API request. Its current average rate limit is three requests per second. Novae processes synchronization asynchronously, so 8,000 requests spread across a month do not create a cost.

## What is likely to exceed free usage first

1. **Upstash above 500,000 monthly commands.** Logins, proposals, comments, and support actions trigger rate-limit checks. The example uses about half the allowance.
2. **Cloudinary above 25 monthly credits.** Image delivery is the main driver. Start watching usage as monthly image bandwidth approaches 20 GB after accounting for storage and transformations.
3. **Supabase database near 500 MB.** Text proposals and comments grow slowly, and images are stored outside the database. Plan cleanup or an upgrade when the dashboard approaches 400 MB.

The frontend is static, so Vercel is unlikely to be the first bottleneck. Hobby is a free plan; if the deployment does not fit its permitted use, choose a suitable organizational plan. This does not change the free-tier estimates for the other services.

## Scale the estimate for your school

```text
your estimate = table usage × (your monthly active users ÷ 1,000)
```

For 2,000 monthly active users with similar behavior, initially double backend requests, Realtime messages, Redis commands, push messages, and image delivery. Database and image storage accumulate across months, so do not treat them as monthly-only totals.

Official allowance sources: [Vercel Pricing](https://vercel.com/pricing), [Supabase Billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Firebase Pricing](https://firebase.google.com/pricing), [Cloudinary Billing](https://cloudinary.com/documentation/billing_and_plans), [Upstash Redis Pricing](https://upstash.com/pricing/redis), [Notion Pricing](https://www.notion.com/pricing), and [Notion API Limits](https://developers.notion.com/reference/request-limits).
