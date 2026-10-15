import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Maximize, MessageSquareText, Pause, Play, Repeat1, RotateCcw, Settings2, SkipBack, SkipForward } from "lucide-react";
import "./setlist-monitor.css";

export function buildMonitorQueue(items, parseSections) {
  return items.flatMap((item, songIndex) => {
    const sections = item.arrangement?.length ? item.arrangement : parseSections(item.baseLyrics || item.lyrics || "");
    return sections.map((block, sectionIndex) => ({
      ...block,
      songIndex,
      sectionIndex,
      count: sections.length,
      item,
      timingId: `${item.localId}:${block.id}`,
    }));
  });
}

const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function MonitorLyrics({ lyrics, parseLine, showChords }) {
  return <div className={`stage-lyrics${showChords ? "" : " without-chords"}`}>
    {String(lyrics || "").split("\n").map((line, lineIndex) => {
      const parsed = parseLine(line);
      const text = parsed.text || " ".repeat(Math.max(1, ...parsed.chords.map((chord) => chord.position + chord.chord.length)));
      const words = [...text.matchAll(/\S+\s*|\s+/g)];
      return <p className="stage-lyric-line" key={lineIndex}>{words.map((word, index) => {
        const start = word.index;
        const end = start + word[0].length;
        const chords = parsed.chords.filter((chord) => chord.position >= start && (chord.position < end || (index === words.length - 1)));
        return <span className="stage-word" key={start}>
          {showChords ? <span className="stage-word-chords" aria-hidden="true">{chords.map((chord, chordIndex) => <span className="stage-chord-anchor" key={chordIndex} style={{ left: `${chord.position - start}ch` }}><b>{chord.chord}</b></span>)}</span> : null}
          {word[0]}
        </span>;
      })}</p>;
    })}
  </div>;
}

export default function SetlistMonitor({ form, items, parseSections, parseLine, onClose }) {
  const queue = useMemo(() => buildMonitorQueue(items, parseSections), [items, parseSections]);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [durations, setDurations] = useState({});
  const [hold, setHold] = useState(false);
  const [automatic, setAutomatic] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const [showChords, setShowChords] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [fontSize, setFontSize] = useState(30);
  const [error, setError] = useState("");
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const current = queue[index];
  const next = queue[index + 1];
  const duration = durations[current?.timingId] || 30;
  const progress = Math.min(100, elapsed / duration * 100);

  function goTo(target) {
    setIndex(Math.max(0, Math.min(queue.length - 1, target)));
    setElapsed(0);
  }

  useEffect(() => {
    if (!playing || !current) return undefined;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min((now - last) / 1000, 0.5) * speed;
      last = now;
      setElapsed((value) => Math.min(duration, value + delta));
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, index, speed, duration, Boolean(current)]);

  useEffect(() => {
    if (!playing || elapsed < duration) return;
    if (hold || !automatic || index >= queue.length - 1) setPlaying(false);
    else goTo(index + 1);
  }, [elapsed, duration, hold, automatic, playing, index, queue.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [index]);

  useEffect(() => {
    if (!playing || !scrollRef.current) return;
    const node = scrollRef.current;
    node.scrollTop = Math.max(0, node.scrollHeight - node.clientHeight) * elapsed / duration;
  }, [playing, elapsed, duration]);

  useEffect(() => {
    const visibility = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);

  useEffect(() => {
    let lock;
    let disposed = false;
    if (playing) navigator.wakeLock?.request("screen").then((value) => {
      if (disposed) value.release().catch(() => {});
      else lock = value;
    }).catch(() => {});
    return () => { disposed = true; lock?.release().catch(() => {}); };
  }, [playing]);

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch { setError("No se pudo activar pantalla completa en este navegador."); }
  }

  async function close() {
    if (document.fullscreenElement === rootRef.current) await document.exitFullscreen().catch(() => {});
    onClose();
  }

  if (!current) return <section className="v2-placeholder"><h2>Sin canciones para mostrar</h2><button type="button" onClick={onClose}>Volver a la setlist</button></section>;

  return <section className="setlist-stage-monitor" ref={rootRef} style={{ "--stage-font-size": `${fontSize}px` }} aria-label="Modo Monitor">
    <header className="stage-topbar">
      <button type="button" onClick={close}><ChevronLeft size={18} /> Volver</button>
      <div><strong>CantusDei · Modo Monitor</strong><small>{form.name} · Cancion {current.songIndex + 1} de {items.length}</small></div>
      <div className="stage-header-actions"><button type="button" onClick={() => setShowControls((value) => !value)} aria-pressed={!showControls}><Settings2 size={18} /> {showControls ? "Solo monitor" : "Mostrar controles"}</button><button type="button" onClick={fullscreen} aria-label="Pantalla completa" title="Pantalla completa"><Maximize size={18} /></button></div>
    </header>
    {error ? <p role="alert" className="stage-error">{error}</p> : null}
    <header className="stage-song-header"><h2>{current.item.songTitle}</h2><span>Tono <strong>{current.item.key}</strong>{current.item.capo ? ` · Capo ${current.item.capo}` : ""}</span></header>
    <div className={`stage-body${showComments ? "" : " comments-hidden"}`}>
      <main className="stage-current">
        <div className="stage-section-heading"><h3>{current.name}</h3><span>Ahora</span><small>{current.sectionIndex + 1} / {current.count}</small></div>
        <div className="stage-lyrics-scroll" ref={scrollRef} key={current.timingId}><MonitorLyrics lyrics={current.lyrics} parseLine={parseLine} showChords={showChords} /></div>
      </main>
      <aside className="stage-sidebar">
        {showComments ? <section className="stage-cue"><span><MessageSquareText size={16} /> Indicacion de banda</span><p>{current.comment || "Sin indicaciones"}</p></section> : null}
        <section className="stage-upcoming"><span>A continuacion</span><h3>{next?.name || "Fin de la setlist"}</h3><p>{next ? (next.songIndex !== current.songIndex ? next.item.songTitle : next.lyrics.replace(/\[[^\]]+\]/g, "").split("\n").find((line) => line.trim()) || "Instrumental") : ""}</p></section>
      </aside>
    </div>
    <div className="stage-playback-status"><span>{formatTime(elapsed)} / {formatTime(duration)}</span><span>{hold ? "Seccion retenida" : automatic ? "Avance automatico" : "Avance manual"} · {playing ? "En curso" : "En pausa"}</span></div>
    <div className="stage-progress" role="progressbar" aria-label="Progreso de la seccion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div style={{ width: `${progress}%` }} /></div>
    <nav className="stage-sequence" aria-label="Secciones de la cancion">{queue.map((part, partIndex) => part.songIndex === current.songIndex ? <button type="button" key={part.timingId} aria-current={partIndex === index ? "step" : undefined} onClick={() => goTo(partIndex)}>{part.sectionIndex + 1}. {part.name}</button> : null)}</nav>
    {showControls ? <section className="stage-operator" aria-label="Control del operador">
      <div className="stage-transport">
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Seccion anterior" title="Seccion anterior"><SkipBack size={18} /></button>
        <button type="button" className="stage-play" onClick={() => { if (elapsed >= duration) setElapsed(0); setPlaying((value) => !value); }}>{playing ? <Pause size={18} /> : <Play size={18} />}{playing ? "Pausar" : "Reproducir"}</button>
        <button type="button" onClick={() => goTo(index + 1)} disabled={index === queue.length - 1}>Siguiente seccion<SkipForward size={18} /></button>
        <button type="button" aria-pressed={hold} onClick={() => setHold((value) => !value)}><Repeat1 size={18} />{hold ? "Seccion retenida" : "Mantener seccion"}</button>
        <button type="button" onClick={() => setElapsed(0)} aria-label="Reiniciar seccion" title="Reiniciar seccion"><RotateCcw size={18} /></button>
      </div>
      <div className="stage-settings">
        <label>Cancion del evento<select value={current.songIndex} onChange={(event) => { setPlaying(false); goTo(queue.findIndex((entry) => entry.songIndex === Number(event.target.value))); }}>{items.map((item, itemIndex) => <option key={item.localId} value={itemIndex}>{itemIndex + 1}. {item.songTitle}</option>)}</select></label>
        <label>Velocidad · {speed.toFixed(2)}x<input type="range" aria-label="Velocidad del avance" min="0.5" max="1.5" step="0.05" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} /></label>
        <label>Duracion de la seccion (segundos)<input aria-label="Duracion de la seccion" type="number" min="5" max="600" value={duration} onChange={(event) => { const value = Math.min(600, Math.max(5, Number(event.target.value) || 30)); setDurations((all) => ({ ...all, [current.timingId]: value })); setElapsed((time) => Math.min(time, value)); }} /></label>
        <label>Tamano de letra<input type="range" aria-label="Tamano de letra" min="18" max="48" step="2" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
      </div>
      <div className="stage-toggles"><label><input type="checkbox" checked={automatic} onChange={(event) => setAutomatic(event.target.checked)} />Automatico</label><label><input type="checkbox" checked={showComments} onChange={(event) => setShowComments(event.target.checked)} />Comentarios</label><label><input type="checkbox" checked={showChords} onChange={(event) => setShowChords(event.target.checked)} />Acordes</label></div>
    </section> : null}
  </section>;
}
