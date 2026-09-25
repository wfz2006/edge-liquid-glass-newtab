"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");
const { createHarness } = require("./helpers/glass-performance-harness");
const baseline = require("./fixtures/glass-performance-baseline.json");
const source = fs.readFileSync(require.resolve("../js/liquid-glass.js"), "utf8");

test("map pixels stay identical while interior gradient work decreases", () => {
  const h = createHarness(source);
  let before = 0, after = 0;
  for (const item of baseline.maps) {
    h.stats.hypot = 0;
    h.probe.dispMap(...item.geometry);
    assert.equal(h.hash(), item.hash, "unchanged RGBA bytes for " + item.geometry);
    before += item.hypot;
    after += h.stats.hypot;
  }
  assert.ok(after < before * .6, `expensive math calls: ${before} -> ${after}`);
});

test("refresh bursts scan once and later refreshes still execute", () => {
  const h = createHarness(source);
  h.glass.init();
  h.stats.scans = 0;
  for (let i = 0; i < 20; i++) h.glass.refresh();
  h.flush();
  assert.equal(h.stats.scans, 1);
  h.glass.refresh();
  h.flush();
  assert.equal(h.stats.scans, 2);
});

test("bounded cache retains frequently used maps across capacity", () => {
  const h = createHarness(source);
  const get = n => h.probe.getMap(String(n), 120 + n, 96, 18, 16, 10);
  const hot = get(0);
  for (let i = 1; i <= 90; i++) {
    get(i);
    assert.equal(get(0), hot, "a recently used map must survive eviction");
  }
  const generated = h.stats.maps;
  get(1);
  assert.equal(h.stats.maps, generated + 1, "old entries are evicted to bound memory");
});
