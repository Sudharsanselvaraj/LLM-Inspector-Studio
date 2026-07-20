"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";

type SortKey = "layer" | "meanAct" | "maxAct" | "tokens" | "heads";
type SortDir = "asc" | "desc";

const EMPTY: never[] = [];

export default function LayerTable() {
  const frames = useStore((s) => s.genFrames);
  const nLayers = useStore((s) => s.genMeta?.num_layers ?? 0);
  const opIndex = useStore((s) => s.opIndex);
  const catalog = useStore((s) => s.genMeta?.op_catalog ?? EMPTY);
  const activeLayer = useMemo(() => {
    if (!catalog.length || opIndex >= catalog.length) return null;
    const op = catalog[opIndex];
    return op.layer ?? (op.op_key === "embedding" ? -1 : op.op_key === "output" ? nLayers : null);
  }, [catalog, opIndex, nLayers]);

  const [sortKey, setSortKey] = useState<SortKey>("layer");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows = useMemo(() => {
    if (!frames.length) return [];
    const perLayer: { sum: number; max: number; count: number }[] = Array.from({ length: nLayers }, () => ({ sum: 0, max: 0, count: 0 }));
    for (const f of frames) {
      for (let l = 0; l < nLayers && l < f.layer_stats.length; l++) {
        const v = f.layer_stats[l];
        perLayer[l].sum += v;
        perLayer[l].max = Math.max(perLayer[l].max, v);
        perLayer[l].count++;
      }
    }
    return perLayer.map((pl, i) => ({
      layer: i,
      meanAct: pl.count > 0 ? pl.sum / pl.count : 0,
      maxAct: pl.max,
      tokens: pl.count,
      heads: 0,
    }));
  }, [frames, nLayers]);

  const sorted = useMemo(() => {
    const s = [...rows];
    s.sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      return (a[sortKey] - b[sortKey]) * mul;
    });
    return s;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  if (!rows.length) return null;

  const sortArrow = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="layer-table">
      <div className="lt-title">Layer Metrics</div>
      <table className="lt-tbl">
        <thead>
          <tr>
            <th onClick={() => toggleSort("layer")}>Layer{sortArrow("layer")}</th>
            <th onClick={() => toggleSort("meanAct")}>Mean Act{sortArrow("meanAct")}</th>
            <th onClick={() => toggleSort("maxAct")}>Max Act{sortArrow("maxAct")}</th>
            <th onClick={() => toggleSort("tokens")}>Tokens{sortArrow("tokens")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.layer} className={r.layer === activeLayer ? "active-row" : ""}>
              <td>{r.layer}</td>
              <td>{r.meanAct.toFixed(4)}</td>
              <td>{r.maxAct.toFixed(4)}</td>
              <td>{r.tokens}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
