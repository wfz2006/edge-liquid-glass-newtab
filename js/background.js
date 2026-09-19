/* MV3 service worker: browser integrations and context-menu capture. */
(function () {
  "use strict";

  if (typeof chrome === "undefined") return;
  var KEY = "lg.newtab";
  var SYNC_KEY = "lg.newtab.sync";
  var MAX_SYNC_BYTES = 70000;
  var SYNC_CHUNK_CHARS = 1800;
  var syncWriting = false;
  var syncPending = null;

  function uid() {
    return "sb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function cleanTags(value) {
    var raw = Array.isArray(value) ? value : String(value || "").split(/[,，\n]+/);
    var seen = {};
    return raw.map(function (x) { return String(x || "").trim(); })
      .filter(function (x) {
        if (!x || seen[x]) return false;
        seen[x] = true;
        return true;
      })
      .map(function (x) { return x.slice(0, 24); })
      .slice(0, 12);
  }

  function normalizeItem(value) {
    var x = value && typeof value === "object" ? value : {};
    var type = x.type === "image" || x.type === "text" ? x.type : "link";
    return {
      id: typeof x.id === "string" && x.id ? x.id : uid(),
      type: type,
      title: typeof x.title === "string" ? x.title.slice(0, 120) : "",
      url: typeof x.url === "string" ? x.url : "",
      src: typeof x.src === "string" ? x.src : "",
      text: typeof x.text === "string" ? x.text.slice(0, 2000) : "",
      tags: cleanTags(x.tags),
      x: typeof x.x === "number" && isFinite(x.x) ? x.x : 10,
      y: typeof x.y === "number" && isFinite(x.y) ? x.y : 10
    };
  }

  function canonical(url) {
    var value = String(url || "").trim();
    if (!value) return "";
    try {
      var u = new URL(value);
      u.hash = "";
      if ((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) u.port = "";
      u.pathname = u.pathname.replace(/\/+$/, "") || "/";
      return u.toString().toLowerCase();
    } catch (e) {
      return value.replace(/\/+$/, "").toLowerCase();
    }
  }

  function hasLink(items, url) {
    var target = canonical(url);
    return !!target && items.some(function (x) {
      return x && x.type === "link" && canonical(x.url) === target;
    });
  }

  function addSidebarItem(item, callback) {
    chrome.storage.local.get(KEY, function (box) {
      var state = box && box[KEY] && typeof box[KEY] === "object" ? box[KEY] : {};
      var items = Array.isArray(state.sidebar) ? state.sidebar.slice(0, 200).map(normalizeItem) : [];
      var next = normalizeItem(item);
      if (next.type === "link" && hasLink(items, next.url)) {
        if (callback) callback(false);
        return;
      }
      var bottom = 10;
      items.forEach(function (x) { bottom = Math.max(bottom, (x.y || 0) + 110); });
      next.x = 10;
      next.y = bottom;
      items.push(next);
      state.sidebar = items;
      state.updatedAt = Date.now();
      var payload = {};
      payload[KEY] = state;
      chrome.storage.local.set(payload, function () {
        if (callback) callback(true);
      });
    });
  }

  function compactForSync(state) {
    var copy;
    try { copy = JSON.parse(JSON.stringify(state || {})); } catch (e) { return null; }
    if (copy.syncEnabled === false) return null;
    if (copy.wall) copy.wall.fileData = "";
    if (Array.isArray(copy.sidebar)) {
      copy.sidebar = copy.sidebar.map(function (x) {
        if (!x || x.type !== "image" || !/^data:image\//i.test(x.src || "")) return x;
        var y = {};
        Object.keys(x).forEach(function (k) { if (k !== "src") y[k] = x[k]; });
        return y;
      });
    }
    var raw;
    try { raw = JSON.stringify(copy); } catch (e2) { return null; }
    if (syncBytes(raw) > MAX_SYNC_BYTES) {
      copy.sidebar = [];
      try { raw = JSON.stringify(copy); } catch (e3) { return null; }
    }
    return syncBytes(raw) <= MAX_SYNC_BYTES ? copy : null;
  }

  function syncBytes(value) {
    try { return typeof TextEncoder === "function" ? new TextEncoder().encode(String(value)).length : unescape(encodeURIComponent(String(value))).length; }
    catch (e) { return String(value || "").length * 3; }
  }

  function syncLocalState(state) {
    if (!chrome.storage || !chrome.storage.sync || !state) return;
    if (state.syncEnabled === false) {
      syncPending = null;
      return;
    }
    syncPending = state;
    if (syncWriting) return;

    syncWriting = true;
    function finish() {
      if (syncPending) flush();
      else syncWriting = false;
    }
    function flush() {
      var next = syncPending;
      syncPending = null;
      if (!next || next.syncEnabled === false) {
        syncWriting = false;
        return;
      }
      var compact = compactForSync(next);
      if (!compact) { finish(); return; }
      var raw;
      try { raw = JSON.stringify(compact); } catch (e) { finish(); return; }
      if (syncBytes(raw) > MAX_SYNC_BYTES) { finish(); return; }
      var chunks = [], i;
      for (i = 0; i < raw.length; i += SYNC_CHUNK_CHARS) chunks.push(raw.slice(i, i + SYNC_CHUNK_CHARS));
      var updatedAt = Number(next.updatedAt) || 0;
      var query = {}; query[SYNC_KEY] = null;
      chrome.storage.sync.get(query, function (box) {
        var old = box && box[SYNC_KEY];
        if (old && Number(old.updatedAt) >= updatedAt) { finish(); return; }
        var payload = {}; payload[SYNC_KEY] = { version: 2, updatedAt: updatedAt || Date.now(), count: chunks.length };
        chunks.forEach(function (chunk, index) { payload[SYNC_KEY + "." + index] = chunk; });
        chrome.storage.sync.set(payload, function () {
          var oldCount = old && Number(old.count) || 0;
          if (oldCount > chunks.length) {
            var stale = [];
            for (var si = chunks.length; si < oldCount; si++) stale.push(SYNC_KEY + "." + si);
            chrome.storage.sync.remove(stale, finish);
          } else finish();
        });
      });
    }
    flush();
  }

  function createMenus() {
    if (!chrome.contextMenus) return;
    chrome.contextMenus.removeAll(function () {
      chrome.contextMenus.create({ id: "lg-page", title: "收藏当前网页到收集板", contexts: ["page"] });
      chrome.contextMenus.create({ id: "lg-link", title: "收藏链接到收集板", contexts: ["link"] });
      chrome.contextMenus.create({ id: "lg-image", title: "收藏图片到收集板", contexts: ["image"] });
      chrome.contextMenus.create({ id: "lg-selection", title: "收藏选中文本到收集板", contexts: ["selection"] });
      chrome.contextMenus.create({ id: "lg-bookmark", title: "在新标签页打开收藏板", contexts: ["page", "link", "image", "selection"] });
    });
  }

  if (chrome.runtime && chrome.runtime.onInstalled) chrome.runtime.onInstalled.addListener(createMenus);
  if (chrome.runtime && chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(createMenus);

  if (chrome.contextMenus && chrome.contextMenus.onClicked) {
    chrome.contextMenus.onClicked.addListener(function (info, tab) {
      var title = (tab && tab.title) || "网页收藏";
      var item = null;
      if (info.menuItemId === "lg-page") {
        item = { type: "link", url: info.pageUrl || (tab && tab.url) || "", title: title };
      } else if (info.menuItemId === "lg-link") {
        item = { type: "link", url: info.linkUrl || "", title: info.selectionText || "" };
      } else if (info.menuItemId === "lg-image") {
        item = { type: "image", src: info.srcUrl || "", url: info.pageUrl || "", title: title };
      } else if (info.menuItemId === "lg-selection") {
        item = { type: "text", text: info.selectionText || "", title: title };
      } else if (info.menuItemId === "lg-bookmark") {
        chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
        return;
      }
      if (item && (item.url || item.src || item.text)) addSidebarItem(item);
    });
  }
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local" || !changes || !changes[KEY] || !changes[KEY].newValue) return;
      syncLocalState(changes[KEY].newValue);
    });
  }
})();
