"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { opColorOf, opKindOf } from "@/lib/sceneColors";

const EMPTY: never[] = [];

export default function FlameGraph() {
  const catalog = useStore((s) => s.genMeta?.op_catalog ?? EMPTY);
  const [drill, setDrill] = useState<string | null>(null);

  interface FGNode { kind: string; total: number; count: number; children: { label: string; total: number; count: number }[]; }
  const tree = useMemo(() => {
    if (!catalog.length) return null;
    const roots: FGNode[] = [];
    const map = new Map<string, FGNode>();

    for (const op of catalog) {
      const kind = opKindOf(op.op_key) ?? "other";
      let root = map.get(kind);
      if (!root) {
        root = { kind, total: 0, count: 0, children: [] };
        map.set(kind, root);
        roots.push(root);
      }
      root.total += op.param_count;
      root.count++;
      root.children.push({ label: op.label, total: op.param_count, count: 1 });
    }

    roots.sort((a, b) => b.total - a.total);
    const maxTotal = roots[0]?.total ?? 1;
    return { roots, maxTotal };
  }, [catalog]);

  const drilledChildren = useMemo(() => {
    if (!drill || !tree) return null;
    for (const r of tree.roots) {
      if (r.kind === drill) return r.children;
    }
    return null;
  }, [drill, tree]);

  if (!tree || !tree.roots.length) return null;

  const rgb = (k: string): string => {
    const kind = opKindOf(k + ".x") ?? "norm" as const;
    const c = opColorOf(k + ".x", kind);
    const r = Math.round(c[0] * 255);
    const g = Math.round(c[1] * 255);
    const b = Math.round(c[2] * 255);
    return `rgb(${r},${g},${b})`;
  };

  return (
    <div className="flame-graph">
      <div className="fg-title">
        Op Flame Graph
        {drill && <button className="fg-back" onClick={() => setDrill(null)}>← back</button>}
      </div>
      <div className="fg-rows">
        {drilledChildren ? (
          drilledChildren.map((child, i) => {
            const w = (child.total / tree.maxTotal) * 100;
            return (
              <div key={i} className="fg-row" style={{ width: `${Math.max(w, 1)}%` }}>
                <div
                  className="fg-bar"
                  style={{ background: rgb(drill ?? "") }}
                  title={`${child.label} · ${child.total.toLocaleString()} params`}
                >
                  <span className="fg-label">{child.label}</span>
                </div>
              </div>
            );
          })
        ) : (
          tree.roots.map((root) => {
            const w = (root.total / tree.maxTotal) * 100;
            return (
              <div key={root.kind} className="fg-row" style={{ width: `${Math.max(w, 1)}%` }}>
                <button
                  className="fg-bar fg-clickable"
                  style={{ background: rgb(root.kind) }}
                  onClick={() => setDrill(root.kind)}
                  title={`${root.count} ops · ${root.total.toLocaleString()} params`}
                >
                  <span className="fg-label">{root.kind} · {root.count} ops</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
