"use strict";

const assert = require("assert");
const fs = require("fs");

const html = fs.readFileSync(require.resolve("../newtab.html"), "utf8");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const css = fs.readFileSync(require.resolve("../css/newtab.css"), "utf8");
const background = fs.readFileSync(require.resolve("../js/background.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(require.resolve("../manifest.json"), "utf8"));

const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
for (const id of [
  "btnBrowser", "browserPanel", "productivityPanel", "tileBatchToggle", "tileOpenAll",
  "tileDeleteSelected", "todoDue", "todoPriority", "todoRepeat",
  "todoRemind", "tilePageLabel", "shortcutBatchDialog", "worldClockDialog", "clockZoneInput",
  "calWeek", "calAgenda", "wallFile", "weatherCities", "engineAdd", "syncSeg",
  "calendarSync", "dlgTags", "sbBatchToggle", "sbBatchCount", "sbSelectAll",
  "sbClearSelection", "sbDeleteSelected"
]) assert.ok(ids.has(id), `missing feature DOM id: ${id}`);
for (const id of ["tileFolderFilter", "tileSetFolder", "dlgFolder", "batchFolderInput"]) {
  assert.ok(!ids.has(id), `folder feature DOM id should be removed: ${id}`);
}

for (const permission of ["bookmarks", "history", "sessions", "tabs", "tabGroups", "contextMenus", "notifications"]) {
  assert.ok(manifest.permissions.includes(permission), `missing manifest permission: ${permission}`);
}
assert.strictEqual(manifest.background.service_worker, "js/background.js");
assert.match(app, /chrome\.storage\.sync/);
const content = fs.readFileSync(require.resolve("../js/content.js"), "utf8");
assert.match(app, /function sbDeleteSelected\(\)/);
assert.match(app, /SB_CORE\.removeByIds/);
assert.match(app, /SB_CORE\.restoreByIds/);
assert.match(css, /\.sbcard\.selected/);
assert.match(app, /var sbBatchMode = false, sbSelected = Object\.create\(null\)/);
assert.match(app, /var live = Object\.create\(null\)/);
assert.doesNotMatch(app, /sbSelected\s*=\s*\{\}/);
assert.match(app, /if \(sbBatchMode\) \{[\s\S]*?sbBatchMode = false;[\s\S]*?sbSelected = Object\.create\(null\);[\s\S]*?renderSidebar\(\);[\s\S]*?return;/);
assert.match(app, /if \(\$\("sbDlg"\)\.classList\.contains\("open"\)\) closeSbDlg\(\); else closeSb\(\);/);
assert.match(background, /SYNC_CHUNK_CHARS/);
assert.match(app, /normalizeShortcut/);
assert.match(app, /parseICS/);
assert.match(app, /focusMode/);
assert.match(app, /flow: true/);
assert.match(app, /function attachWidgetDrag/);
assert.match(app, /if \(b\.flow\) attachWidgetDrag/);
assert.doesNotMatch(app, /if \(el && !b\.flow\) attachDrag/);
assert.match(app, /widgetOrder/);
assert.doesNotMatch(app, /shortcutFolder|folderTarget|创建\/加入文件夹/);
assert.match(css, /\.wgrow\{width:min\(920px,100%\);display:flex/);
assert.match(css, /\.calwrap,.todo,.note,.cd\{position:relative;left:0;top:0;width:214px/);
assert.doesNotMatch(css, /\.calwrap,.todo,.note,.cd\{[^}]*!important/);
assert.match(css, /\.wgrow > \.draggable\{cursor:grab;touch-action:none;user-select:none\}/);
assert.match(background, /contextMenus/);
assert.match(background, /syncLocalState/);

console.log("newtab-feature-surface: manifest, DOM surface, sync, shortcut, calendar, productivity checks passed");
