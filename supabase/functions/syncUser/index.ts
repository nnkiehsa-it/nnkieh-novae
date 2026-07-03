import { requireEnv } from "../_shared/env.ts";
import { getGoogleAccessToken } from "../_shared/google-oauth.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function textResponse(body: string, status: number) {
  return new Response(body, { headers: corsHeaders, status });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("authorization") ?? "";
    const idToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) {
      return textResponse("Missing Firebase token", 401);
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
      return textResponse("Invalid Firebase token", 401);
    }

    const lookup = await lookupResponse.json();
    const user = lookup.users?.[0];
    if (!user?.localId || user.emailVerified !== true) {
      return textResponse("Firebase user is not eligible", 403);
    }

    const allowedDomain = requireEnv("ALLOWED_DOMAIN");
    const email = String(user.email ?? "").toLowerCase();
    if (!email.endsWith(`@${allowedDomain}`)) {
      return textResponse("Email domain is not allowed", 403);
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

    return Response.json({ ok: true, role: "authenticated" }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { headers: corsHeaders, status: 500 },
    );
  }
});
