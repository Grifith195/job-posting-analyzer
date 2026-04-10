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

The app uses a bronze/silver/gold data pipeline.

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
