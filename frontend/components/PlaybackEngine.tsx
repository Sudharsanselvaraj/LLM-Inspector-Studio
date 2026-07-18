"use client";

import { useEffect } from "react";

import { useStore } from "@/lib/store";
import { layerAnchors, anchorPosFor } from "@/lib/playback";
import { CHAPTERS } from "@/lib/walkthrough";

// Pacing is NORMALIZED, not derived from real per-op/per-token compute time
// (the trace records no timing, and fabricating smoothing data is out of scope).
// Every layer step takes the same wall-clock time, scaled only by playSpeed.
const GEN_LAYER_MS = 480; // one "layer by layer" step at 1× speed
const WT_CHAPTER_MS = 4200; // one chapter at 1× speed (reading pace)

/**
 * Headless autoplay engine for the two modes that have a real temporal
 * sequence. Generation plays a recorded trace token by token, layer by layer;
 * Walkthrough auto-advances chapters. Architecture mode has no timeline and is
 * untouched. Pausing (opPlaying / wtPlaying false) tears down the interval, so
 * playback — and, because the follow camera only tracks the active layer, the
 * camera too — freezes at the exact current state.
 */
export default function PlaybackEngine() {
  const mode = useStore((s) => s.mode);
  const opPlaying = useStore((s) => s.opPlaying);
  const wtPlaying = useStore((s) => s.wtPlaying);
  const playSpeed = useStore((s) => s.playSpeed);
  const hasCatalog = useStore((s) => (s.genMeta?.op_catalog?.length ?? 0) > 0);
  const framesLen = useStore((s) => s.genFrames.length);
  const autoStarted = useStore((s) => s.autoStarted);

  // Autoplay by default: the moment a real trace exists, start playing it
  // end-to-end. Only once per generation (autoStarted latches until the next run).
  useEffect(() => {
    if (mode !== "generation") return;
    if (hasCatalog && framesLen > 0 && !autoStarted) {
      useStore.setState({
        opPlaying: true,
        autoStarted: true,
        opIndex: 0,
        playIndex: 0,
      });
    }
  }, [mode, hasCatalog, framesLen, autoStarted]);

  // Generation: advance one layer per tick; roll to the next token's forward
  // pass at the end of the stack; stop at the end of the trace.
  useEffect(() => {
    if (mode !== "generation" || !opPlaying) return;
    const id = setInterval(() => {
      const s = useStore.getState();
      const cat = s.genMeta?.op_catalog ?? [];
      if (cat.length === 0) return;
      const anchors = layerAnchors(cat, s.genMeta?.num_layers ?? 0);
      const pos = anchorPosFor(anchors, s.opIndex);

      if (pos < anchors.length - 1) {
        useStore.setState({ opIndex: anchors[pos + 1] });
      } else if (s.playIndex < s.genFrames.length - 1) {
        useStore.setState({ playIndex: s.playIndex + 1, opIndex: 0 });
      } else if (s.genStatus !== "streaming") {
        useStore.setState({ opPlaying: false }); // end of trace
      }
      // else: streaming and caught up — hold here until more frames arrive.
    }, Math.max(60, GEN_LAYER_MS / playSpeed));
    return () => clearInterval(id);
  }, [mode, opPlaying, playSpeed]);

  // Walkthrough: auto-advance chapters. setState directly (not setWtChapter,
  // which would stop autoplay).
  useEffect(() => {
    if (mode !== "walkthrough" || !wtPlaying) return;
    const id = setInterval(() => {
      const s = useStore.getState();
      if (s.wtChapter >= CHAPTERS.length - 1) useStore.setState({ wtPlaying: false });
      else useStore.setState({ wtChapter: s.wtChapter + 1 });
    }, Math.max(600, WT_CHAPTER_MS / playSpeed));
    return () => clearInterval(id);
  }, [mode, wtPlaying, playSpeed]);

  return null;
}
