/* Shared collection-board data helpers for the new-tab page and content script. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LGCollection = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

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

  function normalizeItem(value, fallbackId) {
    var x = value && typeof value === "object" ? value : {};
    var type = (x.type === "image" || x.type === "text") ? x.type : "link";
    var z = typeof x.z === "number" && isFinite(x.z) ? Math.max(0, Math.floor(x.z)) : 0;
    return {
      id: (typeof x.id === "string" && x.id) ? x.id : (fallbackId || "sb" + Date.now().toString(36)),
      type: type,
      title: typeof x.title === "string" ? x.title.slice(0, 120) : "",
      url: typeof x.url === "string" ? x.url : "",
      src: typeof x.src === "string" ? x.src : "",
      text: typeof x.text === "string" ? x.text.slice(0, 2000) : "",
      tags: cleanTags(x.tags),
      x: (typeof x.x === "number" && isFinite(x.x)) ? x.x : 10,
      y: (typeof x.y === "number" && isFinite(x.y)) ? x.y : 10,
      z: z
    };
  }

  function nextStack(items) {
    var max = 0;
    (items || []).forEach(function (item) {
      var z = item && typeof item.z === "number" && isFinite(item.z) ? item.z : 0;
      if (z > max) max = z;
    });
    return max + 1;
  }

  function bringToFront(items, item) {
    if (!item) return 0;
    item.z = nextStack(items);
    return item.z;
  }

  function searchText(item) {
    var x = normalizeItem(item, "search");
    return [x.title, x.url, x.text].concat(x.tags).join(" ").toLocaleLowerCase();
  }

  function matches(item, query, type) {
    var wantedType = type || "all";
    if (wantedType !== "all" && item.type !== wantedType) return false;
    var q = String(query || "").trim().toLocaleLowerCase();
    return !q || searchText(item).indexOf(q) >= 0;
  }

  function canonicalLink(url) {
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

  function sameLink(a, b) {
    return !!a && !!b && a.type === "link" && b.type === "link" &&
      !!canonicalLink(a.url) && canonicalLink(a.url) === canonicalLink(b.url);
  }

  function captureScroll(view) {
    return {
      top: view && typeof view.scrollTop === "number" ? view.scrollTop : 0,
      left: view && typeof view.scrollLeft === "number" ? view.scrollLeft : 0
    };
  }

  function restoreScroll(view, state) {
    if (!view || !state) return;
    view.scrollTop = state.top || 0;
    view.scrollLeft = state.left || 0;
  }

  function organizePositions(items, options) {
    var opts = options || {};
    var x = typeof opts.x === "number" ? opts.x : 10;
    var y = typeof opts.y === "number" ? opts.y : 10;
    var gap = typeof opts.gap === "number" ? opts.gap : 12;
    var heightFor = typeof opts.heightFor === "function" ? opts.heightFor : function (item) {
      return item.type === "image" ? 190 : item.type === "text" ? 120 : 70;
    };
    return (items || []).map(function (item) {
      var position = { x: x, y: y };
      var height = Number(heightFor(item));
      if (!isFinite(height) || height < 0) height = 90;
      y += height + gap;
      return position;
    });
  }

  return {
    cleanTags: cleanTags,
    normalizeItem: normalizeItem,
    nextStack: nextStack,
    bringToFront: bringToFront,
    searchText: searchText,
    matches: matches,
    canonicalLink: canonicalLink,
    sameLink: sameLink,
    captureScroll: captureScroll,
    restoreScroll: restoreScroll,
    organizePositions: organizePositions
  };
});
