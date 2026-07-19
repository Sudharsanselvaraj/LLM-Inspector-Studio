<div align="center">
  <img src="TokenPrint logo.png" alt="TokenPrint" width="350" />
</div>

<h3 align="center">See a language model think — real internals, real forward pass, real-time 3D.</h3>

<p align="center">
  <a href="https://github.com/Sudharsanselvaraj/Token-Print/actions/workflows/ci.yml"><img src="https://github.com/Sudharsanselvaraj/Token-Print/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e.svg?style=flat" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/data-100%25%20real%20forward%20pass-0a0a0a.svg?style=flat" alt="Real data only" />
  <img src="https://img.shields.io/badge/backend-FastAPI%20·%20PyTorch-009688.svg?style=flat" alt="Backend: FastAPI + PyTorch" />
  </a>
</p>

---

<p align="center">
  <img src=".github/assets/demo.gif" alt="TokenPrint — live demo" width="820" />
</p>

**TokenPrint** is a browser-based 3D inspector for the internals of a language model. Load a
live model or drop in a `.gguf` file and explore its tensors, run a real greedy generation
op-by-op, or walk through the transformer step by step. Every number you see is **real** —
parsed straight from a model file or produced by an actual forward pass. Nothing is
illustrative, sampled from noise, or hardcoded.

> [!TIP]
> New here? Open the **Architecture** tab and hit **Use live Qwen model** — you'll get a
> point cloud of the real `Qwen/Qwen2.5-0.5B-Instruct` tensors (494,032,768 params, 290
> tensors) with hover-to-inspect names, shapes, and dtypes.

## Quickstart

```bash
# 1. Backend — loads Qwen2.5-0.5B-Instruct once (Apple MPS / CPU fallback)
cd backend
python3 -m venv .venv --system-site-packages
source .venv/bin/activate && pip install -r requirements.txt
python -m uvicorn app.main:app --app-dir . --port 8000
```

```bash
# 2. Frontend — Next.js + React Three Fiber
cd frontend
npm install
npm run dev            # http://localhost:3000
```

Open **http://localhost:3000** and pick a mode from the top bar. No model file is required
for the live-model view; drag any local `.gguf` onto the drop zone to inspect it instead
(the file is parsed in-browser — nothing is uploaded).

## The three modes

| Mode | What it shows | Where the data comes from |
| ---- | ------------- | ------------------------- |
| **Architecture** | A 3D point cloud of every real tensor (layers as depth-colored panels), a searchable tensor list with hover/click inspection, and a real-data **model overview card** (params, layers, attn/KV heads, hidden, FFN, vocab, context) shown until a tensor is selected. | `GET /architecture` (live Qwen `named_parameters()`) **or** a client-side `.gguf` binary parser. |
| **Generation** | A real greedy generation streamed over WebSocket that **autoplays** token-by-token, layer-by-layer. The stack renders **distinctive per-operation geometry** — one blade per real attention head (clustered into KV groups for GQA), a SwiGLU funnel sized by the real FFN ratio, and RMSNorm waists — with a follow-mode camera, speed multiplier, skip-to-layer/token, and a live **pre-fill vs decode** KV-cache readout. The right panel shows the architecture-correct LaTeX formula, param count, weight preview, and optional raw dev values; a real **top-k probability skyline** sits at the output. | `WS /ws/generate` with `trace:true` — a real per-op catalog + per-token top-k, phase, and per-layer activation stats. |
| **Walkthrough** | A chaptered explanation (Overview → Tokenization → Embedding → Layer Norm → Self-Attention → MLP → Softmax) that **autoplays chapters**, advancing the 3D view in lockstep with eased camera moves. Structural chapters reuse the real Qwen block geometry; the tokenizer/embedding/attention chapters show real per-token PCA and attention data. Every worked number is read from a forward pass. | One real `POST /analyze` (attention + PCA geometry). |

Formulas are **architecture-aware**: the family is detected from the model, so Qwen/Llama
render **RMSNorm · RoPE · SwiGLU · GQA** and GPT-2-style models render **LayerNorm · learned
positions · GELU** — never the wrong set.

**Geometry is data-driven, not decorative.** In the generation stack every proportion traces
to a real dimension: the blade count equals the real head count (14 query heads clustered into
2 KV groups — that's GQA you can see), the MLP funnel's belly is sized by the real
`ffn_size / hidden_size` ratio (≈5.4× for Qwen2.5-0.5B), and each block shows its two RMSNorm
waists. The **KV-cache phase** is real too: step 0 is a pre-fill over the whole prompt
(39 positions), every later step is a single-token decode reusing the cached prefix — the
UI labels and visibly shrinks the work accordingly. Autoplay pacing is normalized (never
fabricated in-between frames); a dropped WebGL context recovers automatically and falls back
to a readable message rather than a broken canvas.

## Architecture

- **Backend** (`backend/`) — FastAPI. `GET /architecture` (real tensors + config, no forward
  pass), `POST /analyze` (real attention + PCA geometry), `WS /ws/generate` (streamed greedy
  generation; `trace:true` adds the real per-op catalog). Loads `Qwen/Qwen2.5-0.5B-Instruct`
  once on Apple **MPS** (`attn_implementation="eager"`, float32 — eager is mandatory for real
  attention data).
- **Frontend** (`frontend/`) — Next.js (app-router, TS) + React Three Fiber. `AppShell` =
  top bar + left sidebar + full-bleed canvas + right panel. `lib/gguf/` client-side GGUF
  parser; `lib/formulas.ts` KaTeX formula sets; `lib/pointcloud.ts` tensor→points;
  `lib/playback.ts` (layer/op mapping + KV phase); `components/PlaybackEngine.tsx` (the single
  autoplay ticker); `components/scenes/TransformerStack.tsx` (data-driven block geometry);
  `SceneLoader.tsx` (WebGL context-loss recovery + fallback); scenes under `components/scenes/`.

> [!NOTE]
> The point cloud uses `THREE.Points` (one draw call), not instanced meshes — the right tool
> for hundreds of thousands of points on an integrated GPU. The GGUF parser reads only the
> file **header** (`File.slice`), so multi-GB models parse instantly and nothing is uploaded.

## Proving the data is real

TokenPrint's whole claim is that **every number is real**. It's checked, not asserted:

- **`GET /architecture`** — qwen2 reports **494,032,768** params, exactly the sum of all
  **290** tensors.
- **GGUF parser** — verified against real local GGUF v3 files: **qwen3** (399 tensors, Q4_K,
  8.19B) and **llama 3.2** (255 tensors, Q4_K, 3.21B). Tensor counts match the binary header;
  each shows its own real vocab / RoPE base / context.
- **`backend/scripts/verify_trace.py`** — the op catalog is real: **243 ops** in true forward
  order, `q_proj` L0 = **803,712** params (matches the module), cumulative "parameters used" =
  **630M**.
- **`backend/scripts/verify_real_data.py`** / **`verify_geometry.py`** — attention and PCA
  geometry match an independent forward pass; deterministic across runs.

See [`docs/verification.md`](docs/verification.md) for the full evidence with exact numbers.

## Documentation

| Doc | What's inside |
| --- | ------------- |
| [Architecture](docs/architecture.md) | How the backend, frontend, and data flow fit together |
| [API reference](docs/api.md) | The REST + WebSocket endpoints |
| [Visual mapping](docs/visual-mapping.md) | Real model properties → rendered geometry, colour, motion |
| [GGUF format](docs/gguf-format.md) | Exactly what the client-side parser reads |
| [Development](docs/development.md) | Setup and where things live |
| [Deployment](docs/deployment.md) | Hosting the frontend + backend |
| [Verification](docs/verification.md) | How "the data is real" is proven |

## Honest limitations

- The tensor point cloud needs only shapes/offsets/types, so the GGUF parser never
  dequantizes. **Value preview** is offered for F32/F16 tensors; quantized tensors are
  labeled "needs dequantization" rather than faked.
- The **live-generation model is Qwen** (real, loaded); GPT-2's formula set is wired and
  selected by architecture but not run locally (no local GPT-2).
- The walkthrough's **model-scale selector** rescales the 3D using each reference model's real
  published parameter count; all worked numbers come from the loaded Qwen forward pass.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). For a concrete list of what needs doing
(by difficulty, with files and verification steps), see
[docs/contributing-ideas.md](docs/contributing-ideas.md). Found a wrong number? That's a top-priority bug.
Security issues: see [SECURITY.md](SECURITY.md) (report privately, not via public issues).

## License

[MIT](LICENSE) © Sudharsan Selvaraj.
