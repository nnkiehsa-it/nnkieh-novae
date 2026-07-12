# Vercel, GitHub secrets, and first deployment

[繁體中文](../../deployment/vercel-github.md) · [Deployment overview](../deployment-guide.md)

## Create the Vercel project

1. Sign up at [Vercel](https://vercel.com/signup) with GitHub and authorize only your Novae fork when possible.
2. **Add New → Project**, import `<your-account>/novae`, keep Vite and repository root, then create the project. An initial build may fail before secrets exist; the IDs will still be available.
3. The repository's `vercel.json` already sets `git.deploymentEnabled: false`, retaining the Git connection without creating a second deployment on every push. GitHub Actions owns releases. Do not select **Ignored Build Step → Don't build anything**, which can also cancel prebuilt workflow deployments. See [disabling automatic Vercel Git deployments](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments).

## Collect Vercel credentials

- Under [Account Settings → Tokens](https://vercel.com/account/tokens), create a scoped `novae-github` token and copy it once to `VERCEL_TOKEN`. See [Vercel access tokens](https://vercel.com/kb/guide/how-do-i-use-a-vercel-api-access-token).
- Project → **Settings → General → Project ID** becomes `VERCEL_PROJECT_ID`.
- The owning Account/Team → **Settings → General → Team ID** becomes `VERCEL_ORG_ID`.

All three must belong to the same owner scope. A common `project not found` error means the token, project, and org IDs belong to different scopes.

## Populate `production`

In the GitHub fork, open **Settings → Environments → production → Environment secrets** and add every item from the [complete inventory](../deployment-guide.md#complete-secret-inventory).

Check carefully:

- `VITE_ALLOWED_DOMAIN` and `ALLOWED_DOMAIN` match exactly and contain only a domain such as `school.edu.tw`.
- `ADMIN_EMAILS` contains full addresses separated with ASCII commas.
- `GOOGLE_SERVICE_ACCOUNT_JSON` contains the complete JSON object.
- `CLOUDINARY_WEBHOOK_SECRET` equals `CLOUDINARY_API_SECRET`.
- `WEBHOOK_SECRET` is independently random.
- Initially set App Check to `false` and omit an empty reCAPTCHA secret.
- Do not create `SUPABASE_URL`; `NOTION_VERSION` is also optional.

## Deploy backend, then frontend

1. GitHub → **Actions → Deploy Supabase Backend → Run workflow**, choose `main`.
2. Confirm architecture verification, linking, migrations, Edge secrets, function deployments, healthcheck, and cleanup all pass. Correct the first red step and re-run failed jobs; do not reset the database.
3. Run **Deploy Frontend to Vercel** for `main`.
4. Open the latest Vercel Production deployment and add its hostname, without `https://`, to Firebase Authentication authorized domains and any enabled reCAPTCHA/App Check domain list.

Later pushes to relevant `main` paths deploy automatically. The GitHub Pages `website/` is the public landing/documentation site, not the Novae application, and does not receive application secrets.

## Acceptance test

1. Open production and confirm the school name and no missing-config console errors.
2. Confirm an outside-domain Google account is rejected and an eligible school account succeeds.
3. Sign out/in with an `ADMIN_EMAILS` account and confirm administrative tools; a normal account must not see them.
4. Create, comment, support, review, and update a test proposal.
5. Upload an image, wait for callback, and confirm it remains after refresh.
6. Register Push on HTTPS, then verify in-app and system notifications.
7. Confirm synchronized rows and date fields appear in Notion.
8. Check Supabase Edge logs for persistent 401/500 errors and confirm Upstash records a small number of commands.
9. Inspect browser Network/Source and confirm no service role, private key, Cloudinary secret, Upstash token, or Notion token is present.

Finally, add production reviewers/branch restrictions, monitor App Check before enforcement, assign backup service owners, and follow the [operations runbook](../operations.md).
