# Evaluation Summary
Generated at 2026-04-24T22:54:34.984Z.
## Architecture
- Classification: prompt-first
- Main alternative rejected: retrieval-first / RAG
- Not implemented capability: RAG for larger historical or multi-run corpora
## Baseline
- Baseline prompt: same model and schema, but with simpler grounding instructions
- Current prompt: stronger coaching framing, explicit grounding, and stricter JSON behavior
## Output quality
- Current average rubric total: 14.4/20
- Baseline average rubric total: 15.8/20
- Representative cases at acceptable or better: 4/5
## End-to-end
- See end-to-end-current.json for raw fixture -> bronze -> silver -> gold task-success checks.
## Upstream keyword extraction
- Precision: 80%
- Recall: 36.4%
- F1: 50%
## Chosen improvement
- Expand keyword extraction to better capture analyst and product-manager signals.
- This is motivated by the low recall in the upstream evaluation and the role-specific failure cases.
