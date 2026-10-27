import { expect, it } from "vitest";
import { idTokenMatchesRequest, parseGoogleCallback } from "../../src/lib/google-identity";

const segment = (value: object) => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const token = (claims: object) => `${segment({ alg: "RS256" })}.${segment(claims)}.signature`;

it("accepts a token minted for this attempt and client", () => {
  expect(idTokenMatchesRequest(token({ aud: "client", nonce: "n1" }), { clientId: "client", nonce: "n1" })).toBe(true);
});

it("rejects a token with another nonce, another audience, or no payload", () => {
  const expected = { clientId: "client", nonce: "n1" };
  expect(idTokenMatchesRequest(token({ aud: "client", nonce: "n2" }), expected)).toBe(false);
  expect(idTokenMatchesRequest(token({ aud: "other", nonce: "n1" }), expected)).toBe(false);
  expect(idTokenMatchesRequest("garbage", expected)).toBe(false);
});

it("reads the result from the fragment and falls back to the query for errors", () => {
  expect(parseGoogleCallback({ hash: "#id_token=abc&state=popup.1", search: "" }))
    .toEqual({ error: "", idToken: "abc", state: "popup.1" });
  expect(parseGoogleCallback({ hash: "", search: "?error=access_denied&state=redirect.2" }))
    .toEqual({ error: "access_denied", idToken: "", state: "redirect.2" });
});
