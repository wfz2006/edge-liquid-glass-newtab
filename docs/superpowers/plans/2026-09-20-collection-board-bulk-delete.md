# 收集板内容批量删除实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为新标签页和普通网页侧栏收集板增加按 `id` 选择、筛选全选、确认删除和短时撤销，并保持两端共享存储同步。

**Architecture:** 保持现有 `sidebar` 数据格式和两套渲染器，在 `js/collection-board-core.js` 增加纯函数批量移除/恢复能力；`js/app.js` 与 `js/content.js` 各自维护临时选择和撤销状态。两端通过 `chrome.storage.local` 的同一 `lg.newtab.sidebar` 数据继续同步，撤销只按 `id` 合并回当前最新数据。

**Tech Stack:** Manifest V3、原生 JavaScript、HTML/CSS、`chrome.storage.local`、`localStorage` 预览回退、Node 内置 `assert` 测试、临时 Edge 扩展验收。

## Global Constraints

- 新标签页和普通网页侧栏都必须提供一致的批量管理入口、选择、全选当前筛选、清空选择、确认删除和撤销。
- 选择状态只存在于当前页面会话，按稳定内容 `id` 保存，不写入收藏数据。
- 批量模式暂时禁用卡片打开、拖动和编辑，避免选择操作误触现有行为。
- 搜索/类型筛选变化时保留仍存在的选择；“全选当前筛选”只补选当前可见内容。
- 删除确认使用实际选中数量；撤销约 8 秒有效，恢复完整对象和原始数组位置。
- 撤销只补回当前不存在的 `id`，不得覆盖删除期间另一端新增或编辑的内容。
- 渲染重建前后必须保持收集板滚动位置；玻璃卡片继续使用现有 `left/top` 拖动方案。
- 不改变 `sidebar` 存储字段格式、图片持久化、重复链接检测、200 项上限、导入/导出格式或玻璃效果。
- 不处理当前工作区已有的未提交改动；每次提交只暂存本计划产生的明确文件。
- 项目没有 `package.json`，验证使用仓库现有的直接 `node` 命令和临时 Edge 环境。

---

## 文件与职责地图

- Modify `D:/workb/edge-liquid-glass-newtab/js/collection-board-core.js`: 纯函数 `removeByIds` 与 `restoreByIds`。
- Modify `D:/workb/edge-liquid-glass-newtab/tests/collection-board-core.test.js`: 批量移除、原位置恢复、重复恢复保护的单元测试。
- Modify `D:/workb/edge-liquid-glass-newtab/newtab.html`: 新标签页收集板批量入口、操作栏和可访问性属性。
- Modify `D:/workb/edge-liquid-glass-newtab/css/newtab.css`: 新标签页批量控件、卡片选中态和可撤销提示样式。
- Modify `D:/workb/edge-liquid-glass-newtab/js/app.js`: 新标签页选择状态、批量删除、撤销、卡片键盘交互和本地存储监听。
- Modify `D:/workb/edge-liquid-glass-newtab/js/content.js`: Shadow DOM 批量控件、选择状态、批量删除、撤销提示和选择安全。
- Modify `D:/workb/edge-liquid-glass-newtab/tests/newtab-feature-surface.test.js`: 新标签页 DOM、内容脚本、样式和同步接口的静态回归检查。
- Do not modify `manifest.json`, `js/background.js`, existing user changes, or unrelated generated files.

## Task 1: Add and test shared batch data helpers

**Files:**
- Modify: `D:/workb/edge-liquid-glass-newtab/js/collection-board-core.js`
- Modify: `D:/workb/edge-liquid-glass-newtab/tests/collection-board-core.test.js`

**Interfaces:**
- `removeByIds(items, ids)` consumes an item array and an array or object of ids; it returns `{ items: Array, removed: Array<{ item: Object, index: number }> }`.
- `restoreByIds(items, removed)` consumes the current item array and the `removed` records; it returns a new array and never mutates the input array.
- Both functions preserve object fields and treat missing or duplicate ids as no-ops.

- [ ] **Step 1: Add the failing core tests**

Append the following assertions before the final `console.log` in `tests/collection-board-core.test.js`:

```js
const boardItems = [
  { id: "keep", type: "link", url: "https://keep.example", x: 1, y: 2, z: 3 },
  { id: "remove-a", type: "text", text: "保留撤销字段", tags: ["a"], x: 10, y: 20, z: 4 },
  { id: "remove-b", type: "image", src: "data:image/png;base64,AA==", x: 30, y: 40, z: 5 }
];
const removedBatch = core.removeByIds(boardItems, ["remove-a", "remove-b", "missing"]);
assert.deepStrictEqual(removedBatch.items, [boardItems[0]]);
assert.deepStrictEqual(removedBatch.removed.map((entry) => entry.index), [1, 2]);
assert.strictEqual(removedBatch.removed[0].item.text, "保留撤销字段");
assert.deepStrictEqual(core.restoreByIds(removedBatch.items, removedBatch.removed), boardItems);
assert.deepStrictEqual(
  core.restoreByIds(boardItems, removedBatch.removed),
  boardItems,
  "restoring an already present id must not duplicate or overwrite it"
);
assert.deepStrictEqual(core.removeByIds(boardItems, []).removed, []);
```

Update the final assertion summary to `collection-board-core: 22 assertions passed` after adding these six assertions.

- [ ] **Step 2: Run the focused test and verify it fails for the intended reason**

Run:

```powershell
node tests/collection-board-core.test.js
```

Expected: the process fails with `TypeError: core.removeByIds is not a function` because the public helpers do not exist yet.

- [ ] **Step 3: Implement the pure helpers**

Add these functions before `organizePositions` in `js/collection-board-core.js`:

```js
  function idLookup(ids) {
    var lookup = {};
    if (Array.isArray(ids)) ids.forEach(function (id) {
      if (id !== null && id !== undefined && String(id)) lookup[String(id)] = true;
    });
    else if (ids && typeof ids === "object") Object.keys(ids).forEach(function (id) {
      if (ids[id]) lookup[id] = true;
    });
    return lookup;
  }

  function removeByIds(items, ids) {
    var lookup = idLookup(ids), kept = [], removed = [];
    (items || []).forEach(function (item, index) {
      var id = item && item.id !== undefined && item.id !== null ? String(item.id) : "";
      if (id && lookup[id]) removed.push({ item: item, index: index });
      else kept.push(item);
    });
    return { items: kept, removed: removed };
  }

  function restoreByIds(items, removed) {
    var result = (items || []).slice();
    (removed || []).slice().sort(function (a, b) {
      return Number(a.index) - Number(b.index);
    }).forEach(function (entry) {
      var item = entry && entry.item;
      if (!item || item.id === undefined || item.id === null) return;
      var id = String(item.id);
      if (result.some(function (current) {
        return current && current.id !== undefined && String(current.id) === id;
      })) return;
      var index = Number(entry.index);
      if (!isFinite(index)) index = result.length;
      index = Math.max(0, Math.min(result.length, Math.floor(index)));
      result.splice(index, 0, item);
    });
    return result;
  }
```

Export both functions in the returned object:

```js
    removeByIds: removeByIds,
    restoreByIds: restoreByIds,
```

- [ ] **Step 4: Run the focused test and record the passing result**

Run:

```powershell
node tests/collection-board-core.test.js
```

Expected: exit code 0 and a message whose assertion count includes the new batch cases.

- [ ] **Step 5: Commit only the shared helper files**

Run:

```powershell
git diff --check -- js/collection-board-core.js tests/collection-board-core.test.js
git add -- js/collection-board-core.js tests/collection-board-core.test.js
git diff --cached --name-only
git commit -m "feat: add collection board batch helpers"
```

The staged name list must contain exactly the two files above.

## Task 2: Add the new-tab batch surface and behavior

**Files:**
- Modify: `D:/workb/edge-liquid-glass-newtab/newtab.html`
- Modify: `D:/workb/edge-liquid-glass-newtab/css/newtab.css`
- Modify: `D:/workb/edge-liquid-glass-newtab/js/app.js`
- Modify: `D:/workb/edge-liquid-glass-newtab/tests/newtab-feature-surface.test.js`

**Interfaces:**
- DOM ids: `sbBatchToggle`, `sbBatchCount`, `sbSelectAll`, `sbClearSelection`, `sbDeleteSelected`.
- Internal state: `sbBatchMode` boolean, `sbSelected` id map, `sbUndo` record, `sbUndoTimer` timeout handle.
- Internal operations: `sbToggleSelected(id)`, `sbSelectVisible()`, `sbClearSelection()`, `sbDeleteSelected()`, `sbUndoDelete()`, and `renderSbBatchTools()`.

- [ ] **Step 1: Add failing static surface assertions**

In `tests/newtab-feature-surface.test.js`, extend the required HTML ids with:

```js
  "sbBatchToggle", "sbBatchCount", "sbSelectAll", "sbClearSelection", "sbDeleteSelected"
```

After reading `content.js`, add these checks:

```js
assert.match(app, /function sbDeleteSelected\(\)/);
assert.match(app, /SB_CORE\.removeByIds/);
assert.match(app, /SB_CORE\.restoreByIds/);
assert.match(css, /\.sbcard\.selected/);
```

Run:

```powershell
node tests/newtab-feature-surface.test.js
```

Expected: fail because the new ids, functions, and styles are not present yet.

- [ ] **Step 2: Add the new-tab controls**

In `newtab.html`, add the batch toggle beside `sbOrganize` and `sbAdd`:

```html
<button type="button" class="sbbatchtoggle" id="sbBatchToggle" title="批量管理" aria-label="批量管理" aria-pressed="false">批量</button>
```

Inside `.sbtools`, after the filter group, add:

```html
<div class="sbbatchtools" id="sbBatchTools" hidden aria-label="收集板批量操作">
  <span class="sbbatchcount" id="sbBatchCount" aria-live="polite">已选 0 项</span>
  <button type="button" id="sbSelectAll">全选当前</button>
  <button type="button" id="sbClearSelection">清空选择</button>
  <button type="button" class="sb-danger" id="sbDeleteSelected" disabled>删除所选</button>
</div>
```

Keep the existing search and filter controls unchanged. The hidden batch row must not alter normal-mode layout.

- [ ] **Step 3: Add the new-tab batch styles**

Add styles near the existing collection-board rules in `css/newtab.css`:

```css
.sbbatchtoggle{height:30px;padding:0 9px;border-radius:999px;cursor:pointer;color:rgba(255,255,255,.82);
  background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.24);font:inherit;font-size:11px}
.sbbatchtoggle:hover,.sbbatchtoggle[aria-pressed="true"]{background:rgba(255,255,255,.24);color:#fff}
.sbbatchtools{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.sbbatchcount{margin-right:auto;font-size:11px;color:rgba(255,255,255,.68);font-variant-numeric:tabular-nums}
.sbbatchtools button{height:24px;padding:0 8px;border-radius:999px;cursor:pointer;color:rgba(255,255,255,.78);
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);font:inherit;font-size:10.5px}
.sbbatchtools button:hover:not(:disabled),.sbbatchtools button:focus-visible{background:rgba(255,255,255,.22);color:#fff}
.sbbatchtools button:disabled{cursor:not-allowed;opacity:.42}
.sbbatchtools .sb-danger{color:rgba(255,220,224,.92);border-color:rgba(255,160,170,.34)}
.sbcard.batch-mode{cursor:pointer}
.sbcard.selected{outline:0;border-color:rgba(185,224,255,.9);background:rgba(171,218,255,.18);box-shadow:0 0 0 2px rgba(171,218,255,.18),0 14px 30px var(--lg-shadow)}
.sbcard .sbcheck{position:absolute;left:9px;top:9px;width:20px;height:20px;border-radius:50%;display:none;
  align-items:center;justify-content:center;color:#08213d;background:rgba(205,235,255,.9);font-size:12px;font-weight:700;z-index:5}
.sbcard.batch-mode .sbcheck{display:flex}
.sbcard.batch-mode .menu{display:none}
.sbundo{display:inline-flex;align-items:center;gap:8px}
.sbundo button{border:0;background:transparent;color:#b9e0ff;cursor:pointer;font:inherit;font-weight:600}
.toast.show{pointer-events:auto}
.toast button{margin-left:10px;border:0;background:transparent;color:#b9e0ff;cursor:pointer;font:inherit;font-weight:600}
```

Repeat the existing light-theme overrides for `.sbbatchtoggle`, `.sbbatchtools button`, `.sbcard.selected`, and `.sbundo button` where the stylesheet defines the light palette, without changing unrelated glass rules.

- [ ] **Step 4: Add new-tab batch state and selection helpers**

Near `sbQuery` and `sbFilter` in `js/app.js`, add:

```js
  var sbQuery = "", sbFilter = "all";
  var sbBatchMode = false, sbSelected = {}, sbUndo = null, sbUndoTimer = 0;

  function sbVisibleItems() {
    return S.sidebar.filter(function (item) { return SB_CORE.matches(item, sbQuery, sbFilter); });
  }
  function sbSelectedItems() {
    return S.sidebar.filter(function (item) { return !!sbSelected[item.id]; });
  }
  function sbPruneSelection() {
    var live = {};
    S.sidebar.forEach(function (item) { if (item && sbSelected[item.id]) live[item.id] = true; });
    sbSelected = live;
  }
  function sbToggleSelected(id) {
    if (!id) return;
    if (sbSelected[id]) delete sbSelected[id];
    else sbSelected[id] = true;
    renderSidebar();
  }
  function sbSelectVisible() {
    sbVisibleItems().forEach(function (item) { if (item.id) sbSelected[item.id] = true; });
    renderSidebar();
  }
  function sbClearSelection() {
    sbSelected = {};
    renderSidebar();
  }
```

`sbPruneSelection()` must run before every batch count update and after storage synchronization. It must not clear live selections merely because the search or type filter changed.

- [ ] **Step 5: Wire card selection without changing normal mode**

In `sbCardEl(item, idx)`, add these attributes and a check marker before the existing content:

```js
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
```

Update the card click handler to branch first:

```js
    el.addEventListener("click", function (ev) {
      if (sbBatchMode) {
        ev.preventDefault();
        ev.stopPropagation();
        sbToggleSelected(item.id);
        return;
      }
      if (item.type === "link" && item.url) openURL(item.url);
      else if (item.type === "image" && (item.url || item.src) && /^https?:/i.test(item.url || item.src)) openURL(item.url || item.src);
    });
    el.addEventListener("keydown", function (ev) {
      if (!sbBatchMode || (ev.key !== "Enter" && ev.key !== " ")) return;
      ev.preventDefault();
      sbToggleSelected(item.id);
    });
```

When `sbBatchMode` is true, do not append the edit menu and do not call `attachDrag` from `renderSidebar`. Normal mode must retain the current menu, opening, and drag behavior.

- [ ] **Step 6: Add batch toolbar rendering and mode switching**

Add `renderSbBatchTools()`:

```js
  function renderSbBatchTools() {
    sbPruneSelection();
    var toggle = $("sbBatchToggle"), row = $("sbBatchTools"), count = $("sbBatchCount");
    var selectAll = $("sbSelectAll"), clear = $("sbClearSelection"), del = $("sbDeleteSelected");
    var chosen = sbSelectedItems().length, visible = sbVisibleItems().length;
    if (toggle) {
      toggle.textContent = sbBatchMode ? "退出批量" : "批量";
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
    if (!sbBatchMode) sbSelected = {};
    renderSidebar();
  }
```

Call `renderSbBatchTools()` from `renderSidebar()` after the visible cards and from `sbSyncMeta()`. Bind the five new controls in `initSb()`; the delete and undo handlers are added in the next step.

- [ ] **Step 7: Implement new-tab deletion and action toast**

Extend the existing `toast` function to accept an optional action callback while preserving all existing string-only callers:

```js
  function toast(msg, action) {
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
    t.classList.add("show");
    window.LiquidGlass.refresh();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, action ? 8000 : 2400);
  }
```

Add the delete and restore functions:

```js
  function sbDeleteSelected() {
    var chosen = sbSelectedItems();
    if (!chosen.length) { toast("请先选择收集项"); return; }
    if (!window.confirm("确定删除已选中的 " + chosen.length + " 项收集内容？")) return;
    var removed = SB_CORE.removeByIds(S.sidebar, Object.keys(sbSelected));
    if (!removed.removed.length) { sbSelected = {}; renderSidebar(); return; }
    sbUndo = { removed: removed.removed };
    clearTimeout(sbUndoTimer);
    S.sidebar = removed.items;
    sbSelected = {};
    store.save({ sidebar: S.sidebar });
    renderSidebar();
    toast("已删除 " + removed.removed.length + " 项", sbUndoDelete);
    sbUndoTimer = setTimeout(function () { sbUndo = null; }, 8000);
  }
  function sbUndoDelete() {
    if (!sbUndo) return;
    var snapshot = sbUndo;
    sbUndo = null;
    clearTimeout(sbUndoTimer);
    S.sidebar = SB_CORE.restoreByIds(S.sidebar, snapshot.removed);
    store.save({ sidebar: S.sidebar });
    renderSidebar();
    toast("已撤销删除");
  }
```

The callback must use the latest `S.sidebar` so an incoming storage event can be merged before undo. Bind `sbDeleteSelected` to the delete button and pass `sbUndoDelete` as the toast action.

- [ ] **Step 8: Run the new-tab-focused checks**

Run:

```powershell
node --check js/app.js
node tests/newtab-feature-surface.test.js
```

Expected: both exit 0. The static test must see all new ids, shared helper calls, action-toast path, and selected-card styles for the new-tab surface. Webpage-side assertions are added in Task 3 after `js/content.js` is implemented; local-listener assertions are added in Task 4.

- [ ] **Step 9: Commit only the new-tab files**

Run:

```powershell
git diff --check -- newtab.html css/newtab.css js/app.js tests/newtab-feature-surface.test.js
git add -- newtab.html css/newtab.css js/app.js tests/newtab-feature-surface.test.js
git diff --cached --name-only
git commit -m "feat: add new-tab collection batch deletion"
```

The staged name list must contain exactly the four files above.

## Task 3: Add the webpage-side batch surface and behavior

**Files:**
- Modify: `D:/workb/edge-liquid-glass-newtab/js/content.js`
- Modify: `D:/workb/edge-liquid-glass-newtab/tests/newtab-feature-surface.test.js`

**Interfaces:**
- Shadow DOM controls use classes or local references: `.batch-toggle`, `.batch-tools`, `.select-all`, `.clear-selection`, `.delete-selected`.
- Internal state: `batchMode`, `selectedIds`, `undoSnapshot`, `undoTimer`.
- Internal operations mirror the new-tab behavior: `toggleSelected`, `selectVisible`, `clearSelection`, `deleteSelected`, `undoDelete`, `renderBatchTools`.

- [ ] **Step 1: Add failing content-surface assertions**

Extend `tests/newtab-feature-surface.test.js` with:

```js
assert.match(content, /class="batch-toggle"/);
assert.match(content, /class="batch-tools"/);
assert.match(content, /function deleteSelected\(\)/);
assert.match(content, /function undoDelete\(\)/);
assert.match(content, /CORE\.removeByIds/);
assert.match(content, /CORE\.restoreByIds/);
assert.match(content, /aria-selected/);
```

Run `node tests/newtab-feature-surface.test.js` and record the expected failure before editing `js/content.js`.

- [ ] **Step 2: Add Shadow DOM controls and styles**

In the `sh.innerHTML` template, add a batch toggle to the header and a hidden operation row after the filters:

```html
<button type="button" class="batch-toggle" title="批量管理" aria-label="批量管理" aria-pressed="false">批量</button>
<div class="batch-tools" hidden aria-label="收集板批量操作">
  <span class="batch-count" aria-live="polite">已选 0 项</span>
  <button type="button" class="select-all">全选当前</button>
  <button type="button" class="clear-selection">清空选择</button>
  <button type="button" class="delete-selected" disabled>删除所选</button>
</div>
```

Add matching rules to the inlined `CSS` string for `.batch-toggle`, `.batch-tools`, `.batch-count`, `.batch-tools button`, `.sbcard.batch-mode`, `.sbcard.selected`, `.sbcheck`, `.notice`, and `.notice button`. Keep the existing Shadow DOM glass and card dimensions unchanged.

- [ ] **Step 3: Add local state and selection helpers**

After `var searchQuery = "", filterType = "all";`, add:

```js
  var batchMode = false, selectedIds = {}, undoSnapshot = null, undoTimer = 0;
  var batchToggle = sh.querySelector(".batch-toggle");
  var batchTools = sh.querySelector(".batch-tools");
  var batchCount = sh.querySelector(".batch-count");
  var selectAllButton = sh.querySelector(".select-all");
  var clearSelectionButton = sh.querySelector(".clear-selection");
  var deleteSelectedButton = sh.querySelector(".delete-selected");

  function visibleItems() {
    return st.sidebar.filter(function (item) { return CORE.matches(item, searchQuery, filterType); });
  }
  function selectedItems() {
    return st.sidebar.filter(function (item) { return !!selectedIds[item.id]; });
  }
  function pruneSelection() {
    var live = {};
    st.sidebar.forEach(function (item) { if (item && selectedIds[item.id]) live[item.id] = true; });
    selectedIds = live;
  }
  function toggleSelected(id) {
    if (!id) return;
    if (selectedIds[id]) delete selectedIds[id];
    else selectedIds[id] = true;
    render();
  }
```

Add `selectVisible`, `clearSelection`, and `renderBatchTools` using the same rules as the new-tab implementation: selection survives filter changes, full selection is limited to `visibleItems()`, and empty selection disables deletion.

- [ ] **Step 4: Add the content-side action notice**

Add a `notice` element to the Shadow DOM template and implement:

```js
  var notice = sh.querySelector(".notice");
  var noticeText = sh.querySelector(".notice-text");
  var noticeUndo = sh.querySelector(".notice-undo");
  var noticeTimer = 0;

  function showNotice(message, action) {
    clearTimeout(noticeTimer);
    noticeText.textContent = message;
    noticeUndo.hidden = typeof action !== "function";
    noticeUndo.onclick = typeof action === "function" ? action : null;
    notice.hidden = false;
    noticeTimer = setTimeout(function () { notice.hidden = true; }, action ? 8000 : 2400);
  }
```

The notice must use `role="status"` and `aria-live="polite"`; it must be inside the closed Shadow DOM so it cannot affect host-page styling.

- [ ] **Step 5: Make card rendering and pointer behavior batch-aware**

In `render()`, prune the selection before calculating the visible list. For every card, add:

```js
      el.setAttribute("role", "option");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-selected", batchMode && selectedIds[it.id] ? "true" : "false");
      if (batchMode) el.classList.add("batch-mode");
      if (batchMode && selectedIds[it.id]) el.classList.add("selected");
      html += '<span class="sbcheck" aria-hidden="true">✓</span>';
```

In the card click listener, branch before the normal link/image open behavior:

```js
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
```

Only register the existing pointer-drag listener and `.del` click listener when `batchMode` is false. This ensures batch selection cannot drag or invoke single-item deletion.

- [ ] **Step 6: Add content-side deletion and undo**

Add the following operations before the render section:

```js
  function deleteSelected() {
    var chosen = selectedItems();
    if (!chosen.length) { showNotice("请先选择收集项"); return; }
    if (!window.confirm("确定删除已选中的 " + chosen.length + " 项收集内容？")) return;
    var removed = CORE.removeByIds(st.sidebar, Object.keys(selectedIds));
    if (!removed.removed.length) { selectedIds = {}; render(); return; }
    undoSnapshot = { removed: removed.removed };
    clearTimeout(undoTimer);
    st.sidebar = removed.items;
    selectedIds = {};
    saveSidebar();
    render();
    showNotice("已删除 " + removed.removed.length + " 项", undoDelete);
    undoTimer = setTimeout(function () { undoSnapshot = null; }, 8000);
  }
  function undoDelete() {
    if (!undoSnapshot) return;
    var snapshot = undoSnapshot;
    undoSnapshot = null;
    clearTimeout(undoTimer);
    st.sidebar = CORE.restoreByIds(st.sidebar, snapshot.removed);
    saveSidebar();
    render();
    showNotice("已撤销删除");
  }
```

Bind `batchToggle`, `selectAllButton`, `clearSelectionButton`, and `deleteSelectedButton` after the existing filter listeners. Toggle batch mode clears `selectedIds` only when leaving batch mode; it does not change persisted data.

- [ ] **Step 7: Run content checks and commit the webpage-side surface**

Run:

```powershell
node --check js/content.js
node tests/newtab-feature-surface.test.js
```

Expected: both exit 0. Then run:

```powershell
git diff --check -- js/content.js tests/newtab-feature-surface.test.js
git add -- js/content.js tests/newtab-feature-surface.test.js
git diff --cached --name-only
git commit -m "feat: add webpage collection batch deletion"
```

The staged name list must contain only the two files above. If the static test was already committed in Task 2, stage only `js/content.js` here and verify that the test file has no unstaged change.

## Task 4: Complete local storage synchronization and stale-selection handling

**Files:**
- Modify: `D:/workb/edge-liquid-glass-newtab/js/app.js`
- Modify: `D:/workb/edge-liquid-glass-newtab/js/content.js`
- Modify: `D:/workb/edge-liquid-glass-newtab/tests/newtab-feature-surface.test.js`

**Interfaces:**
- The new-tab `handleStorageChange(changes, areaName)` handles `areaName === "local"` for the `KEY` sidebar path before its existing sync-area branch.
- The webpage-side existing local listener calls `pruneSelection()` before `syncMeta()` or `render()`.
- Both listeners compare normalized sidebar arrays and skip a full render when the sidebar is unchanged.

- [ ] **Step 1: Add failing synchronization assertions**

Add to `tests/newtab-feature-surface.test.js`:

```js
assert.match(app, /areaName === "local"/);
assert.match(app, /sameSidebar/);
assert.match(app, /sbPruneSelection/);
assert.match(content, /pruneSelection\(\)/);
assert.match(content, /sameSidebar/);
```

Run `node tests/newtab-feature-surface.test.js` and verify the new local-listener assertion fails before changing the listener.

- [ ] **Step 2: Add the new-tab local listener branch**

At the beginning of `handleStorageChange`, add a local-storage branch equivalent to:

```js
  function handleStorageChange(changes, areaName) {
    if (areaName === "local" && changes && changes[KEY] && S) {
      var raw = changes[KEY].newValue;
      if (!raw || typeof raw !== "object") return;
      var next = normalize(raw);
      var sameSidebar = JSON.stringify(next.sidebar) === JSON.stringify(S.sidebar);
      if (sameSidebar) {
        sbPruneSelection();
        sbSyncMeta();
        renderSbBatchTools();
        return;
      }
      S = next;
      sbPruneSelection();
      renderSidebar();
      persistImages();
      return;
    }
    if (areaName !== "sync" || !changes || !changes[SYNC_KEY] || !S || S.syncEnabled === false) return;
```

Keep the existing sync-area branch unchanged after this addition. The own `store.save` event should be a no-op when normalized sidebar content is identical.

- [ ] **Step 3: Harden the webpage-side listener**

In the existing `chrome.storage.onChanged` local listener in `js/content.js`, call `pruneSelection()` immediately after normalizing the incoming sidebar and before the `sameSidebar` branch. When the sidebar is unchanged, call `renderBatchTools()` along with `syncMeta()`; when it changes, assign `st`, render, and persist images as before.

- [ ] **Step 4: Verify storage and selection behavior statically**

Run:

```powershell
node --check js/app.js
node --check js/content.js
node tests/newtab-feature-surface.test.js
```

Expected: exit code 0 for all commands, with the static test reporting its existing feature-surface success message.

- [ ] **Step 5: Commit the synchronization change**

Run:

```powershell
git diff --check -- js/app.js js/content.js tests/newtab-feature-surface.test.js
git add -- js/app.js js/content.js tests/newtab-feature-surface.test.js
git diff --cached --name-only
git commit -m "fix: sync collection batch state across surfaces"
```

Before committing, confirm the staged list contains only files changed for this task and does not include `js/background.js`, `manifest.json`, `css/newtab.css`, or any pre-existing test changes.

## Task 5: Run repository regression tests and perform loaded-extension acceptance

**Files:**
- Modify: none unless a verification exposes a defect; fixes must be added to the task that owns the defect.
- Test: existing Node tests and a temporary Edge profile outside the repository.

- [ ] **Step 1: Run every existing Node test directly**

Run:

```powershell
node tests/collection-board-core.test.js
node tests/newtab-feature-surface.test.js
node tests/background-regressions.test.js
node tests/drag-rendering.test.js
node tests/drag-settle.test.js
node tests/sync-writer-ownership.test.js
```

Expected: every command exits 0 and prints its own passing summary. If a test fails, diagnose and fix the owning task before continuing.

- [ ] **Step 2: Run syntax and whitespace checks**

Run:

```powershell
node --check js/app.js
node --check js/content.js
node --check js/collection-board-core.js
node --check js/background.js
git diff --check HEAD~4..HEAD
```

Expected: all commands exit 0. The commit range may be adjusted to include the actual number of feature commits, but it must not include unrelated pre-existing changes.

- [ ] **Step 3: Launch a temporary Edge extension context**

Use a temporary profile outside the repository. Resolve the executable first:

```powershell
$edgePath = (Get-Command msedge.exe -ErrorAction Stop).Source
$probeProfile = Join-Path ([IO.Path]::GetTempPath()) ("lg-batch-" + [guid]::NewGuid().ToString("N"))
Start-Process -FilePath $edgePath -ArgumentList @(
  "--user-data-dir=$probeProfile",
  "--disable-extensions-except=D:\workb\edge-liquid-glass-newtab",
  "--load-extension=D:\workb\edge-liquid-glass-newtab",
  "edge://newtab/"
)
```

Use the temporary Edge window for the following acceptance steps and close it after verification; do not seed the user's normal profile or real collection data.

- [ ] **Step 4: Verify the new-tab surface manually**

Seed three clearly disposable test items through the existing add dialog or drag/paste path. Verify:

1. “批量” enters batch mode and changes to “退出批量”.
2. Clicking a card selects it without opening or moving it.
3. `Enter`/`Space` selects a focused card and `Escape` exits.
4. Search and type filtering preserve selected ids; “全选当前” selects only visible cards.
5. Delete shows the exact selected count and requires confirmation.
6. After deletion, the card count and canvas update without scroll jump.
7. The action toast's “撤销” restores content, tags, position, and stacking order.

- [ ] **Step 5: Verify the webpage-side surface and cross-page sync**

Open `https://example.com` in the same temporary context and move the pointer to the left edge to open the webpage sidebar. Verify the same batch behavior, then perform both directions:

1. Delete in the new tab and confirm the webpage sidebar removes the same cards.
2. Delete in the webpage sidebar and confirm the new tab removes the same cards.
3. Add or edit a disposable item during the undo window, then undo; confirm that the unrelated change remains.
4. Confirm batch mode does not invoke single-card delete, link opening, drag movement, or glass-filter changes.

- [ ] **Step 6: Confirm the final worktree boundary**

Run:

```powershell
git status --short --untracked-files=all
git log --oneline -8
```

Expected: the feature commits contain only the files listed in their tasks; the pre-existing modified files remain present but are not accidentally staged or rewritten by this feature.

## Plan self-review

- Spec coverage: interaction and keyboard behavior are covered by Tasks 2 and 3; shared removal/restoration by Task 1; local synchronization and stale-selection handling by Task 4; actual Edge acceptance and scroll/drag checks by Task 5; non-goals are enforced by the global constraints.
- Placeholder scan: every step contains concrete files, interfaces, code, commands, and expected results; there are no deferred implementation steps.
- Interface consistency: both surfaces call `removeByIds(items, ids)` and `restoreByIds(items, removed)`, and both use an `removed` record with `{ item, index }`.
- Scope check: no new storage format, dependency, manifest permission, background behavior, or unrelated cleanup is introduced.
