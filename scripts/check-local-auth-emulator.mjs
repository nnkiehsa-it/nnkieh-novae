import assert from "node:assert/strict";

const authBaseUrl =
  process.env.NOVAE_AUTH_EMULATOR_URL ?? "http://127.0.0.1:9099";
const gatewayBaseUrl =
  process.env.NOVAE_LOCAL_GATEWAY_URL ?? "http://127.0.0.1:8787";
const appOrigin = process.env.NOVAE_LOCAL_APP_ORIGIN ?? "http://localhost:3000";
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "integration-project";
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "integration-web-api-key";
const adminEmail =
  process.env.NOVAE_LOCAL_ADMIN_EMAIL ?? "admin@integration.invalid";

function fakeGoogleIdToken() {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    email: adminEmail,
    email_verified: true,
    sub: "novae-local-admin",
  })}.`;
}

async function jsonRequest(url, init) {
  const response = await fetch(url, init);
  const body = await response.json();
  assert.equal(
    response.ok,
    true,
    `${url} returned ${response.status}: ${JSON.stringify(body)}`,
  );
  return body;
}

/** One action answer, read back from the newline-delimited stream it arrives in. */
async function actionRequest(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  assert.equal(response.ok, true, `${url} returned ${response.status}: ${text}`);
  const lines = text.split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line));
  assert.equal(lines.at(0)?.type, "start", `${url} did not start an answer: ${text}`);
  assert.equal(lines.at(-1)?.type, "end", `${url} did not finish its answer: ${text}`);
  let data = {};
  for (const line of lines) {
    if (line.type !== "part") continue;
    data = line.key === undefined ? line.data : { ...data, [line.key]: line.data };
  }
  return data;
}

function tokenClaims(token) {
  const encodedPayload = String(token).split(".")[1];
  assert.ok(encodedPayload, "Auth emulator did not return a JWT payload.");
  return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
}

const signIn = await jsonRequest(
  `${authBaseUrl}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postBody: new URLSearchParams({
        id_token: fakeGoogleIdToken(),
        providerId: "google.com",
      }).toString(),
      requestUri: appOrigin,
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
  },
);

const sync = await jsonRequest(`${gatewayBaseUrl}/v1/auth/sync`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${signIn.idToken}`,
    "Content-Type": "application/json",
    Origin: appOrigin,
  },
  body: JSON.stringify({ email: adminEmail }),
});
assert.equal(sync.ok, true);

const refreshed = await jsonRequest(
  `${authBaseUrl}/securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: signIn.refreshToken,
    }),
  },
);
const refreshedClaims = tokenClaims(refreshed.id_token);
assert.equal(refreshedClaims.aud, projectId);
assert.equal(refreshedClaims.email, adminEmail);

const access = await actionRequest(`${gatewayBaseUrl}/v1/actions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${refreshed.id_token}`,
    "Content-Type": "application/json",
    Origin: appOrigin,
  },
  body: JSON.stringify({ action: "getCurrentUserRole", payload: {} }),
});
assert.equal(access.role, "admin");
assert.ok(access.roles.includes("platform-admin"));
assert.equal(access.setupCompleted, true);

console.log("[environment] Auth emulator login and setup routing probe passed");
