/* ============================================================
   Liquid Glass 新标签页 — 功能层
   存储优先用 chrome.storage.local；在没有扩展 API 的环境
   （例如直接用 file:// 打开预览）自动退回 localStorage，
   因此同一份文件既能装进 Edge，也能直接双击预览。
   ============================================================ */
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }
  var noop = function () {};

  /* ---------------- 常量表 ---------------- */
  var WALLS = [
    { id: "aurora", name: "极光", css: "linear-gradient(125deg,#241159 0%,#3a53c9 26%,#2fa2e0 44%,#8a5fd8 60%,#f0705c 78%,#ffd08a 100%)" },
    { id: "dusk",   name: "暮色", css: "linear-gradient(140deg,#0f1b3d 0%,#3b2a6b 30%,#8a3f7d 58%,#e8683f 82%,#ffc978 100%)" },
    { id: "mint",   name: "薄荷", css: "linear-gradient(135deg,#062b33 0%,#0f6f6b 34%,#39b98d 58%,#a8dc7a 82%,#f4f0a4 100%)" },
    { id: "peach",  name: "蜜桃", css: "linear-gradient(130deg,#3a1140 0%,#8e2f6b 32%,#e0526f 58%,#ff9a68 80%,#ffd9a0 100%)" },
    { id: "steel",  name: "钢蓝", css: "linear-gradient(150deg,#0a1220 0%,#1d3557 34%,#457b9d 62%,#a8c8dd 88%,#e8f0f5 100%)" },
    { id: "ink",    name: "子夜", css: "linear-gradient(160deg,#0b0f18 0%,#1d2340 34%,#3b2f63 62%,#6d3f6b 84%,#b05a63 100%)" }
  ];
  var ENGINES = [
    { id: "bing",   name: "Bing",       url: "https://www.bing.com/search?q=" },
    { id: "baidu",  name: "百度",       url: "https://www.baidu.com/s?wd=" },
    { id: "google", name: "Google",     url: "https://www.google.com/search?q=" },
    { id: "ddg",    name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" }
  ];
  var CITIES = [
    { n: "上海", lat: 31.23, lon: 121.47 },
    { n: "北京", lat: 39.90, lon: 116.41 },
    { n: "广州", lat: 23.13, lon: 113.26 },
    { n: "深圳", lat: 22.54, lon: 114.06 },
    { n: "杭州", lat: 30.27, lon: 120.16 },
    { n: "成都", lat: 30.57, lon: 104.07 }
  ];
  var WMO = {
    0: "晴", 1: "大部晴朗", 2: "多云", 3: "阴", 45: "有雾", 48: "雾凇",
    51: "小毛毛雨", 53: "毛毛雨", 55: "大毛毛雨", 56: "冻毛毛雨", 57: "冻毛毛雨",
    61: "小雨", 63: "中雨", 65: "大雨", 66: "冻雨", 67: "冻雨",
    71: "小雪", 73: "中雪", 75: "大雪", 77: "雪粒",
    80: "小阵雨", 81: "阵雨", 82: "强阵雨", 85: "小阵雪", 86: "阵雪",
    95: "雷阵雨", 96: "雷阵雨伴冰雹", 99: "强雷暴伴冰雹"
  };
  var DEFAULT_SHORTCUTS = [
    { n: "GitHub",  u: "https://github.com" },
    { n: "掘金",    u: "https://juejin.cn" },
    { n: "哔哩哔哩", u: "https://www.bilibili.com" },
    { n: "知乎",    u: "https://www.zhihu.com" },
    { n: "MDN",     u: "https://developer.mozilla.org" },
    { n: "Stack Overflow", u: "https://stackoverflow.com" }
  ];
  var DEFAULT_SEED_VERSION = 2;
  var DEFAULT_PAGES = [
    { id: "common", name: "常用", items: [
      ["百度", "https://www.baidu.com"], ["Bing", "https://www.bing.com"],
      ["GitHub", "https://github.com"], ["哔哩哔哩", "https://www.bilibili.com"],
      ["知乎", "https://www.zhihu.com"], ["淘宝", "https://www.taobao.com"],
      ["京东", "https://www.jd.com"], ["微信网页版", "https://wx.qq.com"]
    ] },
    { id: "development", name: "开发编程", items: [
      ["GitHub", "https://github.com"], ["GitLab", "https://gitlab.com"],
      ["Gitee", "https://gitee.com"], ["Stack Overflow", "https://stackoverflow.com"],
      ["MDN", "https://developer.mozilla.org"], ["npm", "https://www.npmjs.com"],
      ["Docker", "https://www.docker.com"], ["Vercel", "https://vercel.com"]
    ] },
    { id: "learning", name: "学习资料", items: [
      ["Wikipedia", "https://www.wikipedia.org"], ["Google Scholar", "https://scholar.google.com"],
      ["中国大学MOOC", "https://www.icourse163.org"], ["学堂在线", "https://www.xuetangx.com"],
      ["Coursera", "https://www.coursera.org"], ["edX", "https://www.edx.org"],
      ["Microsoft Learn", "https://learn.microsoft.com"], ["W3Schools", "https://www.w3schools.com"]
    ] },
    { id: "news", name: "资讯社区", items: [
      ["少数派", "https://sspai.com"], ["IT之家", "https://www.ithome.com"],
      ["36氪", "https://36kr.com"], ["澎湃新闻", "https://www.thepaper.cn"],
      ["Hacker News", "https://news.ycombinator.com"], ["Reddit", "https://www.reddit.com"],
      ["豆瓣", "https://www.douban.com"], ["知乎", "https://www.zhihu.com"]
    ] },
    { id: "entertainment", name: "视频娱乐", items: [
      ["哔哩哔哩", "https://www.bilibili.com"], ["YouTube", "https://www.youtube.com"],
      ["Twitch", "https://www.twitch.tv"], ["Steam", "https://store.steampowered.com"],
      ["腾讯视频", "https://v.qq.com"], ["网易云音乐", "https://music.163.com"],
      ["Spotify", "https://open.spotify.com"], ["豆瓣", "https://www.douban.com"]
    ] },
    { id: "productivity", name: "工具效率", items: [
      ["Notion", "https://www.notion.so"], ["Google Drive", "https://drive.google.com"],
      ["腾讯文档", "https://docs.qq.com"], ["WPS", "https://www.wps.cn"],
      ["Canva", "https://www.canva.com"], ["Figma", "https://www.figma.com"],
      ["Trello", "https://trello.com"], ["番茄钟", "https://pomofocus.io"]
    ] },
    { id: "ai", name: "AI 工具", items: [
      ["ChatGPT", "https://chatgpt.com"], ["DeepSeek", "https://chat.deepseek.com"],
      ["Claude", "https://claude.ai"], ["Gemini", "https://gemini.google.com"],
      ["Hugging Face", "https://huggingface.co"], ["Perplexity", "https://www.perplexity.ai"],
      ["Poe", "https://poe.com"], ["OpenRouter", "https://openrouter.ai"]
    ] },
    { id: "life", name: "生活消费", items: [
      ["淘宝", "https://www.taobao.com"], ["京东", "https://www.jd.com"],
      ["美团", "https://www.meituan.com"], ["大众点评", "https://www.dianping.com"],
      ["携程", "https://www.ctrip.com"], ["什么值得买", "https://www.smzdm.com"],
      ["12306", "https://www.12306.cn"], ["高德地图", "https://www.amap.com"]
    ] }
  ];
  function defaultPages() {
    return DEFAULT_PAGES.map(function (p) {
      return {
        id: p.id,
        name: p.name,
        items: p.items.map(function (x) { return { n: x[0], u: x[1] }; }),
        cal: p.id === "common" ? { x: 0, y: 0 } : null,
        todo: p.id === "common" ? { x: 0, y: 0 } : null
      };
    });
  }
  var G0 = { band: 0.16, str: 0.22, disp: 1 };

  /* ---------------- 状态与存储 ---------------- */
  var HAS_CHROME = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local);
  var HAS_FAVICON = HAS_CHROME && typeof chrome.runtime !== "undefined" && !!chrome.runtime.getURL;
  var KEY = "lg.newtab";
  var S = null;

  function defaults() {
    return {
      seedVersion: DEFAULT_SEED_VERSION,
      pages: defaultPages(),
      calMig: true,   /* 全新安装无需迁移 */
      todos: [],
      cd: null,
      activePage: "common",
      sidebar: [],
      searchHistory: [],
      engine: "bing",
      city: { n: "上海", lat: 31.23, lon: 121.47 },
      geo: null,
      openInNew: false,
      wall: { mode: "preset", id: "aurora", url: "" },
      tex: 1,
      glass: { band: G0.band, str: G0.str, disp: G0.disp },
      drops: true,
      layout: { search: { x: 0, y: 0 }, tiles: { x: 0, y: 0 }, todo: { x: 0, y: 0 }, weather: { x: 0, y: 0 } }
    };
  }
  function normalize(o) {
    var d = defaults();
    function normPos(v) {
      return (v && typeof v.x === "number" && typeof v.y === "number" &&
              isFinite(v.x) && isFinite(v.y)) ? { x: v.x, y: v.y } : null;
    }
    if (!o || typeof o !== "object") return d;
    if (Array.isArray(o.pages)) {
      d.pages = o.pages.slice(0, 20).map(function (p, i) {
        if (!p || typeof p !== "object") return null;
        return {
          id: (typeof p.id === "string" && p.id) ? p.id : "pg" + (i + 1),
          name: (typeof p.name === "string" && p.name) ? p.name.slice(0, 12) : "页面 " + (i + 1),
          items: (Array.isArray(p.items) ? p.items : []).filter(function (x) { return x && x.u; })
            .map(function (x) { return { n: x.n || "", u: x.u }; }).slice(0, 60),
          /* 小组件按页可选：显式给出才显示；便签文本始终保留 */
          cal: normPos(p.cal),
          todo: normPos(p.todo),
          note: normPos(p.note),
          cd: normPos(p.cd),
          noteText: (typeof p.noteText === "string") ? p.noteText.slice(0, 2000) : ""
        };
      }).filter(function (p) { return !!p; });
      if (!d.pages.length) d.pages = defaults().pages;
    } else if (Array.isArray(o.shortcuts)) {
      /* 旧版单页数据迁移 */
      d.pages = [{
        id: "home", name: "首页",
        items: o.shortcuts.filter(function (x) { return x && x.u; })
          .map(function (x) { return { n: x.n || "", u: x.u }; })
      }];
    }
    /* 一次性迁移：日历从"每页都有"改为"可选小组件"——只保留第一页的 */
    d.calMig = o.calMig === true;
    if (!d.calMig && d.pages.length) {
      d.pages[0].cal = d.pages[0].cal || { x: 0, y: 0 };
      for (var mi = 1; mi < d.pages.length; mi++) d.pages[mi].cal = null;
      d.calMig = true;
    }
    if (Array.isArray(o.todos)) {
      d.todos = o.todos.filter(function (x) { return x && typeof x.t === "string"; })
        .map(function (x) { return { t: x.t.slice(0, 60), done: !!x.done }; }).slice(0, 30);
    }
    if (o.cd && typeof o.cd === "object" && /^\d{4}-\d{2}-\d{2}$/.test(o.cd.d || "")) {
      d.cd = { n: (typeof o.cd.n === "string" && o.cd.n) ? o.cd.n.slice(0, 20) : "倒数日", d: o.cd.d };
    }
    if (Array.isArray(o.sidebar)) {
      d.sidebar = o.sidebar.slice(0, 200).map(function (x) {
        if (!x || typeof x !== "object") return null;
        var t = (x.type === "image" || x.type === "text") ? x.type : "link";
        var it = {
          id: (typeof x.id === "string" && x.id) ? x.id : sbUid(),
          type: t,
          title: typeof x.title === "string" ? x.title : "",
          url: typeof x.url === "string" ? x.url : "",
          src: typeof x.src === "string" ? x.src : "",
          text: typeof x.text === "string" ? x.text : "",
          x: (typeof x.x === "number" && isFinite(x.x)) ? x.x : 14,
          y: (typeof x.y === "number" && isFinite(x.y)) ? x.y : 14
        };
        return (t === "text" ? it.text : (it.url || it.src)) ? it : null;
      }).filter(function (x) { return !!x; });
    }
    if (typeof o.engine === "string") d.engine = o.engine;
    if (Array.isArray(o.searchHistory)) {
      d.searchHistory = o.searchHistory.filter(function (x) { return typeof x === "string" && x; }).slice(0, 12);
    }
    if (typeof o.openInNew === "boolean") d.openInNew = o.openInNew;
    if (o.geo && typeof o.geo.lat === "number" && typeof o.geo.lon === "number" &&
        isFinite(o.geo.lat) && isFinite(o.geo.lon)) {
      d.geo = { lat: o.geo.lat, lon: o.geo.lon, n: (typeof o.geo.n === "string" && o.geo.n) || "当前位置" };
    }
    if (o.city) {
      if (typeof o.city === "string") {
        CITIES.forEach(function (c) { if (c.n === o.city) d.city = { n: c.n, lat: c.lat, lon: c.lon }; });
      } else if (typeof o.city.lat === "number" && typeof o.city.lon === "number" &&
                 isFinite(o.city.lat) && isFinite(o.city.lon)) {
        d.city = { n: (typeof o.city.n === "string" && o.city.n) || "自定义", lat: o.city.lat, lon: o.city.lon };
      }
    }
    if (o.wall && typeof o.wall === "object") {
      d.wall = {
        mode: (o.wall.mode === "url" || o.wall.mode === "bing") ? o.wall.mode : "preset",
        id: typeof o.wall.id === "string" ? o.wall.id : "aurora",
        url: typeof o.wall.url === "string" ? o.wall.url : ""
      };
    }
    if (typeof o.tex === "number") d.tex = Math.min(2, Math.max(0, o.tex));
    if (o.glass && typeof o.glass === "object") {
      ["band", "str", "disp"].forEach(function (k) {
        if (typeof o.glass[k] === "number") d.glass[k] = o.glass[k];
      });
    }
    if (typeof o.drops === "boolean") d.drops = o.drops;
    if (typeof o.activePage === "string") d.activePage = o.activePage;
    var hasActive = false;
    d.pages.forEach(function (p) { if (p.id === d.activePage) hasActive = true; });
    if (!hasActive) d.activePage = d.pages[0].id;
    if (o.layout && typeof o.layout === "object") {
      ["search", "tiles", "todo", "weather"].forEach(function (k) {
        var v = o.layout[k];
        if (v && typeof v.x === "number" && typeof v.y === "number" &&
            isFinite(v.x) && isFinite(v.y)) {
          d.layout[k] = { x: v.x, y: v.y };
        }
      });
      /* 旧版全局日历摆位迁移到第一个页面 */
      var oc = o.layout.cal;
      if (oc && typeof oc.x === "number" && typeof oc.y === "number" &&
          isFinite(oc.x) && isFinite(oc.y) && (oc.x || oc.y) && d.pages.length) {
        d.pages[0].cal = { x: oc.x, y: oc.y };
      }
    }
    return d;
  }
  var store = {
    load: function (cb) {
      if (HAS_CHROME) {
        chrome.storage.local.get(KEY, function (o) {
          cb(normalize(o && o[KEY]));
        });
      } else {
        var raw = null;
        try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
        var parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch (e2) { parsed = null; }
        cb(normalize(parsed));
      }
    },
    save: function (patch) {
      if (patch) Object.keys(patch).forEach(function (k) { S[k] = patch[k]; });
      var payload = {};
      payload[KEY] = S;
      if (HAS_CHROME) {
        chrome.storage.local.set(payload, noop);
      } else {
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("保存失败：本地存储配额不足"); }
      }
    }
  };

  /* ---------------- 小工具 ---------------- */
  var toastTimer = 0;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    window.LiquidGlass.refresh();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
  function hostOf(u) {
    var m = /^https?:\/\/([^\/:?#]+)/i.exec(u || "");
    return m ? m[1].toLowerCase() : "";
  }
  /* 图标地址：扩展环境用浏览器自带的 favicon 数据库（命中率远高于猜 /favicon.ico），
     file:// 预览退回老办法 */
  function faviconURL(u) {
    var h = hostOf(u);
    if (!h) return "";
    if (HAS_FAVICON) {
      return chrome.runtime.getURL("/_favicon/?pageUrl=" +
        encodeURIComponent(/^https?:/i.test(u) ? u : "https://" + h) + "&pageSize=32");
    }
    return "https://" + h + "/favicon.ico";
  }
  /* 链接打开方式统一走这里（设置里可切换当前页 / 新标签） */
  function openURL(u) {
    if (!u) return;
    if (S && S.openInNew) window.open(u, "_blank");
    else location.href = u;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /* 由域名派生一个稳定色相：favicon 取不到时，字母头像也是有设计感的，而不是一块灰 */
  function hueOf(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function letterSkin(el, host) {
    var h = hueOf(host || "x");
    el.style.background = "linear-gradient(142deg,hsl(" + h + " 78% 62% / .62),hsl(" + ((h + 44) % 360) + " 72% 44% / .55))";
    el.style.textShadow = "0 1px 6px rgba(0,0,0,.3)";
  }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  /* ---------------- 时钟 ---------------- */
  var WEEK = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  function greet(h) {
    if (h < 5) return "夜深了";
    if (h < 9) return "早上好";
    if (h < 12) return "上午好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    if (h < 23) return "晚上好";
    return "夜深了";
  }
  var lastClock = "", lastDate = "";
  /* 时间与日期都画在 SVG 文字里：可见字形与玻璃遮罩用同一套坐标与字体，保证严格对齐 */
  function tick() {
    var d = new Date();
    var t = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
    if (t !== lastClock) {
      lastClock = t;
      var gc = $("gvClock"), mc = $("gmClock");
      if (gc) gc.textContent = t;
      if (mc) mc.textContent = t;
    }
    var line = d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日 " +
      WEEK[d.getDay()] + " · " + greet(d.getHours());
    if (line !== lastDate) {
      lastDate = line;
      var gd = $("gvDate"), md = $("gmDate");
      if (gd) gd.textContent = line;
      if (md) md.textContent = line;
      var box = $("clockBox");
      if (box) box.setAttribute("aria-label", line + "  " + t);
    }
  }
  /* 时钟是固定像素布局（遮罩坐标依赖它），小屏靠整体缩放 */
  function fitClock() {
    var box = $("clockBox");
    if (!box) return;
    var s = Math.min(1, Math.max(0.52, (window.innerWidth - 80) / 760));
    box.style.transform = "scale(" + s.toFixed(3) + ")";
    var pad = ((s - 1) * 73).toFixed(1) + "px";
    box.style.marginTop = pad;
    box.style.marginBottom = pad;
  }

  /* ---------------- 搜索 ---------------- */
  function currentEngine() {
    for (var i = 0; i < ENGINES.length; i++) if (ENGINES[i].id === S.engine) return ENGINES[i];
    return ENGINES[0];
  }
  function pushHistory(v) {
    S.searchHistory = [v].concat(S.searchHistory.filter(function (x) { return x !== v; })).slice(0, 12);
    store.save({ searchHistory: S.searchHistory });
  }
  function go(input) {
    var v = (input || "").trim();
    if (!v) return;
    var looksUrl = /^https?:\/\//i.test(v) ||
      (!/\s/.test(v) && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v));
    if (looksUrl) {
      openURL(/^https?:\/\//i.test(v) ? v : "https://" + v);
      return;
    }
    pushHistory(v);
    openURL(currentEngine().url + encodeURIComponent(v));
  }

  /* ---------------- 搜索引擎下拉 ---------------- */
  /* 引擎按钮宽度随名字自适应（Bing 与 DuckDuckGo 差约一倍），
     输入框的左内边距必须跟着按钮实际宽度走，否则长引擎名会盖住输入文字的开头 */
  function syncSearchPad() {
    var btn = $("engineBtn"), q = $("q");
    if (!btn || !q) return;
    var w = btn.getBoundingClientRect().width;
    if (w > 0) q.style.paddingLeft = Math.round(w + 16) + "px";
  }
  function syncEngineMenu() {
    var box = $("engineMenu");
    [].slice.call(box.children).forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-id") === S.engine);
    });
    $("engineName").textContent = currentEngine().name;
    syncSearchPad();
  }
  function buildEngineMenu() {
    var box = $("engineMenu");
    box.textContent = "";
    ENGINES.forEach(function (en) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "glass eitem";
      b.setAttribute("data-glass", "");
      b.setAttribute("role", "menuitemradio");
      b.setAttribute("data-id", en.id);
      var nm = document.createElement("span");
      nm.textContent = en.name;
      var tk = document.createElement("span");
      tk.className = "tick";
      tk.textContent = "✓";
      b.appendChild(nm);
      b.appendChild(tk);
      b.addEventListener("click", function () {
        S.engine = en.id;
        store.save({ engine: en.id });
        syncEngineMenu();
        toggleEngineMenu(false);
        $("q").focus();
      });
      box.appendChild(b);
    });
    syncEngineMenu();
  }
  function toggleEngineMenu(open) {
    var box = $("engineMenu"), btn = $("engineBtn");
    var next = (open === undefined) ? !box.classList.contains("open") : !!open;
    box.classList.toggle("open", next);
    btn.classList.toggle("open", next);
    btn.setAttribute("aria-expanded", next ? "true" : "false");
    if (next) {
      window.LiquidGlass.refresh();
      var on = box.querySelector(".eitem.on") || box.firstChild;
      if (on && on.focus) setTimeout(function () { on.focus(); }, 60);
    }
  }

  /* ---------------- 搜索联想 / 历史 ----------------
     输入时按当前引擎拉联想词（各引擎公开接口），空输入聚焦时展示历史。
     接口失败（无网/无权限）静默降级为仅历史。 */
  var SVG_CLOCK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 2"/></svg>';
  var SVG_MAG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>';
  function sugParsePair(j) { return (j && Array.isArray(j[1])) ? j[1] : []; }
  var SUGGEST_API = {
    bing:   { url: "https://api.bing.com/osjson.aspx?query=", parse: sugParsePair },
    baidu:  { url: "https://www.baidu.com/sugrec?prod=pc&wd=", parse: function (j) { return (j && j.g ? j.g : []).map(function (x) { return x.k; }); } },
    google: { url: "https://www.google.com/complete/search?client=firefox&q=", parse: sugParsePair },
    ddg:    { url: "https://duckduckgo.com/ac/?type=list&q=", parse: sugParsePair }
  };
  var sugSeq = 0, sugIdx = -1, sugList = [];
  function fetchSuggest(q, cb) {
    var api = SUGGEST_API[S.engine] || SUGGEST_API.bing;
    var seq = ++sugSeq;
    fetch(api.url + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (j) {
      if (seq !== sugSeq) return;
      cb(api.parse(j).filter(function (x) { return typeof x === "string" && x; }).slice(0, 8));
    }).catch(function () { if (seq === sugSeq) cb([]); });
  }
  function sugSyncHi() {
    [].slice.call($("smenu").querySelectorAll(".sitem")).forEach(function (b, i) {
      b.classList.toggle("on", i === sugIdx);
    });
  }
  function smenuShow(list, isHistory) {
    var box = $("smenu");
    sugList = list; sugIdx = -1;
    box.textContent = "";
    if (!list.length) { box.classList.remove("open"); return; }
    var ic = isHistory ? SVG_CLOCK : SVG_MAG;
    list.forEach(function (text) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "glass sitem";
      b.setAttribute("data-glass", "");
      b.setAttribute("role", "option");
      b.innerHTML = ic + '<span class="stx">' + esc(text) + '</span>';
      b.addEventListener("mousedown", function (ev) { ev.preventDefault(); });  /* 别让输入框先失焦 */
      b.addEventListener("click", function () { $("q").value = text; smenuHide(); go(text); });
      box.appendChild(b);
    });
    if (isHistory) {
      var clr = document.createElement("button");
      clr.type = "button";
      clr.className = "sclr";
      clr.textContent = "清空搜索历史";
      clr.addEventListener("click", function () {
        S.searchHistory = [];
        store.save({ searchHistory: S.searchHistory });
        smenuHide();
        toast("已清空搜索历史");
      });
      box.appendChild(clr);
    }
    box.classList.add("open");
    window.LiquidGlass.refresh();
  }
  function smenuHide() { $("smenu").classList.remove("open"); sugIdx = -1; sugList = []; }
  function smenuIsOpen() { return $("smenu").classList.contains("open"); }
  function sugKey(e) {
    if (!smenuIsOpen()) return false;
    var n = sugList.length;
    if (!n) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      sugIdx = (sugIdx + 1) % n;
      sugSyncHi();
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      sugIdx = (sugIdx - 1 + n) % n;
      sugSyncHi();
      return true;
    }
    if (e.key === "Enter" && sugIdx >= 0) {
      e.preventDefault();
      var text = sugList[sugIdx];
      $("q").value = text;
      smenuHide();
      go(text);
      return true;
    }
    return false;
  }
  function initSuggest() {
    var q = $("q");
    var sugTimer = 0;
    q.addEventListener("input", function () {
      var v = q.value.trim();
      clearTimeout(sugTimer);
      if (!v) {
        smenuShow(S.searchHistory.slice(0, 8), true);
        return;
      }
      sugTimer = setTimeout(function () {
        fetchSuggest(v, function (list) {
          if (q.value.trim() !== v) return;
          smenuShow(list, false);
        });
      }, 180);
    });
    q.addEventListener("focus", function () {
      if (!q.value.trim() && S.searchHistory.length) smenuShow(S.searchHistory.slice(0, 8), true);
    });
    q.addEventListener("blur", function () { setTimeout(smenuHide, 140); });
    q.addEventListener("keydown", sugKey);
    document.addEventListener("pointerdown", function (e) {
      if (!smenuIsOpen()) return;
      if (e.target && e.target.closest && e.target.closest("#smenu, #q")) return;
      smenuHide();
    });
  }

  /* ---------------- 快捷方式（多页面） ---------------- */
  function activePage() {
    for (var i = 0; i < S.pages.length; i++) if (S.pages[i].id === S.activePage) return S.pages[i];
    return S.pages[0];
  }
  function pageUid() { return "pg" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function tileEl(sc) {
    var el = document.createElement("div");
    el.className = "glass tile";
    el.setAttribute("data-glass", "");
    el.title = sc.u;

    var ic = document.createElement("div");
    ic.className = "ic";
    ic.textContent = (sc.n || hostOf(sc.u) || "?").trim().charAt(0).toUpperCase();

    var host = hostOf(sc.u);
    var fav = faviconURL(sc.u);
    if (fav) {
      var settled = false;
      var img = new Image();
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("load", function () {
        settled = true;
        ic.textContent = "";
        ic.appendChild(img);
      });
      img.addEventListener("error", function () { settled = true; letterSkin(ic, host); });
      img.src = fav;
      setTimeout(function () { if (!settled) letterSkin(ic, host); }, 2500);
    } else {
      letterSkin(ic, sc.n || "x");
    }

    var nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = sc.n || host;

    var menu = document.createElement("div");
    menu.className = "menu";
    menu.textContent = "⋯";
    menu.title = "编辑";
    menu.addEventListener("click", function (ev) {
      ev.stopPropagation();
      openDialog(activePage().items.indexOf(sc));
    });

    el.appendChild(ic); el.appendChild(nm); el.appendChild(menu);
    el.addEventListener("click", function () { openURL(sc.u); });
    return el;
  }
  function renderTiles() {
    var box = $("tileGrid");
    box.textContent = "";

    activePage().items.forEach(function (sc) {
      var el = tileEl(sc);
      attachTileDrag(el, sc);
      box.appendChild(el);
    });

    var add = document.createElement("div");
    add.className = "glass tile add";
    add.setAttribute("data-glass", "");
    var aic = document.createElement("div");
    aic.className = "ic"; aic.textContent = "+";
    var anm = document.createElement("div");
    anm.className = "nm"; anm.textContent = "添加";
    add.appendChild(aic); add.appendChild(anm);
    add.addEventListener("click", function () { openDialog(-1); });
    box.appendChild(add);

    /* 瓦片就是普通 .glass 元素，交给折射引擎统一处理 */
    window.LiquidGlass.refresh();
  }

  /* ================= 快捷方式拖动 =================
     网格排序模式：拖动只负责"搬起来"（弹簧物理照旧），
     松手按落点最近的格子换位，顺序落盘后重排。不再存自由位移。 */
  function tileReorder(sc, d) {
    var pg = activePage();
    var px = d.nat.l + d.cx + d.nat.w / 2, py = d.nat.t + d.cy + d.nat.h / 2;
    var els = [].slice.call($("tileGrid").querySelectorAll(".tile"));
    var from = pg.items.indexOf(sc);
    if (from < 0 || from >= els.length) { renderTiles(); return; }
    var best = -1, bd = Infinity;
    for (var i = 0; i < pg.items.length; i++) {
      if (i === from || !els[i]) continue;
      var r = els[i].getBoundingClientRect();
      var dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
      var dist = dx * dx + dy * dy;
      if (dist < bd) { bd = dist; best = i; }
    }
    /* 落点离任何格子都太远 → 原位放回 */
    var th = els[0] ? Math.pow(els[0].getBoundingClientRect().width * 0.62, 2) * 2 : 0;
    if (best < 0 || bd > th) { renderTiles(); return; }
    pg.items.splice(from, 1);
    pg.items.splice(best, 0, sc);
    store.save({ pages: S.pages });
    renderTiles();
  }

  /* ---------------- 编辑对话框 ---------------- */
  var dlgIdx = -1;
  function openDialog(i) {
    dlgIdx = i;
    var editing = i >= 0;
    var pg = activePage();
    $("dlgTitle").textContent = (editing ? "编辑快捷方式" : "添加快捷方式") + " · " + pg.name;
    $("dlgName").value = editing ? (pg.items[i].n || "") : "";
    $("dlgUrl").value = editing ? (pg.items[i].u || "") : "";
    $("dlgDel").style.visibility = editing ? "visible" : "hidden";
    $("dialog").classList.add("open");
    window.LiquidGlass.refresh();
    setTimeout(function () { $("dlgName").focus(); }, 30);
  }
  function closeDialog() { $("dialog").classList.remove("open"); }
  function saveDialog() {
    var n = $("dlgName").value.trim();
    var u = $("dlgUrl").value.trim();
    if (!u) { toast("请填写网址"); return; }
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    var sc = { n: n || hostOf(u), u: u };
    var pg = activePage();
    if (dlgIdx >= 0) pg.items[dlgIdx] = sc;
    else pg.items.push(sc);
    store.save({ pages: S.pages });
    renderTiles();
    closeDialog();
  }
  function delDialog() {
    if (dlgIdx < 0) return;
    var pg = activePage();
    pg.items.splice(dlgIdx, 1);
    store.save({ pages: S.pages });
    renderTiles();
    closeDialog();
  }

  /* ---------------- 底部横向换页框 ----------------
     学习 itab 的分组侧栏，改为横放在瓦片下方：
     页签点击切换页面，双击改名，右键删除页。 */
  function buildPager() {
    var box = $("pager");
    box.textContent = "";
    S.pages.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ptab glass" + (p.id === S.activePage ? " on" : "");
      b.setAttribute("data-glass", "");
      b.setAttribute("data-id", p.id);
      b.textContent = p.name;
      b.title = "点击切换 · 双击改名 · 右键删除";
      b.addEventListener("click", function () { switchPage(p.id); });
      b.addEventListener("dblclick", function () { renamePage(p, b); });
      b.addEventListener("contextmenu", function (ev) {
        ev.preventDefault();
        deletePage(p);
      });
      box.appendChild(b);
    });
    var add = document.createElement("button");
    add.type = "button";
    add.className = "ptab add";
    add.textContent = "+";
    add.title = "新建页面";
    add.addEventListener("click", function () {
      var pg = { id: pageUid(), name: "页面 " + (S.pages.length + 1), items: [], cal: null };
      S.pages.push(pg);
      S.activePage = pg.id;
      store.save({ pages: S.pages, activePage: S.activePage });
      switchPage(pg.id, true);
      toast("已新建页面，双击页签可改名");
    });
    box.appendChild(add);
    [].slice.call(box.querySelectorAll(".ptab")).forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-id") === S.activePage);
    });
  }
  function switchPage(id, skipSave) {
    if (S.activePage !== id) {
      S.activePage = id;
      if (!skipSave) store.save({ activePage: id });
    }
    var grid = $("tileGrid");
    var cal = $("calWrap");
    grid.classList.add("out");
    if (cal) cal.classList.add("out");   /* 日历与瓦片一起滑出 */
    setTimeout(function () {
      renderTiles();
      buildPager();
      renderNote();                      /* 便签内容随页切换 */
      applyLayout();                     /* 小组件切到新页面自己的摆位（隐藏间隙内换装） */
      grid.classList.remove("out");
      if (cal) cal.classList.remove("out");
      window.LiquidGlass.refresh();
    }, 180);
  }
  function renamePage(p, btn) {
    var input = document.createElement("input");
    input.type = "text";
    input.value = p.name;
    input.maxLength = 12;
    input.className = "ptab rename";
    btn.replaceWith(input);
    input.focus();
    input.select();
    var commit = function () {
      var v = input.value.trim();
      if (v) p.name = v;
      store.save({ pages: S.pages });
      buildPager();
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); input.blur(); }
      if (ev.key === "Escape") { input.value = p.name; input.blur(); }
    });
  }
  function deletePage(p) {
    if (S.pages.length <= 1) { toast("至少保留一个页面"); return; }
    S.pages = S.pages.filter(function (x) { return x.id !== p.id; });
    if (S.activePage === p.id) S.activePage = S.pages[0].id;
    store.save({ pages: S.pages, activePage: S.activePage });
    renderTiles();
    buildPager();
    toast("已删除「" + p.name + "」");
  }

  /* ---------------- 日历 ---------------- */
  var calY = 0, calM = 0;
  function renderCal() {
    var grid = $("calGrid");
    grid.textContent = "";
    var first = new Date(calY, calM, 1);
    var startDow = first.getDay();
    var days = new Date(calY, calM + 1, 0).getDate();
    var prevDays = new Date(calY, calM, 0).getDate();
    var rows = Math.ceil((startDow + days) / 7);
    var now = new Date();
    var isCur = now.getFullYear() === calY && now.getMonth() === calM;
    for (var i = 0; i < rows * 7; i++) {
      var cell = document.createElement("div");
      var cls = "calcell", num;
      if (i < startDow) { num = prevDays - startDow + 1 + i; cls += " dim"; }
      else if (i - startDow < days) {
        num = i - startDow + 1;
        var dow = i % 7;
        if (dow === 0 || dow === 6) cls += " wknd";
        if (isCur && num === now.getDate()) cls += " today";
      } else { num = i - startDow - days + 1; cls += " dim"; }
      cell.className = cls;
      cell.textContent = num;
      grid.appendChild(cell);
    }
    $("calTitle").textContent = calY + "年" + (calM + 1) + "月";
    window.LiquidGlass.refresh();
  }
  function calShift(d) {
    calM += d;
    if (calM < 0) { calM = 11; calY--; }
    else if (calM > 11) { calM = 0; calY++; }
    renderCal();
  }

  /* ---------------- 小组件：待办 / 便签 / 倒数日 ---------------- */
  function renderTodos() {
    var box = $("todoList");
    box.textContent = "";
    if (!S.todos.length) {
      var e = document.createElement("div");
      e.className = "tempty";
      e.textContent = "还没有待办";
      box.appendChild(e);
      return;
    }
    S.todos.forEach(function (t, i) {
      var row = document.createElement("div");
      row.className = "titem" + (t.done ? " done" : "");
      var chk = document.createElement("span");
      chk.className = "tchk";
      chk.title = t.done ? "标记为未完成" : "标记为已完成";
      chk.addEventListener("click", function () {
        t.done = !t.done;
        store.save({ todos: S.todos });
        renderTodos();
      });
      var tx = document.createElement("span");
      tx.className = "ttxt";
      tx.textContent = t.t;
      tx.title = t.t;
      var del = document.createElement("span");
      del.className = "tdel";
      del.textContent = "×";
      del.title = "删除";
      del.addEventListener("click", function () {
        S.todos.splice(i, 1);
        store.save({ todos: S.todos });
        renderTodos();
      });
      row.appendChild(chk); row.appendChild(tx); row.appendChild(del);
      box.appendChild(row);
    });
  }
  function addTodo() {
    var v = $("todoInput").value.trim();
    if (!v) return;
    S.todos.unshift({ t: v.slice(0, 60), done: false });
    if (S.todos.length > 30) S.todos.length = 30;
    $("todoInput").value = "";
    store.save({ todos: S.todos });
    renderTodos();
  }
  var noteTimer = 0;
  function renderNote() {
    $("noteText").value = activePage().noteText || "";
  }
  function renderCd() {
    var body = $("cdBody");
    body.textContent = "";
    if (!S.cd) {
      var name = document.createElement("input");
      name.id = "cdName"; name.maxLength = 20; name.placeholder = "事件名称，如：考试";
      var date = document.createElement("input");
      date.id = "cdDate"; date.type = "date";
      var go = document.createElement("button");
      go.type = "button"; go.id = "cdGo"; go.textContent = "开始倒数";
      go.addEventListener("click", function () {
        var n = $("cdName").value.trim() || "倒数日";
        var d = $("cdDate").value;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { toast("请选择目标日期"); return; }
        S.cd = { n: n, d: d };
        store.save({ cd: S.cd });
        renderCd();
        toast("倒数日已设置");
      });
      body.appendChild(name); body.appendChild(date); body.appendChild(go);
      return;
    }
    var target = new Date(S.cd.d + "T00:00:00");
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((target - today) / 86400000);
    var label = days > 0 ? "还有 " + days + " 天" : (days === 0 ? "就是今天" : "已过 " + (-days) + " 天");
    var nm = document.createElement("div"); nm.className = "cdname"; nm.textContent = S.cd.n;
    var big = document.createElement("div"); big.className = "cdbig"; big.textContent = days;
    var sub = document.createElement("div"); sub.className = "cdsub"; sub.textContent = label + " · " + S.cd.d;
    var edit = document.createElement("button");
    edit.type = "button"; edit.className = "cdedit"; edit.textContent = "修改";
    edit.addEventListener("click", function () {
      S.cd = null;
      store.save({ cd: null });
      renderCd();
    });
    body.appendChild(nm); body.appendChild(big); body.appendChild(sub); body.appendChild(edit);
  }
  /* 移除小组件（仅拆摆位，内容数据保留：待办/便签文本/倒数日都在别处存着） */
  var WG_NAMES = { cal: "日历", todo: "待办", note: "便签", cd: "倒数日" };
  function removeWidget(key) {
    activePage()[key] = null;
    store.save({ pages: S.pages });
    var el = $(key === "cal" ? "calWrap" : key + "Wrap");
    el.classList.add("out");
    setTimeout(function () { applyLayout(); el.classList.remove("out"); }, 180);
    syncSettings();
    toast(WG_NAMES[key] + "已从本页移除（设置 → 小组件可找回）");
  }

  /* ---------------- 收集板（左侧栏画板） ----------------
     默认隐藏，鼠标到屏幕最左缘唤出；把网页里的链接 / 图片 / 文字
     直接拖进来（原生 DnD），也支持 Ctrl+V 粘贴与手动添加。
     卡片自由摆放（存 x/y），复用拖动核心；画布可纵向滚动。 */
  function sbUid() { return "sb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  var SB_W = 252, SB_PAD = 10;
  var sbH = {};                 /* 卡片 id → 实测高度（级联摆放 / 边界用） */
  var sbOpenState = false, sbCloseTimer = 0;

  function sbExtent() {
    var m = 0;
    S.sidebar.forEach(function (it) { m = Math.max(m, (it.y || 0) + (sbH[it.id] || 90)); });
    return m;
  }
  function sbBounds(nat, w, h) {
    var box = $("sbCanvas");
    var cw = box.clientWidth, ch = box.clientHeight;
    var eh = Math.max(ch, sbExtent() + 240);   /* 底部留滑量，允许拖到现有内容之外 */
    return {
      minX: SB_PAD,
      maxX: Math.max(SB_PAD, cw - w - SB_PAD),
      minY: SB_PAD,
      maxY: Math.max(SB_PAD, eh - h - SB_PAD)
    };
  }
  function sbCardSpec(idx, el) {
    return {
      exclude: "button,a,[data-nodrag],.menu,img.thumb",
      obj: function () { return S.sidebar[idx]; },
      bounds: sbBounds,
      put: function (x, y) { var it = S.sidebar[idx]; it.x = x; it.y = y; },
      save: function () { store.save({ sidebar: S.sidebar }); },
      glass: function () { return [el]; }
    };
  }
  function sbFavicon(ic, item) {
    var hst = hostOf(item.url || item.src || "");
    var fav = faviconURL(item.url || item.src || "");
    if (fav) {
      var im = new Image();
      im.alt = ""; im.referrerPolicy = "no-referrer"; im.draggable = false;
      im.addEventListener("load", function () { ic.textContent = ""; ic.appendChild(im); });
      im.addEventListener("error", function () { letterSkin(ic, hst); });
      im.src = fav;
      setTimeout(function () { if (im.parentNode !== ic) letterSkin(ic, hst); }, 2500);
    } else {
      letterSkin(ic, item.title || "x");
    }
  }
  function sbCardEl(item, idx) {
    var el = document.createElement("div");
    el.className = "glass sbcard";
    el.setAttribute("data-glass", "");
    el.title = item.url || item.src || "";
    el.style.transform = "translate3d(" + (item.x || 0) + "px," + (item.y || 0) + "px,0)";

    if (item.type === "image" && item.src) {
      var th = document.createElement("img");
      th.className = "thumb";
      th.alt = "";
      th.referrerPolicy = "no-referrer";
      th.draggable = false;
      th.src = item.src;
      el.appendChild(th);
    }

    var cap = document.createElement("div");
    cap.className = "cap";
    if (item.type === "link") {
      var ic = document.createElement("div");
      ic.className = "ic";
      ic.textContent = (item.title || hostOf(item.url) || "?").trim().charAt(0).toUpperCase();
      sbFavicon(ic, item);
      cap.appendChild(ic);
    }
    var col = document.createElement("div");
    col.className = "col";
    var tt = document.createElement("div");
    tt.className = "tt";
    tt.textContent = item.title ||
      (item.type === "link" ? hostOf(item.url) : item.type === "image" ? "图片" : "笔记");
    col.appendChild(tt);
    if (item.type === "link" && hostOf(item.url)) {
      var sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = hostOf(item.url);
      col.appendChild(sub);
    }
    cap.appendChild(col);
    el.appendChild(cap);

    if (item.type === "text" && item.text) {
      var note = document.createElement("div");
      note.className = "note";
      note.textContent = item.text;
      el.appendChild(note);
    }

    var menu = document.createElement("div");
    menu.className = "menu";
    menu.textContent = "⋯";
    menu.title = "编辑";
    menu.addEventListener("click", function (ev) { ev.stopPropagation(); openSbDlg(idx); });
    el.appendChild(menu);

    el.addEventListener("click", function () {
      if (item.type === "link" && item.url) openURL(item.url);
      else if (item.type === "image" && item.src && /^https?:/i.test(item.src)) openURL(item.src);
    });
    return el;
  }
  function renderSidebar() {
    var box = $("sbCanvas");
    box.textContent = "";
    if (!S.sidebar.length) {
      var e = document.createElement("div");
      e.className = "sbempty";
      e.textContent = "还是空的。把网页里的链接、图片、选中文字直接拖进来即可收藏，也可以点右上角 + 添加。";
      box.appendChild(e);
    }
    S.sidebar.forEach(function (it, i) {
      var el = sbCardEl(it, i);
      attachDrag(el, sbCardSpec(i, el));
      box.appendChild(el);
    });
    sbMeasure();
    sbSyncMeta();
    window.LiquidGlass.refresh();
  }
  function sbMeasure() {
    var box = $("sbCanvas");
    var cards = box.querySelectorAll(".sbcard");
    for (var i = 0; i < cards.length && i < S.sidebar.length; i++) {
      sbH[S.sidebar[i].id] = cards[i].offsetHeight;
    }
  }
  function sbSyncMeta() { $("sbMeta").textContent = S.sidebar.length + " 项"; }
  function clampSb() {
    var box = $("sbCanvas");
    var maxX = Math.max(SB_PAD, box.clientWidth - SB_W - SB_PAD);
    var changed = false;
    S.sidebar.forEach(function (it) {
      var nx = clampn(it.x, SB_PAD, maxX);
      if (nx !== it.x) { it.x = nx; changed = true; }
    });
    if (changed) { store.save({ sidebar: S.sidebar }); renderSidebar(); }
  }

  /* ---- 开合 ---- */
  function openSb() {
    clearTimeout(sbCloseTimer);
    if (sbOpenState) return;
    sbOpenState = true;
    $("sbar").classList.add("open");
    window.LiquidGlass.refresh();
  }
  function closeSb() {
    if (!sbOpenState) return;
    sbOpenState = false;
    $("sbar").classList.remove("open");
  }
  function scheduleSbClose() {
    clearTimeout(sbCloseTimer);
    sbCloseTimer = setTimeout(function () {
      if (dragCtx || $("sbDlg").classList.contains("open")) return;
      closeSb();
    }, 420);
  }

  /* ---- 原生拖放收集 ---- */
  function sbPayloadTypes(e) {
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

    /* 拖的是图片元素：<img src="...">（多数站点拖图会同时给 text/html 与 uri-list，优先按图片收） */
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
      /* text/html 里通常带 <a>锚文本</a>，直接拿来当标题（拖链接最常见的场景） */
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
  function sbReadImageFile(f, cb) {
    var rd = new FileReader();
    rd.onload = function () { cb(String(rd.result)); };
    rd.readAsDataURL(f);
  }
  function addSbItem(it, e) {
    it.id = sbUid();
    it.title = it.title || ""; it.url = it.url || ""; it.src = it.src || ""; it.text = it.text || "";
    var box = $("sbCanvas");
    if (e) {
      var r = box.getBoundingClientRect();
      it.x = clampn(e.clientX - r.left + box.scrollLeft - SB_W / 2, SB_PAD, Math.max(SB_PAD, box.clientWidth - SB_W - SB_PAD));
      it.y = Math.max(SB_PAD, e.clientY - r.top + box.scrollTop - 30);
    } else {
      var bottom = SB_PAD;
      S.sidebar.forEach(function (o) { bottom = Math.max(bottom, (o.y || 0) + (sbH[o.id] || 90) + 12); });
      it.x = SB_PAD; it.y = bottom;
    }
    S.sidebar.push(it);
    store.save({ sidebar: S.sidebar });
    renderSidebar();
  }
  function onSbDrop(e) {
    if (!sbPayloadTypes(e)) return;
    e.preventDefault();
    e.stopPropagation();
    $("sbar").classList.remove("dropping");
    $("sbZone").classList.remove("dropping");
    var dt = e.dataTransfer;
    var n = 0;
    if (dt.files && dt.files.length) {
      [].slice.call(dt.files).forEach(function (f) {
        if (!/^image\//.test(f.type)) return;
        if (f.size > 10 * 1024 * 1024) { toast("「" + f.name + "」超过 10MB，已跳过"); return; }
        sbReadImageFile(f, function (src) {
          addSbItem({ type: "image", src: src, title: (f.name || "").replace(/\.[a-z0-9]+$/i, "") });
        });
        n++;
      });
    }
    if (!n) {
      var it = classifyDrop(dt);
      if (it) { addSbItem(it, e); n = 1; }
    }
    if (n) {
      openSb();
      toast(n > 1 ? "已收集 " + n + " 项到收集板" : "已收集到收集板");
    } else {
      toast("没有可收集的内容");
    }
  }

  /* ---- 粘贴收集 ---- */
  function onSbPaste(e) {
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    var cd = e.clipboardData;
    if (!cd) return;
    var n = 0;
    if (cd.files && cd.files.length) {
      [].slice.call(cd.files).forEach(function (f) {
        if (!/^image\//.test(f.type)) return;
        if (f.size > 10 * 1024 * 1024) { toast("剪贴板图片超过 10MB，已跳过"); return; }
        sbReadImageFile(f, function (src) { addSbItem({ type: "image", src: src, title: "剪贴板图片" }); });
        n++;
      });
    }
    if (!n) {
      var txt = "";
      try { txt = cd.getData("text/plain") || ""; } catch (er) {}
      txt = txt.trim();
      if (txt) {
        if (/^(https?:\/\/|www\.)\S+$/i.test(txt) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(txt)) {
          addSbItem({ type: "link", url: /^https?:/i.test(txt) ? txt : "https://" + txt, title: "" });
        } else {
          addSbItem({ type: "text", text: txt.slice(0, 2000), title: txt.split(/\r?\n/)[0].slice(0, 40) });
        }
        n = 1;
      }
    }
    if (n) {
      e.preventDefault();
      openSb();
      toast("已粘贴到收集板");
    }
  }

  /* ---- 编辑对话框 ---- */
  var sbDlgIdx = -1, sbDlgType = "link";
  function setSbDlgType(t) {
    sbDlgType = t;
    [].slice.call($("sbDlgType").children).forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-t") === t);
    });
    var isText = t === "text";
    $("sbFldText").style.display = isText ? "" : "none";
    $("sbFldUrl").style.display = isText ? "none" : "";
    $("sbUrlLabel").textContent = t === "image" ? "图片地址" : "网址";
  }
  function openSbDlg(i) {
    sbDlgIdx = i;
    var adding = i < 0;
    $("sbDlgHead").textContent = adding ? "添加到收集板" : "编辑收藏";
    var it = adding ? null : S.sidebar[i];
    setSbDlgType(it ? it.type : "link");
    $("sbDlgName").value = it ? (it.title || "") : "";
    $("sbDlgUrl").value = it ? (it.url || it.src || "") : "";
    $("sbDlgText").value = it ? (it.text || "") : "";
    $("sbDlgDel").style.visibility = adding ? "hidden" : "visible";
    $("sbDlg").classList.add("open");
    window.LiquidGlass.refresh();
    setTimeout(function () { $("sbDlgName").focus(); }, 30);
  }
  function closeSbDlg() { $("sbDlg").classList.remove("open"); }
  function saveSbDlg() {
    var n = $("sbDlgName").value.trim();
    var u = $("sbDlgUrl").value.trim();
    var tx = $("sbDlgText").value;
    var it;
    if (sbDlgType === "text") {
      if (!tx.trim()) { toast("请填写内容"); return; }
      it = { type: "text", text: tx.slice(0, 2000), title: n || tx.trim().split(/\r?\n/)[0].slice(0, 40) };
    } else {
      if (!u) { toast(sbDlgType === "image" ? "请填写图片地址" : "请填写网址"); return; }
      if (!/^(https?:\/\/|data:image\/)/i.test(u)) u = "https://" + u;
      it = sbDlgType === "image"
        ? { type: "image", src: u, url: /^https?:/i.test(u) ? u : "", title: n || "图片" }
        : { type: "link", url: u, title: n || hostOf(u) };
    }
    if (sbDlgIdx >= 0 && S.sidebar[sbDlgIdx]) {
      var old = S.sidebar[sbDlgIdx];
      it.id = old.id; it.x = old.x; it.y = old.y;
      S.sidebar[sbDlgIdx] = it;
    } else {
      var bottom = SB_PAD;
      S.sidebar.forEach(function (o) { bottom = Math.max(bottom, (o.y || 0) + (sbH[o.id] || 90) + 12); });
      it.id = sbUid(); it.x = SB_PAD; it.y = bottom;
      S.sidebar.push(it);
    }
    store.save({ sidebar: S.sidebar });
    renderSidebar();
    closeSbDlg();
  }
  function sbDelCurrent() {
    if (sbDlgIdx < 0) return;
    S.sidebar.splice(sbDlgIdx, 1);
    store.save({ sidebar: S.sidebar });
    renderSidebar();
    closeSbDlg();
  }

  function initSb() {
    $("sbZone").addEventListener("mouseenter", openSb);
    $("sbZone").addEventListener("mouseleave", scheduleSbClose);
    $("sbar").addEventListener("mouseenter", function () { clearTimeout(sbCloseTimer); });
    $("sbar").addEventListener("mouseleave", scheduleSbClose);
    $("sbAdd").addEventListener("click", function () { openSbDlg(-1); });
    [].slice.call($("sbDlgType").children).forEach(function (b) {
      b.addEventListener("click", function () { setSbDlgType(b.getAttribute("data-t")); });
    });
    $("sbDlgSave").addEventListener("click", saveSbDlg);
    $("sbDlgDel").addEventListener("click", sbDelCurrent);
    $("sbDlg").addEventListener("click", function (e) { if (e.target === this) closeSbDlg(); });
    $("sbDlgBox").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") saveSbDlg();
    });

    /* 原生拖动经过左缘时提前唤出侧栏 */
    document.addEventListener("dragover", function (e) {
      if (sbOpenState) return;
      if (e.clientX <= 24 && sbPayloadTypes(e)) openSb();
    });
    ["sbar", "sbZone"].forEach(function (id) {
      var el = $(id);
      el.addEventListener("dragover", function (ev) {
        if (!sbPayloadTypes(ev)) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = "copy";
        el.classList.add("dropping");
      });
      el.addEventListener("dragleave", function () { el.classList.remove("dropping"); });
    });
    $("sbar").addEventListener("drop", onSbDrop);
    $("sbZone").addEventListener("drop", onSbDrop);

    document.addEventListener("paste", onSbPaste);
  }

  /* ---------------- 天气 ----------------
     open-meteo：当前实况 + 5 日预报；城市 = 预设/搜索/浏览器定位。 */
  var WEEK_SHORT = ["日", "一", "二", "三", "四", "五", "六"];
  var SVG_WX = {
    sun: '<svg class="wico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.3"/><path d="M12 3.1v2.1M12 18.8v2.1M3.1 12h2.1M18.8 12h2.1M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5"/></svg>',
    cloud: '<svg class="wico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.9 1.2 3.6 3.6 0 0 1-.6 7.2H7z"/></svg>',
    fog: '<svg class="wico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.9 1.2 3.6 3.6 0 0 1-.6 7.2H7z"/><path d="M6 18.2h12M8 21h8"/></svg>',
    drizzle: '<svg class="wico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.9 1.2 3.6 3.6 0 0 1-.6 7.2H7z"/><path d="M9 18.5v2.2M13 18.5v2.2M17 18.5v2.2" stroke-width="2"/></svg>',
    rain: '<svg class="wico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.9 1.2 3.6 3.6 0 0 1-.6 7.2H7z"/><path d="M8 18l-1 3M12.5 18l-1 3M17 18l-1 3"/></svg>',
    snow: '<svg class="wico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.9 1.2 3.6 3.6 0 0 1-.6 7.2H7z"/><path d="M8 19.2h.01M12 20.6h.01M16 19.2h.01" stroke-width="2.6"/></svg>',
    storm: '<svg class="wico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.9 1.2 3.6 3.6 0 0 1-.6 7.2H7z"/><path d="M12.5 16.5l-2.6 4h2.8l-1.4 3.2 4-4.6h-2.6l1.5-2.6z" fill="currentColor" stroke="none"/></svg>'
  };
  function wmoIcon(code) {
    var t;
    if (code === 0 || code === 1) t = "sun";
    else if (code === 2 || code === 3) t = "cloud";
    else if (code === 45 || code === 48) t = "fog";
    else if (code >= 51 && code <= 57) t = "drizzle";
    else if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) t = "rain";
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) t = "snow";
    else if (code >= 95) t = "storm";
    else t = "cloud";
    return SVG_WX[t];
  }
  function activeCity() {
    if (S.geo) return { n: S.geo.n || "当前位置", lat: S.geo.lat, lon: S.geo.lon };
    return S.city || CITIES[0];
  }
  var wxTimer = 0, wxLast = null;
  function loadWeather() {
    var c = activeCity();
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + c.lat + "&longitude=" + c.lon +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m" +
      "&hourly=temperature_2m,weather_code,precipitation_probability" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset" +
      "&timezone=Asia%2FShanghai&forecast_days=5";
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      wxLast = j;
      var cur = j.current || {};
      var t = Math.round(cur.temperature_2m);
      var label = WMO[cur.weather_code] || "未知";
      setChipIcon(cur.weather_code);
      $("wxChipText").textContent = c.n + " " + t + "° " + label;
      $("wxDot").style.background = "#8fe3a8";
      $("wxDot").style.boxShadow = "";
      if (wxPopIsOpen()) renderWxPop();
    }).catch(function () {
      $("wxChipText").textContent = "天气不可用";
      $("wxDot").style.background = "rgba(255,255,255,.4)";
      $("wxDot").style.boxShadow = "none";
      /* 失败后 60 秒重试（成功则 30 分钟刷新） */
      clearTimeout(wxTimer);
      wxTimer = setTimeout(loadWeather, 60 * 1000);
    });
    clearTimeout(wxTimer);
    wxTimer = setTimeout(loadWeather, 30 * 60 * 1000);
  }
  function setChipIcon(code) {
    var chip = $("wxChip");
    var old = chip.querySelector(".chipic");
    if (old) old.remove();
    var span = document.createElement("span");
    span.className = "chipic";
    span.innerHTML = wmoIcon(code);
    chip.insertBefore(span, $("wxChipText"));
  }

  /* ---- 天气详情大框：小条液态变形而成 ----
     FLIP：打开时先把面板无过渡地钉在 chip 的矩形上（同位同尺寸、胶囊圆角），
     再过渡到最终形状 —— 视觉上就是小条自己被"拉"成了大框；关闭反向缩回。 */
  var wxMorphTimer = 0;
  function wxPopIsOpen() { return $("wxPop").classList.contains("open"); }
  function wxMorphFrom(chip, pop) {
    var cr = chip.getBoundingClientRect();
    pop.style.top = cr.top + "px";
    pop.style.right = Math.max(12, document.documentElement.clientWidth - cr.right) + "px";
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var sx = Math.max(0.02, cr.width / pw), sy = Math.max(0.02, cr.height / ph);
    return "scale(" + sx.toFixed(4) + "," + sy.toFixed(4) + ")";
  }
  function openWxPop() {
    renderWxPop();
    var pop = $("wxPop"), chip = $("wxChip");
    clearTimeout(wxMorphTimer);
    pop.classList.add("morphing");                       /* 摘掉过渡，瞬间就位 */
    pop.style.transform = wxMorphFrom(chip, pop);
    pop.style.borderRadius = "999px";
    pop.classList.add("open");                           /* 可见：此刻与 chip 完全重合 */
    chip.classList.add("under");                         /* 小条隐入大框 */
    window.LiquidGlass.refresh();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pop.classList.remove("morphing");                /* 恢复弹簧过渡 → 变形生长 */
        pop.style.transform = "";
        pop.style.borderRadius = "";
        setTimeout(function () { window.LiquidGlass.refresh(); }, 480);
      });
    });
  }
  function closeWxPop() {
    if (!wxPopIsOpen()) return;
    var pop = $("wxPop"), chip = $("wxChip");
    clearTimeout(wxMorphTimer);
    pop.classList.add("closing");                        /* 关闭用无过冲曲线，精确缩回不冒过头 */
    pop.style.transform = wxMorphFrom(chip, pop);        /* 反向：缩回成小条 */
    pop.style.borderRadius = "999px";
    wxMorphTimer = setTimeout(function () {
      /* 先摘掉过渡再清理，否则清空 transform 会从"胶囊缩放"过渡回
         全尺寸 —— 收回瞬间弹出大框虚影 */
      pop.classList.add("morphing");
      pop.classList.remove("open");
      pop.classList.remove("closing");
      pop.style.transform = "";
      pop.style.borderRadius = "";
      chip.classList.remove("under");
      window.LiquidGlass.refresh();
    }, 330);
  }
  function toggleWxPop() { if (wxPopIsOpen()) closeWxPop(); else openWxPop(); }
  /* 24h 温度曲线：折线 + 温度标点 + 底部降水概率柱 + 小时刻度 */
  function wxCurve(hy, cur) {
    if (!hy.time || !hy.time.length) return '<div class="wpempty">暂无逐小时数据</div>';
    var W = 384, H = 118, padX = 10, padT = 20, bandH = 22;
    var nowD = new Date();
    var start = 0;
    for (var i = 0; i < hy.time.length; i++) {
      if (new Date(hy.time[i]) >= new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate(), nowD.getHours())) { start = i; break; }
    }
    var n = Math.min(24, hy.time.length - start);
    if (n < 2) return '<div class="wpempty">暂无逐小时数据</div>';
    var temps = [], pops = [];
    for (var k = 0; k < n; k++) {
      temps.push(Math.round(hy.temperature_2m[start + k]));
      pops.push(hy.precipitation_probability ? hy.precipitation_probability[start + k] : 0);
    }
    var tMin = Math.min.apply(null, temps), tMax = Math.max.apply(null, temps);
    if (tMax === tMin) tMax = tMin + 1;
    var topY = padT, botY = H - bandH - 6;
    function X(i) { return padX + i / (n - 1) * (W - padX * 2); }
    function Y(t) { return botY - (t - tMin) / (tMax - tMin) * (botY - topY); }
    var line = "", area = "";
    for (var a = 0; a < n; a++) {
      line += (a ? "L" : "M") + X(a).toFixed(1) + " " + Y(temps[a]).toFixed(1) + " ";
    }
    area = line + "L" + X(n - 1).toFixed(1) + " " + botY + " L" + X(0).toFixed(1) + " " + botY + " Z";
    var svg = '<svg class="wcurve" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
    svg += '<path d="' + area + '" fill="rgba(255,255,255,.10)" stroke="none"/>';
    /* 降水概率柱 */
    for (var b = 0; b < n; b++) {
      if (!pops[b]) continue;
      var bh = Math.max(2, pops[b] / 100 * bandH);
      svg += '<rect x="' + (X(b) - 3.4).toFixed(1) + '" y="' + (H - 14 - bh).toFixed(1) +
        '" width="6.8" height="' + bh.toFixed(1) + '" rx="1.5" fill="rgba(140,200,255,.55)"/>';
    }
    svg += '<path d="' + line + '" fill="none" stroke="rgba(255,255,255,.92)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    for (var c = 0; c < n; c++) {
      var isKey = c % 3 === 0 || c === n - 1;
      svg += '<circle cx="' + X(c).toFixed(1) + '" cy="' + Y(temps[c]).toFixed(1) + '" r="' + (isKey ? 2.6 : 1.6) + '" fill="#fff" opacity="' + (isKey ? .95 : .55) + '"/>';
      if (isKey) {
        svg += '<text x="' + X(c).toFixed(1) + '" y="' + (Y(temps[c]) - 7).toFixed(1) + '" text-anchor="middle" fill="rgba(255,255,255,.95)" font-size="10.5" font-weight="600">' + temps[c] + '°</text>';
      }
      if (c % 4 === 0 || c === n - 1) {
        var hh = new Date(hy.time[start + c]).getHours();
        svg += '<text x="' + X(c).toFixed(1) + '" y="' + (H - 2) + '" text-anchor="middle" fill="rgba(255,255,255,.55)" font-size="9.5">' + hh + '时</text>';
      }
    }
    svg += "</svg>";
    return svg;
  }
  function renderWxPop() {
    var j = wxLast;
    var c = activeCity();
    $("wpCity").textContent = c.n;
    var now = $("wpNow"), days = $("wpDays");
    if (!j || !j.current) {
      now.innerHTML = '<div class="wpempty">天气数据还没拿到，稍等片刻再点开</div>';
      $("wpCurve").innerHTML = "";
      days.innerHTML = "";
      return;
    }
    var cur = j.current, dy = j.daily || {}, hy = j.hourly || {};
    var t = Math.round(cur.temperature_2m);
    var label = WMO[cur.weather_code] || "未知";
    var feels = cur.apparent_temperature != null ? Math.round(cur.apparent_temperature) : null;
    var hum = cur.relative_humidity_2m != null ? Math.round(cur.relative_humidity_2m) : null;
    var wind = cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : null;
    var pop0 = dy.precipitation_probability_max && dy.precipitation_probability_max.length ? dy.precipitation_probability_max[0] : null;
    var hi = dy.temperature_2m_max && dy.temperature_2m_max.length ? Math.round(dy.temperature_2m_max[0]) : null;
    var lo = dy.temperature_2m_min && dy.temperature_2m_min.length ? Math.round(dy.temperature_2m_min[0]) : null;
    var rise = dy.sunrise && dy.sunrise.length ? dy.sunrise[0].slice(11, 16) : null;
    var set = dy.sunset && dy.sunset.length ? dy.sunset[0].slice(11, 16) : null;

    now.innerHTML =
      '<div class="wpbig">' + wmoIcon(cur.weather_code) +
      '<span class="wpt">' + t + '°</span><span class="wpcond">' + label + '</span></div>' +
      '<div class="wpmeta">' +
      '<span>体感 ' + (feels == null ? "—" : feels + "°") + '</span>' +
      '<span>湿度 ' + (hum == null ? "—" : hum + "%") + '</span>' +
      '<span>风 ' + (wind == null ? "—" : wind + " km/h") + '</span>' +
      '<span>降水概率 ' + (pop0 == null ? "—" : pop0 + "%") + '</span>' +
      '<span>' + (hi == null ? "—" : hi + "°") + ' / ' + (lo == null ? "—" : lo + "°") + '</span>' +
      '</div>' +
      '<div class="wpsun">' +
      '<span>日出 ' + (rise || "—") + '</span><span>日落 ' + (set || "—") + '</span>' +
      '</div>';

    /* 未来 24 小时温度曲线（含降水概率柱） */
    var curveBox = $("wpCurve");
    if (curveBox) curveBox.innerHTML = wxCurve(hy, cur);

    /* 5 天明细 */
    var dhtml = "";
    if (dy.time && dy.time.length) {
      for (var d2 = 0; d2 < dy.time.length; d2++) {
        var dd = new Date(dy.time[d2] + "T12:00:00");
        var pop = dy.precipitation_probability_max ? dy.precipitation_probability_max[d2] : null;
        var wd = dy.wind_speed_10m_max ? dy.wind_speed_10m_max[d2] : null;
        dhtml += '<div class="wdrow">' +
          '<span class="wdd">' + (d2 === 0 ? "今天" : WEEK_SHORT[dd.getDay()]) + '</span>' +
          wmoIcon(dy.weather_code[d2]) +
          '<span class="wdp">' + (pop != null ? pop + "%" : "—") + '</span>' +
          '<span class="wdw">' + (wd != null ? Math.round(wd) + "km/h" : "—") + '</span>' +
          '<span class="wdt">' + Math.round(dy.temperature_2m_max[d2]) + '° <i>' + Math.round(dy.temperature_2m_min[d2]) + '°</i></span>' +
          '</div>';
      }
    }
    days.innerHTML = dhtml || '<div class="wpempty">暂无多日数据</div>';
  }

  /* ---------------- 壁纸 ---------------- */
  var bingUrl = "";
  function applyWall() {
    var wall = $("wall");
    var root = document.documentElement;
    if (S.wall.mode === "url" && S.wall.url) {
      wall.style.backgroundImage = 'url("' + S.wall.url.replace(/["\\]/g, "") + '")';
      root.style.setProperty("--tex", (S.tex * 0.45).toFixed(2));
    } else if (S.wall.mode === "bing" && bingUrl) {
      wall.style.backgroundImage = 'url("' + bingUrl.replace(/["\\]/g, "") + '")';
      root.style.setProperty("--tex", (S.tex * 0.45).toFixed(2));
    } else {
      var p = WALLS[0];
      WALLS.forEach(function (w) { if (w.id === S.wall.id) p = w; });
      wall.style.backgroundImage = p.css;
      root.style.setProperty("--tex", String(S.tex));
    }
  }
  function loadBingWall() {
    if (S.wall.mode !== "bing") return;
    /* 该接口为必应公开的壁纸归档接口，字段结构长期稳定；
       但本机网络无法访问 bing.com，未做在线验证，失败时保留当前壁纸。 */
    fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN")
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        var u = j && j.images && j.images[0] && j.images[0].url;
        if (!u) throw new Error("no image");
        bingUrl = /^https?:/i.test(u) ? u : "https://www.bing.com" + u;
        applyWall();
        toast("已应用必应每日壁纸");
      })
      .catch(function () {
        toast("必应壁纸获取失败，已保留当前壁纸");
      });
  }

  /* ---------------- 液态水滴（metaball） ---------------- */
  var DROPW = 440, DROPH = 250, DR = 50, MERGE = 40;
  var drops = [
    { nx: 0.26, ny: 0.56, x: 0, y: 0, r: DR },
    { nx: 0.62, ny: 0.52, x: 0, y: 0, r: DR }
  ];
  var drRefr = $("dropRefr"), drSkin = $("dropSkin"), drWrap = $("drops");
  var dragIx = -1, pressedIx = -1, rafD = 0, animId = 0, base = [DR, DR];

  function smin(a, b, k) {
    if (k <= 0) return Math.min(a, b);
    var h = Math.max(0, k - Math.abs(a - b)) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }
  function sdf(x, y) {
    var a = Math.hypot(x - drops[0].x, y - drops[0].y) - drops[0].r;
    var b = Math.hypot(x - drops[1].x, y - drops[1].y) - drops[1].r;
    return smin(a, b, MERGE);
  }
  function ss(a, b, t) { t = (t - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function clampn(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* 轮廓 + 方向性边缘光：同一张图既做 alpha 遮罩，又做高光皮肤。
     sdfFn 由调用方给出 —— 水滴与瓦片融合层共用同一套打光代码 */
  function skinURL(W, H, sdfFn, rimW) {
    var s = clampn(320 / Math.max(W, H), 0.22, 1);
    var cw = Math.max(8, Math.round(W * s)), ch = Math.max(8, Math.round(H * s));
    var cv = document.createElement("canvas");
    cv.width = cw; cv.height = ch;
    var ctx = cv.getContext("2d"), im = ctx.createImageData(cw, ch);
    var e = 1.6, lx = -0.42, ly = -0.91;
    for (var y = 0; y < ch; y++) {
      var py = (y + 0.5) / ch * H;
      for (var x = 0; x < cw; x++) {
        var px = (x + 0.5) / cw * W;
        var d = sdfFn(px, py);
        var alpha = ss(0.9, -0.9, d);
        var gx = sdfFn(px + e, py) - sdfFn(px - e, py);
        var gy = sdfFn(px, py + e) - sdfFn(px, py - e);
        var L = Math.hypot(gx, gy) || 1; gx /= L; gy /= L;
        var edge = ss(-rimW, 0, d);
        var spec = Math.max(0, gx * lx + gy * ly);
        var low = Math.max(0, gx * 0.5 + gy * 0.86);
        var a = alpha * edge * (0.10 + 0.90 * Math.pow(spec, 2.6)) +
                alpha * edge * 0.14 * low * low + alpha * 0.05;
        var i = (y * cw + x) * 4;
        im.data[i] = 255; im.data[i + 1] = 255; im.data[i + 2] = 255;
        im.data[i + 3] = clampn(Math.round(a * 255), 0, 255);
      }
    }
    ctx.putImageData(im, 0, 0);
    return cv.toDataURL("image/png");
  }

  function layoutDrops() {
    base = [DR, DR];
    drops.forEach(function (d, i) { d.x = d.nx * DROPW; d.y = d.ny * DROPH; d.r = base[i]; });
  }
  function clampDrops() {
    drops.forEach(function (d) {
      d.x = clampn(d.x, d.r * 0.62, DROPW - d.r * 0.62);
      d.y = clampn(d.y, d.r * 0.62, DROPH - d.r * 0.62);
      d.nx = d.x / DROPW; d.ny = d.y / DROPH;
    });
  }
  function renderDrops() {
    rafD = 0;
    if (!S.drops || window.innerWidth < 820) {
      /* 窄屏/关闭时不渲染也要把图层藏起来：
         否则先大窗后缩窗，#drops 会保持最后一帧留在原地，成为不可交互的死残影 */
      drWrap.style.display = "none";
      return;
    }
    drWrap.style.display = "";
    var W = DROPW, H = DROPH, LG = window.LiquidGlass;
    var strength = Math.max(4, DR * S.glass.str * 2.4);
    var band = Math.max(4, DR * S.glass.band * 2.9);

    LG.rawFilter("lgDrop", LG.rawMap(W, H, sdf, band, strength), strength, S.glass.disp);
    /* 与引擎同理：水滴层不挂 blur，避免 Chromium 的 backdrop blur 边缘溢出亮带 */
    var v = "url(#lgDrop) saturate(180%) brightness(1.03)";
    drRefr.style.backdropFilter = v;
    drRefr.style.webkitBackdropFilter = v;

    var skin = skinURL(W, H, sdf, Math.max(5, DR * 0.18));
    var mu = "url(" + skin + ")";
    drRefr.style.maskImage = mu;
    drRefr.style.webkitMaskImage = mu;
    drRefr.style.maskSize = "100% 100%";
    drRefr.style.webkitMaskSize = "100% 100%";
    drRefr.style.maskRepeat = "no-repeat";
    drSkin.style.backgroundImage = mu;
    drSkin.style.backgroundSize = "100% 100%";
    drSkin.style.backgroundRepeat = "no-repeat";
  }
  function schedDrops() { if (rafD) return; rafD = requestAnimationFrame(renderDrops); }

  function spring() {
    if (animId) cancelAnimationFrame(animId);
    var t0 = performance.now();
    (function step() {
      var t = (performance.now() - t0) / 1000;
      var done = true;
      drops.forEach(function (d, i) {
        var goal = (pressedIx === i) ? base[i] * 1.2 : base[i];
        var k = 1 - Math.exp(-10 * t);
        var v = base[i] + (goal - base[i]) * k;
        if (pressedIx === i) v *= 1 + Math.sin(t * 16) * Math.exp(-5 * t) * 0.05;
        d.r = v;
        if (Math.abs(d.r - goal) > 0.12) done = false;
      });
      schedDrops();
      if (!done && t < 1.4) animId = requestAnimationFrame(step); else animId = 0;
    })();
  }

  function initDrops() {
    /* 水滴区域锚在左上角空白处（顶栏是右对齐的），尺寸固定以保证性能可预期 */
    [drRefr, drSkin].forEach(function (el) {
      el.style.position = "absolute";
      el.style.left = "0px";
      el.style.top = "0px";
      el.style.width = DROPW + "px";
      el.style.height = DROPH + "px";
      el.style.pointerEvents = "none";
    });
    layoutDrops();
    clampDrops();
    schedDrops();

    document.addEventListener("pointerdown", function (e) {
      if (!S.drops || window.innerWidth < 820) return;
      /* 卡片 / 瓦片 / 模块上的按压属于它们自己的拖动，水滴热区不抢 */
      if (e.target && e.target.closest && e.target.closest(".sbcard,.tile,.draggable")) return;
      var box = drWrap.getBoundingClientRect();
      var px = e.clientX - box.left, py = e.clientY - box.top;
      var best = -1, bd = 1e9;
      drops.forEach(function (d, i) {
        var dist = Math.hypot(px - d.x, py - d.y);
        if (dist < d.r * 1.45 && dist < bd) { bd = dist; best = i; }
      });
      if (best < 0) return;
      dragIx = best; pressedIx = best;
      e.preventDefault();
      spring();
    }, true);

    document.addEventListener("pointermove", function (e) {
      if (dragIx < 0) return;
      var box = drWrap.getBoundingClientRect();
      var d = drops[dragIx];
      d.x = e.clientX - box.left;
      d.y = e.clientY - box.top;
      clampDrops();
      schedDrops();
    }, true);

    function up() {
      if (dragIx < 0) return;
      dragIx = -1; pressedIx = -1; spring();
    }
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
  }

  /* ---------------- 拖动核心（模块与瓦片共用） ----------------
     用 transform 位移：对照实验已确认祖先 transform 不破坏后代 backdrop-filter。
     按住时严格 1:1 跟手，松手后交给欠阻尼弹簧做惯性 + 过冲。
     spec = { obj, bounds, put, save, glass, start, frame, end, exclude } */
  var BLOCKS = [
    { id: "searchWrap", key: "search" },
    { id: "calWrap", key: "cal", page: true },     /* 日历与瓦片同权：摆位属于当前页面 */
    { id: "todoWrap", key: "todo", page: true },
    { id: "noteWrap", key: "note", page: true },
    { id: "cdWrap", key: "cd", page: true }
  ];
  /* 小组件的摆位存在页面对象上（null = 本页没有），其余模块存在全局 layout 上 */
  function layoutObj(b) {
    if (b.page) return activePage()[b.key];   /* 可为 null：本页无此小组件 */
    return S.layout[b.key];
  }
  function layoutObjOrCreate(b) {             /* 拖动/写入用：保证有对象可写 */
    if (b.page) {
      var p = activePage();
      if (!p[b.key]) p[b.key] = { x: 0, y: 0 };
      return p[b.key];
    }
    return S.layout[b.key];
  }
  function saveLayoutObj(b) {
    if (b.page) store.save({ pages: S.pages });
    else store.save({ layout: S.layout });
  }
  var dragCtx = null, dragLoop = 0;

  function applyLayout() {
    BLOCKS.forEach(function (b) {
      var el = $(b.id);
      if (!el) return;
      var L = layoutObj(b);
      if (!L) { el.style.display = "none"; return; }   /* 本页没有这个小组件 */
      el.style.display = "";
      el.style.transform = "translate3d(" + L.x + "px," + L.y + "px,0)";
    });
  }
  function offsetBounds(nat, w, h) {
    var vw = window.innerWidth, vh = window.innerHeight;
    return {
      minX: (-w + 150) - nat.l, maxX: (vw - 150) - nat.l,
      minY: (-h + 70) - nat.t,  maxY: (vh - 70) - nat.t
    };
  }
  function clampn(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function blockGlass(el) { return [].slice.call(el.querySelectorAll("[data-glass]")); }
  function setLite(d, on) {
    if (!d.glass) d.glass = d.spec.glass ? d.spec.glass() : [];
    if (!d.glass.length) return;
    window.LiquidGlass.lite(d.glass, on);
  }

  function finishDrag(d) {
    d.cx = d.tx;
    d.cy = d.ty;
    d.spec.put(d.tx, d.ty);
    d.el.style.transform = "translate3d(" + d.tx + "px," + d.ty + "px,0)";
    d.el.classList.remove("dragging");
    setLite(d, false);
    if (d.spec.end) d.spec.end(d);
    dragCtx = null;
    if (d.moved) d.spec.save();
  }

  function dragStep() {
    dragLoop = 0;
    var d = dragCtx;
    if (!d) return;
    var px = d.cx, py = d.cy;

    if (d.active) {
      /* 按住时严格 1:1 跟手（不做弹簧插值，否则一定会"拖后腿"） */
      d.cx = d.tx;
      d.cy = d.ty;
    } else {
      /* 松手后交给欠阻尼弹簧：带惯性继续走一点，再回弹定住 */
      d.vx = (d.vx + (d.tx - d.cx) * 0.22) * 0.80;
      d.vy = (d.vy + (d.ty - d.cy) * 0.22) * 0.80;
      d.cx += d.vx;
      d.cy += d.vy;
    }
    d.cx = clampn(d.cx, d.bn.minX, d.bn.maxX);
    d.cy = clampn(d.cy, d.bn.minY, d.bn.maxY);

    var dvx = d.cx - px, dvy = d.cy - py;
    var sp = Math.hypot(dvx, dvy);
    if (d.active) { d.lvx = dvx; d.lvy = dvy; }

    var st = Math.min(sp * 0.0045, 0.035);
    d.el.style.transform =
      "translate3d(" + d.cx.toFixed(2) + "px," + d.cy.toFixed(2) + "px,0)" +
      (st > 0.0015 ? " scale(" + (1 + st).toFixed(4) + "," + (1 - st * 0.62).toFixed(4) + ")" : "");

    if (d.spec.frame) d.spec.frame(d);

    var rest = !d.active &&
      Math.abs(d.tx - d.cx) < 0.15 && Math.abs(d.ty - d.cy) < 0.15 && sp < 0.15;
    if (!rest) { dragLoop = requestAnimationFrame(dragStep); return; }
    finishDrag(d);
  }
  function startDragLoop() { if (!dragLoop) dragLoop = requestAnimationFrame(dragStep); }
  function settleNow() {
    var d = dragCtx;
    if (!d) return;
    if (dragLoop) cancelAnimationFrame(dragLoop);
    dragLoop = 0;
    finishDrag(d);
  }
  function suppressNextClick() {
    var h = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener("click", h, true);
    setTimeout(function () { document.removeEventListener("click", h, true); }, 260);
  }

  function attachDrag(el, spec) {
    el.classList.add("draggable");

    function onMove(e) {
      var d = dragCtx;
      if (!d || d.el !== el || !d.active || e.pointerId !== d.ptr) return;
      var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 3) return;
        d.moved = true;
        el.classList.add("dragging");
        setLite(d, true);
        if (d.spec.start) d.spec.start(d);
        var sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      }
      e.preventDefault();
      d.tx = clampn(d.o0x + dx, d.bn.minX, d.bn.maxX);
      d.ty = clampn(d.o0y + dy, d.bn.minY, d.bn.maxY);
      startDragLoop();
    }
    function onUp(e) {
      var d = dragCtx;
      if (!d || d.el !== el) return;
      if (e && e.pointerId !== undefined && e.pointerId !== d.ptr) return;
      if (!d.active) return;
      d.active = false;
      docOff();
      if (d.moved) {
        suppressNextClick();
        d.vx = d.lvx * 0.6;
        d.vy = d.lvy * 0.6;
      }
      startDragLoop();
    }
    /* 指针捕获的文档级兜底：
       Chromium 在"同一会话连续两次拖动"时会在 setPointerCapture 后
       立刻回收捕获（gotpointercapture 紧跟 lostpointercapture），
       只依赖元素上的 pointermove 会丢失后续事件。挂在 document
       捕获阶段 + pointerId 过滤，捕获是否存活都能跟手。 */
    function docOn() {
      docOff();
      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("pointercancel", onUp, true);
    }
    function docOff() {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    }

    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      var ex = spec.exclude || "input,textarea,select,button,a,[data-nodrag]";
      if (e.target && e.target.closest && e.target.closest(ex)) return;
      if (dragCtx) settleNow();
      var o = spec.obj();
      var r = el.getBoundingClientRect();
      var nat = { l: r.left - o.x, t: r.top - o.y, w: r.width, h: r.height };
      dragCtx = {
        el: el, spec: spec, ptr: e.pointerId, active: true, moved: false,
        sx: e.clientX, sy: e.clientY, nat: nat,
        o0x: o.x, o0y: o.y,
        bn: spec.bounds(nat, nat.w, nat.h),
        tx: o.x, ty: o.y, cx: o.x, cy: o.y, vx: 0, vy: 0, lvx: 0, lvy: 0
      };
      docOn();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  function blockSpec(b) {
    return {
      obj: function () { return layoutObjOrCreate(b); },
      bounds: offsetBounds,
      put: function (x, y) { var L = layoutObjOrCreate(b); L.x = x; L.y = y; },
      save: function () { saveLayoutObj(b); },
      glass: function () {
        var el = $(b.id);
        var list = blockGlass(el);
        if (el.hasAttribute && el.hasAttribute("data-glass")) list.unshift(el);  /* 日历卡自身就是玻璃 */
        return list;
      }
    };
  }
  function attachTileDrag(el, sc) {
    var dummy = { x: 0, y: 0 };   /* 拖动数学只借一个可变对象，网格模式下不落盘位移 */
    attachDrag(el, {
      exclude: "button,a,[data-nodrag],.menu",
      obj: function () { return dummy; },
      bounds: offsetBounds,
      put: function (x, y) { dummy.x = x; dummy.y = y; },
      save: function () {},
      glass: function () { return [el]; },   /* 瓦片自己就是玻璃元素，拖动时切简化滤镜 */
      end: sc ? function (d) { tileReorder(sc, d); } : null
    });
  }

  function initDrag() {
    BLOCKS.forEach(function (b) {
      var el = $(b.id);
      if (el) attachDrag(el, blockSpec(b));
    });
  }
  function reflowLayout() {
    if (dragCtx) settleNow();
    BLOCKS.forEach(function (b) {
      var el = $(b.id);
      if (!el) return;
      var L = layoutObj(b);
      if (!L) return;
      var r = el.getBoundingClientRect();
      var bn = offsetBounds({ l: r.left - L.x, t: r.top - L.y }, r.width, r.height);
      L.x = clampn(L.x, bn.minX, bn.maxX);
      L.y = clampn(L.y, bn.minY, bn.maxY);
    });
    applyLayout();
  }

  /* ---------------- 设置面板 ---------------- */
  function buildSettings() {
    /* 壁纸色板 */
    var walls = $("walls");
    walls.textContent = "";
    WALLS.forEach(function (w) {
      var b = document.createElement("div");
      b.className = "sw";
      b.style.backgroundImage = w.css;
      b.title = w.name;
      b.addEventListener("click", function () {
        S.wall.mode = "preset"; S.wall.id = w.id;
        store.save({ wall: S.wall });
        applyWall(); syncSettings();
      });
      walls.appendChild(b);
    });

    /* 城市 */
    var cs = $("citySeg");
    cs.textContent = "";
    CITIES.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = c.n;
      b.addEventListener("click", function () {
        S.city = { n: c.n, lat: c.lat, lon: c.lon };
        S.geo = null;
        store.save({ city: S.city, geo: null });
        syncSettings(); loadWeather();
      });
      cs.appendChild(b);
    });

    /* 城市搜索（open-meteo geocoding，回车取第一个结果） */
    $("citySearch").addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var input = this;
      var v = input.value.trim();
      if (!v) return;
      input.disabled = true;
      fetch("https://geocoding-api.open-meteo.com/v1/search?name=" + encodeURIComponent(v) + "&count=1&language=zh&format=json")
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var r0 = j && j.results && j.results[0];
          if (!r0 || typeof r0.latitude !== "number") { toast("没找到该城市，试试别的写法"); return; }
          S.city = {
            n: r0.name || v,
            lat: Math.round(r0.latitude * 1000) / 1000,
            lon: Math.round(r0.longitude * 1000) / 1000
          };
          S.geo = null;
          store.save({ city: S.city, geo: null });
          input.value = "";
          syncSettings(); loadWeather();
          toast("已切换到 " + S.city.n);
        })
        .catch(function () { toast("城市查询失败，请检查网络"); })
        .then(function () { input.disabled = false; });
    });

    /* 浏览器定位 */
    $("btnGeo").addEventListener("click", function () {
      if (!navigator.geolocation) { toast("当前浏览器不支持定位"); return; }
      toast("正在定位…");
      navigator.geolocation.getCurrentPosition(function (pos) {
        S.geo = {
          lat: Math.round(pos.coords.latitude * 1000) / 1000,
          lon: Math.round(pos.coords.longitude * 1000) / 1000,
          n: "当前位置"
        };
        store.save({ geo: S.geo });
        syncSettings(); loadWeather();
        toast("已使用当前位置的天气");
      }, function () { toast("定位失败，请检查系统权限"); }, { timeout: 8000 });
    });

    /* 链接打开方式 */
    [].slice.call($("openSeg").querySelectorAll("button")).forEach(function (b) {
      b.addEventListener("click", function () {
        S.openInNew = (b.getAttribute("data-o") === "new");
        store.save({ openInNew: S.openInNew });
        syncSettings();
      });
    });

    /* 数据导出 / 导入 */
    $("btnExport").addEventListener("click", function () {
      var payload = JSON.stringify({
        app: "liquid-glass-newtab", version: 1,
        exportedAt: new Date().toISOString(), state: S
      }, null, 2);
      var blob = new Blob([payload], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "liquid-glass-newtab-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
      toast("已导出备份数据");
    });
    $("btnImport").addEventListener("click", function () { $("importFile").click(); });
    $("importFile").addEventListener("change", function () {
      var f = this.files && this.files[0];
      this.value = "";
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var j = JSON.parse(String(rd.result));
          var next = normalize(j.state && typeof j.state === "object" ? j.state : j);
          S = next;
          store.save(null);
          location.reload();
        } catch (e2) { toast("导入失败：文件格式不正确"); }
      };
      rd.readAsText(f);
    });

    /* 水滴开关 */
    var ds = $("dropSeg");
    [].slice.call(ds.querySelectorAll("button")).forEach(function (b) {
      b.addEventListener("click", function () {
        S.drops = (b.getAttribute("data-d") === "on");
        store.save({ drops: S.drops });
        document.body.classList.toggle("drops-off", !S.drops);
        syncSettings();
        if (S.drops) { layoutDrops(); clampDrops(); schedDrops(); }
      });
    });

    /* 小组件开关：显示 = 给当前页放上，隐藏 = 从当前页移除（内容数据保留） */
    [["calSeg", "cal"], ["todoSeg", "todo"], ["noteSeg", "note"], ["cdSeg", "cd"]].forEach(function (pr) {
      [].slice.call($(pr[0]).querySelectorAll("button")).forEach(function (b) {
        b.addEventListener("click", function () {
          var p = activePage();
          var on = b.getAttribute("data-c") === "on";
          if (on && !p[pr[1]]) p[pr[1]] = { x: 0, y: 0 };
          if (!on) p[pr[1]] = null;
          store.save({ pages: S.pages });
          applyLayout();
          if (pr[1] === "cd") renderCd();
          if (pr[1] === "note") renderNote();
          syncSettings();
          toast((on ? "已在本页显示" : "已从本页移除") + WG_NAMES[pr[1]]);
        });
      });
    });

    /* 壁纸模式 */
    var wm = $("wallMode");
    [].slice.call(wm.querySelectorAll("button")).forEach(function (b) {
      b.addEventListener("click", function () {
        S.wall.mode = b.getAttribute("data-m");
        store.save({ wall: S.wall });
        syncSettings();
        if (S.wall.mode === "bing") loadBingWall();
        applyWall();
      });
    });
    $("wallUrl").addEventListener("change", function () {
      var v = this.value.trim();
      if (!v) return;
      S.wall.url = v; S.wall.mode = "url";
      store.save({ wall: S.wall });
      syncSettings(); applyWall();
    });

    /* 玻璃参数滑块 */
    function bindGlass(id, out, key, fx) {
      var el = $(id), o = $(out);
      el.addEventListener("input", function () {
        var v = parseFloat(el.value);
        S.glass[key] = v;
        o.textContent = fx(v);
        var patch = {};
        patch[key] = v;
        window.LiquidGlass.set(patch);
        /* 引擎重建会换掉滤镜 id，水滴层要跟着重挂 */
        setTimeout(schedDrops, 60);
        clearTimeout(bindGlass._t);
        bindGlass._t = setTimeout(function () { store.save({ glass: S.glass }); }, 400);
      });
    }
    bindGlass._t = 0;
    bindGlass("pStr", "vStr", "str", function (v) { return v.toFixed(2); });
    bindGlass("pBand", "vBand", "band", function (v) { return v.toFixed(2); });
    bindGlass("pDisp", "vDisp", "disp", function (v) { return v.toFixed(1); });

    $("pTex").addEventListener("input", function () {
      S.tex = parseFloat(this.value);
      $("vTex").textContent = S.tex.toFixed(2);
      applyWall();
      clearTimeout(bindGlass._t2);
      bindGlass._t2 = setTimeout(function () { store.save({ tex: S.tex }); }, 400);
    });

    $("btnResetLayout").addEventListener("click", function () {
      S.layout = { search: { x: 0, y: 0 }, tiles: { x: 0, y: 0 }, todo: { x: 0, y: 0 }, weather: { x: 0, y: 0 } };
      S.pages.forEach(function (p) {
        ["cal", "todo", "note", "cd"].forEach(function (k) {
          if (p[k]) p[k] = { x: 0, y: 0 };   /* 已开启的小组件摆位归零（不改变开关状态） */
        });
      });
      store.save({ layout: S.layout, pages: S.pages });
      applyLayout();
      reflowLayout();
      toast("模块位置已复位");
    });

    $("btnReset").addEventListener("click", function () {
      S = defaults();
      store.save(null);
      location.reload();
    });
  }
  function syncSettings() {
    var g = S.glass;
    $("pStr").value = g.str;  $("vStr").textContent = g.str.toFixed(2);
    $("pBand").value = g.band; $("vBand").textContent = g.band.toFixed(2);
    $("pDisp").value = g.disp; $("vDisp").textContent = g.disp.toFixed(1);
    $("pTex").value = S.tex;  $("vTex").textContent = S.tex.toFixed(2);
    $("wallUrl").value = S.wall.url || "";

    [].slice.call($("walls").children).forEach(function (b, i) {
      b.classList.toggle("on", S.wall.mode === "preset" && WALLS[i].id === S.wall.id);
    });
    [].slice.call($("citySeg").children).forEach(function (b, i) {
      b.classList.toggle("on", !S.geo && S.city && CITIES[i].n === S.city.n);
    });
    [].slice.call($("wallMode").children).forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-m") === S.wall.mode);
    });
    [].slice.call($("openSeg").children).forEach(function (b) {
      b.classList.toggle("on", (b.getAttribute("data-o") === "new") === !!S.openInNew);
    });
    [].slice.call($("dropSeg").children).forEach(function (b) {
      b.classList.toggle("on", (b.getAttribute("data-d") === "on") === !!S.drops);
    });
    [["calSeg", "cal"], ["todoSeg", "todo"], ["noteSeg", "note"], ["cdSeg", "cd"]].forEach(function (pr) {
      [].slice.call($(pr[0]).children).forEach(function (b) {
        b.classList.toggle("on", (b.getAttribute("data-c") === "on") === !!activePage()[pr[1]]);
      });
    });
  }
  function openSheet() {
    $("sheet").classList.add("open");
    window.LiquidGlass.refresh();
  }
  function closeSheet() { $("sheet").classList.remove("open"); }

  /* ---------------- 指针高光 ---------------- */
  var mxRaf = 0, mxEv = null;
  function initGlow() {
    document.addEventListener("pointermove", function (e) {
      mxEv = e;
      if (mxRaf) return;
      mxRaf = requestAnimationFrame(function () {
        mxRaf = 0;
        var ev = mxEv;
        if (!ev || !ev.target || !ev.target.closest) return;
        var el = ev.target.closest(".glass");
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (!r.width) return;
        el.style.setProperty("--mx", ((ev.clientX - r.left) / r.width * 100) + "%");
        el.style.setProperty("--my", ((ev.clientY - r.top) / r.height * 100) + "%");
      });
    }, { passive: true });
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $("searchForm").addEventListener("submit", function (e) {
      e.preventDefault();
      smenuHide();
      go($("q").value);
    });
    $("engineBtn").addEventListener("click", function () { toggleEngineMenu(); });
    $("engineMenu").addEventListener("keydown", function (e) {
      var items = [].slice.call(this.children);
      var i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
    });
    document.addEventListener("pointerdown", function (e) {
      var box = $("engineMenu");
      if (!box.classList.contains("open")) return;
      if (e.target && e.target.closest && e.target.closest("#engineMenu, #engineBtn")) return;
      toggleEngineMenu(false);
    });
    $("calPrev").addEventListener("click", function () { calShift(-1); });
    $("calNext").addEventListener("click", function () { calShift(1); });
    $("calX").addEventListener("click", function () { removeWidget("cal"); });
    $("todoX").addEventListener("click", function () { removeWidget("todo"); });
    $("noteX").addEventListener("click", function () { removeWidget("note"); });
    $("cdX").addEventListener("click", function () { removeWidget("cd"); });

    $("todoAdd").addEventListener("click", addTodo);
    $("todoInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addTodo(); }
    });
    $("noteText").addEventListener("input", function () {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(function () {
        activePage().noteText = $("noteText").value.slice(0, 2000);
        store.save({ pages: S.pages });
      }, 400);
    });
    $("wxChip").addEventListener("click", toggleWxPop);
    $("wxPopClose").addEventListener("click", closeWxPop);
    document.addEventListener("pointerdown", function (e) {
      if (!wxPopIsOpen()) return;
      if (e.target && e.target.closest && e.target.closest("#wxPop, #wxChip")) return;
      closeWxPop();
    });
    $("btnSettings").addEventListener("click", openSheet);
    $("btnCloseSheet").addEventListener("click", closeSheet);
    $("sheet").addEventListener("click", function (e) { if (e.target === this) closeSheet(); });
    $("dlgSave").addEventListener("click", saveDialog);
    $("dlgDel").addEventListener("click", delDialog);
    $("dialog").addEventListener("click", function (e) { if (e.target === this) closeDialog(); });
    $("dlgBox").addEventListener("keydown", function (e) { if (e.key === "Enter") saveDialog(); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        toggleEngineMenu(false); closeSheet(); closeDialog(); smenuHide(); closeWxPop();
        if ($("sbDlg").classList.contains("open")) closeSbDlg(); else closeSb();
        return;
      }
      var tag = (e.target && e.target.tagName) || "";
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        $("q").focus();
        $("q").select();
      }
    });

    var rt = 0;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (S.drops) { layoutDrops(); clampDrops(); schedDrops(); }
        fitClock();
        reflowLayout();
        clampSb();
      }, 160);
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    store.load(function (state) {
      S = state;

      window.LiquidGlass.set({
        band: S.glass.band, str: S.glass.str, disp: S.glass.disp, blur: S.glass.blur
      });
      document.body.classList.toggle("drops-off", !S.drops);

      $("engineName").textContent = currentEngine().name;
      tick();
      fitClock();
      setInterval(tick, 1000);
      /* 字体就绪可能改变引擎按钮的实测宽度，重测一次输入框内边距 */
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(syncSearchPad).catch(function () {});
      }

      var now = new Date();
      calY = now.getFullYear(); calM = now.getMonth();
      renderCal();
      renderTodos();
      renderCd();
      renderNote();
      buildEngineMenu();
      renderTiles();
      buildPager();
      applyWall();
      buildSettings();
      syncSettings();
      bind();
      initGlow();
      initSuggest();

      renderSidebar();
      initSb();

      window.LiquidGlass.init();

      applyLayout();
      initDrag();
      reflowLayout();

      initDrops();
      if (S.wall.mode === "bing") loadBingWall();
      loadWeather();

      var el = $("glInfo");
      if (!window.LiquidGlass.supported) {
        el.textContent = "液态玻璃：当前浏览器不支持 backdrop-filter:url()，已降级为毛玻璃";
      } else {
        el.textContent = "液态玻璃：SVG 位移贴图折射已启用";
      }

      /* 自动化钩子：便于外部脚本/截图工具驱动状态做验证 */
      window.__lsNewTab = {
        state: function () { return S; },
        drops: drops,
        renderDrops: renderDrops,
        setDrops: function (a, b) {
          drops[0].x = a[0]; drops[0].y = a[1];
          drops[1].x = b[0]; drops[1].y = b[1];
          clampDrops(); renderDrops();
        },
        openSheet: openSheet,
        closeSheet: closeSheet,
        openDialog: openDialog,
        closeDialog: closeDialog,
        smenuHide: smenuHide,
        openEngineMenu: function () { toggleEngineMenu(true); },
        menuOpen: function () { return $("engineMenu").classList.contains("open"); },
        layout: function () { return S.layout; },
        setLayout: function (key, x, y) {
          var b = BLOCKS.filter(function (x) { return x.key === key; })[0];
          var L = b ? layoutObj(b) : S.layout[key];
          if (!L) {
            if (b && b.page) L = activePage().cal = { x: 0, y: 0 };
            else return;
          }
          L.x = x; L.y = y;
          if (b) saveLayoutObj(b);
          applyLayout();
        },
        setCalVisible: function (v) {
          var p = activePage();
          if (v && !p.cal) p.cal = { x: 0, y: 0 };
          if (!v) p.cal = null;
          store.save({ pages: S.pages });
          applyLayout();
        },
        wg: function (key, on) {
          var p = activePage();
          if (on) { if (!p[key]) p[key] = { x: 0, y: 0 }; }
          else p[key] = null;
          store.save({ pages: S.pages });
          applyLayout();
          if (key === "cd") renderCd();
          if (key === "note") renderNote();
        },
        calVisible: function () { return !!activePage().cal; },
        activePageCal: function () { return activePage().cal; },
        openSb: openSb,
        closeSb: closeSb,
        sbIsOpen: function () { return sbOpenState; },
        sbAddItem: function (it) { addSbItem(it); },
        sbItems: function () { return S.sidebar; },
        showSuggest: function (list) { smenuShow(list || [], false); },
        smenuIsOpen: smenuIsOpen,
        wxPopOpen: toggleWxPop,
        wxPopIsOpen: wxPopIsOpen,
        switchPage: switchPage,
        buildPager: buildPager
      };
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
