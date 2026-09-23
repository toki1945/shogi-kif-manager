import { expect, test } from "@playwright/test";

test("棋譜の表示と再生ができる", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/");
  await expect(page).toHaveTitle(/棋譜帖/);
  await expect(page.getByRole("region", { name: "棋譜ビューアー" }).getByRole("heading", { name: "横歩取りの研究" })).toBeVisible();
  await expect(page.locator(".piece")).toHaveCount(40);
  await expect(page.getByRole("button", { name: "駒音をオフにする" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "駒音をオフにする" }).click();
  await expect(page.getByRole("button", { name: "駒音をオンにする" })).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("一手進む").click();
  await expect(page.getByText(/1手目/)).toBeVisible();
  await page.getByRole("button", { name: "メモ・タグ" }).click();
  await expect(page.getByLabel("振り返りメモ")).toBeVisible();
  expect(errors).toEqual([]);
});

test("取り込み時に棋譜名を設定できる", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /棋譜を取り込む/ }).first().click();
  await page.getByLabel("棋譜名").fill("テスト対局");
  await page.getByLabel("KIF テキスト").fill("手合割：平手\n先手：先手\n後手：後手\n1 ７六歩(77)\n2 ３四歩(33)\n3 中断");
  await page.getByRole("button", { name: "「テスト対局」を取り込む" }).click();
  await expect(page.getByRole("region", { name: "棋譜ビューアー" }).getByRole("heading", { name: "テスト対局" })).toBeVisible();
});

test("モバイル画面で主要操作が表示される", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /棋譜を取り込む/ }).first()).toBeVisible();
  await expect(page.locator(".board")).toBeVisible();
});
