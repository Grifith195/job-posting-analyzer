import { cleanAdzunaJobs } from "@/lib/server/adzuna";

describe("Adzuna ETL normalization", () => {
  it("normalizes raw Adzuna postings and extracts useful skill signals", () => {
    const jobs = cleanAdzunaJobs({
      results: [
        {
          id: 123,
          title: "Junior React Developer",
          company: { display_name: "Maple Labs" },
          location: { display_name: "Toronto, Ontario" },
          category: { label: "IT Jobs" },
          contract_type: "permanent",
          salary_min: 65000,
          salary_max: 85000,
          created: "2026-04-10T12:00:00Z",
          description:
            "Build React and TypeScript interfaces, integrate REST APIs, write tests, and use Git.",
          redirect_url: "https://example.com/job/123",
        },
      ],
    });

    expect(jobs).toEqual([
      {
        id: "123",
        title: "Junior React Developer",
        company: "Maple Labs",
        location: "Toronto, Ontario",
        category: "IT Jobs",
        contractType: "permanent",
        salaryMin: 65000,
        salaryMax: 85000,
        createdAt: "2026-04-10T12:00:00Z",
        descriptionSnippet:
          "Build React and TypeScript interfaces, integrate REST APIs, write tests, and use Git.",
        redirectUrl: "https://example.com/job/123",
        source: "Adzuna",
        extractedKeywords: ["React", "TypeScript", "Git", "API", "Testing"],
      },
    ]);
  });

  it("fills safe defaults when optional Adzuna fields are missing", () => {
    const jobs = cleanAdzunaJobs({
      results: [
        {
          title: "Backend Developer",
          description: "Maintain Python services and SQL queries.",
        },
      ],
    });

    expect(jobs[0]).toMatchObject({
      id: "adzuna-1",
      title: "Backend Developer",
      company: "Company not listed",
      location: "Canada",
      category: null,
      contractType: null,
      salaryMin: null,
      salaryMax: null,
      createdAt: null,
      descriptionSnippet: "Maintain Python services and SQL queries.",
      redirectUrl: null,
      source: "Adzuna",
      extractedKeywords: ["Python", "SQL"],
    });
  });

  it("extracts analyst and product-manager signals that were previously missing", () => {
    const jobs = cleanAdzunaJobs({
      results: [
        {
          id: "analyst-1",
          title: "Data Analyst",
          description:
            "Build dashboards and reports in Excel, Tableau, and Power BI for stakeholders using SQL and data visualization best practices.",
        },
        {
          id: "pm-1",
          title: "Product Manager",
          description:
            "Own roadmap prioritization, product strategy, KPI reviews, customer interviews, and experimentation across cross-functional teams.",
        },
      ],
    });

    expect(jobs[0].extractedKeywords).toEqual(
      expect.arrayContaining([
        "SQL",
        "Excel",
        "Tableau",
        "Power BI",
        "Dashboarding",
        "Reporting",
        "Data Visualization",
        "Stakeholder Management",
      ]),
    );
    expect(jobs[1].extractedKeywords).toEqual(
      expect.arrayContaining([
        "Roadmapping",
        "Product Strategy",
        "Metrics",
        "User Research",
        "Experimentation",
        "Stakeholder Management",
      ]),
    );
  });

  it("does not infer JavaScript just because a role mentions Next.js or Node.js", () => {
    const jobs = cleanAdzunaJobs({
      results: [
        {
          id: "frontend-1",
          title: "Frontend Developer",
          description: "Use Next.js, TypeScript, and Node.js services with GraphQL APIs.",
        },
      ],
    });

    expect(jobs[0].extractedKeywords).toEqual(
      expect.arrayContaining(["Next.js", "TypeScript", "Node.js", "API"]),
    );
    expect(jobs[0].extractedKeywords).not.toContain("JavaScript");
  });
});
