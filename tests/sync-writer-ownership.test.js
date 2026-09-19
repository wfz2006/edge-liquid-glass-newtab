"use strict";

const assert = require("assert");
const fs = require("fs");
const { test } = require("node:test");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");
const background = fs.readFileSync(require.resolve("../js/background.js"), "utf8");

test("the MV3 background owns sync writes so the page cannot race it", () => {
  const start = app.indexOf("save: function (patch)");
  const end = app.indexOf("\n  };\n\n  function handleStorageChange", start);
  assert.ok(start >= 0 && end > start, "store.save block should remain discoverable");
  const saveBlock = app.slice(start, end);

  assert.doesNotMatch(saveBlock, /\bwriteSync\s*\(/);
  assert.match(background, /function syncLocalState\(state\)/);
  assert.match(background, /chrome\.storage\.onChanged\.addListener/);
});
