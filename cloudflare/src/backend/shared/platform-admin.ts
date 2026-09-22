import { requireEnv } from "./env.ts";

export function platformAdminEmails() {
  const emails = requireEnv("ADMIN_EMAILS").split(",")
    .map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (emails.length === 0) throw new Error("service-not-configured");
  return [...new Set(emails)];
}
