import React, { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, Copy, GripVertical, Plus, Save, Trash2 } from "lucide-react";

const copyBlock = (block) => ({ id: crypto.randomUUID(), type: block.type, name: block.name, lyrics: block.lyrics });

export default function SetlistArrangementEditor({ items, setlistName, parseSections, onSave, onClose }) {
  const [itemId, setItemId] = useState(items[0]?.localId || "");
  const item = items.find((candidate) => candidate.localId === itemId);
  const base = parseSections(item?.baseLyrics || "");
  const [blocks, setBlocks] = useState(() => items[0]?.arrangement?.length ? items[0].arrangement.map(copyBlock) : parseSections(items[0]?.baseLyrics || "").map(copyBlock));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drag, setDrag] = useState(null);

  function change(next) {
    setBlocks(next);
    setDirty(true);
    setNotice("");
  }

  function switchSong(id) {
    if (dirty && !window.confirm("Cambiar de cancion y descartar los cambios sin guardar?")) return;
    const next = items.find((candidate) => candidate.localId === id);
    setItemId(id);
    setBlocks(next.arrangement?.length ? next.arrangement.map(copyBlock) : parseSections(next.baseLyrics || "").map(copyBlock));
    setDirty(false);
    setNotice("");
    setError("");
  }

  function move(index, offset) {
    const target = index + offset;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
  }

  function drop(event, targetIndex) {
    event.preventDefault();
    event.stopPropagation();
    if (!drag) return;
    const next = [...blocks];
    if (drag.source === "base") {
      next.splice(targetIndex, 0, copyBlock(base[drag.index]));
    } else {
      const [block] = next.splice(drag.index, 1);
      next.splice(targetIndex > drag.index ? targetIndex - 1 : targetIndex, 0, block);
    }
    change(next);
    setDrag(null);
  }

  async function save() {
    if (!blocks.length) { setError("Agrega al menos una parte a la ejecucion."); return; }
    setSaving(true);
    setError("");
    try {
      await onSave(item.localId, blocks);
      setDirty(false);
      setNotice("Ejecucion guardada para esta setlist.");
    } catch (failure) {
      setError(failure.message);
    } finally { setSaving(false); }
  }

  return (
    <section className="v2-structure-page arrangement-page">
      <header className="v2-editor-hero">
        <button className="v2-back-button" disabled={saving} onClick={() => { if (!dirty || window.confirm("Salir y descartar los cambios sin guardar?")) onClose(); }} type="button"><ChevronLeft size={18} /> Volver a la setlist</button>
        <div><span>{setlistName}</span><h2>Armado de ejecucion</h2><p>{item?.songTitle} · Tono {item?.key}</p></div>
        <button className="v2-primary-button" disabled={saving || !dirty} onClick={save} type="button"><Save size={17} /> {saving ? "Guardando..." : "Guardar en setlist"}</button>
      </header>
      <label className="form-field"><span>Cancion del evento</span><select value={itemId} disabled={saving} onChange={(event) => switchSong(event.target.value)}>{items.map((entry, index) => <option key={entry.localId} value={entry.localId}>{index + 1}. {entry.songTitle} - {entry.key}</option>)}</select></label>
      {error ? <p className="error-box" role="alert">{error}</p> : null}
      {notice ? <p className="success-box" role="status">{notice}</p> : null}
      <fieldset disabled={saving} className="arrangement-workspace">
        <aside className="arrangement-source">
          <h3>Estructura base</h3>
          <div className="arrangement-block-list">
            {base.map((block, index) => <article className="arrangement-block" key={block.id} draggable onDragStart={(event) => { setDrag({ source: "base", index }); event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("text/plain", block.name); }} onDragEnd={() => setDrag(null)}>
              <div className="arrangement-block-head"><GripVertical size={16} aria-hidden="true" /><strong>{block.name}</strong><button type="button" aria-label={`Agregar ${block.name}`} title={`Agregar ${block.name}`} onClick={() => change([...blocks, copyBlock(block)])}><Plus size={16} /></button></div>
              <p>{block.lyrics.replace(/\[[^\]]+\]/g, "").slice(0, 110) || "Instrumental"}</p>
            </article>)}
          </div>
        </aside>
        <section className="arrangement-order">
          <header className="arrangement-order-header"><h3>Ejecucion del evento</h3><button type="button" className="v2-ghost-button" onClick={() => { if (window.confirm("Restaurar el orden base de esta cancion para el evento?")) change(base.map(copyBlock)); }}>Restaurar base</button></header>
          <ol className={`arrangement-block-list${drag ? " is-dragging" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, blocks.length)}>
            {blocks.map((block, index) => <li key={block.id} className="arrangement-block" draggable onDragStart={(event) => { setDrag({ source: "event", index }); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", block.name); }} onDragEnd={() => setDrag(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, index)}>
              <div className="arrangement-block-head"><GripVertical size={16} aria-hidden="true" /><span className="arrangement-position">{index + 1}</span><strong>{block.name}</strong><div className="arrangement-actions">
                <button type="button" title="Subir" aria-label={`Subir ${block.name}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
                <button type="button" title="Bajar" aria-label={`Bajar ${block.name}`} disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
                <button type="button" title="Repetir parte" aria-label={`Repetir ${block.name}`} onClick={() => { const next = [...blocks]; next.splice(index + 1, 0, copyBlock(block)); change(next); }}><Copy size={16} /></button>
                <button type="button" title="Quitar del evento" aria-label={`Quitar ${block.name}`} onClick={() => change(blocks.filter((_, blockIndex) => blockIndex !== index))}><Trash2 size={16} /></button>
              </div></div>
              <p>{block.lyrics.replace(/\[[^\]]+\]/g, "").slice(0, 140) || "Instrumental"}</p>
            </li>)}
            {!blocks.length ? <li className="empty-message">Sin partes en la ejecucion</li> : null}
          </ol>
        </section>
      </fieldset>
    </section>
  );
}
