const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "frontend/src/main.jsx"), "utf8");
const range = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const context = vm.createContext({});
vm.runInContext([
  range("function normalizeSearchText", "function parseEditableLyricLine"),
  range("const BASE_SECTION_HEADING", "const EASY_CHORDS"),
  range("function setlistPayload", "function versionOption"),
  "this.helpers = { parseBaseSectionsFromLyrics, serializeBaseSectionsToLyrics, setlistItemsToOrder, setlistPayload };",
].join("\n"), context);
const { helpers } = context;
const baseLyrics = "VERSO 1\n[La]Primera parte\n\nCORO\n[Re]Segunda parte";
const base = helpers.parseBaseSectionsFromLyrics(baseLyrics);
const arrangement = [base[1], base[0], { ...base[1], id: "repeat" }];
const item = { id: "item", songVersionId: "version", position: 1, arrangement, songVersion: { key: "La", lyrics: baseLyrics, song: { title: "Prueba" } } };

test("el orden del evento repite partes y conserva letra y acordes originales", () => {
  const result = helpers.setlistItemsToOrder([item])[0];
  assert.equal(result.baseLyrics, baseLyrics);
  assert.equal(result.lyrics, "CORO\n[Re]Segunda parte\n\nVERSO 1\n[La]Primera parte\n\nCORO\n[Re]Segunda parte");
  assert.equal(item.songVersion.lyrics, baseLyrics);
});

test("las canciones sin armado mantienen el orden base", () => {
  const result = helpers.setlistItemsToOrder([{ ...item, arrangement: [] }])[0];
  assert.equal(result.lyrics, baseLyrics);
});

test("editar los datos de setlist conserva el armado y su independencia", () => {
  const ordered = helpers.setlistItemsToOrder([item]);
  const payload = helpers.setlistPayload({ name: "Evento", date: "2026-10-18" }, ordered);
  assert.equal(payload.items[0].arrangement.length, 3);
  assert.equal(payload.items[0].arrangement[0].lyrics, "[Re]Segunda parte");
  const otherEvent = helpers.setlistItemsToOrder([{ ...item, arrangement: [] }])[0];
  assert.equal(otherEvent.lyrics, baseLyrics);
});

const backendRequire = createRequire(path.join(root, "backend/package.json"));
const { z } = backendRequire("zod");
const route = fs.readFileSync(path.join(root, "backend/src/routes/setlists.js"), "utf8");
const schemaContext = vm.createContext({ z });
vm.runInContext(route.slice(route.indexOf("const arrangementSchema"), route.indexOf('setlistsRouter.get("/"')) + ";this.schemas = { arrangementSchema, itemSchema };", schemaContext);

test("el backend valida bloques y acepta items anteriores sin armado", () => {
  const { arrangementSchema, itemSchema } = schemaContext.schemas;
  assert.equal(arrangementSchema.parse(arrangement).length, 3);
  assert.equal(arrangementSchema.safeParse([{ ...arrangement[0], type: "invalid" }]).success, false);
  assert.equal(arrangementSchema.safeParse([{ ...arrangement[0], name: "" }]).success, false);
  assert.equal(itemSchema.parse({ songVersionId: "version", position: 1 }).arrangement, undefined);
});
