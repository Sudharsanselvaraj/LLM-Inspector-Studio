"use client";

import { useStore } from "@/lib/store";
import { fmtCount, fmtShape } from "@/lib/format";
import { roleLabel } from "@/lib/tensorName";
import {
  contextOp,
  detectArch,
  getFormula,
  roleToOpKey,
} from "@/lib/formulas";
import Formula from "./Formula";
import GenerationPanel from "./GenerationPanel";
import LogitLensPanel from "./LogitLensPanel";

function valueNote(dtype: string): string {
  return /^(F32|F16|BF16|float)/i.test(dtype)
    ? "Float tensor — real values are inspectable."
    : `Quantized (${dtype}) — values need block dequantization to inspect; shape/offset/type are exact.`;
}

const FAMILY_SUMMARY: Record<string, string> = {
  llama: "RMSNorm · RoPE · SwiGLU · GQA",
  gpt2: "LayerNorm · Learned Pos · GELU",
};

export default function RightPanel() {
  const mode = useStore((s) => s.mode);
  const arch = useStore((s) => s.arch);
  const selName = useStore((s) => s.selectedTensor);
  const hovName = useStore((s) => s.hoveredTensor);
  const data = useStore((s) => s.data);

  if (mode === "generation") return <GenerationPanel />;
  if (mode === "debugger") {
    return (
      <div className="rightpanel">
        <div className="side-title">Debugger</div>
        <div className="rp-overview">
          {arch ? (
            <>
              <div className="rp-modelname">{arch.metadata.name}</div>
              <div className="side-hint">
                All debug tools are shown in the main canvas area. Select a
                tensor in the sidebar to inspect.
              </div>
              <div className="rp-statgrid">
                <div className="rp-stat">
                  <span>Tensors</span>
                  <b>{arch.tensor_count}</b>
                </div>
                <div className="rp-stat">
                  <span>Layers</span>
                  <b>{arch.metadata.num_layers}</b>
                </div>
                <div className="rp-stat">
                  <span>Heads</span>
                  <b>{arch.metadata.num_heads}</b>
                </div>
                <div className="rp-stat">
                  <span>Params</span>
                  <b>{fmtCount(arch.metadata.total_params)}</b>
                </div>
              </div>
            </>
          ) : (
            <div className="rp-empty">Load a model to begin debugging.</div>
          )}
        </div>
      </div>
    );
  }
  if (mode === "walkthrough") {
    const d = data;
    return (
      <div className="rightpanel">
        <div className="side-title">Worked Example</div>
        {d ? (
          <>
            <div className="family-chip">
              real forward pass · <span>{d.model}</span>
            </div>
            <div className="td-grid">
              <div>
                <span>Sentence</span>
                <b style={{ fontSize: 12 }}>{d.sentence}</b>
              </div>
              <div>
                <span>Tokens</span>
                <b>{d.tokens.length}</b>
              </div>
              <div>
                <span>Layers</span>
                <b>{d.num_layers}</b>
              </div>
              <div>
                <span>Heads</span>
                <b>{d.num_heads}</b>
              </div>
              <div>
                <span>Hidden</span>
                <b>{d.hidden_size}</b>
              </div>
            </div>
            <div className="td-note">
              Every number in the reading pane is read from this real forward
              pass — no illustrative values.
            </div>
            <LogitLensPanel />
          </>
        ) : (
          <div className="rp-empty">
            <div className="wt-spinner" />
            <span>Loading the real example forward pass…</span>
          </div>
        )}
      </div>
    );
  }

  const name = selName ?? hovName;
  const t = name ? arch?.tensors.find((x) => x.name === name) : null;

  const family = detectArch(arch?.metadata.architecture);
  const opKey = t ? roleToOpKey(t.role) : null;

  return (
    <div className="rightpanel">
      <div className="side-title">Tensor Inspector</div>
      {arch && (
        <div className="family-chip">
          <span>{arch.metadata.architecture}</span> · {FAMILY_SUMMARY[family]}
        </div>
      )}
      {t ? (
        <div className="tensor-detail">
          <div className="td-role">
            {roleLabel(t.role)}
            {t.layer != null ? ` — Layer ${t.layer}` : ""}
          </div>
          <div className="td-name">{t.name}</div>
          <div className="td-grid">
            <div>
              <span>Shape</span>
              <b>{fmtShape(t.shape)}</b>
            </div>
            <div>
              <span>Dtype</span>
              <b>{t.dtype}</b>
            </div>
            <div>
              <span>Params</span>
              <b>{fmtCount(t.n_params)}</b>
            </div>
            <div>
              <span>Layer</span>
              <b>{t.layer ?? "—"}</b>
            </div>
            {t.offset != null && (
              <div>
                <span>Byte Offset</span>
                <b>{t.offset.toLocaleString()}</b>
              </div>
            )}
          </div>
          <div className="td-note">{valueNote(t.dtype)}</div>

          {opKey && (
            <div className="formula-section">
              {(() => {
                const spec = getFormula(family, opKey);
                const ctx = contextOp(opKey);
                const ctxSpec = ctx !== opKey ? getFormula(family, ctx) : null;
                return (
                  <>
                    <div className="formula-title">{spec.title}</div>
                    {spec.latex.map((l, i) => (
                      <Formula key={i} latex={l} />
                    ))}
                    {ctxSpec && ctxSpec.latex.length > 0 && (
                      <>
                        <div className="formula-title sub">{ctxSpec.title}</div>
                        {ctxSpec.latex.map((l, i) => (
                          <Formula key={`c${i}`} latex={l} />
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      ) : arch ? (
        <div className="rp-overview">
          <div className="rp-modelname">{arch.metadata.name}</div>
          <div className="rp-modelsub">
            {fmtCount(arch.metadata.total_params)} parameters · {arch.tensor_count}{" "}
            tensors · {arch.metadata.torch_dtype ?? arch.metadata.quantization ?? ""}
          </div>

          <div className="rp-statgrid">
            <Stat label="Layers" value={arch.metadata.num_layers} />
            <Stat label="Attn heads" value={arch.metadata.num_heads} />
            <Stat label="KV heads" value={arch.metadata.num_kv_heads} />
            <Stat label="Hidden" value={arch.metadata.hidden_size} />
            <Stat label="Head dim" value={arch.metadata.head_dim} />
            <Stat label="FFN" value={fmtCount(arch.metadata.ffn_size)} />
            <Stat label="Vocab" value={fmtCount(arch.metadata.vocab_size)} />
            <Stat label="Context" value={fmtCount(arch.metadata.context_length)} />
          </div>

          <div className="rp-legend">
            <div className="rp-legend-label">Colour · layer depth</div>
            <div className="legend-bar" />
            <div className="legend-row">
              <span>Layer 0</span>
              <span>Layer {Math.max(0, arch.metadata.num_layers - 1)}</span>
            </div>
          </div>

          <div className="rp-hint">
            Each point is a real parameter. Hover or click any cluster — or a row
            in the list — to inspect a real tensor&rsquo;s name, shape, and dtype.
          </div>
        </div>
      ) : (
        <div className="rp-empty">Loading the model&rsquo;s real structure…</div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rp-stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
