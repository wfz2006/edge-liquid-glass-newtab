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
    this.childNodes = [];
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
    this.childNodes.push(child);
    return child;
  }
  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") this.className = value;
  }
  getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; }
  get className() { return Array.from(this.classList.values).join(" "); }
  set className(value) {
    this.classList = new StubClassList();
    String(value || "").split(/\s+/).filter(Boolean).forEach((name) => this.classList.add(name));
  }
  addEventListener(type, listener) {
    (this.listeners[type] || (this.listeners[type] = [])).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners[type] = (this.listeners[type] || []).filter((entry) => entry !== listener);
  }
  dispatchEvent(event) {
    event = event || {};
    if (!event.type) throw new TypeError("event type is required");
    event.target = event.target || this;
    if (event.defaultPrevented !== true) event.defaultPrevented = false;
    event.preventDefault = event.preventDefault || function () { this.defaultPrevented = true; };
    event.stopPropagation = event.stopPropagation || function () { this.__propagationStopped = true; };
    const propertyHandler = this["on" + event.type];
    if (typeof propertyHandler === "function") propertyHandler.call(this, event);
    (this.listeners[event.type] || []).slice().forEach((listener) => listener.call(this, event));
    if (!event.__propagationStopped && this.parentNode) this.parentNode.dispatchEvent(event);
    return true;
  }
  click() { return this.dispatchEvent({ type: "click" }); }
  attachShadow(options) {
    const mode = options && options.mode;
    const shadow = new StubShadow(this.ownerDocument);
    this.attachShadowMode = mode;
    if (mode === "open") this.shadowRoot = shadow;
    else delete this.shadowRoot;
    if (this.ownerDocument) {
      this.ownerDocument.lastClosedShadow = shadow;
      this.ownerDocument.lastClosedShadowHost = this;
      this.ownerDocument.lastShadowMode = mode;
    }
    return shadow;
  }
  get isConnected() { return true; }
  getBoundingClientRect() { return { width: 0, height: 0 }; }
  closest() { return null; }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this.childNodes = [];
    if (this._innerHTML.indexOf('class="del"') >= 0) {
      this._del = this.ownerDocument.createElement("div");
      this._del.classList.add("del");
      this.appendChild(this._del);
    }
  }
  get innerHTML() { return this._innerHTML || ""; }
  _matches(selector) {
    if (selector === ".del") return this.classList.contains("del");
    if (selector === ".sbcard") return this.classList.contains("sbcard");
    if (selector === "[data-glass]") return this.getAttribute("data-glass") !== null;
    return false;
  }
  querySelector(selector) {
    const found = this.querySelectorAll(selector);
    return found[0] || null;
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      (node.childNodes || []).forEach((child) => {
        if (child._matches && child._matches(selector)) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }
  set textContent(value) {
    this._textContent = String(value);
    if (this._textContent === "") this.childNodes = [];
  }
  get textContent() { return this._textContent || ""; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
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
      this.appendChild(element);
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
      this.controls[".filters"].appendChild(button);
      return button;
    });
  }
  querySelector(selector) { return this.controls[selector] || super.querySelector(selector); }
  querySelectorAll(selector) { return selector === ".filter" ? this.filters : super.querySelectorAll(selector); }
}

class StubDocument extends StubElement {
  constructor() {
    super("document", null);
    this.documentElement = new StubElement("html", this);
    this.documentElement.parentNode = this;
    this.listeners = Object.create(null);
    this.title = "测试页面";
    this.appendChild = (child) => { child.parentNode = this; this.childNodes.push(child); return child; };
  }
  createElement(tagName) { return new StubElement(tagName, this); }
  createElementNS(_namespace, tagName) { return new StubElement(tagName, this); }
}

function createHarness(options = {}) {
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
  if (Object.prototype.hasOwnProperty.call(options, "contentTest")) {
    window.__LG_CONTENT_TEST__ = options.contentTest;
  }
  vm.runInNewContext(fs.readFileSync(require.resolve("../js/content.js"), "utf8"), sandbox, {
    filename: "js/content.js"
  });
  return {
    document,
    window,
    shadow: document.lastClosedShadow,
    shadowHost: document.lastClosedShadowHost,
    shadowMode: document.lastShadowMode,
    hook: document.documentElement.__lgCollect
  };
}

const openShadowDocument = new StubDocument();
const openShadowHost = openShadowDocument.createElement("div");
const openShadow = openShadowHost.attachShadow({ mode: "open" });
assert.strictEqual(openShadowHost.attachShadowMode, "open", "stub should record an open shadow request");
assert.strictEqual(openShadowHost.shadowRoot, openShadow, "open shadow roots should be exposed on the host");

const gatedOffHarness = createHarness({ contentTest: false });
assert.strictEqual(gatedOffHarness.hook.__test, undefined, "content test hook should be absent when the flag is false");
const gatedUnsetHarness = createHarness();
assert.strictEqual(gatedUnsetHarness.hook.__test, undefined, "content test hook should be absent when the flag is unset");
const harness = createHarness({ contentTest: true });
const { document, window, shadow, shadowHost, shadowMode, hook } = harness;
assert.ok(hook && hook.__test, "content test hook should be gated and available in the harness");
assert.strictEqual(shadowMode, "closed", "content should request a closed shadow root");
assert.strictEqual(shadowHost.attachShadowMode, "closed", "harness host should record the closed shadow request");
assert.strictEqual(shadowHost.shadowRoot, undefined, "closed shadow root should not be exposed on the host");
assert.ok(shadow, "harness should capture the closed shadow root without exposing it on the host");
const test = hook.__test;
function readState() {
  const state = test.state();
  ["selectedIds", "visibleIds", "sidebarIds"].forEach((key) => { state[key] = Array.from(state[key]); });
  return state;
}
function renderedCards() { return shadow.querySelectorAll(".sbcard"); }
function renderedCard(id) {
  return renderedCards().find((card) => card.getAttribute("data-id") === id);
}

hook.open();
const ordinaryCard = renderedCard("constructor");
assert.ok(ordinaryCard, "ordinary mode should render a link card into the closed shadow root");
assert.strictEqual(ordinaryCard.listeners.pointerdown.length, 1, "ordinary mode should retain the card pointer-drag path");
assert.strictEqual(ordinaryCard.querySelector(".del").listeners.click.length, 1, "ordinary mode should retain single-delete handling");
ordinaryCard.dispatchEvent({ type: "click" });
assert.strictEqual(window.location.href, "https://one.example/", "ordinary link card click should open the normal link path");

test.toggleBatch();
let card = renderedCard("constructor");
assert.ok(card, "batch mode should retain rendered link cards");
const batchStage = card.parentNode;
let bubbledBatchClick = false;
batchStage.addEventListener("click", () => { bubbledBatchClick = true; });
const batchClick = { type: "click" };
card.dispatchEvent(batchClick);
assert.strictEqual(batchClick.defaultPrevented, true, "batch card click should prevent normal link opening");
assert.strictEqual(bubbledBatchClick, false, "batch card click should stop propagation at the card");
assert.deepStrictEqual(readState().selectedIds, ["constructor"], "batch card click should select through the rendered card path");

card = renderedCard("toString");
const enter = { type: "keydown", key: "Enter" };
card.dispatchEvent(enter);
assert.strictEqual(enter.defaultPrevented, true, "Enter should prevent the normal card action in batch mode");
card = renderedCard("note-1");
const space = { type: "keydown", key: " " };
card.dispatchEvent(space);
assert.strictEqual(space.defaultPrevented, true, "Space should prevent the normal card action in batch mode");
assert.deepStrictEqual(readState().selectedIds, ["constructor", "toString", "note-1"], "Enter and Space should select through rendered card paths");

renderedCards().forEach((batchCard) => {
  const del = batchCard.querySelector(".del");
  assert.strictEqual((batchCard.listeners.pointerdown || []).length, 0, "batch cards should not register pointer-drag handlers");
  assert.strictEqual((del.listeners.click || []).length, 0, "batch cards should not register single-delete handlers");
});
const beforeBatchDeletePath = readState().sidebarIds;
renderedCard("constructor").dispatchEvent({ type: "pointerdown", pointerId: 1, pointerType: "mouse", button: 0, clientX: 1, clientY: 1 });
renderedCard("constructor").querySelector(".del").dispatchEvent({ type: "click" });
assert.deepStrictEqual(readState().sidebarIds, beforeBatchDeletePath, "batch pointer/delete events should not invoke ordinary handlers");

test.clearSelection();
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
