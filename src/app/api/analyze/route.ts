import {
  ANALYZED_JOB_LIMIT,
  type GoldArtifact,
  type SilverArtifact,
  artifactSchema,
  silverArtifactSchema,
} from "@/lib/pipeline";
import { hasBlobConfig, jsonPathname, readJsonArtifact, saveJsonArtifact } from "@/lib/server/blob-store";
import {
  analyzeResumeAgainstJobs,
  geminiModel,
  hasGeminiConfig,
  hashResume,
} from "@/lib/server/gemini";
import { z } from "zod";

export const runtime = "nodejs";

const analyzeRequestSchema = z.object({
  resumeText: z.string().trim().min(40, "Paste at least 40 characters of resume text."),
  runId: z.string(),
  silverArtifact: artifactSchema,
});

function shouldUseDemo(storageIsDemo: boolean) {
  if (process.env.DEMO_MODE === "true") {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return storageIsDemo || !hasGeminiConfig() || !hasBlobConfig();
}

export async function POST(request: Request) {
  try {
    const input = analyzeRequestSchema.parse(await request.json());
    const demo = shouldUseDemo(input.silverArtifact.demo);
    const silver = silverArtifactSchema.parse(
      await readJsonArtifact<SilverArtifact>(
        input.silverArtifact.pathname,
        "public",
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
      "private",
      demo,
    );

    return Response.json({
      runId: input.runId,
      mode: demo ? "demo" : "live",
      model: gold.model,
      analyzedAt,
      resumeHash: gold.resumeHash,
      goldArtifact,
      analysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
