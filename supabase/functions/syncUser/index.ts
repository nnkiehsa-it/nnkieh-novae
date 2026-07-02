import { requireEnv } from "../_shared/env.ts";
import { getGoogleAccessToken } from "../_shared/google-oauth.ts";

Deno.serve(async (request) => {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const idToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) {
      return new Response("Missing Firebase token", { status: 401 });
    }

    const firebaseApiKey = requireEnv("FIREBASE_WEB_API_KEY");
    const projectId = requireEnv("FIREBASE_PROJECT_ID");
    const lookupResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!lookupResponse.ok) {
      return new Response("Invalid Firebase token", { status: 401 });
    }

    const lookup = await lookupResponse.json();
    const user = lookup.users?.[0];
    if (!user?.localId || user.emailVerified !== true) {
      return new Response("Firebase user is not eligible", { status: 403 });
    }

    const allowedDomain = requireEnv("ALLOWED_DOMAIN");
    const email = String(user.email ?? "").toLowerCase();
    if (!email.endsWith(`@${allowedDomain}`)) {
      return new Response("Email domain is not allowed", { status: 403 });
    }

    const accessToken = await getGoogleAccessToken([
      "https://www.googleapis.com/auth/identitytoolkit",
      "https://www.googleapis.com/auth/firebase",
    ]);
    const updateResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          localId: user.localId,
          customAttributes: JSON.stringify({
            ...JSON.parse(user.customAttributes || "{}"),
            role: "authenticated",
          }),
        }),
      },
    );
    if (!updateResponse.ok) {
      throw new Error(`Firebase custom claim update failed: ${await updateResponse.text()}`);
    }

    return Response.json({ ok: true, role: "authenticated" });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
