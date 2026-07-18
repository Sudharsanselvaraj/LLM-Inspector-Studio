# Where to help — contribution ideas

[CONTRIBUTING.md](../CONTRIBUTING.md) covers *how* to contribute (setup, style,
commits). This doc is *what* to contribute — concrete, real openings grounded in
the current state of the code. Each item lists **where** it lives, a rough
**difficulty**, and **how to verify** it (the project's rule is that everything
is checked against real data, never mocked).

Open an issue before starting anything sizable so we can agree on the approach.

## Good first issues

| Idea | Where | Verify |
| ---- | ----- | ------ |
| **Respect `prefers-reduced-motion`** — disable the idle scene drift and ease-in camera glides when the OS asks for reduced motion. | `components/Scene.tsx` (`IdleDrift`), `CameraRig`/scene tweens | toggle the OS setting; motion stops |
| **Backend `Dockerfile`** + a Render/Fly config so the deploy guide is one-click. | new `backend/Dockerfile`; see [deployment.md](deployment.md) | container boots, `GET /health` ok |
| **Add a formula set** for another architecture family (e.g. Gemma, Phi). | `lib/formulas.ts` (`detectArch` + set) | correct set renders for that arch |
| **Docs & screenshots** — worked examples, a short GIF of each mode. | `docs/`, `README.md` | — |

## Intermediate

| Idea | Where | Verify |
| ---- | ----- | ------ |
| **Dequantize for value preview** — quantized tensors are currently labeled "needs dequantization". Implement Q4_K/Q6_K/… dequant so their real values can be previewed. | `lib/gguf/` (parser + `ggmlTypes.ts`) | previewed values match a reference dequant (e.g. llama.cpp) |
| **A real test suite** — there is none yet. Unit-test the GGUF parser against fixture headers, `lib/playback.ts` (layer anchors, `phaseInfo`), and `detectArch()`. | `frontend/` (add a test runner) | tests green in CI |
| **Performance presets** — the `quality` toggle exists; make it actually degrade gracefully on integrated GPUs (fewer points, simpler materials) and document the tradeoffs. | `lib/store.ts`, `Scene.tsx`, `TensorCloud.tsx` | 60fps on integrated graphics; stated in a note |
| **MoE explorer view** — `expert_count` is parsed but there's no expert-routing visualization for MoE models. | `lib/pointcloud.ts`, scenes | real MoE `.gguf` renders experts distinctly |

## Advanced

| Idea | Where | Verify |
| ---- | ----- | ------ |
| **Real per-head attention intensity** — generation blades are currently structurally per-head but their brightness is one *layer-level* stat copied across all heads. Stream a real per-head scalar (enable `output_attentions` in the decode loop, emit e.g. max attention weight per head) and drive each blade from it. | `backend/app/model.py` (`generate_steps`), `lib/types.ts`, `TransformerStack.tsx` | blades vary per head; values match an independent forward pass |
| **Run a second model locally** — GPT-2's formula set is wired but no GPT-2 is loaded, so the LayerNorm/GELU/learned-pos path is never exercised end-to-end. Add a model selector on the backend. | `backend/app/model.py`, `main.py` | generation runs on GPT-2; formulas switch |
| **Distinctive geometry in the walkthrough districts** — the Tokenizer/Embedding/Attention chapters keep their real-data districts; explore blending the new `TransformerStack` style *without* losing the real per-token PCA/attention data. | `components/districts/`, `WalkthroughScene.tsx` | real attention/PCA numbers still shown |

## The one rule for all of the above

If real data can't cleanly support a visual, **label it or adjust the visual —
never fabricate cleaner-looking fake data.** A PR that makes a number look nicer
by faking it will be rejected; a PR that honestly says "this is a sampled slice"
or "quantized — needs dequant" is exactly right. See
[verification.md](verification.md) for how "real" is proven, and
[visual-mapping.md](visual-mapping.md) for the data→geometry contract you're
extending.
