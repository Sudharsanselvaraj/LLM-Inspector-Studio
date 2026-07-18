"use client";

import { useStore } from "@/lib/store";
import { fmtCount } from "@/lib/format";
import {
  contextOp,
  detectArch,
  getFormula,
  roleToOpKey,
  type OpKey,
} from "@/lib/formulas";
import { activeLayerOf, phaseInfo } from "@/lib/playback";
import Formula from "./Formula";

function WeightPreview({ data }: { data: number[][] }) {
  if (!data?.length) return null;
  const flat = data.flat();
  const max = Math.max(1e-6, ...flat.map((v) => Math.abs(v)));
  return (
    <div className="wp-grid">
      {data.map((row, i) =>
        row.map((v, j) => {
          const t = v / max; // -1..1
          const col =
            t >= 0
              ? `rgba(87,170,255,${0.15 + 0.85 * t})`
              : `rgba(255,120,140,${0.15 + 0.85 * -t})`;
          return (
            <div
              key={`${i}-${j}`}
              className="wp-cell"
              style={{ background: col }}
              title={v.toFixed(3)}
            />
          );
        }),
      )}
    </div>
  );
}

// Map an op_key to the formula OpKey (they share the same strings except
// "attention" which is already a valid OpKey).
function toFormulaKey(op_key: string): OpKey | null {
  if (op_key === "attention") return "attention";
  return roleToOpKey(op_key);
}

export default function GenerationPanel() {
  const meta = useStore((s) => s.genMeta);
  const opIndex = useStore((s) => s.opIndex);
  const stepOp = useStore((s) => s.stepOp);
  const status = useStore((s) => s.genStatus);
  const showEquations = useStore((s) => s.showEquations);
  const devMode = useStore((s) => s.devMode);
  const playIndex = useStore((s) => s.playIndex);
  const frame = useStore((s) => (s.playIndex >= 0 ? s.genFrames[s.playIndex] : null));

  const catalog = meta?.op_catalog ?? [];
  if (catalog.length === 0) {
    return (
      <div className="rightpanel">
        <div className="rp-empty">
          {status === "streaming"
            ? "streaming a real generation…"
            : "Enter a prompt in the sidebar and press Generate to stream a real forward-pass walkthrough."}
        </div>
      </div>
    );
  }

  const op = catalog[Math.min(opIndex, catalog.length - 1)];
  const family = detectArch(meta?.architecture);
  const fk = toFormulaKey(op.op_key);
  const blockKey = fk ? contextOp(fk) : null;
  const nLayers = meta?.num_layers ?? 0;
  const activeLayer = activeLayerOf(op, nLayers);
  const phase = phaseInfo(frame, meta?.prompt_len ?? 0, meta?.uses_kv_cache);

  return (
    <div className="rightpanel genpanel">
      <div className="gp-head">
        <div>
          <div className="gp-layer">
            {op.layer != null ? `Layer ${op.layer}` : "Model"}
          </div>
          <div className="gp-op">{op.label}</div>
        </div>
        <div className="gp-params">
          <span>PARAMETERS USED</span>
          <b>{fmtCount(op.cumulative_params)}</b>
        </div>
      </div>

      {phase && (
        <div className={"gp-phase " + phase.phase}>
          <b>{phase.label}</b> · {phase.detail}
        </div>
      )}

      {showEquations &&
        blockKey &&
        getFormula(family, blockKey).latex.map((l, i) => (
          <Formula key={i} latex={l} />
        ))}

      <div className="gp-crumb">
        <div className="gp-crumb-nav">
          <button className="pb-btn" onClick={() => stepOp(-1)} disabled={opIndex <= 0}>
            ‹
          </button>
          <button
            className="pb-btn"
            onClick={() => stepOp(1)}
            disabled={opIndex >= catalog.length - 1}
          >
            ›
          </button>
          <span className="gp-crumb-idx">
            op {opIndex + 1} / {catalog.length}
          </span>
        </div>

        <div className="gp-crumb-title">{op.label}</div>
        {op.layer != null && <div className="gp-crumb-sub">Layer {op.layer}</div>}

        {op.weight_preview.length > 0 && <WeightPreview data={op.weight_preview} />}

        {showEquations && fk && (
          <div className="gp-crumb-formula">
            {getFormula(family, fk).latex.map((l, i) => (
              <Formula key={i} latex={l} />
            ))}
          </div>
        )}

        <div className="gp-dims">
          {op.in_dim != null && (
            <div>
              <span>INPUT DIM</span>
              <b>{op.in_dim.toLocaleString()}</b>
            </div>
          )}
          {op.out_dim != null && (
            <div>
              <span>OUTPUT DIM</span>
              <b>{op.out_dim.toLocaleString()}</b>
            </div>
          )}
          {op.bias_dim != null && (
            <div>
              <span>BIAS DIM</span>
              <b>{op.bias_dim.toLocaleString()}</b>
            </div>
          )}
        </div>

        <div className="gp-nparams">
          <span>NUMBER OF PARAMETERS</span>
          <b>{op.param_count.toLocaleString()}</b>
        </div>
      </div>

      {devMode && (
        <div className="gp-dev">
          <div className="gp-dev-title">Dev · raw sampled values</div>
          <div className="gp-dev-row">
            <span>op index</span>
            <b>
              {op.index} / {catalog.length - 1}
            </b>
          </div>
          <div className="gp-dev-row">
            <span>op key</span>
            <b>{op.op_key}</b>
          </div>
          {frame && activeLayer != null && frame.layer_stats?.length > 0 && (
            <div className="gp-dev-row">
              <span>mean|act| L{activeLayer}</span>
              <b>
                {frame.layer_stats[
                  Math.max(0, Math.min(activeLayer + 1, frame.layer_stats.length - 1))
                ]?.toFixed(4)}
              </b>
            </div>
          )}
          {frame && (
            <div className="gp-dev-row">
              <span>token logprob</span>
              <b>{frame.chosen.logprob.toFixed(4)}</b>
            </div>
          )}
          {op.weight_preview.length > 0 && (
            <>
              <div className="gp-dev-sub">
                weight[0, :8] · tensor sample (real values)
              </div>
              <div className="gp-dev-vals">
                {op.weight_preview[0].map((v, i) => (
                  <span key={i}>{v.toFixed(3)}</span>
                ))}
              </div>
            </>
          )}
          <div className="gp-dev-note">
            Sampled slices (8×8 weight preview, per-layer stat) — not the full
            tensors. Real numbers from the loaded model / recorded trace.
          </div>
        </div>
      )}
    </div>
  );
}
