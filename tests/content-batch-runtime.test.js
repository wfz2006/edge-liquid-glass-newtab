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
  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
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
  contains(node) {
    for (let current = node; current; current = current.parentNode) if (current === this) return true;
    return false;
  }

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
    ["ttl", "meta", "head", "organize", "batch-toggle", "current", "more-toggle", "more-menu", "tools", "search", "filter-toggle", "filter-count", "filter-panel", "filter-clear", "filters", "batch-tools", "batch-count", "select-all", "clear-selection", "delete-selected", "canvas", "notice", "notice-text", "notice-undo", "hint"].forEach((name) => add(name === "search" ? "input" : "div", name));
    ["more-menu", "filter-panel", "filter-count"].forEach((name) => { this.controls["." + name].hidden = true; });
    this.controls[".batch-toggle"].setAttribute("aria-pressed", "false");
    this.controls[".notice"].setAttribute("role", "status");
    this.controls[".notice"].setAttribute("aria-live", "polite");
    this.controls[".filter"] = this.ownerDocument.createElement("button");
    this.controls[".filter"].setAttribute("data-filter", "all");
    this.filters = ["all", "link", "image", "text"].map((type) => {
      const button = this.ownerDocument.createElement("button");
      button.classList.add("filter");
      if (type === "all") button.classList.add("on");
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
  const runtime = { lastError: null };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  let getCalls = 0, setCalls = 0;
  const storage = {
    local: {
      get(_key, callback) {
        const getCall = getCalls++;
        if (typeof options.beforeGet === "function") options.beforeGet(stored, getCall);
        const snapshot = clone(stored);
        callback({ "lg.newtab": snapshot });
      },
      set(value, callback) {
        if (options.failNextSet) {
          const error = options.failNextSet;
          options.failNextSet = null;
          runtime.lastError = { message: error.message || String(error) };
          if (callback) callback();
          runtime.lastError = null;
          return;
        }
        Object.assign(stored, clone(value["lg.newtab"]));
        const call = setCalls++;
        if (typeof options.afterSet === "function") options.afterSet(stored, call);
        if (callback) callback();
      }
    },
    onChanged: { addListener() {} }
  };
  const sandbox = {
    window,
    document,
    chrome: { storage, runtime },
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
    hook: document.documentElement.__lgCollect,
    storageState: stored,
    storage,
    runtime
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

let clonedSnapshot;
harness.storage.local.get("lg.newtab", (box) => { clonedSnapshot = box["lg.newtab"]; });
clonedSnapshot.sidebar[0].title = "只改读取快照";
let rereadSnapshot;
harness.storage.local.get("lg.newtab", (box) => { rereadSnapshot = box["lg.newtab"]; });
assert.strictEqual(rereadSnapshot.sidebar[0].title, "构造器", "storage.get should return cloned snapshots");

hook.open();
const filterToggle = shadow.querySelector(".filter-toggle");
const filterPanel = shadow.querySelector(".filter-panel");
const filterCount = shadow.querySelector(".filter-count");
filterToggle.click();
assert.strictEqual(filterPanel.hidden, false, "filter panel should open over the board");
shadow.filters[1].click();
assert.strictEqual(filterCount.textContent, "1", "active filters should be visible from the compact toolbar");
assert.deepStrictEqual(readState().visibleIds, ["constructor", "toString"], "popup filter should still filter cards");
shadow.querySelector(".filter-clear").click();
assert.strictEqual(filterCount.hidden, true, "clearing filters should remove the active indicator");
assert.strictEqual(readState().visibleIds.length, 3, "clearing filters should restore all cards");
const moreToggle = shadow.querySelector(".more-toggle");
moreToggle.click();
assert.strictEqual(shadow.querySelector(".more-menu").hidden, false, "more menu should open");
document.dispatchEvent({ type: "keydown", key: "Escape" });
assert.strictEqual(shadow.querySelector(".more-menu").hidden, true, "Escape should dismiss the menu first");
assert.strictEqual(hook.isOpen(), true, "dismissing the menu should keep the board open");
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
assert.strictEqual(document.activeElement.getAttribute("data-id"), "constructor", "batch card click should restore focus by stable id");

card = renderedCard("toString");
const enter = { type: "keydown", key: "Enter" };
card.dispatchEvent(enter);
assert.strictEqual(enter.defaultPrevented, true, "Enter should prevent the normal card action in batch mode");
assert.strictEqual(document.activeElement.getAttribute("data-id"), "toString", "Enter should restore focus by stable id");
card = renderedCard("note-1");
const space = { type: "keydown", key: " " };
card.dispatchEvent(space);
assert.strictEqual(space.defaultPrevented, true, "Space should prevent the normal card action in batch mode");
assert.strictEqual(document.activeElement.getAttribute("data-id"), "note-1", "Space should restore focus by stable id");
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
const latestBeforeDelete = harness.storageState;
latestBeforeDelete.extraState = { keep: true };
latestBeforeDelete.sidebar.push({ id: "added-before-delete", type: "text", title: "抢先新增", text: "删除前另一端新增" });
test.deleteSelected();
state = readState();
assert.deepStrictEqual(state.sidebarIds, ["note-1", "added-before-delete"], "delete should apply selected ids to the latest sidebar");
assert.strictEqual(state.undoAvailable, true);

const latest = harness.storageState;
latest.sidebar[0].title = "edited elsewhere";
latest.sidebar[0].text = "另一端编辑";
latest.sidebar.push({ id: "added-elsewhere", type: "text", title: "新增", text: "另一端新增" });
test.undoDelete();
state = readState();
assert.deepStrictEqual(state.sidebarIds, ["constructor", "toString", "note-1", "added-before-delete", "added-elsewhere"], "undo should merge against latest sidebar without losing unrelated items");
assert.strictEqual(state.undoAvailable, false);
assert.strictEqual(harness.storageState.extraState.keep, true, "batch mutation should preserve unrelated latest state fields");
assert.strictEqual(harness.storageState.sidebar.find((item) => item.id === "note-1").title, "edited elsewhere", "undo should not overwrite an edit made by the other surface");

const conflictHarness = createHarness({
  contentTest: true,
  beforeGet: (storedState, call) => {
    if (call === 1) {
      storedState.concurrentTopLevel = { keep: true };
      storedState.sidebar.push({ id: "between-reads", type: "text", title: "两次读取之间新增", text: "保留" });
    }
  }
});
const conflictTest = conflictHarness.hook.__test;
conflictTest.toggleBatch();
conflictTest.toggleSelected("constructor");
conflictTest.deleteSelected();
assert.deepStrictEqual(Array.from(conflictTest.state().sidebarIds), ["toString", "note-1", "between-reads"], "retry should reapply deletion to the latest sidebar");
assert.deepStrictEqual(conflictHarness.storageState.concurrentTopLevel, { keep: true }, "retry should preserve a top-level write between reads");

const failedHarness = createHarness({ contentTest: true });
const failedTest = failedHarness.hook.__test;
failedTest.toggleBatch();
failedTest.toggleSelected("constructor");
failedHarness.storage.local.set = function (_value, callback) {
  failedHarness.runtime.lastError = { message: "模拟写入失败" };
  if (callback) callback();
  failedHarness.runtime.lastError = null;
};
failedTest.deleteSelected();
assert.ok(failedTest.state().sidebarIds.includes("constructor"), "set error should leave the persisted authoritative item visible");
assert.strictEqual(failedTest.state().undoAvailable, false, "set error should not create an undo success state");
assert.match(failedHarness.shadow.querySelector(".notice-text").textContent, /删除失败/, "set error should show a failure notice");

const failedGetHarness = createHarness({ contentTest: true });
const failedGetTest = failedGetHarness.hook.__test;
failedGetTest.toggleBatch();
failedGetTest.toggleSelected("constructor");
failedGetHarness.storage.local.get = function (_key, callback) {
  failedGetHarness.runtime.lastError = { message: "模拟读取失败" };
  if (callback) callback({});
  failedGetHarness.runtime.lastError = null;
};
failedGetTest.deleteSelected();
assert.ok(failedGetTest.state().sidebarIds.includes("constructor"), "get error should leave the local authoritative view unchanged");
assert.match(failedGetHarness.shadow.querySelector(".notice-text").textContent, /删除失败/, "get error should show a failure notice");

console.log("content-batch-runtime: Escape, selection, latest-state delete/undo, focus, and visible-only select-all passed");
