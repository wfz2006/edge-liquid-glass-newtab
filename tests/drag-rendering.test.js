"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "js", "drag-position.js");

assert.ok(
  fs.existsSync(helperPath),
  "drag-position.js must move glass with layout offsets instead of compositor transforms"
);

const window = {};
vm.runInNewContext(fs.readFileSync(helperPath, "utf8"), { window }, {
  filename: "js/drag-position.js"
});

assert.strictEqual(typeof window.LGDragPosition.apply, "function");

const glass = {
  style: {
    left: "",
    top: "",
    transform: "translate3d(4px,5px,0)",
    backdropFilter: "url(#lgf1)",
    webkitBackdropFilter: "url(#lgf1)"
  }
};

window.LGDragPosition.apply(glass, 12.5, -3);
assert.strictEqual(glass.style.left, "12.5px");
assert.strictEqual(glass.style.top, "-3px");
assert.strictEqual(glass.style.transform, "");
assert.strictEqual(glass.style.backdropFilter, "url(#lgf1)");
assert.strictEqual(glass.style.webkitBackdropFilter, "url(#lgf1)");

const html = fs.readFileSync(path.join(root, "newtab.html"), "utf8");
assert.ok(
  html.indexOf('src="js/drag-position.js"') >= 0 &&
    html.indexOf('src="js/drag-position.js"') < html.indexOf('src="js/app.js"'),
  "drag-position helper must load before app.js"
);

const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const dragCore = app.slice(app.indexOf("function applyLayout"), app.indexOf("function blockSpec"));
assert.ok(dragCore.includes("LGDragPosition.apply"), "main drag path must use layout offsets");
assert.ok(!dragCore.includes("style.transform"), "main drag path must not transform glass elements");
assert.ok(!dragCore.includes("dragSafeAll"), "main drag path must not disable all glass filters");
assert.ok(!app.includes('el.style.transform = "translate3d(" + (item.x || 0)'), "collection cards must not keep a transform on glass");
assert.match(app, /SB_CORE\.bringToFront\(S\.sidebar, it\)/, "new-tab card drag must raise the active card");
assert.match(app, /el\.style\.zIndex = String\(/, "new-tab cards must render their stack order");

const content = fs.readFileSync(path.join(root, "js", "content.js"), "utf8");
assert.ok(!content.includes("dragSafeAll"), "web collection drag must not disable all glass filters");
assert.match(content, /CORE\.bringToFront\(st\.sidebar, d\.item\)/, "web card drag must raise the active card");
assert.match(content, /el\.style\.zIndex = String\(/, "web cards must render their stack order");

console.log("drag-rendering: 17 assertions passed");
