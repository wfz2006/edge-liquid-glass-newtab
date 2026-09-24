"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const copy = value => JSON.parse(JSON.stringify(value));
const widgets = ["cal", "todo", "note", "cd"];
const state = {
  pages: ["first", "second"].map(id => ({
    id, name: id, tileSize: "large", widgetOrder: widgets.slice().reverse(),
    cal: { x: 50, y: -20, z: 8 }, todo: null, note: { x: 30, y: 10 }, cd: null,
    items: [{ id: id + "-link", t: "Saved link", u: "https://example.com/", pos: { x: 70, y: 60, z: 9 } }],
    noteText: "Keep my notes"
  })),
  layout: { search: { x: 90, y: -50 } }, activePage: "first",
  todos: [{ text: "Keep my tasks" }], sidebar: { items: ["saved card"] }, wall: "mint"
};
let saved, duration, settled = false;
const controls = {};
const ctx = vm.createContext({
  S: state, WIDGET_KEYS: widgets, layoutUndoSnapshot: null,
  $: id => controls[id] || (controls[id] = {}),
  store: { save: value => { saved = copy(value); } },
  toast: (message, action, ms) => { duration = ms; },
  settleNow: () => { settled = true; state.pages[0].items[0].pos.x = 123; },
  applyLayout: () => {}, renderTiles: () => {}, buildPager: () => {}, syncSettings: () => {}
});
vm.runInContext(app.slice(app.indexOf("  function layoutSnapshot()"), app.indexOf("  function setLayoutEdit(")), ctx);
vm.runInContext(app.slice(app.indexOf("  function resetInitialLayout()"), app.indexOf("  function syncSettings()")), ctx);
const original = copy(state);
original.pages[0].items[0].pos.x = 123; // The pending drag must settle before taking the undo snapshot.
ctx.resetInitialLayout();
assert.ok(settled);
assert.equal(duration, 2000, "layout notifications expire after two seconds");
assert.deepEqual(copy(state.layout.search), { x: 0, y: 0 });
state.pages.forEach((page, i) => {
  assert.equal(page.tileSize, "medium");
  assert.deepEqual(copy(page.widgetOrder), widgets);
  assert.deepEqual(copy(page.items[0].pos), { x: 0, y: 0, z: 0 });
  assert.deepEqual(copy(page.cal), { x: 0, y: 0, z: 0 });
  assert.equal(page.todo, null, "hidden widgets stay hidden");
  assert.equal(page.cd, null);
  assert.equal(page.items[0].u, original.pages[i].items[0].u);
  assert.equal(page.noteText, original.pages[i].noteText);
});
assert.deepEqual(saved.pages, copy(state.pages), "all scenes are persisted");
assert.deepEqual(state.todos, original.todos);
assert.deepEqual(state.sidebar, original.sidebar);
assert.equal(state.wall, original.wall);
ctx.undoLayoutChange();
assert.deepEqual(copy(state), original, "undo restores the full layout and its content");
assert.deepEqual(saved, { pages: original.pages, layout: original.layout });
console.log("layout-reset: all-scene reset, preservation, pending drag and undo passed");
