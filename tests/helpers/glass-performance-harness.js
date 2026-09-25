"use strict";

const vm = require("node:vm");
const crypto = require("node:crypto");

// Exercise the production map generators without PNG encoding or GPU timing.
function createHarness(source, { countMath = true } = {}) {
  const stats = { hypot: 0, maps: 0, scans: 0 };
  let pixels;
  let pending;
  const math = Object.create(Math);
  math.hypot = (...args) => { stats.hypot++; return Math.hypot(...args); };
  const document = {
    documentElement: { style: { getPropertyValue: () => "" } },
    body: {},
    getElementById: () => ({ children: [] }),
    querySelectorAll: () => { stats.scans++; return []; },
    createElement: () => ({
      getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: image => { pixels = image.data; stats.maps++; }
      }),
      toDataURL: () => "data:image/png," + stats.maps
    })
  };
  const window = {
    CSS: { supports: () => true },
    addEventListener() {},
    requestAnimationFrame: callback => { pending = callback; return 1; }
  };
  const context = vm.createContext({
    window, document, CSS: window.CSS, Math: countMath ? math : Math,
    requestAnimationFrame: window.requestAnimationFrame,
    setTimeout: () => 1, clearTimeout() {}, Uint8ClampedArray
  });
  vm.runInContext(source.replace("})(window);", "window.mapProbe = { dispMap, getMap }; })(window);"), context);
  return {
    stats, glass: window.LiquidGlass, probe: window.mapProbe,
    flush() { const callback = pending; pending = null; if (callback) callback(); },
    hash: () => crypto.createHash("sha256").update(pixels).digest("hex")
  };
}

const geometries = [
  [120, 104, 18, 16, 10], [320, 180, 24, 26, 10],
  [640, 48, 16, 8, 6], [96, 96, 48, 15, 10],
  [13, 11, 3, 3, 3], [241, 137, 17.4, 12.25, 7.75],
  [1920, 1080, 32, 26, 10], [128, 128, 0, 18, 8]
];

module.exports = { createHarness, geometries };
