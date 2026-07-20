"use client";

import { useStore } from "@/lib/store";
import { activeLayerOf } from "@/lib/playback";
import { opKindOf } from "@/lib/sceneColors";

// Stable empty array reference — avoids "getSnapshot should be cached" infinite loop.
const EMPTY_CATALOG: NonNullable<ReturnType<typeof useStore.getState>["genMeta"]>["op_catalog"] =
  [];

export default function BreakpointGutter() {
  const catalog = useStore((s) => s.genMeta?.op_catalog ?? EMPTY_CATALOG);
  const nLayers = useStore((s) => s.genMeta?.num_layers ?? 0);
  const breakpoints = useStore((s) => s.breakpoints);
  const toggleBreakpoint = useStore((s) => s.toggleBreakpoint);
  const opIndex = useStore((s) => s.opIndex);

  if (!catalog.length) return null;

  // Group ops by layer.
  const layerOps: { layer: number; ops: typeof catalog }[] = [];
  const seen = new Set<number>();
  for (const op of catalog) {
    const l = activeLayerOf(op, nLayers);
    if (l == null || seen.has(l)) continue;
    seen.add(l);
    layerOps.push({ layer: l, ops: catalog.filter((o) => activeLayerOf(o, nLayers) === l) });
  }

  return (
    <div className="bp-gutter">
      <div className="bp-title">Breakpoints</div>
      <div className="bp-hint">Click a layer to pause on its first op</div>
      <div className="bp-list">
        {layerOps.map(({ layer, ops }) => {
          const firstOpIdx = ops[0]?.index ?? -1;
          const hasBp = breakpoints.has(firstOpIdx);
          const isActive = activeLayerOf(catalog[opIndex], nLayers) === layer;
          return (
            <button
              key={layer}
              className={"bp-row" + (hasBp ? " has-bp" : "") + (isActive ? " active" : "")}
              onClick={() => toggleBreakpoint(firstOpIdx)}
              title={ops.map((o) => `${o.label} (${opKindOf(o.op_key)})`).join(", ")}
            >
              <span className="bp-dot" />
              <span className="bp-layer">L{layer}</span>
              <span className="bp-ops">{ops.length} ops</span>
              {hasBp && <span className="bp-badge">●</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
