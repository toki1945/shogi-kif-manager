import { expect, test } from "@playwright/test";

test("棋譜の表示と再生ができる", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page).toHaveTitle(/棋譜帖/);
  await expect(page.getByRole("region", { name: "棋譜ビューアー" }).getByRole("heading", { name: "横歩取りの研究" })).toBeVisible();
  await expect(page.locator(".piece")).toHaveCount(40);
  await page.getByLabel("一手進む").click();
  await expect(page.getByText(/1手目/)).toBeVisible();
  await page.getByRole("button", { name: "メモ・タグ" }).click();
  await expect(page.getByLabel("振り返りメモ")).toBeVisible();
  expect(errors).toEqual([]);
});

test("モバイル画面で主要操作が表示される", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /棋譜を取り込む/ }).first()).toBeVisible();
  await expect(page.locator(".board")).toBeVisible();
});
