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

const analysisJsonSchema = {
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

export function hasGeminiConfig() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiModel() {
  return process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
}

export function hashResume(resumeText: string) {
  return createHash("sha256").update(resumeText).digest("hex").slice(0, 16);
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

export async function analyzeResumeAgainstJobs(
  resumeText: string,
  jobs: CleanedJob[],
  demo: boolean,
): Promise<AnalysisResult> {
  const analyzedJobs = jobs.slice(0, ANALYZED_JOB_LIMIT);

  if (demo) {
    return createDemoAnalysis(analyzedJobs);
  }

  if (!hasGeminiConfig()) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: geminiModel(),
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "You are a resume coach. Compare the pasted resume against a small market sample of Canadian job postings.",
              "Return only structured JSON that matches the schema.",
              "Score fit as a coaching estimate, not a hiring decision.",
              "Do not claim certainty and do not store or repeat the full resume.",
              "",
              `Jobs JSON: ${JSON.stringify(analyzedJobs)}`,
              "",
              `Resume text: ${resumeText}`,
            ].join("\n"),
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
