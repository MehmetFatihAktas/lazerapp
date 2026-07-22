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
    motionProfileFields: [
      "machineProfileStepsX",
      "machineProfileStepsY",
      "machineProfileMaxRateX",
      "machineProfileMaxRateY",
      "machineProfileAccelerationX",
      "machineProfileAccelerationY",
    ].every((id) => Boolean(document.getElementById(id))),
    preflightButton: Boolean(document.querySelector("#preflightBtn")),
    workflowSteps: document.querySelectorAll("[data-workspace-mode]").length,
    visibleDesignTabs: [...document.querySelectorAll('.ribbon-tab[data-workspace="design"]')]
      .filter((element) => getComputedStyle(element).display !== "none").length,
    visiblePrepareTabs: [...document.querySelectorAll('.ribbon-tab[data-workspace="prepare"]')]
      .filter((element) => getComputedStyle(element).display !== "none").length,
    jobDrawer: Boolean(document.querySelector("#jobDrawerToggle") && document.querySelector("#jobDrawerBody")),
    cutSettingsShortcut: Boolean(document.querySelector("#openCutSettingsBtn")),
    textTestShortcut: Boolean(document.querySelector("#openTextTestBtn")),
    advancedButton: Boolean(document.querySelector("#ribbonAdvancedBtn")),
    drawingAutoJoinDefault: document.querySelector("#drawingAutoJoin")?.checked === true,
    emptyState: getComputedStyle(document.querySelector("#canvasEmptyState")).display !== "none",
    emptyPanelsHidden: [".left-panel", ".right-panel"].every(
      (selector) => getComputedStyle(document.querySelector(selector)).display === "none",
    ),
    emptyCanvasFillsWorkspace:
      document.querySelector(".canvas-panel")?.getBoundingClientRect().width >=
      document.querySelector(".workspace")?.getBoundingClientRect().width - 2,
    minVisibleFontSize: Math.min(
      ...[...document.querySelectorAll("body *")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
        .filter(Number.isFinite),
    ),
    canvasWidth: document.querySelector("#editorCanvas")?.getBoundingClientRect().width || 0,
  }));
  if (!checks.title.includes("Lazer")) throw new Error(`unexpected title: ${checks.title}`);
  if (checks.tokenLength < 32) throw new Error("API token was not bootstrapped into index.html");
  if (checks.cutPowerMax !== "100" || checks.engravePowerMax !== "100") {
    throw new Error(`power fields are not percentage based: ${JSON.stringify(checks)}`);
  }
  if (!checks.profileCard || !checks.motionProfileFields || !checks.preflightButton || checks.canvasWidth < 300) {
    throw new Error(`critical editor UI is missing: ${JSON.stringify(checks)}`);
  }
  if (checks.workflowSteps !== 4 || checks.visibleDesignTabs !== 5 || checks.visiblePrepareTabs !== 0 || !checks.jobDrawer || !checks.cutSettingsShortcut || !checks.textTestShortcut || !checks.advancedButton || !checks.drawingAutoJoinDefault || !checks.emptyState || !checks.emptyPanelsHidden || !checks.emptyCanvasFillsWorkspace || checks.minVisibleFontSize < 10) {
    throw new Error(`professional workspace shell is inconsistent: ${JSON.stringify(checks)}`);
  }
  if (await page.locator("#tourSkipBtn").isVisible()) await page.locator("#tourSkipBtn").click();

  await page.locator('.ribbon-tab[data-tab="metin"]').click();
  await page.locator('[data-add-shape="rect"]').click();
  await page.locator('.ribbon-tab[data-tab="cizim"]').click();
  await page.locator("#startDrawingBtn").click();
  const firstDrawingBox = await page.locator("#editorCanvas").boundingBox();
  if (!firstDrawingBox) throw new Error("editor canvas is unavailable for vector auto-join regression");
  const firstLeft = firstDrawingBox.x + firstDrawingBox.width * 0.28;
  const firstRight = firstDrawingBox.x + firstDrawingBox.width * 0.48;
  const firstTop = firstDrawingBox.y + firstDrawingBox.height * 0.25;
  const firstBottom = firstDrawingBox.y + firstDrawingBox.height * 0.70;
  await page.mouse.click(firstLeft, firstTop);
  await page.mouse.click(firstRight, firstTop);
  await page.mouse.click(firstRight, firstBottom);
  await page.mouse.click(firstLeft, firstBottom);
  await page.keyboard.press("Enter");
  const objectCountBeforeJoin = Number(await page.locator("#objectCountBadge").textContent() || 0);
  await page.locator("#drawingOperation").selectOption("cut");
  await page.locator("#startDrawingBtn").click();
  const secondDrawingBox = await page.locator("#editorCanvas").boundingBox();
  if (!secondDrawingBox) throw new Error("editor canvas disappeared before vector auto-join");
  const secondLeft = secondDrawingBox.x + secondDrawingBox.width * 0.28;
  const secondTop = secondDrawingBox.y + secondDrawingBox.height * 0.25;
  const secondBottom = secondDrawingBox.y + secondDrawingBox.height * 0.70;
  await page.mouse.click(secondLeft, secondBottom);
  await page.mouse.click(secondLeft, secondTop);
  await page.keyboard.press("Enter");
  const autoJoin = await page.evaluate(() => ({
    message: document.querySelector("#jobStatus")?.textContent || "",
    objectCount: Number(document.querySelector("#objectCountBadge")?.textContent || 0),
  }));
  if (autoJoin.objectCount !== objectCountBeforeJoin
    || !autoJoin.message.includes("kontur kapatıldı")
    || !autoJoin.message.includes("İşlem türü bağlandığı konturdan alındı")) {
    throw new Error(`vector auto-join did not coalesce the closing edge: ${JSON.stringify({ objectCountBeforeJoin, ...autoJoin })}`);
  }

  await page.locator('.ribbon-tab[data-tab="vektor"]').click();
  const advancedToolsBefore = await page.evaluate(() => ({
    buttonVisible: getComputedStyle(document.querySelector("#ribbonAdvancedBtn")).display !== "none",
    groupHidden: getComputedStyle(document.querySelector('.ribbon-panel[data-tab="vektor"] .ribbon-advanced-group')).display === "none",
  }));
  if (!advancedToolsBefore.buttonVisible || !advancedToolsBefore.groupHidden) {
    throw new Error(`advanced ribbon defaults are inconsistent: ${JSON.stringify(advancedToolsBefore)}`);
  }
  await page.locator("#ribbonAdvancedBtn").click();
  const advancedToolsAfter = await page.evaluate(() => ({
    pressed: document.querySelector("#ribbonAdvancedBtn")?.getAttribute("aria-pressed"),
    groupVisible: getComputedStyle(document.querySelector('.ribbon-panel[data-tab="vektor"] .ribbon-advanced-group')).display !== "none",
  }));
  if (advancedToolsAfter.pressed !== "true" || !advancedToolsAfter.groupVisible) {
    throw new Error(`advanced ribbon toggle failed: ${JSON.stringify(advancedToolsAfter)}`);
  }
  await page.locator("#ribbonAdvancedBtn").click();
  await page.locator("#openCutSettingsBtn").click();
  const cutSettings = await page.evaluate(() => ({
    workspace: document.querySelector(".app-shell")?.dataset.activeWorkspace || "",
    workflowActive: document.querySelector('.workflow-tab[data-workspace-mode="prepare"]')?.classList.contains("active"),
    ribbonActive: document.querySelector('.ribbon-tab[data-tab="kesim"]')?.classList.contains("active"),
    panelActive: document.querySelector('.ribbon-panel[data-tab="kesim"]')?.classList.contains("active"),
    ribbonExpanded: !document.querySelector(".app-shell")?.classList.contains("ribbon-collapsed"),
  }));
  if (cutSettings.workspace !== "prepare" || !cutSettings.workflowActive || !cutSettings.ribbonActive || !cutSettings.panelActive || !cutSettings.ribbonExpanded) {
    throw new Error(`cut settings shortcut did not open the prepare panel: ${JSON.stringify(cutSettings)}`);
  }
  await page.locator('.workflow-tab[data-workspace-mode="design"]').click();
  await page.locator('.workflow-tab[data-workspace-mode="prepare"]').click();
  const prepareStage = await page.evaluate(() => ({
    ribbonActive: document.querySelector('.ribbon-tab[data-tab="kesim"]')?.classList.contains("active"),
    panelActive: document.querySelector('.ribbon-panel[data-tab="kesim"]')?.classList.contains("active"),
  }));
  if (!prepareStage.ribbonActive || !prepareStage.panelActive) {
    throw new Error(`prepare workflow did not open cut settings: ${JSON.stringify(prepareStage)}`);
  }
  await page.locator("#openTextTestBtn").evaluate((button) => button.click());
  await page.waitForSelector("#calibrationModal:not(.hidden)");
  const textTest = await page.evaluate(() => ({
    title: document.querySelector("#calibrationTitle")?.textContent || "",
    operation: document.querySelector("#calibrationOperation")?.value || "",
    fieldsVisible: getComputedStyle(document.querySelector("#calibrationTextFields")).display !== "none",
    defaultText: document.querySelector("#calibrationText")?.value || "",
  }));
  if (!textTest.title.includes("Yazı") || textTest.operation !== "text_fill" || !textTest.fieldsVisible || !textTest.defaultText) {
    throw new Error(`text quality test shortcut is inconsistent: ${JSON.stringify(textTest)}`);
  }
  if (process.env.LASER_EDITOR_SCREENSHOT) {
    await page.screenshot({ path: process.env.LASER_EDITOR_SCREENSHOT, fullPage: true });
  }
  await page.locator("#calibrationColumns").fill("2");
  await page.locator("#calibrationRows").fill("2");
  await page.locator("#calibrationText").fill("TEST");
  await page.locator("#calibrationTextHeight").fill("4");
  await page.locator("#addCalibrationBtn").click();
  await page.waitForFunction(() => document.querySelector("#calibrationModal")?.classList.contains("hidden"), null, { timeout: 60_000 });
  const generatedTextTest = await page.evaluate(() => ({
    objectCount: Number(document.querySelector("#objectCountBadge")?.textContent || 0),
    emptyStateHidden: getComputedStyle(document.querySelector("#canvasEmptyState")).display === "none",
  }));
  if (generatedTextTest.objectCount < 8 || !generatedTextTest.emptyStateHidden) {
    throw new Error(`text quality matrix was not generated: ${JSON.stringify(generatedTextTest)}`);
  }
  if (process.env.LASER_EDITOR_GENERATED_SCREENSHOT) {
    await page.screenshot({ path: process.env.LASER_EDITOR_GENERATED_SCREENSHOT, fullPage: true });
  }
  await page.locator("#openCalibrationBtn").evaluate((button) => button.click());
  const cutDefaults = await page.evaluate(() => ({
    operation: document.querySelector("#calibrationOperation")?.value,
    columns: document.querySelector("#calibrationColumns")?.value,
    minPower: document.querySelector("#calibrationMinPower")?.value,
    maxFeed: document.querySelector("#calibrationMaxFeed")?.value,
  }));
  if (cutDefaults.operation !== "cut" || cutDefaults.columns !== "5" || cutDefaults.minPower !== "20" || cutDefaults.maxFeed !== "1500") {
    throw new Error(`cut calibration defaults were overwritten by text test: ${JSON.stringify(cutDefaults)}`);
  }
  await page.locator("button[data-calibration-close]").first().click();
  if (consoleErrors.length) throw new Error(`browser console errors: ${consoleErrors.join(" | ")}`);
  console.log("PASS browser smoke");
} finally {
  await browser.close();
}
