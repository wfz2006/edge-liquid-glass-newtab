/* ============================================================
   收集板内容脚本 —— 任何网页左缘召出
   与新标签页共用同一份 chrome.storage 数据（实时双向同步）。
   界面挂在 Shadow DOM（closed）里，与宿主页面的样式互不污染；
   视觉复用新标签页的 glass 结构与 SVG 折射模型，普通页面也保持同一套液态玻璃效果。
   ============================================================ */
(function () {
  "use strict";
  if (window.top !== window) return;                       /* 只在顶层框架注入 */
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
  if (document.documentElement.__lgCollect) return;        /* 防重复注入 */

  var KEY = "lg.newtab";
  var MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;
  var CORE = window.LGCollection;
  var st = { sidebar: [], openInNew: false };
  var openState = false, closeTimer = 0;
  var imagePersisting = {};
  var searchQuery = "", filterType = "all";
  var focusBlockHost = null;
  var focusBlockShadow = null;
  var sidebarMutationQueue = [], sidebarMutationBusy = false, SIDEBAR_MUTATION_MAX_ATTEMPTS = 3;

  function blockedForHost(sites) {
    var hostName = location.hostname.toLowerCase();
    return (sites || []).some(function (site) {
      var value = String(site || "").toLowerCase().replace(/^www\./, "");
      return value && (hostName === value || hostName.slice(-(value.length + 1)) === "." + value);
    });
  }
  function renderFocusBlock(state) {
    var p = state && state.productivity;
    var shouldBlock = !!(p && p.focusMode && blockedForHost(p.blockedSites));
    if (!shouldBlock) {
      if (focusBlockHost && focusBlockHost.parentNode) focusBlockHost.parentNode.removeChild(focusBlockHost);
      focusBlockHost = null; focusBlockShadow = null;
      return;
    }
    if (focusBlockHost) return;
    focusBlockHost = document.createElement("div");
    focusBlockHost.id = "lg-focus-blocker";
    focusBlockHost.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:auto;";
    focusBlockShadow = focusBlockHost.attachShadow({ mode: "closed" });
    focusBlockShadow.innerHTML = '<style>:host{all:initial}*{box-sizing:border-box}.mask{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(70% 55% at 50% 0,rgba(134,190,255,.14),rgba(5,10,24,.82) 72%);color:#fff;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;text-align:center;backdrop-filter:blur(12px) saturate(85%)}.box{width:min(440px,88vw);padding:34px 28px;border:1px solid rgba(225,244,255,.28);border-radius:26px;background:linear-gradient(145deg,rgba(238,248,255,.12),rgba(255,255,255,.035) 54%,rgba(125,181,235,.06));box-shadow:0 26px 80px rgba(0,0,0,.46),inset 0 1px 1px rgba(255,255,255,.42)}h1{margin:0 0 10px;font-size:22px}p{margin:0;color:rgba(234,244,255,.72);font-size:13px}.host{margin-top:12px;color:rgba(226,240,255,.48);font-size:12px}</style><div class="mask"><div class="box"><h1>专注模式</h1><p>此网站已被暂时屏蔽。完成当前专注时段后再回来。</p><div class="host">' + location.hostname.replace(/[&<>"']/g, "") + '</div></div></div>';
    document.documentElement.appendChild(focusBlockHost);
  }

  /* ---------------- 数据 ---------------- */
  function uid() { return "sb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function hostOf(u) { var m = /^https?:\/\/([^\/:?#]+)/i.exec(u || ""); return m ? m[1].toLowerCase() : ""; }
  function hueOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function favURL(u) {
    var h = hostOf(u);
    if (!h) return "";
    return "https://" + h + "/favicon.ico";
  }
  function resolveImageURL(src, fallback) {
    var raw = String(src || "").trim();
    if (!raw) return "";
    if (/^(?:data:image\/|blob:|https?:\/\/)/i.test(raw)) return raw;
    if (/^\/\//.test(raw)) return (location.protocol === "http:" || location.protocol === "https:") ? location.protocol + raw : "https:" + raw;
    if (fallback && /^(?:https?:\/\/|\/\/)/i.test(fallback)) {
      var fb = /^\/\//.test(fallback) ? "https:" + fallback : fallback;
      /* 拖动图片时 text/uri-list 通常就是图片的最终地址。 */
      if (raw.charAt(0) === "/" || !/^[a-z][a-z0-9+.-]*:/i.test(raw)) return fb;
    }
    try {
      if (/^https?:/i.test(location.href)) return new URL(raw, location.href).href;
    } catch (e) {}
    return raw;
  }
  function normalizeStoredImage(item) {
    if (!item || item.type !== "image") return false;
    var changed = false;
    if (item.src) {
      var src = /^\/\//.test(item.src)
        ? ((location.protocol === "http:" || location.protocol === "https:") ? location.protocol : "https:") + item.src
        : item.src;
      if (src !== item.src) { item.src = src; changed = true; }
    }
    if (!item.url && /^https?:/i.test(item.src || "")) {
      item.url = item.src;
      changed = true;
    }
    return changed;
  }
  function inlineImageURL(src, cb) {
    if (!src || /^data:image\//i.test(src) || typeof fetch !== "function" || typeof FileReader === "undefined") return;
    fetch(src, { credentials: "omit", referrerPolicy: "no-referrer" }).then(function (res) {
      if (!res.ok) throw new Error("image request failed");
      return res.blob();
    }).then(function (blob) {
      var type = String(blob.type || "").toLowerCase();
      if (blob.size > MAX_INLINE_IMAGE_BYTES || (type && type.indexOf("image/") !== 0)) throw new Error("not an image");
      var rd = new FileReader();
      rd.onload = function () { cb(String(rd.result)); };
      rd.readAsDataURL(blob);
    }).catch(function () {});
  }
  function persistImage(item) {
    if (!item || item.type !== "image" || !item.src || /^data:image\//i.test(item.src)) return;
    var key = item.id + "|" + item.src;
    if (imagePersisting[key]) return;
    imagePersisting[key] = true;
    var source = item.src;
    inlineImageURL(source, function (dataURL) {
      delete imagePersisting[key];
      if (!dataURL) return;
      var current = null;
      st.sidebar.forEach(function (candidate) {
        if (candidate && candidate.id === item.id) current = candidate;
      });
      if (!current || current.src !== source) return;
      current.src = dataURL;
      saveSidebar();
      render();
    });
  }
  function persistImages() {
    st.sidebar.forEach(function (item) { persistImage(item); });
  }
  function openURL(u) {
    if (!u) return;
    if (st.openInNew) window.open(u, "_blank");
    else location.href = u;
  }
  function normItems(v) {
    if (!Array.isArray(v)) return [];
    return v.slice(0, 200).map(function (x) {
      if (!x || typeof x !== "object") return null;
      var it = CORE.normalizeItem(x, uid());
      normalizeStoredImage(it);
      return (it.type === "text" ? it.text : (it.url || it.src)) ? it : null;
    }).filter(Boolean);
  }
  function saveSidebar() {
    try {
      chrome.storage.local.get(KEY, function (box) {
        var latest = box && box[KEY] && typeof box[KEY] === "object" ? box[KEY] : {};
        latest.sidebar = st.sidebar;
        latest.openInNew = st.openInNew;
        latest.updatedAt = Date.now();
        st = latest;
        var o = {}; o[KEY] = latest; chrome.storage.local.set(o);
      });
    } catch (e) {}
  }
  function storageError() {
    var runtime = typeof chrome !== "undefined" && chrome.runtime;
    var lastError = runtime && runtime.lastError;
    return lastError ? new Error(lastError.message || "本地存储操作失败") : null;
  }
  function cloneStoredState(value) {
    try { return JSON.parse(JSON.stringify(value && typeof value === "object" ? value : {})); }
    catch (e) { throw new Error("本地存储数据无法复制"); }
  }
  function storageStamp(value) { return JSON.stringify(value); }
  function readStoredState(done) {
    try {
      chrome.storage.local.get(KEY, function (box) {
        var error = storageError();
        if (error) { done(null, error); return; }
        var raw = box && box[KEY] && typeof box[KEY] === "object" ? box[KEY] : {};
        try {
          var state = cloneStoredState(raw);
          done({ state: state, stamp: storageStamp(state) }, null);
        } catch (e) { done(null, e); }
      });
    } catch (e) { done(null, e); }
  }
  function writeStoredState(state, done) {
    try {
      var payload = {}; payload[KEY] = state;
      chrome.storage.local.set(payload, function () { done(storageError()); });
    } catch (e) { done(e); }
  }
  function runSidebarMutation(mutator, done) {
    var attempts = 0, mutationApplied = false, appliedResult = null;
    function attempt() {
      attempts++;
      readStoredState(function (snapshot, readError) {
        if (readError) { done(null, readError, snapshot && snapshot.state); return; }
        var authoritative = snapshot.state, latest;
        try { latest = cloneStoredState(authoritative); }
        catch (e) { done(null, e, authoritative); return; }
        var current = Array.isArray(latest.sidebar) ? latest.sidebar : [];
        var result;
        try { result = mutator(current); }
        catch (e) { done(null, e, authoritative); return; }
        if (!result || !result.changed) {
          done(mutationApplied ? appliedResult : result, null, latest);
          return;
        }
        latest.sidebar = result.sidebar;
        readStoredState(function (beforeWrite, compareError) {
          if (compareError) { done(null, compareError, authoritative); return; }
          if (beforeWrite.stamp !== snapshot.stamp) {
            if (attempts >= SIDEBAR_MUTATION_MAX_ATTEMPTS) {
              done(null, new Error("本地存储在重试后仍持续变化"), beforeWrite.state);
              return;
            }
            attempt();
            return;
          }
          latest.updatedAt = Date.now();
          mutationApplied = true;
          appliedResult = result;
          writeStoredState(latest, function (writeError) {
            if (writeError) {
              done(null, writeError, authoritative);
              return;
            }
            readStoredState(function (afterWrite, verifyError) {
              if (verifyError) { done(null, verifyError, authoritative); return; }
              if (afterWrite.stamp !== storageStamp(latest)) {
                if (attempts >= SIDEBAR_MUTATION_MAX_ATTEMPTS) {
                  done(null, new Error("本地存储在重试后仍持续变化"), afterWrite.state);
                  return;
                }
                attempt();
                return;
              }
              done(result, null, afterWrite.state);
            });
          });
        });
      });
    }
    attempt();
  }
  function drainSidebarMutations() {
    if (sidebarMutationBusy || !sidebarMutationQueue.length) return;
    sidebarMutationBusy = true;
    var job = sidebarMutationQueue.shift();
    function finish(result, error, latest) {
      if (latest) st = latest;
      try { if (typeof job.done === "function") job.done(result, error); }
      finally { sidebarMutationBusy = false; drainSidebarMutations(); }
    }
    try { runSidebarMutation(job.mutator, finish); }
    catch (e) { finish(null, e, st); }
  }
  function mutateSidebar(mutator, done) {
    sidebarMutationQueue.push({ mutator: mutator, done: done });
    drainSidebarMutations();
  }
  function addItem(it) {
    if (!it || typeof it !== "object") return;
    it = CORE.normalizeItem(it, uid());
    it.id = uid();
    if (it.type === "image" && it.src) it.src = resolveImageURL(it.src);
    normalizeStoredImage(it);
    if (it.type === "link" && st.sidebar.some(function (old) { return CORE.sameLink(old, it); })) return false;
    /* y 取现有内容的底部级联，新标签页画布打开时位置也自然 */
    var bottom = 10, est = { link: 64, image: 190, text: 120 };
    st.sidebar.forEach(function (o) { bottom = Math.max(bottom, (o.y || 0) + (est[o.type] || 90) + 12); });
    it.x = 10; it.y = bottom;
    st.sidebar.push(it);
    saveSidebar();
    render();
    persistImage(it);
    return true;
  }
  function delItem(id) {
    st.sidebar = st.sidebar.filter(function (x) { return x.id !== id; });
    saveSidebar();
    render();
  }

  /* ---------------- UI（Shadow DOM） ---------------- */
  var CSS = `
:host{all:initial}
*{box-sizing:border-box}
.zone{position:fixed;left:0;top:0;bottom:0;width:14px;z-index:2147483646;pointer-events:auto}
.zone::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);
  width:3px;height:64px;border-radius:0 3px 3px 0;background:rgba(185,224,255,.30);
  opacity:0;transition:opacity .2s}
.zone:hover::before{opacity:1}
.sbar{
  position:fixed;left:0;top:0;bottom:0;width:min(320px,86vw);z-index:2147483647;
  display:flex;flex-direction:column;color:#fff;pointer-events:auto;
  font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  background:linear-gradient(160deg,rgba(238,248,255,.085),rgba(255,255,255,.025) 48%,rgba(125,181,235,.05));
  border:1px solid rgba(225,244,255,.26);border-left:none;border-radius:0 20px 20px 0;
  box-shadow:14px 0 44px rgba(2,8,24,.28),0 1px 0 rgba(255,255,255,.08);
  transform:translateX(-104%);
  transition:transform .34s cubic-bezier(.2,.9,.25,1.08);
}
.sbRefr{position:absolute;inset:0;border-radius:inherit;z-index:0;pointer-events:none}
 .sbar .head,.sbar .tools,.sbar .canvas,.sbar .hint{position:relative;z-index:1}
.sbar.open{transform:none}
.sbar.dropping{border-color:rgba(225,245,255,.44);box-shadow:14px 0 58px rgba(2,7,20,.56)}
.head{display:flex;align-items:center;gap:10px;padding:15px 16px 10px;flex:0 0 auto}
.ttl{flex:1;font-size:14px;font-weight:600;letter-spacing:.4px}
 .meta{font-size:11.5px;color:rgba(255,255,255,.6);font-variant-numeric:tabular-nums}
 .current{height:28px;min-width:28px;padding:0 8px;border-radius:999px;cursor:pointer;color:#fff;
   background:rgba(235,247,255,.065);border:1px solid rgba(225,244,255,.26);font-size:14px;line-height:1}
 .current:hover{background:rgba(171,218,255,.14);border-color:rgba(225,245,255,.44)}
 .organize{height:28px;padding:0 8px;border-radius:999px;cursor:pointer;color:rgba(255,255,255,.82);
   background:rgba(235,247,255,.055);border:1px solid rgba(225,244,255,.22);font:inherit;font-size:11px}
 .organize:hover{background:rgba(171,218,255,.14);border-color:rgba(225,245,255,.44);color:#fff}
 .batch-toggle{height:28px;padding:0 8px;border-radius:999px;cursor:pointer;color:rgba(255,255,255,.82);
   background:rgba(235,247,255,.055);border:1px solid rgba(225,244,255,.22);font:inherit;font-size:11px}
 .batch-toggle:hover,.batch-toggle[aria-pressed="true"]{background:rgba(171,218,255,.14);border-color:rgba(225,245,255,.44);color:#fff}
 .tools{padding:0 16px 8px;display:flex;flex-direction:column;gap:7px}
 .search{width:100%;height:30px;border-radius:10px;padding:0 10px;outline:none;color:#fff;
   background:rgba(235,247,255,.052);border:1px solid rgba(225,244,255,.26);font:inherit;font-size:12px}
 .search::placeholder{color:rgba(255,255,255,.48)}
 .search:focus{background:rgba(220,241,255,.085);border-color:rgba(225,245,255,.44)}
 .filters{display:flex;gap:5px}
 .filter{height:24px;padding:0 9px;border-radius:999px;cursor:pointer;color:rgba(255,255,255,.72);
   background:rgba(235,247,255,.055);border:1px solid rgba(225,244,255,.20);font:inherit;font-size:11px}
 .filter.on,.filter:hover{background:rgba(171,218,255,.14);border-color:rgba(225,245,255,.44);color:#fff}
 .batch-tools{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
 .batch-tools[hidden],.notice[hidden]{display:none}
 .batch-count{margin-right:auto;font-size:11px;color:rgba(255,255,255,.68);font-variant-numeric:tabular-nums}
 .batch-tools button{height:24px;padding:0 8px;border-radius:999px;cursor:pointer;color:rgba(255,255,255,.78);
   background:rgba(235,247,255,.055);border:1px solid rgba(225,244,255,.20);font:inherit;font-size:10.5px}
 .batch-tools button:hover:not(:disabled),.batch-tools button:focus-visible{background:rgba(171,218,255,.14);border-color:rgba(225,245,255,.44);color:#fff}
 .batch-tools button:disabled{cursor:not-allowed;opacity:.42}
 .batch-tools .delete-selected{color:rgba(255,220,224,.92);border-color:rgba(255,160,170,.34)}
.canvas{flex:1;position:relative;overflow-y:auto;overflow-x:hidden;padding:4px 0 18px;
  overscroll-behavior:contain;scrollbar-gutter:stable}
.canvas::-webkit-scrollbar{width:6px}
 .canvas::-webkit-scrollbar-thumb{background:rgba(205,231,255,.24);border-radius:3px}
.stage{position:relative;min-height:100%;width:100%}
.empty{font-size:12.5px;color:rgba(255,255,255,.55);padding:16px 18px 0;line-height:1.8}
.hint{flex:0 0 auto;padding:8px 16px 12px;font-size:11px;color:rgba(255,255,255,.45);letter-spacing:.3px}
  .glass{position:relative;border-radius:22px;overflow:hidden;border:1px solid rgba(225,244,255,.26);
  background:linear-gradient(145deg,rgba(238,248,255,.065),rgba(255,255,255,.018) 55%,rgba(145,201,255,.035));box-shadow:0 14px 34px rgba(2,8,24,.28),0 1px 0 rgba(255,255,255,.08);color:#fff}
  .glass::before{content:"";position:absolute;inset:0;z-index:1;border-radius:inherit;pointer-events:none;
  background:linear-gradient(145deg,rgba(255,255,255,.13),rgba(255,255,255,.018) 44%,rgba(176,220,255,.07));opacity:.78}
  .glass::after{content:"";position:absolute;inset:0;z-index:2;border-radius:inherit;pointer-events:none;
  box-shadow:inset 0 1px 1px rgba(255,255,255,.55),inset 0 -1px 1px rgba(8,18,40,.22),
    inset 1px 0 1px rgba(235,248,255,.18),inset -1px 0 1px rgba(235,248,255,.12),
    inset 0 0 22px rgba(220,240,255,.045)}
.glass > *{position:relative;z-index:3}
.sbcard{position:absolute;left:0;top:0;width:252px;border-radius:18px;padding:12px 13px;
  cursor:grab;user-select:none;touch-action:none}
.sbcard.batch-mode{cursor:pointer;touch-action:auto}
.sbcard.selected{border-color:rgba(185,224,255,.9);background:rgba(171,218,255,.18);box-shadow:0 0 0 2px rgba(171,218,255,.18),0 14px 34px rgba(2,8,24,.28)}
.sbcard .sbcheck{position:absolute;left:9px;top:9px;width:20px;height:20px;border-radius:50%;display:none;
  align-items:center;justify-content:center;color:#08213d;background:rgba(205,235,255,.9);font-size:12px;font-weight:700;z-index:5}
.sbcard.batch-mode .sbcheck{display:flex}
.sbcard.batch-mode .del{display:none}
.sbcard.dragging{cursor:grabbing}
.sbcard .cap{display:flex;align-items:center;gap:9px;min-width:0}
.sbcard .ic{width:34px;height:34px;flex:0 0 auto;border-radius:10px;display:flex;align-items:center;
  justify-content:center;font-size:14px;font-weight:600;letter-spacing:.4px;background:rgba(232,247,255,.12);
  border:1px solid rgba(225,244,255,.24);box-shadow:inset 0 1px 1px rgba(255,255,255,.38);overflow:hidden}
.sbcard .ic img{width:20px;height:20px;display:block;border-radius:4px}
.sbcard .col{min-width:0}
.sbcard .tt{font-size:13px;font-weight:600;letter-spacing:.2px;color:rgba(255,255,255,.95);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 8px rgba(0,0,0,.34)}
 .sbcard .sub{font-size:11px;color:rgba(255,255,255,.62);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
 .sbtags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
 .sbtag{padding:1px 6px;border-radius:999px;background:rgba(235,247,255,.08);border:1px solid rgba(225,244,255,.16);
   color:rgba(255,255,255,.72);font-size:10px;line-height:1.45}
.sbcard img.thumb{display:block;width:100%;height:132px;object-fit:cover;border-radius:12px;margin-bottom:9px;background:rgba(255,255,255,.12)}
.sbcard .note{margin-top:9px;font-size:12.5px;line-height:1.7;white-space:pre-wrap;word-break:break-word;
  display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden}
.sbcard .del{position:absolute;top:8px;right:9px;width:22px;height:22px;border-radius:50%;z-index:4;
  display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;cursor:pointer;
  background:rgba(235,247,255,.12);border:1px solid rgba(225,244,255,.18);opacity:0;transition:opacity .2s}
.sbcard:hover .del{opacity:1}
.del:hover{background:rgba(171,218,255,.18);border-color:rgba(225,245,255,.42)}
.notice{position:absolute;left:14px;right:14px;bottom:42px;z-index:8;display:flex;align-items:center;gap:8px;
  padding:8px 11px;border-radius:12px;color:rgba(255,255,255,.9);background:rgba(8,22,44,.88);
  border:1px solid rgba(185,224,255,.34);box-shadow:0 10px 30px rgba(2,8,24,.32);font-size:11.5px}
.notice-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.notice button{margin-left:auto;border:0;background:transparent;color:#b9e0ff;cursor:pointer;font:inherit;font-weight:600}
`;
  var host = document.createElement("div");
  host.id = "lg-collect-host";
  host.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;pointer-events:none;";
  var sh = host.attachShadow({ mode: "closed" });
  sh.innerHTML = '<svg class="glass-defs" width="0" height="0" aria-hidden="true"></svg>' +
    "<style>" + CSS + "</style>" +
    '<div class="zone" title="收集板"></div>' +
    '<aside class="sbar">' +
     '<div class="sbRefr" data-glass data-lg-str=".09" data-lg-band=".13" data-lg-disp="0" aria-hidden="true"></div>' +
     '<div class="head"><span class="ttl">收集板</span><span class="meta">0 项</span><button type="button" class="organize" title="一键整理" aria-label="一键整理">整理</button><button type="button" class="batch-toggle" title="批量管理" aria-label="批量管理" aria-pressed="false">批量</button><button type="button" class="current" title="收藏当前网页" aria-label="收藏当前网页">＋</button></div>' +
     '<div class="tools"><input class="search" type="search" placeholder="搜索标题、网址、文字或标签" aria-label="搜索收集板">' +
     '<div class="filters" role="group" aria-label="收集板筛选"><button type="button" class="filter on" data-filter="all">全部</button>' +
     '<button type="button" class="filter" data-filter="link">链接</button><button type="button" class="filter" data-filter="image">图片</button>' +
     '<button type="button" class="filter" data-filter="text">笔记</button></div>' +
     '<div class="batch-tools" hidden aria-label="收集板批量操作"><span class="batch-count" aria-live="polite">已选 0 项</span>' +
     '<button type="button" class="select-all">全选当前</button><button type="button" class="clear-selection">清空选择</button>' +
     '<button type="button" class="delete-selected" disabled>删除所选</button></div></div>' +
     '<div class="canvas"></div>' +
     '<div class="notice" role="status" aria-live="polite" hidden><span class="notice-text"></span><button type="button" class="notice-undo" hidden>撤销</button></div>' +
     '<div class="hint">拖入链接 / 图片 / 文字 · 拖动卡片调整位置 · Ctrl+V 粘贴 · 新标签页可编辑</div>' +
    '</aside>';
  document.documentElement.appendChild(host);

  var zone = sh.querySelector(".zone");
  var bar = sh.querySelector(".sbar");
  var canvas = sh.querySelector(".canvas");
  var meta = sh.querySelector(".meta");
  var organizeBtn = sh.querySelector(".organize");
  var currentBtn = sh.querySelector(".current");
  var batchMode = false, selectedIds = Object.create(null), undoSnapshot = null, undoTimer = 0;
  var batchToggle = sh.querySelector(".batch-toggle");
  var batchTools = sh.querySelector(".batch-tools");
  var batchCount = sh.querySelector(".batch-count");
  var selectAllButton = sh.querySelector(".select-all");
  var clearSelectionButton = sh.querySelector(".clear-selection");
  var deleteSelectedButton = sh.querySelector(".delete-selected");
  var notice = sh.querySelector(".notice");
  var noticeText = sh.querySelector(".notice-text");
  var noticeUndo = sh.querySelector(".notice-undo");
  var noticeTimer = 0;
  var searchInput = sh.querySelector(".search");
  var filterButtons = [].slice.call(sh.querySelectorAll(".filter"));
  var dragCard = null, suppressCardClickUntil = 0;

  searchInput.addEventListener("input", function () {
    searchQuery = this.value;
    render();
  });
  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      filterType = button.getAttribute("data-filter") || "all";
      filterButtons.forEach(function (other) { other.classList.toggle("on", other === button); });
      render();
    });
  });
  function visibleItems() {
    return st.sidebar.filter(function (item) { return CORE.matches(item, searchQuery, filterType); });
  }
  function selectedItems() {
    return st.sidebar.filter(function (item) { return item && selectedIds[item.id] === true; });
  }
  function pruneSelection() {
    var live = Object.create(null);
    st.sidebar.forEach(function (item) {
      if (item && selectedIds[item.id] === true) live[item.id] = true;
    });
    selectedIds = live;
  }
  function renderBatchTools() {
    pruneSelection();
    var chosen = selectedItems().length;
    var visible = visibleItems().length;
    batchToggle.textContent = batchMode ? "退出批量" : "批量";
    batchToggle.setAttribute("aria-pressed", batchMode ? "true" : "false");
    batchTools.hidden = !batchMode;
    batchCount.textContent = "已选 " + chosen + " 项";
    selectAllButton.disabled = !visible;
    clearSelectionButton.disabled = !chosen;
    deleteSelectedButton.disabled = !chosen;
  }
  function toggleSelected(id) {
    if (!id) return;
    if (selectedIds[id] === true) delete selectedIds[id];
    else selectedIds[id] = true;
    render();
    focusCard(id);
  }
  function selectVisible() {
    visibleItems().forEach(function (item) {
      if (item && item.id !== undefined && item.id !== null) selectedIds[String(item.id)] = true;
    });
    render();
  }
  function clearSelection() {
    selectedIds = Object.create(null);
    render();
  }
  function focusCard(id) {
    if (!id) return;
    var cards = canvas.querySelectorAll(".sbcard");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute("data-id") === String(id)) {
        if (typeof cards[i].focus === "function") cards[i].focus();
        return;
      }
    }
  }
  function showNotice(message, action) {
    clearTimeout(noticeTimer);
    noticeText.textContent = message;
    noticeUndo.hidden = typeof action !== "function";
    noticeUndo.onclick = typeof action === "function" ? action : null;
    notice.hidden = false;
    noticeTimer = setTimeout(function () { notice.hidden = true; }, action ? 8000 : 2400);
  }
  function deleteSelected() {
    var chosen = selectedItems();
    if (!chosen.length) { showNotice("请先选择收集项"); return; }
    if (!window.confirm("确定删除已选中的 " + chosen.length + " 项收集内容？")) return;
    var ids = Object.keys(selectedIds);
    mutateSidebar(function (latestSidebar) {
      var removed = CORE.removeByIds(latestSidebar, ids);
      return { sidebar: removed.items, removed: removed.removed, changed: !!removed.removed.length };
    }, function (result, error) {
      if (error) {
        render();
        showNotice("删除失败，已恢复最新数据");
        return;
      }
      if (!result || !result.removed.length) {
        selectedIds = Object.create(null);
        render();
        return;
      }
      undoSnapshot = { removed: result.removed };
      clearTimeout(undoTimer);
      selectedIds = Object.create(null);
      render();
      showNotice("已删除 " + result.removed.length + " 项", undoDelete);
      undoTimer = setTimeout(function () { undoSnapshot = null; }, 8000);
    });
  }
  function undoDelete() {
    if (!undoSnapshot) return;
    var snapshot = undoSnapshot;
    undoSnapshot = null;
    clearTimeout(undoTimer);
    mutateSidebar(function (latestSidebar) {
      var restored = CORE.restoreByIds(latestSidebar, snapshot.removed);
      return { sidebar: restored, changed: restored.length !== latestSidebar.length };
    }, function (result, error) {
      if (error) {
        undoSnapshot = snapshot;
        undoTimer = setTimeout(function () { undoSnapshot = null; }, 8000);
        render();
        showNotice("撤销失败，已恢复最新数据");
        return;
      }
      if (!result || !result.changed) { render(); return; }
      render();
      showNotice("已撤销删除");
    });
  }
  function leaveBatchMode() {
    if (!batchMode) return false;
    batchMode = false;
    selectedIds = Object.create(null);
    render();
    return true;
  }
  batchToggle.addEventListener("click", function () {
    if (batchMode) leaveBatchMode();
    else {
      batchMode = true;
      render();
    }
  });
  selectAllButton.addEventListener("click", selectVisible);
  clearSelectionButton.addEventListener("click", clearSelection);
  deleteSelectedButton.addEventListener("click", deleteSelected);
  function cardHeight(item) {
    var cards = canvas.querySelectorAll(".sbcard");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute("data-id") === item.id && cards[i].offsetHeight > 0) return cards[i].offsetHeight;
    }
    return item.type === "image" ? 220 : item.type === "text" ? 154 : 86;
  }
  function organizeSidebar() {
    if (!st.sidebar.length) return;
    var positions = CORE.organizePositions(st.sidebar, {
      x: 10,
      y: 10,
      gap: 12,
      heightFor: cardHeight
    });
    st.sidebar.forEach(function (item, i) {
      item.x = positions[i].x;
      item.y = positions[i].y;
    });
    saveSidebar();
    render();
    var oldText = organizeBtn.textContent;
    organizeBtn.textContent = "已整理";
    setTimeout(function () { organizeBtn.textContent = oldText; }, 1200);
  }
  organizeBtn.addEventListener("click", organizeSidebar);
  currentBtn.addEventListener("click", function () {
    var added = addItem({ type: "link", url: location.href, title: document.title || location.hostname });
    var oldText = currentBtn.textContent;
    currentBtn.textContent = added ? "✓" : "已存";
    currentBtn.title = added ? "已收藏当前网页" : "当前网页已经收藏";
    setTimeout(function () {
      currentBtn.textContent = oldText;
      currentBtn.title = "收藏当前网页";
    }, 1200);
  });

  /* ---------------- 与主页同源的 SVG 液态玻璃 ----------------
     content script 没有新标签页里的 window.LiquidGlass，因此在 Shadow DOM
     内复用同一套位移贴图缓存和独立滤镜逻辑。收集板元素把色散显式设为 0，
     保留折射轮廓但不出现彩边。 */
  var contentGlass = (function (root, defs) {
    var NS = "http://www.w3.org/2000/svg";
    var XL = "http://www.w3.org/1999/xlink";
    var SUPPORTED = !!(window.CSS && window.CSS.supports && (
      window.CSS.supports("backdrop-filter", "url(#x)") ||
      window.CSS.supports("-webkit-backdrop-filter", "url(#x)")));
    var DEF = { band: 0.16, str: 0.22, disp: 1 };
    var uid2 = 0, owner = {}, mapCache = {}, els = [], rafId = 0;

    function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
    function ss(a, b, t) { t = (t - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function rrSDF(px, py, hw, hh, r) {
      var qx = Math.abs(px) - hw + r, qy = Math.abs(py) - hh + r;
      return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
    }
    function dispMap(W, H, radius, band, strength) {
      var s = Math.min(1, 240 / Math.max(W, H));
      var mw = Math.max(8, Math.round(W * s)), mh = Math.max(8, Math.round(H * s));
      var cv = document.createElement("canvas");
      cv.width = mw; cv.height = mh;
      var ctx = cv.getContext("2d"), im = ctx.createImageData(mw, mh);
      var e = Math.max(0.75, Math.min(W, H) * 0.006);
      var S = Math.max(1, strength * 2), inner = band * 0.42;
      var hw = W / 2, hh = H / 2, R = clamp(radius, 0, Math.min(hw, hh));
      for (var y = 0; y < mh; y++) {
        var py = (y + 0.5) / mh * H - hh;
        for (var x = 0; x < mw; x++) {
          var px = (x + 0.5) / mw * W - hw;
          var d = rrSDF(px, py, hw, hh, R);
          var m = 1 - ss(inner, band, -d);
          var gx = rrSDF(px + e, py, hw, hh, R) - rrSDF(px - e, py, hw, hh, R);
          var gy = rrSDF(px, py + e, hw, hh, R) - rrSDF(px, py - e, hw, hh, R);
          var L = Math.hypot(gx, gy) || 1;
          gx /= L; gy /= L;
          var i = (y * mw + x) * 4;
          im.data[i] = clamp(Math.round(255 * (0.5 - gx * m * strength / S)), 0, 255);
          im.data[i + 1] = clamp(Math.round(255 * (0.5 - gy * m * strength / S)), 0, 255);
          im.data[i + 2] = clamp(Math.round(255 * m), 0, 255);
          im.data[i + 3] = 255;
        }
      }
      ctx.putImageData(im, 0, 0);
      return cv.toDataURL("image/png");
    }
    function buildFilter(id, href, strength, disp) {
      var f = document.createElementNS(NS, "filter");
      f.setAttribute("id", id); f.setAttribute("x", "0%"); f.setAttribute("y", "0%");
      f.setAttribute("width", "100%"); f.setAttribute("height", "100%");
      f.setAttribute("color-interpolation-filters", "sRGB");
      var fi = document.createElementNS(NS, "feImage");
      fi.setAttribute("href", href); fi.setAttributeNS(XL, "xlink:href", href);
      fi.setAttribute("x", "0%"); fi.setAttribute("y", "0%");
      fi.setAttribute("width", "100%"); fi.setAttribute("height", "100%");
      fi.setAttribute("preserveAspectRatio", "none"); fi.setAttribute("result", "map");
      f.appendChild(fi);
      var S = Math.max(1, strength * 2);
      [["R", 1.00, "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"],
       ["G", 1 - disp * 0.15, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"],
       ["B", 1 - disp * 0.28, "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"]].forEach(function (c) {
        var dm = document.createElementNS(NS, "feDisplacementMap");
        dm.setAttribute("in", "SourceGraphic"); dm.setAttribute("in2", "map");
        dm.setAttribute("scale", String(S * c[1]));
        dm.setAttribute("xChannelSelector", "R"); dm.setAttribute("yChannelSelector", "G");
        dm.setAttribute("result", "d" + c[0]); f.appendChild(dm);
        var cm = document.createElementNS(NS, "feColorMatrix");
        cm.setAttribute("in", "d" + c[0]); cm.setAttribute("type", "matrix");
        cm.setAttribute("values", c[2]); cm.setAttribute("result", "c" + c[0]); f.appendChild(cm);
      });
      var b1 = document.createElementNS(NS, "feBlend");
      b1.setAttribute("in", "cR"); b1.setAttribute("in2", "cG"); b1.setAttribute("mode", "screen");
      b1.setAttribute("result", "rg"); f.appendChild(b1);
      var b2 = document.createElementNS(NS, "feBlend");
      b2.setAttribute("in", "rg"); b2.setAttribute("in2", "cB"); b2.setAttribute("mode", "screen");
      f.appendChild(b2);
      return f;
    }
    function buildFilterLite(id, href, strength) {
      var f = document.createElementNS(NS, "filter");
      f.setAttribute("id", id); f.setAttribute("x", "0%"); f.setAttribute("y", "0%");
      f.setAttribute("width", "100%"); f.setAttribute("height", "100%");
      f.setAttribute("color-interpolation-filters", "sRGB");
      var fi = document.createElementNS(NS, "feImage");
      fi.setAttribute("href", href); fi.setAttributeNS(XL, "xlink:href", href);
      fi.setAttribute("x", "0%"); fi.setAttribute("y", "0%");
      fi.setAttribute("width", "100%"); fi.setAttribute("height", "100%");
      fi.setAttribute("preserveAspectRatio", "none"); fi.setAttribute("result", "map"); f.appendChild(fi);
      var dm = document.createElementNS(NS, "feDisplacementMap");
      dm.setAttribute("in", "SourceGraphic"); dm.setAttribute("in2", "map");
      dm.setAttribute("scale", String(Math.max(1, strength * 2)));
      dm.setAttribute("xChannelSelector", "R"); dm.setAttribute("yChannelSelector", "G"); f.appendChild(dm);
      return f;
    }
    function getMap(geo, W, H, radius, band, strength) {
      if (!mapCache[geo]) {
        if (Object.keys(mapCache).length > 60) mapCache = {};
        mapCache[geo] = dispMap(W, H, radius, band, strength);
      }
      return mapCache[geo];
    }
    function findFilter(id) { return defs.querySelector("#" + id); }
    function collect() { els = [].slice.call(root.querySelectorAll("[data-glass]")); }
    function renderGlass() {
      rafId = 0;
      if (!defs) return;
      var used = {};
      for (var n = 0; n < els.length; n++) {
        var el = els[n];
        if (!el.isConnected) continue;
        var rect = el.getBoundingClientRect();
        var W = Math.round(rect.width), H = Math.round(rect.height);
        if (W < 10 || H < 10) continue;
        var cs = getComputedStyle(el);
        var radius = num(cs.borderTopLeftRadius, 0), short = Math.min(W, H);
        var band = Math.max(3, Math.min(short * num(el.getAttribute("data-lg-band"), DEF.band), 26));
        var strength = Math.max(3, short * num(el.getAttribute("data-lg-str"), DEF.str));
        var disp = num(el.getAttribute("data-lg-disp"), DEF.disp);
        if (!SUPPORTED) {
          if (el.__lgId !== "fallback") {
            el.__lgId = "fallback";
            el.style.backdropFilter = "blur(16px) saturate(140%)";
            el.style.webkitBackdropFilter = el.style.backdropFilter;
          }
          continue;
        }
        var lite = !!el.__lgLite;
        var geo = [W, H, Math.round(radius), Math.round(band * 4), Math.round(strength * 4), Math.round(disp * 10)].join(",");
        var ck = (lite ? "L," : "N,") + geo;
        var previousId = el.__lgId;
        var filterNode = previousId && el.__lgKey === ck ? findFilter(previousId) : null;
        var id;
        if (filterNode) {
          id = previousId;
        } else {
          id = "lgc" + (++uid2); owner[id] = el;
          defs.appendChild(lite ? buildFilterLite(id, getMap(geo, W, H, radius, band, strength), strength)
            : buildFilter(id, getMap(geo, W, H, radius, band, strength), strength, disp));
          el.__lgId = id;
          el.__lgKey = ck;
        }
        used[id] = 1;
        if (previousId !== id || el.style.backdropFilter.indexOf("#" + id) < 0) {
          var v = "url(#" + id + ") saturate(140%) brightness(1.02)";
          el.style.backdropFilter = v; el.style.webkitBackdropFilter = v;
        }
      }
      Object.keys(owner).forEach(function (fid) {
        if (used[fid]) return;
        var node = findFilter(fid);
        if (node && node.parentNode) node.parentNode.removeChild(node);
        var oldOwner = owner[fid];
        if (oldOwner && oldOwner.__lgId === fid) {
          oldOwner.__lgId = null;
          oldOwner.__lgKey = null;
        }
        delete owner[fid];
      });
    }
    function schedule() {
      if (rafId) return;
      rafId = window.requestAnimationFrame ? window.requestAnimationFrame(renderGlass) : window.setTimeout(renderGlass, 16);
    }
    return {
      refresh: function () { collect(); schedule(); },
      resize: function () { schedule(); },
      lite: function (list, on) {
        for (var i = 0; i < list.length; i++) {
          if (!list[i]) continue;
          list[i].__lgLite = !!on; list[i].__lgId = null;
        }
        schedule();
      }
    };
  })(sh, sh.querySelector(".glass-defs"));
  window.addEventListener("resize", contentGlass.resize);

  function cardDragMove(e) {
    var d = dragCard;
    if (!d || e.pointerId !== d.pointerId) return;
    var dx = e.clientX - d.sx;
    var dy = e.clientY - d.sy + (canvas.scrollTop - d.scrollTop);
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 3) return;
      d.moved = true;
      var z = CORE.bringToFront(st.sidebar, d.item);
      d.el.style.zIndex = String(z);
      d.el.classList.add("dragging");
    }
    e.preventDefault();
    var maxX = Math.max(10, d.stage.clientWidth - d.el.offsetWidth - 10);
    var x = Math.max(10, Math.min(d.x0 + dx, maxX));
    var y = Math.max(10, d.y0 + dy);
    var need = y + d.el.offsetHeight + 12;
    if (need > d.stage.offsetHeight) d.stage.style.height = need + "px";
    var maxY = Math.max(10, d.stage.scrollHeight - d.el.offsetHeight - 12);
    y = Math.min(y, maxY);
    d.item.x = x;
    d.item.y = y;
    d.el.style.left = x + "px";
    d.el.style.top = y + "px";
  }
  function cardDragEnd(e) {
    var d = dragCard;
    if (!d || (e && e.pointerId !== undefined && e.pointerId !== d.pointerId)) return;
    if (d.moved) {
      suppressCardClickUntil = Date.now() + 260;
      saveSidebar();
    }
    d.el.classList.remove("dragging");
    try { d.el.releasePointerCapture(d.pointerId); } catch (err) {}
    dragCard = null;
  }
  function beginCardDrag(e, item, el) {
    if (dragCard) cardDragEnd();
    var stage = el.parentNode;
    dragCard = {
      item: item,
      el: el,
      stage: stage,
      pointerId: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      scrollTop: canvas.scrollTop,
      moved: false
    };
    dragCard.x0 = typeof item.x === "number" ? item.x : 10;
    dragCard.y0 = typeof item.y === "number" ? item.y : 10;
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
  }
  sh.addEventListener("pointermove", cardDragMove, true);
  sh.addEventListener("pointerup", cardDragEnd, true);
  sh.addEventListener("pointercancel", cardDragEnd, true);

  /* ---------------- 渲染 ---------------- */
  function letterSkin(el, host2) {
    var h = hueOf(host2 || "x");
    el.style.background = "linear-gradient(142deg,hsl(" + h + " 48% 66% / .30),hsl(" + ((h + 38) % 360) + " 42% 54% / .22))";
  }
  function render() {
    pruneSelection();
    var view = CORE.captureScroll(canvas);
    canvas.textContent = "";
    var stage = document.createElement("div");
    stage.className = "stage";
    canvas.appendChild(stage);
    var bottom = 10;
    var visible = visibleItems();
    if (!visible.length) {
      var e = document.createElement("div");
      e.className = "empty";
      e.textContent = st.sidebar.length ? "没有符合条件的收集项" : "还是空的。把本页的链接、图片、选中文字拖进来即可收藏。";
      stage.appendChild(e);
    }
    st.sidebar.forEach(function (it) {
      if (!CORE.matches(it, searchQuery, filterType)) return;
      var el = document.createElement("div");
      el.className = "glass sbcard";
      el.setAttribute("data-id", it.id);
      el.setAttribute("role", "option");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-selected", batchMode && selectedIds[it.id] === true ? "true" : "false");
      if (batchMode) el.classList.add("batch-mode");
      if (batchMode && selectedIds[it.id] === true) el.classList.add("selected");
      el.setAttribute("data-glass", "");
      el.setAttribute("data-lg-disp", "0");
      el.title = it.url || it.src || "";
      el.style.zIndex = String(typeof it.z === "number" && isFinite(it.z) ? it.z : 0);
      el.style.left = (typeof it.x === "number" ? it.x : 10) + "px";
      el.style.top = (typeof it.y === "number" ? it.y : 10) + "px";
      var html = "";
      html += '<span class="sbcheck" aria-hidden="true">✓</span>';
      if (it.type === "image" && it.src) {
        html += '<img class="thumb" alt="" referrerpolicy="no-referrer" src="' + esc(it.src) + '">';
      }
      html += '<div class="cap">';
      if (it.type === "link") {
        var hst = hostOf(it.url);
        var hue = hueOf(hst || it.title || "x");
        var fav = favURL(it.url);
        html += '<div class="ic" style="background:linear-gradient(142deg,hsl(' + hue + ' 48% 66% / .30),hsl(' + ((hue + 38) % 360) + ' 42% 54% / .22))">' +
          (fav ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(fav) + '">' : esc((it.title || hst || "?").charAt(0).toUpperCase())) +
          '</div>';
      }
      html += '<div class="col"><div class="tt">' + esc(it.title ||
        (it.type === "link" ? hostOf(it.url) : it.type === "image" ? "图片" : "笔记")) + '</div>';
      if (it.type === "link" && hostOf(it.url)) html += '<div class="sub">' + esc(hostOf(it.url)) + '</div>';
      html += '</div></div>';
      if (it.tags && it.tags.length) {
        html += '<div class="sbtags">' + it.tags.map(function (tag) {
          return '<span class="sbtag">#' + esc(tag) + '</span>';
        }).join("") + '</div>';
      }
      if (it.type === "text" && it.text) html += '<div class="note">' + esc(it.text) + '</div>';
      html += '<div class="del" title="删除">×</div>';
      el.innerHTML = html;

      var favImg = el.querySelector(".ic img");
      if (favImg) favImg.addEventListener("error", function () {
        var icon = this.parentNode;
        this.remove();
        icon.textContent = (it.title || hst || "?").trim().charAt(0).toUpperCase();
      });

      if (!batchMode) {
        el.querySelector(".del").addEventListener("click", function (ev) {
          ev.stopPropagation();
          delItem(it.id);
        });
        el.addEventListener("pointerdown", function (ev) {
          var target = ev.target;
          if (target && target.closest && target.closest(".del, img.thumb")) return;
          if (ev.pointerType === "mouse" && ev.button !== 0) return;
          beginCardDrag(ev, it, el);
        });
      }
      el.addEventListener("click", function (ev) {
        if (batchMode) {
          ev.preventDefault();
          ev.stopPropagation();
          toggleSelected(it.id);
          return;
        }
        if (Date.now() < suppressCardClickUntil) return;
        if (it.type === "link" && it.url) openURL(it.url);
        else if (it.type === "image" && (it.url || it.src) && /^https?:/i.test(it.url || it.src)) openURL(it.url || it.src);
      });
      el.addEventListener("keydown", function (ev) {
        if (!batchMode || (ev.key !== "Enter" && ev.key !== " ")) return;
        ev.preventDefault();
        toggleSelected(it.id);
      });
      stage.appendChild(el);
      bottom = Math.max(bottom, (it.y || 0) + el.offsetHeight + 12);
    });
    stage.style.height = bottom + "px";
    meta.textContent = visible.length === st.sidebar.length ? visible.length + " 项" : visible.length + "/" + st.sidebar.length + " 项";
    renderBatchTools();
    contentGlass.refresh();
    CORE.restoreScroll(canvas, view);
  }
  function syncMeta() {
    var visible = st.sidebar.filter(function (it) { return CORE.matches(it, searchQuery, filterType); }).length;
    meta.textContent = visible === st.sidebar.length ? visible + " 项" : visible + "/" + st.sidebar.length + " 项";
  }

  /* ---------------- 开合 ---------------- */
  function isOpen() { return openState; }
  function openBar() {
    clearTimeout(closeTimer);
    if (openState) return;
    openState = true;
    bar.classList.add("open");
    contentGlass.refresh();
  }
  function closeBar() {
    if (!openState) return;
    openState = false;
    bar.classList.remove("open");
  }
  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closeBar, 420);
  }
  zone.addEventListener("mouseenter", openBar);
  zone.addEventListener("mouseleave", scheduleClose);
  bar.addEventListener("mouseenter", function () { clearTimeout(closeTimer); });
  bar.addEventListener("mouseleave", scheduleClose);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (batchMode) {
      leaveBatchMode();
      return;
    }
    closeBar();
  });

  /* ---------------- 拖放收集 ---------------- */
  function payloadTypes(e) {
    var t = e.dataTransfer && e.dataTransfer.types;
    if (!t) return false;
    for (var i = 0; i < t.length; i++) {
      if (t[i] === "Files" || t[i] === "text/uri-list" || t[i] === "text/plain" || t[i] === "text/html") return true;
    }
    return false;
  }
  function classifyDrop(dt) {
    var html = "", uri = "", plain = "";
    try { html = dt.getData("text/html") || ""; } catch (e) {}
    try { uri = dt.getData("text/uri-list") || ""; } catch (e2) {}
    try { plain = dt.getData("text/plain") || ""; } catch (e3) {}
    uri = (uri.split(/\r?\n/).filter(function (l) { return l && l.charAt(0) !== "#"; })[0] || "").trim();
    plain = plain.trim();
    var mIm = /<img[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(html);
    if (mIm) {
      var src = resolveImageURL(mIm[1], uri);
      var alt = (/<img[^>]*\salt\s*=\s*["']([^"']*)["']/i.exec(html) || [])[1] || "";
      var name = "";
      var mm = /\/([^\/?#]+?\.(?:png|jpe?g|gif|webp|svg|avif|bmp))(?:[?#]|$)/i.exec(src);
      if (mm) name = decodeURIComponent(mm[1]).replace(/\.[a-z0-9]+$/i, "");
      return { type: "image", src: src, url: /^https?:/i.test(src) ? src : "", title: alt || name || "图片" };
    }
    if (uri) {
      var mA = /<a[^>]*>([\s\S]*?)<\/a>/i.exec(html);
      var atext = mA ? mA[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";
      return { type: "link", url: uri, title: atext.slice(0, 60) };
    }
    if (plain) {
      if (/^(https?:\/\/|www\.)\S+$/i.test(plain) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(plain))
        return { type: "link", url: /^https?:/i.test(plain) ? plain : "https://" + plain, title: "" };
      return { type: "text", text: plain.slice(0, 2000), title: plain.split(/\r?\n/)[0].slice(0, 40) };
    }
    return null;
  }
  function readImage(f, cb) {
    var rd = new FileReader();
    rd.onload = function () { cb(String(rd.result)); };
    rd.readAsDataURL(f);
  }
  function onDrop(e) {
    if (!payloadTypes(e)) return;
    e.preventDefault();
    e.stopPropagation();
    bar.classList.remove("dropping");
    var dt = e.dataTransfer;
    var n = 0;
    if (dt.files && dt.files.length) {
      [].slice.call(dt.files).forEach(function (f) {
        if (!/^image\//.test(f.type)) return;
        if (f.size > 10 * 1024 * 1024) return;
        readImage(f, function (src) {
          addItem({ type: "image", src: src, title: (f.name || "").replace(/\.[a-z0-9]+$/i, "") });
        });
        n++;
      });
    }
    if (!n) {
      var it = classifyDrop(dt);
      if (it) { addItem(it); n = 1; }
    }
    if (n) openBar();
  }
  [bar, zone].forEach(function (el) {
    el.addEventListener("dragover", function (ev) {
      if (!payloadTypes(ev)) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
      bar.classList.add("dropping");
    });
    el.addEventListener("dragleave", function () { bar.classList.remove("dropping"); });
  });
  bar.addEventListener("drop", onDrop);
  zone.addEventListener("drop", onDrop);
  /* 拖动经过左缘时提前唤出 */
  document.addEventListener("dragover", function (e) {
    if (openState) return;
    if (e.clientX <= 24 && payloadTypes(e)) openBar();
  }, true);

  /* ---------------- 粘贴收集（仅收集板打开时） ---------------- */
  document.addEventListener("paste", function (e) {
    if (!openState) return;
    var t = e.target;
    var tag = (t && t.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
    var cd = e.clipboardData;
    if (!cd) return;
    var done = false;
    if (cd.files && cd.files.length) {
      [].slice.call(cd.files).forEach(function (f) {
        if (!/^image\//.test(f.type)) return;
        if (f.size > 10 * 1024 * 1024) return;
        readImage(f, function (src) { addItem({ type: "image", src: src, title: "剪贴板图片" }); });
        done = true;
      });
    }
    if (!done) {
      var txt = "";
      try { txt = cd.getData("text/plain") || ""; } catch (er) {}
      txt = txt.trim();
      if (txt) {
        if (/^(https?:\/\/|www\.)\S+$/i.test(txt) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(txt)) {
          addItem({ type: "link", url: /^https?:/i.test(txt) ? txt : "https://" + txt, title: "" });
        } else {
          addItem({ type: "text", text: txt.slice(0, 2000), title: txt.split(/\r?\n/)[0].slice(0, 40) });
        }
        done = true;
      }
    }
    if (done) e.preventDefault();
  });

  /* ---------------- 数据加载与同步 ---------------- */
  chrome.storage.local.get(KEY, function (o) {
    var v = o && o[KEY];
    if (v && typeof v === "object") st = v;
    if (!Array.isArray(st.sidebar)) st.sidebar = [];
    if (typeof st.openInNew !== "boolean") st.openInNew = false;
    var changed = false;
    st.sidebar = normItems(st.sidebar).map(function (item) {
      if (normalizeStoredImage(item)) changed = true;
      return item;
    });
    if (changed) saveSidebar();
    render();
    persistImages();
    renderFocusBlock(st);
  });
  try {
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== "local" || !ch[KEY] || !ch[KEY].newValue) return;
      var v = ch[KEY].newValue;
      if (!v || typeof v !== "object") return;
      var incoming = normItems(v.sidebar);
      var previousSidebar = st.sidebar;
      st = v;
      st.sidebar = incoming;
      pruneSelection();
      var sameSidebar = JSON.stringify(incoming) === JSON.stringify(previousSidebar);
      renderFocusBlock(st);
      if (sameSidebar) {
        syncMeta();
        renderBatchTools();
        return;
      }
      render();
      persistImages();
    });
  } catch (e) {}

  /* ---------------- 测试钩子（隔离世界专用，命名空间挂 documentElement） ---------------- */
  var collectHook = {
    open: openBar,
    close: closeBar,
    isOpen: isOpen,
    add: function (it) { addItem(it); },
    count: function () { return st.sidebar.length; }
  };
  if (window.__LG_CONTENT_TEST__ === true) {
    collectHook.__test = {
      toggleBatch: function () { batchToggle.click(); },
      toggleSelected: toggleSelected,
      selectVisible: selectVisible,
      clearSelection: clearSelection,
      deleteSelected: deleteSelected,
      undoDelete: undoDelete,
      setFilter: function (type) { filterType = type || "all"; render(); },
      state: function () {
        return {
          batchMode: batchMode,
          selectedIds: Object.keys(selectedIds),
          visibleIds: visibleItems().map(function (item) { return item.id; }),
          sidebarIds: st.sidebar.map(function (item) { return item.id; }),
          selectedCount: selectedItems().length,
          selectAllDisabled: !!selectAllButton.disabled,
          deleteDisabled: !!deleteSelectedButton.disabled,
          undoAvailable: !!undoSnapshot
        };
      }
    };
  }
  document.documentElement.__lgCollect = collectHook;
})();
