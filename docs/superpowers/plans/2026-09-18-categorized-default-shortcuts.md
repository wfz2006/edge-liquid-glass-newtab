# Categorized Default Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Upgrade the new-tab default shortcut catalog into eight category pages while migrating only untouched legacy defaults and preserving user customization.

**Architecture:** Keep the existing page, tile, storage, and rendering architecture. Add one immutable default catalog plus a versioned legacy-default detector in js/app.js; normalize() will choose the catalog only for new state or exact untouched legacy state, while custom state passes through unchanged. No new UI components or network services are needed.

**Tech Stack:** Manifest V3, vanilla JavaScript, HTML/CSS, chrome.storage.local with localStorage preview fallback, Playwright-driven temporary Edge verification.

## Global Constraints

- New installs receive eight category pages and the active page is 常用.
- Existing customized pages and shortcuts must not be overwritten.
- Legacy migration must match the original six shortcut names and URLs exactly before replacing the page set.
- Existing card editing, reordering, page switching, layout, widgets, export/import, weather, search, and collection-board behavior remain unchanged.
- No new dependencies, network APIs, or permanent test fixtures are added.

## Files and Responsibilities

- Modify D:/workb/edge-liquid-glass-newtab/js/app.js: catalog, seed version, migration predicate, normalization, and normalized-state persistence.
- Do not change newtab.html, css/newtab.css, js/liquid-glass.js, or js/content.js.
- Use temporary in-memory Playwright scripts for verification; do not leave test profiles or generated data in the repository.

### Task 1: Add the categorized default catalog

**Files:**
- Modify: D:/workb/edge-liquid-glass-newtab/js/app.js:44-79
- Test: Node syntax check and temporary Edge page-state assertions

**Interfaces:**
- Produce DEFAULT_SEED_VERSION = 2 and a fresh-page factory consumed by defaults() and migration.
- Keep each shortcut in the existing { n: string, u: string } shape.

- [ ] **Step 1: Define the stable catalog**

Insert this catalog after DEFAULT_SHORTCUTS; the complete names and URLs are the implementation source of truth:

~~~js
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
~~~

Add defaultPages() below it. It must map every tuple to a new {n, u} object and set cal/todo to {x:0,y:0} only on common; all other page widgets start as null.

- [ ] **Step 2: Update defaults()**

Replace the old one-page literal with:

~~~js
    return {
      seedVersion: DEFAULT_SEED_VERSION,
      pages: defaultPages(),
      calMig: true,
      todos: [],
      cd: null,
      activePage: "common",
~~~

Keep all other fields unchanged and remove the duplicate todos property encountered in the old defaults object.

- [ ] **Step 3: Run the syntax gate**

Run node --check js/app.js; expected exit code 0 and no output.

- [ ] **Step 4: Commit the catalog change**

~~~powershell
git add js/app.js
git commit -m "feat: add categorized default shortcut pages"
~~~

Expected: one commit containing only the catalog/default-state change.

### Task 2: Add safe legacy migration and persistence

**Files:**
- Modify: D:/workb/edge-liquid-glass-newtab/js/app.js:81-220
- Test: temporary Node/Playwright state scenarios

**Interfaces:**
- Consume the exact legacy six-card list in DEFAULT_SHORTCUTS.
- Produce normalized state with seedVersion, categorized pages only for untouched legacy defaults, and unchanged custom pages otherwise.

- [ ] **Step 1: Add the exact legacy predicate**

Before normalize(), add:

~~~js
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
~~~

Reordered, renamed, added, removed, or edited cards must return false.

- [ ] **Step 2: Capture migration intent before page normalization**

At the beginning of normalize(), after its object guard, add:

~~~js
    var migrateLegacyDefaults = isUntouchedLegacyDefault(o);
~~~

Keep the existing parsing of pages and old shortcuts so customized legacy data remains compatible.

- [ ] **Step 3: Apply the categorized pages and version**

Immediately before the final active-page validity check, add:

~~~js
    if (migrateLegacyDefaults) {
      d.pages = defaultPages();
      d.activePage = "common";
    }
    d.seedVersion = DEFAULT_SEED_VERSION;
~~~

Then run the existing hasActive check after this block so the final active page always belongs to the final page set.

- [ ] **Step 4: Persist normalized legacy state once**

Replace store.load with a helper that normalizes raw storage and writes only when an existing object has a stale/missing seed version:

~~~js
    load: function (cb) {
      function finish(raw) {
        var state = normalize(raw);
        if (raw && typeof raw === "object" && raw.seedVersion !== DEFAULT_SEED_VERSION) {
          var payload = {};
          payload[KEY] = state;
          if (HAS_CHROME) chrome.storage.local.set(payload, noop);
          else {
            try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
          }
        }
        cb(state);
      }
      if (HAS_CHROME) {
        chrome.storage.local.get(KEY, function (o) { finish(o && o[KEY]); });
      } else {
        var raw = null;
        try { raw = localStorage.getItem(KEY); } catch (e2) {}
        var parsed = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch (e3) {}
        finish(parsed);
      }
    },
~~~

Do not write a fresh empty default state merely because storage is empty.

- [ ] **Step 5: Verify migration cases in isolated contexts**

Use one fresh temporary Edge context per case, seed localStorage["lg.newtab"] before loading newtab.html, and inspect window.__lsNewTab.state() after boot. Assert:

~~~text
empty storage -> 8 pages, activePage === "common", seedVersion === 2
exact old six-card page -> 8 pages, activePage === "common"
old page with one added card -> one page and added card preserved
old page with renamed card -> one page and renamed card preserved
state at seedVersion 2 -> pages preserved exactly
~~~

- [ ] **Step 6: Run static checks and commit migration**

~~~powershell
node --check js/app.js
node --check js/content.js
node --check js/liquid-glass.js
Get-Content -Raw manifest.json | ConvertFrom-Json | Out-Null
git diff --check
git add js/app.js
git commit -m "feat: migrate untouched defaults to category pages"
~~~

Expected: all checks exit 0.

### Task 3: Run extension-level regression verification

**Files:**
- Modify: none
- Test: temporary Edge profile and temporary Playwright script

- [ ] **Step 1: Load the extension in a temporary Edge profile**

Launch Edge with --disable-extensions-except=<repo> and --load-extension=<repo>, then navigate to chrome://newtab/.

- [ ] **Step 2: Verify the categorized default state**

Assert:

~~~text
window.__lsNewTab exists
state.pages.length === 8
state.activePage === "common"
each page has 8 shortcut items
the first page name is "常用"
the tile grid renders 8 cards plus the add card
~~~

- [ ] **Step 3: Verify unchanged interactions**

Assert that category tab switching changes activePage and visible tile names, the engine menu opens, Settings opens/closes, adding a shortcut increases the current page count, and a refresh preserves the selected page and added shortcut in chrome.storage.local.

- [ ] **Step 4: Verify the extension boundary**

Open https://example.com in the same temporary context and assert #lg-collect-host exists, its shadowRoot is closed, and both the web page and extension page emit no page errors or console errors.

- [ ] **Step 5: Run the final repository check**

~~~powershell
git status --short --branch
git log --oneline -4
git diff HEAD~2..HEAD --stat
~~~

Expected: the worktree is clean and the feature diff is limited to js/app.js plus the design/plan documents.

