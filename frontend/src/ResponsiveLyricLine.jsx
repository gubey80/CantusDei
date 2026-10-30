import React, { useEffect, useRef, useState } from "react";
import { wrapLyricLine } from "./lyric-layout.js";

export default function ResponsiveLyricLine({ text, chords, showChords, buildChordLine }) {
  const ref = useRef(null);
  const [columns, setColumns] = useState(36);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let disposed = false;
    function measure() {
      if (disposed || !element.clientWidth) return;
      const style = window.getComputedStyle(element);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const charWidth = context.measureText("M").width;
      if (charWidth) setColumns(Math.max(1, Math.floor((element.clientWidth - 2) / charWidth)));
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    document.fonts?.ready.then(measure);
    return () => { disposed = true; observer.disconnect(); };
  }, []);

  return <div ref={ref} className="mobile-lyric-line">
    {wrapLyricLine(text, showChords ? chords : [], columns).map((row, index) => (
      <div className="mobile-lyric-pair" key={index}>
        {showChords && row.chords.length ? <pre className="mobile-chord-row">{buildChordLine(row.text, row.chords)}</pre> : null}
        <pre className="mobile-text-row">{row.text || " "}</pre>
      </div>
    ))}
  </div>;
}
