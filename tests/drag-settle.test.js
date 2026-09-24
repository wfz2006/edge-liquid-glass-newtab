"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const helperPath = require.resolve("../js/drag-spring.js");
assert.ok(fs.existsSync(helperPath), "drag-spring.js must provide the release motion used by collection cards");

const window = {};
vm.runInNewContext(fs.readFileSync(helperPath, "utf8"), { window, Math, Number }, {
  filename: "js/drag-spring.js"
});

assert.strictEqual(typeof window.LGDragSpring.release, "function");
assert.strictEqual(typeof window.LGDragSpring.step, "function");

const state = { cx: 0, cy: 0, tx: 100, ty: 0, vx: 0, vy: 0 };
window.LGDragSpring.release(state, 20, 0);
let maxX = state.cx;
let speed = Infinity;
for (let i = 0; i < 120 && !window.LGDragSpring.atRest(state, speed); i += 1) {
  speed = window.LGDragSpring.step(state);
  maxX = Math.max(maxX, state.cx);
}

assert.ok(maxX > state.tx + 1, "release motion should visibly overshoot the drop target");
assert.ok(Math.abs(state.cx - state.tx) < 1, "release motion should settle at the target");
assert.ok(Math.abs(state.cy - state.ty) < 0.1, "release motion should preserve the other axis");

console.log("drag-settle: release motion overshoot and settle checks passed");
