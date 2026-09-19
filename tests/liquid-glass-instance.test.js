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
    style: {},
    attrs: {},
    getBoundingClientRect() { return { width: 120, height: 96 }; },
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

const window = {
  document,
  CSS: { supports() { return true; } },
  requestAnimationFrame() { return 1; },
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

console.log("liquid-glass-instance: 5 assertions passed");
