# Local integration verifier

The suite rebuilds an isolated PostgreSQL 17 database, configures the same
least-privilege role used by the production Worker, and never reads deployment
credentials or writes to Neon.

## Commands

| Change | Command |
| --- | --- |
| Frontend / ordinary refactor | `npm run verify:local` |
| Migration, RPC, permission, Worker action, Queue, or Durable Object | `npm run verify:integration` |
| Large change / before merge | `npm run verify:all` |

PR CI runs the local, integration, and browser suites.

## Environment

Docker is required. On Windows, the command invokes Docker through WSL while
the Worker and test processes run under Node.js 24 on Windows. Set
`NOVAE_WSL_DISTRO` only when the Docker-enabled distribution is not `Debian`.

The verifier starts PostgreSQL 17, a local Cloudflare Worker, isolated external
provider receivers, and—only for served/E2E runs—the Firebase Auth Emulator and
Next.js. It uses fixed local credentials. Backend integration gets an empty
setup state; served and E2E environments receive deterministic sample data.

New actions require asserted success and denial cases. The coverage guard fails
when a registered action is not referenced. Notification tests assert in-app
recipients, FCM payloads, preference filtering, realtime persistence, and deep
links without contacting production providers. Retention tests cover every
configured expiry boundary, Cloudinary deletion execution, queue chaining, and
scheduled cleanup.
