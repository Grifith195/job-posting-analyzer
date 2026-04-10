"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

import type {
  AnalyzeResponse,
  Artifact,
  CleanedJob,
  SearchResponse,
} from "@/lib/pipeline";

type ApiError = {
  error: string;
};

type StageState = "waiting" | "active" | "done";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? (payload as ApiError).error
        : "Request failed.";

    throw new Error(message);
  }

  return payload as T;
}

function modeLabel(mode: SearchResponse["mode"] | AnalyzeResponse["mode"] | undefined) {
  return mode === "demo" ? "Demo fallback" : "Live services";
}

function salaryLabel(job: CleanedJob) {
  if (job.salaryMin && job.salaryMax) {
    return `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`;
  }

  if (job.salaryMin) {
    return `From $${job.salaryMin.toLocaleString()}`;
  }

  if (job.salaryMax) {
    return `Up to $${job.salaryMax.toLocaleString()}`;
  }

  return "Salary not listed";
}

function StageCard({
  title,
  status,
  description,
  artifact,
}: {
  title: string;
  status: StageState;
  description: string;
  artifact?: Artifact;
}) {
  const statusText =
    status === "done" ? "Saved" : status === "active" ? "Running" : "Waiting";
  const railClass =
    title === "Gold"
      ? "bg-[linear-gradient(90deg,#fb7185,#facc15)]"
      : title === "Silver"
        ? "bg-[linear-gradient(90deg,#a3e635,#2dd4bf)]"
        : "bg-[linear-gradient(90deg,#2dd4bf,#38bdf8)]";
  const testId = `${title.toLowerCase()}-stage`;

  return (
    <section
      className="group flex min-h-56 flex-col justify-between overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] shadow-[0_18px_70px_rgba(0,0,0,0.26)] transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]"
      data-testid={testId}
    >
      <div className={`h-1.5 ${railClass}`} />
      <div className="flex flex-1 flex-col justify-between p-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-teal-300">{title}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{statusText}</h2>
          </div>
          <span
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              status === "done"
                ? "border-teal-300/40 bg-teal-300/10 text-teal-100"
                : status === "active"
                  ? "border-yellow-300/40 bg-yellow-300/10 text-yellow-100"
                  : "border-white/10 bg-white/[0.04] text-neutral-300"
            }`}
          >
            {artifact?.demo ? "DEMO" : status === "done" ? "LIVE" : "..."}
          </span>
        </div>
        <p className="text-sm leading-6 text-neutral-300">{description}</p>
      </div>

      <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-xs text-neutral-400">
        <p className="font-mono break-all">{artifact?.pathname ?? "No artifact yet"}</p>
        {artifact?.access === "private" ? (
          <p className="font-semibold text-rose-200">Private artifact path only</p>
        ) : null}
      </div>
      </div>
    </section>
  );
}

function JobPreview({ job }: { job: CleanedJob }) {
  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.2)] transition duration-300 hover:border-teal-200/30 hover:bg-white/[0.08]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">{job.title}</h3>
          <p className="mt-1 text-sm text-neutral-400">
            {job.company} - {job.location}
          </p>
        </div>
        <p className="rounded-md border border-teal-300/20 bg-teal-300/10 px-2 py-1 text-sm font-semibold text-teal-100">
          {salaryLabel(job)}
        </p>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-6 text-neutral-300">
        {job.descriptionSnippet}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {job.extractedKeywords.length ? (
          job.extractedKeywords.map((keyword) => (
            <span
              className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-semibold text-neutral-200"
              key={keyword}
            >
              {keyword}
            </span>
          ))
        ) : (
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-neutral-400">
            No ETL keywords found
          </span>
        )}
      </div>
    </article>
  );
}

export default function Home() {
  const [title, setTitle] = useState("software developer");
  const [location, setLocation] = useState("Toronto");
  const [resumeText, setResumeText] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchMode = searchResult?.mode ?? analysisResult?.mode;
  const visibleJobs = useMemo(() => searchResult?.jobs.slice(0, 10) ?? [], [searchResult]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);
    setAnalysisResult(null);
    setError(null);

    try {
      const result = await postJson<SearchResponse>("/api/jobs/search", {
        title,
        location: location.trim() || undefined,
      });
      setSearchResult(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Job search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!searchResult) {
      setError("Search for jobs before running the gold analysis.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const result = await postJson<AnalyzeResponse>("/api/analyze", {
        resumeText,
        runId: searchResult.runId,
        silverArtifact: searchResult.silverArtifact,
      });
      setAnalysisResult(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#10100f] bg-[linear-gradient(145deg,#10100f_0%,#151513_48%,#0d0d0c_100%)] text-neutral-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.18] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.34)_1px,transparent_1px)] [background-size:24px_24px]"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 md:px-8 lg:px-10">
        <header className="grid gap-6 border-b border-white/10 pb-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
                <Image className="invert" src="/globe.svg" alt="" width={22} height={22} />
              </span>
              <span className="rounded-md border border-teal-300/30 bg-teal-300/10 px-2 py-1 text-xs font-semibold uppercase text-teal-100">
                Canada job market
              </span>
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              Job Posting Analyzer
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-300">
              Search Adzuna Canada, clean the postings into a silver dataset, then
              compare the top five roles against a pasted resume with structured AI
              feedback.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] shadow-[0_18px_70px_rgba(0,0,0,0.24)]">
            <div className="h-1.5 bg-[linear-gradient(90deg,#2dd4bf,#a3e635,#fb7185)]" />
            <div className="px-4 py-4 text-sm text-neutral-300">
              <p className="font-semibold text-white">{modeLabel(searchMode)}</p>
              <p className="mt-1 font-mono text-xs break-all text-neutral-400">
              {searchResult?.runId ?? "Run ID appears after search"}
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <div className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <form
            className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.24)]"
            onSubmit={handleSearch}
          >
            <p className="text-xs font-semibold uppercase text-teal-300">
              Ingestion input
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Search live postings
            </h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-neutral-200">
                Job title
                <input
                  className="rounded-md border border-white/10 bg-[#0d0d0c] px-3 py-3 text-base font-normal text-white outline-none transition placeholder:text-neutral-500 focus:border-teal-300/70 focus:bg-black/30"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="software developer"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-neutral-200">
                City or province
                <input
                  className="rounded-md border border-white/10 bg-[#0d0d0c] px-3 py-3 text-base font-normal text-white outline-none transition placeholder:text-neutral-500 focus:border-teal-300/70 focus:bg-black/30"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Toronto"
                />
              </label>
              <button
                className="rounded-md border border-teal-200/30 bg-teal-300 px-4 py-3 text-sm font-semibold text-neutral-950 shadow-[0_12px_35px_rgba(45,212,191,0.18)] transition hover:bg-teal-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-neutral-500"
                disabled={searching || title.trim().length < 2}
              >
                {searching ? "Building bronze and silver..." : "Fetch and clean 10 jobs"}
              </button>
            </div>
          </form>

          <form
            className="rounded-lg border border-white/10 bg-white/[0.06] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.24)]"
            onSubmit={handleAnalyze}
          >
            <p className="text-xs font-semibold uppercase text-rose-300">LLM input</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Paste resume text
            </h2>
            <textarea
              className="mt-5 min-h-44 w-full resize-y rounded-md border border-white/10 bg-[#0d0d0c] px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-500 focus:border-rose-300/70 focus:bg-black/30"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              placeholder="Paste resume text here. It is sent to the server for analysis but not stored in the gold JSON artifact."
            />
            <button
              className="mt-4 rounded-md border border-rose-200/30 bg-rose-300 px-4 py-3 text-sm font-semibold text-neutral-950 shadow-[0_12px_35px_rgba(251,113,133,0.18)] transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-neutral-500"
              disabled={analyzing || !searchResult || resumeText.trim().length < 40}
            >
              {analyzing ? "Reading silver and saving gold..." : "Analyze top 5 jobs"}
            </button>
            <p className="mt-3 text-xs leading-5 text-neutral-400">
              The resume text is used for the Gemini request only. The saved gold layer
              keeps a short hash plus structured analysis.
            </p>
          </form>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <StageCard
            title="Bronze"
            status={searching ? "active" : searchResult ? "done" : "waiting"}
            description="Raw Adzuna response captured before transformation."
            artifact={searchResult?.bronzeArtifact}
          />
          <StageCard
            title="Silver"
            status={searching ? "active" : searchResult ? "done" : "waiting"}
            description="Normalized job schema plus deterministic keyword extraction."
            artifact={searchResult?.silverArtifact}
          />
          <StageCard
            title="Gold"
            status={analyzing ? "active" : analysisResult ? "done" : "waiting"}
            description="Structured resume fit analysis saved without the full resume text."
            artifact={analysisResult?.goldArtifact}
          />
        </section>

        {visibleJobs.length ? (
          <section>
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-teal-300">
                  Silver preview
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Cleaned postings
                </h2>
              </div>
              <p className="text-sm text-neutral-400">
                Showing {visibleJobs.length} fetched postings - top 5 sent to AI
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {visibleJobs.map((job) => (
                <JobPreview job={job} key={job.id} />
              ))}
            </div>
          </section>
        ) : null}

        {analysisResult ? (
          <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] shadow-[0_22px_80px_rgba(0,0,0,0.28)]">
            <div className="h-1.5 bg-[linear-gradient(90deg,#fb7185,#facc15,#2dd4bf)]" />
            <div className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-rose-300">
                  Gold analysis
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  {analysisResult.analysis.band}
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
                  {analysisResult.analysis.summary}
                </p>
              </div>
              <div className="rounded-lg border border-rose-300/20 bg-rose-300/10 px-6 py-5 text-center">
                <p className="text-xs font-semibold uppercase text-rose-200">Score</p>
                <p
                  className="mt-1 text-5xl font-semibold text-white"
                  data-testid="role-fit-score"
                >
                  {analysisResult.analysis.roleFitScore}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-3">
              <ResultList
                title="Matched strengths"
                items={analysisResult.analysis.matchedStrengths}
              />
              <ResultList
                title="Missing signals"
                items={analysisResult.analysis.missingSignals}
              />
              <ResultList
                title="Resume edits"
                items={analysisResult.analysis.resumeSuggestions}
              />
            </div>

            <div className="mt-6 grid gap-3">
              {analysisResult.analysis.jobMatches.map((match) => (
                <div
                  className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-4 md:grid-cols-[6rem_minmax(0,1fr)]"
                  key={match.jobId}
                >
                  <p className="text-3xl font-semibold text-teal-200">{match.score}</p>
                  <div>
                    <p className="font-semibold text-white">
                      {match.title} - {match.company}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-300">{match.reason}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-neutral-400">
              {analysisResult.analysis.disclaimer}
            </p>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-300">
        {items.map((item) => (
          <li className="border-l-2 border-teal-300 pl-3" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
