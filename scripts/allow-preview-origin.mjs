#!/usr/bin/env node
// Lets the fixed branch-preview hostname sign in against the production
// backend: adds it to Firebase Auth's authorized domains and to the production
// Worker's ALLOWED_ORIGINS (which Turnstile hostname checks also read).
// Both changes only ever add the one hostname; running again changes nothing.
import { spawnSync } from "node:child_process";
import { SignJWT, importPKCS8 } from "jose";

const hostname = process.env.PREVIEW_HOSTNAME?.trim();
const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const allowedOrigins = process.env.ALLOWED_ORIGINS ?? "";
const workerName = process.env.CLOUDFLARE_WORKER_NAME?.trim() || "novae-api";

if (!hostname || !projectId || !serviceAccount || !allowedOrigins) {
  console.error("PREVIEW_HOSTNAME, FIREBASE_PROJECT_ID, GOOGLE_SERVICE_ACCOUNT_JSON and ALLOWED_ORIGINS are required.");
  process.exit(1);
}

async function googleAccessToken() {
  const credentials = JSON.parse(serviceAccount);
  const tokenUri = credentials.token_uri || "https://oauth2.googleapis.com/token";
  const issuedAt = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/cloud-platform" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(credentials.client_email)
    .setSubject(credentials.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 600)
    .sign(await importPKCS8(credentials.private_key, "RS256"));
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ assertion, grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer" }),
  });
  if (!response.ok) throw new Error(`Google token request failed: ${response.status} ${await response.text()}`);
  return (await response.json()).access_token;
}

async function authorizeFirebaseDomain() {
  const token = await googleAccessToken();
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config`;
  const headers = { authorization: `Bearer ${token}`, "x-goog-user-project": projectId };
  const current = await fetch(url, { headers });
  if (!current.ok) throw new Error(`Reading Firebase Auth config failed: ${current.status} ${await current.text()}`);
  const domains = (await current.json()).authorizedDomains ?? [];
  if (domains.includes(hostname)) {
    console.log(`Firebase already authorizes ${hostname}.`);
    return;
  }
  const updated = await fetch(`${url}?updateMask=authorizedDomains`, {
    method: "PATCH",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ authorizedDomains: [...domains, hostname] }),
  });
  if (!updated.ok) throw new Error(`Updating Firebase authorized domains failed: ${updated.status} ${await updated.text()}`);
  console.log(`Firebase now authorizes ${hostname}.`);
}

function allowWorkerOrigin() {
  const origin = `https://${hostname}`;
  const origins = allowedOrigins.split(",").map((value) => value.trim()).filter(Boolean);
  if (!origins.includes(origin)) origins.push(origin);
  const result = spawnSync("bunx", ["wrangler", "secret", "put", "ALLOWED_ORIGINS", "--name", workerName], {
    input: origins.join(","),
    shell: process.platform === "win32",
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.status !== 0) throw new Error(`wrangler secret put exited with ${result.status}`);
  console.log(`Worker ${workerName} allows ${origin}.`);
}

await authorizeFirebaseDomain();
allowWorkerOrigin();
