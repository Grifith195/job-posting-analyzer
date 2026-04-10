import type { CleanedJob } from "@/lib/pipeline";
import { analyzeResumeAgainstJobs } from "@/lib/server/gemini";

const mockGenerateContent = jest.fn<Promise<{ text?: string }>, [unknown]>();

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

const jobs: CleanedJob[] = [
  {
    id: "job-1",
    title: "Software Developer",
    company: "Maple Labs",
    location: "Toronto, Ontario",
    category: "IT Jobs",
    contractType: "permanent",
    salaryMin: 70000,
    salaryMax: 90000,
    createdAt: "2026-04-10T12:00:00Z",
    descriptionSnippet:
      "Build React and TypeScript interfaces, integrate APIs, and write tests.",
    redirectUrl: "https://example.com/job-1",
    source: "Adzuna",
    extractedKeywords: ["React", "TypeScript", "API", "Testing"],
  },
];

describe("Gemini response schema validation", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    mockGenerateContent.mockReset();
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalApiKey;
  });

  it("accepts structured Gemini JSON and normalizes score band/disclaimer", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        roleFitScore: 86,
        band: "Needs work",
        summary: "Strong alignment with the sampled postings.",
        commonRequirements: ["React", "TypeScript", "API integration"],
        matchedStrengths: ["Resume mentions React and TypeScript projects."],
        missingSignals: ["Add deployment evidence."],
        resumeSuggestions: ["Quantify one project outcome."],
        jobMatches: [
          {
            jobId: "job-1",
            title: "Software Developer",
            company: "Maple Labs",
            score: 84,
            reason: "Good overlap with React and API work.",
          },
        ],
        disclaimer: "Model supplied disclaimer.",
      }),
    });

    const analysis = await analyzeResumeAgainstJobs(
      "Resume with React, TypeScript, testing, APIs, Git, and deployment work.",
      jobs,
      false,
    );

    expect(analysis.roleFitScore).toBe(86);
    expect(analysis.band).toBe("Strong match");
    expect(analysis.jobMatches[0].score).toBe(84);
    expect(analysis.disclaimer).toBe(
      "This is a coaching estimate for resume improvement, not a hiring decision or guarantee.",
    );
  });

  it("rejects Gemini JSON that does not match the required analysis schema", async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        summary: "Missing required structured fields.",
      }),
    });

    await expect(
      analyzeResumeAgainstJobs(
        "Resume with React, TypeScript, testing, APIs, Git, and deployment work.",
        jobs,
        false,
      ),
    ).rejects.toThrow();
  });
});
