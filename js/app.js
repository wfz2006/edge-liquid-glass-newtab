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
    { id: "celestial-mage", name: "星穹法师", css: 'url("assets/wallpapers/celestial-mage.webp")', preview: 'url("assets/wallpapers/previews/celestial-mage.webp")' },
    { id: "moonlake-mage", name: "月湖法师", css: 'url("assets/wallpapers/moonlake-mage.webp")', preview: 'url("assets/wallpapers/previews/moonlake-mage.webp")' },
    { id: "starlight-alchemist", name: "星光炼金师", css: 'url("assets/wallpapers/starlight-alchemist.webp")', preview: 'url("assets/wallpapers/previews/starlight-alchemist.webp")' },
    { id: "moon-dragon-shrine", name: "月龙神社", css: 'url("assets/wallpapers/moon-dragon-shrine.webp")', preview: 'url("assets/wallpapers/previews/moon-dragon-shrine.webp")' },
    { id: "moon-gate-symmetry", name: "月之门", css: 'url("assets/wallpapers/moon-gate-symmetry.webp")', preview: 'url("assets/wallpapers/previews/moon-gate-symmetry.webp")' },
    { id: "sky-serpent-flight", name: "天蛇翱翔", css: 'url("assets/wallpapers/sky-serpent-flight.webp")', preview: 'url("assets/wallpapers/previews/sky-serpent-flight.webp")' },
    { id: "elven-ranger-portrait", name: "精灵游侠", css: 'url("assets/wallpapers/elven-ranger-portrait.webp")', preview: 'url("assets/wallpapers/previews/elven-ranger-portrait.webp")' },
    { id: "floating-city-adventurer", name: "浮空城旅人", css: 'url("assets/wallpapers/floating-city-adventurer.webp")', preview: 'url("assets/wallpapers/previews/floating-city-adventurer.webp")' },
    { id: "forest-night-market", name: "森林夜市", css: 'url("assets/wallpapers/forest-night-market.webp")', preview: 'url("assets/wallpapers/previews/forest-night-market.webp")' },
    { id: "autumn-ancient-tree", name: "秋日古树", css: 'url("assets/wallpapers/autumn-ancient-tree.webp")', preview: 'url("assets/wallpapers/previews/autumn-ancient-tree.webp")' },
    { id: "snow-sigil-overhead", name: "雪原符印", css: 'url("assets/wallpapers/snow-sigil-overhead.webp")', preview: 'url("assets/wallpapers/previews/snow-sigil-overhead.webp")' },
    { id: "sunset-sky-whale", name: "落日天空鲸", css: 'url("assets/wallpapers/sunset-sky-whale.webp")', preview: 'url("assets/wallpapers/previews/sunset-sky-whale.webp")' },
    { id: "underwater-ruin-library", name: "海底遗迹图书馆", css: 'url("assets/wallpapers/underwater-ruin-library.webp")', preview: 'url("assets/wallpapers/previews/underwater-ruin-library.webp")' },
    { id: "volcanic-dragon-forge", name: "火山龙锻炉", css: 'url("assets/wallpapers/volcanic-dragon-forge.webp")', preview: 'url("assets/wallpapers/previews/volcanic-dragon-forge.webp")' }
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
  var WIDGET_KEYS = ["cal", "todo", "note", "cd"];
  var WIDGET_LABELS = { cal: "日历", todo: "待办", note: "便签", cd: "倒数日" };
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
      items: p.items.map(function (x, i) { return { id: "sc-" + p.id + "-" + i, n: x[0], u: x[1], folder: "", tags: [], pos: { x: 0, y: 0, z: 0 } }; }),
      cal: p.id === "common" ? { x: 0, y: 0 } : null,
      todo: p.id === "common" ? { x: 0, y: 0 } : null,
      widgetOrder: WIDGET_KEYS.slice(),
      tileSize: "medium"
      };
    });
  }
  var G0 = { band: 0.16, str: 0.22, disp: 1 };
  var GLASS_PRESETS = {
    clear: { band: 0.14, str: 0.28, disp: 1.25 },
    balanced: { band: 0.16, str: 0.22, disp: 1 },
    readable: { band: 0.12, str: 0.15, disp: 0.55 }
  };

  /* ---------------- 状态与存储 ---------------- */
  var HAS_CHROME = (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local);
  var HAS_FAVICON = HAS_CHROME && typeof chrome.runtime !== "undefined" && !!chrome.runtime.getURL;
  var KEY = "lg.newtab";
  var SYNC_KEY = "lg.newtab.sync";
  var STATE_VERSION = 7;
  var MAX_INLINE_IMAGE_BYTES = 10 * 1024 * 1024;
  var SB_CORE = window.LGCollection;
  var S = null;
  var imagePersisting = {};
  var todoFilter = "all";
  var calView = "month";
  var calSelectedDate = "";
  var weatherDataByCity = {};
  var wxTimer = 0, wxLast = null;
  var pomoTimer = 0;
  var wallTimer = 0;
  var syncLoaded = false;
  var shortcutBatch = false;
  var selectedShortcuts = {};
  var layoutEdit = false, layoutUndoSnapshot = null, tileActionMenu = null;
  var discoveryCurrent = null, discoverySeen = Object.create(null), sbStatusFilter = "all";

  var DEFAULT_QUOTES = [
    "把复杂的事情拆成今天能完成的一小步。",
    "专注不是把所有事做完，而是先做好眼前这一件。",
    "完成比完美更接近下一次进步。",
    "给重要的事情留出不被打扰的时间。",
    "今天的行动，是明天的轻松。"
  ];
  var DEFAULT_CLOCKS = [
    { id: "shanghai", name: "上海", zone: "Asia/Shanghai" },
    { id: "tokyo", name: "东京", zone: "Asia/Tokyo" },
    { id: "london", name: "伦敦", zone: "Europe/London" },
    { id: "newyork", name: "纽约", zone: "America/New_York" }
  ];

  function uid(prefix) {
    return (prefix || "id") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function validDate(v) { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v); }
  function todayKey() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function cityId(city) {
    return "c-" + String(city.n || "city").replace(/[^\w\u4e00-\u9fff]+/g, "-").toLowerCase() + "-" + Math.round(city.lat * 100) + "-" + Math.round(city.lon * 100);
  }
  function safeUrl(value) {
    var s = String(value || "").trim();
    return /^(https?:\/\/|webcal:\/\/)/i.test(s) ? s : "";
  }
  function defaults() {
    return {
      seedVersion: DEFAULT_SEED_VERSION,
      stateVersion: STATE_VERSION,
      pages: defaultPages(),
      calMig: true,   /* 全新安装无需迁移 */
      todos: [],
      cd: null,
      countdowns: [],
      calendar: { events: [], sources: [], view: "month" },
      activePage: "common",
      sidebar: [],
      searchHistory: [],
      engine: "bing",
      customEngines: [],
      city: { n: "上海", lat: 31.23, lon: 121.47 },
      geo: null,
      weatherCities: CITIES.map(function (c) { return { id: cityId(c), n: c.n, lat: c.lat, lon: c.lon, source: "preset" }; }),
      weatherActiveId: cityId(CITIES[0]),
      openInNew: false,
      wall: { mode: "preset", id: WALLS[0].id, url: "", fileData: "", fileType: "", rotation: "off", customCss: "", fontUrl: "", fontFamily: "", library: [], activeId: "" },
      syncEnabled: true,
      updatedAt: 0,
      productivity: {
        pomo: { mode: "focus", seconds: 25 * 60, running: false, round: 0, endAt: 0 },
        goal: 3,
        focusMode: false,
        clocks: DEFAULT_CLOCKS.map(function (x) { return { id: x.id, name: x.name, zone: x.zone }; }),
        blockedSites: []
      },
      tex: 1,
      glass: { profile: "balanced", band: G0.band, str: G0.str, disp: G0.disp },
      drops: true,
      layout: { search: { x: 0, y: 0 }, tiles: { x: 0, y: 0 }, todo: { x: 0, y: 0 }, weather: { x: 0, y: 0 } }
    };
  }
  function isExactShortcutList(items, expected) {
    if (!Array.isArray(items) || items.length !== expected.length) return false;
    for (var i = 0; i < expected.length; i++) {
      if (!items[i] || items[i].n !== expected[i].n || items[i].u !== expected[i].u) return false;
    }
    return true;
  }

  function isUntouchedLegacyDefault(o) {
    if (!o || typeof o !== "object" || o.seedVersion === DEFAULT_SEED_VERSION) return false;
    if (Array.isArray(o.shortcuts)) return isExactShortcutList(o.shortcuts, DEFAULT_SHORTCUTS);
    if (!Array.isArray(o.pages) || o.pages.length !== 1) return false;
    var p = o.pages[0];
    return !!p && p.id === "home" && p.name === "首页" &&
      isExactShortcutList(p.items, DEFAULT_SHORTCUTS);
  }

  function normalizeTodo(x, i) {
    x = x && typeof x === "object" ? x : {};
    var repeat = ["none", "daily", "weekly", "monthly"].indexOf(x.repeat) >= 0 ? x.repeat : "none";
    var priority = ["low", "normal", "high", "urgent"].indexOf(x.priority) >= 0 ? x.priority : "normal";
    return {
      id: typeof x.id === "string" && x.id ? x.id : uid("todo"),
      t: String(x.t || x.title || "").slice(0, 60),
      done: !!x.done,
      due: validDate(x.due) ? x.due : "",
      priority: priority,
      repeat: repeat,
      remind: !!x.remind,
      archived: !!x.archived,
      sourceId: typeof x.sourceId === "string" ? x.sourceId.slice(0, 80) : "",
      sourceUrl: /^https?:\/\//i.test(String(x.sourceUrl || "")) ? String(x.sourceUrl).slice(0, 2000) : "",
      sceneId: typeof x.sceneId === "string" ? x.sceneId.slice(0, 40) : "",
      notifiedAt: validDate(x.notifiedAt) ? x.notifiedAt : "",
      createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now() + i
    };
  }

  function normalizeCountdown(x, i) {
    x = x && typeof x === "object" ? x : {};
    if (!validDate(x.d)) return null;
    return {
      id: typeof x.id === "string" && x.id ? x.id : uid("cd"),
      n: (typeof x.n === "string" && x.n ? x.n : "倒数日").slice(0, 30),
      d: x.d
    };
  }

  function normalizeCalendarEvent(x, i) {
    x = x && typeof x === "object" ? x : {};
    var start = validDate(x.start) ? x.start : (validDate(x.d) ? x.d : "");
    if (!start) return null;
    return {
      id: typeof x.id === "string" && x.id ? x.id : uid("event"),
      title: String(x.title || x.n || "日程").slice(0, 80),
      start: start,
      end: validDate(x.end) ? x.end : start,
      allDay: x.allDay !== false,
      location: String(x.location || "").slice(0, 120),
      notes: String(x.notes || "").slice(0, 500),
      source: String(x.source || "local").slice(0, 40),
      color: String(x.color || "").slice(0, 20)
    };
  }

  function normalizeEngine(x, i) {
    x = x && typeof x === "object" ? x : {};
    var name = String(x.name || "自定义").trim().slice(0, 30);
    var url = safeUrl(x.url);
    if (!name || !url) return null;
    var keyword = String(x.keyword || "").trim().replace(/[^\w-]/g, "").slice(0, 16).toLowerCase();
    return { id: typeof x.id === "string" && x.id ? x.id : uid("engine"), name: name, url: url, keyword: keyword };
  }

  function normalizeCity(x, i) {
    x = x && typeof x === "object" ? x : {};
    var lat = Number(x.lat), lon = Number(x.lon), n = String(x.n || x.name || "").trim();
    if (!n || !isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { id: typeof x.id === "string" && x.id ? x.id : cityId({ n: n, lat: lat, lon: lon }), n: n.slice(0, 48), lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, source: x.source === "geo" ? "geo" : (x.source || "custom") };
  }

  /* 自定义壁纸库条目：kind=url 远端图片/GIF，kind=image 本地图片 dataURL，kind=video 本地或远端视频 */
  var WALL_LIB_MAX = 12;
  function normalizeWallItem(x) {
    x = x && typeof x === "object" ? x : {};
    var kind = x.kind === "image" || x.kind === "video" ? x.kind : "url";
    var url = typeof x.url === "string" ? x.url.slice(0, 2000) : "";
    var data = typeof x.data === "string" && /^(data:image\/|data:video\/)/i.test(x.data) ? x.data : "";
    if (kind === "url" && !/^(https?:\/\/|data:image\/)/i.test(url)) return null;
    if (kind === "video" && !url && !data) return null;
    if (kind === "video" && url && !/^(https?:\/\/)/i.test(url)) return null;
    if (kind === "image" && !data) return null;
    return {
      id: typeof x.id === "string" && x.id ? x.id : uid("wall"),
      kind: kind,
      url: url,
      data: data,
      name: String(x.name || "").slice(0, 60),
      addedAt: typeof x.addedAt === "number" && isFinite(x.addedAt) ? x.addedAt : 0
    };
  }

  function normalizeShortcut(x, i, preservePosition) {
    if (Array.isArray(x)) x = { n: x[0], u: x[1] };
    x = x && typeof x === "object" ? x : {};
    var url = String(x.u || x.url || "").trim();
    if (!url) return null;
    var rawTags = Array.isArray(x.tags) ? x.tags : String(x.tags || "").split(/[，,\s]+/);
    var tags = rawTags.map(function (tag) { return String(tag || "").trim().replace(/^#/, ""); })
      .filter(function (tag) { return !!tag; }).filter(function (tag, index, all) { return all.indexOf(tag) === index; }).slice(0, 8);
    var pos = preservePosition && x.pos && typeof x.pos === "object" ? x.pos : {};
    return {
      id: typeof x.id === "string" && x.id ? x.id : uid("sc"),
      n: String(x.n || x.title || "").slice(0, 40),
      u: url.slice(0, 2000),
      folder: String(x.folder || "").trim().slice(0, 30),
      tags: tags,
      pos: {
        x: typeof pos.x === "number" && isFinite(pos.x) ? pos.x : 0,
        y: typeof pos.y === "number" && isFinite(pos.y) ? pos.y : 0,
        z: typeof pos.z === "number" && isFinite(pos.z) ? pos.z : 0
      }
    };
  }

  function normalizeWidgetOrder(value) {
    var source = Array.isArray(value) ? value : [];
    var seen = {};
    var order = [];
    source.forEach(function (key) {
      key = String(key || "");
      if (WIDGET_KEYS.indexOf(key) >= 0 && !seen[key]) {
        seen[key] = true;
        order.push(key);
      }
    });
    WIDGET_KEYS.forEach(function (key) {
      if (!seen[key]) order.push(key);
    });
    return order;
  }

  function normalize(o) {
    var d = defaults();
    var preservePositions = !!(o && Number(o.stateVersion) >= STATE_VERSION);
    function normPos(v) {
      return (v && typeof v.x === "number" && typeof v.y === "number" &&
              isFinite(v.x) && isFinite(v.y)) ? {
                x: v.x, y: v.y, z: typeof v.z === "number" && isFinite(v.z) ? v.z : 0
              } : null;
    }
    function widgetPos(v) {
      var pos = normPos(v);
      return pos ? (preservePositions ? pos : { x: 0, y: 0, z: 0 }) : null;
    }
    if (!o || typeof o !== "object") return d;
    var migrateLegacyDefaults = isUntouchedLegacyDefault(o);
    if (Array.isArray(o.pages)) {
      d.pages = o.pages.slice(0, 20).map(function (p, i) {
        if (!p || typeof p !== "object") return null;
        return {
          id: (typeof p.id === "string" && p.id) ? p.id : "pg" + (i + 1),
          name: (typeof p.name === "string" && p.name) ? p.name.slice(0, 12) : "页面 " + (i + 1),
          items: (Array.isArray(p.items) ? p.items : []).map(function (item, index) {
            return normalizeShortcut(item, index, preservePositions);
          }).filter(function (x) { return !!x; }).slice(0, 60),
          /* 小组件按页可选：显式给出才显示；便签文本始终保留 */
          cal: widgetPos(p.cal),
          todo: widgetPos(p.todo),
          note: widgetPos(p.note),
          cd: widgetPos(p.cd),
          widgetOrder: normalizeWidgetOrder(p.widgetOrder),
          tileSize: ["small", "medium", "large"].indexOf(p.tileSize) >= 0 ? p.tileSize : "medium",
          noteText: (typeof p.noteText === "string") ? p.noteText.slice(0, 2000) : ""
        };
      }).filter(function (p) { return !!p; });
      if (!d.pages.length) d.pages = defaults().pages;
    } else if (Array.isArray(o.shortcuts)) {
      /* 旧版单页数据迁移 */
      d.pages = [{
        id: "home", name: "首页",
        items: o.shortcuts.map(function (item, index) {
          return normalizeShortcut(item, index, preservePositions);
        }).filter(function (x) { return !!x; })
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
      d.todos = o.todos.filter(function (x) { return x && typeof (x.t || x.title) === "string"; })
        .map(normalizeTodo).slice(0, 100);
    }
    var rawCountdowns = Array.isArray(o.countdowns) ? o.countdowns : (o.cd ? [o.cd] : []);
    d.countdowns = rawCountdowns.map(normalizeCountdown).filter(function (x) { return !!x; }).slice(0, 50);
    d.cd = d.countdowns[0] || null;
    if (o.calendar && typeof o.calendar === "object") {
      d.calendar.view = o.calendar.view === "week" ? "week" : "month";
      d.calendar.events = (Array.isArray(o.calendar.events) ? o.calendar.events : [])
        .map(normalizeCalendarEvent).filter(function (x) { return !!x; }).slice(0, 500);
      d.calendar.sources = (Array.isArray(o.calendar.sources) ? o.calendar.sources : []).map(function (x, i) {
        x = x && typeof x === "object" ? x : {};
        var url = safeUrl(x.url);
        var localFile = !url && x.provider === "ICS" && !x.url;
        return (url || localFile) ? { id: typeof x.id === "string" && x.id ? x.id : uid("source"), name: String(x.name || "ICS 订阅").slice(0, 60), url: url, provider: String(x.provider || "ICS").slice(0, 20), enabled: x.enabled !== false, lastSync: typeof x.lastSync === "number" ? x.lastSync : 0 } : null;
      }).filter(function (x) { return !!x; }).slice(0, 8);
    }
    if (Array.isArray(o.sidebar)) {
      d.sidebar = o.sidebar.slice(0, 200).map(function (x) {
        if (!x || typeof x !== "object") return null;
        var it = SB_CORE.normalizeItem(x, sbUid());
        return (it.type === "text" ? it.text : (it.url || it.src)) ? it : null;
      }).filter(function (x) { return !!x; });
    }
    if (typeof o.engine === "string") d.engine = o.engine;
    if (Array.isArray(o.customEngines)) {
      d.customEngines = o.customEngines.map(normalizeEngine).filter(function (x) { return !!x; }).slice(0, 20);
    }
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
    if (Array.isArray(o.weatherCities)) {
      d.weatherCities = o.weatherCities.map(normalizeCity).filter(function (x) { return !!x; }).slice(0, 12);
      if (!d.weatherCities.length) d.weatherCities = defaults().weatherCities;
    } else {
      var legacyCity = normalizeCity(d.city);
      if (legacyCity && !d.weatherCities.some(function (x) { return x.n === legacyCity.n && x.lat === legacyCity.lat && x.lon === legacyCity.lon; })) d.weatherCities.push(legacyCity);
      if (legacyCity) d.weatherActiveId = legacyCity.id;
    }
    if (d.geo) {
      var geoCity = normalizeCity({ id: "geo", n: d.geo.n || "当前位置", lat: d.geo.lat, lon: d.geo.lon, source: "geo" });
      if (geoCity) {
        d.weatherCities = d.weatherCities.filter(function (x) { return x.id !== "geo"; });
        d.weatherCities.unshift(geoCity);
        if (!o.weatherActiveId) d.weatherActiveId = "geo";
      }
    }
    if (typeof o.weatherActiveId === "string") d.weatherActiveId = o.weatherActiveId;
    var hasWeatherActive = d.weatherCities.some(function (x) { return x.id === d.weatherActiveId; });
    if (!hasWeatherActive) d.weatherActiveId = d.weatherCities[0].id;
    var activeWeather = d.weatherCities.filter(function (x) { return x.id === d.weatherActiveId; })[0] || d.weatherCities[0];
    d.city = { n: activeWeather.n, lat: activeWeather.lat, lon: activeWeather.lon };
    if (o.wall && typeof o.wall === "object") {
      d.wall = {
        mode: ["url", "video", "bing", "local", "random", "preset"].indexOf(o.wall.mode) >= 0 ? o.wall.mode : "preset",
        id: typeof o.wall.id === "string" && WALLS.some(function (w) { return w.id === o.wall.id; }) ? o.wall.id : WALLS[0].id,
        url: typeof o.wall.url === "string" ? o.wall.url.slice(0, 2000) : "",
        fileData: typeof o.wall.fileData === "string" && /^(data:image\/|data:video\/)/i.test(o.wall.fileData) ? o.wall.fileData : "",
        fileType: typeof o.wall.fileType === "string" ? o.wall.fileType.slice(0, 80) : "",
        rotation: ["off", "5m", "15m", "1h"].indexOf(o.wall.rotation) >= 0 ? o.wall.rotation : "off",
        customCss: typeof o.wall.customCss === "string" ? o.wall.customCss.slice(0, 12000) : "",
        fontUrl: typeof o.wall.fontUrl === "string" ? o.wall.fontUrl.slice(0, 1000) : "",
        fontFamily: typeof o.wall.fontFamily === "string" ? o.wall.fontFamily.slice(0, 60) : "",
        library: Array.isArray(o.wall.library) ? o.wall.library.map(normalizeWallItem).filter(function (x) { return !!x; }).slice(0, WALL_LIB_MAX) : [],
        activeId: typeof o.wall.activeId === "string" ? o.wall.activeId : ""
      };
      /* 老版本只有单个 url / fileData：迁入壁纸库，保持正在用的那张不断 */
      if (!d.wall.library.length) {
        if (d.wall.url) {
          var legacyUrl = normalizeWallItem({ kind: /\.(?:mp4|webm|ogg)(?:[?#].*)?$/i.test(d.wall.url) ? "video" : "url", url: d.wall.url, name: hostOf(d.wall.url) || d.wall.url, addedAt: 1 });
          if (legacyUrl) d.wall.library.push(legacyUrl);
        }
        if (d.wall.fileData) {
          var legacyFile = normalizeWallItem({ kind: /^data:video\//i.test(d.wall.fileData) ? "video" : "image", data: d.wall.fileData, name: "本地壁纸", addedAt: 2 });
          if (legacyFile) d.wall.library.push(legacyFile);
        }
      }
      if (["url", "video", "local"].indexOf(d.wall.mode) >= 0 && !d.wall.activeId && d.wall.library.length) {
        d.wall.activeId = d.wall.library[d.wall.library.length - 1].id;
      }
      if (d.wall.activeId && !d.wall.library.some(function (w) { return w.id === d.wall.activeId; })) d.wall.activeId = "";
    }
    if (typeof o.tex === "number") d.tex = Math.min(2, Math.max(0, o.tex));
    if (o.glass && typeof o.glass === "object") {
      d.glass.profile = ["clear", "balanced", "readable", "custom"].indexOf(o.glass.profile) >= 0 ? o.glass.profile : "balanced";
      ["band", "str", "disp"].forEach(function (k) {
        if (typeof o.glass[k] === "number") d.glass[k] = o.glass[k];
      });
    }
    if (typeof o.drops === "boolean") d.drops = o.drops;
    if (typeof o.activePage === "string") d.activePage = o.activePage;
    if (typeof o.syncEnabled === "boolean") d.syncEnabled = o.syncEnabled;
    if (typeof o.updatedAt === "number" && isFinite(o.updatedAt)) d.updatedAt = o.updatedAt;
    if (o.productivity && typeof o.productivity === "object") {
      var p0 = o.productivity;
      if (p0.pomo && typeof p0.pomo === "object") {
        d.productivity.pomo.mode = p0.pomo.mode === "break" ? "break" : "focus";
        d.productivity.pomo.seconds = Math.max(0, Math.min(60 * 60, Number(p0.pomo.seconds) || (d.productivity.pomo.mode === "break" ? 5 * 60 : 25 * 60)));
        d.productivity.pomo.running = !!p0.pomo.running;
        d.productivity.pomo.round = Math.max(0, Math.min(99, Number(p0.pomo.round) || 0));
        d.productivity.pomo.endAt = Number(p0.pomo.endAt) > 0 ? Number(p0.pomo.endAt) : 0;
      }
      if (typeof p0.goal === "number") d.productivity.goal = Math.max(1, Math.min(99, Math.round(p0.goal)));
      d.productivity.focusMode = !!p0.focusMode;
      if (Array.isArray(p0.clocks)) d.productivity.clocks = p0.clocks.map(function (x, i) {
        x = x && typeof x === "object" ? x : {};
        return { id: typeof x.id === "string" && x.id ? x.id : uid("clock"), name: String(x.name || x.zone || "时钟").slice(0, 30), zone: String(x.zone || "UTC").slice(0, 80) };
      }).slice(0, 12);
      if (Array.isArray(p0.blockedSites)) d.productivity.blockedSites = p0.blockedSites.map(function (x) { return String(x || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]; }).filter(function (x) { return /^[a-z0-9.-]+$/.test(x); }).slice(0, 50);
    }
    if (migrateLegacyDefaults) {
      var oldHome = d.pages[0];
      var migratedPages = defaultPages();
      ["cal", "todo", "note", "cd"].forEach(function (k) {
        if (oldHome && oldHome[k]) migratedPages[0][k] = { x: 0, y: 0 };
      });
      if (oldHome && oldHome.noteText) migratedPages[0].noteText = oldHome.noteText;
      d.pages = migratedPages;
      d.activePage = "common";
    }
    d.seedVersion = DEFAULT_SEED_VERSION;
    var hasActive = false;
    d.pages.forEach(function (p) { if (p.id === d.activePage) hasActive = true; });
    if (!hasActive) d.activePage = d.pages[0].id;
    if (o.layout && typeof o.layout === "object") {
      ["search", "tiles", "todo", "weather"].forEach(function (k) {
        var v = o.layout[k];
        if (v && typeof v.x === "number" && typeof v.y === "number" &&
            isFinite(v.x) && isFinite(v.y)) {
          d.layout[k] = { x: v.x, y: v.y, z: typeof v.z === "number" && isFinite(v.z) ? v.z : 0 };
        }
      });
      /* 旧版全局日历摆位迁移到第一个页面 */
      var oc = o.layout.cal;
      if (oc && typeof oc.x === "number" && typeof oc.y === "number" &&
          isFinite(oc.x) && isFinite(oc.y) && (oc.x || oc.y) && d.pages.length) {
        d.pages[0].cal = { x: 0, y: 0 };
      }
    }
    d.stateVersion = STATE_VERSION;
    return d;
  }
  function writeLocal(state) {
    var payload = {};
    payload[KEY] = state;
    if (HAS_CHROME) chrome.storage.local.set(payload, noop);
    else {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast("保存失败：本地存储配额不足"); }
    }
  }

  function readSyncEnvelope(cb) {
    if (!HAS_CHROME || !chrome.storage.sync) { cb(null); return; }
    var q = {}; q[SYNC_KEY] = null;
    chrome.storage.sync.get(q, function (box) {
      var meta = box && box[SYNC_KEY];
      if (!meta) { cb(null); return; }
      /* 兼容第一版直接保存 {updatedAt,state} 的同步记录。 */
      if (meta.state && typeof meta.state === "object") { cb(meta); return; }
      var count = Math.max(0, Math.min(80, Number(meta.count) || 0));
      if (!count) { cb(null); return; }
      var cq = {}, i;
      for (i = 0; i < count; i++) cq[SYNC_KEY + "." + i] = null;
      chrome.storage.sync.get(cq, function (parts) {
        var raw = "";
        for (i = 0; i < count; i++) raw += String(parts && parts[SYNC_KEY + "." + i] || "");
        try {
          var state = JSON.parse(raw);
          cb({ updatedAt: Number(meta.updatedAt) || 0, state: state });
        } catch (e) { cb(null); }
      });
    });
  }

  function mergeSyncState(syncState, localState) {
    if (!localState) return syncState;
    if (localState.wall && localState.wall.fileData && syncState.wall && !syncState.wall.fileData) {
      syncState.wall.fileData = localState.wall.fileData;
      syncState.wall.fileType = localState.wall.fileType;
    }
    if (localState.wall && Array.isArray(localState.wall.library) && syncState.wall && Array.isArray(syncState.wall.library)) {
      var localLibById = {};
      localState.wall.library.forEach(function (x) { if (x && x.id) localLibById[x.id] = x; });
      syncState.wall.library.forEach(function (x) {
        var old = x && x.id ? localLibById[x.id] : null;
        if (old && !x.data && old.data) x.data = old.data;
      });
    }
    var localById = {};
    (localState.sidebar || []).forEach(function (x) { if (x && x.id) localById[x.id] = x; });
    (syncState.sidebar || []).forEach(function (x) {
      var old = x && x.id ? localById[x.id] : null;
      if (old && old.type === "image" && !x.src && old.src) x.src = old.src;
    });
    return syncState;
  }

  var store = {
    load: function (cb) {
      if (!HAS_CHROME) {
        var raw = null;
        try { raw = localStorage.getItem(KEY); } catch (e) {}
        var parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch (e2) {}
        cb(normalize(parsed));
        return;
      }
      var localRaw = null, syncEnvelope = null, left = 2;
      function done() {
        left--;
        if (left) return;
        var localState = localRaw ? normalize(localRaw) : null;
        var syncRaw = syncEnvelope && syncEnvelope.state && typeof syncEnvelope.state === "object" ? syncEnvelope.state : null;
        var syncTime = syncEnvelope && Number(syncEnvelope.updatedAt) || (syncRaw && Number(syncRaw.updatedAt)) || 0;
        var localTime = localRaw && Number(localRaw.updatedAt) || 0;
        var useSync = !!syncRaw && (!localRaw || (localRaw.syncEnabled !== false && syncTime > localTime));
        var state = useSync ? mergeSyncState(normalize(syncRaw), localState) : (localState || normalize(null));
        if (useSync || (localRaw && (localRaw.seedVersion !== DEFAULT_SEED_VERSION || localRaw.stateVersion !== STATE_VERSION))) writeLocal(state);
        syncLoaded = true;
        cb(state);
      }
      chrome.storage.local.get(KEY, function (o) {
        localRaw = o && o[KEY] && typeof o[KEY] === "object" ? o[KEY] : null;
        done();
      });
      if (chrome.storage.sync) readSyncEnvelope(function (envelope) { syncEnvelope = envelope; done(); });
      else done();
    },
    save: function (patch) {
      if (patch) Object.keys(patch).forEach(function (k) { S[k] = patch[k]; });
      S.stateVersion = STATE_VERSION;
      S.updatedAt = Date.now();
      writeLocal(S);
    }
  };

  function handleStorageChange(changes, areaName) {
    if (areaName === "local" && changes && changes[KEY] && S) {
      var raw = changes[KEY].newValue;
      if (!raw || typeof raw !== "object") return;
      var next = normalize(raw);
      var sameSidebar = JSON.stringify(next.sidebar) === JSON.stringify(S.sidebar);
      var sameTodos = JSON.stringify(next.todos) === JSON.stringify(S.todos);
      if (sameSidebar && sameTodos) {
        sbPruneSelection(); sbSyncMeta(); renderSbBatchTools();
        return;
      }
      S = next;
      sbPruneSelection();
      if (!sameSidebar) {
        renderSidebar();
        renderHomePins();
        persistImages();
      }
      if (!sameTodos) {
        renderTodos();
        updateProductivity();
      }
      return;
    }
    if (areaName !== "sync" || !changes || !changes[SYNC_KEY] || !S || S.syncEnabled === false) return;
    readSyncEnvelope(function (nextEnvelope) {
      if (!nextEnvelope || !nextEnvelope.state || Number(nextEnvelope.updatedAt) <= Number(S.updatedAt || 0)) return;
      var next = mergeSyncState(normalize(nextEnvelope.state), S);
      S = next;
      sbPruneSelection();
      writeLocal(S);
      $("engineName").textContent = currentEngine().name;
      buildEngineMenu();
      renderCal(); renderTodos(); renderCd(); renderNote(); renderTiles(); buildPager();
      applyWall(); syncSettings(); updateProductivity(); renderSidebar(); persistImages(); applyLayout();
      toast("已从其他设备同步最新设置");
    });
  }

  /* ---------------- 小工具 ---------------- */
  var toastTimer = 0;
  function toast(msg, action, duration) {
    var t = $("toast");
    t.textContent = "";
    var text = document.createElement("span");
    text.textContent = msg;
    t.appendChild(text);
    if (typeof action === "function") {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = "撤销";
      button.addEventListener("click", action);
      t.appendChild(button);
    }
    t.classList.toggle("sbundo", typeof action === "function");
    t.classList.add("show");
    window.LiquidGlass.refresh();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, duration || (action ? 8000 : 2400));
  }
  function hostOf(u) {
    var m = /^https?:\/\/([^\/:?#]+)/i.exec(u || "");
    return m ? m[1].toLowerCase() : "";
  }
  function resolveImageURL(src, fallback) {
    var raw = String(src || "").trim();
    if (!raw) return "";
    if (/^(?:data:image\/|blob:|https?:\/\/)/i.test(raw)) return raw;
    if (/^\/\//.test(raw)) return (location.protocol === "http:" || location.protocol === "https:") ? location.protocol + raw : "https:" + raw;
    if (fallback && /^(?:https?:\/\/|\/\/)/i.test(fallback)) {
      var fb = /^\/\//.test(fallback) ? "https:" + fallback : fallback;
      /* 新标签页接收的拖放数据通常把图片最终地址放在 text/uri-list。 */
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
      if (!dataURL || item.src !== source || !S || S.sidebar.indexOf(item) < 0) return;
      item.src = dataURL;
      store.save({ sidebar: S.sidebar });
      renderSidebar();
    });
  }
  function persistImages() {
    if (!S || !Array.isArray(S.sidebar)) return;
    S.sidebar.forEach(function (item) { persistImage(item); });
  }
  /*
     图标地址优先使用站点自己的 favicon。Edge 的 /_favicon/ 接口即使找不到
     真实图标也会返回一个成功的通用占位图，不能仅凭 img.load 判断它可用。
     失败时尝试常见的站点图标路径，全部失败就保留卡片首字母。
  */
  function faviconURLs(u) {
    var h = hostOf(u);
    if (!h) return [];
    var base = "https://" + h;
    return [base + "/favicon.ico", base + "/favicon.png", base + "/apple-touch-icon.png"];
  }
  function faviconURL(u) {
    var urls = faviconURLs(u);
    return urls.length ? urls[0] : "";
  }
  /* favicon 内存缓存：切换页面会整页重建瓦片 DOM，不缓存会导致
     每次切页都对同一批域名重新发起最多 3 次图标请求，体感就是“切页就重载”。
     这里按 host 记住已探明的可用地址 / 已确认无图标，Inflight 合并并发请求。 */
  var faviconOk = Object.create(null);
  var faviconDead = Object.create(null);
  var faviconInflight = Object.create(null);
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
    el.style.background = "linear-gradient(142deg,hsl(" + h + " 48% 66% / .30),hsl(" + ((h + 38) % 360) + " 42% 54% / .22))";
    el.style.textShadow = "0 1px 6px rgba(3,10,25,.28)";
  }
  function loadFavicon(ic, u, fallbackLabel) {
    var host = hostOf(u);
    var urls = faviconURLs(u);
    if (!urls.length) {
      letterSkin(ic, fallbackLabel || "x");
      return;
    }

    function showLetter() { letterSkin(ic, host || fallbackLabel || "x"); }
    function attachImg(src, onFail) {
      var cached = new Image();
      cached.alt = "";
      cached.referrerPolicy = "no-referrer";
      cached.draggable = false;
      try { cached.decoding = "async"; } catch (e) {}
      cached.addEventListener("load", function () {
        ic.textContent = "";
        ic.appendChild(cached);
      });
      if (onFail) cached.addEventListener("error", onFail);
      else cached.addEventListener("error", showLetter);
      cached.src = src;
    }

    /* 快路径：已探明可用地址只发一次请求（走浏览器 HTTP 缓存），已确认无图标直接字母兜底。 */
    if (faviconOk[host]) {
      attachImg(faviconOk[host], function () {
        delete faviconOk[host];
        faviconDead[host] = false;
        loadFavicon(ic, u, fallbackLabel);
      });
      return;
    }
    if (faviconDead[host]) { showLetter(); return; }
    if (faviconInflight[host]) {
      faviconInflight[host].push({ ic: ic, label: fallbackLabel, url: u });
      return;
    }
    faviconInflight[host] = [];

    var settled = false;
    var fallbackShown = false;
    var index = 0;
    var timer = 0;
    function finishOk(url) {
      faviconOk[host] = url;
      var waiters = faviconInflight[host] || [];
      delete faviconInflight[host];
      if (timer) clearTimeout(timer);
      waiters.forEach(function (w) { loadFavicon(w.ic, w.url, w.label); });
    }
    function fallback() {
      if (settled || fallbackShown) return;
      fallbackShown = true;
      if (!faviconOk[host]) faviconDead[host] = true;
      var waiters = faviconInflight[host] || [];
      delete faviconInflight[host];
      if (timer) clearTimeout(timer);
      showLetter();
      waiters.forEach(function (w) { loadFavicon(w.ic, w.url, w.label); });
    }
    function tryNext() {
      if (settled) return;
      if (index >= urls.length) {
        settled = true;
        fallback();
        return;
      }
      var src = urls[index++];
      var img = new Image();
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.draggable = false;
      try { img.decoding = "async"; } catch (e) {}
      img.addEventListener("load", function () {
        if (settled) return;
        settled = true;
        ic.textContent = "";
        ic.appendChild(img);
        finishOk(src);
      });
      img.addEventListener("error", tryNext);
      img.src = src;
    }
    tryNext();
    timer = setTimeout(fallback, 2500);
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
  function allEngines() { return ENGINES.concat(S.customEngines || []); }
  function currentEngine() {
    var list = allEngines();
    for (var i = 0; i < list.length; i++) if (list[i].id === S.engine) return list[i];
    return ENGINES[0];
  }
  function findEngineCommand(value) {
    var key = String(value || "").toLowerCase();
    var list = allEngines();
    for (var i = 0; i < list.length; i++) {
      if ((list[i].keyword && list[i].keyword.toLowerCase() === key) || list[i].id.toLowerCase() === key) return list[i];
    }
    return null;
  }
  function searchURL(engine, query) {
    var q = encodeURIComponent(query);
    if (engine.url.indexOf("{query}") >= 0) return engine.url.replace(/\{query\}/g, q);
    return engine.url + q;
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
    var engine = currentEngine();
    var command = /^(?:!|@)([\w-]+)\s+(.+)$/i.exec(v);
    if (command) {
      var chosen = findEngineCommand(command[1]);
      if (chosen) { engine = chosen; v = command[2].trim(); }
    }
    var site = /^site:([^\s]+)\s*(.*)$/i.exec(v);
    if (site && site[2]) v = "site:" + site[1] + " " + site[2];
    pushHistory(v);
    openURL(searchURL(engine, v));
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
    allEngines().forEach(function (en) {
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
  var suggestOcclusionRaf = 0, suggestRestoreTimer = 0;
  var SUGGEST_OCCLUSION_SELECTOR = "#tiles .tile, #wgRow > *, #pager .ptab, .hints > *";
  function fetchSuggest(q, cb) {
    var api = SUGGEST_API[currentEngine().id] || SUGGEST_API.bing;
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
  function clearSuggestOcclusion() {
    if (suggestOcclusionRaf) {
      cancelAnimationFrame(suggestOcclusionRaf);
      suggestOcclusionRaf = 0;
    }
    [].slice.call(document.querySelectorAll(".suggest-occluded")).forEach(function (el) {
      el.classList.remove("suggest-occluded");
    });
  }
  function applySuggestOcclusion() {
    suggestOcclusionRaf = 0;
    var box = $("smenu");
    if (!box.classList.contains("open")) return;
    var br = box.getBoundingClientRect();
    if (!br.width || !br.height) return;
    [].slice.call(document.querySelectorAll(SUGGEST_OCCLUSION_SELECTOR)).forEach(function (el) {
      var r = el.getBoundingClientRect();
      var hit = r.width > 0 && r.height > 0 &&
        r.left < br.right && r.right > br.left && r.top < br.bottom && r.bottom > br.top;
      el.classList.toggle("suggest-occluded", hit);
    });
  }
  function scheduleSuggestOcclusion() {
    if (suggestOcclusionRaf) cancelAnimationFrame(suggestOcclusionRaf);
    suggestOcclusionRaf = requestAnimationFrame(applySuggestOcclusion);
  }
  function restoreSuggestOcclusion() {
    clearTimeout(suggestRestoreTimer);
    suggestRestoreTimer = setTimeout(clearSuggestOcclusion, 280);
  }
  function smenuShow(list, isHistory) {
    var box = $("smenu");
    sugList = list; sugIdx = -1;
    box.textContent = "";
    clearTimeout(suggestRestoreTimer);
    if (!list.length) { smenuHide(); return; }
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
    scheduleSuggestOcclusion();
    window.LiquidGlass.refresh();
  }
  function smenuHide() {
    $("smenu").classList.remove("open");
    sugIdx = -1;
    sugList = [];
    restoreSuggestOcclusion();
  }
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

  /* ---------------- 浏览器数据 ---------------- */
  var browserView = "bookmarks", browserRows = [], browserQuery = "";
  function browserCall(api, args, cb) {
    if (!api) { cb(new Error("浏览器 API 不可用")); return; }
    try {
      api.apply(null, (args || []).concat(function (result) {
        var error = (typeof chrome !== "undefined" && chrome.runtime) ? chrome.runtime.lastError : null;
        cb(error ? new Error(error.message) : null, result);
      }));
    } catch (e) { cb(e); }
  }
  function flattenBookmarks(nodes, path, out) {
    (nodes || []).forEach(function (node) {
      var next = path.concat(node.title ? [node.title] : []);
      if (node.url) out.push({ type: "bookmark", id: node.id, title: node.title || node.url, url: node.url, path: path.join(" / ") });
      else flattenBookmarks(node.children, next, out);
    });
  }
  function browserRowsFromTabs(tabs) {
    return (tabs || []).filter(function (x) { return x && x.url; }).map(function (x) {
      return { type: "tab", id: x.id, groupId: x.groupId, title: x.title || x.url, url: x.url, active: !!x.active, windowId: x.windowId, favIconUrl: x.favIconUrl || "" };
    });
  }
  function loadBrowserView() {
    var box = $("browserList");
    if (!box) return;
    box.textContent = "加载中…";
    var browserApi = (typeof chrome !== "undefined") ? chrome : null;
    if (browserView === "bookmarks") {
      browserCall(browserApi && browserApi.bookmarks && browserApi.bookmarks.getTree, [], function (err, tree) {
        if (err) { renderBrowserError(err); return; }
        browserRows = []; flattenBookmarks(tree, [], browserRows); renderBrowserRows();
      });
    } else if (browserView === "history") {
      browserCall(browserApi && browserApi.history && browserApi.history.search, [{ text: "", maxResults: 100, startTime: Date.now() - 90 * 86400000 }], function (err, rows) {
        if (err) { renderBrowserError(err); return; }
        browserRows = (rows || []).filter(function (x) { return x && x.url; }).map(function (x) { return { type: "history", id: x.id, title: x.title || x.url, url: x.url, visits: x.visitCount, time: x.lastVisitTime }; });
        renderBrowserRows();
      });
    } else if (browserView === "recent") {
      browserCall(browserApi && browserApi.sessions && browserApi.sessions.getRecentlyClosed, [{ maxResults: 40 }], function (err, rows) {
        if (err) { renderBrowserError(err); return; }
        browserRows = [];
        (rows || []).forEach(function (x) {
          if (x.tab) browserRows.push({ type: "recent", id: x.tab.sessionId, title: x.tab.title || x.tab.url, url: x.tab.url, sessionId: x.tab.sessionId });
          (x.window && x.window.tabs || []).forEach(function (t) { browserRows.push({ type: "recent", id: t.sessionId, title: t.title || t.url, url: t.url, sessionId: t.sessionId }); });
        });
        renderBrowserRows();
      });
    } else if (browserView === "tabs" || browserView === "groups") {
      browserCall(browserApi && browserApi.tabs && browserApi.tabs.query, [{ currentWindow: true }], function (err, tabs) {
        if (err) { renderBrowserError(err); return; }
        browserRows = browserRowsFromTabs(tabs);
        if (browserView === "groups" && browserApi && browserApi.tabGroups && browserApi.tabs) {
          browserCall(browserApi.tabGroups.query, [{ windowId: (tabs && tabs[0] && tabs[0].windowId) || browserApi.windows && browserApi.windows.WINDOW_ID_CURRENT }], function (groupErr, groups) {
            browserRows.groups = groupErr ? [] : (groups || []);
            renderBrowserRows();
          });
        } else renderBrowserRows();
      });
    }
  }
  function renderBrowserError(err) {
    var box = $("browserList");
    box.textContent = "";
    var e = document.createElement("div"); e.className = "feature-empty";
    e.textContent = "浏览器数据暂不可用：" + (err && err.message ? err.message : "权限未开启"); box.appendChild(e);
  }
  function browserItem(row) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "browser-item";
    var kind = document.createElement("span"); kind.className = "browser-kind";
    kind.textContent = ({ bookmark: "藏", history: "史", recent: "近", tab: "签" }[row.type] || "页");
    var copy = document.createElement("span"); copy.className = "browser-copy";
    var title = document.createElement("strong"); title.textContent = row.title || row.url || "未命名";
    var sub = document.createElement("span");
    var meta = row.path || row.url || "";
    if (row.type === "history" && row.time) meta += (meta ? " · " : "") + new Date(row.time).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    if (row.type === "history" && row.visits) meta += " · " + row.visits + " 次访问";
    sub.textContent = meta;
    copy.appendChild(title); copy.appendChild(sub);
    var open = document.createElement("span"); open.className = "browser-open"; open.textContent = "↗";
    b.appendChild(kind); b.appendChild(copy); b.appendChild(open);
    b.addEventListener("click", function () {
      var browserApi = (typeof chrome !== "undefined") ? chrome : null;
      if (row.type === "recent" && row.sessionId && browserApi && browserApi.sessions) {
        browserCall(browserApi.sessions.restore, [row.sessionId], function (err) { if (err) toast("恢复标签失败"); else toast("已恢复最近关闭的标签"); });
      } else if (row.type === "tab" && row.id && browserApi && browserApi.tabs) {
        browserCall(browserApi.tabs.update, [row.id, { active: true }], function (err) {
          if (err) openURL(row.url);
          else if (browserApi.windows && row.windowId) browserCall(browserApi.windows.update, [row.windowId, { focused: true }], noop);
        });
      } else openURL(row.url);
    });
    return b;
  }
  function renderBrowserRows() {
    var box = $("browserList"); box.textContent = "";
    var q = browserQuery.trim().toLocaleLowerCase();
    var rows = Array.isArray(browserRows) ? browserRows.filter(function (x) { return !q || (String(x.title || "") + " " + String(x.url || "") + " " + String(x.path || "")).toLocaleLowerCase().indexOf(q) >= 0; }) : [];
    if (browserView === "groups") {
      var groups = browserRows.groups || [];
      groups.forEach(function (g) {
        var head = document.createElement("div"); head.className = "browser-group"; head.textContent = (g.title || "未命名组") + " · " + (g.color || ""); box.appendChild(head);
        rows.filter(function (x) { return x.groupId === g.id; }).forEach(function (x) { box.appendChild(browserItem(x)); });
      });
      rows.filter(function (x) { return x.groupId === -1 || !groups.some(function (g) { return g.id === x.groupId; }); }).forEach(function (x) { box.appendChild(browserItem(x)); });
    } else rows.forEach(function (x) { box.appendChild(browserItem(x)); });
    if (!box.children.length) { var empty = document.createElement("div"); empty.className = "feature-empty"; empty.textContent = "没有符合条件的数据"; box.appendChild(empty); }
  }
  function openBrowserPanel() {
    $("browserPanel").classList.add("open"); $("browserPanel").setAttribute("aria-hidden", "false");
    loadBrowserView(); window.LiquidGlass.refresh();
  }
  function closeBrowserPanel() { $("browserPanel").classList.remove("open"); $("browserPanel").setAttribute("aria-hidden", "true"); }

  /* ---------------- 快捷方式（多页面） ---------------- */
  function activePage() {
    for (var i = 0; i < S.pages.length; i++) if (S.pages[i].id === S.activePage) return S.pages[i];
    return S.pages[0];
  }
  function pageUid() { return "pg" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function parseShortcutTags(value) {
    return String(value || "").split(/[，,\s]+/).map(function (tag) { return tag.trim().replace(/^#/, ""); })
      .filter(function (tag) { return !!tag; }).filter(function (tag, index, all) { return all.indexOf(tag) === index; }).slice(0, 8);
  }
  function visibleShortcutItems() {
    var pg = activePage();
    return (pg && pg.items || []).slice();
  }
  function selectedShortcutItems() {
    return (activePage().items || []).filter(function (sc) { return !!selectedShortcuts[sc.id]; });
  }
  function renderShortcutTools() {
    var pg = activePage();
    if (!pg) return;
    var pageLabel = $("tilePageLabel"), batchButton = $("tileBatchToggle"), selectAll = $("tileSelectAll"), setTags = $("tileSetTags"), del = $("tileDeleteSelected"), count = $("tileBatchCount");
    if (pageLabel) pageLabel.textContent = pg.name;
    if (batchButton) batchButton.textContent = shortcutBatch ? "退出批量" : "批量管理";
    [selectAll, setTags, del].forEach(function (el) { if (el) el.hidden = !shortcutBatch; });
    if (count) count.textContent = shortcutBatch ? ("已选 " + selectedShortcutItems().length + " 项") : (pg.items.length + "/60 个快捷方式");
  }
  function toggleShortcutSelected(sc) {
    if (!sc || !sc.id) return;
    if (selectedShortcuts[sc.id]) delete selectedShortcuts[sc.id];
    else selectedShortcuts[sc.id] = true;
    renderTiles();
  }
  function toggleShortcutBatch() {
    if (!shortcutBatch && layoutEdit) setLayoutEdit(false);
    shortcutBatch = !shortcutBatch;
    if (!shortcutBatch) selectedShortcuts = {};
    renderTiles();
  }
  function selectAllShortcuts() {
    visibleShortcutItems().forEach(function (sc) { if (sc.id) selectedShortcuts[sc.id] = true; });
    renderTiles();
  }
  function openShortcutBatchDialog() {
    var chosen = selectedShortcutItems();
    if (!chosen.length) { toast("请先选择快捷方式"); return; }
    $("batchTagsInput").value = chosen[0].tags ? chosen[0].tags.join(", ") : "";
    $("shortcutBatchHelp").textContent = "将应用到当前选中的 " + chosen.length + " 个项目；留空可清除对应内容。";
    $("shortcutBatchDialog").classList.add("open");
    window.LiquidGlass.refresh();
    setTimeout(function () { $("batchTagsInput").focus(); }, 30);
  }
  function closeShortcutBatchDialog() { $("shortcutBatchDialog").classList.remove("open"); }
  function saveShortcutBatch() {
    var chosen = selectedShortcutItems();
    if (!chosen.length) { closeShortcutBatchDialog(); return; }
    var tags = parseShortcutTags($("batchTagsInput").value);
    chosen.forEach(function (sc) { sc.tags = tags.slice(); });
    store.save({ pages: S.pages });
    closeShortcutBatchDialog();
    renderTiles();
    toast("已批量更新 " + chosen.length + " 项");
  }
  function deleteSelectedShortcuts() {
    var chosen = selectedShortcutItems();
    if (!chosen.length) { toast("请先选择快捷方式"); return; }
    if (!window.confirm("确定删除已选择的 " + chosen.length + " 个快捷方式？")) return;
    var ids = {};
    chosen.forEach(function (sc) { ids[sc.id] = true; });
    var pg = activePage();
    pg.items = pg.items.filter(function (sc) { return !ids[sc.id]; });
    selectedShortcuts = {};
    store.save({ pages: S.pages });
    renderTiles();
    toast("已删除 " + chosen.length + " 项");
  }
  function openAllShortcuts() {
    var items = visibleShortcutItems();
    if (!items.length) { toast("本组没有可打开的快捷方式"); return; }
    items.forEach(function (sc) { window.open(sc.u, "_blank", "noopener"); });
    toast("已打开本组 " + items.length + " 个快捷方式");
  }
  function layoutSnapshot() {
    try { return JSON.parse(JSON.stringify({ pages: S.pages, layout: S.layout })); }
    catch (e) { return { pages: S.pages.slice(), layout: S.layout }; }
  }
  function recordLayoutUndo(label, before) {
    layoutUndoSnapshot = before;
    $("layoutUndo").disabled = !layoutUndoSnapshot;
    toast(label, undoLayoutChange, 2000);
  }
  function undoLayoutChange() {
    if (!layoutUndoSnapshot) return;
    S.pages = layoutUndoSnapshot.pages;
    S.layout = layoutUndoSnapshot.layout;
    layoutUndoSnapshot = null;
    store.save({ pages: S.pages, layout: S.layout });
    applyLayout(); renderTiles(); buildPager(); syncSettings();
    $("layoutUndo").disabled = true;
    toast("已撤销上一步布局更改");
  }
  function setLayoutEdit(open) {
    layoutEdit = !!open;
    document.body.classList.toggle("layout-editing", layoutEdit);
    $("layoutEditToggle").setAttribute("aria-pressed", layoutEdit ? "true" : "false");
    $("layoutEditToggle").textContent = layoutEdit ? "退出编辑" : "编辑布局";
    $("layoutEditor").hidden = !layoutEdit;
    if (!layoutEdit) closeTileActionMenu();
    renderLayoutEditor(); renderTiles();
  }
  function renderLayoutEditor() {
    var size = activePage().tileSize || "medium";
    [].slice.call($("tileSizeSeg").querySelectorAll("button")).forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-size") === size);
    });
    var box = $("layoutWidgetSeg"); box.textContent = "";
    WIDGET_KEYS.forEach(function (key) {
      var b = document.createElement("button"); b.type = "button";
      b.textContent = WIDGET_LABELS[key]; b.className = activePage()[key] ? "on" : "";
      b.setAttribute("aria-pressed", activePage()[key] ? "true" : "false");
      b.addEventListener("click", function () { setSceneWidget(key, !activePage()[key]); });
      box.appendChild(b);
    });
    $("layoutUndo").disabled = !layoutUndoSnapshot;
  }
  function setSceneWidget(key, visible) {
    var before = layoutSnapshot(), page = activePage();
    page[key] = visible ? (page[key] || { x: 0, y: 0 }) : null;
    store.save({ pages: S.pages });
    applyLayout(); renderLayoutEditor(); syncSettings();
    recordLayoutUndo((visible ? "已显示" : "已隐藏") + WIDGET_LABELS[key], before);
  }
  function setTileSize(size) {
    if (["small", "medium", "large"].indexOf(size) < 0 || activePage().tileSize === size) return;
    var before = layoutSnapshot(); activePage().tileSize = size;
    store.save({ pages: S.pages }); renderTiles(); renderLayoutEditor();
    recordLayoutUndo("已调整快捷方式大小", before);
  }
  function renderHomePins() {
    var box = $("homePins"), list = $("homePinList");
    if (!box || !list || !S) return;
    list.textContent = "";
    var items = (S.sidebar || []).filter(function (item) {
      return item.pinned && (!item.sceneId || item.sceneId === S.activePage);
    });
    box.hidden = !items.length;
    items.forEach(function (item) {
      var b = document.createElement("button"); b.type = "button"; b.className = "home-pin-chip";
      b.textContent = item.title || (item.url ? hostOf(item.url) : item.type === "image" ? "图片收藏" : "收藏内容");
      b.title = "固定在「" + activePage().name + "」· 点击打开收藏";
      b.addEventListener("click", function () { openCollectionItem(item); });
      list.appendChild(b);
    });
  }
  function closeTileActionMenu() {
    if (tileActionMenu && tileActionMenu.parentNode) tileActionMenu.parentNode.removeChild(tileActionMenu);
    tileActionMenu = null;
    document.removeEventListener("pointerdown", dismissTileActionMenu, true);
    document.removeEventListener("keydown", dismissTileMenuEscape, true);
  }
  function dismissTileActionMenu(e) {
    if (tileActionMenu && !tileActionMenu.contains(e.target)) closeTileActionMenu();
  }
  function dismissTileMenuEscape(e) { if (e.key === "Escape") closeTileActionMenu(); }
  function reorderShortcut(sc, direction) {
    var page = activePage(), from = page.items.indexOf(sc), to = clampn(from + direction, 0, page.items.length - 1);
    if (from < 0 || to === from) { toast(direction < 0 ? "已经在最前面" : "已经在最后面"); return; }
    var before = layoutSnapshot();
    page.items.splice(from, 1); page.items.splice(to, 0, sc);
    store.save({ pages: S.pages }); renderTiles();
    recordLayoutUndo(direction < 0 ? "快捷方式已前移" : "快捷方式已后移", before);
  }
  function moveShortcutToPage(sc, pageId) {
    var fromPage = activePage(), toPage = S.pages.filter(function (p) { return p.id === pageId; })[0];
    if (!toPage || toPage === fromPage || toPage.items.length >= 60) return;
    var before = layoutSnapshot(), ix = fromPage.items.indexOf(sc);
    if (ix < 0) return;
    fromPage.items.splice(ix, 1);
    sc.pos = { x: 0, y: 0, z: 0 };
    toPage.items.push(sc);
    store.save({ pages: S.pages }); renderTiles(); buildPager();
    recordLayoutUndo("快捷方式已移至「" + toPage.name + "」", before);
  }
  function openTileActionMenu(anchor, sc) {
    closeTileActionMenu();
    var menu = document.createElement("div"); menu.className = "tile-action-menu"; menu.setAttribute("role", "menu");
    menu.setAttribute("data-glass", "");
    menu.setAttribute("data-lg-role", "operation");
    menu.setAttribute("data-lg-str", ".08");
    menu.setAttribute("data-lg-band", ".14");
    menu.setAttribute("data-lg-disp", ".3");
    function action(label, fn) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = label; b.setAttribute("role", "menuitem");
      b.addEventListener("click", function (ev) { ev.stopPropagation(); closeTileActionMenu(); fn(); });
      menu.appendChild(b);
    }
    action("前移", function () { reorderShortcut(sc, -1); });
    action("后移", function () { reorderShortcut(sc, 1); });
    var others = S.pages.filter(function (p) { return p.id !== S.activePage; });
    if (others.length) {
      var divider = document.createElement("div"); divider.className = "menu-divider"; menu.appendChild(divider);
      others.forEach(function (p) { action("移至「" + p.name + "」", function () { moveShortcutToPage(sc, p.id); }); });
    }
    var divider2 = document.createElement("div"); divider2.className = "menu-divider"; menu.appendChild(divider2);
    action("编辑快捷方式", function () { openDialog(activePage().items.indexOf(sc)); });
    document.body.appendChild(menu); tileActionMenu = menu;
    var r = anchor.getBoundingClientRect(), mr = menu.getBoundingClientRect();
    menu.style.left = clampn(r.right - mr.width, 8, window.innerWidth - mr.width - 8) + "px";
    menu.style.top = clampn(r.bottom + 4, 8, window.innerHeight - Math.min(mr.height, window.innerHeight - 16) - 8) + "px";
    window.LiquidGlass.refresh();
    setTimeout(function () {
      document.addEventListener("pointerdown", dismissTileActionMenu, true);
      document.addEventListener("keydown", dismissTileMenuEscape, true);
    }, 0);
  }
  function tileEl(sc) {
    var el = document.createElement("div");
    el.className = "glass tile";
    el.setAttribute("data-glass", "");
    el.setAttribute("data-shortcut-id", sc.id);
    if (shortcutBatch && selectedShortcuts[sc.id]) el.classList.add("selected");
    el.title = sc.u;
    var pos = sc.pos || (sc.pos = { x: 0, y: 0 });
    window.LGDragPosition.apply(el, pos.x, pos.y);
    el.style.zIndex = pos.z ? String(pos.z) : "";

    var ic = document.createElement("div");
    ic.className = "ic";
    ic.textContent = (sc.n || hostOf(sc.u) || "?").trim().charAt(0).toUpperCase();

    loadFavicon(ic, sc.u, sc.n || "x");

    var nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = sc.n || hostOf(sc.u);

    if (sc.tags && sc.tags.length) {
      var meta = document.createElement("div");
      meta.className = "tilemeta";
      meta.textContent = "#" + sc.tags.join(" #");
    }

    var handle = document.createElement("button");
    handle.type = "button"; handle.className = "layout-handle tile-handle";
    handle.setAttribute("data-drag-handle", ""); handle.setAttribute("aria-label", "拖动快捷方式"); handle.title = "自由摆放";
    handle.textContent = "⠿";
    var menu = document.createElement("button");
    menu.type = "button"; menu.className = "menu"; menu.setAttribute("data-nodrag", "");
    menu.textContent = "⋯"; menu.title = "快捷方式操作"; menu.setAttribute("aria-label", "快捷方式操作");
    menu.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (tileActionMenu) closeTileActionMenu();
      else openTileActionMenu(menu, sc);
    });

    el.appendChild(ic); el.appendChild(nm); if (meta) el.appendChild(meta); el.appendChild(handle); el.appendChild(menu);
    if (shortcutBatch) {
      var check = document.createElement("span");
      check.className = "tilecheck";
      check.textContent = selectedShortcuts[sc.id] ? "✓" : "";
      el.appendChild(check);
    }
    el.addEventListener("click", function () {
      if (shortcutBatch) toggleShortcutSelected(sc);
      else if (!layoutEdit) openURL(sc.u);
    });
    return el;
  }
  function renderTiles() {
    var box = $("tileGrid");
    closeTileActionMenu();
    box.textContent = "";
    box.classList.remove("tile-size-small", "tile-size-medium", "tile-size-large");
    box.classList.add("tile-size-" + (activePage().tileSize || "medium"));
    renderShortcutTools();

    visibleShortcutItems().forEach(function (sc) {
      var el = tileEl(sc);
      if (!shortcutBatch) attachTileDrag(el, sc);
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
    renderHomePins();
    renderLayoutEditor();
    window.LiquidGlass.refresh();
  }

  /* ================= 快捷方式拖动 =================
     快捷方式与小组件都保存自由拖放坐标；菜单仍提供前移/后移的点击替代操作。 */

  /* ---------------- 编辑对话框 ---------------- */
  var dlgIdx = -1;
  function openDialog(i) {
    dlgIdx = i;
    var editing = i >= 0;
    var pg = activePage();
    $("dlgTitle").textContent = (editing ? "编辑快捷方式" : "添加快捷方式") + " · " + pg.name;
    $("dlgName").value = editing ? (pg.items[i].n || "") : "";
    $("dlgUrl").value = editing ? (pg.items[i].u || "") : "";
    $("dlgTags").value = editing && pg.items[i].tags ? pg.items[i].tags.join(", ") : "";
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
    var old = dlgIdx >= 0 ? activePage().items[dlgIdx] : null;
    var sc = {
      id: old && old.id ? old.id : uid("sc"),
      n: n || hostOf(u),
      u: u,
      /* 保留旧版本的文件夹字段，避免编辑旧数据时意外丢失；功能已不再暴露。 */
      folder: old && old.folder ? old.folder : "",
      tags: parseShortcutTags($("dlgTags").value),
      pos: old && old.pos ? old.pos : { x: 0, y: 0 }
    };
    var pg = activePage();
    if (dlgIdx >= 0) pg.items[dlgIdx] = sc;
    else if (pg.items.length >= 60) { toast("本组最多保存 60 个快捷方式"); return; }
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
      b.title = "点击切换场景 · 拖动排序 · 双击改名 · 右键删除场景";
      b.draggable = true;
      b.addEventListener("dragstart", function (ev) {
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", p.id);
        b.classList.add("reordering");
      });
      b.addEventListener("dragend", function () {
        b.classList.remove("reordering");
        [].slice.call(box.querySelectorAll(".ptab")).forEach(function (tab) { tab.classList.remove("page-drop-target"); });
      });
      b.addEventListener("dragover", function (ev) {
        if (!ev.dataTransfer.types || [].slice.call(ev.dataTransfer.types).indexOf("text/plain") < 0) return;
        ev.preventDefault();
        b.classList.add("page-drop-target");
      });
      b.addEventListener("dragleave", function () { b.classList.remove("page-drop-target"); });
      b.addEventListener("drop", function (ev) {
        ev.preventDefault();
        b.classList.remove("page-drop-target");
        var fromId = ev.dataTransfer.getData("text/plain");
        var from = S.pages.findIndex(function (page) { return page.id === fromId; });
        var to = S.pages.indexOf(p);
        if (from < 0 || to < 0 || from === to) return;
        var before = layoutSnapshot();
        S.pages.splice(to, 0, S.pages.splice(from, 1)[0]);
        store.save({ pages: S.pages });
        buildPager();
        recordLayoutUndo("场景顺序已更新", before);
      });
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
    add.title = "新建场景";
    add.addEventListener("click", function () {
      var pg = { id: pageUid(), name: "场景 " + (S.pages.length + 1), items: [], cal: null, todo: null, note: null, cd: null, tileSize: "medium" };
      S.pages.push(pg);
      S.activePage = pg.id;
      store.save({ pages: S.pages, activePage: S.activePage });
      switchPage(pg.id, true);
      toast("已新建场景，双击名称可改名");
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
    selectedShortcuts = {};
    var grid = $("tileGrid");
    var cal = $("calWrap");
    grid.classList.add("out");
    if (cal) cal.classList.add("out");   /* 日历与瓦片一起滑出 */
    setTimeout(function () {
      renderTiles();
      buildPager();
      renderNote();                      /* 便签内容随页切换 */
      renderTodos();                     /* 新建待办归属当前场景 */
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
    toast("已删除场景「" + p.name + "」");
  }

  /* ---------------- 日历 ---------------- */
  var calY = 0, calM = 0;
  function dateKey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function dateFromKey(key) { var p = String(key || "").split("-").map(Number); return p.length === 3 && p.every(function (x) { return isFinite(x); }) ? new Date(p[0], p[1] - 1, p[2]) : new Date(); }
  function lunarLabel(d) { try { return new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month: "long", day: "numeric" }).format(d); } catch (e) { return ""; } }
  function calEventsOn(key) { return (S.calendar.events || []).filter(function (x) { return x.start <= key && (x.end || x.start) >= key; }); }
  function calCell(d, cls) {
    var key = dateKey(d), cell = document.createElement("button"); cell.type = "button"; cell.className = "calcell " + (cls || ""); cell.setAttribute("data-date", key);
    var n = document.createElement("span"); n.textContent = d.getDate(); cell.appendChild(n);
    if (key === dateKey(new Date())) cell.classList.add("today");
    if (key === calSelectedDate) cell.classList.add("selected");
    var events = calEventsOn(key);
    if (events.length) { var dots = document.createElement("i"); dots.className = "caldots"; dots.textContent = events.length > 2 ? "•••" : "•".repeat(events.length); cell.appendChild(dots); }
    cell.title = key + (lunarLabel(d) ? " · 农历 " + lunarLabel(d) : "") + (events.length ? " · " + events.map(function (x) { return x.title; }).join("、") : "");
    cell.addEventListener("click", function () { calSelectedDate = key; renderCal(); }); return cell;
  }
  function renderCalAgenda() {
    var box = $("calAgenda"); if (!box) return; box.textContent = "";
    var key = calSelectedDate || dateKey(new Date()), head = document.createElement("div"); head.className = "calagenda-head"; head.textContent = key + (lunarLabel(dateFromKey(key)) ? " · 农历 " + lunarLabel(dateFromKey(key)) : ""); box.appendChild(head);
    var events = calEventsOn(key);
    if (!events.length) { var empty = document.createElement("div"); empty.className = "calagenda-empty"; empty.textContent = "当天没有日程"; box.appendChild(empty); return; }
    events.slice(0, 4).forEach(function (event) { var row = document.createElement("div"); row.className = "calevent"; var text = document.createElement("span"); text.textContent = event.title + (event.location ? " · " + event.location : ""); var del = document.createElement("button"); del.type = "button"; del.textContent = "×"; del.title = "删除日程"; del.addEventListener("click", function () { S.calendar.events = S.calendar.events.filter(function (x) { return x.id !== event.id; }); store.save({ calendar: S.calendar }); renderCal(); }); row.appendChild(text); row.appendChild(del); box.appendChild(row); });
  }
  function renderCalWeek() {
    var week = $("calWeek"), grid = $("calGrid"), dow = $("calWrap").querySelector(".caldow"); grid.hidden = true; dow.hidden = true; week.hidden = false; week.textContent = "";
    var base = dateFromKey(calSelectedDate || dateKey(new Date())); base.setDate(base.getDate() - base.getDay());
    for (var i = 0; i < 7; i++) { var d = new Date(base); d.setDate(base.getDate() + i); var col = document.createElement("div"); col.className = "calweek-col"; var head = document.createElement("button"); head.type = "button"; head.className = "calweek-head"; head.textContent = WEEK_SHORT[d.getDay()] + " " + (d.getMonth() + 1) + "/" + d.getDate(); (function (key) { head.addEventListener("click", function () { calSelectedDate = key; renderCal(); }); })(dateKey(d)); col.appendChild(head); calEventsOn(dateKey(d)).slice(0, 4).forEach(function (x) { var e = document.createElement("div"); e.className = "calweek-event"; e.textContent = x.title; col.appendChild(e); }); week.appendChild(col); }
    var end = new Date(base); end.setDate(base.getDate() + 6); $("calTitle").textContent = dateKey(base).slice(5) + " — " + dateKey(end).slice(5);
  }
  function renderCal() {
    var grid = $("calGrid"), dow = $("calWrap").querySelector(".caldow");
    if (calView === "week") { renderCalWeek(); renderCalAgenda(); window.LiquidGlass.refresh(); return; }
    grid.hidden = false; dow.hidden = false; $("calWeek").hidden = true; grid.textContent = "";
    var first = new Date(calY, calM, 1), startDow = first.getDay(), days = new Date(calY, calM + 1, 0).getDate(), start = new Date(calY, calM, 1 - startDow), rows = Math.ceil((startDow + days) / 7);
    for (var i = 0; i < rows * 7; i++) { var d = new Date(start); d.setDate(start.getDate() + i); grid.appendChild(calCell(d, d.getMonth() === calM ? "" : "dim")); }
    $("calTitle").textContent = calY + "年" + (calM + 1) + "月"; renderCalAgenda(); window.LiquidGlass.refresh();
  }
  function calShift(d) {
    if (calView === "week") { var base = dateFromKey(calSelectedDate || dateKey(new Date())); base.setDate(base.getDate() + d * 7); calSelectedDate = dateKey(base); calY = base.getFullYear(); calM = base.getMonth(); }
    else { calM += d; if (calM < 0) { calM = 11; calY--; } else if (calM > 11) { calM = 0; calY++; } }
    renderCal();
  }
  function openCalendarEvent(date) { $("calEventTitle").value = ""; $("calEventStart").value = date || calSelectedDate || dateKey(new Date()); $("calEventEnd").value = $("calEventStart").value; $("calEventLocation").value = ""; $("calEventDialog").classList.add("open"); window.LiquidGlass.refresh(); setTimeout(function () { $("calEventTitle").focus(); }, 30); }
  function saveCalendarEvent() {
    var title = $("calEventTitle").value.trim(), start = $("calEventStart").value, end = $("calEventEnd").value || start;
    if (!title || !validDate(start)) { toast("请填写日程名称和日期"); return; }
    S.calendar.events.push({ id: uid("event"), title: title.slice(0, 80), start: start, end: validDate(end) ? end : start, allDay: true, location: $("calEventLocation").value.trim().slice(0, 120), source: "local" }); store.save({ calendar: S.calendar }); $("calEventDialog").classList.remove("open"); renderCal(); toast("日程已添加");
  }

  /* ---------------- 小组件：待办 / 便签 / 倒数日 ---------------- */
  function todoDueText(t) { if (!t.due) return ""; var label = t.due === todayKey() ? "今天" : t.due < todayKey() ? "已逾期" : t.due; return label + (t.repeat !== "none" ? " · " + ({ daily: "每天", weekly: "每周", monthly: "每月" }[t.repeat] || "重复") : ""); }
  function visibleTodos() { return S.todos.filter(function (t) {
    if (t.sceneId && t.sceneId !== S.activePage) return false;
    if (todoFilter === "open") return !t.done && !t.archived;
    if (todoFilter === "done") return t.done && !t.archived;
    if (todoFilter === "archived") return !!t.archived;
    return !t.archived;
  }); }
  function nextRepeatDate(due, repeat) { var d = dateFromKey(due); if (repeat === "daily") d.setDate(d.getDate() + 1); else if (repeat === "weekly") d.setDate(d.getDate() + 7); else if (repeat === "monthly") d.setMonth(d.getMonth() + 1); else return due; return dateKey(d); }
  function renderTodos() {
    var box = $("todoList"); box.textContent = ""; var list = visibleTodos();
    if (!list.length) { var empty = document.createElement("div"); empty.className = "tempty"; empty.textContent = todoFilter === "archived" ? "没有归档任务" : "还没有待办"; box.appendChild(empty); return; }
    list.slice(0, 100).forEach(function (t) {
      var row = document.createElement("div"); row.className = "titem" + (t.done ? " done" : "") + (t.priority === "urgent" ? " urgent" : t.priority === "high" ? " high" : "");
      var chk = document.createElement("button"); chk.type = "button"; chk.className = "tchk"; chk.title = t.done ? "标记为未完成" : "标记为已完成";
      chk.addEventListener("click", function () {
        if (!t.done && t.repeat !== "none" && t.due) S.todos.unshift(normalizeTodo({ t: t.t, due: nextRepeatDate(t.due, t.repeat), priority: t.priority, repeat: t.repeat, remind: t.remind, sceneId: t.sceneId }, 0));
        t.done = !t.done;
        if (t.sourceId) updateSidebarItem(t.sourceId, function (item) { item.readState = t.done ? "done" : "later"; });
        store.save({ todos: S.todos }); renderTodos(); updateProductivity();
      });
      var col = document.createElement("div"); col.className = "todo-col";
      var tx = document.createElement("span"); tx.className = "ttxt"; tx.textContent = t.t; tx.title = "双击编辑";
      tx.addEventListener("dblclick", function () {
        var edit = document.createElement("input"); edit.className = "todo-edit"; edit.type = "text"; edit.maxLength = 60; edit.value = t.t;
        var committed = false;
        function finish(save) {
          if (committed) return; committed = true;
          if (save && edit.value.trim()) { t.t = edit.value.trim().slice(0, 60); store.save({ todos: S.todos }); }
          renderTodos();
        }
        edit.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); finish(true); } else if (ev.key === "Escape") { ev.preventDefault(); finish(false); } });
        edit.addEventListener("blur", function () { finish(true); });
        tx.replaceWith(edit); edit.focus(); edit.select();
      });
      col.appendChild(tx);
      var meta = document.createElement("small"); meta.className = "todo-meta"; meta.textContent = [t.sourceId ? "阅读收藏" : "", todoDueText(t), t.priority !== "normal" ? ({ low: "低", high: "重要", urgent: "紧急" }[t.priority]) : "", t.remind ? "提醒" : ""].filter(Boolean).join(" · "); if (meta.textContent) col.appendChild(meta);
      var openSource = null;
      if (t.sourceId || t.sourceUrl) {
        openSource = document.createElement("button"); openSource.type = "button"; openSource.className = "todoact"; openSource.textContent = "↗"; openSource.title = "打开关联收藏";
        openSource.addEventListener("click", function () {
          var source = S.sidebar.filter(function (x) { return x.id === t.sourceId; })[0];
          if (source) openCollectionItem(source); else if (t.sourceUrl) openURL(t.sourceUrl);
        });
      }
      var arch = document.createElement("button"); arch.type = "button"; arch.className = "todoact"; arch.textContent = t.archived ? "↩" : "▣"; arch.title = t.archived ? "取消归档" : "归档"; arch.addEventListener("click", function () { t.archived = !t.archived; store.save({ todos: S.todos }); renderTodos(); });
      var del = document.createElement("button"); del.type = "button"; del.className = "tdel"; del.textContent = "×"; del.title = "删除"; del.addEventListener("click", function () { S.todos = S.todos.filter(function (x) { return x.id !== t.id; }); store.save({ todos: S.todos }); renderTodos(); });
      row.appendChild(chk); row.appendChild(col); if (openSource) row.appendChild(openSource); row.appendChild(arch); row.appendChild(del); box.appendChild(row);
    });
  }
  function addTodo() {
    var v = $("todoInput").value.trim(); if (!v) return;
    if ($("todoRemind").checked && typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(function () {});
    S.todos.unshift(normalizeTodo({ id: uid("todo"), t: v, due: $("todoDue").value, priority: $("todoPriority").value, repeat: $("todoRepeat").value, remind: $("todoRemind").checked, done: false, archived: false, sceneId: S.activePage }, 0));
    if (S.todos.length > 100) S.todos.length = 100; $("todoInput").value = ""; $("todoDue").value = ""; $("todoRemind").checked = false; store.save({ todos: S.todos }); renderTodos(); updateProductivity();
  }
  function checkTodoReminders() {
    var today = todayKey(), changed = false; S.todos.forEach(function (t) { if (t.remind && t.due === today && !t.done && !t.archived && t.notifiedAt !== today) { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("待办提醒", { body: t.t }); t.notifiedAt = today; changed = true; } }); if (changed) store.save({ todos: S.todos });
  }
  var noteTimer = 0;
  function renderNote() {
    $("noteText").value = activePage().noteText || "";
  }
  function renderCd() {
    var body = $("cdBody"); body.textContent = "";
    var form = document.createElement("div"); form.className = "cdform";
    var name = document.createElement("input"); name.id = "cdName"; name.maxLength = 30; name.placeholder = "事件名称";
    var date = document.createElement("input"); date.id = "cdDate"; date.type = "date";
    var go = document.createElement("button"); go.type = "button"; go.id = "cdGo"; go.textContent = "添加";
    go.addEventListener("click", function () { var n = name.value.trim() || "倒数日", d = date.value; if (!validDate(d)) { toast("请选择目标日期"); return; } var c = normalizeCountdown({ id: uid("cd"), n: n, d: d }); S.countdowns.unshift(c); S.cd = S.countdowns[0] || null; store.save({ countdowns: S.countdowns, cd: S.cd }); name.value = ""; date.value = ""; renderCd(); toast("倒数日已添加"); });
    form.appendChild(name); form.appendChild(date); form.appendChild(go); body.appendChild(form);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    S.countdowns.slice(0, 5).forEach(function (cd) { var target = new Date(cd.d + "T00:00:00"), days = Math.round((target - today) / 86400000); var row = document.createElement("div"); row.className = "cditem"; var nm = document.createElement("div"); nm.className = "cdname"; nm.textContent = cd.n; var big = document.createElement("strong"); big.className = "cdbig"; big.textContent = days; var sub = document.createElement("div"); sub.className = "cdsub"; sub.textContent = (days > 0 ? "还有 " + days + " 天" : days === 0 ? "就是今天" : "已过 " + (-days) + " 天") + " · " + cd.d; var del = document.createElement("button"); del.type = "button"; del.className = "cdedit"; del.textContent = "删除"; del.addEventListener("click", function () { S.countdowns = S.countdowns.filter(function (x) { return x.id !== cd.id; }); S.cd = S.countdowns[0] || null; store.save({ countdowns: S.countdowns, cd: S.cd }); renderCd(); }); row.appendChild(nm); row.appendChild(big); row.appendChild(sub); row.appendChild(del); body.appendChild(row); });
  }

  /* ---------------- 生产力：番茄钟 / 目标 / 世界时钟 / 屏蔽 ---------------- */
  function pomoRemaining() {
    var p = S.productivity.pomo;
    return p.running && p.endAt ? Math.max(0, Math.ceil((p.endAt - Date.now()) / 1000)) : Math.max(0, p.seconds);
  }
  function renderPomodoro() {
    var p = S.productivity.pomo, left = pomoRemaining();
    if (p.running && left <= 0) {
      p.running = false; p.seconds = p.mode === "focus" ? 5 * 60 : 25 * 60; p.mode = p.mode === "focus" ? "break" : "focus"; if (p.mode === "focus") p.round++; p.endAt = 0; store.save({ productivity: S.productivity }); if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("番茄钟", { body: p.mode === "break" ? "专注完成，休息一下" : "休息结束，开始下一轮专注" }); toast(p.mode === "break" ? "专注完成，进入休息" : "休息结束，开始专注"); left = p.seconds;
    }
    var mm = Math.floor(left / 60), ss = left % 60; if ($("pomoTime")) $("pomoTime").textContent = pad2(mm) + ":" + pad2(ss); if ($("pomoMode")) $("pomoMode").textContent = p.mode === "focus" ? "专注" : "休息"; if ($("pomoStart")) $("pomoStart").textContent = p.running ? "暂停" : "开始";
  }
  function togglePomodoro() { var p = S.productivity.pomo; if (p.running) { p.seconds = pomoRemaining(); p.running = false; p.endAt = 0; } else { p.running = true; p.endAt = Date.now() + p.seconds * 1000; if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(function () {}); } store.save({ productivity: S.productivity }); renderPomodoro(); }
  function resetPomodoro() { var p = S.productivity.pomo; p.running = false; p.endAt = 0; p.seconds = p.mode === "focus" ? 25 * 60 : 5 * 60; store.save({ productivity: S.productivity }); renderPomodoro(); }
  function updateProductivity() {
    if (!S || !S.productivity) return;
    var done = S.todos.filter(function (x) { return x.done && !x.archived; }).length, goal = S.productivity.goal || 1;
    if ($("goalText")) $("goalText").textContent = done + " / " + goal;
    if ($("goalBar")) $("goalBar").style.width = Math.min(100, done / goal * 100) + "%";
    if ($("goalInput")) $("goalInput").value = goal;
    var q = $("quoteText"); if (q) q.textContent = DEFAULT_QUOTES[Math.floor(new Date(todayKey()).getTime() / 86400000) % DEFAULT_QUOTES.length];
    if ($("focusToggle")) $("focusToggle").textContent = S.productivity.focusMode ? "关闭专注模式" : "开启专注模式";
    renderPomodoro(); renderWorldClocks(); renderBlockedSites();
    document.body.classList.toggle("focus-mode", !!S.productivity.focusMode);
  }
  function renderWorldClocks() {
    var box = $("worldClocks"); if (!box || !S) return; box.textContent = "";
    (S.productivity.clocks || []).forEach(function (c) { var row = document.createElement("div"); row.className = "world-clock"; var label = document.createElement("span"); label.textContent = c.name; var now = document.createElement("strong"); try { now.textContent = new Intl.DateTimeFormat("zh-CN", { timeZone: c.zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()); } catch (e) { now.textContent = "--:--"; } var del = document.createElement("button"); del.type = "button"; del.textContent = "×"; del.title = "删除"; del.addEventListener("click", function () { S.productivity.clocks = S.productivity.clocks.filter(function (x) { return x.id !== c.id; }); store.save({ productivity: S.productivity }); updateProductivity(); }); row.appendChild(label); row.appendChild(now); row.appendChild(del); box.appendChild(row); });
  }
  function addWorldClock() {
    $("clockNameInput").value = "";
    $("clockZoneInput").value = "Europe/Paris";
    $("worldClockDialog").classList.add("open");
    window.LiquidGlass.refresh();
    setTimeout(function () { $("clockNameInput").focus(); }, 30);
  }
  function closeWorldClockDialog() { $("worldClockDialog").classList.remove("open"); }
  function saveWorldClock() {
    var zone = $("clockZoneInput").value.trim(), name = $("clockNameInput").value.trim();
    if (!zone) { toast("请填写时区"); return; }
    try { new Intl.DateTimeFormat("en", { timeZone: zone }).format(); } catch (e) { toast("时区名称无效，例如 Europe/Paris"); return; }
    if (!name) name = zone.split("/").pop().replace(/_/g, " ");
    S.productivity.clocks.push({ id: uid("clock"), name: name.slice(0, 30), zone: zone.slice(0, 80) });
    store.save({ productivity: S.productivity });
    closeWorldClockDialog();
    updateProductivity();
    toast("已添加世界时钟");
  }
  function renderBlockedSites() { var box = $("blockedSites"); if (!box || !S) return; box.textContent = ""; (S.productivity.blockedSites || []).forEach(function (site) { var row = document.createElement("div"); row.className = "blocked-site"; row.textContent = site; var del = document.createElement("button"); del.type = "button"; del.textContent = "×"; del.addEventListener("click", function () { S.productivity.blockedSites = S.productivity.blockedSites.filter(function (x) { return x !== site; }); store.save({ productivity: S.productivity }); updateProductivity(); }); row.appendChild(del); box.appendChild(row); }); }
  function addBlockedSite() { var value = $("blockInput").value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]; if (!/^[a-z0-9.-]+$/.test(value)) { toast("请输入有效域名"); return; } if (S.productivity.blockedSites.indexOf(value) < 0) S.productivity.blockedSites.push(value); $("blockInput").value = ""; store.save({ productivity: S.productivity }); updateProductivity(); }
  function openProductivityPanel() { $("productivityPanel").classList.add("open"); $("productivityPanel").setAttribute("aria-hidden", "false"); updateProductivity(); window.LiquidGlass.refresh(); }
  function closeProductivityPanel() { $("productivityPanel").classList.remove("open"); $("productivityPanel").setAttribute("aria-hidden", "true"); }
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
  var sbQuery = "", sbFilter = "all";
  var sbBatchMode = false, sbSelected = Object.create(null), sbUndo = null, sbUndoTimer = 0;
  var sbMutationQueue = [], sbMutationBusy = false, SB_MUTATION_MAX_ATTEMPTS = 3;

  function sbVisibleItems() {
    return S.sidebar.filter(sbMatches);
  }
  function sbSelectedItems() {
    return S.sidebar.filter(function (item) { return !!sbSelected[item.id]; });
  }
  function sbFocusCard(id) {
    if (!id) return;
    var cards = $("sbCanvas").querySelectorAll(".sbcard");
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute("data-id") === String(id)) {
        if (typeof cards[i].focus === "function") cards[i].focus();
        return;
      }
    }
  }
  function openCollectionItem(item) {
    if (!item) return;
    if (item.type === "link" && item.url) { openURL(item.url); return; }
    if (item.type === "image" && (item.url || item.src) && /^https?:/i.test(item.url || item.src)) {
      openURL(item.url || item.src); return;
    }
    openSb();
    setTimeout(function () { sbFocusCard(item.id); }, 100);
  }
  function sbPruneSelection() {
    var live = Object.create(null);
    S.sidebar.forEach(function (item) { if (item && sbSelected[item.id]) live[item.id] = true; });
    sbSelected = live;
  }
  function sbToggleSelected(id) {
    if (!id) return;
    if (sbSelected[id]) delete sbSelected[id];
    else sbSelected[id] = true;
    renderSidebar();
    sbFocusCard(id);
  }
  function sbSelectVisible() {
    sbVisibleItems().forEach(function (item) { if (item.id) sbSelected[item.id] = true; });
    renderSidebar();
  }
  function sbClearSelection() {
    sbSelected = Object.create(null);
    renderSidebar();
  }

  /* 批量变更专用：每页串行执行，并在写后比较完整快照以发现并发覆盖。 */
  function sbStorageError() {
    var runtime = typeof chrome !== "undefined" && chrome.runtime;
    var lastError = runtime && runtime.lastError;
    return lastError ? new Error(lastError.message || "本地存储操作失败") : null;
  }
  function sbClone(value) {
    try { return JSON.parse(JSON.stringify(value && typeof value === "object" ? value : {})); }
    catch (e) { throw new Error("本地存储数据无法复制"); }
  }
  function sbStamp(value) { return JSON.stringify(value); }
  function sbReadStored(done) {
    try {
      chrome.storage.local.get(KEY, function (box) {
        var error = sbStorageError();
        if (error) { done(null, error); return; }
        var raw = box && box[KEY] && typeof box[KEY] === "object" ? box[KEY] : {};
        try {
          var state = sbClone(raw);
          done({ state: state, stamp: sbStamp(state) }, null);
        } catch (e) { done(null, e); }
      });
    } catch (e) { done(null, e); }
  }
  function sbWriteStored(state, done) {
    try {
      var payload = {}; payload[KEY] = state;
      chrome.storage.local.set(payload, function () { done(sbStorageError()); });
    } catch (e) { done(e); }
  }
  function runSidebarMutation(mutator, done) {
    if (!HAS_CHROME) {
      try {
        var localResult = mutator(S.sidebar);
        if (localResult && localResult.changed) {
          S.sidebar = localResult.sidebar;
          store.save({ sidebar: S.sidebar });
        }
        done(localResult, null, S);
      } catch (e) { done(null, e, S); }
      return;
    }
    var attempts = 0, mutationApplied = false, appliedResult = null;
    function attempt() {
      attempts++;
      sbReadStored(function (snapshot, readError) {
        if (readError) { done(null, readError, snapshot && snapshot.state); return; }
        var authoritative = snapshot.state, latest;
        try { latest = sbClone(authoritative); }
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
        sbReadStored(function (beforeWrite, compareError) {
          if (compareError) { done(null, compareError, authoritative); return; }
          if (beforeWrite.stamp !== snapshot.stamp) {
            if (attempts >= SB_MUTATION_MAX_ATTEMPTS) {
              done(null, new Error("本地存储在重试后仍持续变化"), beforeWrite.state);
              return;
            }
            attempt();
            return;
          }
          latest.updatedAt = Date.now();
          mutationApplied = true;
          appliedResult = result;
          sbWriteStored(latest, function (writeError) {
            if (writeError) {
              done(null, writeError, authoritative);
              return;
            }
            sbReadStored(function (afterWrite, verifyError) {
              if (verifyError) { done(null, verifyError, authoritative); return; }
              if (afterWrite.stamp !== sbStamp(latest)) {
                if (attempts >= SB_MUTATION_MAX_ATTEMPTS) {
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
    if (sbMutationBusy || !sbMutationQueue.length) return;
    sbMutationBusy = true;
    var job = sbMutationQueue.shift();
    function finish(result, error, latest) {
      if (latest) {
        S.sidebar = Array.isArray(latest.sidebar) ? latest.sidebar : [];
        if (latest.updatedAt) S.updatedAt = latest.updatedAt;
      }
      try { if (typeof job.done === "function") job.done(result, error); }
      finally { sbMutationBusy = false; drainSidebarMutations(); }
    }
    try { runSidebarMutation(job.mutator, finish); }
    catch (e) { finish(null, e, S); }
  }
  function mutateSidebar(mutator, done) {
    sbMutationQueue.push({ mutator: mutator, done: done });
    drainSidebarMutations();
  }

  function sbMatches(item) {
    if (!SB_CORE.matches(item, sbQuery, sbFilter)) return false;
    if (sbStatusFilter === "later") return item.readState === "later";
    if (sbStatusFilter === "done") return item.readState === "done";
    return true;
  }
  function updateSidebarItem(id, update, done) {
    mutateSidebar(function (latestSidebar) {
      var item = latestSidebar.filter(function (x) { return x && x.id === id; })[0];
      if (!item) return { sidebar: latestSidebar, changed: false };
      update(item);
      return { sidebar: latestSidebar, changed: true, item: item };
    }, function (result, error) {
      if (!error && result && result.changed) { renderSidebar(); renderHomePins(); }
      if (typeof done === "function") done(result, error);
    });
  }
  function addSidebarTask(item, markLater) {
    if (!item) return;
    var existing = S.todos.filter(function (t) { return t.sourceId === item.id && !t.done && !t.archived; })[0];
    if (existing) {
      if (markLater) updateSidebarItem(item.id, function (x) { x.readState = "later"; });
      toast("这项收藏已经在待办里"); return;
    }
    var title = item.title || (item.url ? hostOf(item.url) : item.type === "image" ? "图片收藏" : "收藏内容");
    S.todos.unshift(normalizeTodo({
      id: uid("todo"), t: (markLater ? "稍后阅读：" : "处理收藏：") + title,
      sourceId: item.id, sourceUrl: item.url || "", sceneId: S.activePage,
      priority: "normal", repeat: "none", createdAt: Date.now()
    }, 0));
    if (S.todos.length > 100) S.todos.length = 100;
    store.save({ todos: S.todos }); renderTodos(); updateProductivity();
    if (markLater) updateSidebarItem(item.id, function (x) { x.readState = "later"; });
    toast(markLater ? "已加入稍后阅读，并出现在当前场景待办" : "已加入当前场景待办");
  }
  function setSidebarPinned(item) {
    if (!item) return;
    var pin = !item.pinned;
    updateSidebarItem(item.id, function (x) {
      x.pinned = pin;
      if (pin) x.sceneId = S.activePage;
    }, function (result, error) {
      if (error) toast("固定状态保存失败");
      else toast(pin ? "已固定到「" + activePage().name + "」首页" : "已从首页取消固定");
    });
  }
  function setSidebarReadState(item, state, done) {
    if (!item) return;
    if (state === "done") {
      S.todos.forEach(function (todo) { if (todo.sourceId === item.id) todo.done = true; });
      store.save({ todos: S.todos });
      renderTodos();
    }
    updateSidebarItem(item.id, function (x) { x.readState = state; }, done);
  }
  function renderDiscoveryItem(item) {
    discoveryCurrent = item || null;
    if (!item) { $("discoverDialog").classList.remove("open"); $("discoverDialog").setAttribute("aria-hidden", "true"); return; }
    $("discoverTitle").textContent = item.title || (item.url ? hostOf(item.url) : item.type === "image" ? "图片收藏" : "收藏内容");
    var saved = item.savedAt ? new Date(item.savedAt).toLocaleDateString("zh-CN") : "收藏时间未知";
    var origin = item.url ? hostOf(item.url) : item.type === "image" ? "图片" : "文字摘录";
    var scene = item.sceneId ? (S.pages.filter(function (p) { return p.id === item.sceneId; })[0] || {}).name : "";
    $("discoverMeta").textContent = [saved, origin, scene].filter(Boolean).join(" · ");
    $("discoverBody").textContent = item.text || item.url || item.src || "这条收藏还没有备注。";
    $("discoverDialog").classList.add("open"); $("discoverDialog").setAttribute("aria-hidden", "false");
    window.LiquidGlass.refresh();
  }
  function discoverNext() {
    var items = (S.sidebar || []).filter(function (item) {
      return (item.readState === "inbox" || item.readState === "later") && !discoverySeen[item.id];
    });
    if (!items.length) {
      renderDiscoveryItem(null);
      toast(S.sidebar.length ? "未处理的收藏都看过了" : "收集板还是空的");
      return;
    }
    var item = items[Math.floor(Math.random() * items.length)];
    renderDiscoveryItem(item);
  }
  function discoverMark(state) {
    var item = discoveryCurrent;
    if (!item) return;
    discoverySeen[item.id] = true;
    setSidebarReadState(item, state, function (result, error) {
      if (error) { toast("收藏状态保存失败"); return; }
      discoverNext();
    });
  }
  function closeDiscovery() { discoveryCurrent = null; $("discoverDialog").classList.remove("open"); $("discoverDialog").setAttribute("aria-hidden", "true"); }

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
      start: function (d) {
        var it = S.sidebar[idx];
        if (!it) return;
        var z = SB_CORE.bringToFront(S.sidebar, it);
        d.el.style.zIndex = String(z);
      },
      save: function () { store.save({ sidebar: S.sidebar }); },
    };
  }
  function sbFavicon(ic, item) {
    loadFavicon(ic, item.url || item.src || "", item.title || "x");
  }
  function sbCardEl(item, idx) {
    var el = document.createElement("div");
    el.className = "glass sbcard";
    el.setAttribute("data-glass", "");
    el.setAttribute("data-lg-disp", "0");
    el.setAttribute("data-id", item.id);
    el.setAttribute("role", "option");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-selected", sbBatchMode && sbSelected[item.id] ? "true" : "false");
    if (sbBatchMode) el.classList.add("batch-mode");
    if (sbBatchMode && sbSelected[item.id]) el.classList.add("selected");
    var check = document.createElement("span");
    check.className = "sbcheck";
    check.textContent = "✓";
    check.setAttribute("aria-hidden", "true");
    el.appendChild(check);
    el.title = item.url || item.src || "";
    el.style.zIndex = String(typeof item.z === "number" && isFinite(item.z) ? item.z : 0);
    window.LGDragPosition.apply(el, item.x || 0, item.y || 0);

    if (item.type === "image" && item.src) {
      var th = document.createElement("img");
      th.className = "thumb";
      th.alt = "";
      th.referrerPolicy = "no-referrer";
      th.draggable = false;
      th.src = item.src;
      th.addEventListener("error", function () {
        if (item.url && item.url !== item.src) th.src = item.url;
      });
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

    if (item.tags && item.tags.length) {
      var tags = document.createElement("div");
      tags.className = "sbtags";
      item.tags.forEach(function (tag) {
        var badge = document.createElement("span");
        badge.className = "sbtag";
        badge.textContent = "#" + tag;
        tags.appendChild(badge);
      });
      el.appendChild(tags);
    }

    var stateLabel = item.readState === "later" ? "稍后看" : item.readState === "done" ? "已归档" : item.readState === "snoozed" ? "暂不重访" : "";
    if (stateLabel) {
      var state = document.createElement("span"); state.className = "sbstate"; state.textContent = stateLabel;
      el.appendChild(state);
    }

    if (item.type === "text" && item.text) {
      var note = document.createElement("div");
      note.className = "note";
      note.textContent = item.text;
      el.appendChild(note);
    }

    if (!sbBatchMode) {
      var menu = document.createElement("button");
      menu.type = "button"; menu.className = "menu"; menu.setAttribute("data-nodrag", "");
      menu.textContent = "⋯"; menu.title = "收藏操作"; menu.setAttribute("aria-label", "收藏操作");
      var actions = document.createElement("div"); actions.className = "sbactions";
      function action(label, fn) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = label;
        b.addEventListener("click", function (ev) { ev.stopPropagation(); actions.classList.remove("open"); fn(); });
        actions.appendChild(b);
      }
      action("稍后看 · 加入阅读待办", function () { addSidebarTask(item, true); });
      action("加入当前场景待办", function () { addSidebarTask(item, false); });
      action(item.pinned ? "取消固定到首页" : "固定到当前场景首页", function () { setSidebarPinned(item); });
      action(item.readState === "done" ? "移出归档" : "归档收藏", function () { setSidebarReadState(item, item.readState === "done" ? "inbox" : "done", function (r, err) { if (err) toast("归档状态保存失败"); }); });
      action("编辑收藏", function () { openSbDlg(idx); });
      menu.addEventListener("click", function (ev) { ev.stopPropagation(); actions.classList.toggle("open"); });
      el.appendChild(menu);
      el.appendChild(actions);
    }

    el.addEventListener("click", function (ev) {
      if (sbBatchMode) {
        ev.preventDefault();
        ev.stopPropagation();
        sbToggleSelected(item.id);
        return;
      }
      openCollectionItem(item);
    });
    el.addEventListener("keydown", function (ev) {
      if (!sbBatchMode || (ev.key !== "Enter" && ev.key !== " ")) return;
      ev.preventDefault();
      sbToggleSelected(item.id);
    });
    return el;
  }
  function sbEstimateHeight(item) {
    var measured = sbH[item.id];
    if (measured && measured > 0) return measured;
    return item.type === "image" ? 205 : item.type === "text" ? 145 : 86;
  }
  function organizeSidebar() {
    if (!S.sidebar.length) {
      toast("收集板还是空的");
      return;
    }
    var positions = SB_CORE.organizePositions(S.sidebar, {
      x: SB_PAD,
      y: SB_PAD,
      gap: 12,
      heightFor: sbEstimateHeight
    });
    S.sidebar.forEach(function (item, i) {
      item.x = positions[i].x;
      item.y = positions[i].y;
    });
    store.save({ sidebar: S.sidebar });
    renderSidebar();
    toast("已一键整理收集板");
  }
  function renderSidebar() {
    var box = $("sbCanvas");
    var view = SB_CORE.captureScroll(box);
    box.textContent = "";
    var visible = S.sidebar.filter(sbMatches);
    if (!visible.length) {
      var e = document.createElement("div");
      e.className = "sbempty";
      e.textContent = S.sidebar.length ? "没有符合条件的收集项" : "还是空的。把网页里的链接、图片、选中文字直接拖进来即可收藏，也可以点右上角 + 添加。";
      box.appendChild(e);
    }
    S.sidebar.forEach(function (it, i) {
      if (!sbMatches(it)) return;
      var el = sbCardEl(it, i);
      if (!sbBatchMode) attachDrag(el, sbCardSpec(i, el));
      box.appendChild(el);
    });
    renderSbBatchTools();
    sbMeasure();
    sbSyncMeta();
    window.LiquidGlass.refresh();
    SB_CORE.restoreScroll(box, view);
  }
  function sbMeasure() {
    var box = $("sbCanvas");
    var cards = box.querySelectorAll(".sbcard");
    for (var i = 0; i < cards.length; i++) {
      var id = cards[i].getAttribute("data-id");
      if (id) sbH[id] = cards[i].offsetHeight;
    }
  }
  function renderSbBatchTools() {
    sbPruneSelection();
    var toggle = $("sbBatchToggle"), row = $("sbBatchTools"), count = $("sbBatchCount");
    var selectAll = $("sbSelectAll"), clear = $("sbClearSelection"), del = $("sbDeleteSelected");
    var chosen = sbSelectedItems().length, visible = sbVisibleItems().length;
    if (toggle) {
      toggle.textContent = sbBatchMode ? "退出" : "多选";
      toggle.title = sbBatchMode ? "退出批量管理" : "批量管理";
      toggle.setAttribute("aria-label", sbBatchMode ? "退出批量管理" : "进入批量管理");
      toggle.setAttribute("aria-pressed", sbBatchMode ? "true" : "false");
    }
    if (row) row.hidden = !sbBatchMode;
    if (count) count.textContent = "已选 " + chosen + " 项";
    if (selectAll) selectAll.disabled = !visible;
    if (clear) clear.disabled = !chosen;
    if (del) del.disabled = !chosen;
  }
  function toggleSbBatch() {
    sbBatchMode = !sbBatchMode;
    if (!sbBatchMode) sbSelected = Object.create(null);
    renderSidebar();
  }
  function sbSyncMeta() {
    var visible = sbVisibleItems().length;
    $("sbMeta").textContent = visible === S.sidebar.length ? visible + " 项" : visible + "/" + S.sidebar.length + " 项";
    renderSbBatchTools();
  }
  function setSbPopup(kind) {
    var more = $("sbMoreMenu"), filter = $("sbFilterPanel");
    more.hidden = kind !== "more";
    filter.hidden = kind !== "filter";
    $("sbMoreToggle").setAttribute("aria-expanded", String(kind === "more"));
    $("sbFilterToggle").setAttribute("aria-expanded", String(kind === "filter"));
  }
  function syncSbFilterUi() {
    var active = Number(sbFilter !== "all") + Number(sbStatusFilter !== "all");
    var badge = $("sbFilterCount"), toggle = $("sbFilterToggle");
    badge.textContent = String(active);
    badge.hidden = !active;
    toggle.classList.toggle("active", !!active);
    toggle.setAttribute("aria-label", active ? "筛选收集板，已启用 " + active + " 项筛选" : "筛选收集板");
    $("sbClearFilters").disabled = !active;
    ["sbFilters", "sbStatusFilters"].forEach(function (id) {
      [].slice.call($(id).querySelectorAll("button")).forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.classList.contains("on")));
      });
    });
  }
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
    setSbPopup(null);
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
      var src = resolveImageURL(mIm[1], uri);
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
    if (!it || typeof it !== "object") return;
    var item = SB_CORE.normalizeItem(it, sbUid());
    item.id = sbUid();
    if (!item.sceneId) item.sceneId = S.activePage;
    if (item.type === "link" && S.sidebar.some(function (old) { return SB_CORE.sameLink(old, item); })) {
      toast("这个链接已经在收集板中");
      return false;
    }
    normalizeStoredImage(item);
    var box = $("sbCanvas");
    if (e) {
      var r = box.getBoundingClientRect();
      item.x = clampn(e.clientX - r.left + box.scrollLeft - SB_W / 2, SB_PAD, Math.max(SB_PAD, box.clientWidth - SB_W - SB_PAD));
      item.y = Math.max(SB_PAD, e.clientY - r.top + box.scrollTop - 30);
    } else {
      var bottom = SB_PAD;
      S.sidebar.forEach(function (o) { bottom = Math.max(bottom, (o.y || 0) + (sbH[o.id] || 90) + 12); });
      item.x = SB_PAD; item.y = bottom;
    }
    S.sidebar.push(item);
    store.save({ sidebar: S.sidebar });
    renderSidebar();
    persistImage(item);
    return true;
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
    $("sbDlgTags").value = it && it.tags ? it.tags.join(", ") : "";
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
    var tags = SB_CORE.cleanTags($("sbDlgTags").value);
    var u = $("sbDlgUrl").value.trim();
    var tx = $("sbDlgText").value;
    var it;
    if (sbDlgType === "text") {
      if (!tx.trim()) { toast("请填写内容"); return; }
      it = { type: "text", text: tx.slice(0, 2000), title: n || tx.trim().split(/\r?\n/)[0].slice(0, 40), tags: tags };
    } else {
      if (!u) { toast(sbDlgType === "image" ? "请填写图片地址" : "请填写网址"); return; }
      u = resolveImageURL(u);
      if (!/^(https?:\/\/|data:image\/|blob:)/i.test(u)) u = "https://" + u;
      it = sbDlgType === "image"
        ? { type: "image", src: u, url: /^https?:/i.test(u) ? u : "", title: n || "图片", tags: tags }
        : { type: "link", url: u, title: n || hostOf(u), tags: tags };
    }
    if (it.type === "link" && S.sidebar.some(function (old, index) {
      return index !== sbDlgIdx && SB_CORE.sameLink(old, it);
    })) {
      toast("这个链接已经在收集板中");
      return;
    }
    if (sbDlgIdx >= 0 && S.sidebar[sbDlgIdx]) {
      var old = S.sidebar[sbDlgIdx];
      it.id = old.id; it.x = old.x; it.y = old.y;
      it.savedAt = old.savedAt; it.readState = old.readState; it.pinned = old.pinned; it.sceneId = old.sceneId;
      S.sidebar[sbDlgIdx] = it;
    } else {
      var bottom = SB_PAD;
      S.sidebar.forEach(function (o) { bottom = Math.max(bottom, (o.y || 0) + (sbH[o.id] || 90) + 12); });
      it.id = sbUid(); it.x = SB_PAD; it.y = bottom; it.sceneId = S.activePage; it.savedAt = Date.now();
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
  function sbDeleteSelected() {
    var chosen = sbSelectedItems();
    if (!chosen.length) { toast("请先选择收集项"); return; }
    if (!window.confirm("确定删除已选中的 " + chosen.length + " 项收集内容？")) return;
    var ids = Object.keys(sbSelected);
    mutateSidebar(function (latestSidebar) {
      var removed = SB_CORE.removeByIds(latestSidebar, ids);
      return { sidebar: removed.items, removed: removed.removed, changed: !!removed.removed.length };
    }, function (result, error) {
      if (error) {
        sbPruneSelection();
        renderSidebar();
        toast("删除失败，已恢复最新数据");
        return;
      }
      if (!result || !result.removed.length) { sbSelected = Object.create(null); renderSidebar(); return; }
      sbUndo = { removed: result.removed };
      clearTimeout(sbUndoTimer);
      sbSelected = Object.create(null);
      renderSidebar();
      toast("已删除 " + result.removed.length + " 项", sbUndoDelete);
      sbUndoTimer = setTimeout(function () { sbUndo = null; }, 8000);
    });
  }
  function sbUndoDelete() {
    if (!sbUndo) return;
    var snapshot = sbUndo;
    sbUndo = null;
    clearTimeout(sbUndoTimer);
    mutateSidebar(function (latestSidebar) {
      var restored = SB_CORE.restoreByIds(latestSidebar, snapshot.removed);
      return { sidebar: restored, changed: restored.length !== latestSidebar.length };
    }, function (result, error) {
      if (error) {
        sbUndo = snapshot;
        sbUndoTimer = setTimeout(function () { sbUndo = null; }, 8000);
        renderSidebar();
        toast("撤销失败，已恢复最新数据");
        return;
      }
      if (!result || !result.changed) { renderSidebar(); return; }
      renderSidebar();
      toast("已撤销删除");
    });
  }

  function initSb() {
    $("sbZone").addEventListener("mouseenter", openSb);
    $("sbZone").addEventListener("mouseleave", scheduleSbClose);
    $("sbar").addEventListener("mouseenter", function () { clearTimeout(sbCloseTimer); });
    $("sbar").addEventListener("mouseleave", scheduleSbClose);
    $("sbAdd").addEventListener("click", function () { openSbDlg(-1); });
    $("sbMoreToggle").addEventListener("click", function () { setSbPopup($("sbMoreMenu").hidden ? "more" : null); });
    $("sbFilterToggle").addEventListener("click", function () { setSbPopup($("sbFilterPanel").hidden ? "filter" : null); });
    $("sbOrganize").addEventListener("click", function () { setSbPopup(null); organizeSidebar(); });
    $("sbDiscover").addEventListener("click", function () { setSbPopup(null); discoverySeen = Object.create(null); discoverNext(); });
    $("sbClearFilters").addEventListener("click", function () {
      sbFilter = "all";
      sbStatusFilter = "all";
      ["sbFilters", "sbStatusFilters"].forEach(function (id) {
        [].slice.call($(id).querySelectorAll("button")).forEach(function (button) {
          button.classList.toggle("on", (button.getAttribute("data-filter") || button.getAttribute("data-status")) === "all");
        });
      });
      syncSbFilterUi();
      renderSidebar();
    });
    document.addEventListener("pointerdown", function (e) {
      if (!$("sbMoreToggle").contains(e.target) && !$("sbMoreMenu").contains(e.target) &&
          !$("sbFilterToggle").contains(e.target) && !$("sbFilterPanel").contains(e.target)) setSbPopup(null);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || ($("sbMoreMenu").hidden && $("sbFilterPanel").hidden)) return;
      var target = $("sbMoreMenu").hidden ? $("sbFilterToggle") : $("sbMoreToggle");
      setSbPopup(null);
      target.focus();
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
    $("discoverSkip").addEventListener("click", function () {
      if (discoveryCurrent) discoverySeen[discoveryCurrent.id] = true;
      discoverNext();
    });
    $("discoverArchive").addEventListener("click", function () { discoverMark("done"); });
    $("discoverHide").addEventListener("click", function () { discoverMark("snoozed"); });
    $("discoverOpen").addEventListener("click", function () { if (discoveryCurrent) openCollectionItem(discoveryCurrent); });
    $("discoverClose").addEventListener("click", closeDiscovery);
    $("discoverDialog").addEventListener("click", function (e) { if (e.target === $("discoverDialog")) closeDiscovery(); });
    $("sbBatchToggle").addEventListener("click", toggleSbBatch);
    $("sbSelectAll").addEventListener("click", sbSelectVisible);
    $("sbClearSelection").addEventListener("click", sbClearSelection);
    $("sbDeleteSelected").addEventListener("click", sbDeleteSelected);
    $("sbSearch").addEventListener("input", function () {
      sbQuery = this.value;
      renderSidebar();
    });
    [].slice.call($("sbFilters").querySelectorAll("button")).forEach(function (b) {
      b.addEventListener("click", function () {
        sbFilter = b.getAttribute("data-filter") || "all";
        [].slice.call($("sbFilters").children).forEach(function (x) { x.classList.toggle("on", x === b); });
        syncSbFilterUi();
        renderSidebar();
      });
    });
    [].slice.call($("sbStatusFilters").querySelectorAll("button")).forEach(function (b) {
      b.addEventListener("click", function () {
        sbStatusFilter = b.getAttribute("data-status") || "all";
        [].slice.call($("sbStatusFilters").children).forEach(function (x) { x.classList.toggle("on", x === b); });
        syncSbFilterUi();
        renderSidebar();
      });
    });
    syncSbFilterUi();
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
    var list = S.weatherCities || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === S.weatherActiveId) return list[i];
    return list[0] || S.city || CITIES[0];
  }
  function chooseWeatherCity(id) {
    var c = (S.weatherCities || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return; S.weatherActiveId = c.id; S.city = { n: c.n, lat: c.lat, lon: c.lon }; S.geo = c.source === "geo" ? { n: c.n, lat: c.lat, lon: c.lon } : null; store.save({ weatherActiveId: S.weatherActiveId, city: S.city, geo: S.geo }); loadWeather(); renderWxPop();
  }
  function loadWeatherOne(c) {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + c.lat + "&longitude=" + c.lon +
      "&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m" +
      "&hourly=temperature_2m,weather_code,precipitation_probability" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset" +
      "&timezone=auto&forecast_days=5";
    var aq = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + c.lat + "&longitude=" + c.lon + "&current=us_aqi,pm2_5,pm10&timezone=auto";
    return Promise.all([fetch(url).then(function (r) { if (!r.ok) throw new Error("weather"); return r.json(); }), fetch(aq).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })]).then(function (pair) { return { forecast: pair[0], air: pair[1] }; });
  }
  function weatherAlert(j) {
    var cur = j && j.current || {}, code = Number(cur.weather_code), wind = Number(cur.wind_speed_10m);
    if (code >= 95) return "雷暴预警"; if (wind >= 60) return "大风提醒"; if (code === 65 || code === 67 || code === 82) return "强降水提醒"; return "暂无预警";
  }
  function loadWeather() {
    var c = activeCity(), list = (S.weatherCities || []).slice(0, 12);
    Promise.all(list.map(function (city) { return loadWeatherOne(city).then(function (data) { weatherDataByCity[city.id] = data; return data; }).catch(function () { return null; }); })).then(function () {
      var data = weatherDataByCity[c.id], j = data && data.forecast;
      if (!j) throw new Error("weather");
      wxLast = j; var cur = j.current || {}, t = Math.round(cur.temperature_2m), label = WMO[cur.weather_code] || "未知"; setChipIcon(cur.weather_code); $("wxChipText").textContent = c.n + " " + t + "° " + label; $("wxDot").style.background = "#8fe3a8"; $("wxDot").style.boxShadow = ""; if (wxPopIsOpen()) renderWxPop();
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
    var c = activeCity(), record = weatherDataByCity[c.id] || {}, j = record.forecast || wxLast;
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
    var air = record.air && record.air.current ? record.air.current : {}, extra = $("wxExtra");
    if (extra) {
      extra.innerHTML = '<div class="wxextra-line"><span>空气质量 AQI</span><strong>' + (air.us_aqi == null ? "—" : Math.round(air.us_aqi)) + '</strong><span>PM2.5 ' + (air.pm2_5 == null ? "—" : Math.round(air.pm2_5)) + '</span><span>PM10 ' + (air.pm10 == null ? "—" : Math.round(air.pm10)) + '</span></div><div class="wxalert">' + weatherAlert(j) + '</div><div class="wxcities"></div>';
      var cityBox = extra.querySelector(".wxcities");
      (S.weatherCities || []).forEach(function (city) { var data = weatherDataByCity[city.id] && weatherDataByCity[city.id].forecast, btn = document.createElement("button"); btn.type = "button"; btn.className = city.id === S.weatherActiveId ? "on" : ""; btn.textContent = city.n + (data && data.current ? " " + Math.round(data.current.temperature_2m) + "°" : ""); btn.addEventListener("click", function () { chooseWeatherCity(city.id); }); cityBox.appendChild(btn); });
    }

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
  function rotationMs() { return S.wall.rotation === "5m" ? 5 * 60 * 1000 : S.wall.rotation === "15m" ? 15 * 60 * 1000 : S.wall.rotation === "1h" ? 60 * 60 * 1000 : 0; }
  function applyCustomStyle() {
    var style = $("customStyle"); if (!style) { style = document.createElement("style"); style.id = "customStyle"; document.head.appendChild(style); }
    var css = S.wall.customCss || "";
    if (S.wall.fontUrl && S.wall.fontFamily && /^https?:\/\//i.test(S.wall.fontUrl)) css += "\n@font-face{font-family:'" + S.wall.fontFamily.replace(/["'{};]/g, "") + "';src:url('" + S.wall.fontUrl.replace(/["'{};]/g, "") + "')}\n:root{--user-font:'" + S.wall.fontFamily.replace(/["'{};]/g, "") + "'}";
    style.textContent = css;
    document.body.style.fontFamily = S.wall.fontFamily ? "var(--user-font), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : "";
  }
  function activeWallItem() {
    if (!S || !S.wall || !S.wall.activeId) return null;
    var found = (S.wall.library || []).filter(function (w) { return w.id === S.wall.activeId; })[0];
    return found || null;
  }
  function wallItemSource(item) {
    if (!item) return null;
    if (item.kind === "video") return { kind: "video", data: item.data || "", url: item.url || "" };
    if (item.kind === "image") return { kind: "local", data: item.data || "" };
    if (/\.(?:mp4|webm|ogg)(?:[?#].*)?$/i.test(item.url || "")) return { kind: "video", data: "", url: item.url || "" };
    return { kind: "url", url: item.url || "" };
  }
  function wallChoices() {
    var choices = WALLS.map(function (x) { return { kind: "preset", id: x.id }; });
    (S.wall.library || []).forEach(function (item) {
      var src = wallItemSource(item);
      if (src) choices.push(src);
    });
    /* 没有壁纸库的老状态：沿用单个 url / fileData，保证迁移前可用 */
    if (!S.wall.library || !S.wall.library.length) {
      if (S.wall.url) choices.push({ kind: "url", url: S.wall.url });
      if (S.wall.fileData) choices.push({ kind: /^data:video\//i.test(S.wall.fileData) ? "video" : "local", data: S.wall.fileData });
    }
    if (bingUrl) choices.push({ kind: "url", url: bingUrl });
    return choices;
  }
  /* 入库：按 kind+地址去重，超限时淘汰最旧的非正在用条目 */
  function addWallToLibrary(item) {
    var next = normalizeWallItem(item);
    if (!next) { toast("壁纸地址无效，需要 HTTPS 图片/视频直链"); return null; }
    var lib = S.wall.library || (S.wall.library = []);
    var dup = null;
    lib.forEach(function (w) {
      if (dup) return;
      if (w.kind === next.kind && (w.url || "") === (next.url || "") && (w.data || "") === (next.data || "")) dup = w;
    });
    if (dup) return dup;
    next.addedAt = Date.now();
    lib.unshift(next);
    while (lib.length > WALL_LIB_MAX) {
      var dropIx = -1;
      for (var i = lib.length - 1; i >= 0; i--) {
        if (lib[i].id !== S.wall.activeId) { dropIx = i; break; }
      }
      if (dropIx < 0) break;
      lib.splice(dropIx, 1);
    }
    return next;
  }
  function applyWallItem(item) {
    if (!item) return;
    S.wall.activeId = item.id;
    if (item.kind === "video") {
      S.wall.mode = "video";
      S.wall.fileData = item.data || "";
      S.wall.url = item.url || "";
      S.wall.fileType = item.data ? "video/mp4" : "";
    } else if (item.kind === "image") {
      S.wall.mode = "local";
      S.wall.fileData = item.data || "";
      S.wall.url = "";
      S.wall.fileType = "image";
    } else {
      S.wall.mode = "video";
      if (!/\.(?:mp4|webm|ogg)(?:[?#].*)?$/i.test(item.url || "")) S.wall.mode = "url";
      S.wall.url = item.url || "";
      if (S.wall.mode === "url") S.wall.fileData = "";
    }
    store.save({ wall: S.wall });
    applyWall(); syncSettings();
  }
  function deleteWallItem(id) {
    S.wall.library = (S.wall.library || []).filter(function (w) { return w.id !== id; });
    if (S.wall.activeId === id) {
      S.wall.activeId = "";
      S.wall.mode = "preset"; S.wall.id = WALLS[0].id;
      S.wall.url = ""; S.wall.fileData = ""; S.wall.fileType = "";
    }
    store.save({ wall: S.wall });
    applyWall(); syncSettings();
    toast("已删除该壁纸");
  }
  function showWallSource(source) {
    var wall = $("wall"), video = $("wallVideo"), root = document.documentElement;
    if (video) { video.pause(); video.removeAttribute("src"); video.style.display = "none"; }
    wall.style.backgroundImage = "";
    if (source && source.kind === "preset") {
      var p = WALLS[0]; WALLS.forEach(function (w) { if (w.id === source.id) p = w; }); wall.style.backgroundImage = p.css; root.style.setProperty("--tex", (S.tex * 0.45).toFixed(2));
    } else if (source && source.kind === "video" && video) {
      video.src = source.data || S.wall.url; video.style.display = "block"; video.play().catch(function () {}); root.style.setProperty("--tex", (S.tex * 0.35).toFixed(2));
    } else if (source && (source.kind === "url" || source.kind === "local")) {
      var u = source.url || source.data || ""; wall.style.backgroundImage = u ? 'url("' + u.replace(/["\\]/g, "") + '")' : WALLS[0].css; root.style.setProperty("--tex", (S.tex * 0.45).toFixed(2));
    }
  }
  function applyWall() {
    var source;
    var active = activeWallItem();
    if (active) source = wallItemSource(active);
    else if (S.wall.mode === "url") source = { kind: "url", url: S.wall.url };
    else if (S.wall.mode === "video") source = { kind: "video", data: S.wall.fileData, url: S.wall.url };
    else if (S.wall.mode === "local") source = { kind: "local", data: S.wall.fileData || S.wall.url, url: S.wall.url };
    else if (S.wall.mode === "bing" && bingUrl) source = { kind: "url", url: bingUrl };
    else if (S.wall.mode === "random") { var list = wallChoices(); source = list[(S.wall.randomIndex || 0) % list.length]; }
    else source = { kind: "preset", id: S.wall.id };
    showWallSource(source); applyCustomStyle(); scheduleWallRotation();
  }
  function scheduleWallRotation() {
    clearTimeout(wallTimer); var ms = rotationMs(); if (!ms) return; wallTimer = setTimeout(function () { if (S.wall.mode === "random") { var list = wallChoices(); S.wall.randomIndex = ((S.wall.randomIndex || 0) + 1) % Math.max(1, list.length); store.save({ wall: S.wall }); applyWall(); } else { S.wall.mode = "random"; S.wall.randomIndex = 1; store.save({ wall: S.wall }); applyWall(); } }, ms);
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
    var displayScale = S.glass.profile === "readable" ? 1.12 : S.glass.profile === "clear" ? 1.3 : 1.2;
    var strength = Math.max(4, DR * Math.max(0.23, S.glass.str * displayScale) * 2.4);
    var band = Math.max(4, DR * S.glass.band * 2.9 * 1.08);

    LG.rawFilter("lgDrop", LG.rawMap(W, H, sdf, band, strength), strength, Math.max(0.8, S.glass.disp * displayScale));
    /* 与引擎同理：水滴层不挂 blur，避免 Chromium 的 backdrop blur 边缘溢出亮带 */
    var v = "url(#lgDrop) saturate(140%) brightness(1.02)";
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
     用 left/top 偏移，避免把 SVG backdrop-filter 元素提升到 transform 合成层。
     按住时严格 1:1 跟手，松手后交给欠阻尼弹簧做惯性 + 过冲。
     spec = { obj, bounds, put, save, start, frame, end, exclude } */
  var BLOCKS = [
    { id: "searchWrap", key: "search" },
    { id: "calWrap", key: "cal", page: true, flow: true },
    { id: "todoWrap", key: "todo", page: true, flow: true },
    { id: "noteWrap", key: "note", page: true, flow: true },
    { id: "cdWrap", key: "cd", page: true, flow: true }
  ];
  /* 小组件默认横向排布；编辑布局时可以独立移动并保存偏移。 */
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
  var dragCtx = null, dragLoop = 0, dropPageTab = null;

  function clearPageDropTarget() {
    if (dropPageTab) dropPageTab.classList.remove("page-drop-target");
    dropPageTab = null;
  }
  function updatePageDropTarget(d, x, y) {
    d.dropPageId = null;
    if (!d.spec.shortcut || !d.moved) return;
    /* 场景标签在一次拖动中位置稳定；滚动/缩放后才重新测量。 */
    if (!d.pageTargets) {
      d.pageTargets = [];
      [].slice.call($("pager").querySelectorAll(".ptab[data-id]")).forEach(function (tab) {
        var id = tab.getAttribute("data-id");
        var page = S.pages.filter(function (p) { return p.id === id; })[0];
        if (page && id !== S.activePage && page.items.length < 60) {
          d.pageTargets.push({ tab: tab, id: id, rect: tab.getBoundingClientRect() });
        }
      });
    }
    var target = null;
    d.pageTargets.some(function (entry) {
      var r = entry.rect;
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
      target = entry.tab;
      d.dropPageId = entry.id;
      return true;
    });
    if (target !== dropPageTab) {
      clearPageDropTarget();
      dropPageTab = target;
      if (target) target.classList.add("page-drop-target");
    }
  }

  function applyWidgetOrder() {
    var row = $("wgRow"), page = activePage();
    if (!row || !page) return;
    page.widgetOrder = normalizeWidgetOrder(page.widgetOrder);
    var rank = {};
    page.widgetOrder.forEach(function (key, i) { rank[key] = i; });
    BLOCKS.forEach(function (b) {
      if (!b.flow) return;
      var el = $(b.id);
      if (el && el.parentNode === row) el.style.order = String(rank[b.key]);
    });
  }

  function applyLayout() {
    BLOCKS.forEach(function (b) {
      var el = $(b.id);
      if (!el) return;
      var L = layoutObj(b);
      if (!L) { el.style.display = "none"; return; }   /* 本页没有这个小组件 */
      el.style.display = "";
      window.LGDragPosition.apply(el, L.x, L.y);
      el.style.zIndex = L.z ? String(L.z) : "";
    });
    applyWidgetOrder();
  }
  function offsetBounds(nat, w, h) {
    var vw = window.innerWidth, vh = window.innerHeight;
    return {
      minX: (-w + 150) - nat.l, maxX: (vw - 150) - nat.l,
      minY: (-h + 70) - nat.t,  maxY: (vh - 70) - nat.t
    };
  }
  function clampn(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function raiseLayoutItem(el) {
    var page = activePage(), entries = [], target = null;
    var search = S.layout.search || (S.layout.search = { x: 0, y: 0 });
    entries.push({ pos: search, el: $("searchWrap"), z: Number(search.z) || 20 });
    var tiles = Object.create(null);
    [].slice.call($("tileGrid").querySelectorAll(".tile[data-shortcut-id]")).forEach(function (tile) {
      tiles[tile.getAttribute("data-shortcut-id")] = tile;
    });
    (page.items || []).forEach(function (item) {
      item.pos = item.pos || { x: 0, y: 0, z: 0 };
      entries.push({ pos: item.pos, el: tiles[item.id], z: Number(item.pos.z) || 0 });
    });
    BLOCKS.forEach(function (block) {
      if (!block.page) return;
      var pos = page[block.key];
      if (pos) entries.push({ pos: pos, el: $(block.id), z: Number(pos.z) || 0 });
    });
    entries.forEach(function (entry) { if (entry.el === el) target = entry; });
    if (!target) return;
    /* 重排有限序号而非累加到 99 后并列；搜索框和卡片使用同一顺序。 */
    entries.sort(function (a, b) { return a.z - b.z; });
    entries.splice(entries.indexOf(target), 1);
    entries.push(target);
    entries.forEach(function (entry, i) {
      entry.pos.z = i + 1;
      if (entry.el) entry.el.style.zIndex = String(entry.pos.z);
    });
  }

  function beginDragGlass(d) {
    var list = [].slice.call(d.el.querySelectorAll("[data-glass]"));
    if (d.el.hasAttribute("data-glass")) list.unshift(d.el);
    d.liteGlass = list.filter(function (el) { return !el.__lgLite; });
    if (d.liteGlass.length) window.LiquidGlass.lite(d.liteGlass, true);
  }
  function restoreDragGlass(d) {
    if (d.liteGlass && d.liteGlass.length) window.LiquidGlass.lite(d.liteGlass, false);
    d.liteGlass = null;
  }
  function finishDrag(d) {
    if (d.cleanup) d.cleanup();
    d.cx = d.tx;
    d.cy = d.ty;
    d.spec.put(d.tx, d.ty);
    window.LGDragPosition.apply(d.el, d.tx, d.ty);
    if (d.moved && d.layoutBefore) raiseLayoutItem(d.el);
    d.el.classList.remove("dragging");
    restoreDragGlass(d);
    clearPageDropTarget();
    if (d.spec.end) d.spec.end(d);
    if (d.moved && d.layoutBefore) {
      var label = d.el.classList.contains("tile") ? "快捷卡片" :
        d.el.closest("#wgRow") ? "小组件" : "搜索框";
      recordLayoutUndo(label + "位置已更新", d.layoutBefore);
    }
    dragCtx = null;
    if (d.moved) {
      if (d.layoutBefore) store.save({ pages: S.pages, layout: S.layout });
      else d.spec.save();
    }
  }

  function dragStep() {
    dragLoop = 0;
    var d = dragCtx;
    if (!d) return;
    var px = d.cx, py = d.cy;

    if (d.active) {
      updatePageDropTarget(d, d.pointerX, d.pointerY);
      /* 按住时严格 1:1 跟手（不做弹簧插值，否则一定会"拖后腿"） */
      d.cx = d.tx;
      d.cy = d.ty;
    } else {
      /* 松手后交给欠阻尼弹簧：带惯性继续走一点，再回弹定住 */
      window.LGDragSpring.step(d);
    }
    d.cx = clampn(d.cx, d.bn.minX, d.bn.maxX);
    d.cy = clampn(d.cy, d.bn.minY, d.bn.maxY);

    var dvx = d.cx - px, dvy = d.cy - py;
    var sp = Math.hypot(dvx, dvy);
    if (d.active) { d.lvx = dvx; d.lvy = dvy; }

    /* left/top keeps the SVG backdrop filter on the normal paint path.
       A transform on the filtered element itself can reuse stale samples. */
    window.LGDragPosition.apply(d.el, d.cx.toFixed(2), d.cy.toFixed(2));
    if (smenuIsOpen() && d.el.id === "searchWrap") scheduleSuggestOcclusion();

    if (d.spec.frame) d.spec.frame(d);

    /* 按住时只响应新的指针位置；静止不重绘，松手后才连续计算回弹。 */
    if (d.active) return;

    var rest = !d.active &&
      window.LGDragSpring.atRest(d, sp);
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
        d.layoutBefore = d.isLayoutTarget ? layoutSnapshot() : null;
        beginDragGlass(d);
        d.moved = true;
        el.classList.add("dragging");
        if (d.spec.start) d.spec.start(d);
        var sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      }
      e.preventDefault();
      d.tx = clampn(d.o0x + dx, d.bn.minX, d.bn.maxX);
      d.ty = clampn(d.o0y + dy, d.bn.minY, d.bn.maxY);
      d.pointerX = e.clientX;
      d.pointerY = e.clientY;
      d.lastMoveAt = performance.now();
      startDragLoop();
    }
    function onUp(e) {
      var d = dragCtx;
      if (!d || d.el !== el) return;
      if (e && e.pointerId !== undefined && e.pointerId !== d.ptr) return;
      if (!d.active) return;
      if (d.moved) updatePageDropTarget(d, e.clientX, e.clientY);
      if (e.type === "pointercancel") d.dropPageId = null;
      d.active = false;
      docOff();
      if (d.moved && d.dropPageId) {
        var destination = d.dropPageId;
        if (dragLoop) cancelAnimationFrame(dragLoop);
        dragLoop = 0;
        dragCtx = null;
        d.el.classList.remove("dragging");
        restoreDragGlass(d);
        clearPageDropTarget();
        suppressNextClick();
        moveShortcutToPage(d.spec.shortcut, destination);
        switchPage(destination);
        return;
      }
      if (d.moved) {
        suppressNextClick();
        var moving = performance.now() - d.lastMoveAt < 80;
        window.LGDragSpring.release(d, moving ? d.lvx : 0, moving ? d.lvy : 0);
      }
      startDragLoop();
    }
    /* 指针捕获的文档级兜底：
       Chromium 在"同一会话连续两次拖动"时会在 setPointerCapture 后
       立刻回收捕获（gotpointercapture 紧跟 lostpointercapture），
       只依赖元素上的 pointermove 会丢失后续事件。挂在 document
       捕获阶段 + pointerId 过滤，捕获是否存活都能跟手。 */
    function invalidatePageTargets() {
      if (dragCtx && dragCtx.el === el) {
        dragCtx.pageTargets = null;
        if (dragCtx.active && dragCtx.moved) startDragLoop();
      }
    }
    function docOn() {
      docOff();
      document.addEventListener("pointermove", onMove, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("pointercancel", onUp, true);
      document.addEventListener("scroll", invalidatePageTargets, true);
      window.addEventListener("resize", invalidatePageTargets);
    }
    function docOff() {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      document.removeEventListener("scroll", invalidatePageTargets, true);
      window.removeEventListener("resize", invalidatePageTargets);
    }

    el.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      var handle = e.target && e.target.closest ? e.target.closest("[data-drag-handle]") : null;
      var isLayoutTarget = el.id === "searchWrap" || el.classList.contains("tile") || !!el.closest("#wgRow");
      if (el.id === "searchWrap" && (!layoutEdit || !handle)) return;
      var ex = spec.exclude || "input,textarea,select,button,a,[data-nodrag]";
      if (e.target && e.target.closest && e.target.closest(ex) && !handle) return;
      if (dragCtx) settleNow();
      var o = spec.obj();
      var r = el.getBoundingClientRect();
      var nat = { l: r.left - o.x, t: r.top - o.y, w: r.width, h: r.height };
      dragCtx = {
        el: el, spec: spec, ptr: e.pointerId, active: true, moved: false,
        sx: e.clientX, sy: e.clientY, nat: nat,
        isLayoutTarget: isLayoutTarget, layoutBefore: null, cleanup: docOff,
        o0x: o.x, o0y: o.y,
        bn: spec.bounds(nat, nat.w, nat.h),
        tx: o.x, ty: o.y, cx: o.x, cy: o.y, vx: 0, vy: 0, lvx: 0, lvy: 0
      };
      docOn();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });
  }

  function blockSpec(b) {
    return {
      obj: function () { return layoutObjOrCreate(b); },
      bounds: offsetBounds,
      put: function (x, y) { var L = layoutObjOrCreate(b); L.x = x; L.y = y; },
      save: function () { saveLayoutObj(b); },
    };
  }
  function attachTileDrag(el, sc) {
    attachDrag(el, {
      shortcut: sc,
      exclude: "button,a,[data-nodrag],.menu",
      obj: function () { return sc.pos || (sc.pos = { x: 0, y: 0 }); },
      bounds: offsetBounds,
      put: function (x, y) { sc.pos.x = x; sc.pos.y = y; },
      save: function () { store.save({ pages: S.pages }); }
    });
  }

  function attachWidgetDrag(el, block) {
    attachDrag(el, {
      exclude: "input,textarea,select,button,a,[data-nodrag]",
      obj: function () { return layoutObjOrCreate(block); },
      bounds: offsetBounds,
      put: function (x, y) { var pos = layoutObjOrCreate(block); pos.x = x; pos.y = y; },
      save: function () { store.save({ pages: S.pages }); }
    });
  }

  function initDrag() {
    BLOCKS.forEach(function (b) {
      var el = $(b.id);
      if (!el) return;
      if (b.flow) attachWidgetDrag(el, b);
      else attachDrag(el, blockSpec(b));
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
    var page = activePage(), byId = Object.create(null);
    (page.items || []).forEach(function (item) { byId[item.id] = item; });
    [].slice.call($("tileGrid").querySelectorAll(".tile[data-shortcut-id]")).forEach(function (el) {
      var item = byId[el.getAttribute("data-shortcut-id")];
      if (!item) return;
      item.pos = item.pos || { x: 0, y: 0 };
      var r = el.getBoundingClientRect(), pos = item.pos;
      var bn = offsetBounds({ l: r.left - pos.x, t: r.top - pos.y }, r.width, r.height);
      pos.x = clampn(pos.x, bn.minX, bn.maxX);
      pos.y = clampn(pos.y, bn.minY, bn.maxY);
      window.LGDragPosition.apply(el, pos.x, pos.y);
    });
    applyWidgetOrder();
    applyLayout();
  }

  /* ---------------- ICS 日历同步 ---------------- */
  function icsUnescape(value) { return String(value || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\"); }
  function icsDate(value) { var v = String(value || "").trim(); var m = /^(\d{4})(\d{2})(\d{2})/.exec(v); return m ? m[1] + "-" + m[2] + "-" + m[3] : ""; }
  function parseICS(text, source) {
    var lines = String(text || "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/), events = [], current = null;
    lines.forEach(function (line) {
      if (line === "BEGIN:VEVENT") { current = {}; return; }
      if (line === "END:VEVENT") { if (current && current.start) events.push(normalizeCalendarEvent({ id: uid("event"), title: current.title || "日程", start: current.start, end: current.end || current.start, location: current.location || "", notes: current.notes || "", source: source || "ICS" })); current = null; return; }
      if (!current) return;
      var ix = line.indexOf(":"); if (ix < 0) return; var key = line.slice(0, ix).split(";")[0].toUpperCase(), value = icsUnescape(line.slice(ix + 1));
      if (key === "SUMMARY") current.title = value; else if (key === "DTSTART") current.start = icsDate(value); else if (key === "DTEND") current.end = icsDate(value); else if (key === "LOCATION") current.location = value; else if (key === "DESCRIPTION") current.notes = value;
    });
    return events.filter(function (x) { return !!x; });
  }
  function replaceCalendarSource(source, text) {
    var events = parseICS(text, source.id); if (!events.length) { toast("ICS 中没有可识别的日程"); return; }
    S.calendar.events = S.calendar.events.filter(function (x) { return x.source !== source.id; }).concat(events).slice(0, 500); source.lastSync = Date.now(); source.enabled = true; store.save({ calendar: S.calendar }); renderCalendarSources(); renderCal(); toast("已同步 " + events.length + " 条日程");
  }
  function syncCalendarSource(url, source) {
    var normalized = String(url || "").trim().replace(/^webcal:/i, "https:"); if (!/^https?:\/\//i.test(normalized)) { toast("请输入 http(s) ICS 地址"); return; }
    fetch(normalized, { credentials: "omit" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then(function (text) { var s = source || { id: uid("source"), name: /google/i.test(normalized) ? "Google 日历" : /outlook|office/i.test(normalized) ? "Outlook 日历" : "ICS 订阅", url: normalized, provider: "ICS", enabled: true, lastSync: 0 }; if (!source) S.calendar.sources.push(s); replaceCalendarSource(s, text); }).catch(function () { toast("ICS 同步失败：链接可能需要登录或不允许跨域"); });
  }
  function renderCalendarSources() {
    var box = $("calendarSources"); if (!box) return; box.textContent = ""; (S.calendar.sources || []).forEach(function (source) { var row = document.createElement("div"); row.className = "calendar-source"; var label = document.createElement("span"); label.textContent = source.name + (source.lastSync ? " · " + new Date(source.lastSync).toLocaleDateString() : ""); if (source.url) { var sync = document.createElement("button"); sync.type = "button"; sync.textContent = "同步"; sync.addEventListener("click", function () { syncCalendarSource(source.url, source); }); row.appendChild(label); row.appendChild(sync); } else { label.textContent += " · 本地文件"; row.appendChild(label); } var del = document.createElement("button"); del.type = "button"; del.textContent = "×"; del.addEventListener("click", function () { S.calendar.sources = S.calendar.sources.filter(function (x) { return x.id !== source.id; }); S.calendar.events = S.calendar.events.filter(function (x) { return x.source !== source.id; }); store.save({ calendar: S.calendar }); renderCalendarSources(); renderCal(); }); row.appendChild(del); box.appendChild(row); });
  }

  /* ---------------- 设置面板 ---------------- */
  function renderEngineSettings() {
    var box = $("engineList"); if (!box || !S) return; box.textContent = "";
    (S.customEngines || []).forEach(function (engine) { var row = document.createElement("div"); row.className = "engine-row"; var label = document.createElement("span"); label.textContent = engine.name + (engine.keyword ? " · !" + engine.keyword : ""); var use = document.createElement("button"); use.type = "button"; use.textContent = "使用"; use.addEventListener("click", function () { S.engine = engine.id; store.save({ engine: S.engine }); syncEngineMenu(); renderEngineSettings(); }); var del = document.createElement("button"); del.type = "button"; del.textContent = "×"; del.addEventListener("click", function () { S.customEngines = S.customEngines.filter(function (x) { return x.id !== engine.id; }); if (S.engine === engine.id) S.engine = "bing"; store.save({ customEngines: S.customEngines, engine: S.engine }); buildEngineMenu(); renderEngineSettings(); }); row.appendChild(label); row.appendChild(use); row.appendChild(del); box.appendChild(row); });
  }
  function renderWeatherCities() {
    var box = $("weatherCities"); if (!box || !S) return; box.textContent = "";
    (S.weatherCities || []).forEach(function (city) { var row = document.createElement("div"); row.className = "weather-city-row"; var b = document.createElement("button"); b.type = "button"; b.className = city.id === S.weatherActiveId ? "on" : ""; b.textContent = city.n; b.addEventListener("click", function () { chooseWeatherCity(city.id); syncSettings(); }); row.appendChild(b); if (city.source !== "preset") { var del = document.createElement("button"); del.type = "button"; del.textContent = "×"; del.title = "移除城市"; del.addEventListener("click", function () { if (S.weatherCities.length <= 1) return; S.weatherCities = S.weatherCities.filter(function (x) { return x.id !== city.id; }); if (S.weatherActiveId === city.id) S.weatherActiveId = S.weatherCities[0].id; S.city = { n: S.weatherCities[0].n, lat: S.weatherCities[0].lat, lon: S.weatherCities[0].lon }; store.save({ weatherCities: S.weatherCities, weatherActiveId: S.weatherActiveId, city: S.city }); syncSettings(); loadWeather(); }); row.appendChild(del); } box.appendChild(row); });
  }
  function renderWallLibrary() {
    var box = $("wallLib"); if (!box || !S) return; box.textContent = "";
    (S.wall.library || []).forEach(function (item) {
      var b = document.createElement("div");
      b.className = "wlib" + (item.id === S.wall.activeId ? " on" : "");
      var thumb = item.kind === "image" ? item.data : (item.url || item.data);
      if (thumb) b.style.backgroundImage = 'url("' + String(thumb).replace(/["\\]/g, "") + '")';
      b.title = (item.name || item.url || "自定义壁纸") + " · 点击应用";
      if (item.kind === "video") { var badge = document.createElement("span"); badge.className = "vid"; badge.textContent = "▶"; b.appendChild(badge); }
      var nm = document.createElement("span"); nm.className = "nm";
      nm.textContent = item.name || hostOf(item.url || "") || (item.kind === "video" ? "视频" : "图片");
      b.appendChild(nm);
      var del = document.createElement("button"); del.type = "button"; del.className = "del"; del.textContent = "×"; del.title = "删除该壁纸";
      del.addEventListener("click", function (ev) { ev.stopPropagation(); deleteWallItem(item.id); });
      b.appendChild(del);
      b.addEventListener("click", function () { applyWallItem(item); toast("已切换壁纸"); });
      box.appendChild(b);
    });
  }
  function applyGlassProfile(profile, applyPresetValues) {
    var name = ["clear", "balanced", "readable"].indexOf(profile) >= 0 ? profile : "custom";
    S.glass.profile = name;
    if (applyPresetValues && GLASS_PRESETS[name]) {
      S.glass.band = GLASS_PRESETS[name].band;
      S.glass.str = GLASS_PRESETS[name].str;
      S.glass.disp = GLASS_PRESETS[name].disp;
    }
    document.documentElement.setAttribute("data-glass-profile", name);
    window.LiquidGlass.set({ band: S.glass.band, str: S.glass.str, disp: S.glass.disp });
    schedDrops();
    store.save({ glass: S.glass });
    syncSettings();
  }

  function buildSettings() {
    /* 壁纸色板 */
    var walls = $("walls");
    walls.textContent = "";
    WALLS.forEach(function (w) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sw";
      b.style.backgroundImage = w.preview;
      b.title = w.name;
      b.setAttribute("aria-label", w.name);
      b.addEventListener("click", function () {
        S.wall.mode = "preset"; S.wall.id = w.id; S.wall.activeId = "";
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
        var found = (S.weatherCities || []).filter(function (x) { return x.n === c.n; })[0];
        if (!found) { found = { id: cityId(c), n: c.n, lat: c.lat, lon: c.lon, source: "preset" }; S.weatherCities.push(found); }
        chooseWeatherCity(found.id);
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
          var nextCity = normalizeCity({ n: S.city.n, lat: S.city.lat, lon: S.city.lon, source: "custom" });
          S.weatherCities = (S.weatherCities || []).filter(function (x) { return x.id !== nextCity.id; }); S.weatherCities.push(nextCity);
          S.geo = null; S.weatherActiveId = nextCity.id;
          store.save({ city: S.city, geo: null, weatherCities: S.weatherCities, weatherActiveId: S.weatherActiveId });
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
        S.weatherCities = (S.weatherCities || []).filter(function (x) { return x.id !== "geo"; }); S.weatherCities.unshift({ id: "geo", n: "当前位置", lat: S.geo.lat, lon: S.geo.lon, source: "geo" }); S.weatherActiveId = "geo";
        store.save({ geo: S.geo, weatherCities: S.weatherCities, weatherActiveId: S.weatherActiveId });
        syncSettings(); loadWeather();
        toast("已使用当前位置的天气");
      }, function () { toast("定位失败，请检查系统权限"); }, { timeout: 8000 });
    });

    $("btnWallFile").addEventListener("click", function () { $("wallFile").click(); });
    $("wallFile").addEventListener("change", function () {
      var f = this.files && this.files[0]; this.value = ""; if (!f) return;
      if (f.size > 25 * 1024 * 1024) { toast("本地壁纸文件不能超过 25MB"); return; }
      var rd = new FileReader(); rd.onload = function () {
        var item = addWallToLibrary({ kind: /^video\//i.test(f.type) ? "video" : "image", data: String(rd.result), name: String(f.name || "本地壁纸").slice(0, 60) });
        if (item) { applyWallItem(item); toast("已加入壁纸库并应用"); }
      }; rd.readAsDataURL(f);
    });
    $("wallRotation").addEventListener("change", function () { S.wall.rotation = this.value; store.save({ wall: S.wall }); applyWall(); });
    ["customCss", "fontUrl", "fontFamily"].forEach(function (id) { $(id).addEventListener("change", function () { S.wall[id] = this.value.slice(0, id === "customCss" ? 12000 : 1000); store.save({ wall: S.wall }); applyWall(); }); });

    /* 自定义搜索引擎：URL 使用 {query} 占位符，关键词支持 !keyword。 */
    $("engineAdd").addEventListener("click", function () {
      var name = $("engineNameInput").value.trim(), keyword = $("engineKeywordInput").value.trim().replace(/^!/, "").toLowerCase(), url = $("engineUrlInput").value.trim();
      if (!name || !/^https?:\/\//i.test(url) || (url.indexOf("{query}") < 0 && !/[?&][^=]+=$/.test(url))) { toast("请填写名称，以及带 {query} 或查询参数的 HTTPS 地址"); return; }
      if (keyword && findEngineCommand(keyword)) { toast("这个搜索关键词已经存在"); return; }
      var e = normalizeEngine({ id: uid("engine"), name: name, keyword: keyword, url: url }); if (!e) { toast("搜索引擎地址无效"); return; }
      S.customEngines.push(e); S.engine = e.id; store.save({ customEngines: S.customEngines, engine: S.engine }); $("engineNameInput").value = ""; $("engineKeywordInput").value = ""; $("engineUrlInput").value = ""; buildEngineMenu(); renderEngineSettings(); syncSettings(); toast("已添加搜索引擎");
    });

    /* 跨设备自动同步 */
    [].slice.call($("syncSeg").querySelectorAll("button")).forEach(function (b) { b.addEventListener("click", function () { S.syncEnabled = b.getAttribute("data-sync") === "on"; store.save({ syncEnabled: S.syncEnabled }); syncSettings(); toast(S.syncEnabled ? "已开启自动同步" : "已关闭自动同步"); }); });

    /* ICS 文件和 Google/Outlook 的公开 ICS 订阅 */
    $("btnCalendarFile").addEventListener("click", function () { $("calendarFile").click(); });
    $("calendarFile").addEventListener("change", function () { var f = this.files && this.files[0]; this.value = ""; if (!f) return; var rd = new FileReader(); rd.onload = function () { var source = { id: uid("source"), name: f.name || "ICS 文件", url: "", provider: "ICS", enabled: true, lastSync: Date.now() }; var events = parseICS(String(rd.result), source.id); if (!events.length) { toast("ICS 文件中没有可识别的日程"); return; } S.calendar.sources.push(source); S.calendar.events = S.calendar.events.concat(events).slice(0, 500); store.save({ calendar: S.calendar }); renderCalendarSources(); renderCal(); toast("已导入 " + events.length + " 条日程"); }; rd.readAsText(f); });
    $("calendarSync").addEventListener("click", function () { var url = $("calendarUrl").value.trim(); if (!url) return; syncCalendarSource(url); $("calendarUrl").value = ""; });

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
        if (S.wall.mode === "preset" || S.wall.mode === "url" || S.wall.mode === "video") S.wall.activeId = "";
        store.save({ wall: S.wall });
        syncSettings();
        if (S.wall.mode === "bing") loadBingWall();
        applyWall();
      });
    });
    $("wallUrl").addEventListener("change", function () {
      var v = this.value.trim();
      if (!v) return;
      var item = addWallToLibrary({ kind: /\.(?:mp4|webm|ogg)(?:[?#].*)?$/i.test(v) ? "video" : "url", url: v, name: hostOf(v) || v });
      if (item) { applyWallItem(item); toast("已加入壁纸库并应用"); }
    });

    /* 玻璃参数滑块 */
    function bindGlass(id, out, key, fx) {
      var el = $(id), o = $(out);
      el.addEventListener("input", function () {
        var v = parseFloat(el.value);
        S.glass[key] = v;
        S.glass.profile = "custom";
        document.documentElement.setAttribute("data-glass-profile", "custom");
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
    [].slice.call($("glassProfiles").querySelectorAll("button")).forEach(function (b) {
      b.addEventListener("click", function () { applyGlassProfile(b.getAttribute("data-profile"), true); });
    });

    $("pTex").addEventListener("input", function () {
      S.tex = parseFloat(this.value);
      $("vTex").textContent = S.tex.toFixed(2);
      applyWall();
      clearTimeout(bindGlass._t2);
      bindGlass._t2 = setTimeout(function () { store.save({ tex: S.tex }); }, 400);
    });

    $("btnResetLayout").addEventListener("click", resetInitialLayout);

    $("btnReset").addEventListener("click", function () {
      S = defaults();
      store.save(null);
      location.reload();
    });
  }
  function resetInitialLayout() {
    settleNow();
    var before = layoutSnapshot();
    S.layout = { search: { x: 0, y: 0 }, tiles: { x: 0, y: 0 }, todo: { x: 0, y: 0 }, weather: { x: 0, y: 0 } };
    S.pages.forEach(function (p) {
      p.items.forEach(function (item) { item.pos = { x: 0, y: 0, z: 0 }; });
      p.tileSize = "medium";
      p.widgetOrder = WIDGET_KEYS.slice();
      WIDGET_KEYS.forEach(function (key) {
        if (p[key]) p[key] = { x: 0, y: 0, z: 0 };
      });
    });
    store.save({ layout: S.layout, pages: S.pages });
    applyLayout();
    renderTiles();
    recordLayoutUndo("已恢复所有场景的默认初始排版", before);
  }
  function syncSettings() {
    var g = S.glass;
    document.documentElement.setAttribute("data-glass-profile", g.profile || "balanced");
    $("pStr").value = g.str;  $("vStr").textContent = g.str.toFixed(2);
    $("pBand").value = g.band; $("vBand").textContent = g.band.toFixed(2);
    $("pDisp").value = g.disp; $("vDisp").textContent = g.disp.toFixed(1);
    $("pTex").value = S.tex;  $("vTex").textContent = S.tex.toFixed(2);
    $("wallUrl").value = S.wall.url || "";
    $("wallRotation").value = S.wall.rotation || "off";
    $("customCss").value = S.wall.customCss || "";
    $("fontUrl").value = S.wall.fontUrl || "";
    $("fontFamily").value = S.wall.fontFamily || "";
    [].slice.call($("glassProfiles").children).forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-profile") === g.profile);
    });

    [].slice.call($("walls").children).forEach(function (b, i) {
      var selected = S.wall.mode === "preset" && WALLS[i].id === S.wall.id;
      b.classList.toggle("on", selected);
      b.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    [].slice.call($("citySeg").children).forEach(function (b, i) {
      b.classList.toggle("on", !S.geo && S.weatherActiveId === cityId(CITIES[i]));
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
    [].slice.call($("syncSeg").children).forEach(function (b) { b.classList.toggle("on", (b.getAttribute("data-sync") === "on") === (S.syncEnabled !== false)); });
    $("syncState").textContent = S.syncEnabled === false ? "已关闭" : (HAS_CHROME && chrome.storage.sync ? "使用浏览器同步存储" : "预览模式不支持同步");
    renderEngineSettings(); renderWeatherCities(); renderCalendarSources(); renderWallLibrary();
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

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $("searchForm").addEventListener("submit", function (e) {
      e.preventDefault();
      smenuHide();
      go($("q").value);
    });
    $("layoutEditToggle").addEventListener("click", function () { setLayoutEdit(!layoutEdit); });
    $("layoutEditDone").addEventListener("click", function () { setLayoutEdit(false); });
    $("layoutUndo").addEventListener("click", undoLayoutChange);
    [].slice.call($("tileSizeSeg").querySelectorAll("button")).forEach(function (b) {
      b.addEventListener("click", function () { setTileSize(b.getAttribute("data-size")); });
    });
    $("engineBtn").addEventListener("click", function () { toggleEngineMenu(); });
    $("tileBatchToggle").addEventListener("click", toggleShortcutBatch);
    $("tileOpenAll").addEventListener("click", openAllShortcuts);
    $("tileSelectAll").addEventListener("click", selectAllShortcuts);
    $("tileSetTags").addEventListener("click", function () { openShortcutBatchDialog(); });
    $("tileDeleteSelected").addEventListener("click", deleteSelectedShortcuts);
    $("btnBrowser").addEventListener("click", openBrowserPanel);
    $("browserClose").addEventListener("click", closeBrowserPanel);
    $("browserPanel").addEventListener("click", function (e) { if (e.target === this) closeBrowserPanel(); });
    [].slice.call($("browserTabs").querySelectorAll("button")).forEach(function (b) { b.addEventListener("click", function () { browserView = b.getAttribute("data-browser-view"); [].slice.call($("browserTabs").children).forEach(function (x) { x.classList.toggle("on", x === b); }); loadBrowserView(); }); });
    $("browserSearch").addEventListener("input", function () { browserQuery = this.value; renderBrowserRows(); });
    $("browserRefresh").addEventListener("click", loadBrowserView);
    $("btnProductivity").addEventListener("click", openProductivityPanel);
    $("productivityClose").addEventListener("click", closeProductivityPanel);
    $("productivityPanel").addEventListener("click", function (e) { if (e.target === this) closeProductivityPanel(); });
    $("pomoStart").addEventListener("click", togglePomodoro); $("pomoReset").addEventListener("click", resetPomodoro);
    $("goalSave").addEventListener("click", function () { S.productivity.goal = Math.max(1, Math.min(99, Number($("goalInput").value) || 3)); store.save({ productivity: S.productivity }); updateProductivity(); });
    $("focusToggle").addEventListener("click", function () { S.productivity.focusMode = !S.productivity.focusMode; store.save({ productivity: S.productivity }); updateProductivity(); $("focusToggle").textContent = S.productivity.focusMode ? "关闭专注模式" : "开启专注模式"; toast(S.productivity.focusMode ? "已开启专注模式，屏蔽站点将生效" : "已关闭专注模式"); });
    $("clockAdd").addEventListener("click", addWorldClock); $("worldClockSave").addEventListener("click", saveWorldClock); $("worldClockCancel").addEventListener("click", closeWorldClockDialog); $("worldClockDialog").addEventListener("click", function (e) { if (e.target === this) closeWorldClockDialog(); });
    $("shortcutBatchSave").addEventListener("click", saveShortcutBatch); $("shortcutBatchCancel").addEventListener("click", closeShortcutBatchDialog); $("shortcutBatchDialog").addEventListener("click", function (e) { if (e.target === this) closeShortcutBatchDialog(); });
    $("blockSave").addEventListener("click", addBlockedSite); $("blockAdd").addEventListener("click", function () { $("blockInput").focus(); });
    $("blockInput").addEventListener("keydown", function (e) { if (e.key === "Enter") addBlockedSite(); });
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
    [].slice.call($("calWrap").querySelectorAll("[data-cal-view]")).forEach(function (b) { b.addEventListener("click", function () { calView = b.getAttribute("data-cal-view") === "week" ? "week" : "month"; S.calendar.view = calView; store.save({ calendar: S.calendar }); [].slice.call($("calWrap").querySelectorAll("[data-cal-view]")).forEach(function (x) { x.classList.toggle("on", x === b); }); renderCal(); }); });
    $("calAddEvent").addEventListener("click", function () { openCalendarEvent(calSelectedDate); });
    $("calEventSave").addEventListener("click", saveCalendarEvent); $("calEventCancel").addEventListener("click", function () { $("calEventDialog").classList.remove("open"); }); $("calEventDialog").addEventListener("click", function (e) { if (e.target === this) $("calEventDialog").classList.remove("open"); });
    $("calX").addEventListener("click", function () { removeWidget("cal"); });
    $("todoX").addEventListener("click", function () { removeWidget("todo"); });
    $("noteX").addEventListener("click", function () { removeWidget("note"); });
    $("cdX").addEventListener("click", function () { removeWidget("cd"); });

    $("todoAdd").addEventListener("click", addTodo);
    $("todoInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addTodo(); }
    });
    [].slice.call($("todoTools").querySelectorAll("button")).forEach(function (b) { b.addEventListener("click", function () { todoFilter = b.getAttribute("data-todo-filter") || "all"; [].slice.call($("todoTools").children).forEach(function (x) { x.classList.toggle("on", x === b); }); renderTodos(); }); });
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
        if (sbBatchMode) {
          sbBatchMode = false;
          sbSelected = Object.create(null);
          renderSidebar();
          return;
        }
        toggleEngineMenu(false); closeSheet(); closeDialog(); closeBrowserPanel(); closeProductivityPanel(); smenuHide(); closeWxPop(); $("calEventDialog").classList.remove("open"); closeShortcutBatchDialog(); closeWorldClockDialog();
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
        if (smenuIsOpen()) scheduleSuggestOcclusion();
      }, 160);
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    store.load(function (state) {
      S = state;
      if (HAS_CHROME && chrome.storage.onChanged && chrome.storage.onChanged.addListener) chrome.storage.onChanged.addListener(handleStorageChange);
      var sidebarChanged = false;
      S.sidebar.forEach(function (item) {
        if (normalizeStoredImage(item)) sidebarChanged = true;
      });
      if (sidebarChanged) store.save({ sidebar: S.sidebar });

      window.LiquidGlass.set({
        band: S.glass.band, str: S.glass.str, disp: S.glass.disp, blur: S.glass.blur
      });
      document.documentElement.setAttribute("data-glass-profile", S.glass.profile || "balanced");
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
      calSelectedDate = dateKey(now); calView = S.calendar.view === "week" ? "week" : "month";
      renderCal();
      renderTodos();
      renderCd();
      checkTodoReminders();
      updateProductivity();
      renderNote();
      buildEngineMenu();
      renderTiles();
      buildPager();
      applyWall();
      buildSettings();
      syncSettings();
      bind();
      initSuggest();

      renderSidebar();
      persistImages();
      initSb();

      window.LiquidGlass.init();

      applyLayout();
      initDrag();
      reflowLayout();

      initDrops();
      if (S.wall.mode === "bing") loadBingWall();
      loadWeather();
      setInterval(function () { renderPomodoro(); if ($("productivityPanel").classList.contains("open")) { renderWorldClocks(); updateProductivity(); } checkTodoReminders(); }, 1000);

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
        openBrowser: openBrowserPanel,
        openProductivity: openProductivityPanel,
        addTodo: addTodo,
        addCalendarEvent: openCalendarEvent,
        loadWeather: loadWeather,
        switchPage: switchPage,
        buildPager: buildPager
      };
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
