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
    getSyncRaw() {
      const meta = sync[SYNC_KEY];
      if (!meta || !meta.count) return "";
      let raw = "";
      for (let i = 0; i < meta.count; i += 1) raw += String(sync[`${SYNC_KEY}.${i}`] || "");
      return raw;
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

test("context-menu capture preserves existing stack order and places the new card on top", () => {
  const harness = createHarness({
    sidebar: [{
      id: "existing",
      type: "link",
      title: "Existing",
      url: "https://example.com/docs",
      tags: [],
      x: 10,
      y: 10,
      z: 7
    }]
  });

  harness.clickContextMenu(
    { menuItemId: "lg-page", pageUrl: "https://example.org/new" },
    { title: "New", url: "https://example.org/new" }
  );

  const items = harness.getLocal().sidebar;
  assert.strictEqual(items[0].z, 7);
  assert.strictEqual(items[1].z, 8);
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

test("oversized sync snapshots do not publish an empty sidebar", () => {
  const harness = createHarness({ sidebar: [] });
  const sidebar = Array.from({ length: 200 }, (_, index) => ({
    id: `text-${index}`,
    type: "text",
    title: `Large note ${index}`,
    text: "x".repeat(2000),
    tags: [],
    x: 10,
    y: index * 100,
    z: index
  }));

  harness.changeLocal({ syncEnabled: true, updatedAt: 3, sidebar });

  assert.strictEqual(harness.getSyncWriteCount(), 0);
});

test("wallpaper library dataURLs are stripped from sync snapshots but entries survive", () => {
  const harness = createHarness({ sidebar: [] });
  harness.changeLocal({
    syncEnabled: true,
    updatedAt: 5,
    sidebar: [],
    wall: {
      fileData: "data:image/png;base64,BBB",
      library: [
        { id: "w1", kind: "image", url: "", data: "data:image/png;base64,AAA", name: "本地", addedAt: 1 },
        { id: "w2", kind: "url", url: "https://example.com/a.jpg", data: "", name: "远端", addedAt: 2 }
      ]
    }
  });
  harness.flushSync();

  const raw = harness.getSyncRaw();
  assert.ok(raw, "expected a sync snapshot to be written");
  const state = JSON.parse(raw);
  assert.strictEqual(state.wall.fileData, "");
  assert.strictEqual(state.wall.library.length, 2);
  assert.ok(!("data" in state.wall.library[0]), "local image bytes must not enter sync storage");
  assert.strictEqual(state.wall.library[0].id, "w1");
  assert.strictEqual(state.wall.library[1].url, "https://example.com/a.jpg");
});
