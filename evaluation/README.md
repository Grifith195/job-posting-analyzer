## Assignment 6 Evaluation Plan

This folder contains the evaluation artifacts for Assignment 6.

### Architecture classification

The app is primarily `prompt-first`.

- The system cleans job postings into a stable silver schema and then places the top cleaned postings directly into the Gemini context.
- It does not retrieve from a separate vector store, so it is not retrieval-first / RAG.
- It does not depend on model-directed tool selection, so it is not tool-first.

The main alternative considered is `retrieval-first / RAG`. RAG could help if the project grows to many more postings, historical runs, or longer documents that no longer fit comfortably in the model context. For the current app, the top-5 job sample is small enough that direct prompt grounding is cheaper, easier to debug, and has lower operational overhead than adding embeddings, indexing, and retrieval evaluation.

One important capability not currently implemented is `RAG`. It would become worth adding if the app needs to compare a resume against a much larger market snapshot, historical trend data, or many stored job artifacts at once.

### Why the evaluation uses fixed fixtures

The live app fetches data from Adzuna, which changes over time. Assignment 6 needs reproducible evidence, so the evaluation scripts in this folder use saved raw job fixtures and fixed resume cases. That keeps the representative cases, failure cases, and baseline comparison stable across runs.

### What is evaluated

The artifacts in this folder evaluate three required areas:

1. `Output quality`
   - The quality of the structured Gemini resume analysis on 5 representative cases.
2. `End-to-end task success`
   - Whether the pipeline can move from raw input to bronze, silver, gold, and a usable result on those same 5 cases.
3. `One upstream component`
   - Keyword extraction quality during Adzuna cleaning, measured before the final LLM output.

### Baseline

The lightweight baseline keeps the same model and output schema, but uses a simpler prompt with less grounding and coaching guidance. This tests whether the current prompt design is better than a more naive version.

### Folder layout

- `cases/representative/`: 5 representative evaluation cases
- `cases/failure/`: 2 failure-focused cases
- `fixtures/raw-jobs/`: fixed raw job bundles used by the cases
- `fixtures/upstream-keywords.json`: annotated keyword extraction fixtures
- `rubrics/`: scoring rules used by the scripts
- `results/`: saved JSON and markdown outputs from the evaluation runs
