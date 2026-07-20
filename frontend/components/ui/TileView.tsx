"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { fmtShape } from "@/lib/format";
import { roleLabel } from "@/lib/tensorName";

/**
 * Phase 2: Tile/grid view of the architecture's tensors.
 * Alternative to the 3D scene — flat 2D tile grid grouped by role.
 */
export default function TileView() {
  const arch = useStore((s) => s.arch);
  const selName = useStore((s) => s.selectedTensor);
  const setSel = useStore((s) => s.setSelectedTensor);
  const setHover = useStore((s) => s.setHoveredTensor);
  const [filter, setFilter] = useState("");

  if (!arch) return null;

  const tensors = arch.tensors.filter(
    (t) => !filter || t.name.toLowerCase().includes(filter.toLowerCase()),
  );

  const groups = new Map<string, typeof tensors>();
  for (const t of tensors) {
    const key = roleLabel(t.role);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return (
    <div className="tileview">
      <div className="tv-header">
        <span className="tv-title">Tensor Grid</span>
        <span className="tv-count">{tensors.length} tensors</span>
      </div>
      <input
        className="tv-search"
        placeholder="Filter tensors…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="tv-groups">
        {[...groups.entries()].map(([role, group]) => (
          <div key={role} className="tv-group">
            <div className="tv-group-title">{role}</div>
            <div className="tv-group-grid">
              {group.map((t) => (
                <div
                  key={t.name}
                  className={`tv-tile${t.name === selName ? " active" : ""}`}
                  onClick={() => setSel(t.name === selName ? null : t.name)}
                  onMouseEnter={() => setHover(t.name)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="tv-tile-name" title={t.name}>
                    {t.name.includes(".")
                      ? t.name.slice(t.name.lastIndexOf(".") + 1)
                      : t.name}
                  </div>
                  <div className="tv-tile-shape">{fmtShape(t.shape)}</div>
                  <div className="tv-tile-meta">
                    {t.dtype}
                    {t.layer != null ? ` · L${t.layer}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
