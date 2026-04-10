import { POST as analyzePost } from "@/app/api/analyze/route";
import { POST as searchPost } from "@/app/api/jobs/search/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("pipeline route behavior", () => {
  const originalDemoMode = process.env.DEMO_MODE;

  beforeEach(() => {
    process.env.DEMO_MODE = "true";
  });

  afterAll(() => {
    process.env.DEMO_MODE = originalDemoMode;
  });

  it("runs the demo fallback search and analysis flow end to end", async () => {
    const searchResponse = await searchPost(
      jsonRequest({ title: "software developer", location: "Toronto" }),
    );
    const search = await readJson(searchResponse);

    expect(searchResponse.status).toBe(200);
    expect(search.mode).toBe("demo");
    expect(search.jobs).toHaveLength(5);
    expect(search.bronzeArtifact).toMatchObject({
      layer: "bronze",
      access: "private",
      demo: true,
    });
    expect(search.silverArtifact).toMatchObject({
      layer: "silver",
      access: "private",
      demo: true,
    });

    const analyzeResponse = await analyzePost(
      jsonRequest({
        runId: search.runId,
        silverArtifact: search.silverArtifact,
        resumeText:
          "Resume with React, TypeScript, API integration, testing, Git, SQL, and deployment projects.",
      }),
    );
    const analysis = await readJson(analyzeResponse);

    expect(analyzeResponse.status).toBe(200);
    expect(analysis.mode).toBe("demo");
    expect(analysis.resumeHash).toHaveLength(16);
    expect(analysis.goldArtifact).toMatchObject({
      layer: "gold",
      access: "private",
      demo: true,
    });
    expect(JSON.stringify(analysis)).not.toContain("Resume with React");
    expect(analysis.analysis).toMatchObject({
      roleFitScore: 78,
      band: "Good match",
    });
  });

  it("rejects invalid search input with a useful error", async () => {
    const response = await searchPost(jsonRequest({ title: "" }));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toEqual(expect.stringContaining("Too small"));
  });

  it("rejects analysis requests with too little resume text", async () => {
    const response = await analyzePost(
      jsonRequest({
        runId: "run-1",
        silverArtifact: {
          layer: "silver",
          pathname: "silver/run-1.json",
          access: "private",
          demo: true,
        },
        resumeText: "too short",
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toEqual(
      expect.stringContaining("Paste at least 40 characters"),
    );
  });

  it("rejects analysis when the silver artifact belongs to a different run", async () => {
    const searchResponse = await searchPost(
      jsonRequest({ title: "software developer", location: "Toronto" }),
    );
    const search = await readJson(searchResponse);
    const response = await analyzePost(
      jsonRequest({
        runId: "different-run-id",
        silverArtifact: search.silverArtifact,
        resumeText:
          "Resume with React, TypeScript, API integration, testing, Git, SQL, and deployment projects.",
      }),
    );
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("The silver artifact does not match this run.");
  });
});
