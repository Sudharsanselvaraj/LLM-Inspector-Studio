"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { phaseInfo } from "@/lib/playback";

const SPEEDS = [0.5, 1, 2, 4];

/**
 * Floating transport for Generation autoplay. The actual ticking lives in
 * <PlaybackEngine/>; this is just the controls + live phase readout. Play/pause,
 * skip-to-next-layer / -token, a speed multiplier (pacing only), follow-mode,
 * 2D/3D, and a settings popover for the optional overlays.
 */
export default function GenerationTopControls() {
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
  const hasCatalog = useStore((s) => (s.genMeta?.op_catalog?.length ?? 0) > 0);

  // Live KV-cache phase for the token currently being replayed. Select raw
  // values only — phaseInfo builds a fresh object, so calling it inside the
  // selector would break zustand's snapshot caching.
  const frame = useStore((s) => (s.playIndex >= 0 ? s.genFrames[s.playIndex] : null));
  const promptLen = useStore((s) => s.genMeta?.prompt_len ?? 0);
  const usesCache = useStore((s) => s.genMeta?.uses_kv_cache);
  const phase = phaseInfo(frame, promptLen, usesCache);

  const [showSettings, setShowSettings] = useState(false);

  if (!hasCatalog) return null;

  const cycleSpeed = () => {
    const i = SPEEDS.indexOf(playSpeed);
    setPlaySpeed(SPEEDS[(i + 1) % SPEEDS.length] ?? 1);
  };

  return (
    <div className="gen-topbar">
      <button className="pb-btn" onClick={toggleOpPlay} title="Play / pause (autoplay)">
        {opPlaying ? "⏸" : "▶"}
      </button>
      <button className="pb-btn" onClick={skipToNextLayer} title="Skip to next layer">
        ⏭
      </button>
      <button className="chip-btn" onClick={skipToNextToken} title="Skip to next token">
        next token ⏩
      </button>
      <button className="chip-btn" onClick={cycleSpeed} title="Animation speed (pacing only)">
        {playSpeed}× speed
      </button>

      {phase && (
        <span
          className={"phase-badge " + phase.phase}
          title={phase.detail}
        >
          {phase.label}
          <em>{phase.detail}</em>
        </span>
      )}

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
        {view2D ? "3D View" : "2D View"}
      </button>

      <button
        className={"chip-btn" + (showSettings ? " on" : "")}
        onClick={() => setShowSettings((v) => !v)}
        title="Overlays & display settings"
      >
        ⚙
      </button>

      {showSettings && <SettingsPopover />}
    </div>
  );
}

function SettingsPopover() {
  const showEquations = useStore((s) => s.showEquations);
  const toggleEquations = useStore((s) => s.toggleEquations);
  const devMode = useStore((s) => s.devMode);
  const toggleDevMode = useStore((s) => s.toggleDevMode);
  const brightness = useStore((s) => s.brightness);
  const setBrightness = useStore((s) => s.setBrightness);

  return (
    <div className="gen-settings">
      <label className="gen-setting">
        <span>Equations</span>
        <input type="checkbox" checked={showEquations} onChange={toggleEquations} />
      </label>
      <label className="gen-setting">
        <span>Dev mode (raw values)</span>
        <input type="checkbox" checked={devMode} onChange={toggleDevMode} />
      </label>
      <label className="gen-setting col">
        <span>Brightness · {brightness.toFixed(2)}×</span>
        <input
          type="range"
          min={0.3}
          max={2.5}
          step={0.05}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
