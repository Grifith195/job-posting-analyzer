import { createHash } from "node:crypto";

import { GoogleGenAI } from "@google/genai";

import {
  ANALYZED_JOB_LIMIT,
  analysisResultSchema,
  bandForScore,
  type AnalysisResult,
  type CleanedJob,
} from "@/lib/pipeline";
import { createDemoAnalysis } from "@/lib/server/demo-data";

export const analysisJsonSchema = {
  type: "object",
  properties: {
    roleFitScore: { type: "integer", minimum: 0, maximum: 100 },
    band: {
      type: "string",
      enum: ["Strong match", "Good match", "Partial match", "Needs work"],
    },
    summary: { type: "string" },
    commonRequirements: { type: "array", items: { type: "string" } },
    matchedStrengths: { type: "array", items: { type: "string" } },
    missingSignals: { type: "array", items: { type: "string" } },
    resumeSuggestions: { type: "array", items: { type: "string" } },
    jobMatches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          jobId: { type: "string" },
          title: { type: "string" },
          company: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
        },
        required: ["jobId", "title", "company", "score", "reason"],
      },
    },
    disclaimer: { type: "string" },
  },
  required: [
    "roleFitScore",
    "band",
    "summary",
    "commonRequirements",
    "matchedStrengths",
    "missingSignals",
    "resumeSuggestions",
    "jobMatches",
    "disclaimer",
  ],
};

export type AnalysisPromptVariant = "current" | "baseline";

export type ThemeAliasMap = Record<string, string[]>;

export const themeAliases: ThemeAliasMap = {
  react: ["react"],
  "next js": ["next.js", "nextjs", "next js"],
  typescript: ["typescript"],
  javascript: ["javascript", "js"],
  "node js": ["node.js", "nodejs", "node js", "node"],
  python: ["python"],
  sql: ["sql", "postgres", "mysql"],
  aws: ["aws", "amazon web services"],
  azure: ["azure"],
  docker: ["docker"],
  git: ["git", "github"],
  api: ["api", "apis", "rest", "graphql"],
  testing: ["testing", "tests", "jest", "playwright", "unit test"],
  agile: ["agile", "scrum"],
  communication: ["communication", "communicate", "collaborate"],
  excel: ["excel", "spreadsheet", "spreadsheets"],
  tableau: ["tableau"],
  "power bi": ["power bi", "powerbi"],
  dashboarding: ["dashboard", "dashboards"],
  reporting: ["report", "reports", "reporting"],
  "data visualization": ["visualization", "visualisation", "visualizations", "visualisations"],
  "stakeholder management": ["stakeholder", "stakeholders", "cross-functional", "cross functional"],
  "product strategy": ["product strategy", "go to market", "go-to-market", "market research", "business value"],
  roadmapping: ["roadmap", "roadmaps", "backlog", "prioritization", "prioritisation"],
  experimentation: ["experimentation", "experiment", "a/b", "ab testing", "hypothesis"],
  "user research": ["user research", "user interview", "customer interview", "customer interviews"],
  metrics: ["metric", "metrics", "kpi", "kpis", "okr", "okrs"],
  "quantified impact": ["quantified impact", "quantify", "measurable outcome"],
  "production experience": ["production", "production support", "live environment"],
  backend: ["backend", "server-side", "services"],
  deployment: ["deploy", "deployment", "cloud"],
  "project experience": ["project", "projects", "portfolio"],
  ownership: ["ownership", "own", "owned", "lead"],
  "user experience": ["user experience", "ux", "accessibility"],
  frontend: ["frontend", "front end", "ui"],
  statistics: ["statistics", "statistical"],
  "data engineering": ["data engineering", "data pipeline", "pipelines"],
};

export function hasGeminiConfig() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiModel() {
  return process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
}

export function hashResume(resumeText: string) {
  return createHash("sha256").update(resumeText).digest("hex").slice(0, 16);
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryGeminiError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    "status" in error &&
    (error.status === 429 || error.status === 500 || error.status === 503)
  );
}

async function generateContentWithRetry(
  ai: GoogleGenAI,
  request: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
) {
  let attempt = 0;
  let delayMs = 1500;

  while (true) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      attempt += 1;

      if (attempt >= 4 || !shouldRetryGeminiError(error)) {
        throw error;
      }

      await sleep(delayMs);
      delayMs *= 2;
    }
  }
}

function normalizeScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeAnalysis(analysis: AnalysisResult): AnalysisResult {
  const roleFitScore = normalizeScore(analysis.roleFitScore);

  return {
    ...analysis,
    roleFitScore,
    band: bandForScore(roleFitScore),
    jobMatches: analysis.jobMatches.map((match) => ({
      ...match,
      score: normalizeScore(match.score),
    })),
    disclaimer:
      "This is a coaching estimate for resume improvement, not a hiring decision or guarantee.",
  };
}

function analysisPromptText(
  variant: AnalysisPromptVariant,
  resumeText: string,
  analyzedJobs: CleanedJob[],
) {
  if (variant === "baseline") {
    return [
      "Compare this resume against these job postings and return JSON that matches the schema.",
      "",
      `Jobs JSON: ${JSON.stringify(analyzedJobs)}`,
      "",
      `Resume text: ${resumeText}`,
    ].join("\n");
  }

  return [
    "You are a resume coach. Compare the pasted resume against a small market sample of Canadian job postings.",
    "Return only structured JSON that matches the schema.",
    "Score fit as a coaching estimate, not a hiring decision.",
    "Focus on concrete overlap, missing requirements, and specific resume improvements.",
    "Ground every major point in the provided jobs and resume.",
    "Do not claim certainty and do not store or repeat the full resume.",
    "",
    `Jobs JSON: ${JSON.stringify(analyzedJobs)}`,
    "",
    `Resume text: ${resumeText}`,
  ].join("\n");
}

export async function analyzeResumeAgainstJobs(
  resumeText: string,
  jobs: CleanedJob[],
  demo: boolean,
  variant: AnalysisPromptVariant = "current",
): Promise<AnalysisResult> {
  const analyzedJobs = jobs.slice(0, ANALYZED_JOB_LIMIT);

  if (demo) {
    return createDemoAnalysis(analyzedJobs);
  }

  if (!hasGeminiConfig()) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await generateContentWithRetry(ai, {
    model: geminiModel(),
    contents: [
      {
        role: "user",
        parts: [
          {
            text: analysisPromptText(variant, resumeText, analyzedJobs),
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: analysisJsonSchema,
    },
  });

  const text = response.text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const parsed = analysisResultSchema.parse(JSON.parse(text));
  return normalizeAnalysis(parsed);
}
