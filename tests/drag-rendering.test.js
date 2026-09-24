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
const scripts = Array.from(html.matchAll(/<script\b[^>]*src="([^"]+)"/g), match => match[1].split("?")[0]);
assert.ok(
  scripts.indexOf("js/drag-position.js") >= 0 &&
    scripts.indexOf("js/drag-position.js") < scripts.indexOf("js/app.js"),
  "drag-position helper must load before app.js"
);

const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const dragCore = app.slice(app.indexOf("function applyLayout"), app.indexOf("function blockSpec"));
assert.ok(dragCore.includes("LGDragPosition.apply"), "main drag path must use layout offsets");
assert.ok(!dragCore.includes("style.transform"), "main drag path must not transform glass elements");
assert.ok(!dragCore.includes("dragSafeAll"), "main drag path must not disable all glass filters");
const css = fs.readFileSync(path.join(root, "css", "newtab.css"), "utf8");
const draggingRule = css.match(/\.draggable\.dragging\s*\{([^}]*)\}/);
assert.ok(draggingRule, "dragging glass must have a dedicated stacking rule");
assert.match(
  draggingRule[1],
  /(?:^|;)\s*z-index\s*:\s*[1-9]\d*/,
  "dragging glass must paint above its sibling glass cards"
);
assert.ok(!app.includes('el.style.transform = "translate3d(" + (item.x || 0)'), "collection cards must not keep a transform on glass");
const tileDrag = app.slice(app.indexOf("function attachTileDrag"), app.indexOf("function attachWidgetDrag"));
assert.match(tileDrag, /obj: function \(\) \{ return sc\.pos/, "shortcut cards must load their saved position");
assert.match(tileDrag, /put: function \(x, y\) \{ sc\.pos\.x = x; sc\.pos\.y = y; \}/, "shortcut drag must persist free placement");
assert.match(app, /function attachWidgetDrag\(el, block\)[\s\S]*?layoutObjOrCreate\(block\)/, "each widget must use its page-specific position");
assert.doesNotMatch(app, /function tileReorder|function widgetReorder/, "free placement must not snap cards back into an order grid");
assert.match(app, /SB_CORE\.bringToFront\(S\.sidebar, it\)/, "new-tab card drag must raise the active card");
assert.match(app, /el\.style\.zIndex = String\(/, "new-tab cards must render their stack order");

const content = fs.readFileSync(path.join(root, "js", "content.js"), "utf8");
assert.ok(!content.includes("dragSafeAll"), "web collection drag must not disable all glass filters");
assert.match(content, /CORE\.bringToFront\(st\.sidebar, d\.item\)/, "web card drag must raise the active card");
assert.match(content, /el\.style\.zIndex = String\(/, "web cards must render their stack order");

console.log("drag-rendering: 23 assertions passed");
