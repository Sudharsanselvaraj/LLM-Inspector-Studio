"use client";

import { useStore } from "@/lib/store";
import { fmtShape, fmtCount } from "@/lib/format";
import DebugInspector from "./DebugInspector";
import HeadInspector from "./HeadInspector";
import TimingReadout from "./TimingReadout";
import DistributionPanel from "./DistributionPanel";
import ConfigDiff from "./ConfigDiff";
import DataExport from "./DataExport";
import AblationPanel from "./AblationPanel";

/**
 * Phase 2: Dedicated debugger mode — a dashboard of all dev tools
 * arranged in a tiled layout within the canvas area.
 */
export default function DebuggerPane() {
  const arch = useStore((s) => s.arch);
  const opIndex = useStore((s) => s.opIndex);
  const catalog = useStore((s) => s.genMeta?.op_catalog ?? []);

  if (!arch) {
    return (
      <div className="dbg-empty">
        Load a model first, then enter Debugger mode to inspect every tensor,
        benchmark layer timing, compare configs, or ablate heads.
      </div>
    );
  }

  return (
    <div className="dbg-dashboard">
      <div className="dbg-toolbar">
        <span className="dbg-title">Debugger Dashboard</span>
        <span className="dbg-subtitle">
          {arch.metadata.name} · {arch.tensor_count} tensors ·{" "}
          {catalog.length > 0 ? `${opIndex + 1}/${catalog.length} ops` : "no generation data"}
        </span>
      </div>

      <div className="dbg-grid">
        <div className="dbg-card dbg-card-wide">
          <div className="dbg-card-title">Tensor Inspector</div>
          <DebugInspector />
        </div>

        <div className="dbg-card">
          <div className="dbg-card-title">Attention Heads</div>
          <HeadInspector />
        </div>

        <div className="dbg-card">
          <div className="dbg-card-title">Layer Timing</div>
          <TimingReadout />
        </div>

        <div className="dbg-card">
          <div className="dbg-card-title">Activation Distribution</div>
          <DistributionPanel />
        </div>

        <div className="dbg-card">
          <div className="dbg-card-title">Config Diff</div>
          <ConfigDiff />
        </div>

        <div className="dbg-card">
          <div className="dbg-card-title">Ablation</div>
          <AblationPanel />
        </div>

        <div className="dbg-card">
          <div className="dbg-card-title">Data Export</div>
          <DataExport />
        </div>
      </div>
    </div>
  );
}
