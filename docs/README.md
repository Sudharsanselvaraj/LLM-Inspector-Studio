# LLMStudio documentation

LLMStudio is a browser-based 3D inspector for language-model internals. Every
value it shows comes from real parsed model files or a real forward pass —
nothing is illustrative or hardcoded.

## Contents

- [**Architecture**](architecture.md) — how the backend, frontend and the three
  modes fit together, and how data flows.
- [**API reference**](api.md) — the backend HTTP + WebSocket endpoints.
- [**Visual mapping**](visual-mapping.md) — the explicit contract between real
  model properties and rendered geometry, colour, and motion.
- [**GGUF format**](gguf-format.md) — what the client-side GGUF parser reads and
  how it maps to the UI.
- [**Development**](development.md) — setup, running, and where things live.
- [**Contribution ideas**](contributing-ideas.md) — concrete openings by
  difficulty, with files to touch and how to verify.
- [**Deployment**](deployment.md) — hosting the frontend and backend (and why the
  backend can't be serverless).
- [**Verification**](verification.md) — how the "the data is real" claim is
  proven, with concrete numbers.

## The three modes

| Mode | What it shows | Data source |
| ---- | ------------- | ----------- |
| **Architecture** | A 3D point cloud of a model's real tensors, a scrollable tensor list, and a real-data model overview card. | The live model (`GET /architecture`) **or** a drag-and-dropped `.gguf` parsed client-side. |
| **Generation** | An autoplaying real greedy generation walked layer-by-layer over data-driven block geometry (GQA blades, SwiGLU funnel, RMSNorm waists), with follow-mode camera, speed/skip controls, a real pre-fill/decode KV readout, formulas, weight previews, and a top-k skyline. | `WS /ws/generate` (real forward pass + op catalog + phase). |
| **Walkthrough** | A chaptered, auto-advancing explanation where every number is read from a real forward pass and the 3D advances in lockstep with eased camera moves. | `POST /analyze` (real attention + geometry). |

## Guiding principle

> Every visualized number — parameter counts, tensor shapes, attention weights,
> logits, layer activations — is derived from real parsed model data or a real
> forward pass. If real data can't cleanly support a visual, the visual is
> adjusted or labeled, never faked.
