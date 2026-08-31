const NOTE_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SPANISH_ROOTS = new Map([
  ["do", "C"],
  ["re", "D"],
  ["mi", "E"],
  ["fa", "F"],
  ["sol", "G"],
  ["la", "A"],
  ["si", "B"],
]);

export function normalizeChord(rawChord) {
  const chord = String(rawChord || "").trim().replace(/[().,;:¡!¿?]+$/g, "");
  if (!chord) return "";

  const parts = chord.split("/");
  const normalized = parts.map((part) => {
    const value = part.trim();
    const lower = value.toLowerCase();
    const spanish = lower.match(/^(do|re|mi|fa|sol|la|si)(#|b)?(-|m|maj7|m7|7|sus2|sus4|sus|add9|dim|aug|6|9)?$/);
    if (spanish) {
      const [, root, accidental = "", suffix = ""] = spanish;
      return `${SPANISH_ROOTS.get(root)}${accidental}${suffix === "-" ? "m" : suffix}`;
    }

    const english = value.match(/^([A-G])([#b]?)(m|maj7|m7|7|sus2|sus4|sus|add9|dim|aug|6|9)?$/i);
    if (!english) return "";
    const [, root, accidental = "", suffix = ""] = english;
    return `${root.toUpperCase()}${accidental}${suffix}`;
  });

  return normalized.every(Boolean) ? normalized.join("/") : "";
}

export function chordParts(chordName) {
  const [body, bass] = chordName.split("/");
  const match = body.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) return { root: chordName, suffix: "", bass: bass || null };
  const [, root, accidental, suffix] = match;
  return { root: `${root}${accidental}`, suffix: suffix || "", bass: bass || null };
}

export function extractChordOccurrences(lyrics) {
  const occurrences = [];
  const bracketRegex = /\[([^\]]+)\]/g;
  let match;
  while ((match = bracketRegex.exec(lyrics || ""))) {
    const chord = normalizeChord(match[1]);
    if (chord) occurrences.push({ chord, position: match.index });
  }

  return occurrences;
}

export function summarizeChords(lyrics) {
  const map = new Map();
  extractChordOccurrences(lyrics).forEach(({ chord, position }) => {
    if (!map.has(chord)) map.set(chord, { chord, count: 0, firstPosition: position });
    const entry = map.get(chord);
    entry.count += 1;
    entry.firstPosition = Math.min(entry.firstPosition, position);
  });
  return [...map.values()];
}

export function transposeChordBy(chord, steps) {
  const [body, bass] = chord.split("/");
  const match = body.match(/^([A-G]#?)(.*)$/);
  if (!match) return chord;
  const [, root, suffix] = match;
  const index = NOTE_ORDER.indexOf(root);
  if (index < 0) return chord;
  const transposed = `${NOTE_ORDER[(index + steps + 120) % 12]}${suffix}`;
  return bass ? `${transposed}/${transposeChordBy(bass, steps)}` : transposed;
}

export function transposeLyricsBy(lyrics, steps) {
  return String(lyrics || "").replace(/\[([^\]]+)\]/g, (_, chord) => `[${transposeChordBy(normalizeChord(chord), steps)}]`);
}
