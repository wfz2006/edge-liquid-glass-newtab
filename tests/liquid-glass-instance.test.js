"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function svgNode(name) {
  const node = {
    nodeName: name,
    attrs: {},
    children: [],
    parentNode: null,
    setAttribute(key, value) { this.attrs[key] = String(value); },
    setAttributeNS(ns, key, value) { this.setAttribute(key, value); },
    getAttribute(key) { return this.attrs[key] || null; },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter(x => x !== child); child.parentNode = null; }
  };
  Object.defineProperty(node, "firstChild", { get() { return this.children[0] || null; } });
  return node;
}

function glassElement() {
  return {
    isConnected: true,
    width: 120, height: 96, scale: 1,
    style: {},
    attrs: {},
    get offsetWidth() { this.reads = (this.reads || 0) + 1; return this.width; },
    get offsetHeight() { return this.height; },
    getBoundingClientRect() { this.reads = (this.reads || 0) + 1; return { width: this.width * this.scale, height: this.height * this.scale }; },
    getAttribute(key) { return this.attrs[key] || null; }
  };
}

const defs = svgNode("svg");
defs.id = "glass-defs";
const first = glassElement();
const second = glassElement();

function findById(node, id) {
  if (node.attrs && node.attrs.id === id) return node;
  for (const child of node.children || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

const document = {
  documentElement: { style: { getPropertyValue() { return ""; }, setProperty() {} } },
  body: {},
  fonts: null,
  getElementById(id) { return id === "glass-defs" ? defs : findById(defs, id); },
  querySelectorAll(selector) { return selector === "[data-glass]" ? [first, second] : []; },
  createElement(name) {
    if (name !== "canvas") return svgNode(name);
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
          putImageData() {}
        };
      },
      toDataURL() { return "data:image/png;base64,map"; }
    };
  },
  createElementNS(ns, name) { return svgNode(name); }
};

let pendingFrame;
const window = {
  document,
  CSS: { supports() { return true; } },
  requestAnimationFrame(callback) { pendingFrame = callback; return 1; },
  addEventListener() {}
};
const context = {
  window,
  document,
  CSS: window.CSS,
  requestAnimationFrame: window.requestAnimationFrame,
  setTimeout() { return 1; },
  clearTimeout() {},
  getComputedStyle() { return { borderTopLeftRadius: "18px" }; },
  Uint8ClampedArray,
  Math
};

const source = fs.readFileSync(require.resolve("../js/liquid-glass.js"), "utf8");
vm.runInNewContext(source, context, { filename: "js/liquid-glass.js" });
window.LiquidGlass.init();

assert.ok(first.__lgId, "first glass element must receive a filter id");
assert.ok(second.__lgId, "second glass element must receive a filter id");
assert.notStrictEqual(
  first.__lgId,
  second.__lgId,
  "same-size glass elements must not share an SVG filter instance"
);
assert.strictEqual(defs.children.length, 2, "one filter node must exist per glass element");

const contentSource = fs.readFileSync(require.resolve("../js/content.js"), "utf8");
assert.ok(!contentSource.includes("id = cache[ck]"), "content-script glass must not share filter instances by geometry");

/* 贴图必须使用生成时的卡片局部像素尺寸。百分比会按 SVG 视口解析，
   不能用“和 filter 同为 100%”来证明它覆盖了卡片。 */
function findChild(node, result) {
  return (node.children || []).filter((child) => child.attrs && child.attrs.result === result)[0] || null;
}
for (const el of [first, second]) {
  const node = findById(defs, el.__lgId);
  assert.ok(node, "filter node must exist in defs");
  const map = findChild(node, "map");
  assert.strictEqual(map.attrs.x, "0", "map origin must be local to the card");
  assert.strictEqual(map.attrs.y, "0", "map origin must be local to the card");
  assert.strictEqual(map.attrs.width, "120", "map width must match the generated card geometry");
  assert.strictEqual(map.attrs.height, "96", "map height must match the generated card geometry");
  assert.strictEqual(node.attrs.primitiveUnits, "userSpaceOnUse", "displacement and map must use the same pixel units");
  const dm = findChild(node, "dR");
  assert.ok(dm, "displacement primitive must exist");
  /* stub 元素短边 96px：不限幅时 scale 会冲到 42；封顶 10px 位移后 scale 应为 20 */
  assert.ok(Number(dm.attrs.scale) <= 20, `displacement scale must be capped, got ${dm.attrs.scale}`);
}
assert.ok(contentSource.includes('"-25%"'), "content-script glass must use the expanded filter region");
assert.ok(contentSource.includes("Math.min(10, short"), "content-script glass displacement must be capped");

/* 菜单打开时祖先从 scale(.98) 过渡到 1，贴图始终覆盖未变换的局部边界。 */
const unscaledId = first.__lgId;
first.scale = 0.98;
window.LiquidGlass.refresh();
pendingFrame();
assert.strictEqual(findById(defs, first.__lgId).firstChild.attrs.width, "120", "opening animation must not shrink the refraction map");
assert.strictEqual(findById(defs, first.__lgId).firstChild.attrs.height, "96", "opening animation must not shrink map height");
assert.strictEqual(first.__lgId, unscaledId, "ancestor transforms must not rebuild local geometry");

/* 拖动通道必须在第一帧前切换完成，只测量移动的元素。 */
const siblingReads = second.reads;
const siblingId = second.__lgId;
window.LiquidGlass.lite([first], true);
assert.strictEqual(first.__lgLite, true, "lite mode must flag the element during interaction");
assert.strictEqual(findById(defs, first.__lgId).children.filter(n => n.nodeName === "feDisplacementMap").length, 1, "moving glass immediately uses one real refraction pass");
assert.strictEqual(second.reads, siblingReads, "switching the active glass must not measure siblings");
assert.strictEqual(second.__lgId, siblingId, "sibling filters stay intact");
const activeReads = first.reads;
window.LiquidGlass.lite([first], true);
assert.strictEqual(first.reads, activeReads, "repeating the same mode does no work");
assert.strictEqual(findById(defs, first.__lgId).firstChild.attrs.width, "120", "lite map uses the same local bounds");
window.LiquidGlass.lite([first], false);
first.scale = 1;
assert.strictEqual(first.__lgLite, false, "lite mode must clear when the interaction ends");
assert.strictEqual(findById(defs, first.__lgId).children.filter(n => n.nodeName === "feDisplacementMap").length, 3, "full chromatic refraction returns after dragging");
first.width = 144;
first.height = 104;
window.LiquidGlass.refresh();
pendingFrame();
assert.strictEqual(findById(defs, first.__lgId).firstChild.attrs.width, "144", "resizing must resize the map bounds");
assert.strictEqual(findById(defs, first.__lgId).firstChild.attrs.height, "104");
assert.strictEqual(findById(defs, second.__lgId).firstChild.attrs.width, "120", "resizing must leave sibling maps unchanged");

console.log("liquid-glass-instance: ownership, local map bounds, lite and resize checks passed");
