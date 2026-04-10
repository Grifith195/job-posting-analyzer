import { z } from "zod";

import {
  ANALYZED_JOB_LIMIT,
  COUNTRY_CODE,
  RESULTS_PER_SEARCH,
  artifactSchema,
  type AnalyzeResponse,
  type BronzeArtifact,
  type GoldArtifact,
  type JobSearchQuery,
  type SearchResponse,
  type SilverArtifact,
  jobSearchQuerySchema,
  silverArtifactSchema,
} from "@/lib/pipeline";
import {
  cleanAdzunaJobs,
  fetchAdzunaJobs,
  fetchDemoAdzunaJobs,
  hasAdzunaConfig,
} from "@/lib/server/adzuna";
import {
  hasBlobConfig,
  jsonPathname,
  readJsonArtifact,
  saveJsonArtifact,
} from "@/lib/server/blob-store";
import {
  analyzeResumeAgainstJobs,
  geminiModel,
  hasGeminiConfig,
  hashResume,
} from "@/lib/server/gemini";

const ARTIFACT_ACCESS = "private";

export const searchPipelineInputSchema = jobSearchQuerySchema;

export const analyzePipelineInputSchema = z.object({
  resumeText: z.string().trim().min(40, "Paste at least 40 characters of resume text."),
  runId: z.string(),
  silverArtifact: artifactSchema,
});

export type AnalyzePipelineInput = z.infer<typeof analyzePipelineInputSchema>;

export function parseSearchPipelineInput(body: unknown): JobSearchQuery {
  return searchPipelineInputSchema.parse({
    ...(typeof body === "object" && body ? body : {}),
    country: COUNTRY_CODE,
    resultsPerPage: RESULTS_PER_SEARCH,
  });
}

function shouldUseSearchDemoMode() {
  if (process.env.DEMO_MODE === "true") {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return !hasAdzunaConfig() || !hasBlobConfig();
}

function shouldUseAnalysisDemoMode(storageIsDemo: boolean) {
  if (process.env.DEMO_MODE === "true") {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return storageIsDemo || !hasGeminiConfig() || !hasBlobConfig();
}

export async function runJobSearchPipeline(
  input: JobSearchQuery,
): Promise<SearchResponse> {
  const runId = `${Date.now()}-${crypto.randomUUID()}`;
  const fetchedAt = new Date().toISOString();
  const demo = shouldUseSearchDemoMode();
  const raw = demo ? fetchDemoAdzunaJobs() : await fetchAdzunaJobs(input);
  const jobs = cleanAdzunaJobs(raw);
  const bronze: BronzeArtifact = {
    runId,
    source: "Adzuna",
    fetchedAt,
    query: input,
    raw,
  };
  const silver: SilverArtifact = {
    runId,
    source: "Adzuna",
    transformedAt: new Date().toISOString(),
    query: input,
    analyzedJobLimit: ANALYZED_JOB_LIMIT,
    jobs,
  };
  const bronzeArtifact = await saveJsonArtifact(
    "bronze",
    jsonPathname("bronze", runId),
    bronze,
    ARTIFACT_ACCESS,
    demo,
  );
  const silverArtifact = await saveJsonArtifact(
    "silver",
    jsonPathname("silver", runId),
    silver,
    ARTIFACT_ACCESS,
    demo,
  );

  return {
    runId,
    mode: demo ? "demo" : "live",
    query: input,
    fetchedAt,
    bronzeArtifact,
    silverArtifact,
    jobs,
  };
}

export async function runResumeAnalysisPipeline(
  input: AnalyzePipelineInput,
): Promise<AnalyzeResponse> {
  const demo = shouldUseAnalysisDemoMode(input.silverArtifact.demo);
  const silver = silverArtifactSchema.parse(
    await readJsonArtifact<SilverArtifact>(
      input.silverArtifact.pathname,
      ARTIFACT_ACCESS,
      input.silverArtifact.demo,
    ),
  );

  if (silver.runId !== input.runId) {
    throw new Error("The silver artifact does not match this run.");
  }

  const analyzedAt = new Date().toISOString();
  const analysis = await analyzeResumeAgainstJobs(input.resumeText, silver.jobs, demo);
  const gold: GoldArtifact = {
    runId: input.runId,
    source: "Gemini",
    model: demo ? "demo-analysis" : geminiModel(),
    analyzedAt,
    silverPathname: input.silverArtifact.pathname,
    resumeHash: hashResume(input.resumeText),
    analyzedJobIds: silver.jobs.slice(0, ANALYZED_JOB_LIMIT).map((job) => job.id),
    analysis,
  };
  const goldArtifact = await saveJsonArtifact(
    "gold",
    jsonPathname("gold", input.runId),
    gold,
    ARTIFACT_ACCESS,
    demo,
  );

  return {
    runId: input.runId,
    mode: demo ? "demo" : "live",
    model: gold.model,
    analyzedAt,
    resumeHash: gold.resumeHash,
    goldArtifact,
    analysis,
  };
}
