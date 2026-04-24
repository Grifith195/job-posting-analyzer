# Post-Improvement Summary

Generated at 2026-04-24T22:59:15.847Z.

## Scope

- This pass reran the upstream keyword evaluation after the extractor improvement.
- Output-quality and end-to-end Gemini reruns were not completed in this pass because the Gemini free-tier request quota was exhausted after the pre-improvement full evaluation run.

## Upstream keyword extraction

- Precision: 97.7%
- Recall: 97.7%
- F1: 97.7%

## Improvement focus

- Added analyst-oriented labels such as Excel, Tableau, Power BI, Dashboarding, Reporting, and Data Visualization.
- Added product-oriented labels such as Roadmapping, Product Strategy, User Research, Experimentation, Metrics, and Stakeholder Management.
- Tightened overly broad aliases that were creating noisy JavaScript and Communication matches.
