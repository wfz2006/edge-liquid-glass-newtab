"use strict";
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const { createHarness, geometries } = require("../helpers/glass-performance-harness");

// node tests/benchmarks/glass-map.bench.js <before.js> [after.js]
// CPU map generation only: no PNG encoding, DOM layout, or GPU composition.
if (!process.argv[2]) throw new Error("Supply the pre-change liquid-glass.js file as the first argument");
const versions = [process.argv[2], process.argv[3] || require.resolve("../../js/liquid-glass.js")]
  .map(path => ({ path, harness: createHarness(fs.readFileSync(path, "utf8"), { countMath: false }), times: [] }));
function run(version) {
  const start = performance.now();
  for (const geometry of geometries) version.harness.probe.dispMap(...geometry);
  return performance.now() - start;
}
for (let i = 0; i < 3; i++) versions.forEach(run);
// Alternate order to reduce warm-up and scheduling bias.
for (let i = 0; i < 9; i++) {
  const order = i % 2 ? [...versions].reverse() : versions;
  for (const version of order) version.times.push(run(version));
}
const results = versions.map(v => ({ path: v.path, medianMs: v.times.sort((a, b) => a - b)[4] }));
console.log(JSON.stringify({ results, reductionPercent: 100 * (1 - results[1].medianMs / results[0].medianMs) }, null, 2));
