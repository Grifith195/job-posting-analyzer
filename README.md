# Job Posting Analyzer

Job Posting Analyzer is a small end-to-end AI web app for the Canadian job market. A user searches for a job title, optionally adds a city or province, and the app pulls matching postings from Adzuna Canada. It then cleans the posting data, stores each pipeline stage as JSON in Vercel Blob, and uses Gemini to compare the top postings against pasted resume text.

The app is built for an AI course assignment, so the UI intentionally makes the pipeline visible: ingestion, ETL, storage, LLM analysis, and the user-facing result.

## What It Does

- Searches Adzuna Canada by job title and optional location.
- Fetches 10 job postings per search.
- Normalizes the raw posting data into a cleaner schema.
- Extracts simple skills and job signals from posting text.
- Saves bronze, silver, and gold JSON artifacts in Vercel Blob.
- Uses Gemini to analyze pasted resume text against the top 5 cleaned postings.
- Returns a structured Role Fit Score with strengths, gaps, and resume suggestions.
- Supports demo fallback mode for local development and recording resilience.

This is a coaching tool for resume improvement. It is not a hiring decision tool and does not predict whether someone will get hired.

## Architecture

The app uses a bronze/silver/gold data pipeline and is best classified as `prompt-first`.

Why `prompt-first` fits this app:

- The server cleans postings into a stable silver schema, then places the top cleaned jobs directly into the Gemini context.
- The app does not retrieve from a vector store or document index, so it is not retrieval-first / RAG.
- The model is not choosing among tools or functions, so it is not tool-first.

The main alternative I did not choose is `retrieval-first / RAG`. For this project, the analyzed context is intentionally small: only the top 5 cleaned jobs are sent to Gemini. That keeps cost, operational overhead, and debugging complexity lower than adding embeddings, retrieval, and retrieval evaluation. If the app later needs to compare resumes against larger historical job corpora or many stored runs at once, RAG would become more attractive.

One important capability not currently implemented is `RAG`. I would add it if the silver dataset grows beyond what is practical to place directly in context or if the app needs multi-run historical search.

### Bronze

The bronze layer stores the raw Adzuna API response. This is the ingestion proof: the app fetched real job data and saved the unprocessed payload as JSON.

Example artifact path:

```txt
bronze/<run-id>.json
```

### Silver

The silver layer stores cleaned and normalized postings. It maps the raw Adzuna response into a stable job schema and adds extracted skills/signals.

The silver artifact includes fields like:

- title
- company
- location
- category
- contract type
- salary range
- created date
- description snippet
- redirect URL
- extracted keywords

Example artifact path:

```txt
silver/<run-id>.json
```

### Gold

The gold layer stores the structured Gemini analysis. The server reads the silver artifact, sends the top 5 postings plus the pasted resume text to Gemini, and saves the result.

The gold artifact includes:

- Role Fit Score
- score band
- summary
- matched strengths
- missing signals
- resume suggestions
- per-job match notes
- model name
- analyzed job IDs
- resume hash

The full resume text is never stored.

Example artifact path:

```txt
gold/<run-id>.json
```

All Blob artifacts are written with private access because the Vercel Blob store is configured as private.

## Pipeline And Data Flow

The system flow is:

1. Raw user input: job title, optional location, and pasted resume text
2. Ingestion: fetch raw Adzuna postings
3. Bronze: save the raw response as the ingestion artifact
4. Silver: normalize postings into a stable schema and extract deterministic keyword signals
5. Gold: send the top 5 silver jobs plus the resume text to Gemini for structured analysis
6. UI: show artifact paths, cleaned postings, score band, strengths, gaps, and resume suggestions

For the live analysis stage, the silver artifact is the source of truth. The gold analysis is built from cleaned silver jobs, not directly from the raw bronze payload.

Important failure points include:

- Adzuna fetch failures or empty responses
- ETL normalization or keyword extraction misses
- Blob save or read failures
- Gemini rate-limit or schema-shape failures
- Resume text that is too short or mismatched with the selected run

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Vercel Blob
- Adzuna API
- Gemini API
- Jest
- Playwright

## Required Environment Variables

Create a `.env.local` file in the project root for local development.

```env
ADZUNA_APP_ID=your_adzuna_app_id
ADZUNA_APP_KEY=your_adzuna_app_key
GEMINI_API_KEY=your_gemini_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_read_write_token
```

Optional:

```env
GEMINI_MODEL=gemini-3-flash-preview
DEMO_MODE=true
```

Notes:

- `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` are used by the server to fetch job postings.
- `GEMINI_API_KEY` is used by the server to call Gemini.
- `BLOB_READ_WRITE_TOKEN` is used by the server to read and write Vercel Blob artifacts.
- `GEMINI_MODEL` overrides the default Gemini model.
- `DEMO_MODE=true` forces the app to use sample job data and sample analysis.

Do not prefix these variables with `NEXT_PUBLIC_`. They should stay server-side.

## Demo Fallback Mode

Demo fallback mode exists so the app can still be recorded or presented if an external service is unavailable.

In local development, the app will use demo behavior when:

- `DEMO_MODE=true`, or
- required service credentials are missing.

In production, the app does not silently fall back just because credentials are missing. Set `DEMO_MODE=true` intentionally if you want deployed demo behavior.

Demo fallback still follows the same visible pipeline:

1. Demo Adzuna-style data is treated as the bronze input.
2. The ETL logic creates the silver cleaned jobs.
3. Demo analysis creates the gold output.
4. The UI labels the run as demo fallback.

This keeps the walkthrough stable while still showing the same architecture.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

Run with forced demo mode:

```bash
$env:DEMO_MODE="true"; npm run dev
```

PowerShell syntax is shown because this project is being developed on Windows.

## Testing

Run Jest unit tests:

```bash
npm test
```

Run the Playwright end-to-end test:

```bash
npm run test:e2e
```

The E2E test starts the app with `DEMO_MODE=true` on port `3100`, then tests the full flow:

1. Enter a job title.
2. Submit the search.
3. Verify bronze and silver show as saved.
4. Paste resume text.
5. Run the analysis.
6. Verify gold shows as saved and a score is visible.

Run lint:

```bash
npm run lint
```

Run the production build:

```bash
npm run build
```

## Assignment 6 Evaluation

Assignment 6 artifacts live in [evaluation/README.md](/c:/Users/rosre/job-posting-analyzer/evaluation/README.md).

The repo includes:

- 5 representative cases in [evaluation/cases/representative](/c:/Users/rosre/job-posting-analyzer/evaluation/cases/representative)
- 2 failure cases in [evaluation/cases/failure](/c:/Users/rosre/job-posting-analyzer/evaluation/cases/failure)
- fixed raw job fixtures in [evaluation/fixtures](/c:/Users/rosre/job-posting-analyzer/evaluation/fixtures)
- rubric definitions in [evaluation/rubrics](/c:/Users/rosre/job-posting-analyzer/evaluation/rubrics)
- saved evaluation results in [evaluation/results](/c:/Users/rosre/job-posting-analyzer/evaluation/results)

### What was evaluated

The evaluation covers the three required areas:

- `Output quality`: structured Gemini analysis on 5 representative cases
- `End-to-end task success`: raw fixture -> bronze -> silver -> gold pipeline success
- `One upstream component`: keyword extraction quality during ETL

### Saved results

Pre-improvement results:

- output quality summary: [evaluation/results/pre-improvement/summary.md](/c:/Users/rosre/job-posting-analyzer/evaluation/results/pre-improvement/summary.md)
- output quality current: [evaluation/results/pre-improvement/output-quality-current.json](/c:/Users/rosre/job-posting-analyzer/evaluation/results/pre-improvement/output-quality-current.json)
- output quality baseline: [evaluation/results/pre-improvement/output-quality-baseline.json](/c:/Users/rosre/job-posting-analyzer/evaluation/results/pre-improvement/output-quality-baseline.json)
- end-to-end: [evaluation/results/pre-improvement/end-to-end-current.json](/c:/Users/rosre/job-posting-analyzer/evaluation/results/pre-improvement/end-to-end-current.json)
- failure analysis: [evaluation/results/pre-improvement/failure-analysis.md](/c:/Users/rosre/job-posting-analyzer/evaluation/results/pre-improvement/failure-analysis.md)

Post-improvement results:

- upstream rerun summary: [evaluation/results/post-improvement/summary.md](/c:/Users/rosre/job-posting-analyzer/evaluation/results/post-improvement/summary.md)
- upstream rerun metrics: [evaluation/results/post-improvement/upstream-keyword-eval.json](/c:/Users/rosre/job-posting-analyzer/evaluation/results/post-improvement/upstream-keyword-eval.json)
- before/after delta: [evaluation/results/improvement-delta.md](/c:/Users/rosre/job-posting-analyzer/evaluation/results/improvement-delta.md)

### Key numbers

From the saved artifacts:

- pre-improvement output-quality average: `14.4 / 20`
- pre-improvement baseline average: `15.8 / 20`
- representative cases at acceptable or better: `4 / 5`
- pre-improvement end-to-end task success: `5 / 5` cases, `100%`
- pre-improvement upstream keyword F1: `50.0%`
- post-improvement upstream keyword F1: `97.7%`

### Improvement made

The main evidence-based improvement was expanding keyword extraction in the silver ETL layer to better capture analyst and product-manager requirements and to reduce noisy aliases.

This change was motivated by:

- low upstream recall before the change
- failure-case weakness on analyst and PM-style postings
- the need for clearer silver-layer debugging signals

To rerun the saved Assignment 6 evaluation commands:

```bash
npm run eval:assignment6:pre
npm run eval:assignment6:post
```

Note:

- The post-improvement rerun is upstream-only in this saved artifact set because the Gemini free-tier quota was exhausted after the pre-improvement full evaluation run. The strongest measured before/after evidence is therefore on the upstream component.

## Scheduled ETL Workflow

The repo includes a GitHub Actions workflow that runs a scheduled Adzuna ETL job every day at 10:00 UTC. It can also be run manually from the Actions tab.

The workflow searches Adzuna Canada for:

- software developer
- data analyst
- product manager
- frontend developer

For each role, it fetches 10 postings, runs the same ETL normalization used by the app, and writes cleaned JSON output to:

```txt
data/scheduled-job-postings/
```

The generated files are:

```txt
software-developer.json
data-analyst.json
product-manager.json
frontend-developer.json
manifest.json
```

If the generated JSON changes, the workflow commits the updated files back to the repository with the GitHub Actions bot account.

The scheduled workflow needs these GitHub repository secrets:

```txt
ADZUNA_APP_ID
ADZUNA_APP_KEY
```

You can run the same ETL locally if those environment variables are available:

```bash
npm run etl:scheduled
```

## Deployment

The app is intended to deploy on Vercel.

Set these environment variables in the Vercel project settings:

- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `GEMINI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`

Optional:

- `GEMINI_MODEL`
- `DEMO_MODE`

The browser only calls internal Next.js API routes. Adzuna, Gemini, and Vercel Blob credentials stay on the server.

## Video Walkthrough Notes

A simple walkthrough can follow this order:

1. Search for a Canadian job title.
2. Point out the bronze artifact path for the raw Adzuna response.
3. Point out the silver artifact path and cleaned postings preview.
4. Paste resume text.
5. Run the Gemini analysis.
6. Point out the gold artifact path.
7. Explain that the gold artifact stores a resume hash, not the full resume text.
8. Show the Role Fit Score, strengths, gaps, and resume suggestions.
