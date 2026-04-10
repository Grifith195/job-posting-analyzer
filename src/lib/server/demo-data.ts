import type { AnalysisResult, CleanedJob } from "@/lib/pipeline";
import { bandForScore } from "@/lib/pipeline";

export const demoAdzunaResponse = {
  count: 10,
  results: [
    {
      id: "demo-frontend-1",
      title: "Junior Front End Developer",
      company: { display_name: "Maple Labs" },
      location: { display_name: "Toronto, Ontario" },
      category: { label: "IT Jobs" },
      contract_type: "permanent",
      salary_min: 65000,
      salary_max: 82000,
      created: "2026-04-08T12:00:00Z",
      description:
        "Build React and TypeScript interfaces, integrate REST APIs, write tests, and collaborate with product teams using Git and Agile practices.",
      redirect_url: "https://example.com/demo/frontend-1",
    },
    {
      id: "demo-fullstack-2",
      title: "Full Stack Developer",
      company: { display_name: "Northstar Digital" },
      location: { display_name: "Remote, Canada" },
      category: { label: "IT Jobs" },
      contract_type: "permanent",
      salary_min: 78000,
      salary_max: 98000,
      created: "2026-04-07T12:00:00Z",
      description:
        "Work with Next.js, Node.js, SQL, APIs, testing, Docker, and cloud deployment while communicating with designers and stakeholders.",
      redirect_url: "https://example.com/demo/fullstack-2",
    },
    {
      id: "demo-data-3",
      title: "Software Developer",
      company: { display_name: "Civic Analytics Co." },
      location: { display_name: "Ottawa, Ontario" },
      category: { label: "IT Jobs" },
      contract_type: "contract",
      salary_min: 70000,
      salary_max: 90000,
      created: "2026-04-06T12:00:00Z",
      description:
        "Create data-driven web tools with Python, JavaScript, SQL, REST APIs, Git, cloud services, and clear technical communication.",
      redirect_url: "https://example.com/demo/software-3",
    },
    {
      id: "demo-cloud-4",
      title: "Junior Cloud Application Developer",
      company: { display_name: "Harbour Systems" },
      location: { display_name: "Vancouver, British Columbia" },
      category: { label: "IT Jobs" },
      contract_type: "permanent",
      salary_min: 72000,
      salary_max: 88000,
      created: "2026-04-05T12:00:00Z",
      description:
        "Develop application features using JavaScript, Node, Azure, Docker, testing, CI practices, and API integrations.",
      redirect_url: "https://example.com/demo/cloud-4",
    },
    {
      id: "demo-react-5",
      title: "React Developer",
      company: { display_name: "Prairie Product Studio" },
      location: { display_name: "Calgary, Alberta" },
      category: { label: "IT Jobs" },
      contract_type: "permanent",
      salary_min: 68000,
      salary_max: 86000,
      created: "2026-04-04T12:00:00Z",
      description:
        "Maintain React components, TypeScript models, accessibility improvements, automated tests, Git workflows, and API client code.",
      redirect_url: "https://example.com/demo/react-5",
    },
  ],
};

export function createDemoAnalysis(jobs: CleanedJob[]): AnalysisResult {
  const score = 78;

  return {
    roleFitScore: score,
    band: bandForScore(score),
    summary:
      "The resume appears aligned with common Canadian software developer postings, especially if it highlights concrete React, TypeScript, API, and testing work.",
    commonRequirements: [
      "React or modern JavaScript UI experience",
      "TypeScript and API integration",
      "Git, testing, and collaborative delivery habits",
      "Clear communication with product or stakeholder teams",
    ],
    matchedStrengths: [
      "Front-end development keywords are present across the target postings.",
      "API and testing experience would map strongly to the sampled roles.",
      "Project-based evidence can work well for junior and early-career roles.",
    ],
    missingSignals: [
      "Cloud deployment experience is not always visible in resumes unless called out.",
      "Quantified impact is often missing from school or project descriptions.",
      "SQL or backend work should be explicit when applying to full-stack postings.",
    ],
    resumeSuggestions: [
      "Add a skills line that names React, TypeScript, APIs, Git, and testing if accurate.",
      "Rewrite project bullets to include outcomes, not only tools.",
      "Include one bullet about deployment or cloud workflow if you have it.",
    ],
    jobMatches: jobs.slice(0, 5).map((job, index) => ({
      jobId: job.id,
      title: job.title,
      company: job.company,
      score: Math.max(58, score - index * 4),
      reason: `This posting overlaps with ${job.extractedKeywords.slice(0, 3).join(", ") || "general software delivery"} signals.`,
    })),
    disclaimer:
      "This is a coaching estimate for resume improvement, not a hiring decision or guarantee.",
  };
}
