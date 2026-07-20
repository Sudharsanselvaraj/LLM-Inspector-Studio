"use client";

import { useStore } from "@/lib/store";
import { useMemo } from "react";

/**
 * Phase 2: Per-layer activation distribution panel.
 * Shows a histogram of mean |activation| for each layer in the active frame.
 */
export default function DistributionPanel() {
  const playIndex = useStore((s) => s.playIndex);
  const frame = useStore(
    (s) => (s.playIndex >= 0 ? s.genFrames[s.playIndex] : null),
  );

  const entries = useMemo(() => {
    if (!frame?.layer_stats?.length) return null;
    const stats = frame.layer_stats;
    const max = Math.max(1e-8, ...stats);
    return stats.map((v, i) => ({
      label: i === 0 ? "emb" : i === stats.length - 1 ? "head" : `L${i}`,
      value: v,
      pct: v / max,
    }));
  }, [frame]);

  if (!entries) return null;

  return (
    <div className="dist-panel">
      <div className="dist-title">Layer Activation Distribution</div>
      <div className="dist-subtitle">
        Mean |activation| across all neurons, by layer
      </div>
      <div className="dist-chart">
        {entries.map((e) => (
          <div key={e.label} className="dist-bar-row" title={`${e.label}: ${e.value.toFixed(4)}`}>
            <span className="dist-bar-label">{e.label}</span>
            <div className="dist-bar-track">
              <div
                className="dist-bar-fill"
                style={{ width: `${e.pct * 100}%` }}
              />
            </div>
            <span className="dist-bar-val">{e.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
