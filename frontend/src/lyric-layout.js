// Keep each chord anchored to its original character when a reading line wraps.
export function wrapLyricLine(text = "", chords = [], columns = 40) {
  const width = Math.max(1, Math.floor(columns));
  const lastChordEnd = chords.reduce((end, chord) => Math.max(end, chord.position + chord.chord.length), 0);
  const source = text.padEnd(Math.max(text.length, lastChordEnd), " ");
  if (!source.length) return [{ text: "", chords: [] }];
  const rows = [];
  let start = 0;
  while (start < source.length) {
    let end = Math.min(start + width, source.length);
    if (end < source.length) {
      const space = source.lastIndexOf(" ", end - 1);
      if (space > start) end = space + 1;
    }
    const crossingChord = chords.find((chord) => chord.position > start && chord.position < end && chord.position + chord.chord.length > start + width);
    if (crossingChord) end = crossingChord.position;
    rows.push({
      text: source.slice(start, end),
      chords: chords.filter((chord) => chord.position >= start && chord.position < end)
        .map((chord) => ({ ...chord, position: chord.position - start })),
    });
    start = end;
  }
  return rows;
}
