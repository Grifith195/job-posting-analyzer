# Improvement Delta

The Assignment 6 improvement focused on upstream keyword extraction in `cleanAdzunaJobs()`.

## Before the change

- Precision: `80.0%`
- Recall: `36.4%`
- F1: `50.0%`

Main problem:

- The extractor performed reasonably on software and frontend terms, but missed many analyst and product-manager signals such as `Excel`, `Power BI`, `Tableau`, `Roadmapping`, and `Product Strategy`.

## Change made

- Added analyst-oriented labels such as `Excel`, `Tableau`, `Power BI`, `Dashboarding`, `Reporting`, and `Data Visualization`
- Added product-oriented labels such as `Roadmapping`, `Product Strategy`, `User Research`, `Experimentation`, `Metrics`, and `Stakeholder Management`
- Tightened overly broad aliases so `JavaScript` is not inferred just because a posting mentions `Next.js` or `Node.js`
- Split `Stakeholder Management` away from the broader `Communication` label

## After the change

- Precision: `97.7%`
- Recall: `97.7%`
- F1: `97.7%`

## What improved

- Analyst and PM fixtures now return the expected role signals much more reliably.
- The silver-layer keyword field is more useful for debugging and for grounding the final Gemini analysis.
- Noise was reduced on frontend and backend fixtures by removing overly broad aliases.

## Remaining limitation

- The post-improvement Gemini rerun was partially blocked by free-tier quota limits after the pre-improvement full evaluation run, so the strongest measured before/after evidence is in the upstream component evaluation.
