const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const load = () => import(pathToFileURL(path.join(__dirname, "../frontend/src/lyric-layout.js")));

test("las lineas largas conservan toda la letra y cada acorde al envolver", async () => {
  const { wrapLyricLine } = await load();
  const text = "Una primera frase larga que continua en el renglon siguiente con sus acordes";
  const chords = [{ chord: "La-", position: 0 }, { chord: "Sol", position: 39 }, { chord: "Fa#-7", position: 58 }];
  for (const columns of [20, 28, 36, 44]) {
    const rows = wrapLyricLine(text, chords, columns);
    assert.equal(rows.map((row) => row.text).join(""), text);
    assert.ok(rows.every((row) => row.text.length <= columns));
    let offset = 0;
    const restored = rows.flatMap((row) => {
      const result = row.chords.map((chord) => ({ ...chord, position: chord.position + offset }));
      offset += row.text.length;
      return result;
    });
    assert.deepEqual(restored, chords);
  }
});

test("palabras sin espacios, acordes al final y lineas vacias", async () => {
  const { wrapLyricLine } = await load();
  const rows = wrapLyricLine("x".repeat(150), [{ chord: "Re", position: 65 }], 25);
  assert.equal(rows.map((row) => row.text).join(""), "x".repeat(150));
  assert.equal(rows[2].chords[0].position, 15);
  const tail = wrapLyricLine("Final", [{ chord: "La", position: 20 }], 12);
  assert.equal(tail.flatMap((row) => row.chords).length, 1);
  assert.ok(tail.every((row) => row.text.length <= 12));
  assert.deepEqual(wrapLyricLine("", [], 30), [{ text: "", chords: [] }]);
});

test("un acorde cercano al borde pasa completo al renglon siguiente", async () => {
  const { wrapLyricLine } = await load();
  const rows = wrapLyricLine("a".repeat(50), [{ chord: "Re/Fa#", position: 19 }], 22);
  assert.equal(rows[1].chords[0].position, 0);
  assert.equal(rows[1].chords[0].chord, "Re/Fa#");
});
