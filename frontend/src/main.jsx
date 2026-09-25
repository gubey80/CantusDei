import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  FilePlus2,
  Guitar,
  Library,
  Link2,
  ListPlus,
  LogIn,
  LogOut,
  Monitor,
  Maximize,
  Music2,
  Plus,
  Search,
  Save,
  Sparkles,
  Trash2,
  X,
  ArrowDown,
  ArrowUp,
  Users,
} from "lucide-react";
import { api, API_URL, setAuthToken } from "./api.js";
import "./styles.css";

const DEFAULT_CHORDS = {
  C: [null, 3, 2, 0, 1, 0],
  Cm: [null, 3, 5, 5, 4, 3],
  C7: [null, 3, 2, 3, 1, 0],
  Cmaj7: [null, 3, 2, 0, 0, 0],
  D: [null, null, 0, 2, 3, 2],
  Dm: [null, null, 0, 2, 3, 1],
  D7: [null, null, 0, 2, 1, 2],
  E: [0, 2, 2, 1, 0, 0],
  Em: [0, 2, 2, 0, 0, 0],
  E7: [0, 2, 0, 1, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  Fm: [1, 3, 3, 1, 1, 1],
  G: [3, 2, 0, 0, 0, 3],
  Gm: [3, 5, 5, 3, 3, 3],
  G7: [3, 2, 0, 0, 0, 1],
  A: [0, 0, 2, 2, 2, 0],
  Am: [0, 0, 2, 2, 1, 0],
  A7: [0, 0, 2, 0, 2, 0],
  B: [2, 2, 4, 4, 4, 2],
  Bm: [2, 2, 4, 4, 3, 2],
  B7: [null, 2, 1, 2, 0, 2],
  Bb: [1, 1, 3, 3, 3, 1],
  Bbm: [1, 1, 3, 3, 2, 1],
  Eb: [null, 6, 8, 8, 8, 6],
  Fm7: [1, 3, 1, 1, 1, 1],
};

const NOTE_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_ORDER_FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const SPANISH_ROOTS = {
  do: "C",
  re: "D",
  mi: "E",
  fa: "F",
  sol: "G",
  la: "A",
  si: "B",
};
const FLAT_EQUIVALENTS = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

function normalizeNoteName(note = "") {
  const match = String(note).trim().match(/^([A-G])([#b]?)/i);
  if (!match) return "";
  const root = `${match[1].toUpperCase()}${match[2] || ""}`;
  return FLAT_EQUIVALENTS[root] || root;
}

function noteIndex(note) {
  return NOTE_ORDER.indexOf(normalizeNoteName(note));
}

function semitoneLabel(steps) {
  if (steps === 0) return "tono original";
  if (steps === 1) return "+1 semitono";
  if (steps === 2) return "+1 tono";
  if (steps % 2 === 0) return `+${steps / 2} tonos`;
  return `+${steps} semitonos`;
}

function movementLabel(steps) {
  const numericSteps = Number(steps || 0);
  if (numericSteps === 0) return "Tono actual";
  if (numericSteps === 1) return "Subir medio tono";
  if (numericSteps === 2) return "Subir 1 tono";
  if (numericSteps === -1) return "Bajar medio tono";
  if (numericSteps === -2) return "Bajar 1 tono";
  const direction = numericSteps > 0 ? "Subir" : "Bajar";
  const amount = Math.abs(numericSteps);
  return `${direction} ${amount} semitonos`;
}

function preferredNoteOrder(sourceKey = "") {
  return String(sourceKey).includes("b") ? NOTE_ORDER_FLATS : NOTE_ORDER;
}

function transposeChordName(chord, steps, noteNames = NOTE_ORDER) {
  const [body, bass] = String(chord || "").split("/");
  const match = body.match(/^([A-G])([#b]?)(.*)$/i);
  if (!match) return chord;
  const [, rawRoot, accidental = "", suffix = ""] = match;
  const root = normalizeNoteName(`${rawRoot}${accidental}`);
  const index = NOTE_ORDER.indexOf(root);
  if (index < 0) return chord;
  const transposed = `${noteNames[(index + steps + 120) % 12]}${suffix}`;
  return bass ? `${transposed}/${transposeChordName(bass, steps, noteNames)}` : transposed;
}

function transposeLyricsBySteps(lyrics, steps, sourceKey = "") {
  const noteNames = preferredNoteOrder(sourceKey);
  return String(lyrics || "").replace(/\[([^\]]+)\]/g, (_, chord) => `[${transposeChordName(chord.trim(), steps, noteNames)}]`);
}

function normalizeChordForLookup(chord = "") {
  const parts = String(chord || "").trim().split("/");
  const normalized = parts.map((part) => {
    const value = part.trim().replace(/[().,;:¡!¿?]+$/g, "");
    const spanish = value.toLowerCase().match(/^(do|re|mi|fa|sol|la|si)(#|b)?(-|m|maj7|m7|7|sus2|sus4|sus|add2|add9|dim|aug|6|9|11|13)?$/);
    if (spanish) {
      const [, root, accidental = "", suffix = ""] = spanish;
      return `${SPANISH_ROOTS[root]}${accidental}${suffix === "-" ? "m" : suffix}`;
    }
    const english = value.match(/^([A-G])([#b]?)(m|maj7|m7|7|sus2|sus4|sus|add2|add9|dim|aug|6|9|11|13)?$/i);
    if (!english) return value;
    const [, root, accidental = "", suffix = ""] = english;
    return `${root.toUpperCase()}${accidental}${suffix}`;
  });
  return normalized.join("/");
}

function chordLookupMap(chords = []) {
  const map = new Map();
  chords.forEach((chord) => {
    map.set(chord.name, chord);
    map.set(normalizeChordForLookup(chord.name), chord);
  });
  return map;
}

function findChordDefinition(chordByName, chordName) {
  return chordByName.get(chordName) || chordByName.get(normalizeChordForLookup(chordName)) || null;
}

function transposeOptionsFromKey(sourceKey) {
  const index = noteIndex(sourceKey);
  if (index < 0) return [];
  const noteNames = preferredNoteOrder(sourceKey);
  return noteNames.map((_, steps) => ({
    steps,
    key: noteNames[(index + steps) % 12],
    label: `${noteNames[(index + steps) % 12]} - ${semitoneLabel(steps)}`,
  }));
}

function transposeOptionFromSteps(sourceKey, steps) {
  const index = noteIndex(sourceKey);
  const numericSteps = Number(steps || 0);
  if (index < 0) return null;
  const noteNames = preferredNoteOrder(sourceKey);
  const key = noteNames[(index + numericSteps + 120) % 12];
  return {
    steps: numericSteps,
    key,
    label: `${key} - ${movementLabel(numericSteps)}`,
  };
}

function transposeKeyBySteps(sourceKey = "", steps = 0) {
  const index = noteIndex(sourceKey);
  if (index < 0) return sourceKey;
  const noteNames = preferredNoteOrder(sourceKey);
  return noteNames[(index + Number(steps || 0) + 120) % 12];
}

function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseLyricLine(line = "") {
  const chords = [];
  let text = "";
  let index = 0;

  for (const match of line.matchAll(/\[([^\]]+)\]/g)) {
    text += line.slice(index, match.index);
    chords.push({ chord: match[1].trim(), position: text.length });
    index = match.index + match[0].length;
  }

  text += line.slice(index);
  return { text, chords };
}

function buildChordLine(text, chords) {
  const widths = chords.map(({ chord, position }) => position + chord.length);
  const width = Math.max(text.length, ...widths, 1);
  const chars = Array(width).fill(" ");

  chords.forEach(({ chord, position }) => {
    [...chord].forEach((char, offset) => {
      chars[position + offset] = char;
    });
  });

  return chars.join("").replace(/\s+$/, "");
}

function isSongSectionLabel(text, chords = []) {
  if (chords.length) return false;
  return /^(intro|introduccion|verso(?:\s+\d+)?|estrofa(?:\s+\d+)?|pre[- ]?coro|coro(?:\s+x?\d+)?|puente|interludio|instrumental|final|outro)(?:\s*[:.-])?$/i.test(
    normalizeSearchText(text.trim()),
  );
}

function extractUniqueChords(lyrics = "") {
  const chords = [];
  String(lyrics).replace(/\[([^\]]+)\]/g, (_, chord) => {
    const cleanChord = chord.trim();
    if (cleanChord && !chords.includes(cleanChord)) chords.push(cleanChord);
    return "";
  });
  return chords;
}

const EASY_CHORDS = new Set(["C", "D", "E", "G", "A", "Am", "Em", "Dm", "D7", "E7", "A7", "G7", "Cmaj7"]);
const MEDIUM_CHORDS = new Set(["F", "Bm", "B7", "F#m", "C#m", "Gm", "Cm", "Bb", "C7", "Fmaj7", "Asus", "Dsus"]);
const HARD_ROOTS = new Set(["C#", "D#", "F#", "G#", "A#", "Db", "Eb", "Gb", "Ab", "Bb"]);

function chordMainPart(chord = "") {
  return String(chord).split("/")[0].trim();
}

function chordDifficultyScore(chord = "") {
  const main = chordMainPart(chord);
  const root = main.match(/^([A-G](?:#|b)?)/)?.[1] || "";
  let score = 3;

  if (EASY_CHORDS.has(main)) score = 1;
  else if (MEDIUM_CHORDS.has(main)) score = 4;
  else if (HARD_ROOTS.has(root)) score = 5;

  if (/[#b]/.test(root)) score += 1;
  if (/m7|maj7|sus|add|dim|aug|9|11|13/i.test(main)) score += 1;
  if (String(chord).includes("/")) score += 1;

  return score;
}

function difficultyLabel(score) {
  if (score <= 12) return "Facil";
  if (score <= 22) return "Media";
  return "Dificil";
}

function capoSuggestionFor({ sourceLyrics = "", sourceKey = "", targetKey = "", capo = 0 }) {
  const sourceIndex = noteIndex(sourceKey);
  const targetIndex = noteIndex(targetKey);
  if (sourceIndex < 0 || targetIndex < 0) return null;

  const targetSteps = (targetIndex - sourceIndex + 12) % 12;
  const playableSteps = targetSteps - Number(capo || 0);
  const lyrics = transposeLyricsBySteps(sourceLyrics, playableSteps, sourceKey);
  const chords = extractUniqueChords(lyrics);
  const chordScore = chords.reduce((sum, chord) => sum + chordDifficultyScore(chord), 0);
  const uniquePenalty = Math.max(0, chords.length - 5) * 2;
  const capoPenalty = capo <= 5 ? capo * 0.4 : 4 + (capo - 5) * 2;
  const score = chordScore + uniquePenalty + capoPenalty;

  return {
    capo,
    lyrics,
    chords,
    score,
    difficulty: difficultyLabel(score),
  };
}

function capoSuggestionsFor({ sourceLyrics = "", sourceKey = "", targetKey = "" }) {
  return Array.from({ length: 8 }, (_, capo) => capoSuggestionFor({ sourceLyrics, sourceKey, targetKey, capo }))
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
}

function normalizeMediaUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return null;
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
}

function MediaEmbed({ url }) {
  const parsedUrl = normalizeMediaUrl(url);
  if (!parsedUrl) return null;

  return (
    <section className="media-link" aria-label="Enlace de la cancion">
      <a href={parsedUrl.href} target="_blank" rel="noreferrer">
        <Music2 size={17} />
        Ver en YouTube
      </a>
    </section>
  );
}

function baseChordName(chord = "") {
  return chord.split("/")[0].replace(/(#|b)?(maj7|m7|sus2|sus4|sus|add9|dim|aug|m|7|6|9)?$/i, (match) => match);
}

function chordDefinition(chord, savedFrets) {
  if (Array.isArray(savedFrets)) return savedFrets;
  if (DEFAULT_CHORDS[chord]) return DEFAULT_CHORDS[chord];
  const body = chord.split("/")[0];
  if (DEFAULT_CHORDS[body]) return DEFAULT_CHORDS[body];
  const match = body.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return null;
  const [, root, suffix] = match;
  return DEFAULT_CHORDS[`${root}${suffix}`] || DEFAULT_CHORDS[root] || null;
}

function ChordDiagram({
  chord,
  capo = 0,
  frets: savedFrets,
  barreFret = null,
  barreFromString = null,
  barreToString = null,
  showTitle = true,
  configuredOverride = null,
  onConfigure = null,
}) {
  const frets = configuredOverride === false ? null : chordDefinition(chord, savedFrets);
  const hasBarre = configuredOverride === false ? false : Number(barreFret) > 0 && Number(barreFromString) > 0 && Number(barreToString) > 0;
  const configured = configuredOverride ?? (Array.isArray(frets) || hasBarre);
  const values = Array.isArray(frets) ? frets : Array(6).fill(null);
  const pressed = values.filter((fret) => Number(fret) > 0);
  if (hasBarre) pressed.push(Number(barreFret));
  const minFret = pressed.length ? Math.min(...pressed) : 1;
  const maxFret = pressed.length ? Math.max(...pressed) : 1;
  const baseFret = hasBarre ? Number(barreFret) : maxFret > 5 ? minFret : 1;
  const fretCount = Math.max(4, maxFret - baseFret + 1);
  const fretGap = 22;
  const fretTop = 40;
  const fretBottom = fretTop + fretCount * fretGap;
  const viewHeight = fretBottom + 14;
  const showFretLabel = hasBarre || baseFret > 1;
  const gridStart = showFretLabel ? 48 : 28;
  const strings = Array.from({ length: 6 }, (_, index) => gridStart + index * 20);
  const gridEnd = strings[strings.length - 1];
  const gridCenter = (gridStart + gridEnd) / 2;
  const fretsY = Array.from({ length: fretCount + 1 }, (_, index) => fretTop + index * fretGap);
  const barreStartIndex = hasBarre ? 6 - Number(barreFromString) : 0;
  const barreEndIndex = hasBarre ? 6 - Number(barreToString) : 0;
  const barreMinIndex = Math.min(barreStartIndex, barreEndIndex);
  const barreMaxIndex = Math.max(barreStartIndex, barreEndIndex);
  const barreX = hasBarre ? strings[barreMinIndex] : 0;
  const barreWidth = hasBarre ? strings[barreMaxIndex] - barreX : 0;
  const barreY = hasBarre ? fretTop + (Number(barreFret) - baseFret + 0.5) * fretGap : 0;

  const canConfigure = !configured && typeof onConfigure === "function";
  const DiagramShell = canConfigure ? "button" : "article";

  return (
    <DiagramShell
      className={`diagram${configured ? "" : " is-empty"}${canConfigure ? " is-configurable" : ""}`}
      onClick={canConfigure ? () => onConfigure(chord) : undefined}
      title={canConfigure ? `Configurar acorde ${chord}` : undefined}
      type={canConfigure ? "button" : undefined}
    >
      {showTitle ? <strong>{chord}</strong> : null}
      <svg
        className="chord-svg"
        style={{ height: `${Math.max(116, viewHeight - 38)}px` }}
        viewBox={`0 0 156 ${viewHeight}`}
        role="img"
        aria-label={`Acorde ${chord}`}
      >
        {showFretLabel ? (
          <text x={gridStart - 12} y={fretTop + 4} textAnchor="end" className="fret-number">
            {baseFret}fr
          </text>
        ) : null}
        {strings.map((x) => (
          <line key={`s-${x}`} x1={x} y1={fretTop - 2} x2={x} y2={fretBottom} />
        ))}
        {fretsY.map((y, index) => (
          <line key={`f-${y}`} x1={gridStart} y1={y} x2={gridEnd} y2={y} className={index === 0 && baseFret === 1 ? "nut" : ""} />
        ))}
        {capo ? (
          <>
            <rect x={gridStart - 4} y="43" width="108" height="12" rx="6" className="capo-bar" />
            <text x={gridCenter} y="53" textAnchor="middle" className="capo-text">CAPO {capo}</text>
          </>
        ) : null}
        {hasBarre ? (
          <rect
            x={barreX - 7}
            y={barreY - 7}
            width={barreWidth + 14}
            height="14"
            rx="7"
            className="barre-bar"
          />
        ) : null}
        {values.map((fret, index) => {
          const x = strings[index];
          const coveredByBarre = hasBarre && index >= barreMinIndex && index <= barreMaxIndex;
          if (coveredByBarre && (fret === null || fret === undefined || Number(fret) <= Number(barreFret))) return null;
          if (fret === 0) return <text key={`o-${index}`} x={x} y="30" textAnchor="middle" className="open-string">o</text>;
          if (fret === null || fret === undefined) return <text key={`x-${index}`} x={x} y="30" textAnchor="middle" className="muted-string">x</text>;
          const y = fretTop + (fret - baseFret + 0.5) * fretGap;
          return <circle key={`d-${index}`} cx={x} cy={y} r="7" className="finger-dot" />;
        })}
      </svg>
      <span>{configured ? (capo ? `Capo ${capo}` : "Guitarra") : canConfigure ? "Click para configurar" : "Sin configurar"}</span>
    </DiagramShell>
  );
}

function LyricsView({ lyrics, showChords }) {
  const lines = String(lyrics || "").split("\n");

  return (
    <div className={`lyrics${showChords ? "" : " are-chords-hidden"}`}>
      {lines.map((line, index) => {
        const parsed = parseLyricLine(line);
        if (!line.trim()) return <div key={index} className="lyric-line is-empty" />;
        if (isSongSectionLabel(parsed.text, parsed.chords)) {
          return <div key={index} className="lyric-line lyric-section-label">{parsed.text.trim()}</div>;
        }
        return (
          <div key={index} className="lyric-line">
            <pre className="chord-row">{buildChordLine(parsed.text, parsed.chords)}</pre>
            <pre className="text-row">{parsed.text || " "}</pre>
          </div>
        );
      })}
    </div>
  );
}

function VersionButton({ version, active, onClick }) {
  const label = version.name || `Tono ${version.key}`;
  return (
    <button className={active ? "is-active" : ""} onClick={onClick} type="button">
      <strong>{version.key}</strong>
      <span>{version.capo ? `Capo ${version.capo}` : label}</span>
    </button>
  );
}

function ReaderView({ songs, chords, selectedSong, onSelectSong, search, setSearch, initialVersionId = "", onConfigureChord }) {
  const [selectedVersionId, setSelectedVersionId] = useState(initialVersionId || "");
  const [showLyricsChords, setShowLyricsChords] = useState(true);
  const [showDiagrams, setShowDiagrams] = useState(false);

  useEffect(() => {
    const firstVersion = selectedSong?.versions?.[0];
    if (!selectedSong?.versions?.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(firstVersion?.id || "");
    }
  }, [selectedSong, selectedVersionId]);

  useEffect(() => {
    if (initialVersionId && selectedSong?.versions?.some((version) => version.id === initialVersionId)) {
      setSelectedVersionId(initialVersionId);
    }
  }, [initialVersionId, selectedSong]);

  const selectedVersion = useMemo(() => {
    return selectedSong?.versions?.find((version) => version.id === selectedVersionId) || selectedSong?.versions?.[0] || null;
  }, [selectedSong, selectedVersionId]);

  const usedChords = useMemo(() => extractUniqueChords(selectedVersion?.lyrics), [selectedVersion?.lyrics]);
  const chordByName = useMemo(() => chordLookupMap(chords), [chords]);

  return (
    <section className="work-area reader-shell">
      <div className="panel-heading reader-heading">
        <h2>Canciones</h2>
        <label className="search-field">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por titulo, autor o letra" />
        </label>
      </div>

      <div className="song-layout">
        <aside className="song-list" aria-label="Lista de canciones">
          {songs.map((song) => (
            <button key={song.id} className={selectedSong?.id === song.id ? "is-active" : ""} onClick={() => onSelectSong(song)} title={song.title}>
              <strong>{song.title}</strong>
              <span>{song.artist || "Sin artista"} - {song.versions.length} version(es)</span>
            </button>
          ))}
          {!songs.length ? <p className="empty-song-list">No hay canciones para mostrar.</p> : null}
        </aside>

        <article className={`reader-panel${showDiagrams ? "" : " is-diagrams-hidden"}`}>
          {selectedSong && selectedVersion ? (
            <>
              <header className="reader-titlebar">
                <div>
                  <div className="title-line">
                    <h2>{selectedSong.title}</h2>
                    <span>{selectedSong.artist || "Sin artista"}</span>
                  </div>
                  <p>
                    {selectedSong.songbook?.name || "Cancionero"} - Tono {selectedVersion.key}
                    {selectedVersion.capo ? ` - Capo ${selectedVersion.capo}` : ""}
                    {selectedVersion.reviewed || selectedVersion.status === "REVIEWED" ? " - Revisada" : ""}
                  </p>
                </div>
                <div className="reader-actions">
                  <button onClick={() => setShowLyricsChords((value) => !value)} type="button">
                    {showLyricsChords ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showLyricsChords ? "Ocultar acordes" : "Mostrar acordes"}
                  </button>
                  <button onClick={() => setShowDiagrams((value) => !value)} type="button">
                    <Guitar size={16} />
                    {showDiagrams ? "Ocultar diagramas" : "Mostrar diagramas"}
                  </button>
                </div>
              </header>

              {selectedSong.versions.length > 1 ? (
                <div className="version-strip" aria-label="Versiones disponibles">
                  {selectedSong.versions.map((version) => (
                    <VersionButton
                      key={version.id}
                      version={version}
                      active={version.id === selectedVersion.id}
                      onClick={() => setSelectedVersionId(version.id)}
                    />
                  ))}
                </div>
              ) : null}

              <MediaEmbed url={selectedSong.listenUrl} />

              <div className="reader-grid">
                <section className="lyrics-panel">
                  <LyricsView lyrics={selectedVersion.lyrics || ""} showChords={showLyricsChords} />
                  <footer className="reader-notes">
                    {selectedVersion.comments ? <p><strong>Comentario:</strong> {selectedVersion.comments}</p> : null}
                    {selectedVersion.internalNotes ? <p><strong>Notas internas:</strong> {selectedVersion.internalNotes}</p> : null}
                    {selectedSong.copyrightText ? <p>{selectedSong.copyrightText}</p> : null}
                  </footer>
                </section>

                {showDiagrams ? (
                  <aside className="chords-panel">
                    <div className="chord-diagrams">
                      {usedChords.map((chordName) => {
                        const definition = findChordDefinition(chordByName, chordName);
                        return (
                          <ChordDiagram
                            key={chordName}
                            chord={chordName}
                            capo={selectedVersion.capo || 0}
                            frets={definition?.configured ? definition.frets : undefined}
                            barreFret={definition?.barreFret}
                            barreFromString={definition?.barreFromString}
                            barreToString={definition?.barreToString}
                            configuredOverride={Boolean(definition?.configured)}
                            onConfigure={onConfigureChord ? () => onConfigureChord(normalizeChordForLookup(chordName), selectedVersion.id) : null}
                          />
                        );
                      })}
                      {!usedChords.length ? <p className="empty-message">Esta version no tiene acordes escritos.</p> : null}
                    </div>
                  </aside>
                ) : null}
              </div>
            </>
          ) : (
            <p className="empty-message">Selecciona una cancion.</p>
          )}
        </article>
      </div>
    </section>
  );
}

const EMPTY_VERSION = {
  name: "",
  key: "C",
  capo: 0,
  bpm: 96,
  duration: "4:00",
  difficulty: "Inicial",
  owner: "",
  lyrics: "",
  comments: "",
  internalNotes: "",
  reviewed: false,
  playbackSpeed: 2800,
  rehearsalSpeed: 0.75,
};

const EMPTY_SONG = {
  songbookCode: "mayor",
  title: "",
  artist: "",
  listenUrl: "",
  copyrightText: "",
  tags: "",
};

const BLANK_EDITOR_SONG = {
  ...EMPTY_SONG,
  songbookCode: "",
};

const BLANK_EDITOR_VERSION = {
  ...EMPTY_VERSION,
  key: "",
  capo: "",
  bpm: "",
  duration: "",
  difficulty: "",
  playbackSpeed: "",
  rehearsalSpeed: "",
};

function versionToForm(version) {
  return {
    ...EMPTY_VERSION,
    ...version,
    capo: Number(version?.capo || 0),
    bpm: Number(version?.bpm || 96),
    playbackSpeed: Number(version?.playbackSpeed || 2800),
    rehearsalSpeed: Number(version?.rehearsalSpeed || 0.75),
    reviewed: Boolean(version?.reviewed || version?.status === "REVIEWED"),
  };
}

function songToForm(song) {
  return {
    ...EMPTY_SONG,
    songbookCode: song?.songbook?.code || "mayor",
    title: song?.title || "",
    artist: song?.artist || "",
    listenUrl: song?.listenUrl || "",
    copyrightText: song?.copyrightText || "",
    tags: Array.isArray(song?.tags) ? song.tags.join(", ") : "",
  };
}

function versionPayload(form) {
  return {
    name: form.name || `Tono ${form.key}${Number(form.capo) ? ` - Capo ${Number(form.capo)}` : ""}`,
    key: form.key || "C",
    capo: Number(form.capo || 0),
    bpm: Number(form.bpm || 96),
    duration: form.duration || "4:00",
    difficulty: form.difficulty || "Inicial",
    owner: form.owner || "",
    lyrics: form.lyrics || "",
    comments: form.comments || "",
    internalNotes: form.internalNotes || "",
    reviewed: Boolean(form.reviewed),
    playbackSpeed: Number(form.playbackSpeed || 2800),
    rehearsalSpeed: Number(form.rehearsalSpeed || 0.75),
  };
}

function songPayload(form) {
  return {
    songbookCode: form.songbookCode || "mayor",
    title: form.title.trim(),
    artist: form.artist.trim(),
    listenUrl: form.listenUrl.trim(),
    copyrightText: form.copyrightText.trim(),
    tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
  };
}

function Field({ label, children }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SongEditorView({ songs, chords = [], selectedSong, onSelectSong, search, setSearch, onReload, setGlobalError, initialMode = "edit" }) {
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [isCreatingSong, setIsCreatingSong] = useState(initialMode === "new");
  const [isCreatingVersion, setIsCreatingVersion] = useState(initialMode === "new");
  const [songForm, setSongForm] = useState(initialMode === "new" ? EMPTY_SONG : BLANK_EDITOR_SONG);
  const [versionForm, setVersionForm] = useState(initialMode === "new" ? EMPTY_VERSION : BLANK_EDITOR_VERSION);
  const [songbookFilter, setSongbookFilter] = useState("all");
  const [selectedTransposeSteps, setSelectedTransposeSteps] = useState(0);
  const [capoMode, setCapoMode] = useState("keepShapes");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const songbooks = useMemo(() => {
    const byCode = new Map();
    songs.forEach((song) => {
      const code = song.songbook?.code || "sin-himnario";
      if (!byCode.has(code)) byCode.set(code, song.songbook?.name || "Sin himnario");
    });
    return [...byCode.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [songs]);
  const visibleSongs = useMemo(() => (
    songbookFilter === "all"
      ? songs
      : songs.filter((song) => (song.songbook?.code || "sin-himnario") === songbookFilter)
  ), [songs, songbookFilter]);

  const selectedVersion = useMemo(() => {
    return selectedSong?.versions?.find((version) => version.id === selectedVersionId) || selectedSong?.versions?.[0] || null;
  }, [selectedSong, selectedVersionId]);
  const chordByName = useMemo(() => chordLookupMap(chords), [chords]);
  const transposeOptions = useMemo(() => transposeOptionsFromKey(selectedVersion?.key), [selectedVersion?.key]);
  const quickTransposeOptions = useMemo(() => (
    QUICK_TRANSPOSE_STEPS
      .map((steps) => transposeOptionFromSteps(selectedVersion?.key, steps))
      .filter(Boolean)
  ), [selectedVersion?.key]);
  const versionTransposeOptions = useMemo(() => {
    const bySteps = new Map();
    [...quickTransposeOptions, ...transposeOptions].forEach((option) => {
      if (!bySteps.has(option.steps)) bySteps.set(option.steps, option);
    });
    return [...bySteps.values()].sort((a, b) => a.steps - b.steps);
  }, [quickTransposeOptions, transposeOptions]);
  const selectedTransposeOption = useMemo(
    () => transposeOptionFromSteps(selectedVersion?.key, selectedTransposeSteps),
    [selectedVersion?.key, selectedTransposeSteps],
  );
  const capoSuggestions = useMemo(() => {
    if (capoMode !== "keepTone") return [];
    const sourceLyrics = selectedVersion?.lyrics || versionForm.lyrics || "";
    const sourceKey = selectedVersion?.key || versionForm.key;
    return capoSuggestionsFor({
      sourceLyrics,
      sourceKey,
      targetKey: versionForm.key,
    });
  }, [capoMode, selectedVersion?.lyrics, selectedVersion?.key, versionForm.lyrics, versionForm.key]);

  useEffect(() => {
    if (isCreatingSong) return;
    setSongForm(selectedSong ? songToForm(selectedSong) : BLANK_EDITOR_SONG);
    if (!selectedSong?.versions?.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(selectedSong?.versions?.[0]?.id || "");
    }
  }, [selectedSong, isCreatingSong, selectedVersionId]);

  useEffect(() => {
    if (isCreatingSong || isCreatingVersion) return;
    setVersionForm(selectedVersion ? versionToForm(selectedVersion) : BLANK_EDITOR_VERSION);
  }, [selectedVersion, isCreatingSong, isCreatingVersion]);

  function changeSongbookFilter(value) {
    setSongbookFilter(value);
    if (selectedSong && value !== "all" && (selectedSong.songbook?.code || "sin-himnario") !== value) {
      setIsCreatingSong(false);
      setIsCreatingVersion(false);
      onSelectSong(null);
    }
  }

  function updateSongForm(field, value) {
    setSongForm((current) => ({ ...current, [field]: value }));
  }

  function updateVersionForm(field, value) {
    setVersionForm((current) => ({ ...current, [field]: value }));
  }

  function startNewSong() {
    setIsCreatingSong(true);
    setIsCreatingVersion(true);
    setSelectedVersionId("");
    setSongForm(EMPTY_SONG);
    setVersionForm(EMPTY_VERSION);
    setSelectedTransposeSteps(0);
    setCapoMode("keepShapes");
    setMessage("");
  }

  function startNewVersion() {
    setIsCreatingVersion(true);
    setVersionForm(versionToForm({
      ...selectedVersion,
      id: undefined,
      name: "",
      comments: "",
      internalNotes: "",
      reviewed: false,
    }));
    setSelectedTransposeSteps(0);
    setCapoMode("keepShapes");
    setMessage("");
  }

  function applyTransposedVersion(steps) {
    const normalizedSteps = Number(steps);
    const option = transposeOptionFromSteps(selectedVersion?.key, normalizedSteps);
    if (!option || !selectedVersion) return;
    setSelectedTransposeSteps(normalizedSteps);
    setVersionForm((current) => ({
      ...current,
      name: `Tono ${option.key}${Number(current.capo || 0) ? ` - Capo ${Number(current.capo || 0)}` : ""}`,
      key: option.key,
      lyrics: transposeLyricsBySteps(selectedVersion.lyrics || "", option.steps, selectedVersion.key),
    }));
  }

  function applyCapoBehavior() {
    const capo = Number(versionForm.capo || 0);
    if (!capo) return;
    const sourceKey = selectedVersion?.key || versionForm.key;
    const sourceLyrics = selectedVersion?.lyrics || versionForm.lyrics || "";

    setVersionForm((current) => {
      if (capoMode === "keepTone") {
        const sourceIndex = noteIndex(sourceKey);
        const targetIndex = noteIndex(current.key);
        const targetSteps = sourceIndex >= 0 && targetIndex >= 0 ? (targetIndex - sourceIndex + 12) % 12 : 0;
        const playableSteps = targetSteps - capo;

        return {
          ...current,
          name: `Tono ${current.key} - Capo ${capo}`,
          lyrics: transposeLyricsBySteps(sourceLyrics, playableSteps, sourceKey),
        };
      }

      const soundingKey = transposeKeyBySteps(current.key || sourceKey, capo);
      return {
        ...current,
        name: `Tono ${soundingKey} - Capo ${capo}`,
        key: soundingKey,
        lyrics: current.lyrics,
      };
    });
  }

  function applyCapoSuggestion(suggestion) {
    if (!suggestion) return;
    setVersionForm((current) => ({
      ...current,
      capo: suggestion.capo,
      name: `Tono ${current.key} - Capo ${suggestion.capo}`,
      lyrics: suggestion.lyrics,
    }));
  }

  async function runAction(action, successMessage) {
    setSaving(true);
    setMessage("");
    setGlobalError("");
    try {
      const result = await action();
      setMessage(successMessage);
      return result;
    } catch (error) {
      setGlobalError(error.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveSong() {
    if (!selectedSong && !isCreatingSong) return;
    if (!songForm.title.trim()) {
      setGlobalError("El titulo de la cancion es obligatorio.");
      return;
    }
    if (!versionForm.lyrics.trim() && isCreatingSong) {
      setGlobalError("La letra de la primera version es obligatoria.");
      return;
    }

    const saved = await runAction(async () => {
      if (isCreatingSong) {
        return api("/songs", {
          method: "POST",
          body: JSON.stringify({
            ...songPayload(songForm),
            version: versionPayload(versionForm),
          }),
        });
      }
      await api(`/songs/${selectedSong.id}`, {
        method: "PUT",
        body: JSON.stringify(songPayload(songForm)),
      });
      return selectedSong;
    }, isCreatingSong ? "Cancion creada." : "Datos de la cancion guardados.");

    if (saved) {
      setIsCreatingSong(false);
      setIsCreatingVersion(false);
      await onReload(saved.id || selectedSong?.id);
    }
  }

  async function saveVersion() {
    if (!selectedSong && !isCreatingSong) return;
    if (!versionForm.lyrics.trim()) {
      setGlobalError("La letra de la version es obligatoria.");
      return;
    }

    const saved = await runAction(async () => {
      if (isCreatingSong) {
        return api("/songs", {
          method: "POST",
          body: JSON.stringify({
            ...songPayload(songForm),
            version: versionPayload(versionForm),
          }),
        });
      }
      if (isCreatingVersion) {
        return api(`/songs/${selectedSong.id}/versions`, {
          method: "POST",
          body: JSON.stringify(versionPayload(versionForm)),
        });
      }
      return api(`/songs/versions/${selectedVersion.id}`, {
        method: "PUT",
        body: JSON.stringify(versionPayload(versionForm)),
      });
    }, isCreatingVersion || isCreatingSong ? "Version creada." : "Version guardada.");

    if (saved) {
      setIsCreatingSong(false);
      setIsCreatingVersion(false);
      await onReload(isCreatingSong ? saved.id : selectedSong.id);
      if (!isCreatingSong && saved.id) setSelectedVersionId(saved.id);
    }
  }

  async function deleteSong() {
    if (!selectedSong) return;
    const confirmed = window.confirm(`Eliminar "${selectedSong.title}" y todas sus versiones?`);
    if (!confirmed) return;
    const deleted = await runAction(async () => {
      await api(`/songs/${selectedSong.id}`, { method: "DELETE" });
      return true;
    }, "Cancion eliminada.");
    if (deleted) await onReload("");
  }

  async function deleteVersion(versionId) {
    if (!versionId || !selectedSong) return;
    if (selectedSong.versions.length <= 1) {
      setGlobalError("No se puede eliminar la unica version. Elimina la cancion completa.");
      return;
    }
    const confirmed = window.confirm("Eliminar esta version?");
    if (!confirmed) return;
    const deleted = await runAction(async () => {
      await api(`/songs/versions/${versionId}`, { method: "DELETE" });
      return true;
    }, "Version eliminada.");
    if (deleted) await onReload(selectedSong.id);
  }

  return (
    <section className="work-area editor-shell">
      <div className="panel-heading editor-heading">
        <h2>{isCreatingSong ? "Nueva cancion" : "Editar canciones"}</h2>
        {!isCreatingSong ? (
        <div className="heading-actions">
          <label className="editor-songbook-filter">
            <span>Himnario</span>
            <select value={songbookFilter} onChange={(event) => changeSongbookFilter(event.target.value)}>
              <option value="all">Todos los himnarios</option>
              {songbooks.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          </label>
          <label className="search-field">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cancion para editar" />
          </label>
        </div>
        ) : null}
      </div>

      <div className={`editor-layout${isCreatingSong ? " is-new-song" : ""}`}>
        {!isCreatingSong ? (
        <aside className="song-list" aria-label="Canciones para editar">
          {visibleSongs.map((song) => (
            <button
              key={song.id}
              className={!isCreatingSong && selectedSong?.id === song.id ? "is-active" : ""}
              onClick={() => {
                setIsCreatingSong(false);
                setIsCreatingVersion(false);
                onSelectSong(song);
              }}
              title={song.title}
            >
              <strong>{song.title}</strong>
              <span>{song.artist || "Sin artista"} - {song.versions.length} version(es)</span>
            </button>
          ))}
          {!visibleSongs.length ? <p className="empty-song-list">No hay canciones para editar.</p> : null}
        </aside>
        ) : null}

        <div className="editor-main">
          <section className="form-card">
            <header className="form-card-heading">
              <div>
                <span>Datos generales</span>
                <h3>{isCreatingSong ? "Nueva cancion" : selectedSong?.title || "Selecciona una cancion"}</h3>
              </div>
              {!isCreatingSong && selectedSong ? (
                <button className="danger-action" onClick={deleteSong} type="button"><Trash2 size={16} /> Eliminar cancion</button>
              ) : null}
            </header>

            <div className="form-grid">
              <Field label="Cancionero">
                <select value={songForm.songbookCode} onChange={(event) => updateSongForm("songbookCode", event.target.value)}>
                  <option value="" disabled>Seleccionar</option>
                  <option value="mayor">Cancionero Mayor</option>
                  <option value="escuela-biblica">Escuela Biblica</option>
                </select>
              </Field>
              <Field label="Titulo">
                <input value={songForm.title} onChange={(event) => updateSongForm("title", event.target.value)} />
              </Field>
              <Field label="Artista / autor">
                <input value={songForm.artist} onChange={(event) => updateSongForm("artist", event.target.value)} />
              </Field>
              <Field label="Link para escuchar">
                <input value={songForm.listenUrl} onChange={(event) => updateSongForm("listenUrl", event.target.value)} />
              </Field>
              <Field label="Etiquetas">
                <input value={songForm.tags} onChange={(event) => updateSongForm("tags", event.target.value)} placeholder="adoracion, cierre, comunion" />
              </Field>
              <Field label="Derechos de autor">
                <textarea value={songForm.copyrightText} onChange={(event) => updateSongForm("copyrightText", event.target.value)} rows="2" />
              </Field>
            </div>
            <div className="form-actions">
              <button className="primary-action" onClick={saveSong} disabled={saving || (!selectedSong && !isCreatingSong)} type="button"><Save size={16} /> Guardar datos</button>
            </div>
          </section>

          <section className="form-card">
            <header className="form-card-heading">
              <div>
                <span>Versiones</span>
                <h3>{isCreatingVersion || isCreatingSong ? "Crear version" : selectedVersion?.name || "Version seleccionada"}</h3>
              </div>
              {!isCreatingSong && selectedSong ? (
                <button className="secondary-action" onClick={startNewVersion} type="button"><Plus size={16} /> Nueva version</button>
              ) : null}
            </header>

            {!isCreatingSong && selectedSong?.versions?.length ? (
              <div className="version-admin-list">
                {selectedSong.versions.map((version) => (
                  <button
                    key={version.id}
                    className={!isCreatingVersion && selectedVersion?.id === version.id ? "is-active" : ""}
                    onClick={() => {
                      setIsCreatingVersion(false);
                      setSelectedVersionId(version.id);
                    }}
                    type="button"
                  >
                    <span>{version.key}{version.capo ? ` - Capo ${version.capo}` : ""}</span>
                    <small>{version.name || "Sin nombre"}</small>
                  </button>
                ))}
              </div>
            ) : null}

            {isCreatingVersion && !isCreatingSong && selectedVersion ? (
              <section className="transpose-tool" aria-label="Crear version transpuesta">
                <div className="transpose-tool-header">
                  <div>
                    <span>Nueva version desde {selectedVersion.key || "tono actual"}</span>
                    <h4>{selectedTransposeOption?.key ? `Destino: ${selectedTransposeOption.key}` : "Selecciona un movimiento"}</h4>
                  </div>
                  <label>
                    <span>Movimiento rapido</span>
                    <select value={selectedTransposeSteps} onChange={(event) => applyTransposedVersion(event.target.value)}>
                      <option value="0">Tono actual</option>
                      {quickTransposeOptions.map((option) => (
                        <option key={option.steps} value={option.steps}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="transpose-all-tones">
                  <div>
                    <strong>Todos los tonos posibles</strong>
                    <small>Click en un tono para convertir la letra y crear la nueva version.</small>
                  </div>
                  <div className="transpose-tone-grid">
                    {transposeOptions.map((option) => (
                      <button
                        key={`${option.key}-${option.steps}`}
                        className={selectedTransposeSteps === option.steps ? "is-active" : ""}
                        onClick={() => applyTransposedVersion(option.steps)}
                        type="button"
                      >
                        <span>{option.key}</span>
                        <small>{semitoneLabel(option.steps)}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            <div className="form-grid version-form-grid">
              <Field label="Nombre de version">
                <input value={versionForm.name} onChange={(event) => updateVersionForm("name", event.target.value)} placeholder="Tono D sin capo" />
              </Field>
              <Field label="Tono">
                {isCreatingVersion && !isCreatingSong && selectedVersion ? (
                  <select value={selectedTransposeSteps} onChange={(event) => applyTransposedVersion(event.target.value)}>
                    {versionTransposeOptions.map((option) => (
                      <option key={`${option.key}-${option.steps}`} value={option.steps}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <input value={versionForm.key} onChange={(event) => updateVersionForm("key", event.target.value)} />
                )}
              </Field>
              <Field label="Capotraste">
                <input type="number" min="0" max="12" value={versionForm.capo} onChange={(event) => updateVersionForm("capo", event.target.value)} />
              </Field>
              <div className="capo-tool">
                <label>
                  <span>Uso del capo</span>
                  <select value={capoMode} onChange={(event) => setCapoMode(event.target.value)}>
                    <option value="keepShapes">Mantener acordes y subir tono real</option>
                    <option value="keepTone">Mantener tono y simplificar acordes</option>
                  </select>
                </label>
                <button className="secondary-action" onClick={applyCapoBehavior} disabled={!Number(versionForm.capo || 0)} type="button">
                  Aplicar capotraste
                </button>
                <small>
                  {capoMode === "keepTone"
                    ? "Transpone los acordes hacia abajo para que con capo suene en el mismo tono."
                    : "Mantiene los acordes escritos y actualiza el tono real segun el capo."}
                </small>
                {capoMode === "keepTone" && capoSuggestions.length ? (
                  <div className="capo-suggestions" aria-label="Sugerencias de capotraste">
                    <strong>Sugerencia simple</strong>
                    {capoSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.capo}
                        className={index === 0 ? "is-recommended" : ""}
                        onClick={() => applyCapoSuggestion(suggestion)}
                        type="button"
                      >
                        <span>{index === 0 ? "Recomendada" : "Alternativa"} - Capo {suggestion.capo}</span>
                        <small>{suggestion.difficulty} - Formas: {suggestion.chords.slice(0, 8).join(", ") || "sin acordes"}</small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <Field label="BPM">
                <input type="number" min="40" max="240" value={versionForm.bpm} onChange={(event) => updateVersionForm("bpm", event.target.value)} />
              </Field>
              <Field label="Duracion">
                <input value={versionForm.duration} onChange={(event) => updateVersionForm("duration", event.target.value)} />
              </Field>
              <Field label="Dificultad">
                <select value={versionForm.difficulty} onChange={(event) => updateVersionForm("difficulty", event.target.value)}>
                  <option value="" disabled>Seleccionar</option>
                  <option>Inicial</option>
                  <option>Media</option>
                  <option>Avanzada</option>
                </select>
              </Field>
              <Field label="Responsable">
                <input value={versionForm.owner} onChange={(event) => updateVersionForm("owner", event.target.value)} />
              </Field>
              <Field label="Velocidad scroll">
                <input type="number" min="400" step="100" value={versionForm.playbackSpeed} onChange={(event) => updateVersionForm("playbackSpeed", event.target.value)} />
              </Field>
              <Field label="Velocidad ensayo">
                <select value={versionForm.rehearsalSpeed} onChange={(event) => updateVersionForm("rehearsalSpeed", event.target.value)}>
                  <option value="" disabled>Seleccionar</option>
                  <option value="0.45">Muy lenta</option>
                  <option value="0.75">Lenta</option>
                  <option value="1.05">Normal</option>
                  <option value="1.45">Rapida</option>
                </select>
              </Field>
              <label className="check-field">
                <input type="checkbox" checked={versionForm.reviewed} onChange={(event) => updateVersionForm("reviewed", event.target.checked)} />
                Cancion revisada
              </label>
              <Field label="Comentario de la cancion">
                <textarea value={versionForm.comments} onChange={(event) => updateVersionForm("comments", event.target.value)} rows="2" />
              </Field>
              <Field label="Notas internas">
                <textarea value={versionForm.internalNotes} onChange={(event) => updateVersionForm("internalNotes", event.target.value)} rows="2" />
              </Field>
            </div>

            <Field label="Letra con acordes">
              <textarea
                className="lyrics-editor"
                value={versionForm.lyrics}
                onChange={(event) => updateVersionForm("lyrics", event.target.value)}
                placeholder="[G]Santo, santo..."
                rows="18"
              />
            </Field>

            <div className="form-actions">
              <button className="primary-action" onClick={saveVersion} disabled={saving || (!selectedSong && !isCreatingSong)} type="button"><Save size={16} /> Guardar version</button>
              {!isCreatingSong && !isCreatingVersion && selectedVersion ? (
                <button className="danger-action" onClick={() => deleteVersion(selectedVersion.id)} disabled={saving} type="button"><Trash2 size={16} /> Eliminar version</button>
              ) : null}
            </div>
          </section>

          <section className="form-card preview-card">
            <header className="form-card-heading">
              <div>
                <span>Previsualizacion</span>
                <h3>{songForm.title || "Cancion sin titulo"}</h3>
              </div>
            </header>
            <div className="reader-grid">
              <section className="lyrics-panel">
                <LyricsView lyrics={versionForm.lyrics} showChords />
              </section>
              <aside className="chords-panel">
                <div className="chord-diagrams">
                  {extractUniqueChords(versionForm.lyrics).map((chord) => {
                    const definition = findChordDefinition(chordByName, chord);
                    return (
                      <ChordDiagram
                        key={chord}
                        chord={chord}
                        capo={Number(versionForm.capo || 0)}
                        frets={definition?.configured ? definition.frets : undefined}
                        barreFret={definition?.barreFret}
                        barreFromString={definition?.barreFromString}
                        barreToString={definition?.barreToString}
                        configuredOverride={definition ? Boolean(definition.configured) : null}
                      />
                    );
                  })}
                  {!extractUniqueChords(versionForm.lyrics).length ? <p className="empty-message">Sin acordes para previsualizar.</p> : null}
                </div>
              </aside>
            </div>
          </section>

          {message ? <p className="success-box">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}

const IMPORT_SAMPLE = `{
  "songs": [
    {
      "songbook": "mayor",
      "title": "Nombre de la cancion",
      "artist": "Autor o artista",
      "key": "G",
      "capo": 0,
      "versionName": "Tono G",
      "lyrics": "[G]Letra de la cancion\\n[D]Segunda linea",
      "bpm": 96,
      "duration": "4:00",
      "level": "Inicial",
      "comments": "",
      "notes": "",
      "reviewed": false
    }
  ]
}`;

const QUICK_TRANSPOSE_STEPS = [-2, -1, 1, 2];

function normalizeImportJson(raw, songbookCode) {
  const parsed = JSON.parse(raw);
  const songs = Array.isArray(parsed?.songs)
    ? parsed.songs
    : parsed?.song
      ? [parsed.song]
      : Array.isArray(parsed)
        ? parsed
        : [parsed];
  return {
    songs: songs.map((song) => ({
      ...song,
      songbook: songbookCode || song.songbook || song.songbookCode || "mayor",
    })),
  };
}

function importActionLabel(action) {
  if (action === "CREATE_SONG") return "Crear cancion";
  if (action === "ADD_VERSION") return "Agregar version";
  if (action === "UPDATE_VERSION") return "Actualizar version";
  return action;
}

function SongImportView({ onReload, setGlobalError }) {
  const [rawJson, setRawJson] = useState(IMPORT_SAMPLE);
  const [songbooks, setSongbooks] = useState([]);
  const [songbookCode, setSongbookCode] = useState("mayor");
  const [customSongbook, setCustomSongbook] = useState("");
  const [preview, setPreview] = useState(null);
  const [parsedPayload, setParsedPayload] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedSongbookCode = songbookCode === "__custom__" ? customSongbook.trim() : songbookCode;
  const selectedItem = preview?.items?.[selectedIndex] || preview?.items?.[0] || null;
  const parsedSong = parsedPayload?.songs?.[selectedIndex] || parsedPayload?.songs?.[0] || null;

  useEffect(() => {
    let cancelled = false;
    api("/songs/songbooks")
      .then((items) => {
        if (!cancelled) setSongbooks(items);
      })
      .catch(() => {
        if (!cancelled) setSongbooks([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawJson(text);
    setPreview(null);
    setParsedPayload(null);
    setMessage("");
  }

  async function runPreview() {
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      if (!selectedSongbookCode) throw new Error("Selecciona o escribe un cancionero.");
      const payload = normalizeImportJson(rawJson, selectedSongbookCode);
      const result = await api("/songs/import/preview", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setParsedPayload(payload);
      setPreview(result);
      setSelectedIndex(0);
      setMessage(result.valid ? "JSON validado. Revisa el resumen antes de importar." : "Hay errores para corregir.");
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function commitImport() {
    if (!parsedPayload || !preview?.valid) return;
    const confirmed = window.confirm(`Importar ${preview.total} cancion(es)? Se actualizaran versiones existentes con el mismo titulo, tono y capo.`);
    if (!confirmed) return;
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      const result = await api("/songs/import/commit", {
        method: "POST",
        body: JSON.stringify(parsedPayload),
      });
      setMessage(`Importacion completa: ${result.summary.createdSong} nuevas, ${result.summary.addedVersion} versiones agregadas, ${result.summary.updatedVersion} versiones actualizadas.`);
      await onReload(result.results?.[0]?.songId || "");
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function replaceImport() {
    if (!parsedPayload || !preview?.valid) return;
    const confirmed = window.confirm(
      `Esto va a borrar las canciones actuales del cancionero "${selectedSongbookCode}" y cargar ${preview.total} cancion(es) desde este JSON. Tambien se quitaran de las setlists las canciones borradas. Continuar?`,
    );
    if (!confirmed) return;
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      const result = await api("/songs/import/replace", {
        method: "POST",
        body: JSON.stringify(parsedPayload),
      });
      setMessage(`Reemplazo completo: ${result.removed.songs} canciones anteriores eliminadas, ${result.summary.createdSong} canciones cargadas. Items quitados de setlists: ${result.removed.setlistItems}.`);
      await onReload(result.results?.[0]?.songId || "");
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="work-area import-shell">
      <div className="section-title-band">
        <div>
          <span>Canciones</span>
          <h2>Importar JSON</h2>
          <p>Pega una cancion individual o sube un archivo masivo. CantusDei evita duplicar por titulo, cancionero, tono y capo.</p>
        </div>
        <button className="primary-action" onClick={runPreview} disabled={saving} type="button"><Eye size={16} /> Previsualizar</button>
      </div>

      <div className="import-layout">
        <section className="form-card import-panel">
          <header className="form-card-heading">
            <div>
              <span>Origen</span>
              <h3>JSON de canciones</h3>
            </div>
          </header>
          <div className="form-grid import-controls">
            <Field label="Cancionero">
              <select value={songbookCode} onChange={(event) => setSongbookCode(event.target.value)}>
                {songbooks.map((songbook) => (
                  <option key={songbook.code} value={songbook.code}>{songbook.name}</option>
                ))}
                {!songbooks.some((songbook) => songbook.code === "mayor") ? <option value="mayor">Cancionero Mayor</option> : null}
                {!songbooks.some((songbook) => songbook.code === "escuela-biblica") ? <option value="escuela-biblica">Escuela Biblica</option> : null}
                <option value="__custom__">Otro cancionero</option>
              </select>
            </Field>
            {songbookCode === "__custom__" ? (
              <Field label="Codigo del cancionero">
                <input value={customSongbook} onChange={(event) => setCustomSongbook(event.target.value)} placeholder="jovenes-domingo" />
              </Field>
            ) : null}
            <Field label="Subir archivo JSON">
              <input type="file" accept=".json,application/json" onChange={handleFile} />
            </Field>
          </div>
          <Field label="Pegar JSON">
            <textarea
              className="json-editor"
              value={rawJson}
              onChange={(event) => {
                setRawJson(event.target.value);
                setPreview(null);
                setParsedPayload(null);
              }}
              rows="20"
              spellCheck="false"
            />
          </Field>
          <div className="form-actions">
            <button className="secondary-action" onClick={() => setRawJson(IMPORT_SAMPLE)} disabled={saving} type="button">Cargar ejemplo</button>
            <button className="primary-action" onClick={runPreview} disabled={saving} type="button"><Eye size={16} /> Previsualizar</button>
            <button className="danger-action" onClick={replaceImport} disabled={saving || !preview?.valid} type="button"><Trash2 size={16} /> Limpiar y volver a cargar</button>
          </div>
        </section>

        <section className="form-card import-panel">
          <header className="form-card-heading">
            <div>
              <span>Validacion</span>
              <h3>Resumen antes de guardar</h3>
            </div>
            <button className="primary-action" onClick={commitImport} disabled={saving || !preview?.valid} type="button"><Save size={16} /> Confirmar importacion</button>
          </header>

          {preview ? (
            <>
              <div className="import-summary">
                <article><strong>{preview.total}</strong><span>Total</span></article>
                <article><strong>{preview.summary.createSong}</strong><span>Nuevas</span></article>
                <article><strong>{preview.summary.addVersion}</strong><span>Versiones nuevas</span></article>
                <article><strong>{preview.summary.updateVersion}</strong><span>Actualizaciones</span></article>
              </div>
              {preview.errors?.length ? (
                <div className="error-box">
                  {preview.errors.map((error, index) => (
                    <p key={`${error.index}-${error.field}-${index}`}>Cancion {error.index + 1}: {error.message}</p>
                  ))}
                </div>
              ) : null}
              <div className="import-list">
                {preview.items.map((item, index) => (
                  <button key={`${item.title}-${index}`} className={index === selectedIndex ? "is-active" : ""} onClick={() => setSelectedIndex(index)} type="button">
                    <strong>{item.title}</strong>
                    <span>{item.songbookName} - {item.key}{item.capo ? ` - Capo ${item.capo}` : ""}</span>
                    <small>{importActionLabel(item.action)}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-message">Previsualiza el JSON para ver que se va a crear o actualizar.</p>
          )}

          {selectedItem && parsedSong ? (
            <div className="import-preview">
              <header>
                <div>
                  <span>{importActionLabel(selectedItem.action)}</span>
                  <h3>{selectedItem.title}</h3>
                </div>
                <small>{selectedItem.chords.length} acorde(s): {selectedItem.chords.slice(0, 10).join(", ")}</small>
              </header>
              <div className="reader-grid">
                <section className="lyrics-panel">
                  <LyricsView lyrics={parsedSong.lyrics} showChords />
                </section>
                <aside className="chords-panel">
                  <div className="chord-diagrams">
                    {extractUniqueChords(parsedSong.lyrics).slice(0, 12).map((chord) => (
                      <ChordDiagram key={chord} chord={chord} capo={Number(parsedSong.capo || 0)} />
                    ))}
                  </div>
                </aside>
              </div>
            </div>
          ) : null}

          {message ? <p className={preview?.valid === false ? "error-box" : "success-box"}>{message}</p> : null}
        </section>
      </div>
    </section>
  );
}

const EMPTY_SETLIST = {
  name: "Domingo",
  date: new Date().toISOString().slice(0, 10),
  leader: "",
  keyboard: "",
  drums: "",
  guitar1: "",
  guitar2: "",
  bass: "",
  vocals: "",
  projection: "",
  sound: "",
  comments: "",
};

function setlistDate(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function setlistToForm(setlist) {
  const musicians = setlist?.musicians || {};
  return {
    ...EMPTY_SETLIST,
    name: setlist?.name || "Domingo",
    date: setlistDate(setlist?.date) || EMPTY_SETLIST.date,
    leader: setlist?.leader || "",
    keyboard: musicians.keyboard || "",
    drums: musicians.drums || "",
    guitar1: musicians.guitar1 || "",
    guitar2: musicians.guitar2 || "",
    bass: musicians.bass || "",
    vocals: musicians.vocals || "",
    projection: musicians.projection || "",
    sound: musicians.sound || "",
    comments: setlist?.comments || "",
  };
}

function setlistPayload(form, orderItems) {
  return {
    name: form.name || "Domingo",
    date: form.date,
    leader: form.leader || "",
    musicians: {
      keyboard: form.keyboard || "",
      drums: form.drums || "",
      guitar1: form.guitar1 || "",
      guitar2: form.guitar2 || "",
      bass: form.bass || "",
      vocals: form.vocals || "",
      projection: form.projection || "",
      sound: form.sound || "",
    },
    comments: form.comments || "",
    items: orderItems.map((item, index) => ({
      songVersionId: item.songVersionId,
      position: index + 1,
      comment: item.comment || "",
    })),
  };
}

function setlistItemsToOrder(items = []) {
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      localId: item.id || `${item.songVersionId}-${item.position}`,
      songVersionId: item.songVersionId,
      songTitle: item.songVersion?.song?.title || "Cancion",
      artist: item.songVersion?.song?.artist || "",
      versionName: item.songVersion?.name || `Tono ${item.songVersion?.key || ""}`,
      key: item.songVersion?.key || "",
      capo: item.songVersion?.capo || 0,
      lyrics: item.songVersion?.lyrics || "",
      rehearsalSpeed: Number(item.songVersion?.rehearsalSpeed || 0.75),
      comment: item.comment || "",
    }));
}

function versionOption(song, version) {
  return {
    localId: `${song.id}-${version.id}`,
    songVersionId: version.id,
    songTitle: song.title,
    artist: song.artist || "",
    versionName: version.name || `Tono ${version.key}`,
    key: version.key,
    capo: version.capo || 0,
    lyrics: version.lyrics || "",
    rehearsalSpeed: Number(version.rehearsalSpeed || 0.75),
    comment: "",
  };
}

function escapeExportHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function exportLyricsHtml(lyrics, withChords) {
  return String(lyrics || "").split("\n").map((line) => {
    const parsed = parseLyricLine(line);
    const text = escapeExportHtml(parsed.text || " ");
    if (!withChords) return `<div class="text-line">${text}</div>`;
    const chordLine = escapeExportHtml(buildChordLine(parsed.text, parsed.chords) || " ");
    return `<div class="lyric-line"><div class="chord-line">${chordLine}</div><div class="text-line">${text}</div></div>`;
  }).join("");
}

function safeExportName(value = "setlist") {
  return String(value || "setlist").replace(/[<>:"/\\|?*]+/g, "-").trim() || "setlist";
}

function buildSetlistDocument(form, orderItems, withChords) {
  const musicians = [
    ["Teclado", form.keyboard],
    ["Bateria", form.drums],
    ["1era. Guitarra", form.guitar1],
    ["2da. Guitarra", form.guitar2],
    ["Bajo", form.bass],
    ["Voces", form.vocals],
    ["Proyeccion", form.projection],
    ["Sonido", form.sound],
  ].filter(([, value]) => String(value || "").trim());

  const meeting = `
    <section class="meeting">
      <h1>${escapeExportHtml(form.name || "Setlist")}</h1>
      <p><strong>Fecha:</strong> ${escapeExportHtml(form.date)}</p>
      ${form.leader ? `<p><strong>Director:</strong> ${escapeExportHtml(form.leader)}</p>` : ""}
      ${musicians.length ? `<p><strong>Musicos:</strong> ${musicians.map(([role, name]) => `${escapeExportHtml(role)}: ${escapeExportHtml(name)}`).join(" | ")}</p>` : ""}
      ${form.comments ? `<p><strong>Comentarios:</strong> ${escapeExportHtml(form.comments)}</p>` : ""}
      <h2>Orden</h2>
      <ol>${orderItems.map((item) => `<li>${escapeExportHtml(item.songTitle)} - Tono ${escapeExportHtml(item.key)}${item.capo ? ` - Capo ${item.capo}` : ""}${item.comment ? ` - ${escapeExportHtml(item.comment)}` : ""}</li>`).join("")}</ol>
    </section>`;

  const songs = orderItems.map((item, index) => `
    <section class="song page-break">
      <h2>${index + 1}. ${escapeExportHtml(item.songTitle)}</h2>
      <p class="song-meta">${escapeExportHtml(item.artist || "Sin artista")} | Tono ${escapeExportHtml(item.key)}${item.capo ? ` | Capo ${item.capo}` : ""}</p>
      ${item.comment ? `<p class="comment"><strong>Comentario:</strong> ${escapeExportHtml(item.comment)}</p>` : ""}
      <div class="lyrics">${exportLyricsHtml(item.lyrics, withChords)}</div>
    </section>`).join("");

  return `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>${escapeExportHtml(form.name || "Setlist")}</title>
        <style>
          @page { margin: 18mm; }
          body { color: #172033; font-family: Arial, sans-serif; line-height: 1.35; }
          h1, h2, p { margin-top: 0; }
          .meeting { page-break-after: always; }
          .page-break { break-before: page; page-break-before: always; }
          .song-meta, .comment { color: #4b5563; }
          .lyrics { margin-top: 18px; font-family: Consolas, "Courier New", monospace; }
          .lyric-line { margin-bottom: 8px; break-inside: avoid; }
          .chord-line, .text-line { min-height: 1.2em; white-space: pre-wrap; }
          .chord-line { color: #2457a6; font-weight: 700; }
          .text-line { margin-bottom: 7px; }
        </style>
      </head>
      <body>${meeting}${songs}</body>
    </html>`;
}

function downloadSetlistWord(form, orderItems, withChords) {
  const html = buildSetlistDocument(form, orderItems, withChords);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeExportName(form.name)}-${form.date || "sin-fecha"}${withChords ? "-con-acordes" : "-sin-acordes"}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}

function printSetlistPdf(form, orderItems, withChords) {
  const printWindow = window.open("", "_blank", "width=1000,height=800");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(buildSetlistDocument(form, orderItems, withChords));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 300);
  return true;
}

function SetlistProjection({ form, items, chords, mode, onClose, onSpeedChange }) {
  const isRehearsal = mode === "rehearsal";
  const [index, setIndex] = useState(0);
  const [showTitle, setShowTitle] = useState(!isRehearsal);
  const [showChords, setShowChords] = useState(true);
  const [showDiagrams, setShowDiagrams] = useState(false);
  const [fontSize, setFontSize] = useState(23);
  const [scrollSpeed, setScrollSpeed] = useState(0.75);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const scrollTargetRef = useRef(null);
  const item = items[index];
  const usedChordDefinitions = useMemo(() => {
    const byName = chordLookupMap(chords.filter((chord) => chord.configured));
    return extractUniqueChords(item?.lyrics).map((name) => findChordDefinition(byName, name)).filter(Boolean);
  }, [chords, item?.lyrics]);

  useEffect(() => {
    setScrollSpeed(Number(item?.rehearsalSpeed || 0.75));
    setShowDiagrams(false);
  }, [item?.songVersionId, item?.rehearsalSpeed]);

  useEffect(() => {
    setIsPlaying(false);
    setHasStarted(false);
    window.requestAnimationFrame(() => {
      if (scrollTargetRef.current) scrollTargetRef.current.scrollTop = 0;
    });
  }, [index, showTitle]);

  useEffect(() => {
    if (!isPlaying || showTitle) return undefined;
    const target = scrollTargetRef.current;
    if (!target) return undefined;
    let wakeLock = null;
    let animationFrame = 0;
    let previousTime = 0;
    let pendingPixels = 0;
    const pixelsPerSecond = scrollSpeed <= 0.45
      ? 10
      : scrollSpeed <= 0.75
        ? 18
        : scrollSpeed <= 1.05
          ? 28
          : 42;
    navigator.wakeLock?.request?.("screen").then((lock) => {
      wakeLock = lock;
    }).catch(() => {});

    function advance(timestamp) {
      if (!previousTime) previousTime = timestamp;
      const elapsed = Math.min(timestamp - previousTime, 100);
      previousTime = timestamp;
      pendingPixels += (pixelsPerSecond * elapsed) / 1000;
      const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight);
      if (target.scrollTop >= maxScroll - 2) {
        setIsPlaying(false);
        return;
      }
      const wholePixels = Math.floor(pendingPixels);
      if (wholePixels > 0) {
        target.scrollTop = Math.min(maxScroll, target.scrollTop + wholePixels);
        pendingPixels -= wholePixels;
      }
      animationFrame = window.requestAnimationFrame(advance);
    }

    animationFrame = window.requestAnimationFrame(advance);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      wakeLock?.release?.().catch(() => {});
    };
  }, [isPlaying, scrollSpeed, showTitle]);

  function previous() {
    if (isRehearsal) {
      if (index > 0) setIndex((value) => value - 1);
      return;
    }
    if (!showTitle) {
      setShowTitle(true);
      return;
    }
    if (index > 0) {
      setIndex((value) => value - 1);
      setShowTitle(false);
    }
  }

  function next() {
    if (isRehearsal) {
      if (index < items.length - 1) setIndex((value) => value + 1);
      return;
    }
    if (showTitle) {
      setShowTitle(false);
      return;
    }
    if (index < items.length - 1) {
      setIndex((value) => value + 1);
      setShowTitle(true);
    }
  }

  async function toggleFullscreen() {
    const projection = document.querySelector(".setlist-projection");
    if (!document.fullscreenElement) await projection?.requestFullscreen?.();
    else await document.exitFullscreen?.();
  }

  function togglePlay() {
    setHasStarted(true);
    setIsPlaying((value) => !value);
  }

  function changeSpeed(value) {
    const speed = Number(value);
    setScrollSpeed(speed);
    onSpeedChange?.(item.songVersionId, speed);
  }

  if (!item) return null;

  return (
    <section className={`setlist-projection${isRehearsal ? " is-rehearsal" : ""}`} style={{ "--projection-font-size": `${fontSize}px` }}>
      <header className="setlist-projection-toolbar">
        <div>
          <strong>{form.name || "Setlist"}</strong>
          <span>{index + 1} de {items.length} - {isRehearsal ? "Ensayo" : showTitle ? "Presentacion" : "Cancion"}</span>
        </div>
        <div>
          {!showTitle ? (
            <>
              <button className="projection-play" onClick={togglePlay} type="button">{isPlaying ? "Pausa" : hasStarted ? "Reanudar" : "Play"}</button>
              <label className="projection-speed">
                <span>Velocidad</span>
                <select value={scrollSpeed} onChange={(event) => changeSpeed(event.target.value)}>
                  <option value="0.45">Muy lenta</option>
                  <option value="0.75">Lenta</option>
                  <option value="1.05">Normal</option>
                  <option value="1.45">Rapida</option>
                </select>
              </label>
              <button onClick={() => setShowChords((value) => !value)} type="button">{showChords ? "Ocultar acordes" : "Mostrar acordes"}</button>
              {isRehearsal ? <button onClick={() => setShowDiagrams((value) => !value)} type="button">{showDiagrams ? "Ocultar diagramas" : "Mostrar diagramas"}</button> : null}
            </>
          ) : null}
          <button onClick={() => setFontSize((value) => Math.max(12, value - 2))} type="button">A-</button>
          <button onClick={() => setFontSize((value) => Math.min(36, value + 2))} type="button">A+</button>
          <button onClick={toggleFullscreen} title="Pantalla completa" type="button"><Maximize size={18} /></button>
          <button onClick={onClose} title="Volver a Setlists" type="button"><X size={19} /></button>
        </div>
      </header>

      <main ref={scrollTargetRef} className={showTitle ? "setlist-title-slide" : "setlist-song-slide"}>
        {showTitle ? (
          <div>
            <span>Siguiente cancion</span>
            <strong>{item.songTitle}</strong>
            <p>{item.artist || "Sin artista"}</p>
            <small>Tono {item.key}{item.capo ? ` - Capo ${item.capo}` : ""}</small>
            {item.comment ? <blockquote>{item.comment}</blockquote> : null}
          </div>
        ) : (
          <>
            <header>
              <div>
                <h2>{item.songTitle}</h2>
                <p>{item.artist || "Sin artista"} - Tono {item.key}{item.capo ? ` - Capo ${item.capo}` : ""}</p>
              </div>
              {item.comment ? <span>{item.comment}</span> : null}
            </header>
            <div className={`setlist-projection-content${showDiagrams ? " has-diagrams" : ""}`}>
              <div className="setlist-projection-lyrics">
                <LyricsView lyrics={item.lyrics} showChords={showChords} />
              </div>
              {isRehearsal && showDiagrams ? (
                <aside className="setlist-rehearsal-diagrams">
                  <div className="chord-diagrams">
                    {usedChordDefinitions.map((chord) => (
                      <ChordDiagram
                        key={chord.id}
                        chord={chord.name}
                        capo={Number(item.capo || 0)}
                        frets={chord.frets}
                        barreFret={chord.barreFret}
                        barreFromString={chord.barreFromString}
                        barreToString={chord.barreToString}
                      />
                    ))}
                    {!usedChordDefinitions.length ? <p>No hay diagramas configurados para esta cancion.</p> : null}
                  </div>
                </aside>
              ) : null}
            </div>
          </>
        )}
      </main>

      <footer className="setlist-projection-navigation">
        <button onClick={previous} disabled={isRehearsal ? index === 0 : index === 0 && showTitle} type="button"><ChevronLeft size={20} /> Anterior</button>
        <button onClick={next} disabled={isRehearsal ? index === items.length - 1 : index === items.length - 1 && !showTitle} type="button">
          {isRehearsal ? "Siguiente" : showTitle ? "Ver cancion" : index < items.length - 1 ? "Siguiente" : "Finalizar"} <ChevronRight size={20} />
        </button>
      </footer>
    </section>
  );
}

function SetlistsView({ songs, setlists, chords, onReload, setGlobalError, initialMode = "create" }) {
  const isManageView = initialMode === "manage";
  const [mode, setMode] = useState(isManageView ? "search" : "create");
  const [setlistSongs, setSetlistSongs] = useState([]);
  const [dateSearch, setDateSearch] = useState(new Date().toISOString().slice(0, 10));
  const [matches, setMatches] = useState(setlists);
  const [selectedSetlistId, setSelectedSetlistId] = useState("");
  const [form, setForm] = useState(EMPTY_SETLIST);
  const [orderItems, setOrderItems] = useState([]);
  const [songQuery, setSongQuery] = useState("");
  const [selectedSongId, setSelectedSongId] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [songComment, setSongComment] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionMode, setSessionMode] = useState("");
  const songSource = setlistSongs.length ? setlistSongs : songs;

  useEffect(() => {
    setMatches(setlists);
  }, [setlists]);

  useEffect(() => {
    let active = true;
    async function loadSetlistSongs() {
      try {
        const data = await api("/songs");
        if (active) setSetlistSongs(data);
      } catch (error) {
        if (active) setGlobalError(error.message);
      }
    }
    loadSetlistSongs();
    return () => {
      active = false;
    };
  }, [setGlobalError]);

  useEffect(() => {
    function warnBeforeLeave(event) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [dirty]);

  const filteredSongs = useMemo(() => {
    const query = normalizeSearchText(songQuery);
    const candidates = [...songSource].sort((first, second) => first.title.localeCompare(second.title, "es", { sensitivity: "base" }));
    if (!query) return candidates.slice(0, 20);
    return candidates
      .filter((song) => {
        const versionText = song.versions?.map((version) => (
          `${version.name || ""} ${version.key || ""} ${version.capo ? `capo ${version.capo}` : ""} ${version.lyrics || ""}`
        )).join(" ");
        const haystack = normalizeSearchText(`${song.title} ${song.artist || ""} ${versionText || ""}`);
        return haystack.includes(query);
      })
      .slice(0, 30);
  }, [songSource, songQuery]);

  const selectedSong = useMemo(() => (
    filteredSongs.find((song) => song.id === selectedSongId) || filteredSongs[0] || null
  ), [filteredSongs, selectedSongId]);
  const selectedVersion = useMemo(() => {
    return selectedSong?.versions?.find((version) => version.id === selectedVersionId) || selectedSong?.versions?.[0] || null;
  }, [selectedSong, selectedVersionId]);

  useEffect(() => {
    if (!selectedSong?.versions?.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(selectedSong?.versions?.[0]?.id || "");
    }
  }, [selectedSong, selectedVersionId]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setDirty(true);
  }

  function resetCreate() {
    setMode("create");
    setSelectedSetlistId("");
    setForm({ ...EMPTY_SETLIST, date: new Date().toISOString().slice(0, 10) });
    setOrderItems([]);
    setSongQuery("");
    setSongComment("");
    setMessage("");
    setDirty(false);
  }

  function resetManage() {
    setMode("search");
    setSelectedSetlistId("");
    setForm({ ...EMPTY_SETLIST, date: new Date().toISOString().slice(0, 10) });
    setOrderItems([]);
    setSongQuery("");
    setSongComment("");
    setMessage("");
    setDirty(false);
  }

  async function fetchSetlistsFromDate() {
    setGlobalError("");
    try {
      const data = await api(`/setlists${dateSearch ? `?from=${encodeURIComponent(dateSearch)}` : ""}`);
      setMatches(data);
      return data;
    } catch (error) {
      setGlobalError(error.message);
      return null;
    }
  }

  async function searchSetlists() {
    const data = await fetchSetlistsFromDate();
    if (data) {
      setMode("search");
      setMessage(data.length ? `${data.length} setlist(s) encontrada(s).` : "No se encontraron setlists.");
    }
  }

  function loadSetlist(setlist) {
    if (dirty && !window.confirm("Hay cambios sin guardar. Continuar de todos modos?")) return;
    setMode("edit");
    setSelectedSetlistId(setlist.id);
    setForm(setlistToForm(setlist));
    setOrderItems(setlistItemsToOrder(setlist.items));
    setMessage("");
    setDirty(false);
  }

  function addSongToOrder() {
    if (!selectedSong || !selectedVersion) return;
    const item = versionOption(selectedSong, selectedVersion);
    setOrderItems((current) => [...current, { ...item, localId: `${item.localId}-${Date.now()}`, comment: songComment }]);
    setSongComment("");
    setDirty(true);
  }

  function removeOrderItem(localId) {
    setOrderItems((current) => current.filter((item) => item.localId !== localId));
    setDirty(true);
  }

  function moveOrderItem(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= orderItems.length) return;
    setOrderItems((current) => {
      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
    setDirty(true);
  }

  function updateItemComment(localId, comment) {
    setOrderItems((current) => current.map((item) => item.localId === localId ? { ...item, comment } : item));
    setDirty(true);
  }

  async function saveSetlist() {
    if (!form.date) {
      setGlobalError("La fecha de reunion es obligatoria.");
      return;
    }
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      const payload = setlistPayload(form, orderItems);
      const saved = selectedSetlistId
        ? await api(`/setlists/${selectedSetlistId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await api("/setlists", { method: "POST", body: JSON.stringify(payload) });
      setSelectedSetlistId(saved.id);
      setMode("edit");
      setMessage("Setlist guardada.");
      setDirty(false);
      await onReload();
      await fetchSetlistsFromDate();
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSetlist(setlistId) {
    if (!setlistId) return;
    if (!window.confirm("Eliminar esta setlist guardada?")) return;
    setSaving(true);
    setGlobalError("");
    try {
      await api(`/setlists/${setlistId}`, { method: "DELETE" });
      setMessage("Setlist eliminada.");
      if (selectedSetlistId === setlistId) {
        if (isManageView) resetManage();
        else resetCreate();
      }
      await onReload();
      await fetchSetlistsFromDate();
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function openPdf(withChords) {
    if (!orderItems.length) {
      setGlobalError("Agrega al menos una cancion al orden para generar el PDF.");
      return;
    }
    if (!printSetlistPdf(form, orderItems, withChords)) {
      setGlobalError("El navegador bloqueo la ventana del PDF. Habilita las ventanas emergentes para CantusDei.");
    }
  }

  function downloadWord(withChords) {
    if (!orderItems.length) {
      setGlobalError("Agrega al menos una cancion al orden para generar el Word.");
      return;
    }
    downloadSetlistWord(form, orderItems, withChords);
  }

  async function saveRehearsalSpeed(songVersionId, speed) {
    setOrderItems((current) => current.map((item) => (
      item.songVersionId === songVersionId ? { ...item, rehearsalSpeed: speed } : item
    )));
    try {
      await api(`/songs/versions/${songVersionId}`, {
        method: "PUT",
        body: JSON.stringify({ rehearsalSpeed: speed }),
      });
    } catch (error) {
      setGlobalError(`No se pudo guardar la velocidad: ${error.message}`);
    }
  }

  const selectedPreview = selectedVersion ? versionOption(selectedSong, selectedVersion) : null;

  if (sessionMode) {
    return (
      <SetlistProjection
        form={form}
        items={orderItems}
        chords={chords}
        mode={sessionMode}
        onClose={() => setSessionMode("")}
        onSpeedChange={saveRehearsalSpeed}
      />
    );
  }

  return (
    <section className="work-area setlist-shell">
      <div className="panel-heading setlist-heading">
        <h2>{isManageView ? "Consulta / Editar SetList" : "Crear SetList"}</h2>
      </div>

      <div className={`setlist-layout${isManageView ? "" : " is-create-only"}`}>
        {isManageView ? <aside className="setlist-search-panel">
          <section className="form-card">
            <header className="form-card-heading">
              <div>
                <span>Buscar guardadas</span>
                <h3>Desde una fecha</h3>
              </div>
            </header>
            <Field label="Desde">
              <input type="date" value={dateSearch} onChange={(event) => setDateSearch(event.target.value)} />
            </Field>
            <button className="primary-action" onClick={searchSetlists} disabled={saving} type="button"><Search size={16} /> Buscar</button>
            <div className="saved-setlists-list">
              {matches.map((setlist) => (
                <article key={setlist.id} className={selectedSetlistId === setlist.id ? "is-active" : ""}>
                  <button onClick={() => loadSetlist(setlist)} type="button">
                    <strong>{setlist.name}</strong>
                    <span>{setlistDate(setlist.date)} - {setlist.items?.length || 0} canciones</span>
                  </button>
                  <button className="icon-danger" onClick={() => deleteSetlist(setlist.id)} title="Eliminar setlist" type="button"><Trash2 size={15} /></button>
                </article>
              ))}
              {!matches.length ? <p className="empty-message">Busca una fecha para ver las listas guardadas.</p> : null}
            </div>
          </section>
        </aside> : null}

        {!isManageView || mode === "edit" ? <div className="setlist-main">
          <section className="form-card">
            <header className="form-card-heading">
              <div>
                <span>{mode === "edit" ? "Editar reunion" : "Crear reunion"}</span>
                <h3>{form.name || "Domingo"} - {form.date}</h3>
              </div>
            </header>

            <div className="form-grid setlist-form-grid">
              <Field label="Fecha reunion">
                <input type="date" value={form.date} onChange={(event) => updateForm("date", event.target.value)} />
              </Field>
              <Field label="Nombre">
                <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
              </Field>
              <Field label="Director">
                <input value={form.leader} onChange={(event) => updateForm("leader", event.target.value)} />
              </Field>
              <Field label="Teclado">
                <input value={form.keyboard} onChange={(event) => updateForm("keyboard", event.target.value)} />
              </Field>
              <Field label="Bateria">
                <input value={form.drums} onChange={(event) => updateForm("drums", event.target.value)} />
              </Field>
              <Field label="1era. Guitarra">
                <input value={form.guitar1} onChange={(event) => updateForm("guitar1", event.target.value)} />
              </Field>
              <Field label="2da. Guitarra">
                <input value={form.guitar2} onChange={(event) => updateForm("guitar2", event.target.value)} />
              </Field>
              <Field label="Bajo">
                <input value={form.bass} onChange={(event) => updateForm("bass", event.target.value)} />
              </Field>
              <Field label="Voces">
                <input value={form.vocals} onChange={(event) => updateForm("vocals", event.target.value)} />
              </Field>
              <Field label="Proyeccion">
                <input value={form.projection} onChange={(event) => updateForm("projection", event.target.value)} />
              </Field>
              <Field label="Sonido">
                <input value={form.sound} onChange={(event) => updateForm("sound", event.target.value)} />
              </Field>
              <Field label="Comentarios">
                <textarea value={form.comments} onChange={(event) => updateForm("comments", event.target.value)} rows="2" />
              </Field>
            </div>
          </section>

          <section className="form-card">
            <header className="form-card-heading">
              <div>
                <span>Agregar canciones</span>
                <h3>Buscar por nombre o letra</h3>
              </div>
            </header>

            <div className="setlist-add-grid">
              <div className="song-picker">
                <label className="search-field">
                  <Search size={16} />
                  <input value={songQuery} onChange={(event) => setSongQuery(event.target.value)} placeholder="Buscar cancion por nombre o contenido" />
                </label>
                <div className="picker-results">
                  {filteredSongs.map((song) => (
                    <article key={song.id} className={selectedSong?.id === song.id ? "is-active" : ""}>
                      <button onClick={() => setSelectedSongId(song.id)} type="button">
                        <strong>{song.title}</strong>
                        <span>{song.artist || "Sin artista"}</span>
                      </button>
                      {selectedSong?.id === song.id ? (
                        <div className="version-strip compact">
                          {song.versions.map((version) => (
                            <VersionButton
                              key={version.id}
                              version={version}
                              active={selectedVersion?.id === version.id}
                              onClick={() => setSelectedVersionId(version.id)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
                <Field label="Comentario de la cancion">
                  <textarea value={songComment} onChange={(event) => setSongComment(event.target.value)} rows="2" />
                </Field>
              </div>

              <aside className="setlist-preview">
                {selectedPreview ? (
                  <>
                    <header>
                      <strong>{selectedPreview.songTitle}</strong>
                      <span>Tono {selectedPreview.key}{selectedPreview.capo ? ` - Capo ${selectedPreview.capo}` : ""}</span>
                    </header>
                    <LyricsView lyrics={selectedPreview.lyrics.split("\n").slice(0, 8).join("\n")} showChords />
                    <button className="secondary-action setlist-preview-add" onClick={addSongToOrder} type="button">
                      <ListPlus size={16} /> Agregar a orden
                    </button>
                  </>
                ) : (
                  <p className="empty-message">Selecciona una version para previsualizar sus acordes.</p>
                )}
              </aside>
            </div>
          </section>

          <section className="form-card">
            <header className="form-card-heading">
              <div>
                <span>Orden</span>
                <h3>{orderItems.length} cancion(es)</h3>
              </div>
            </header>
            <div className="order-list">
              {orderItems.map((item, index) => (
                <article key={item.localId} className="order-item">
                  <div className="order-position">{index + 1}</div>
                  <div className="order-song">
                    <strong>{item.songTitle}</strong>
                    <span>{item.artist || "Sin artista"} - Tono {item.key}{item.capo ? ` - Capo ${item.capo}` : ""}</span>
                    <input value={item.comment} onChange={(event) => updateItemComment(item.localId, event.target.value)} placeholder="Comentario para esta cancion" />
                  </div>
                  <div className="order-actions">
                    <button onClick={() => moveOrderItem(index, -1)} disabled={index === 0} type="button"><ArrowUp size={15} /></button>
                    <button onClick={() => moveOrderItem(index, 1)} disabled={index === orderItems.length - 1} type="button"><ArrowDown size={15} /></button>
                    <button className="icon-danger" onClick={() => removeOrderItem(item.localId)} type="button"><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}
              {!orderItems.length ? <p className="empty-message">Agrega canciones para armar el orden de la reunion.</p> : null}
            </div>
            <footer className="setlist-order-actions">
              <button className="projection-action" onClick={() => setSessionMode("projection")} disabled={!orderItems.length} type="button">
                <Monitor size={17} /> Modo Proyeccion
              </button>
              <button className="rehearsal-action" onClick={() => setSessionMode("rehearsal")} disabled={!orderItems.length} type="button">
                <Guitar size={17} /> Modo Ensayo
              </button>
              <div className="setlist-export-group">
                <span>Word</span>
                <button onClick={() => downloadWord(false)} disabled={!orderItems.length} type="button"><FileText size={16} /> Sin acordes</button>
                <button onClick={() => downloadWord(true)} disabled={!orderItems.length} type="button"><FileText size={16} /> Con acordes</button>
              </div>
              <div className="setlist-export-group">
                <span>PDF</span>
                <button onClick={() => openPdf(false)} disabled={!orderItems.length} type="button"><FileText size={16} /> Sin acordes</button>
                <button onClick={() => openPdf(true)} disabled={!orderItems.length} type="button"><FileText size={16} /> Con acordes</button>
              </div>
            </footer>
          </section>

          <footer className="setlist-final-save">
            <div>
              <strong>{selectedSetlistId ? "Guardar SetList" : "Crear SetList"}</strong>
              <span>Guarda los datos de la reunion y el orden de canciones seleccionado.</span>
            </div>
            <button className="primary-action" onClick={saveSetlist} disabled={saving} type="button">
              <Save size={16} /> {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </footer>

          {message ? <p className="success-box">{message}{dirty ? " Hay cambios sin guardar." : ""}</p> : dirty ? <p className="warning-box">Hay cambios sin guardar.</p> : null}
        </div> : (
          <section className="form-card setlist-manage-empty">
            <CalendarDays size={30} />
            <h3>Busca una SetList guardada</h3>
            <p>Selecciona una reunion del listado para consultar o editar sus datos, canciones y orden.</p>
          </section>
        )}
      </div>
    </section>
  );
}

const EMPTY_TUTORIAL = {
  id: "",
  title: "",
  body: "",
  category: "TUTORIAL",
  position: 0,
  fileName: "",
  fileMimeType: "",
  fileData: "",
  removeFile: false,
};

const RESOURCE_CATEGORIES = {
  TUTORIAL: "Tutorial",
  DEVOCIONAL: "Devocional",
  ESTUDIO_BIBLICO: "Estudio biblico",
  DOCUMENTO: "Documento",
  OTRO: "Otro",
};

function TutorialView({ tutorials, isAdmin, onReload, setGlobalError }) {
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(EMPTY_TUTORIAL);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedTutorial = tutorials.find((tutorial) => tutorial.id === selectedId) || (isAdmin ? null : tutorials[0]) || null;

  useEffect(() => {
    if (isAdmin && !selectedId) return;
    if (!selectedTutorial) {
      setForm(EMPTY_TUTORIAL);
      return;
    }
    if (!form.id || form.id !== selectedTutorial.id) {
      setForm({
        id: selectedTutorial.id,
        title: selectedTutorial.title || "",
        body: selectedTutorial.body || "",
        category: selectedTutorial.category || "TUTORIAL",
        position: selectedTutorial.position || 0,
        fileName: selectedTutorial.fileName || "",
        fileMimeType: selectedTutorial.fileMimeType || "",
        fileData: "",
        removeFile: false,
      });
      setSelectedId(selectedTutorial.id);
    }
  }, [selectedTutorial, form.id]);

  function startNewTutorial() {
    setSelectedId("");
    setForm({ ...EMPTY_TUTORIAL, position: tutorials.length + 1 });
    setMessage("");
  }

  function selectPdf(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setGlobalError("El archivo debe estar en formato PDF.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setGlobalError("El PDF no puede superar los 10 MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const encoded = String(reader.result || "").split(",")[1] || "";
      setForm((current) => ({
        ...current,
        fileName: file.name,
        fileMimeType: file.type,
        fileData: encoded,
        removeFile: false,
      }));
      setGlobalError("");
    };
    reader.readAsDataURL(file);
  }

  async function saveTutorial() {
    if (!form.title.trim() || (!form.body.trim() && !form.fileName)) {
      setGlobalError("El titulo es obligatorio. Agrega contenido o adjunta un PDF.");
      return;
    }
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        position: Number(form.position || 0),
      };
      if (form.fileData) {
        payload.fileName = form.fileName;
        payload.fileMimeType = form.fileMimeType;
        payload.fileData = form.fileData;
      } else if (form.removeFile) {
        payload.fileName = null;
        payload.fileMimeType = null;
        payload.fileData = null;
      }
      const saved = form.id
        ? await api(`/tutorials/${form.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await api("/tutorials", { method: "POST", body: JSON.stringify(payload) });
      setSelectedId(saved.id);
      setMessage("Recurso guardado.");
      await onReload();
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTutorial() {
    if (!form.id || !window.confirm("Eliminar este recurso?")) return;
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      await api(`/tutorials/${form.id}`, { method: "DELETE" });
      setSelectedId("");
      setForm(EMPTY_TUTORIAL);
      setMessage("Recurso eliminado.");
      await onReload();
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="work-area tutorial-shell">
      <div className="panel-heading">
        <div>
          <span>Biblioteca</span>
          <h2>Recursos</h2>
        </div>
        {isAdmin ? <button className="primary-action" onClick={startNewTutorial} type="button"><Plus size={16} /> Nuevo recurso</button> : null}
      </div>

      <div className="tutorial-layout">
        <aside className="tutorial-list">
          {tutorials.map((tutorial) => (
            <button key={tutorial.id} className={selectedId === tutorial.id ? "is-active" : ""} onClick={() => setSelectedId(tutorial.id)} type="button">
              <strong>{tutorial.title}</strong>
              <span>{RESOURCE_CATEGORIES[tutorial.category] || "Recurso"}</span>
            </button>
          ))}
          {!tutorials.length ? <p className="empty-message">Todavia no hay recursos cargados.</p> : null}
        </aside>

        <article className="tutorial-reader">
          {isAdmin ? (
            <section className="form-card">
              <header className="form-card-heading">
                <div>
                  <span>{form.id ? "Editar recurso" : "Crear recurso"}</span>
                  <h3>{form.title || "Nuevo recurso"}</h3>
                </div>
                {form.id ? <button className="danger-action" onClick={deleteTutorial} disabled={saving} type="button"><Trash2 size={16} /> Eliminar</button> : null}
              </header>
              <div className="form-grid tutorial-form-grid">
                <Field label="Titulo">
                  <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
                </Field>
                <Field label="Tipo de recurso">
                  <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                    {Object.entries(RESOURCE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Orden">
                  <input type="number" value={form.position} onChange={(event) => setForm((current) => ({ ...current, position: event.target.value }))} />
                </Field>
              </div>
              <Field label="Contenido o descripcion">
                <textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} rows="12" />
              </Field>
              <Field label="Documento PDF (opcional)">
                <input type="file" accept="application/pdf,.pdf" onChange={selectPdf} />
              </Field>
              {form.fileName && !form.removeFile ? (
                <div className="resource-file-row">
                  <span><FileText size={17} /> {form.fileName}</span>
                  <button className="secondary-action" type="button" onClick={() => setForm((current) => ({ ...current, fileName: "", fileMimeType: "", fileData: "", removeFile: true }))}>Quitar PDF</button>
                </div>
              ) : null}
              <div className="form-actions">
                <button className="primary-action" onClick={saveTutorial} disabled={saving} type="button"><Save size={16} /> Guardar recurso</button>
              </div>
              {message ? <p className="success-box">{message}</p> : null}
            </section>
          ) : null}

          <section className="tutorial-content">
            <span>{RESOURCE_CATEGORIES[form.category || selectedTutorial?.category] || "Vista de lectura"}</span>
            <h3>{form.title || selectedTutorial?.title || "Selecciona un recurso"}</h3>
            <div>
              {(form.body || selectedTutorial?.body || "").split("\n").map((line, index) => (
                <p key={index}>{line || " "}</p>
              ))}
            </div>
            {(form.id || selectedTutorial?.id) && (form.fileName || selectedTutorial?.fileName) && !form.removeFile ? (
              <a className="primary-action resource-open-file" href={`${API_URL}/tutorials/${form.id || selectedTutorial.id}/file`} target="_blank" rel="noreferrer">
                <FileText size={17} /> Abrir PDF
              </a>
            ) : null}
          </section>
        </article>
      </div>
    </section>
  );
}

const CHORD_FAMILIES = [
  { root: "C", label: "DO" },
  { root: "D", label: "RE" },
  { root: "E", label: "MI" },
  { root: "F", label: "FA" },
  { root: "G", label: "SOL" },
  { root: "A", label: "LA" },
  { root: "B", label: "SI" },
];

const CHORD_FAMILY_ROOTS = CHORD_FAMILIES.map((family) => family.root);

function chordFamilyRoot(rootOrName = "") {
  const match = String(rootOrName).trim().match(/^([A-G])/i);
  return match ? match[1].toUpperCase() : "C";
}

const CHORD_TONE_ORDER = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

function chordToneParts(chord = {}) {
  const name = String(chord.name || chord.root || "");
  const match = name.match(/^([A-G](?:#|b)?)([^/]*)?(?:\/(.*))?$/);
  return {
    tone: CHORD_TONE_ORDER[match?.[1]] ?? 99,
    suffix: match?.[2] || "",
    bass: match?.[3] || "",
    name,
  };
}

function compareChordsByTone(first, second) {
  const a = chordToneParts(first);
  const b = chordToneParts(second);
  return a.tone - b.tone
    || a.suffix.localeCompare(b.suffix, "es", { sensitivity: "base" })
    || a.bass.localeCompare(b.bass, "es", { sensitivity: "base" })
    || a.name.localeCompare(b.name, "es", { sensitivity: "base" });
}

const EMPTY_CHORD_FORM = {
  id: "",
  variantId: "",
  name: "",
  variantName: "Principal",
  root: "C",
  frets: ["", "", "", "", "", ""],
  capo: 0,
  barreFret: "",
  barreFromString: 6,
  barreToString: 1,
  difficulty: 1,
  validated: false,
  isDefault: true,
};

function defaultChordVariant(chord) {
  const variants = Array.isArray(chord?.variants) ? chord.variants : [];
  return variants.find((variant) => variant.isDefault) || variants[0] || null;
}

function chordToForm(chord, root = "C", variant = null) {
  const selectedVariant = variant || defaultChordVariant(chord);
  return {
    id: chord?.id || "",
    variantId: selectedVariant?.id || chord?.defaultVariantId || "",
    name: chord?.name || "",
    variantName: selectedVariant?.name || "Principal",
    root: chord?.root || root,
    frets: Array.isArray(selectedVariant?.frets || chord?.frets) ? (selectedVariant?.frets || chord.frets).map((fret) => fret ?? "") : ["", "", "", "", "", ""],
    capo: Number(selectedVariant?.capo ?? chord?.capo ?? 0),
    barreFret: selectedVariant?.barreFret || chord?.barreFret ? Number(selectedVariant?.barreFret || chord.barreFret) : "",
    barreFromString: Number(selectedVariant?.barreFromString || chord?.barreFromString || 6),
    barreToString: Number(selectedVariant?.barreToString || chord?.barreToString || 1),
    difficulty: Number(selectedVariant?.difficulty || chord?.difficulty || 1),
    validated: Boolean(selectedVariant?.validated || chord?.validated),
    isDefault: Boolean(selectedVariant?.isDefault || !selectedVariant),
  };
}

function chordFormPayload(form) {
  return {
    name: form.name.trim(),
    variantName: form.variantName.trim() || "Principal",
    frets: form.frets.map((fret) => {
      const value = String(fret).trim();
      return value === "" || value.toLowerCase() === "x" ? null : Number(value);
    }),
    capo: Number(form.capo || 0),
    barreFret: form.barreFret ? Number(form.barreFret) : null,
    barreFromString: form.barreFret ? Number(form.barreFromString) : null,
    barreToString: form.barreFret ? Number(form.barreToString) : null,
    difficulty: Number(form.difficulty || 1),
    validated: Boolean(form.validated),
    isDefault: Boolean(form.isDefault),
  };
}

function ChordsView({ chords, families = CHORD_FAMILIES, usage, onReload, setGlobalError, isAdmin, mode = "edit", initialChordName = "", returnAction = null }) {
  const isCreateMode = mode === "create";
  const availableFamilies = useMemo(() => [...families].sort((first, second) => (
    CHORD_FAMILY_ROOTS.indexOf(first.root) - CHORD_FAMILY_ROOTS.indexOf(second.root)
  )), [families]);
  const [selectedRoot, setSelectedRoot] = useState(availableFamilies[0]?.root || "");
  const [capoFilter, setCapoFilter] = useState("");
  const [chordSearch, setChordSearch] = useState("");
  const [form, setForm] = useState(() => chordToForm(null, "C"));
  const [showChordCreator, setShowChordCreator] = useState(false);
  const [showFamilyCreator, setShowFamilyCreator] = useState(false);
  const [familyForm, setFamilyForm] = useState({ root: "", label: "" });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const usageByChordId = useMemo(() => new Map(usage.map((item) => [item.chord?.id, item])), [usage]);
  const selectedFamily = availableFamilies.find((family) => family.root === selectedRoot) || availableFamilies[0] || null;
  const missingFamilyRoots = CHORD_FAMILY_ROOTS.filter((root) => !availableFamilies.some((family) => family.root === root));

  useEffect(() => {
    if (!availableFamilies.some((family) => family.root === selectedRoot) && availableFamilies[0]) {
      setSelectedRoot(availableFamilies[0].root);
    }
  }, [availableFamilies, selectedRoot]);

  const familyChords = useMemo(() => {
    return chords
      .filter((chord) => chordFamilyRoot(chord.root || chord.name) === selectedRoot)
      .filter((chord) => capoFilter === "" ? true : Number(chord.capo || 0) === Number(capoFilter))
      .sort(compareChordsByTone);
  }, [chords, selectedRoot, capoFilter]);

  const searchedChords = useMemo(() => {
    const query = chordSearch.trim().toLocaleLowerCase("es");
    if (!query) return [];
    return chords
      .filter((chord) => chord.name.toLocaleLowerCase("es").includes(query))
      .sort(compareChordsByTone)
      .slice(0, 30);
  }, [chords, chordSearch]);

  const exactSearchedChord = useMemo(() => {
    const query = chordSearch.trim();
    if (!query) return null;
    return chords.find((chord) => chord.name.localeCompare(query, "es", { sensitivity: "base" }) === 0) || null;
  }, [chords, chordSearch]);
  const selectedChord = useMemo(() => chords.find((chord) => chord.id === form.id) || null, [chords, form.id]);
  const selectedChordVariants = useMemo(() => (
    Array.isArray(selectedChord?.variants) ? selectedChord.variants.slice().sort((first, second) => (
      Number(Boolean(second.validated)) - Number(Boolean(first.validated))
      || Number(Boolean(second.isDefault)) - Number(Boolean(first.isDefault))
      || String(first.name || "").localeCompare(String(second.name || ""), "es", { sensitivity: "base" })
    )) : []
  ), [selectedChord]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateFret(index, value) {
    setForm((current) => ({
      ...current,
      frets: current.frets.map((fret, fretIndex) => fretIndex === index ? value : fret),
    }));
  }

  function startNewChord(root = selectedRoot) {
    setForm({ ...EMPTY_CHORD_FORM, root, name: "" });
    setShowChordCreator(true);
    setMessage("");
  }

  function editChord(chord) {
    if (isCreateMode) return;
    setSelectedRoot(chordFamilyRoot(chord.root || chord.name));
    setForm(chordToForm(chord, selectedRoot));
    setShowChordCreator(false);
    setMessage("");
  }

  function editVariant(chord, variant) {
    if (isCreateMode) return;
    setSelectedRoot(chordFamilyRoot(chord.root || chord.name));
    setForm(chordToForm(chord, selectedRoot, variant));
    setShowChordCreator(false);
    setMessage("");
  }

  function startNewVariant() {
    if (!selectedChord) return;
    setForm({
      ...chordToForm(selectedChord, selectedRoot),
      variantId: "",
      variantName: `Variante ${selectedChordVariants.length + 1}`,
      validated: false,
      isDefault: false,
    });
    setMessage("");
  }

  function selectFamily(root) {
    setSelectedRoot(root);
    setForm(chordToForm(null, root));
    setShowChordCreator(false);
    setMessage("");
  }

  function updateFamilyRoot(root) {
    const family = CHORD_FAMILIES.find((item) => item.root === root);
    setFamilyForm({ root, label: family?.label || root });
  }

  async function saveFamily() {
    if (!familyForm.root || !familyForm.label.trim()) {
      setGlobalError("Selecciona la nota y escribe el nombre de la familia.");
      return;
    }
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      const family = await api("/chords/families", {
        method: "POST",
        body: JSON.stringify({ root: familyForm.root, label: familyForm.label.trim() }),
      });
      await onReload();
      setSelectedRoot(family.root);
      setShowFamilyCreator(false);
      setFamilyForm({ root: "", label: "" });
      setMessage(`Familia ${family.label} creada.`);
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function createSearchedChord() {
    const name = chordSearch.trim();
    if (!name) return;
    const root = chordFamilyRoot(name);
    setSelectedRoot(root);
    setForm({ ...EMPTY_CHORD_FORM, root, name });
    setShowChordCreator(true);
    setMessage("");
    setGlobalError("");
  }

  useEffect(() => {
    const name = String(initialChordName || "").trim();
    if (!name) return;
    const existingChord = chords.find((chord) => chord.name.localeCompare(name, "es", { sensitivity: "base" }) === 0);
    setChordSearch(name);
    if (existingChord) {
      editChord(existingChord);
      return;
    }
    const root = chordFamilyRoot(name);
    setSelectedRoot(root);
    setForm({ ...EMPTY_CHORD_FORM, root, name });
    setShowChordCreator(true);
    setMessage("");
    setGlobalError("");
  }, [initialChordName, chords]);

  async function saveChord() {
    if (!form.name.trim()) {
      setGlobalError("El nombre del acorde es obligatorio.");
      return;
    }
    if (isCreateMode && chordFamilyRoot(form.name) !== selectedRoot) {
      setGlobalError(`El acorde debe pertenecer a la familia ${selectedFamily?.label || selectedRoot}.`);
      return;
    }
    const duplicate = !form.id ? chords.find((chord) => (
      chord.name.localeCompare(form.name.trim(), "es", { sensitivity: "base" }) === 0
    )) : null;
    if (duplicate) {
      setGlobalError(`Ya existe el acorde ${duplicate.name}. Seleccionalo en la familia ${chordFamilyRoot(duplicate.root || duplicate.name)} para editarlo.`);
      return;
    }
    const invalidFret = form.frets.find((fret) => {
      const value = String(fret).trim().toLowerCase();
      return value !== "" && value !== "x" && (!/^\d+$/.test(value) || Number(value) > 24);
    });
    if (invalidFret !== undefined) {
      setGlobalError("Cada cuerda debe contener x, quedar vacia o indicar un traste entre 0 y 24.");
      return;
    }
    if (form.barreFret && Number(form.barreFromString) === Number(form.barreToString)) {
      setGlobalError("La cejilla debe cubrir al menos dos cuerdas.");
      return;
    }
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      const payload = chordFormPayload(form);
      const saved = form.id && !form.variantId
        ? await api(`/chords/${form.id}/variants`, { method: "POST", body: JSON.stringify(payload) })
        : form.id
        ? await api(`/chords/${form.id}`, { method: "PUT", body: JSON.stringify(payload) })
        : await api("/chords", { method: "POST", body: JSON.stringify(payload) });
      const refreshedChords = await api("/chords");
      const refreshedChord = refreshedChords.find((chord) => chord.id === (form.id || saved.id || saved.chordId));
      const savedFamily = chordFamilyRoot(refreshedChord?.root || refreshedChord?.name || form.name);
      setSelectedRoot(savedFamily);
      setForm(chordToForm(refreshedChord || saved, savedFamily, refreshedChord?.variants?.find((variant) => variant.id === (saved.id || form.variantId))));
      if (isCreateMode) setShowChordCreator(false);
      setMessage(form.variantId || !form.id ? "Acorde guardado." : "Variante creada.");
      await onReload();
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteChord() {
    if (!form.id) return;
    if (!window.confirm(`Eliminar el acorde ${form.name}?`)) return;
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      await api(`/chords/${form.id}`, { method: "DELETE" });
      setMessage("Acorde eliminado.");
      startNewChord(selectedRoot);
      await onReload();
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteVariant() {
    if (!form.id || !form.variantId) return;
    if (selectedChordVariants.length <= 1) {
      setGlobalError("El acorde debe conservar al menos una variante.");
      return;
    }
    if (!window.confirm(`Eliminar la variante ${form.variantName}?`)) return;
    setSaving(true);
    setGlobalError("");
    setMessage("");
    try {
      await api(`/chords/${form.id}/variants/${form.variantId}`, { method: "DELETE" });
      setMessage("Variante eliminada.");
      await onReload();
      const refreshedChords = await api("/chords");
      const refreshedChord = refreshedChords.find((chord) => chord.id === form.id);
      setForm(chordToForm(refreshedChord, selectedRoot));
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="work-area chords-shell">
      <div className="panel-heading chords-heading">
        <h2>{isCreateMode ? "Crear acorde" : isAdmin ? "Editar acordes" : "Acordes"}</h2>
        <div className="heading-actions">
          {returnAction ? (
            <button className="secondary-action" onClick={returnAction.onReturn} type="button">
              <ChevronLeft size={16} /> {returnAction.label || "Volver a la cancion"}
            </button>
          ) : null}
          {!isCreateMode ? <label className="search-field chord-search-field">
            <Search size={17} />
            <input
              value={chordSearch}
              onChange={(event) => setChordSearch(event.target.value)}
              placeholder="Buscar acorde: A#, Bb, C#m7"
            />
          </label> : null}
          <label className="chord-capo-filter">
            <span>Capotraste</span>
            <select value={capoFilter} onChange={(event) => setCapoFilter(event.target.value)}>
              <option value="">Todos</option>
              {Array.from({ length: 13 }, (_, index) => (
                <option key={index} value={index}>{index === 0 ? "Sin capo" : `Capo ${index}`}</option>
              ))}
            </select>
          </label>
          {isCreateMode && isAdmin ? (
            <button
              className="secondary-action"
              disabled={!missingFamilyRoots.length}
              onClick={() => {
                const root = missingFamilyRoots[0] || "";
                updateFamilyRoot(root);
                setShowFamilyCreator(true);
              }}
              type="button"
            >
              <Plus size={16} /> {missingFamilyRoots.length ? "Nueva familia" : "Familias completas"}
            </button>
          ) : null}
        </div>
      </div>

      {isCreateMode && showFamilyCreator ? (
        <section className="form-card chord-family-creator">
          <header className="form-card-heading">
            <div>
              <span>Nueva familia</span>
              <h3>Crear una familia de acordes</h3>
            </div>
          </header>
          <div className="form-grid">
            <Field label="Nota base">
              <select value={familyForm.root} onChange={(event) => updateFamilyRoot(event.target.value)}>
                <option value="" disabled>Seleccionar</option>
                {missingFamilyRoots.map((root) => <option key={root} value={root}>{root}</option>)}
              </select>
            </Field>
            <Field label="Nombre visible">
              <input value={familyForm.label} onChange={(event) => setFamilyForm((current) => ({ ...current, label: event.target.value }))} placeholder="Ej: DO" />
            </Field>
          </div>
          <div className="form-actions">
            <button className="primary-action" onClick={saveFamily} disabled={saving} type="button"><Save size={16} /> Guardar familia</button>
            <button className="secondary-action" onClick={() => setShowFamilyCreator(false)} type="button">Cancelar</button>
          </div>
        </section>
      ) : null}

      {!isCreateMode ? <section className="chord-finder" aria-label="Buscador de acordes">
        {chordSearch.trim() ? (
          <div className="chord-search-results">
            {searchedChords.map((chord) => (
              <button
                key={chord.id}
                className={form.id === chord.id ? "is-active" : ""}
                onClick={() => editChord(chord)}
                type="button"
              >
                <strong>{chord.name}</strong>
                <span>{chord.configured ? "Configurado" : "Sin configurar"}</span>
                {isAdmin && !chord.configured ? <small>Configurar</small> : null}
              </button>
            ))}
            {!searchedChords.length ? <span className="empty-message">No se encontro ese acorde.</span> : null}
            {false && isAdmin && !exactSearchedChord ? (
              <button className="create-chord-result" onClick={createSearchedChord} type="button">
                <Plus size={16} />
                Crear "{chordSearch.trim()}"
              </button>
            ) : null}
          </div>
        ) : null}
      </section> : null}

      <div className="family-tabs">
        {availableFamilies.map((family) => (
          <button
            key={family.root}
            className={selectedRoot === family.root ? "is-active" : ""}
            onClick={() => selectFamily(family.root)}
            type="button"
          >
            <strong>{family.label}</strong>
            <span>{chords.filter((chord) => chordFamilyRoot(chord.root || chord.name) === family.root).length}</span>
          </button>
        ))}
        {!availableFamilies.length ? <p className="empty-message">Todavia no hay familias de acordes.</p> : null}
      </div>

      <div className={`chords-admin-layout${isCreateMode ? " is-create-mode" : ""}`}>
        <section className="form-card">
          <header className="form-card-heading">
            <div>
              <span>Variaciones de {selectedFamily?.label || "la familia"}</span>
              <h3>{familyChords.length} acorde(s)</h3>
            </div>
          </header>
          <div className="chord-catalog-grid">
            {familyChords.map((chord) => {
              const stat = usageByChordId.get(chord.id);
              const variants = (Array.isArray(chord.variants) && chord.variants.length
                ? chord.variants
                : [{
                  id: `${chord.id}-default`,
                  name: "Principal",
                  frets: chord.frets,
                  capo: chord.capo,
                  barreFret: chord.barreFret,
                  barreFromString: chord.barreFromString,
                  barreToString: chord.barreToString,
                  configured: chord.configured,
                  validated: chord.validated,
                  isDefault: true,
                }]).slice().sort((first, second) => (
                  Number(Boolean(second.validated)) - Number(Boolean(first.validated))
                  || Number(Boolean(second.isDefault)) - Number(Boolean(first.isDefault))
                  || String(first.name || "").localeCompare(String(second.name || ""), "es", { sensitivity: "base" })
                ));
              return (
                <article key={chord.id} className={form.id === chord.id ? "chord-card is-active" : "chord-card"}>
                  <strong className="chord-card-title">{chord.name}</strong>
                  <div className={`chord-card-variants${variants.length > 1 ? " has-multiple" : ""}`}>
                    {variants.map((variant) => (
                      <button
                        key={variant.id}
                        className={form.variantId === variant.id ? "chord-variant-preview is-active" : "chord-variant-preview"}
                        onClick={() => !isCreateMode && isAdmin && editVariant(chord, variant)}
                        type="button"
                      >
                        <ChordDiagram
                          chord={chord.name}
                          capo={Number(variant.capo || 0)}
                          frets={variant.frets}
                          barreFret={variant.barreFret}
                          barreFromString={variant.barreFromString}
                          barreToString={variant.barreToString}
                          showTitle={false}
                        />
                        <span>{variant.name || "Principal"}</span>
                        <small className={variant.validated ? "validation-status is-valid" : "validation-status is-unvalidated"}>
                          {variant.validated ? "Validado" : "Sin validar"}
                        </small>
                      </button>
                    ))}
                  </div>
                  <small>{stat ? `${stat.count} usos - ${stat.versions} versiones` : "Sin uso registrado"}</small>
                </article>
              );
            })}
            {!familyChords.length ? <p className="empty-message">No hay acordes vinculados a esta familia y filtro.</p> : null}
          </div>
          {isCreateMode && isAdmin && selectedFamily ? (
            <div className="family-create-chord-action">
              <button className="primary-action" onClick={() => startNewChord(selectedRoot)} type="button"><Plus size={16} /> Crear acorde en {selectedFamily.label}</button>
            </div>
          ) : null}
        </section>

        {isAdmin && ((isCreateMode && showChordCreator) || (!isCreateMode && (form.id || showChordCreator))) ? <section className="form-card chord-editor-card">
          <header className="form-card-heading">
            <div>
              <span>{isCreateMode ? `Nueva variacion de ${selectedFamily?.label || selectedRoot}` : "Editar acorde"}</span>
              <h3>{form.name || "Nuevo acorde"}{form.variantName ? ` - ${form.variantName}` : ""}</h3>
            </div>
            {!isCreateMode && form.id ? <button className="danger-action" onClick={deleteChord} disabled={saving} type="button"><Trash2 size={16} /> Eliminar</button> : null}
          </header>

          {!isCreateMode && selectedChord ? (
            <div className="chord-variants-panel">
              <div className="chord-variants-heading">
                <div>
                  <strong>Variantes de {selectedChord.name}</strong>
                  <span>{selectedChordVariants.length} forma(s) configuradas</span>
                </div>
                <button className="secondary-action" onClick={startNewVariant} type="button"><Plus size={16} /> Nueva variante</button>
              </div>
              <div className="chord-variant-list">
                {selectedChordVariants.map((variant) => (
                  <button
                    key={variant.id}
                    className={form.variantId === variant.id ? "is-active" : ""}
                    onClick={() => editVariant(selectedChord, variant)}
                    type="button"
                  >
                    <span>{variant.name}</span>
                    <small>
                      {variant.isDefault ? "Principal" : "Alternativa"} - <span className={variant.validated ? "validation-status is-valid" : "validation-status is-unvalidated"}>{variant.validated ? "Validada" : "Sin validar"}</span>
                    </small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="form-grid chord-form-grid">
            <Field label="Nombre">
              <input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Ej: C, Cm, C7" disabled={Boolean(form.id && !form.variantId)} />
            </Field>
            <Field label="Nombre de variante">
              <input value={form.variantName} onChange={(event) => updateForm("variantName", event.target.value)} placeholder="Ej: Abierta, Cejilla traste 3" />
            </Field>
            <Field label="Capotraste">
              <input type="number" min="0" max="12" value={form.capo} onChange={(event) => updateForm("capo", event.target.value)} />
            </Field>
            <Field label="Dificultad">
              <input type="number" min="0" max="10" step="0.5" value={form.difficulty} onChange={(event) => updateForm("difficulty", event.target.value)} />
            </Field>
          </div>

          <div className="chord-validation-row">
            <label className="check-field">
              <input
                type="checkbox"
                checked={form.validated}
                onChange={(event) => updateForm("validated", event.target.checked)}
              />
              Acorde validado
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) => updateForm("isDefault", event.target.checked)}
              />
              Usar como variante principal
            </label>
          </div>

          <div className="frets-editor">
            <span>Cuerdas 6 a 1</span>
            <div>
              {form.frets.map((fret, index) => (
                <label key={index}>
                  <small>{6 - index}</small>
                  <input value={fret} onChange={(event) => updateFret(index, event.target.value)} placeholder="x" />
                </label>
              ))}
            </div>
            <p>Usa <strong>0</strong> para cuerda al aire, <strong>x</strong> o vacio para cuerda muteada, y numeros para trastes.</p>
          </div>

          <div className="barre-editor">
            <label className="check-field">
              <input
                type="checkbox"
                checked={Boolean(form.barreFret)}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  barreFret: event.target.checked ? current.barreFret || 1 : "",
                  barreFromString: event.target.checked ? current.barreFromString || 6 : 6,
                  barreToString: event.target.checked ? current.barreToString || 1 : 1,
                }))}
              />
              Usar cejilla
            </label>
            {form.barreFret ? (
              <div className="form-grid barre-form-grid">
                <Field label="Traste de la cejilla">
                  <input type="number" min="1" max="24" value={form.barreFret} onChange={(event) => updateForm("barreFret", event.target.value)} />
                </Field>
                <Field label="Desde cuerda">
                  <select value={form.barreFromString} onChange={(event) => updateForm("barreFromString", event.target.value)}>
                    {[6, 5, 4, 3, 2, 1].map((stringNumber) => <option key={stringNumber} value={stringNumber}>Cuerda {stringNumber}</option>)}
                  </select>
                </Field>
                <Field label="Hasta cuerda">
                  <select value={form.barreToString} onChange={(event) => updateForm("barreToString", event.target.value)}>
                    {[6, 5, 4, 3, 2, 1].map((stringNumber) => <option key={stringNumber} value={stringNumber}>Cuerda {stringNumber}</option>)}
                  </select>
                </Field>
              </div>
            ) : null}
            <p>La cejilla se dibuja como una barra continua. Para dejar libre la sexta cuerda, usa desde cuerda 5 hasta cuerda 1.</p>
          </div>

          <div className="chord-editor-preview">
            <ChordDiagram
              chord={form.name || selectedRoot}
              capo={Number(form.capo || 0)}
              frets={chordFormPayload(form).frets}
              barreFret={form.barreFret}
              barreFromString={form.barreFromString}
              barreToString={form.barreToString}
            />
          </div>

          <div className="form-actions">
            <button className="primary-action" onClick={saveChord} disabled={saving} type="button"><Save size={16} /> {form.id && !form.variantId ? "Crear variante" : "Guardar acorde"}</button>
            {!isCreateMode && form.variantId ? <button className="secondary-action" onClick={deleteVariant} disabled={saving || selectedChordVariants.length <= 1} type="button"><Trash2 size={16} /> Eliminar variante</button> : null}
          </div>
          {message ? <p className="success-box">{message}</p> : null}
        </section> : null}
        {!isCreateMode && isAdmin && !form.id ? (
          <aside className="form-card chord-editor-empty">
            <Guitar size={28} />
            <h3>Selecciona un acorde</h3>
            <p>La configuracion se cargara aqui para editarla y guardarla.</p>
          </aside>
        ) : null}
      </div>
      {message && !(isAdmin && ((isCreateMode && showChordCreator) || (!isCreateMode && form.id))) ? <p className="success-box chord-page-message">{message}</p> : null}
    </section>
  );
}

function SimplePanel({ title, eyebrow, children }) {
  return (
    <section className="work-area">
      <div className="panel-heading">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function CollapsibleSection({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="nav-section">
      <button className="nav-section-title" onClick={() => setOpen((value) => !value)} type="button">
        {title}
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open ? <div className="nav-section-content">{children}</div> : null}
    </section>
  );
}

function SessionPanel({ currentUser, onLogin, onLogout }) {
  const [email, setEmail] = useState("admin@cantusdei.local");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function submitLogin(event) {
    event.preventDefault();
    setError("");
    try {
      await onLogin(email, password);
      setPassword("");
      setOpen(false);
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  if (currentUser?.role === "ADMIN") {
    return (
      <section className="session-panel is-admin">
        <span>Perfil</span>
        <strong>Administrador</strong>
        <small>{currentUser.email}</small>
        <button onClick={onLogout} type="button"><LogOut size={15} /> Salir</button>
      </section>
    );
  }

  return (
    <section className="session-panel">
      <span>Perfil</span>
      <strong>Visitante</strong>
      <small>Solo lectura</small>
      <button onClick={() => setOpen((value) => !value)} type="button"><LogIn size={15} /> Iniciar sesion</button>
      {open ? (
        <form className="login-form" onSubmit={submitLogin}>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Contrasena" type="password" />
          <button className="primary-action" type="submit">Entrar</button>
          {error ? <p>{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}

function PresentationView({ songs, selectedSong, onSelectSong, search, setSearch }) {
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [showChords, setShowChords] = useState(true);
  const [fontSize, setFontSize] = useState(22);

  useEffect(() => {
    if (!selectedSong?.versions?.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(selectedSong?.versions?.[0]?.id || "");
    }
  }, [selectedSong, selectedVersionId]);

  const selectedVersion = selectedSong?.versions?.find((version) => version.id === selectedVersionId) || selectedSong?.versions?.[0] || null;

  return (
    <section className="presentation-shell">
      <aside className="presentation-list">
        <label className="search-field">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cancion" />
        </label>
        <div className="song-list">
          {songs.map((song) => (
            <button key={song.id} className={selectedSong?.id === song.id ? "is-active" : ""} onClick={() => onSelectSong(song)} title={song.title}>
              <strong>{song.title}</strong>
              <span>{song.artist || "Sin artista"}</span>
            </button>
          ))}
        </div>
      </aside>
      <article className="presentation-stage" style={{ "--presentation-font-size": `${fontSize}px` }}>
        {selectedSong && selectedVersion ? (
          <>
            <header>
              <div>
                <h2>{selectedSong.title}</h2>
                <p>{selectedSong.artist || "Sin artista"} - Tono {selectedVersion.key}{selectedVersion.capo ? ` - Capo ${selectedVersion.capo}` : ""}</p>
              </div>
              <div className="presentation-actions">
                <button onClick={() => setShowChords((value) => !value)} type="button">{showChords ? "Ocultar acordes" : "Mostrar acordes"}</button>
                <button onClick={() => setFontSize((value) => Math.max(16, value - 2))} type="button">A-</button>
                <button onClick={() => setFontSize((value) => Math.min(34, value + 2))} type="button">A+</button>
              </div>
            </header>
            {selectedSong.versions.length > 1 ? (
              <div className="version-strip">
                {selectedSong.versions.map((version) => (
                  <VersionButton key={version.id} version={version} active={version.id === selectedVersion.id} onClick={() => setSelectedVersionId(version.id)} />
                ))}
              </div>
            ) : null}
            <div className="presentation-lyrics">
              <LyricsView lyrics={selectedVersion.lyrics || ""} showChords={showChords} />
            </div>
          </>
        ) : (
          <p className="empty-message">Selecciona una cancion.</p>
        )}
      </article>
    </section>
  );
}

function chordSuggestionPayload(draft) {
  return {
    sourceUrl: draft.sourceUrl || "",
    title: draft.title || "",
    artist: draft.artist || "",
    key: draft.key || "",
    capo: Number(draft.capo || 0),
    bpm: draft.bpm ? Number(draft.bpm) : null,
    timeSignature: draft.timeSignature || "",
    confidence: Number(draft.confidence || 0),
    summary: draft.summary || "",
    sections: Array.isArray(draft.sections) ? draft.sections : [],
    chords: Array.isArray(draft.chords) ? draft.chords : [],
    sources: Array.isArray(draft.sources) ? draft.sources : [],
    notes: draft.notes || "",
  };
}

function parseSuggestedFrets(value) {
  const parts = String(value).split(",").map((item) => item.trim());
  if (parts.length !== 6) return null;
  const frets = parts.map((item) => {
    if (!item || /^x$/i.test(item)) return null;
    const fret = Number(item);
    return Number.isInteger(fret) && fret >= 0 && fret <= 24 ? fret : Number.NaN;
  });
  return frets.some(Number.isNaN) ? null : frets;
}

function ChordSuggestionView({ setGlobalError }) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [context, setContext] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [draft, setDraft] = useState(null);
  const [config, setConfig] = useState({ enabled: false, model: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDrafts() {
    try {
      const [draftData, configData] = await Promise.all([
        api("/chord-suggestions"),
        api("/chord-suggestions/config"),
      ]);
      setDrafts(draftData);
      setConfig(configData);
      if (!draft && draftData[0]) setDraft(draftData[0]);
    } catch (error) {
      setGlobalError(error.message);
    }
  }

  useEffect(() => {
    loadDrafts();
  }, []);

  async function analyze(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setGlobalError("");
    try {
      const result = await api("/chord-suggestions/analyze", {
        method: "POST",
        body: JSON.stringify({ sourceUrl, context }),
      });
      setDraft(result);
      setDrafts((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      setMessage("Sugerencia creada como borrador. No se agrego al himnario.");
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    setMessage("");
    setGlobalError("");
    try {
      const saved = await api(`/chord-suggestions/${draft.id}`, {
        method: "PUT",
        body: JSON.stringify(chordSuggestionPayload(draft)),
      });
      setDraft(saved);
      setDrafts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setMessage("Borrador actualizado. Continua fuera del himnario.");
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (!draft || !window.confirm(`Eliminar el borrador "${draft.title || "Sin titulo"}"?`)) return;
    setBusy(true);
    try {
      await api(`/chord-suggestions/${draft.id}`, { method: "DELETE" });
      const remaining = drafts.filter((item) => item.id !== draft.id);
      setDrafts(remaining);
      setDraft(remaining[0] || null);
      setMessage("Borrador eliminado.");
    } catch (error) {
      setGlobalError(error.message);
    } finally {
      setBusy(false);
    }
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateSection(index, field, value) {
    const sections = draft.sections.map((section, sectionIndex) => (
      sectionIndex === index ? { ...section, [field]: value } : section
    ));
    updateDraft("sections", sections);
  }

  function updateSuggestedChord(index, frets) {
    const chords = draft.chords.map((chord, chordIndex) => (
      chordIndex === index ? { ...chord, frets } : chord
    ));
    updateDraft("chords", chords);
  }

  return (
    <section className="work-area chord-suggestion-shell">
      <header className="section-title-band">
        <div>
          <span>Investigacion musical</span>
          <h2>Asistente de acordes</h2>
          <p>Pega un enlace para obtener una propuesta revisable con progresiones y diagramas.</p>
        </div>
        <div className="draft-status"><span /> Borrador, no agregado al himnario</div>
      </header>

      <form className="chord-link-form" onSubmit={analyze}>
        <label>
          Enlace de la cancion
          <div className="input-with-icon">
            <Link2 size={18} />
            <input
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              required
            />
          </div>
        </label>
        <label>
          Contexto opcional
          <input
            placeholder="Artista, tono conocido o version especifica"
            value={context}
            onChange={(event) => setContext(event.target.value)}
          />
        </label>
        <button className="primary-action" disabled={busy || !sourceUrl.trim()} type="submit">
          <Sparkles size={18} /> {busy ? "Analizando..." : "Sugerir acordes"}
        </button>
      </form>

      {!config.enabled ? (
        <div className="assistant-config-note">
          Configura <code>OPENAI_API_KEY</code> en el backend para habilitar el analisis. Los borradores existentes siguen disponibles.
        </div>
      ) : (
        <p className="assistant-model-note">Analisis asistido con {config.model}. Verifica siempre tono, acordes y digitaciones antes de usarlo.</p>
      )}

      {message ? <div className="success-box">{message}</div> : null}

      <div className="chord-suggestion-layout">
        <aside className="suggestion-drafts">
          <h3>Borradores</h3>
          {drafts.length ? drafts.map((item) => (
            <button
              className={draft?.id === item.id ? "is-selected" : ""}
              key={item.id}
              onClick={() => setDraft(item)}
              type="button"
            >
              <strong>{item.title || "Sin titulo"}</strong>
              <span>{item.artist || item.sourceUrl}</span>
            </button>
          )) : <p className="empty-message">Todavia no hay sugerencias guardadas.</p>}
        </aside>

        <div className="suggestion-result">
          {draft ? (
            <>
              <div className="suggestion-editor-header">
                <div>
                  <span>Resultado propuesto</span>
                  <h3>{draft.title || "Cancion sin identificar"}</h3>
                </div>
                <div className="suggestion-actions">
                  <button disabled={busy} onClick={saveDraft} type="button"><Save size={17} /> Guardar borrador</button>
                  <button className="danger-ghost" disabled={busy} onClick={deleteDraft} type="button"><Trash2 size={17} /> Eliminar</button>
                </div>
              </div>

              <div className="suggestion-meta-grid">
                <label>Titulo<input value={draft.title || ""} onChange={(event) => updateDraft("title", event.target.value)} /></label>
                <label>Artista<input value={draft.artist || ""} onChange={(event) => updateDraft("artist", event.target.value)} /></label>
                <label>Tono<input value={draft.key || ""} onChange={(event) => updateDraft("key", event.target.value)} /></label>
                <label>Capo<input min="0" max="12" type="number" value={draft.capo || 0} onChange={(event) => updateDraft("capo", Number(event.target.value))} /></label>
                <label>BPM<input min="20" max="300" type="number" value={draft.bpm || ""} onChange={(event) => updateDraft("bpm", event.target.value ? Number(event.target.value) : null)} /></label>
                <label>Compas<input value={draft.timeSignature || ""} onChange={(event) => updateDraft("timeSignature", event.target.value)} /></label>
              </div>

              <label className="suggestion-wide-field">
                Resumen
                <textarea rows="2" value={draft.summary || ""} onChange={(event) => updateDraft("summary", event.target.value)} />
              </label>

              <section className="suggestion-section-block">
                <div className="subsection-heading">
                  <h3>Progresiones sugeridas</h3>
                  <span>Confianza estimada: {draft.confidence || 0}%</span>
                </div>
                <div className="progression-list">
                  {(draft.sections || []).map((section, index) => (
                    <article key={`${section.name}-${index}`}>
                      <input
                        aria-label="Nombre de seccion"
                        value={section.name}
                        onChange={(event) => updateSection(index, "name", event.target.value)}
                      />
                      <input
                        aria-label={`Progresion de ${section.name}`}
                        value={(section.progression || []).join(" - ")}
                        onChange={(event) => updateSection(index, "progression", event.target.value.split(/[·,;-]/).map((value) => value.trim()).filter(Boolean))}
                      />
                      <input
                        aria-label={`Observacion de ${section.name}`}
                        placeholder="Observacion"
                        value={section.note || ""}
                        onChange={(event) => updateSection(index, "note", event.target.value)}
                      />
                    </article>
                  ))}
                </div>
              </section>

              <section className="suggestion-section-block">
                <div className="subsection-heading">
                  <h3>Diagramas propuestos</h3>
                  <span>Cuerdas en orden 6 a 1; usa x para silenciar.</span>
                </div>
                <div className="suggested-diagram-grid">
                  {(draft.chords || []).map((chord, index) => (
                    <div className="suggested-diagram-item" key={`${chord.name}-${index}`}>
                      <ChordDiagram
                        chord={chord.name}
                        frets={chord.frets}
                        capo={chord.capo}
                        barreFret={chord.barreFret}
                        barreFromString={chord.barreFromString}
                        barreToString={chord.barreToString}
                      />
                      <label>
                        Posiciones
                        <input
                          defaultValue={(chord.frets || []).map((fret) => fret ?? "x").join(", ")}
                          onBlur={(event) => {
                            const frets = parseSuggestedFrets(event.target.value);
                            if (frets) updateSuggestedChord(index, frets);
                            else setGlobalError("Cada diagrama debe tener seis posiciones separadas por comas.");
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </section>

              <label className="suggestion-wide-field">
                Notas de revision
                <textarea rows="3" value={draft.notes || ""} onChange={(event) => updateDraft("notes", event.target.value)} />
              </label>

              {(draft.sources || []).length ? (
                <section className="suggestion-sources">
                  <h3>Fuentes consultadas</h3>
                  {draft.sources.map((source, index) => (
                    <a href={source.url} key={`${source.url}-${index}`} rel="noreferrer" target="_blank">{source.title || source.url}</a>
                  ))}
                </section>
              ) : null}
            </>
          ) : (
            <div className="suggestion-empty">
              <Sparkles size={28} />
              <h3>El resultado aparecera aqui</h3>
              <p>Se dibujaran solamente los acordes sugeridos para la cancion.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function songListUrl(searchValue = "") {
  const params = new URLSearchParams({ summary: "1" });
  const normalizedSearch = String(searchValue || "").trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  return `/songs?${params.toString()}`;
}

function hasLoadedLyrics(song) {
  return Boolean(song?.__detailsLoaded || song?.versions?.some((version) => Object.prototype.hasOwnProperty.call(version, "lyrics")));
}

function App() {
  const [view, setView] = useState("songs");
  const [currentUser, setCurrentUser] = useState(() => {
    const raw = window.localStorage.getItem("cantusdei_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [songs, setSongs] = useState([]);
  const [chords, setChords] = useState([]);
  const [chordFamilies, setChordFamilies] = useState([]);
  const [usage, setUsage] = useState([]);
  const [setlists, setSetlists] = useState([]);
  const [tutorials, setTutorials] = useState([]);
  const [users, setUsers] = useState([]);
  const [songDetailsById, setSongDetailsById] = useState({});
  const [search, setSearch] = useState("");
  const [selectedSongId, setSelectedSongId] = useState("");
  const [editorSelectedSongId, setEditorSelectedSongId] = useState("");
  const [editorMode, setEditorMode] = useState("edit");
  const [editorSession, setEditorSession] = useState(0);
  const [readerVersionFocus, setReaderVersionFocus] = useState("");
  const [chordConfigurationRequest, setChordConfigurationRequest] = useState(null);
  const [error, setError] = useState("");
  const didSkipInitialSearch = useRef(false);
  const songRequestSequence = useRef(0);
  const isAdmin = currentUser?.role === "ADMIN";

  function cacheSongDetails(song) {
    const detailedSong = { ...song, __detailsLoaded: true };
    setSongDetailsById((current) => ({ ...current, [song.id]: detailedSong }));
    setSongs((current) => current.map((item) => (item.id === song.id ? { ...item, ...detailedSong } : item)));
  }

  async function loadSongs(preferredSelectedSongId = selectedSongId, searchValue = search) {
    const requestId = songRequestSequence.current + 1;
    songRequestSequence.current = requestId;
    try {
      setError("");
      const songData = await api(songListUrl(searchValue));
      if (requestId !== songRequestSequence.current) return [];
      setSongs(songData);
      const preferredExists = songData.some((song) => song.id === preferredSelectedSongId);
      if (preferredSelectedSongId && preferredExists) setSelectedSongId(preferredSelectedSongId);
      else if (songData[0]) setSelectedSongId(songData[0].id);
      else setSelectedSongId("");
      return songData;
    } catch (loadError) {
      setError(loadError.message);
      return [];
    }
  }

  async function loadData(preferredSelectedSongId = selectedSongId) {
    const requestId = songRequestSequence.current + 1;
    songRequestSequence.current = requestId;
    try {
      setError("");
      const [songData, chordData, familyData, usageData, setlistData, tutorialData, userData] = await Promise.all([
        api(songListUrl(search)),
        api("/chords"),
        api("/chords/families"),
        api("/chords/usage"),
        api("/setlists"),
        api("/tutorials"),
        api("/users"),
      ]);
      if (requestId === songRequestSequence.current) setSongs(songData);
      setChords(chordData);
      setChordFamilies(familyData);
      setUsage(usageData);
      setSetlists(setlistData);
      setTutorials(tutorialData);
      setUsers(userData);
      if (requestId === songRequestSequence.current) {
        const preferredExists = songData.some((song) => song.id === preferredSelectedSongId);
        if (preferredSelectedSongId && preferredExists) setSelectedSongId(preferredSelectedSongId);
        else if (songData[0]) setSelectedSongId(songData[0].id);
        else setSelectedSongId("");
      }
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!didSkipInitialSearch.current) {
      didSkipInitialSearch.current = true;
      return undefined;
    }
    const timer = window.setTimeout(() => {
      loadSongs(selectedSongId, search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const selectedSongSummary = useMemo(
    () => songs.find((song) => song.id === selectedSongId) || songs[0] || null,
    [songs, selectedSongId],
  );
  const selectedSong = useMemo(
    () => (selectedSongSummary ? songDetailsById[selectedSongSummary.id] || selectedSongSummary : null),
    [selectedSongSummary, songDetailsById],
  );
  const editorSelectedSongSummary = useMemo(
    () => songs.find((song) => song.id === editorSelectedSongId) || null,
    [songs, editorSelectedSongId],
  );
  const editorSelectedSong = useMemo(
    () => (editorSelectedSongSummary ? songDetailsById[editorSelectedSongSummary.id] || editorSelectedSongSummary : null),
    [editorSelectedSongSummary, songDetailsById],
  );

  useEffect(() => {
    const songId = selectedSongSummary?.id;
    if (!songId || hasLoadedLyrics(songDetailsById[songId])) return undefined;
    let active = true;
    api(`/songs/${songId}`)
      .then((song) => {
        if (active) cacheSongDetails(song);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [selectedSongSummary?.id, songDetailsById]);

  useEffect(() => {
    const songId = editorSelectedSongSummary?.id;
    if (!songId || hasLoadedLyrics(songDetailsById[songId])) return undefined;
    let active = true;
    api(`/songs/${songId}`)
      .then((song) => {
        if (active) cacheSongDetails(song);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [editorSelectedSongSummary?.id, songDetailsById]);

  function openSongEditor(mode) {
    setEditorMode(mode);
    setEditorSelectedSongId("");
    setEditorSession((value) => value + 1);
    setView("editor");
  }

  function openChordConfiguration(chordName, versionId = "") {
    if (!isAdmin) {
      setError("Solo un administrador puede configurar acordes.");
      return;
    }
    setChordConfigurationRequest({
      chordName,
      songId: selectedSong?.id || "",
      versionId,
    });
    setView("chord-edit");
  }

  function returnFromChordConfiguration() {
    if (chordConfigurationRequest?.songId) setSelectedSongId(chordConfigurationRequest.songId);
    if (chordConfigurationRequest?.versionId) setReaderVersionFocus(chordConfigurationRequest.versionId);
    setView("songs");
  }

  const stats = {
    songs: songs.length,
    versions: songs.reduce((sum, song) => sum + song.versions.length, 0),
    chords: usage.length,
    setlists: setlists.length,
  };

  async function login(email, password) {
    const session = await api("/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(session.token);
    window.localStorage.setItem("cantusdei_user", JSON.stringify(session.user));
    setCurrentUser(session.user);
    setError("");
    return session;
  }

  function logout() {
    setAuthToken("");
    window.localStorage.removeItem("cantusdei_user");
    setCurrentUser(null);
    if (["editor", "chord-create", "setlist-create", "setlist-manage", "users"].includes(view)) setView("songs");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CD</div>
          <div>
            <h1>CantusDei</h1>
            <span>React fullstack</span>
          </div>
        </div>
        <SessionPanel currentUser={currentUser} onLogin={login} onLogout={logout} />
        <nav>
          <CollapsibleSection title="Canciones">
            <button className={view === "songs" ? "is-active" : ""} onClick={() => setView("songs")}><Music2 size={18} /> Lectura</button>
            <button className={view === "presentation" ? "is-active" : ""} onClick={() => setView("presentation")}><Monitor size={18} /> Presentacion</button>
            {isAdmin ? <button className={view === "editor" && editorMode === "edit" ? "is-active" : ""} onClick={() => openSongEditor("edit")}><FilePlus2 size={18} /> Editar Cancion</button> : null}
            {isAdmin ? <button className={view === "editor" && editorMode === "new" ? "is-active" : ""} onClick={() => openSongEditor("new")}><Plus size={18} /> Nueva Cancion</button> : null}
            {isAdmin ? <button className={view === "song-import" ? "is-active" : ""} onClick={() => setView("song-import")}><FileText size={18} /> Importar JSON</button> : null}
          </CollapsibleSection>
          <CollapsibleSection title="Biblioteca">
            <button className={view === "tutorials" ? "is-active" : ""} onClick={() => setView("tutorials")}><BookOpen size={18} /> Recursos</button>
          </CollapsibleSection>
          <CollapsibleSection title="Acordes">
            {isAdmin ? <button className={view === "chord-create" ? "is-active" : ""} onClick={() => { setChordConfigurationRequest(null); setView("chord-create"); }}><Plus size={18} /> Crear Acorde</button> : null}
            <button className={view === "chord-edit" ? "is-active" : ""} onClick={() => { setChordConfigurationRequest(null); setView("chord-edit"); }}><Guitar size={18} /> {isAdmin ? "Editar Acordes" : "Ver Acordes"}</button>
          </CollapsibleSection>
          {isAdmin ? <CollapsibleSection title="Setlists">
            <button className={view === "setlist-create" ? "is-active" : ""} onClick={() => setView("setlist-create")}><Plus size={18} /> Crear SetList</button>
            <button className={view === "setlist-manage" ? "is-active" : ""} onClick={() => setView("setlist-manage")}><CalendarDays size={18} /> Consulta/Editar SetList</button>
          </CollapsibleSection> : null}
          <CollapsibleSection title="Gestion">
            {isAdmin ? <button className={view === "users" ? "is-active" : ""} onClick={() => setView("users")}><Users size={18} /> Usuarios</button> : null}
          </CollapsibleSection>
        </nav>
        <p className="api-status">API: {API_URL}</p>
      </aside>

      <section className="content">
        {!["songs", "editor", "song-import", "chord-create", "chord-edit", "setlist-create", "setlist-manage"].includes(view) ? (
          <header className="topbar">
            <div>
              <span>Base de datos central</span>
              <h2>Lector migrado a React</h2>
            </div>
            <button onClick={() => loadData()}>Actualizar</button>
          </header>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        {!["songs", "editor", "song-import", "chord-create", "chord-edit", "setlist-create", "setlist-manage"].includes(view) ? (
          <div className="stats-grid">
            <section className="stat-card"><Library size={20} /><strong>{stats.songs}</strong><span>Canciones</span></section>
            <section className="stat-card"><Music2 size={20} /><strong>{stats.versions}</strong><span>Versiones</span></section>
            <section className="stat-card"><Guitar size={20} /><strong>{stats.chords}</strong><span>Acordes usados</span></section>
            <section className="stat-card"><CalendarDays size={20} /><strong>{stats.setlists}</strong><span>Setlists</span></section>
          </div>
        ) : null}

        {view === "songs" && (
          <ReaderView
            songs={songs}
            chords={chords}
            selectedSong={selectedSong}
            onSelectSong={(song) => setSelectedSongId(song.id)}
            search={search}
            setSearch={setSearch}
            initialVersionId={readerVersionFocus}
            onConfigureChord={openChordConfiguration}
          />
        )}
        {view === "presentation" && <PresentationView songs={songs} selectedSong={selectedSong} onSelectSong={(song) => setSelectedSongId(song.id)} search={search} setSearch={setSearch} />}
        {view === "editor" && isAdmin && (
          <SongEditorView
            key={editorSession}
            songs={songs}
            chords={chords}
            selectedSong={editorSelectedSong}
            onSelectSong={(song) => setEditorSelectedSongId(song?.id || "")}
            search={search}
            setSearch={setSearch}
            onReload={async (songId) => {
              await loadData(songId);
              setEditorSelectedSongId(songId || "");
            }}
            setGlobalError={setError}
            initialMode={editorMode}
          />
        )}
        {view === "song-import" && isAdmin && <SongImportView onReload={loadData} setGlobalError={setError} />}
        {view === "chord-create" && isAdmin && <ChordsView mode="create" families={chordFamilies} chords={chords} usage={usage} onReload={loadData} setGlobalError={setError} isAdmin={isAdmin} />}
        {view === "chord-edit" && (
          <ChordsView
            mode="edit"
            families={chordFamilies}
            chords={chords}
            usage={usage}
            onReload={loadData}
            setGlobalError={setError}
            isAdmin={isAdmin}
            initialChordName={chordConfigurationRequest?.chordName || ""}
            returnAction={chordConfigurationRequest ? {
              label: `Volver a ${selectedSong?.title || "la cancion"}`,
              onReturn: returnFromChordConfiguration,
            } : null}
          />
        )}
        {view === "setlist-create" && isAdmin && <SetlistsView key="setlist-create" initialMode="create" songs={songs} setlists={setlists} chords={chords} onReload={loadData} setGlobalError={setError} />}
        {view === "setlist-manage" && isAdmin && <SetlistsView key="setlist-manage" initialMode="manage" songs={songs} setlists={setlists} chords={chords} onReload={loadData} setGlobalError={setError} />}
        {view === "tutorials" && <TutorialView tutorials={tutorials} isAdmin={isAdmin} onReload={loadData} setGlobalError={setError} />}
        {view === "users" && isAdmin && <SimplePanel eyebrow="Accesos" title="Usuarios"><pre>{JSON.stringify(users, null, 2)}</pre></SimplePanel>}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
