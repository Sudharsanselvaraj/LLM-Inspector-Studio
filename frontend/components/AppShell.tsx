"use client";

import { useEffect, useState, useRef } from "react";
import { useStore, restoreFromUrl } from "@/lib/store";
import SceneLoader from "./SceneLoader";
import PlaybackEngine from "./PlaybackEngine";
import TopBar from "./ui/TopBar";
import Sidebar from "./ui/Sidebar";
import RightPanel from "./ui/RightPanel";
import BottomBar from "./ui/BottomBar";
import PredictionTimeline from "./ui/PredictionTimeline";
import PredictionGame from "./ui/PredictionGame";
import DebugInspector from "./ui/DebugInspector";
import HeadInspector from "./ui/HeadInspector";
import DataExport from "./ui/DataExport";
import TimingReadout from "./ui/TimingReadout";
import ConfigDiff from "./ui/ConfigDiff";
import TokenDetailView from "./ui/TokenDetailView";
import KvCacheTimeline from "./ui/KvCacheTimeline";
import DistributionPanel from "./ui/DistributionPanel";
import TileView from "./ui/TileView";
import DebuggerPane from "./ui/DebuggerPane";
import { fmtShape } from "@/lib/format";
import { roleLabel } from "@/lib/tensorName";
import { useKeyboard } from "@/lib/useKeyboard";

export default function AppShell() {
  const loadArchitecture = useStore((s) => s.loadArchitecture);
  const arch = useStore((s) => s.arch);
  const mode = useStore((s) => s.mode);
  const hovName = useStore((s) => s.hoveredTensor);
  const devMode = useStore((s) => s.devMode);
  const tileView = useStore((s) => s.tileView);
  const lightMode = useStore((s) => s.lightMode);
  const [mouse, setMouse] = useState({ x: 0, y: 0, inside: false });

  useKeyboard();

  // Load the live Qwen model's architecture once on mount.
  useEffect(() => {
    // Restore snapshot URL params first.
    const snapshot = restoreFromUrl();
    if (snapshot.mode) useStore.getState().setMode(snapshot.mode);
    if (snapshot.playIndex !== undefined) useStore.getState().setPlayIndex(snapshot.playIndex);
    if (snapshot.opIndex !== undefined) useStore.getState().setOpIndex(snapshot.opIndex);
    if (snapshot.wtChapter !== undefined) useStore.getState().setWtChapter(snapshot.wtChapter);
    if (!arch) loadArchitecture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-load demo trace on first load when no backend is available.
  const demoLoaded = useRef(false);
  const archLoading = useStore((s) => s.archLoading);
  const archError = useStore((s) => s.archError);
  const loadTrace = useStore((s) => s.loadTrace);
  useEffect(() => {
    if (demoLoaded.current) return;
    if (archLoading || !archError) return;
    if (mode !== "explorer") return; // URL-specified mode means intentional
    demoLoaded.current = true;
    (async () => {
      const res = await fetch("/demo/hello-world.json");
      if (!res.ok) return;
      const trace = await res.json();
      await loadTrace(trace);
      // Start mid-replay so user sees motion immediately.
      useStore.setState({ playIndex: 3, isPlaying: true, opPlaying: true });
    })();
  }, [archLoading, archError, mode, loadTrace]);

  const hov = hovName ? arch?.tensors.find((t) => t.name === hovName) : null;

  return (
    <div className={`app mode-${mode}${lightMode ? " light" : ""}`}>
      <PlaybackEngine />
      <TopBar />
      <Sidebar />
      <div
        className="canvas-area"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMouse({ x: e.clientX - r.left, y: e.clientY - r.top, inside: true });
        }}
        onMouseLeave={() => setMouse((m) => ({ ...m, inside: false }))}
      >
        {mode === "debugger" ? (
          <DebuggerPane />
        ) : tileView ? (
          <TileView />
        ) : (
          <SceneLoader />
        )}
        {mode === "walkthrough" && <PredictionTimeline />}
        {mode === "walkthrough" && <TokenDetailView />}
        {devMode && <DebugInspector />}
        {devMode && <HeadInspector />}
        {devMode && <DataExport />}
        {devMode && <TimingReadout />}
        {devMode && <DistributionPanel />}
        {devMode && <ConfigDiff />}

        {mode === "explorer" && hov && mouse.inside && (
          <div
            className="hover-tip"
            style={{
              left: Math.min(mouse.x + 16, window.innerWidth - 660),
              top: mouse.y + 16,
            }}
          >
            <div className="ht-title">
              {roleLabel(hov.role)}
              {hov.layer != null ? ` — Layer ${hov.layer}` : ""}
            </div>
            <div className="ht-name">{hov.name}</div>
            <div className="ht-meta">
              {fmtShape(hov.shape)} · {hov.dtype}
            </div>
          </div>
        )}
        {!tileView && (
          <div className="canvas-hint">
            drag to orbit · scroll to zoom · <kbd>Space</kbd> play · <kbd>F10</kbd> op · <kbd>J</kbd><kbd>K</kbd> token
          </div>
        )}
      </div>
      <BottomBar />
      <RightPanel />
    </div>
  );
}
