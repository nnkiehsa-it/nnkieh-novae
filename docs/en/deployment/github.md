# GitHub account, fork, Actions, and Environment

[繁體中文](../../deployment/github.md) · [Deployment overview](../deployment-guide.md)

## Register and fork

1. Create and verify an account at [GitHub Sign up](https://github.com/signup). Enable two-factor authentication under **Settings → Password and authentication**.
2. Open the [Novae repository](https://github.com/tavricccc/novae), click **Fork**, choose your account, keep the name `novae`, and create the fork.
3. Confirm the URL is `github.com/<your-account>/novae`; perform every following Settings action in this fork. See GitHub's [fork guide](https://docs.github.com/en/get-started/quickstart/fork-a-repo).

## Enable Actions

Open **Actions** in the fork. If workflows are disabled, click **I understand my workflows, go ahead and enable them**. Under **Settings → Actions → General**, allow repository workflows. Never enable sending secrets to untrusted fork pull requests.

## Create `production`

1. **Settings → Environments → New environment**.
2. Enter lowercase `production`, then configure it.
3. Optionally restrict deployment branches to `main` and add required reviewers.
4. Add every value under **Environment secrets → Add environment secret**, not Environment variables.

GitHub Free generally requires a public repository for environment secrets; private repositories may require a paid plan. See [Managing environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

For `dev`, create a second environment named exactly `development` and give it separate vendor resources.

When adding a secret, paste the exact uppercase name and raw value without quotes, surrounding whitespace, or code fences. GitHub hides the value after saving. Update the same secret when correcting it; never print it in an Actions log.

Next: [Firebase](firebase.md).
