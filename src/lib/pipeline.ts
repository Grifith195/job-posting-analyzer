import { z } from "zod";

export const COUNTRY_CODE = "ca";
export const RESULTS_PER_SEARCH = 10;
export const ANALYZED_JOB_LIMIT = 5;

export const pipelineLayerSchema = z.enum(["bronze", "silver", "gold"]);
export type PipelineLayer = z.infer<typeof pipelineLayerSchema>;

export const artifactSchema = z.object({
  layer: pipelineLayerSchema,
  pathname: z.string(),
  url: z.string().optional(),
  downloadUrl: z.string().optional(),
  access: z.enum(["public", "private"]),
  demo: z.boolean(),
});
export type Artifact = z.infer<typeof artifactSchema>;

export const jobSearchQuerySchema = z.object({
  title: z.string().trim().min(2).max(80),
  location: z.string().trim().max(80).optional(),
  country: z.literal(COUNTRY_CODE).default(COUNTRY_CODE),
  resultsPerPage: z.literal(RESULTS_PER_SEARCH).default(RESULTS_PER_SEARCH),
});
export type JobSearchQuery = z.infer<typeof jobSearchQuerySchema>;

export const cleanedJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string(),
  location: z.string(),
  category: z.string().nullable(),
  contractType: z.string().nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  createdAt: z.string().nullable(),
  descriptionSnippet: z.string(),
  redirectUrl: z.string().url().nullable(),
  source: z.literal("Adzuna"),
  extractedKeywords: z.array(z.string()),
});
export type CleanedJob = z.infer<typeof cleanedJobSchema>;

export const bronzeArtifactSchema = z.object({
  runId: z.string(),
  source: z.literal("Adzuna"),
  fetchedAt: z.string(),
  query: jobSearchQuerySchema,
  raw: z.unknown(),
});
export type BronzeArtifact = z.infer<typeof bronzeArtifactSchema>;

export const silverArtifactSchema = z.object({
  runId: z.string(),
  source: z.literal("Adzuna"),
  transformedAt: z.string(),
  query: jobSearchQuerySchema,
  analyzedJobLimit: z.literal(ANALYZED_JOB_LIMIT),
  jobs: z.array(cleanedJobSchema),
});
export type SilverArtifact = z.infer<typeof silverArtifactSchema>;

export const scoreBandSchema = z.enum([
  "Strong match",
  "Good match",
  "Partial match",
  "Needs work",
]);
export type ScoreBand = z.infer<typeof scoreBandSchema>;

export const analysisResultSchema = z.object({
  roleFitScore: z.number().int().min(0).max(100),
  band: scoreBandSchema,
  summary: z.string(),
  commonRequirements: z.array(z.string()),
  matchedStrengths: z.array(z.string()),
  missingSignals: z.array(z.string()),
  resumeSuggestions: z.array(z.string()),
  jobMatches: z.array(
    z.object({
      jobId: z.string(),
      title: z.string(),
      company: z.string(),
      score: z.number().int().min(0).max(100),
      reason: z.string(),
    }),
  ),
  disclaimer: z.string(),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const goldArtifactSchema = z.object({
  runId: z.string(),
  source: z.literal("Gemini"),
  model: z.string(),
  analyzedAt: z.string(),
  silverPathname: z.string(),
  resumeHash: z.string(),
  analyzedJobIds: z.array(z.string()),
  analysis: analysisResultSchema,
});
export type GoldArtifact = z.infer<typeof goldArtifactSchema>;

export const searchResponseSchema = z.object({
  runId: z.string(),
  mode: z.enum(["live", "demo"]),
  query: jobSearchQuerySchema,
  fetchedAt: z.string(),
  bronzeArtifact: artifactSchema,
  silverArtifact: artifactSchema,
  jobs: z.array(cleanedJobSchema),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const analyzeResponseSchema = z.object({
  runId: z.string(),
  mode: z.enum(["live", "demo"]),
  model: z.string(),
  analyzedAt: z.string(),
  resumeHash: z.string(),
  goldArtifact: artifactSchema,
  analysis: analysisResultSchema,
});
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

export function bandForScore(score: number): ScoreBand {
  if (score >= 85) {
    return "Strong match";
  }

  if (score >= 70) {
    return "Good match";
  }

  if (score >= 50) {
    return "Partial match";
  }

  return "Needs work";
}
