import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const baseUrl = process.env.LASER_EDITOR_URL || "http://127.0.0.1:8765/";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
    consoleErrors.push(message.text());
  }
});
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400 && !response.url().endsWith("/favicon.ico")) {
    consoleErrors.push(`${response.status()} ${response.url()}`);
  }
});

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForSelector("#editorCanvas", { state: "visible" });
  await page.waitForTimeout(750);
  const checks = await page.evaluate(() => ({
    title: document.title,
    tokenLength: document.querySelector('meta[name="laser-app-token"]')?.content?.length || 0,
    cutPowerMax: document.querySelector("#cutPower")?.getAttribute("max"),
    engravePowerMax: document.querySelector("#engravePower")?.getAttribute("max"),
    profileCard: Boolean(document.querySelector("#machineProfileCard")),
    preflightButton: Boolean(document.querySelector("#preflightBtn")),
    canvasWidth: document.querySelector("#editorCanvas")?.getBoundingClientRect().width || 0,
  }));
  if (!checks.title.includes("Lazer")) throw new Error(`unexpected title: ${checks.title}`);
  if (checks.tokenLength < 32) throw new Error("API token was not bootstrapped into index.html");
  if (checks.cutPowerMax !== "100" || checks.engravePowerMax !== "100") {
    throw new Error(`power fields are not percentage based: ${JSON.stringify(checks)}`);
  }
  if (!checks.profileCard || !checks.preflightButton || checks.canvasWidth < 300) {
    throw new Error(`critical editor UI is missing: ${JSON.stringify(checks)}`);
  }
  if (consoleErrors.length) throw new Error(`browser console errors: ${consoleErrors.join(" | ")}`);
  console.log("PASS browser smoke");
} finally {
  await browser.close();
}
