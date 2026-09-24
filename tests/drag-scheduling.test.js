"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
let writes = 0, queued = 0, finished = 0, measured = 0;
const d = {
  active: true, moved: true, cx: 0, cy: 0, tx: 50, ty: 20,
  pointerX: 60, pointerY: 30, el: { id: "tile" }, spec: {},
  bn: { minX: -500, maxX: 500, minY: -500, maxY: 500 }
};
const ctx = vm.createContext({
  dragCtx: d, dragLoop: 0,
  clampn: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  updatePageDropTarget: () => {}, smenuIsOpen: () => false,
  window: { LGDragPosition: { apply: () => { writes++; } }, LGDragSpring: {
    step: state => { state.cx = state.tx; state.cy = state.ty; }, atRest: () => true
  } },
  requestAnimationFrame: () => ++queued,
  finishDrag: () => { finished++; }
});
vm.runInContext(app.slice(app.indexOf("  function dragStep()"), app.indexOf("  function settleNow()")), ctx);
ctx.dragStep();
assert.equal(d.cx, 50);
assert.equal(d.cy, 20);
assert.equal(writes, 1);
assert.equal(queued, 0, "holding a stationary card must not schedule continuous repaints");
ctx.startDragLoop(); ctx.startDragLoop();
assert.equal(queued, 1, "multiple pointer events coalesce into one frame");
d.active = false;
ctx.dragStep();
assert.equal(finished, 1, "release still completes the spring and persistence path");

const tab = { getAttribute: () => "other", getBoundingClientRect: () => {
  measured++; return { left: 100, right: 160, top: 200, bottom: 230 };
}, classList: { add() {}, remove() {} } };
Object.assign(ctx, {
  dropPageTab: null,
  S: { activePage: "current", pages: [{ id: "other", items: [] }] },
  $: () => ({ querySelectorAll: () => [tab] })
});
vm.runInContext(app.slice(app.indexOf("  function clearPageDropTarget()"), app.indexOf("  function applyWidgetOrder()")), ctx);
d.spec.shortcut = {};
ctx.updatePageDropTarget(d, 120, 210);
assert.equal(d.dropPageId, "other");
ctx.updatePageDropTarget(d, 121, 211);
assert.equal(measured, 1, "stable pager geometry is reused across pointer moves");
ctx.updatePageDropTarget(d, 20, 20);
assert.equal(d.dropPageId, null, "leaving the tab clears the destination");
d.pageTargets = null;
ctx.updatePageDropTarget(d, 120, 210);
assert.equal(measured, 2, "invalidated geometry is measured again");
console.log("drag-scheduling: idle, frame coalescing, release and drop-target caching passed");
