import { test } from "@playwright/test";
import { gotoApp } from "./support/app";

test("debug app shell", async ({ page }) => {
  page.on("console", (message) => {
    console.log(`[browser:${message.type()}] ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    console.log(`[pageerror] ${error.message}`);
  });

  await gotoApp(page);
  await page.waitForTimeout(1000);

  console.log(`[title] ${await page.title()}`);
  console.log(`[url] ${page.url()}`);
  console.log(`[body] ${(await page.locator("body").innerText()).slice(0, 4000)}`);
});
