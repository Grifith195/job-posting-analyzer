import {
  ANALYZED_JOB_LIMIT,
  COUNTRY_CODE,
  RESULTS_PER_SEARCH,
  type BronzeArtifact,
  type JobSearchQuery,
  type SilverArtifact,
  jobSearchQuerySchema,
} from "@/lib/pipeline";
import {
  cleanAdzunaJobs,
  fetchAdzunaJobs,
  fetchDemoAdzunaJobs,
  hasAdzunaConfig,
} from "@/lib/server/adzuna";
import { hasBlobConfig, jsonPathname, saveJsonArtifact } from "@/lib/server/blob-store";

export const runtime = "nodejs";

function shouldUseDemo() {
  if (process.env.DEMO_MODE === "true") {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return !hasAdzunaConfig() || !hasBlobConfig();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const input = jobSearchQuerySchema.parse({
      ...(typeof body === "object" && body ? body : {}),
      country: COUNTRY_CODE,
      resultsPerPage: RESULTS_PER_SEARCH,
    }) satisfies JobSearchQuery;
    const runId = `${Date.now()}-${crypto.randomUUID()}`;
    const fetchedAt = new Date().toISOString();
    const demo = shouldUseDemo();
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
      "private",
      demo,
    );
    const silverArtifact = await saveJsonArtifact(
      "silver",
      jsonPathname("silver", runId),
      silver,
      "private",
      demo,
    );

    return Response.json({
      runId,
      mode: demo ? "demo" : "live",
      query: input,
      fetchedAt,
      bronzeArtifact,
      silverArtifact,
      jobs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
