/* ============================================================
   收集板内容脚本 —— 任何网页左缘召出
   与新标签页共用同一份 chrome.storage 数据（实时双向同步）。
   界面挂在 Shadow DOM（closed）里，与宿主页面的样式互不污染；
   视觉用毛玻璃（backdrop blur + 白描边），与新标签页同一气质。
   ============================================================ */
(function () {
  "use strict";
  if (window.top !== window) return;                       /* 只在顶层框架注入 */
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
  if (document.documentElement.__lgCollect) return;        /* 防重复注入 */

  var KEY = "lg.newtab";
  var st = { sidebar: [], openInNew: false };
  var openState = false, closeTimer = 0;

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
    try {
      return chrome.runtime.getURL("/_favicon/?pageUrl=" +
        encodeURIComponent(/^https?:/i.test(u) ? u : "https://" + h) + "&pageSize=32");
    } catch (e) { return "https://" + h + "/favicon.ico"; }
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
      var t = (x.type === "image" || x.type === "text") ? x.type : "link";
      var it = {
        id: (typeof x.id === "string" && x.id) ? x.id : uid(),
        type: t,
        title: typeof x.title === "string" ? x.title : "",
        url: typeof x.url === "string" ? x.url : "",
        src: typeof x.src === "string" ? x.src : "",
        text: typeof x.text === "string" ? x.text : "",
        x: (typeof x.x === "number" && isFinite(x.x)) ? x.x : 10,
        y: (typeof x.y === "number" && isFinite(x.y)) ? x.y : 10
      };
      return (t === "text" ? it.text : (it.url || it.src)) ? it : null;
    }).filter(Boolean);
  }
  function saveSidebar() {
    var o = {};
    o[KEY] = st;
    try { chrome.storage.local.set(o); } catch (e) {}
  }
  function addItem(it) {
    it.id = uid();
    it.title = it.title || ""; it.url = it.url || ""; it.src = it.src || ""; it.text = it.text || "";
    /* y 取现有内容的底部级联，新标签页画布打开时位置也自然 */
    var bottom = 10, est = { link: 64, image: 190, text: 120 };
    st.sidebar.forEach(function (o) { bottom = Math.max(bottom, (o.y || 0) + (est[o.type] || 90) + 12); });
    it.x = 10; it.y = bottom;
    st.sidebar.push(it);
    saveSidebar();
    render();
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
.zone{position:fixed;left:0;top:0;bottom:0;width:12px;z-index:2147483646;pointer-events:auto}
.zone::before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);
  width:3px;height:64px;border-radius:0 3px 3px 0;background:rgba(255,255,255,.55);
  box-shadow:0 0 8px rgba(0,0,0,.35);opacity:0;transition:opacity .2s}
.zone:hover::before{opacity:1}
.bar{
  position:fixed;left:0;top:0;bottom:0;width:min(320px,86vw);z-index:2147483647;
  display:flex;flex-direction:column;color:#fff;pointer-events:auto;
  font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;
  background:rgba(24,30,50,.66);
  backdrop-filter:blur(22px) saturate(170%);-webkit-backdrop-filter:blur(22px) saturate(170%);
  border:1px solid rgba(255,255,255,.24);border-left:none;border-radius:0 20px 20px 0;
  box-shadow:14px 0 44px rgba(4,8,18,.4);
  transform:translateX(-108%);
  transition:transform .34s cubic-bezier(.2,.9,.25,1.08);
}
.bar.open{transform:none}
.bar.dropping{border-color:rgba(255,255,255,.66)}
.head{display:flex;align-items:center;gap:10px;padding:14px 16px 10px}
.ttl{flex:1;font-size:14px;font-weight:600;letter-spacing:.4px}
.meta{font-size:11.5px;color:rgba(255,255,255,.6);font-variant-numeric:tabular-nums}
.canvas{flex:1;overflow-y:auto;overflow-x:hidden;padding:4px 12px 12px;display:flex;flex-direction:column;gap:10px}
.canvas::-webkit-scrollbar{width:6px}
.canvas::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:3px}
.empty{font-size:12.5px;color:rgba(255,255,255,.6);padding:12px 6px 0;line-height:1.8}
.hint{padding:8px 16px 12px;font-size:11px;color:rgba(255,255,255,.48)}
.card{position:relative;border-radius:14px;padding:10px 12px;cursor:pointer;overflow:hidden;
  background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.2)}
.card:hover{background:rgba(255,255,255,.17)}
.cap{display:flex;align-items:center;gap:9px;min-width:0}
.ic{width:32px;height:32px;flex:0 0 auto;border-radius:9px;overflow:hidden;
  display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;
  background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3)}
.ic img{width:19px;height:19px;display:block;border-radius:4px}
.col{min-width:0}
.tt{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sub{font-size:11px;color:rgba(255,255,255,.62);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
img.thumb{display:block;width:100%;height:120px;object-fit:cover;border-radius:10px;margin-bottom:8px;background:rgba(255,255,255,.12)}
.note{margin-top:8px;font-size:12.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word;
  display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.del{position:absolute;top:6px;right:8px;width:20px;height:20px;border-radius:50%;z-index:2;
  display:flex;align-items:center;justify-content:center;font-size:12px;line-height:1;cursor:pointer;
  background:rgba(255,255,255,.2);opacity:0;transition:opacity .2s}
.card:hover .del{opacity:1}
.del:hover{background:rgba(255,255,255,.32)}
`;
  var host = document.createElement("div");
  host.id = "lg-collect-host";
  host.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;z-index:2147483646;pointer-events:none;";
  var sh = host.attachShadow({ mode: "closed" });
  sh.innerHTML = "<style>" + CSS + "</style>" +
    '<div class="zone" title="收集板"></div>' +
    '<aside class="bar">' +
    '<div class="head"><span class="ttl">收集板</span><span class="meta">0 项</span></div>' +
    '<div class="canvas"></div>' +
    '<div class="hint">拖入链接 / 图片 / 文字 · Ctrl+V 粘贴 · 新标签页可编辑</div>' +
    '</aside>';
  document.documentElement.appendChild(host);

  var zone = sh.querySelector(".zone");
  var bar = sh.querySelector(".bar");
  var canvas = sh.querySelector(".canvas");
  var meta = sh.querySelector(".meta");

  /* ---------------- 渲染 ---------------- */
  function letterSkin(el, host2) {
    var h = hueOf(host2 || "x");
    el.style.background = "linear-gradient(142deg,hsl(" + h + " 78% 62% / .62),hsl(" + ((h + 44) % 360) + " 72% 44% / .55))";
  }
  function render() {
    canvas.textContent = "";
    if (!st.sidebar.length) {
      var e = document.createElement("div");
      e.className = "empty";
      e.textContent = "还是空的。把本页的链接、图片、选中文字拖进来即可收藏。";
      canvas.appendChild(e);
    }
    st.sidebar.forEach(function (it) {
      var el = document.createElement("div");
      el.className = "card";
      el.title = it.url || it.src || "";
      var html = "";
      if (it.type === "image" && it.src) {
        html += '<img class="thumb" alt="" referrerpolicy="no-referrer" src="' + esc(it.src) + '">';
      }
      html += '<div class="cap">';
      if (it.type === "link") {
        var hst = hostOf(it.url);
        var hue = hueOf(hst || it.title || "x");
        html += '<div class="ic" style="background:linear-gradient(142deg,hsl(' + hue + ' 78% 62% / .62),hsl(' + ((hue + 44) % 360) + ' 72% 44% / .55))">' +
          (favURL(it.url) ? '<img alt="" referrerpolicy="no-referrer" src="' + esc(favURL(it.url)) + '">' : esc((it.title || hst || "?").charAt(0).toUpperCase())) +
          '</div>';
      }
      html += '<div class="col"><div class="tt">' + esc(it.title ||
        (it.type === "link" ? hostOf(it.url) : it.type === "image" ? "图片" : "笔记")) + '</div>';
      if (it.type === "link" && hostOf(it.url)) html += '<div class="sub">' + esc(hostOf(it.url)) + '</div>';
      html += '</div></div>';
      if (it.type === "text" && it.text) html += '<div class="note">' + esc(it.text) + '</div>';
      html += '<div class="del" title="删除">×</div>';
      el.innerHTML = html;

      el.querySelector(".del").addEventListener("click", function (ev) {
        ev.stopPropagation();
        delItem(it.id);
      });
      el.addEventListener("click", function () {
        if (it.type === "link" && it.url) openURL(it.url);
        else if (it.type === "image" && it.src && /^https?:/i.test(it.src)) openURL(it.src);
      });
      canvas.appendChild(el);
    });
    meta.textContent = st.sidebar.length + " 项";
  }
  function syncMeta() { meta.textContent = st.sidebar.length + " 项"; }

  /* ---------------- 开合 ---------------- */
  function isOpen() { return openState; }
  function openBar() {
    clearTimeout(closeTimer);
    if (openState) return;
    openState = true;
    bar.classList.add("open");
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
    if (e.key === "Escape") closeBar();
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
      var src = mIm[1];
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
    render();
  });
  try {
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== "local" || !ch[KEY] || !ch[KEY].newValue) return;
      var v = ch[KEY].newValue;
      if (!v || typeof v !== "object") return;
      st = v;
      if (!Array.isArray(st.sidebar)) st.sidebar = [];
      render();
    });
  } catch (e) {}

  /* ---------------- 测试钩子（隔离世界专用，命名空间挂 documentElement） ---------------- */
  document.documentElement.__lgCollect = {
    open: openBar,
    close: closeBar,
    isOpen: isOpen,
    add: function (it) { addItem(it); },
    count: function () { return st.sidebar.length; }
  };
})();
