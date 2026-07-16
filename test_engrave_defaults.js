const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const app = fs.readFileSync(path.join(root, "laser_editor", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "laser_editor", "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "laser_editor", "style.css"), "utf8");

function test(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

test("engraving ribbon exposes readable calibrated defaults", () => {
  assert.match(html, /class="ribbon-group engrave-defaults-group"/);
  assert.match(html, /id="engravePower"[^>]*value="500"/);
  assert.match(html, /id="engraveFeed"[^>]*value="1800"/);
  assert.match(html, /id="lineStep"[^>]*value="0\.08"[^>]*step="0\.01"/);
  assert.match(html, />Tarama<span class="unit-input">/);
  assert.match(html, />Foto eşik<input id="threshold"/);
});

test("engraving defaults are shared by g-code and text fill", () => {
  assert.match(app, /const DEFAULT_ENGRAVE_POWER = 500;/);
  assert.match(app, /const DEFAULT_ENGRAVE_FEED = 1800;/);
  assert.match(app, /const DEFAULT_ENGRAVE_LINE_STEP = 0\.08;/);
  assert.match(app, /const TEXT_FILL_LINE_STEP_MM = DEFAULT_ENGRAVE_LINE_STEP;/);
  assert.match(app, /engraveSettingsVersion: ENGRAVE_SETTINGS_VERSION/);
  assert.match(app, /fillSettingsVersion: TEXT_FILL_SETTINGS_VERSION/);
  assert.match(app, /if \(migrateProjectEngraveDefaults\) applyRecommendedEngraveInputs\(\);/);
});

test("engraving ribbon reserves enough width for units and four digit speeds", () => {
  assert.match(css, /\.engrave-defaults-group \{[\s\S]*?min-width: 472px;/);
  assert.match(css, /\.engrave-speed-field \{ min-width: 142px; \}/);
  assert.match(css, /\.unit-input input\[type="number"\] \{[\s\S]*?width: 76px;/);
});

console.log("All engraving default tests passed.");
