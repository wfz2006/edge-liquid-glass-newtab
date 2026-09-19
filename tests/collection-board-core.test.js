"use strict";

const assert = require("assert");
const core = require("../js/collection-board-core.js");

const link = core.normalizeItem({
  id: "a",
  type: "link",
  title: "项目文档",
  url: "https://example.com/docs",
  tags: "项目, 学习"
}, "fallback");

assert.deepStrictEqual(link.tags, ["项目", "学习"]);
assert.strictEqual(core.matches(link, "学习", "all"), true);
assert.strictEqual(core.matches(link, "example.com", "link"), true);
assert.strictEqual(core.matches(link, "example.com", "text"), false);

const note = core.normalizeItem({
  type: "text",
  title: "备忘",
  text: "准备发布说明",
  tags: ["项目", "发布"]
}, "note-1");

assert.strictEqual(core.matches(note, "发布", "text"), true);
assert.strictEqual(core.matches(note, "项目", "all"), true);
const lower = core.normalizeItem({ id: "lower", type: "image", z: 4 }, "lower");
const defaultStack = core.normalizeItem({ id: "default", type: "image" }, "default");
assert.strictEqual(lower.z, 4);
assert.strictEqual(defaultStack.z, 0);
assert.strictEqual(core.nextStack([lower, defaultStack]), 5);
assert.strictEqual(core.bringToFront([lower, defaultStack], defaultStack), 5);
assert.strictEqual(defaultStack.z, 5);
assert.strictEqual(core.sameLink(link, {
  type: "link",
  url: "https://example.com/docs/"
}), true);
assert.strictEqual(core.sameLink(link, {
  type: "link",
  url: "https://example.com/other"
}), false);

const viewport = { scrollTop: 318, scrollLeft: 9 };
const savedView = core.captureScroll(viewport);
viewport.scrollTop = 0;
viewport.scrollLeft = 0;
core.restoreScroll(viewport, savedView);
assert.strictEqual(viewport.scrollTop, 318);
assert.strictEqual(viewport.scrollLeft, 9);

const positions = core.organizePositions([link, note], {
  x: 10,
  y: 10,
  gap: 12,
  heightFor: function (item) { return item.type === "link" ? 70 : 120; }
});
assert.deepStrictEqual(positions, [{ x: 10, y: 10 }, { x: 10, y: 92 }]);

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

const inheritedIdItem = { id: "toString", type: "text", text: "不要误删" };
assert.deepStrictEqual(
  core.removeByIds([inheritedIdItem], ["unrelated"]).items,
  [inheritedIdItem],
  "an unrelated selection must not remove an item whose id matches Object.prototype"
);

console.log("collection-board-core: 23 assertions passed");
