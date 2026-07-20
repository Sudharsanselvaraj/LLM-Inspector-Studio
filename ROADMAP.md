# TokenPrint Roadmap

TokenPrint's identity going forward: **an interactive visual debugger for transformer
execution.** Not another "what is a transformer?" explainer — a tool that answers:

> **"What is *my* model doing right now, and why?"**

This document explains where that positioning comes from (the gaps in today's
ecosystem, mapped in detail below), what we are building next, in what order, and how
each piece maps onto the existing codebase. It also names our real competitors by name
— including several that didn't exist or weren't on our radar when this roadmap was
first drafted — so contributors can see exactly which claims we can still make and
which ones we can't.

---

## 1. The ecosystem, and the gap we occupy

Every existing tool solves one slice of the problem. The table below is organized into
five camps (one more than before — the GGUF/local-model tooling ecosystem has grown
enough to be its own category, and it now includes a direct competitor to our Explorer
mode).

| Camp | Tools | What they answer | What they can't do |
| --- | --- | --- | --- |
| Educational visualizers | [bbycroft/llm-viz](https://github.com/bbycroft/llm-viz) (5.4k stars, 645 forks — bigger than most people assume), [Transformer Explainer](https://poloclub.github.io/transformer-explainer/) (now published as a CHI 2026 paper), [AnimatedLLM](https://arxiv.org/pdf/2601.04213), [Build An LLM](https://arxiv.org/pdf/2601.04213), 3Blue1Brown | *What is a transformer?* | Fixed demo models. bbycroft's only live-weight model is a tiny letter-sorting nanoGPT; Transformer Explainer is GPT-2-only and education-only. AnimatedLLM's own related-work section admits all of these tools target researchers or already-knowledgeable audiences, leaving true beginners dependent on blog posts and videos. You cannot bring your own model to any of them. |
| Research / attention-probing tools | [BertViz](https://github.com/jessevig/bertviz), [AttentionViz](https://catherinesyeh.github.io/attn-docs/), exBERT, [LIT](https://github.com/PAIR-code/lit) / LMdiff, [InTraVisTo](https://arxiv.org/abs/2507.13858) | *Where is attention? How do predictions form?* | Jupyter- or paper-bound. Researcher UX, no product experience, no generation streaming. LIT does have a model/example comparison mode — the closest thing to our "compare two runs" idea that already ships — but it's still a research harness, not a real-time 3D product. |
| Mechanistic interpretability platforms | TransformerLens, SAELens, CircuitsVis, Ecco, Captum, Inseq, nnsight, pyvene, Tuned Lens, LogitLens4LLMs, **[Neuronpedia](https://www.neuronpedia.org/) + Circuit Tracer** | *Which neurons/features encode which concepts? Can I trace a causal circuit and intervene on it?* | This camp has moved faster than we assumed. Neuronpedia now ships **Circuit Tracer**, built on Anthropic's open-sourced attribution-graph method — a live, interactive frontend where you generate a real attribution graph for a prompt, then modify feature values and watch outputs change. That is genuine in-browser intervention on real weights, which is squarely our v0.5 territory. The gap that remains: Circuit Tracer works at the **SAE-feature level** (currently Gemma-2-2b and Llama-3.2-1b, tied to pre-trained transcoders that must exist for a model) — it can't toggle "attention head 7" as a raw architectural unit the way our GQA-blade geometry can. LogitLens4LLMs and Tuned Lens are real, useful, and notebook/CLI-bound (Colab notebooks, currently Llama-3.1-8B and Qwen-2.5-7B) — nobody has put logit lens in a live 3D product yet. |
| Model / GGUF structure viewers | [Netron](https://github.com/lutzroeder/netron), `inspector-gguf` (Rust/egui GGUF metadata tool), **`gguf-visualizer`** | *What layers/tensors exist in this file?* | Netron is structure-only: no forward pass, no activations, no execution — Netron ends at the graph, TokenPrint begins there. `gguf-visualizer` is the one we need to name explicitly: it is a browser-based tool that renders `.gguf` files as interactive 3D point clouds, with a weight-value color mode that **does dequantize** a sample of the real quantized weights to color the cloud, using Web Worker parsing and parallel batched file reads to stay responsive. This directly overlaps our Explorer mode's core pitch and does something we currently refuse to do (dequantize). See §1.1 below — this is the single most important competitive update in this revision. |
| Adjacent local-LLM ecosystem (context, not direct competitors) | llama.cpp, Ollama, LM Studio, GPT4All, Jan, koboldcpp | *How do I run a GGUF model at all?* | GGUF has become the standard distribution format for quantized local LLMs, natively supported across this entire ecosystem, with tens of thousands of checkpoints hosted on Hugging Face. None of these tools show you *why* a quantized model behaves differently than the full-precision one — they just run it. This is where our quantization-diff idea (§3, v0.25) lives: nobody in this ecosystem answers "what did Q4_K actually do to these weights," visually, for your file. |

### 1.1 The two competitive threats worth naming directly

**`gguf-visualizer` narrows our Explorer-mode differentiation.** Our stated honesty
line has been "the GGUF parser reads only the header, so quantized tensors are labeled
'needs dequantization' rather than faked." That's still the right principle — but
`gguf-visualizer` proves a bounded, on-demand dequantization (sample some tensors,
color by real value, keep the UI responsive via a worker) is achievable client-side
without betraying "every number is real." We should stop treating "we don't
dequantize" as a permanent honesty badge and start treating it as a scoped-out feature
we can now scope back in — see v0.25 below.

**Neuronpedia's Circuit Tracer narrows our v0.5 exclusivity, but doesn't erase it.**
It's a funded, actively shipping team doing real interactive intervention on real
weights in a browser. Our differentiation has to be sharper than "we also let you
intervene" — it needs to be **raw architectural components (heads, blocks, whole
layers) on *any* model you drop in**, versus Circuit Tracer's **learned SAE features on
a short, fixed list of models with pre-trained transcoders**. That's a real, defensible
difference, but it means v0.5 needs to lean harder into "any local model, any head,
zero extra artifacts to train" as the pitch, rather than assuming there's no
competition in the intervention space at all.

Put on two axes, the empty quadrant is the same as before, but narrower than we thought:

|  | Fixed demo model | Bring your own model |
| --- | --- | --- |
| **Static / canned** | bbycroft, Illustrated Transformer | Netron, `inspector-gguf`, `gguf-visualizer` (partially — it does sample real dequantized values) |
| **Real live execution** | Transformer Explainer (GPT-2 only), Circuit Tracer (Gemma-2-2b / Llama-3.2-1b only, feature-level) | **TokenPrint** |

Nobody combines **3D immersive UI + real weights + real streaming generation +
arbitrary local models + no pre-trained auxiliary artifacts (SAEs, transcoders,
tuned-lens probes) required**. That last clause is new to this revision and it's the
real moat: everything in the mechanistic-interpretability camp that does live
intervention requires a model-specific artifact trained in advance. We don't.

Two lessons from the tools that won attention, unchanged and still true: bbycroft won
on *polish of a canned demo*, Transformer Explainer won on *zero-friction access*.
Distribution beats feature count — which is why v0.2 is still about removing our
install wall, not adding a feature.

**Honesty note (and an open gap of our own, still unclosed):** the GGUF parser reads
real structure and metadata, but generation currently runs through PyTorch/transformers
weights — we do not yet execute quantized GGUF inference. The README must never
overclaim this. Closing it (llama.cpp integration) is deliberately parked in §5. Note
that `gguf-visualizer`'s dequantization is for *display sampling*, not execution — it
doesn't run inference on the quantized weights either. Nobody in this table actually
executes real quantized GGUF inference in-browser yet. That gap is still fully open and
still expensive to close.

---

## 2. Design principles

1. **Every number is real.** Already the core claim (see [docs/verification.md](docs/verification.md)).
   No illustrative values, ever. Each roadmap feature must be derived from a real
   forward pass or real weights.
2. **Debugger, not slideshow.** Features should compose like DevTools panels: pause,
   inspect, intervene, resume.
3. **Local and private.** Everything runs on the user's machine. No cloud dependency,
   no telemetry. Neuronpedia's biggest structural weakness (hosted, and tied to models
   that have pre-trained transcoders/SAEs available) is our feature.
4. **Ship demos, not promises.** Each milestone ends with something a stranger can see
   in ten seconds from a link.
5. **No auxiliary artifacts required.** *(New.)* Anything that requires training or
   downloading a model-specific side-artifact (a sparse autoencoder, a tuned-lens
   probe, a transcoder) before it works is a feature for a *different* tool. Every
   TokenPrint feature must work the moment a user drops in a model or GGUF file they've
   never seen before. This is what keeps us out of Neuronpedia's lane rather than
   chasing it.
6. **Serve two honest personas, not one blended one.** *(New.)* A learner exploring
   "what is attention" and an engineer deciding between Q4_K_M and Q8_0 for their own
   fine-tune are both real users of this tool, and they want different defaults (guided
   pacing vs. raw export), not different products. Features below are tagged
   **[Learner]**, **[Engineer]**, or **[Both]** so this stays deliberate instead of
   accidental.

---

## 3. Milestones

### v0.2 — Record & Replay + hosted trace demo `[Both]`

*The distribution milestone. Everything else is louder if people can actually see it.*

**Why.** Today a curious visitor must clone the repo, install Python deps, and download
a model before seeing anything. Most never do. Meanwhile our WebSocket generation
stream already carries everything needed to reproduce a session — one message per
token with top-k probabilities and per-layer activation stats.

**What.**

- A **trace format**: serialize the full `/analyze` + generation WS stream (prompt,
  model metadata, per-token / per-layer payloads, timings) to a single JSON file.
- **Save / load / replay** in the UI: `PlaybackEngine` already drives play, pause,
  skip-to-layer, skip-to-token and speed over live streams
  ([frontend/components/PlaybackEngine.tsx](frontend/components/PlaybackEngine.tsx),
  [frontend/components/ui/GenerationTopControls.tsx](frontend/components/ui/GenerationTopControls.tsx)) —
  replay feeds it a recorded stream instead of a socket.
- A **static hosted demo** (Vercel/GitHub Pages) shipping 3–4 curated traces. No GPU,
  no backend, still 100% real numbers — a recorded forward pass replayed faithfully.
- Traces are **shareable artifacts**: attach one to a GitHub issue ("look what layer 14
  does on this prompt") and anyone can replay it.
- **[New] Shareable snapshot export.** A "share this moment" affordance that captures
  the current op/layer/token/prompt as a URL built on the trace format above. This is
  the single cheapest way to act on our own "distribution beats features" lesson —
  every interesting moment a learner finds becomes something they can post, not just
  something they saw.

**How (implementation sketch).**

- Backend: tee the WS messages in [backend/app/main.py](backend/app/main.py) into a
  trace object; `GET /trace` to download. Version the schema from day one
  (`"trace_version": 1`).
- Frontend: a `TraceSource` that implements the same interface as the live socket in
  [frontend/lib/api.ts](frontend/lib/api.ts); drag-and-drop a `.tokenprint.json` onto
  the existing drop zone.
- Demo deploy: `next build` static export + bundled traces; a "recorded trace" badge in
  the top bar so replay is never mistaken for live inference.

**Done when:** a stranger clicks a link, watches a real Qwen generation flow through
the 3D stack, scrubs it token by token, and downloads or shares the trace — without
installing anything.

---

### v0.25 — Quantization Diff `[Engineer, primarily; Learner secondarily]` *(new milestone)*

*The gap-fill milestone. Nobody — not the quant explainer blogs, not `gguf-visualizer`,
not llama.cpp's ecosystem — shows you a real quantized model's own weights changing
shape, interactively, for the file you actually have.*

**Why.** Every 2026-era "FP16 vs Q4_K_M vs AWQ" explainer we found communicates the
tradeoff with a table and a memory-math paragraph: percentage savings, a decision tree
by available VRAM, a benchmark score delta. The one place we found an actual *picture*
of weight distributions shifting under quantization was a static figure in a paper's
appendix — 3D surface plots of FP32 vs. INT4 weight magnitude for a handful of layers,
generated once for a publication, not an interactive tool anyone can point at their own
file. Meanwhile `gguf-visualizer` proved that sampling and dequantizing *some* real
weight values client-side, on demand, is fast enough for an interactive UI. We should
combine those two facts: let an engineer load two GGUFs of the *same* model at two
quantization levels and diff the real distributions, tensor by tensor.

This also converts our own "honest limitation" (quantized tensors are labeled "needs
dequantization" rather than previewed) from a permanent disclaimer into a shipped
feature, without violating design principle #1 — we're dequantizing real bytes for a
tensor the user explicitly selected, bounded in scope, not estimating or faking
anything for the whole model.

**What.**

- Load a second `.gguf` file (same architecture, different quant — e.g. Q4_K_M
  alongside F16 or Q8_0) via a second drop zone next to the existing one.
- Click any tensor in the Explorer's `TensorList`; both files' real values for that
  tensor are dequantized on demand (bounded to the selected tensor, not the whole
  file) and rendered as overlaid histograms.
- A per-tensor "quantization error" readout (e.g. mean absolute difference, max
  difference) computed from the two real dequantized samples — a real number, not a
  benchmark citation.
- Optional: a small fixed set of "most-affected tensors" surfaced automatically by
  sorting on that error metric, so an engineer doesn't have to click through 290
  tensors to find where quantization actually bit.

**How (implementation sketch).**

- Frontend: extend `frontend/lib/gguf/parser.ts` with a scoped dequantization function
  that takes a tensor's byte offset + `ggml_type` and decodes just that tensor's block,
  using the existing type table in `frontend/lib/gguf/ggmlTypes.ts`. Reuse `File.slice`
  the same way the header parser already does, just further into the file.
  `gguf-visualizer`'s approach (batched, parallel, Web-Worker-driven reads) is a
  reasonable prior-art reference for keeping this off the main thread.
  - New store state alongside the existing `arch` state in `frontend/lib/store.ts`: a
    `compareArch` slot, and a `selectedTensor`-driven diff computation.
  - A new panel next to `ArchitecturePanel.tsx` — a histogram pair, reusing whatever
    charting approach is lightest for the existing bundle (no new heavy dependency
    needed; this can be plain SVG bars driven by binned real values).

**Done when:** a user drops in a Q4_K_M and an F16 GGUF of the same model, clicks
`layers.14.self_attn.q_proj`, and sees two real, distinctly-shaped histograms with a
real numeric error readout between them — not a table, not a benchmark quote, an
actual picture of what quantization did to *their* file.

---

### v0.3 — Logit Lens + token evolution timeline `[Both]`

*The "wow" milestone. Watch the prediction form, layer by layer.*

**Why.** The single most compelling interpretability visual (InTraVisTo's core idea,
also the foundational logit-lens technique): project every layer's residual stream
through the unembedding matrix and show what the model "would say" if it stopped there
— layer 5 thinks `animal`, layer 20 has settled on `tiger`. It converts our per-layer
stats from abstract numbers into a story, and it is cheap: the backend already holds
all hidden states during a forward pass. The existing prior art here —
`LogitLens4LLMs`, currently scoped to Llama-3.1-8B and Qwen-2.5-7B — validates real
demand for exactly this, but ships as Colab notebooks and a CLI, never as a live product
a non-researcher would open.

**A caveat worth building in from day one, not bolting on later:** plain logit lens is
known to suffer from "basis drift" — early layers don't share a coordinate system with
the final unembedding, so raw logit-lens output at layer 3 can look like noise even
when the layer is doing something coherent. Tuned Lens fixes this with a small learned
per-layer linear correction, at the cost of needing to train (once, per model) a
lightweight probe — which is a real tension with design principle #5 (no auxiliary
artifacts required). Our answer: ship the raw, artifact-free logit lens first (it's
still real data, just occasionally noisy at early layers, and we should label it as
such), and treat a Tuned-Lens mode as an optional, clearly-labeled "sharper but requires
one extra downloaded probe file" upgrade later — never silently substituting a trained
correction for a raw projection without telling the user which one they're looking at.

**What.**

- Backend returns **top-5 decoded tokens + probabilities per layer per position**
  (final-norm + unembedding projection of each layer's residual output).
- A **logit-lens panel**: heatmap grid (layers × positions), shaded by probability of
  the eventually-chosen token — painted alongside the 3D layer stack so the moment
  "the prediction locks in" is visible spatially.
- **Token evolution timeline**: for each generated token, a replayable path
  embedding → attention → MLP → … → softmax → chosen token, driven by data we already
  stream.
- **[Learner] Guided prediction game.** Before revealing a layer's logit-lens output,
  prompt the user to guess what the model "thinks" so far, then reveal the real
  answer. Cheap on top of the data above, and it's the thing that would make our
  learning mode meaningfully different from Transformer Explainer's read-only
  walkthrough rather than just a prettier version of the same idea.
- Recorded into traces from v0.2 automatically, so the hosted demo gets this for free.

**How.**

- Backend: in [backend/app/model.py](backend/app/model.py), capture per-layer hidden
  states (already available via `output_hidden_states`), apply `model.norm` +
  `lm_head`, keep top-5. Guard memory: decode top-k only, never ship full-vocab logits
  (151,936 × 24 layers is not a payload).
- Frontend: new panel component beside the walkthrough pane; reuse the existing
  heatmap/colour conventions from the tensor inspector.
- Explicitly label the panel "raw logit lens (unadjusted)" so we're never implying
  Tuned-Lens-grade fidelity we haven't built.

**Done when:** typing a prompt shows, for every layer, what the model would predict
right there — live and in replayed traces — honestly labeled as the raw, artifact-free
projection it is.

---

### v0.4 — The debugger proper: breakpoints, tensor inspection, attention heads `[Engineer, primarily]`

*The identity milestone. This is where "visual debugger" stops being a metaphor.*

**Why.** We already have playback controls no one else has. What separates playback
from debugging is the ability to **stop at a chosen place and inspect real state**.

**What.**

- **Layer breakpoints**: click a layer in the 3D scene → generation pauses when the
  forward pass reaches it.
- **Tensor inspector on pause**: statistics, histogram, heatmap for the tensors at the
  paused position (residual, attention pattern, MLP activations), with export.
- **Attention head inspector**: click a head → its real attention heatmap for the
  current prompt (BertViz's head view, without Jupyter). Backend starts returning
  attention matrices for the inspected layer, not just summary stats.
- **[New] Attention head fingerprinting.** Rather than only a raw per-head heatmap, run
  a small fixed battery of diagnostic prompts against the loaded model and flag heads
  whose attention pattern matches simple, well-known heuristics — e.g. a head that
  reliably attends to the previous occurrence of the current token (an induction-head
  signature) or one that attends almost entirely to relative position regardless of
  content. This needs no new inference infrastructure beyond what `analyze()` already
  computes — it's aggregation across a few extra sentences, not a new model artifact —
  and it's the difference between "here's a heatmap" (research-tool UX) and "here's
  what this head actually does" (engineer UX).
- **[New] Raw data export.** A "download as `.npz`/`.csv`" affordance on the currently
  inspected op, tensor, or attention matrix. We already compute real numbers and round
  them for payload size in the UI; exporting the fuller-precision version lets an
  engineer pull TokenPrint's output into their own notebook instead of TokenPrint being
  a closed terminal experience. This is directly on-brand with our verification
  ethos — it lets the user verify our claim themselves, with their own tools.
- **Per-layer timing readout** (lightweight profiler garnish): the backend wraps each
  layer already; surface ms-per-layer in the HUD.

**How.**

- Backend: a stepped execution mode — hooks pause the forward pass at layer *N*
  (asyncio event), expose `POST /debug/continue`, `GET /debug/tensor?layer=&kind=`.
  Attention matrices fetched lazily per request (n_heads × seq² is fine for one layer,
  never for all 24 at once).
- Frontend: breakpoint markers in the district scene
  ([frontend/components/districts](frontend/components/districts)); inspector panel
  extends the existing [TensorList](frontend/components/ui/TensorList.tsx) /
  [RightPanel](frontend/components/ui/RightPanel.tsx) patterns.
- Head-fingerprinting heuristics live server-side next to `analyze()` in
  [backend/app/model.py](backend/app/model.py) — a new pure function over the already-
  computed attention tensor, no new forward passes.

**Done when:** you can set a breakpoint on layer 14, run a prompt, hit the breakpoint,
open head 7's attention heatmap (now labeled if it matches a known pattern), export the
raw tensor, then resume — exactly like stepping through code.

---

### v0.5 — Interventions: ablation & counterfactuals `[Engineer, primarily]`

*The bridge from "observing" to "experimenting." Our sharpest point of difference from
Neuronpedia's Circuit Tracer — see §1.1 — has to be the pitch here, not an afterthought.*

**Why.** Nothing proves "these numbers are real" like letting users break the model.
Zero out a head, re-run, watch the output degrade. This is also the feature that makes
TokenPrint useful to engineers, not just learners — and it builds directly on v0.4's
pause/step machinery. Unlike Circuit Tracer, which operates on learned SAE features and
is currently limited to models with pre-trained transcoders (Gemma-2-2b, Llama-3.2-1b),
our version operates on raw architectural components — a real attention head, a real
MLP block — on whatever model or GGUF the user actually dropped in, with zero
auxiliary artifacts to train or download first. That's the pitch, explicitly, in the
UI copy: "no SAE required."

**What.**

- **Head/block ablation**: toggle any attention head or MLP block off; re-run the same
  prompt; side-by-side diff of outputs and logit-lens tables (original vs. ablated).
- **A/B trace comparison**: because traces exist (v0.2), "compare two runs" is a
  trace-diff view — same UI later powers cross-model comparison without needing two
  models in memory.
- **[New, smaller, ships first within this milestone] Config-diff comparison.** Before
  full ablation is built, ship the cheaper version: same prompt, two decoding configs
  (e.g. two temperatures, or greedy vs. a fixed-seed sample) or two checkpoints, diffed
  top-k trajectories side by side. This reuses the v0.2 trace format immediately and
  gives engineers a comparison tool while the heavier ablation-hooks work is still in
  progress.

**How.**

- Backend: forward hooks that zero the chosen module's contribution; an
  `interventions` field on the analyze/generate request; results recorded as ordinary
  traces tagged with their intervention.
- Frontend: toggle affordance on heads/blocks in the 3D scene; diff view reuses the
  logit-lens panel with a second column.

**Done when:** a user can show that ablating a specific head breaks subject–verb
agreement on their own prompt — on a model they brought themselves, with nothing
pre-trained required — and share both traces as proof.

---

### v0.6 — Engineer & learner surface features `[Both]` *(new milestone, deliberately "small features," not one big one)*

*Not every gap needs a dedicated milestone. This one bundles the remaining validated,
cheap, high-value items that don't depend on v0.4/v0.5's heavier machinery.*

**What.**

- **[Engineer] Bring your own local checkpoint.** `ModelEngine.__init__` currently
  takes a `model_id` resolved through the Hugging Face Hub via an env var. An engineer
  debugging their own LoRA fine-tune or merge wants to point at a local directory
  instead. Small, contained change to `backend/app/model.py`'s model-loading path, with
  an outsized credibility gain for the engineer persona — right now TokenPrint can only
  ever show you *a* model, not *your* model, on the live-inference side.
- **[Learner] Non-Latin-script tokenization view.** `TokenizerDistrict.tsx` already
  visualizes real tokenization; running it on a Hindi, Tamil, or CJK sentence with the
  same tokenizer shows byte-fallback fragmentation viscerally differently than English
  text does. Genuinely different geometry, zero new backend work — just a prompt
  choice surfaced in the UI, not a new endpoint.
- **[Engineer] KV-cache memory timeline.** Previously parked (see §5) for needing
  backend memory instrumentation that would compete with debugger-core work. Revisit
  here as a smaller feature: we already report `phase`, `n_positions`, and `cache_len`
  per streamed frame — a timeline chart of cache growth over a generation is mostly a
  frontend visualization of data we already emit, not new instrumentation. Full memory
  profiling (bytes, not positions) stays parked.

**Done when:** an engineer can point TokenPrint at a checkpoint on their own disk and
get the same live 3D inspection as they would with the bundled Qwen model; a learner
can type a non-English sentence and see the tokenizer visibly struggle or succeed
differently.

---

## 4. Sequencing logic, in one paragraph

v0.2 first because distribution beats features and it is nearly free (the data already
flows through the WebSocket). v0.25 comes next, out of original order, because it is
the cheapest way to close the one gap our own research found that nobody — including
our closest structural competitor, `gguf-visualizer` — has actually filled, and because
it directly answers that competitor's dequantization move with something it can't do
(comparison, not just single-file coloring). v0.3 follows because logit lens is still
the highest wow-per-effort feature in the ecosystem and rides on v0.2's traces; we now
build in the basis-drift caveat from day one instead of discovering it after shipping.
v0.4 turns our existing playback chassis into the debugger the positioning promises,
and picks up two cheap wins (head fingerprinting, raw export) that cost little given
what `analyze()` already computes. v0.5 requires v0.4's pause/step machinery and is
where we have to out-argue Neuronpedia's Circuit Tracer specifically, on "no SAE
required," rather than assuming we're alone in the intervention space. v0.6 is a
catch-all for validated-but-small items that don't need any of the above to be true
first. Everything still parked (§5) either depends on a second inference engine, a
second resident model, an audience we don't have yet, or a research artifact
(SAE/transcoder) we've deliberately decided not to require.

---

## 5. Parked (deliberately) — and why

| Idea | Why parked |
| --- | --- |
| **In-browser inference (WebGPU/ONNX)** | High value (Transformer Explainer proved it) but v0.2's trace replay removes the install wall much more cheaply. Revisit once traces ship; our TS GGUF parser is the natural seed. |
| **Real quantized GGUF execution (llama.cpp integration)** | Still requires a second inference engine and true quantized execution — a rewrite-sized dependency. Note this is now a *sharper* gap than when first parked: v0.25 proves we can honestly show quantization's effect on weights without this, but generation itself still only runs on full-precision PyTorch weights. Do this when we're ready to close that specific honesty note in §1.1, not before. |
| **Side-by-side live model comparison (two resident models simultaneously)** | Two resident models, doubled VRAM, synchronized streams. Trace-diff (v0.5) and config-diff (v0.5, smaller) deliver most of the value at a fraction of the cost first. |
| **Full memory-byte profiling / flame-graph profiler** | Per-layer ms lands in v0.4; the lighter KV-cache *position* timeline lands in v0.6. A DevTools-grade byte-level memory profiler is a different product. |
| **SAE / learned-feature browsing and steering** | This is now explicitly Neuronpedia's Circuit Tracer's core competency, done well, by a funded team, with real research infrastructure (transcoders, GemmaScope) behind it. Competing head-on here would mean adopting design principle #5's exact opposite (requiring a pre-trained artifact per model). We instead differentiate on raw-component ablation (v0.5) that needs no such artifact. Revisit only if the community specifically asks and is willing to help maintain the SAE-training pipeline this would require. |
| **Tuned-Lens-grade logit lens by default** | Real accuracy win, but requires training and shipping a per-model probe — in tension with "no auxiliary artifacts required." Ship as a clearly-labeled optional upgrade after raw logit lens (v0.3), never as a silent replacement. |
| **Plugin system** | Premature before there are external contributors who want it. We keep panels internally modular now; public API when forks appear. |

---

## 6. Competitive landscape reference (for contributors)

A running, named list of the tools we checked against while writing this roadmap, so
contributors don't accidentally rebuild something that already exists well, and so
"our differentiation" claims stay honest as this space moves fast:

- **Educational, fixed-model:** `bbycroft/llm-viz`, Transformer Explainer, AnimatedLLM,
  Build An LLM, 3Blue1Brown.
- **Research/attention probing:** BertViz, AttentionViz, exBERT, LIT/LMdiff, InTraVisTo.
- **Mechanistic interpretability, artifact-based:** TransformerLens, SAELens,
  CircuitsVis, Ecco, Captum, Inseq, nnsight, pyvene, Neuronpedia + Circuit Tracer.
- **Logit-lens specifically:** LogitLens4LLMs (notebook/CLI), Tuned Lens (the more
  accurate, artifact-requiring successor to raw logit lens).
- **GGUF/structure viewers:** Netron, `inspector-gguf`, **`gguf-visualizer`** (our
  closest direct competitor on the Explorer mode specifically — it dequantizes sample
  weight values for coloring; we currently don't, and v0.25 is our answer to that).
- **Local-LLM runtime ecosystem (context, not competitors):** llama.cpp, Ollama, LM
  Studio, GPT4All, Jan, koboldcpp.

If you're picking up a "good first issue" and it feels like it might already exist
somewhere in this list, check here first — and if you find something not listed here
that overlaps with our roadmap, please open an issue tagged `landscape` so this section
stays current.

---

## 7. Contributing

Each milestone will be broken into labeled GitHub issues (`v0.2`, `v0.25`, `v0.3`,
`good first issue`, `backend`, `frontend`). If you want to help, the friendliest entry
points right now are:

- **The trace format (v0.2)** — well-isolated, versioned from day one, testable
  against [docs/verification.md](docs/verification.md)'s "every number is real" rule.
- **Scoped tensor dequantization for v0.25** — touches only `frontend/lib/gguf/parser.ts`
  and `ggmlTypes.ts`, doesn't require touching the backend or the 3D scenes at all, and
  has a clear, checkable success condition (a real histogram from real bytes).
- **The logit-lens backend projection (v0.3)** — a contained addition to
  `backend/app/model.py`, testable the same way `verify_trace.py` already tests the op
  catalog.
- **Attention head fingerprinting (v0.4)** — a pure function over data `analyze()`
  already returns; no new inference required, easy to unit-test against known
  induction-head examples from the literature.
