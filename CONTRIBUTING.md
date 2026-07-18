# Contributing to LLMStudio

Thanks for your interest in contributing! LLMStudio is a browser-based 3D
inspector for language-model internals. The guiding principle of the project is
simple and non-negotiable:

> **Every value shown in the UI must come from real parsed model data or a real
> forward pass.** Never hardcode a placeholder stat and present it as real.

Please keep that in mind for any change that touches what the user sees.

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Project layout](#project-layout)
- [Running & verifying](#running--verifying)
- [Coding guidelines](#coding-guidelines)
- [Commit & PR conventions](#commit--pr-conventions)
- [Adding support for a new architecture](#adding-support-for-a-new-architecture)

## Ways to contribute

- **Bugs / correctness** — especially anything where a displayed number does not
  match the underlying model or file. These are the highest-priority issues.
- **New model architectures** — GGUF metadata mappings and formula sets.
- **Performance** — point-cloud rendering, WebSocket payloads, parser speed.
- **Docs** — clarity, examples, screenshots.

See [docs/contributing-ideas.md](docs/contributing-ideas.md) for a concrete,
up-to-date list of what needs doing — grouped by difficulty, with the files to
touch and how to verify each. Open an issue before large changes so we can agree
on the approach.

## Development setup

Requirements: **Python 3.11+**, **Node 18+**, and a machine that can run a small
Hugging Face model locally (Apple Silicon / MPS, CUDA, or CPU all work).

### Backend (FastAPI + Transformers)

```bash
cd backend
python3 -m venv .venv           # add --system-site-packages to reuse a system torch
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --app-dir . --port 8000 --reload
```

The first run downloads `Qwen/Qwen2.5-0.5B-Instruct` (~1 GB) and loads it once.
On machines whose system Python has a broken TensorFlow, `USE_TF=0` is already
set for you in `app/model.py`.

### Frontend (Next.js + React Three Fiber)

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000
# or a production build:  npm run build && npm run start
```

The frontend talks to `http://localhost:8000` (override with
`NEXT_PUBLIC_API_URL`).

## Project layout

```
backend/app/      model.py (engine), main.py (endpoints), schemas.py, reduce.py (PCA)
backend/scripts/  real-data verification scripts
frontend/lib/     store (zustand), gguf/ parser, formulas, pointcloud, api/ws clients
frontend/components/  AppShell + scenes/ (3D) + ui/ (panels)
tools/            headed-Chrome verification & screenshot scripts
docs/             architecture, API, GGUF format, development, verification
```

See [docs/architecture.md](docs/architecture.md) for the full data flow.

## Running & verifying

Because the project's whole premise is "the data is real", changes should be
verified against real data, not mocks.

- **Backend:** run the scripts in `backend/scripts/` — they assert that served
  attention matches an independent forward pass, that the op catalog is real and
  ordered, and that geometry is deterministic:
  ```bash
  backend/.venv/bin/python backend/scripts/verify_real_data.py
  backend/.venv/bin/python backend/scripts/verify_trace.py
  ```
- **GGUF parser:** verify against real `.gguf` files of at least two
  architectures (a dense and, ideally, an MoE model). See `tools/verify_explorer.mjs`.
- **Frontend:** `npm run build` must pass (it type-checks the whole tree). The
  `tools/*.mjs` scripts drive a real Chrome window and capture screenshots —
  headless WebGL screenshots are unreliable, so verification uses a headed window.

## Coding guidelines

- **Match the surrounding code** — comment density, naming, and idioms. The code
  is written to read like one author wrote it.
- **Keep parsing, inference, and rendering separate.** The backend serves JSON
  and never renders; the frontend renders and never fabricates numbers.
- **TypeScript:** no `any` where a real type exists; keep `npm run build` clean.
- **Python:** type hints on public methods; keep endpoints thin, logic in `model.py`.
- **Bounded payloads:** stream top-k, not full vocab; weight *slices*, not full
  matrices; sample point clouds to a budget.
- **Honesty over polish:** if real data can't cleanly support a visual (noisy
  clustering, quantized values that need dequantization), label it or adjust the
  visualization — do not fabricate cleaner-looking fake data.

## Commit & PR conventions

- **[Conventional Commits](https://www.conventionalcommits.org/):**
  `feat(scope): …`, `fix(scope): …`, `docs: …`, `chore: …`, `test: …`.
  Write a short imperative subject and a body explaining *what* and *why*.
- Keep PRs focused; one logical change per PR.
- Reference the issue it closes (`Closes #123`).
- Include a note on how you verified the change against real data.
- Ensure `npm run build` passes and the relevant verification scripts are green.

## Adding support for a new architecture

Two places usually need updates:

1. **GGUF metadata** (`frontend/lib/gguf/parser.ts`) — most llama-family models
   already work via the `{arch}.*` keys. Add any arch-specific keys and, if
   needed, a new ggml type to `ggmlTypes.ts`.
2. **Formulas** (`frontend/lib/formulas.ts`) — extend `detectArch()` and add a
   formula set if the architecture uses a different norm / position encoding /
   MLP (e.g. LayerNorm vs RMSNorm, learned positions vs RoPE, GELU vs SwiGLU).
   Verify the correct set renders for that architecture.

Please verify with a real model file of that architecture and mention which one
in your PR.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
