# Cloudinary setup

[繁體中文](../../deployment/cloudinary.md) · [Deployment overview](../deployment-guide.md)

Register at [Cloudinary](https://cloudinary.com/users/register_free), verify email, and open or create a dedicated `novae-production` Product Environment. Production and development should not share one environment.

Under **Settings → API Keys**, collect values from that same Product Environment:

| Cloudinary value | GitHub secret |
| --- | --- |
| Cloud name | `CLOUDINARY_CLOUD_NAME` |
| API key | `CLOUDINARY_API_KEY` |
| API secret | `CLOUDINARY_API_SECRET` |

See [finding Cloudinary credentials](https://cloudinary.com/documentation/developer_onboarding_faq_find_credentials).

Novae currently verifies the legacy `X-Cld-Signature` HMAC-SHA1 header. Standard Cloudinary notifications sign with the Product Environment API secret, so set:

```text
CLOUDINARY_WEBHOOK_SECRET = CLOUDINARY_API_SECRET
```

Do not generate an unrelated random value or every callback will fail with 401. A dedicated signing key applies only when separately provisioned and supported. See [signature verification](https://cloudinary.com/documentation/notifications#verifying_notification_signatures).

Do not create a global upload webhook trigger. Each Novae upload already supplies `https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/cloudinaryWebhook` as its operation-specific `notification_url`; an extra trigger can duplicate delivery. See [operation-specific notification URLs](https://cloudinary.com/documentation/notifications#notification_urls_for_specific_api_calls).

Next: [Notion](notion.md).
