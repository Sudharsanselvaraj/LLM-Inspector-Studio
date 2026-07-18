"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import SceneLoader from "./SceneLoader";
import PlaybackEngine from "./PlaybackEngine";
import TopBar from "./ui/TopBar";
import Sidebar from "./ui/Sidebar";
import RightPanel from "./ui/RightPanel";
import GenerationTopControls from "./ui/GenerationTopControls";
import TokenStrip from "./ui/TokenStrip";
import { fmtShape } from "@/lib/format";
import { roleLabel } from "@/lib/tensorName";

export default function AppShell() {
  const loadArchitecture = useStore((s) => s.loadArchitecture);
  const arch = useStore((s) => s.arch);
  const mode = useStore((s) => s.mode);
  const hovName = useStore((s) => s.hoveredTensor);
  const [mouse, setMouse] = useState({ x: 0, y: 0, inside: false });

  // Load the live Qwen model's architecture once on mount.
  useEffect(() => {
    if (!arch) loadArchitecture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hov = hovName ? arch?.tensors.find((t) => t.name === hovName) : null;

  return (
    <div className="app">
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
        <SceneLoader />
        {mode === "generation" && <GenerationTopControls />}
        {mode === "generation" && <TokenStrip />}
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
        <div className="canvas-hint">drag to orbit · scroll to zoom</div>
      </div>
      <RightPanel />
    </div>
  );
}
