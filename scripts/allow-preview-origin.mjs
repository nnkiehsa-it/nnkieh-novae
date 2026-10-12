#!/usr/bin/env node
// Lets the fixed branch-preview hostname sign in against the production
// backend: adds it to the Turnstile widget the build uses, to Firebase Auth's
// authorized domains and to the production Worker's ALLOWED_ORIGINS (which the
// Worker's Turnstile hostname check also reads).
// Each change only ever adds the one hostname; running again changes nothing.
import { spawnSync } from "node:child_process";
import { SignJWT, importPKCS8 } from "jose";

const hostname = process.env.PREVIEW_HOSTNAME?.trim();
const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const allowedOrigins = process.env.ALLOWED_ORIGINS ?? "";
const workerName = process.env.CLOUDFLARE_WORKER_NAME?.trim() || "novae-api";
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY?.trim();

if (!hostname || !projectId || !serviceAccount || !allowedOrigins || !cloudflareAccountId || !cloudflareToken || !turnstileSiteKey) {
  console.error("PREVIEW_HOSTNAME, FIREBASE_PROJECT_ID, GOOGLE_SERVICE_ACCOUNT_JSON, ALLOWED_ORIGINS, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN and TURNSTILE_SITE_KEY are required.");
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

async function allowTurnstileHostname() {
  const url = `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/challenges/widgets/${turnstileSiteKey}`;
  const headers = { authorization: `Bearer ${cloudflareToken}`, "content-type": "application/json" };
  const current = await fetch(url, { headers });
  if (!current.ok) throw new Error(`Reading Turnstile widget ${turnstileSiteKey} failed: ${current.status} ${await current.text()}`);
  const widget = (await current.json()).result;
  if (widget.domains.includes(hostname)) {
    console.log(`Turnstile widget ${turnstileSiteKey} (${widget.name}) already allows ${hostname}.`);
    return;
  }
  const fields = ["name", "mode", "region", "bot_fight_mode", "clearance_level", "offlabel", "ephemeral_id"];
  const body = Object.fromEntries(fields.filter((field) => field in widget).map((field) => [field, widget[field]]));
  const updated = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({ ...body, domains: [...widget.domains, hostname] }),
  });
  if (!updated.ok) {
    // The deploy token may lack Turnstile edit access; the deploy still stands,
    // and the hostname can be added to the widget in the dashboard instead.
    console.log(`::warning::Could not add ${hostname} to Turnstile widget "${widget.name}" (${updated.status}). Give CLOUDFLARE_API_TOKEN "Turnstile: Edit" or add the hostname in the dashboard.`);
    return;
  }
  console.log(`Turnstile widget ${turnstileSiteKey} (${widget.name}) now allows ${hostname}.`);
}

await allowTurnstileHostname();
await authorizeFirebaseDomain();
allowWorkerOrigin();
