"use strict";

const assert = require("assert");
const fs = require("fs");
const { test } = require("node:test");
const vm = require("vm");

const source = fs.readFileSync(require.resolve("../js/background.js"), "utf8");
const KEY = "lg.newtab";
const SYNC_KEY = "lg.newtab.sync";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createHarness(localState) {
  let local = clone(localState || {});
  let sync = {};
  let syncChanged;
  let contextMenuClick;
  const syncSets = [];

  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      getURL(path) { return `chrome-extension://test/${path}`; }
    },
    contextMenus: {
      removeAll(callback) { if (callback) callback(); },
      create() {},
      onClicked: { addListener(callback) { contextMenuClick = callback; } }
    },
    storage: {
      local: {
        get(key, callback) {
          const result = {};
          result[key] = clone(local);
          callback(result);
        },
        set(payload, callback) {
          if (payload && payload[KEY]) local = clone(payload[KEY]);
          if (callback) callback();
        }
      },
      sync: {
        get(query, callback) {
          callback(clone(sync));
        },
        set(payload, callback) {
          syncSets.push({ payload: clone(payload), callback });
        },
        remove(keys, callback) {
          keys.forEach((key) => delete sync[key]);
          if (callback) callback();
        }
      },
      onChanged: { addListener(callback) { syncChanged = callback; } }
    },
    tabs: { create() {} }
  };

  vm.runInNewContext(source, {
    chrome,
    URL,
    TextEncoder,
    Date,
    Math,
    isFinite,
    unescape,
    encodeURIComponent,
    console
  });

  return {
    clickContextMenu(info, tab) {
      assert.ok(contextMenuClick, "background context-menu listener was not registered");
      contextMenuClick(info, tab);
    },
    changeLocal(next) {
      assert.ok(syncChanged, "background storage listener was not registered");
      syncChanged({ [KEY]: { newValue: clone(next) } }, "local");
    },
    flushSync() {
      for (let i = 0; i < syncSets.length; i += 1) {
        const pending = syncSets[i];
        Object.assign(sync, clone(pending.payload));
        if (pending.callback) pending.callback();
      }
    },
    getLocal() {
      return clone(local);
    },
    getSyncMeta() {
      return clone(sync[SYNC_KEY]);
    },
    getSyncWriteCount() {
      return syncSets.length;
    }
  };
}

test("context-menu links use the same trailing-slash canonicalization as the app", () => {
  const harness = createHarness({
    sidebar: [{
      id: "existing",
      type: "link",
      title: "Existing",
      url: "https://example.com/docs///",
      tags: [],
      x: 10,
      y: 10
    }]
  });

  harness.clickContextMenu(
    { menuItemId: "lg-page", pageUrl: "https://example.com/docs/" },
    { title: "Docs", url: "https://example.com/docs/" }
  );

  assert.strictEqual(harness.getLocal().sidebar.length, 1);
});

test("sync writes flush the newest local state that arrived during an in-flight write", () => {
  const harness = createHarness({ sidebar: [] });
  const first = { syncEnabled: true, updatedAt: 1, sidebar: [] };
  const second = { syncEnabled: true, updatedAt: 2, sidebar: [{ id: "new" }] };

  harness.changeLocal(first);
  harness.changeLocal(second);
  harness.flushSync();

  assert.strictEqual(harness.getSyncWriteCount(), 2);
  assert.strictEqual(harness.getSyncMeta().updatedAt, 2);
});
