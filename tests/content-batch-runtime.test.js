"use strict";

const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const core = require("../js/collection-board-core.js");

class StubClassList {
  constructor() { this.values = new Set(); }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  toggle(name, force) {
    const next = force === undefined ? !this.values.has(name) : !!force;
    if (next) this.values.add(name); else this.values.delete(name);
    return next;
  }
  contains(name) { return this.values.has(name); }
}

class StubElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.attributes = Object.create(null);
    this.listeners = Object.create(null);
    this.classList = new StubClassList();
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.textContent = "";
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.clientWidth = 760;
    this.scrollHeight = 760;
    this.offsetHeight = 0;
    this.offsetWidth = 120;
  }

  appendChild(child) {
    child.parentNode = this;
    return child;
  }

  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  addEventListener(type, listener) {
    (this.listeners[type] || (this.listeners[type] = [])).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners[type] = (this.listeners[type] || []).filter((entry) => entry !== listener);
  }
  dispatchEvent(event) {
    event.target = event.target || this;
    (this.listeners[event.type] || []).slice().forEach((listener) => listener.call(this, event));
    return true;
  }
  click() { this.dispatchEvent({ type: "click" }); }
  attachShadow() { return new StubShadow(this.ownerDocument); }
  get isConnected() { return true; }
  getBoundingClientRect() { return { width: 0, height: 0 }; }
  closest() { return null; }

  set innerHTML(value) {
    this._innerHTML = String(value);
    if (this._innerHTML.indexOf('class="del"') >= 0) {
      this._del = this.ownerDocument.createElement("div");
      this._del.classList.add("del");
    }
  }
  get innerHTML() { return this._innerHTML || ""; }
  querySelector(selector) { return selector === ".del" ? this._del || null : null; }
  querySelectorAll() { return []; }
}

class StubShadow extends StubElement {
  constructor(ownerDocument) { super("shadow-root", ownerDocument); this.controls = Object.create(null); }

  set innerHTML(value) {
    this._innerHTML = String(value);
    const add = (tag, className, attrs = {}) => {
      const element = this.ownerDocument.createElement(tag);
      if (className) className.split(/\s+/).forEach((name) => element.classList.add(name));
      Object.keys(attrs).forEach((name) => element.setAttribute(name, attrs[name]));
      if (className) className.split(/\s+/).forEach((name) => { if (name) this.controls["." + name] = element; });
      return element;
    };
    add("svg", "glass-defs");
    add("div", "zone");
    add("aside", "sbar");
    add("div", "sbRefr", { "data-glass": "", "aria-hidden": "true" });
    ["ttl", "meta", "head", "organize", "batch-toggle", "current", "tools", "search", "filters", "batch-tools", "batch-count", "select-all", "clear-selection", "delete-selected", "canvas", "notice", "notice-text", "notice-undo", "hint"].forEach((name) => add(name === "search" ? "input" : name.indexOf("button") >= 0 ? "button" : "div", name));
    this.controls[".batch-toggle"].setAttribute("aria-pressed", "false");
    this.controls[".notice"].setAttribute("role", "status");
    this.controls[".notice"].setAttribute("aria-live", "polite");
    this.controls[".filter"] = this.ownerDocument.createElement("button");
    this.controls[".filter"].setAttribute("data-filter", "all");
    this.filters = ["all", "link", "image", "text"].map((type) => {
      const button = this.ownerDocument.createElement("button");
      button.classList.add("filter");
      button.setAttribute("data-filter", type);
      return button;
    });
  }
  querySelector(selector) { return this.controls[selector] || null; }
  querySelectorAll(selector) { return selector === ".filter" ? this.filters : []; }
}

class StubDocument extends StubElement {
  constructor() {
    super("document", null);
    this.documentElement = new StubElement("html", this);
    this.documentElement.parentNode = this;
    this.listeners = Object.create(null);
    this.title = "测试页面";
    this.appendChild = (child) => { child.parentNode = this; return child; };
  }
  createElement(tagName) { return new StubElement(tagName, this); }
  createElementNS(_namespace, tagName) { return new StubElement(tagName, this); }
}

function createHarness() {
  const document = new StubDocument();
  const window = {
    top: null,
    document,
    location: { href: "https://example.test/page", hostname: "example.test", protocol: "https:" },
    CSS: { supports: () => false },
    LGCollection: core,
    LGDragSpring: { release() {}, step() { return 0; }, atRest() { return true; } },
    confirm: () => true,
    open() {},
    addEventListener() {},
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {}
  };
  window.top = window;
  const stored = {
    sidebar: [
      { id: "constructor", type: "link", title: "构造器", url: "https://one.example/" },
      { id: "toString", type: "link", title: "字符串", url: "https://two.example/" },
      { id: "note-1", type: "text", title: "备注", text: "保留" }
    ],
    openInNew: false
  };
  const storage = {
    local: {
      get(_key, callback) { callback({ "lg.newtab": stored }); },
      set(value) { stored.sidebar = value["lg.newtab"].sidebar; }
    },
    onChanged: { addListener() {} }
  };
  const sandbox = {
    window,
    document,
    chrome: { storage },
    location: window.location,
    URL,
    getComputedStyle() { return { borderTopLeftRadius: "0px" }; },
    setTimeout,
    clearTimeout,
    console
  };
  window.chrome = sandbox.chrome;
  window.__LG_CONTENT_TEST__ = true;
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/content.js"), "utf8"), sandbox, {
    filename: "js/content.js"
  });
  return { document, hook: document.documentElement.__lgCollect };
}

const { document, hook } = createHarness();
assert.ok(hook && hook.__test, "content test hook should be gated and available in the harness");
const test = hook.__test;
function readState() {
  const state = test.state();
  ["selectedIds", "visibleIds", "sidebarIds"].forEach((key) => { state[key] = Array.from(state[key]); });
  return state;
}

hook.open();
test.toggleBatch();
test.toggleSelected("constructor");
assert.deepStrictEqual(readState().selectedIds, ["constructor"], "batch selection should toggle through content functions");
test.toggleSelected("constructor");
assert.deepStrictEqual(readState().selectedIds, [], "toggling a selected card should clear it");
test.toggleSelected("constructor");
assert.strictEqual(readState().deleteDisabled, false);

document.dispatchEvent({ type: "keydown", key: "Escape" });
assert.strictEqual(readState().batchMode, false, "Escape should leave webpage batch mode");
assert.deepStrictEqual(readState().selectedIds, [], "Escape should clear webpage batch selection");
assert.strictEqual(hook.isOpen(), true, "batch Escape should return before ordinary closeBar behavior");

document.dispatchEvent({ type: "keydown", key: "Escape" });
assert.strictEqual(hook.isOpen(), false, "Escape outside batch mode should still close the webpage bar");

test.toggleBatch();
test.setFilter("link");
test.selectVisible();
let state = readState();
assert.deepStrictEqual(state.visibleIds, ["constructor", "toString"]);
assert.deepStrictEqual(state.selectedIds, ["constructor", "toString"], "select-all should select only visible link items");
assert.strictEqual(state.selectAllDisabled, false);

test.setFilter("image");
state = readState();
assert.deepStrictEqual(state.visibleIds, []);
assert.strictEqual(state.selectAllDisabled, true, "select-all should disable when no items are visible");

test.setFilter("all");
test.deleteSelected();
state = readState();
assert.deepStrictEqual(state.sidebarIds, ["note-1"], "delete should use the content-side CORE removal path");
assert.strictEqual(state.undoAvailable, true);

test.undoDelete();
state = readState();
assert.deepStrictEqual(state.sidebarIds, ["constructor", "toString", "note-1"], "undo should restore deleted items and order");
assert.strictEqual(state.undoAvailable, false);

console.log("content-batch-runtime: Escape, selection, visible-only select-all, delete, and undo passed");
