<!-- Thanks for contributing to LLMStudio! -->

## What & why

<!-- What does this PR change, and why? Link the issue it closes. -->

Closes #

## Type of change

- [ ] `feat` — new capability
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `chore` / `refactor` / `perf` / `test`

## The "is it real?" checklist

LLMStudio's rule: every value shown is derived from real model data or a real
forward pass.

- [ ] No hardcoded/placeholder numbers are presented as real model data.
- [ ] If real data can't support a visual, it's labeled or adjusted (not faked).
- [ ] Bounded payloads preserved (top-k not full vocab, weight slices not full
      matrices, sampled point clouds).

## Verification

- [ ] `cd frontend && npm run build` passes (type-checks the tree).
- [ ] Relevant backend script(s) green (`verify_real_data.py` / `verify_trace.py`
      / `verify_geometry.py`).
- [ ] If it touches the GGUF parser, verified against a real `.gguf` (state which
      model/architecture).
- [ ] If it changes a visual, attach a screenshot.

## Screenshots (if UI)

<!-- drag images here -->

## Notes for reviewers

<!-- Anything worth calling out. -->
