const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../frontend/src/SetlistMonitor.jsx"), "utf8");
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf("export function buildMonitorQueue"), source.indexOf("const formatTime")).replace("export function", "function") + ";this.build = buildMonitorQueue;", context);
const parse = (lyrics) => [{ id: "base", name: "Verso 1", lyrics }];

test("el monitor conserva repeticiones y comentarios del evento por cancion", () => {
  const blocks = [{ id: "a", name: "Coro", lyrics: "[La]Texto", comment: "Solo voces" }, { id: "b", name: "Coro", lyrics: "[La]Texto", comment: "Banda completa" }];
  const items = [{ localId: "first", arrangement: blocks }, { localId: "second", baseLyrics: "[Re]Original" }];
  const result = context.build(items, parse);
  assert.equal(result.length, 3);
  assert.equal(result[0].comment, "Solo voces");
  assert.equal(result[1].comment, "Banda completa");
  assert.equal(result[2].lyrics, "[Re]Original");
  assert.equal(result[2].songIndex, 1);
  assert.equal(result[1].sectionIndex, 1);
  assert.equal(result[0].count, 2);
  assert.equal(new Set(result.map((entry) => entry.timingId)).size, 3);
  assert.equal(blocks[0].songIndex, undefined);
});

test("sin armado, el monitor usa la letra base sin modificarla", () => {
  const result = context.build([{ localId: "item", arrangement: [], baseLyrics: "[Mi]Letra base", lyrics: "Otra letra" }], parse);
  assert.equal(result[0].lyrics, "[Mi]Letra base");
  assert.equal(context.build([], parse).length, 0);
});
