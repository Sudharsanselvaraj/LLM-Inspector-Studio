"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { CHAPTERS, REF_MODELS } from "@/lib/walkthrough";
import { fmtCount } from "@/lib/format";

export default function WalkthroughPane() {
  const data = useStore((s) => s.data);
  const analyze = useStore((s) => s.analyze);
  const chapterIdx = useStore((s) => s.wtChapter);
  const setWtChapter = useStore((s) => s.setWtChapter);
  const next = useStore((s) => s.nextChapter);
  const prev = useStore((s) => s.prevChapter);
  const wtModel = useStore((s) => s.wtModel);
  const setWtModel = useStore((s) => s.setWtModel);
  const wtPlaying = useStore((s) => s.wtPlaying);
  const toggleWtPlay = useStore((s) => s.toggleWtPlay);
  const playSpeed = useStore((s) => s.playSpeed);
  const setPlaySpeed = useStore((s) => s.setPlaySpeed);

  // Load the real example forward pass once.
  useEffect(() => {
    if (!data) analyze("The cat sat on the mat.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idx = Math.min(chapterIdx, CHAPTERS.length - 1);
  const ch = CHAPTERS[idx];
  const lines = ch.build(data);

  return (
    <div className="wt-pane">
      <div className="wt-nav">
        <button className="pb-btn" onClick={prev} disabled={idx <= 0}>
          ‹
        </button>
        <div className="wt-chaptertitle">Chapter: {ch.title}</div>
        <button
          className="pb-btn"
          onClick={next}
          disabled={idx >= CHAPTERS.length - 1}
        >
          ›
        </button>
      </div>

      <div className="wt-play">
        <button
          className="pb-btn"
          onClick={toggleWtPlay}
          disabled={idx >= CHAPTERS.length - 1 && !wtPlaying}
          title="Autoplay chapters"
        >
          {wtPlaying ? "⏸" : "▶"}
        </button>
        <button
          className="chip-btn"
          onClick={() => setPlaySpeed(playSpeed >= 4 ? 0.5 : playSpeed * 2)}
          title="Autoplay speed"
        >
          {playSpeed}× speed
        </button>
        <span className="side-hint">
          {wtPlaying ? "playing walkthrough…" : "auto-advance chapters"}
        </span>
      </div>

      <div className="side-title" style={{ marginTop: 6 }}>
        Model scale
      </div>
      <select
        className="wt-modelsel"
        value={wtModel}
        onChange={(e) => setWtModel(e.target.value)}
      >
        {REF_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {fmtCount(m.params)} params
          </option>
        ))}
      </select>

      <div className="wt-body">
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>

      <div className="side-title">Contents</div>
      <div className="wt-toc">
        {CHAPTERS.map((c, i) => (
          <button
            key={c.id}
            className={"wt-tocitem" + (i === idx ? " active" : "")}
            onClick={() => setWtChapter(i)}
          >
            {c.title}
          </button>
        ))}
      </div>
    </div>
  );
}
