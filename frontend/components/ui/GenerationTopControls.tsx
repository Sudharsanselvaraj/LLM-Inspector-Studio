"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";

export default function GenerationTopControls() {
  const opPlaying = useStore((s) => s.opPlaying);
  const toggleOpPlay = useStore((s) => s.toggleOpPlay);
  const stepOp = useStore((s) => s.stepOp);
  const followMode = useStore((s) => s.followMode);
  const toggleFollow = useStore((s) => s.toggleFollow);
  const view2D = useStore((s) => s.view2D);
  const toggleView2D = useStore((s) => s.toggleView2D);
  const hasCatalog = useStore((s) => (s.genMeta?.op_catalog?.length ?? 0) > 0);

  // Op-walkthrough ticker: advance one operation at a time while playing.
  useEffect(() => {
    if (!opPlaying) return;
    const id = setInterval(() => {
      const s = useStore.getState();
      const n = s.genMeta?.op_catalog?.length ?? 0;
      if (s.opIndex >= n - 1) useStore.setState({ opPlaying: false });
      else useStore.setState({ opIndex: s.opIndex + 1 });
    }, 320);
    return () => clearInterval(id);
  }, [opPlaying]);

  if (!hasCatalog) return null;

  return (
    <div className="gen-topbar">
      <button className="pb-btn" onClick={toggleOpPlay} title="Play / pause op walkthrough">
        {opPlaying ? "⏸" : "▶"}
      </button>
      <button className="pb-btn" onClick={() => stepOp(1)} title="Step forward">
        ⏭
      </button>
      <button
        className={"chip-btn" + (followMode ? " on" : "")}
        onClick={toggleFollow}
      >
        Follow mode {followMode ? "on" : "off"}
      </button>
      <button
        className={"chip-btn" + (view2D ? " on" : "")}
        onClick={toggleView2D}
      >
        {view2D ? "3D View" : "2D View"}
      </button>
    </div>
  );
}
