"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const elements = Object.fromEntries(["searchWrap", "calWrap", "a", "b"].map(id => [id, {
  style: {}, getAttribute: () => id
}]));
elements.tileGrid = { querySelectorAll: () => [elements.a, elements.b] };
const page = { items: [{ id: "a", pos: { x: 12, y: 3, z: 99 } }, { id: "b", pos: { x: 0, y: 0, z: 99 } }], cal: { x: 10, y: 20, z: 99 } };
const state = { layout: { search: { x: 0, y: 10 } }, pages: [page] };
const ctx = vm.createContext({ S: state, activePage: () => page, $: id => elements[id], BLOCKS: [{ page: true, key: "cal", id: "calWrap" }] });
vm.runInContext(app.slice(app.indexOf("  function raiseLayoutItem("), app.indexOf("  function finishDrag(")), ctx);
for (let i = 0; i < 130; i++) {
  const id = ["a", "b", "searchWrap", "calWrap"][i % 4];
  ctx.raiseLayoutItem(elements[id]);
  const order = [elements.a, elements.b, elements.searchWrap, elements.calWrap].map(el => Number(el.style.zIndex));
  assert.equal(new Set(order).size, 4, "saved layers must not tie at the old ceiling");
  assert.equal(Number(elements[id].style.zIndex), Math.max(...order), "last moved surface must remain in front");
  assert.ok(Math.max(...order) < 1000, "ordinary placement stays below active drags and dialogs");
}
assert.equal(page.items[0].pos.x, 12);
assert.equal(page.cal.y, 20);
assert.equal(state.layout.search.y, 10);
console.log("layout-stacking: search/card/widget ordering remains unique after 130 moves");
