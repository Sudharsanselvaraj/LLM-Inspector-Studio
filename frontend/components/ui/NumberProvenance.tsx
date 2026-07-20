"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

const EMPTY: never[] = [];

export default function NumberProvenance() {
  const catalog = useStore((s) => s.genMeta?.op_catalog ?? EMPTY);
  const provenanceTrail = useStore((s) => s.provenanceTrail);
  const setProvenanceTrail = useStore((s) => s.setProvenanceTrail);
  const setOpIndex = useStore((s) => s.setOpIndex);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const buildTrail = (opIdx: number) => {
    const op = catalog[opIdx];
    if (!op) return;
    setActiveIdx(opIdx);
    const prevOp = catalog[Math.max(0, opIdx - 1)];
    const trail = [
      { opIndex: prevOp.index, tensor: prevOp.label, slice: `out[0:${prevOp.out_dim ?? "?"}]` },
      { opIndex: op.index, tensor: op.label, slice: `weight[0:${op.in_dim ?? "?"},0:${op.out_dim ?? "?"}]` },
    ];
    setProvenanceTrail(trail);
  };

  const firstWithParams = catalog.findIndex((o) => o.param_count > 0);

  return (
    <div className="number-provenance">
      <div className="np-title">Number Provenance</div>
      <div className="np-hint">Click an op to see its position in the compute graph. Real tensor values require backend support (GET /debug/tensor).</div>
      <div className="np-ops">
        {catalog.slice(0, 20).map((op, i) => (
          <button
            key={i}
            className={"np-op" + (activeIdx === op.index ? " active" : "")}
            onClick={() => buildTrail(op.index)}
            title={`${op.label} (${op.op_key})`}
          >
            {op.label}
          </button>
        ))}
        {catalog.length > 20 && <span className="np-more">+{catalog.length - 20} more</span>}
      </div>
      {provenanceTrail.length > 0 && (
        <div className="np-trail">
          {provenanceTrail.map((t, i) => (
            <div key={i} className="np-step">
              <span className="np-step-op" onClick={() => setOpIndex(t.opIndex)}>
                {catalog[t.opIndex]?.label ?? `op ${t.opIndex}`}
              </span>
              <span className="np-arrow">→</span>
              <span className="np-step-tensor">{t.tensor}[{t.slice}]</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
