"use client";

import { useStore } from "@/lib/store";
import { phaseInfo } from "@/lib/playback";

const SPEEDS = [0.5, 1, 2, 4];

function disp(t: string): string {
  const s = t.replace(/\n/g, "\u23CE");
  return s.length === 0 ? "\u2423" : s;
}

export default function BottomBar() {
  const mode = useStore((s) => s.mode);

  if (mode === "generation") return <GenBottomBar />;
  if (mode === "walkthrough") return <WtBottomBar />;
  return null;
}

function GenBottomBar() {
  const frames = useStore((s) => s.genFrames);
  const meta = useStore((s) => s.genMeta);
  const status = useStore((s) => s.genStatus);
  const playIndex = useStore((s) => s.playIndex);
  const opPlaying = useStore((s) => s.opPlaying);
  const toggleOpPlay = useStore((s) => s.toggleOpPlay);
  const skipToNextLayer = useStore((s) => s.skipToNextLayer);
  const skipToNextToken = useStore((s) => s.skipToNextToken);
  const playSpeed = useStore((s) => s.playSpeed);
  const setPlaySpeed = useStore((s) => s.setPlaySpeed);
  const followMode = useStore((s) => s.followMode);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const view2D = useStore((s) => s.view2D);
  const toggleView2D = useStore((s) => s.toggleView2D);
  const genStatus = useStore((s) => s.genStatus);
  const traceSource = useStore((s) => s.traceSource);
  const downloadTrace = useStore((s) => s.downloadTrace);
  const hasCatalog = useStore((s) => (s.genMeta?.op_catalog?.length ?? 0) > 0);
  const lodLevel = useStore((s) => s.lodLevel);
  const setLodLevel = useStore((s) => s.setLodLevel);

  const frame = playIndex >= 0 ? frames[playIndex] : null;
  const promptLen = meta?.prompt_len ?? 0;
  const usesCache = meta?.uses_kv_cache;
  const phase = phaseInfo(frame, promptLen, usesCache);

  const cycleSpeed = () => {
    const i = SPEEDS.indexOf(playSpeed);
    setPlaySpeed(SPEEDS[(i + 1) % SPEEDS.length] ?? 1);
  };

  if (!hasCatalog && frames.length === 0) return null;

  const gen = frames.filter((f) => !f.eos).map((f) => f.chosen.text);
  const TAIL = 8;
  const promptTail = meta?.prompt_tokens.slice(-TAIL) ?? [];
  const truncated = (meta?.prompt_tokens.length ?? 0) > TAIL;

  return (
    <div className="bottom-bar">
      <div className="bb-row bb-controls">
        <button className="pb-btn" onClick={toggleOpPlay} title="Play / pause">
          {opPlaying ? "\u23F8" : "\u25B6"}
        </button>
        <button className="pb-btn" onClick={skipToNextLayer} title="Skip to next layer">
          ⏭
        </button>
        <button className="chip-btn" onClick={skipToNextToken} title="Skip to next token">
          next token ⏩
        </button>
        <button className="chip-btn" onClick={cycleSpeed} title="Animation speed">
          {playSpeed}× speed
        </button>

        {phase && (
          <span className={"phase-badge " + phase.phase} title={phase.detail}>
            {phase.label}
            <em>{phase.detail}</em>
          </span>
        )}

        {frames.length > 0 && (
          <span className="bb-info">
            {playIndex + 1} / {frames.length} ops
          </span>
        )}

        <div className="bb-spacer" />

        <div className="lod-toggle">
          LOD
          {[0, 1, 2].map((n) => (
            <button key={n} className={lodLevel === n ? "on" : ""} onClick={() => setLodLevel(n)}>
              {["all", "mid", "low"][n]}
            </button>
          ))}
        </div>

        <button
          className={"chip-btn" + (followMode ? " on" : "")}
          onClick={toggleFollow}
          title="Camera auto-tracks the active layer"
        >
          Follow {followMode ? "on" : "off"}
        </button>
        <button
          className={"chip-btn" + (view2D ? " on" : "")}
          onClick={toggleView2D}
        >
          {view2D ? "3D" : "2D"}
        </button>

        {genStatus === "done" && traceSource === "live" && (
          <button className="chip-btn" onClick={downloadTrace} title="Download .tokenprint.json">
            ↓ trace
          </button>
        )}
        {traceSource === "file" && (
          <span className="phase-badge recorded">recorded</span>
        )}
      </div>

      <div className="bb-row bb-tokens">
        <span className="ts-label">tokens</span>
        {truncated && <span className="tok prompt">…</span>}
        {promptTail.map((t, i) => (
          <span key={"p" + i} className="tok prompt">
            {disp(t)}
          </span>
        ))}
        {gen.map((t, i) => (
          <span
            key={"g" + i}
            className={"tok gen" + (i === gen.length - 1 ? " last" : "")}
          >
            {disp(t)}
          </span>
        ))}
        {status === "streaming" && <span className="tok cursor">▌</span>}
      </div>
    </div>
  );
}

function WtBottomBar() {
  const prev = useStore((s) => s.prevChapter);
  const next = useStore((s) => s.nextChapter);
  const wtPlaying = useStore((s) => s.wtPlaying);
  const toggleWtPlay = useStore((s) => s.toggleWtPlay);
  const chapterIdx = useStore((s) => s.wtChapter);

  return (
    <div className="bottom-bar">
      <div className="bb-row bb-controls">
        <button className="pb-btn" onClick={toggleWtPlay} title="Play / pause walkthrough">
          {wtPlaying ? "\u23F8" : "\u25B6"}
        </button>
        <button className="chip-btn" onClick={prev} title="Previous chapter">
          ◀ prev
        </button>
        <button className="chip-btn" onClick={next} title="Next chapter">
          next ▶
        </button>
        <span className="bb-info">Chapter {chapterIdx + 1}</span>
      </div>
    </div>
  );
}
