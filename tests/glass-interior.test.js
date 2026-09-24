"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync(require.resolve("../js/liquid-glass.js"), "utf8");
let map;
const context = vm.createContext({ document: { createElement: () => ({
  getContext: () => ({
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData: image => { map = image; }
  }), toDataURL: () => "data:image/png,test"
}) } });
vm.runInContext(source.slice(source.indexOf("  function ss("), source.indexOf("  /* ---------------- SVG")), context);
context.dispMap(120, 104, 18, 16, 10);
function displacement(x, y) {
  const i = (y * map.width + x) * 4;
  return { x: (map.data[i] / 255 - .5) * 20, y: (map.data[i + 1] / 255 - .5) * 20 };
}
// These points are well inside the edge band. Zero displacement here was the bug.
assert.ok(displacement(30, 52).x > 3, "left interior bends the backdrop toward the optical center");
assert.ok(displacement(90, 52).x < -3, "right interior bends the backdrop toward the optical center");
assert.ok(displacement(60, 26).y > 3, "top interior has visible vertical refraction");
assert.ok(displacement(60, 78).y < -3, "bottom interior has visible vertical refraction");
assert.ok(Math.abs(displacement(60, 52).x) < .2 && Math.abs(displacement(60, 52).y) < .2, "optical center must not translate");
for (let y = 0; y < 104; y++) for (let x = 0; x < 120; x++) {
  const p = displacement(x, y), sx = x + .5 + p.x, sy = y + .5 + p.y;
  assert.ok(sx >= 0 && sx <= 120 && sy >= 0 && sy <= 104, "sampling stays within the card's bounds");
  if (x > 0) {
    const prev = displacement(x - 1, y);
    assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 2, "no abrupt horizontal displacement seam");
  }
  if (y > 0) {
    const prev = displacement(x, y - 1);
    assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 2, "no abrupt vertical displacement seam");
  }
}
console.log("glass-interior: visible interior lens, stationary center, bounded and continuous samples passed");
