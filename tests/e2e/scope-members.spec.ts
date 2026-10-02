import { expect, test } from "@playwright/test";
import { openAccessManagement, selectScope } from "./pages/access-page";
import { E2E_USERS } from "./support/accounts";
import { expectBackendAction } from "./support/backend-action";
import { newUserPage } from "./support/session";

test("scope drafts stay with their area, review real members, and save one atomic batch", async ({ browser }, testInfo) => {
  const admin = await newUserPage(browser, "admin");
  const page = admin.page;
  const writes: Array<{ action: string; payload: { changes?: unknown[] } }> = [];
  page.on("request", (request) => {
    if (!request.url().endsWith("/v1/actions") || request.method() !== "POST") return;
    const input = request.postDataJSON();
    if (input?.action === "saveScopeMembers" || input?.action === "setUserAccessScope") writes.push(input);
  });
  const lookup = async (email: string) => {
    await page.getByPlaceholder("Enter a full campus email or UID").fill(email);
    await page.getByRole("button", { name: "Search", exact: true }).click();
  };
  const add = async (email: string) => {
    await lookup(email);
    await page.getByRole("button", { name: `Grant access to ${email}`, exact: true }).click();
  };
  try {
    await openAccessManagement(page);
    await selectScope(page, { kind: "issue", category: "Proposal A" });
    await add(E2E_USERS.other);
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Proposal B", exact: true }).click();
    const leave = page.getByRole("alertdialog");
    await expect(leave.getByText(/unsaved/u)).toBeVisible();
    await leave.getByRole("button", { name: "Stay", exact: true }).click();
    await expect(page.getByRole("combobox")).toContainText("Proposal A");
    await expect(page.getByRole("button", { name: `Revoke access from ${E2E_USERS.other}`, exact: true })).toBeVisible();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Proposal B", exact: true }).click();
    await leave.getByRole("button", { name: "Discard and leave", exact: true }).click();
    await expect(page.getByPlaceholder("Enter a full campus email or UID")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    await selectScope(page, { kind: "issue", category: "Proposal A" });
    await expect(page.getByRole("button", { name: `Revoke access from ${E2E_USERS.other}`, exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
    await lookup(E2E_USERS.admin);
    await expect(page.getByText("Platform administrators already manage every area")).toBeVisible();
    await expect(page.getByRole("button", { name: `Grant access to ${E2E_USERS.admin}`, exact: true })).toHaveCount(0);
    await add(E2E_USERS.other);
    await add(E2E_USERS.ordinary);
    await page.getByRole("button", { name: "Review changes", exact: true }).click();
    const review = page.getByRole("alertdialog");
    await expect(review.getByText(E2E_USERS.other, { exact: false })).toBeVisible();
    await expect(review.getByText(E2E_USERS.ordinary, { exact: false })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(review).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath("scope-review-1440.png") });
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(review).toHaveCSS("opacity", "1");
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("scope-review-390.png") });
    await expectBackendAction(page, "saveScopeMembers", async () => {
      await review.getByRole("button", { name: "Save", exact: true }).click();
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].payload.changes).toHaveLength(2);
    await expect(page.getByText("2 unsaved changes", { exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/issueCategory=/u);
    const targetUrl = page.url();
    await page.goto("/admin/audit?view=actions");
    await page.getByRole("textbox").fill("saveScopeMembers");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button").filter({ hasText: "Change member access" }).first().click();
    const audit = page.getByRole("dialog");
    await audit.getByText("Member changes", { exact: true }).click();
    for (const change of writes[0].payload.changes as Array<{ uid: string }>) {
      await audit.getByText(change.uid, { exact: true }).first().click();
    }
    await expect(audit.getByText("Enabled", { exact: true })).toHaveCount(2);
    await expect(audit.getByText(/\[object Object\]/u)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("scope-audit-390.png") });
    await page.goto(targetUrl);
    await expect(page.getByRole("combobox")).toContainText("Proposal A");
    for (const email of [E2E_USERS.other, E2E_USERS.ordinary]) {
      await page.getByRole("button", { name: `Revoke access from ${email}`, exact: true }).click();
    }
    await expectBackendAction(page, "saveScopeMembers", async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click();
    });
  } finally {
    await admin.context.close();
  }
});

test("an unavailable scope reports an error instead of an empty ownership claim", async ({ browser }) => {
  const admin = await newUserPage(browser, "admin");
  try {
    await admin.page.goto("/admin/people?view=scopes&issueCategory=deleted-category");
    await expect(admin.page.getByText("The proposal category is invalid.", { exact: false })).toBeVisible();
    await expect(admin.page.getByText("No owner assigned", { exact: true })).toHaveCount(0);
    await expect(admin.page.getByRole("button", { name: "Search", exact: true })).toBeDisabled();
    await expect(admin.page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});
