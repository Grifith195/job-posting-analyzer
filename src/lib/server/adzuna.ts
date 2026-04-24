import {
  COUNTRY_CODE,
  RESULTS_PER_SEARCH,
  type CleanedJob,
  type JobSearchQuery,
} from "@/lib/pipeline";
import { demoAdzunaResponse } from "@/lib/server/demo-data";

type AdzunaJob = {
  id?: string | number;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  category?: { label?: string };
  contract_type?: string;
  salary_min?: number;
  salary_max?: number;
  created?: string;
  description?: string;
  redirect_url?: string;
};

type AdzunaResponse = {
  results?: AdzunaJob[];
  count?: number;
};

const keywordMatchers = [
  { label: "React", aliases: ["react"] },
  { label: "Next.js", aliases: ["next.js", "nextjs", "next js"] },
  { label: "TypeScript", aliases: ["typescript"] },
  { label: "JavaScript", aliases: ["javascript"] },
  { label: "Node.js", aliases: ["node.js", "nodejs", "node js"] },
  { label: "Python", aliases: ["python"] },
  { label: "SQL", aliases: ["sql", "postgres", "mysql"] },
  { label: "AWS", aliases: ["aws", "amazon web services"] },
  { label: "Azure", aliases: ["azure"] },
  { label: "Docker", aliases: ["docker", "container"] },
  { label: "Git", aliases: ["git", "github"] },
  { label: "API", aliases: ["api", "apis", "rest", "graphql"] },
  { label: "Testing", aliases: ["testing", "test", "tests", "jest", "playwright"] },
  { label: "Agile", aliases: ["agile", "scrum"] },
  { label: "Communication", aliases: ["communication", "communicate", "collaborate", "collaboration"] },
  { label: "Excel", aliases: ["excel", "spreadsheet", "spreadsheets"] },
  { label: "Tableau", aliases: ["tableau"] },
  { label: "Power BI", aliases: ["power bi", "powerbi"] },
  { label: "Dashboarding", aliases: ["dashboard", "dashboards"] },
  { label: "Reporting", aliases: ["report", "reports", "reporting"] },
  {
    label: "Data Visualization",
    aliases: ["visualization", "visualisation", "visualizations", "visualisations"],
  },
  {
    label: "Stakeholder Management",
    aliases: ["stakeholder", "stakeholders", "cross-functional", "cross functional"],
  },
  {
    label: "Product Strategy",
    aliases: ["product strategy", "go-to-market", "go to market", "market research", "business value"],
  },
  {
    label: "Roadmapping",
    aliases: ["roadmap", "roadmaps", "backlog", "prioritization", "prioritisation"],
  },
  {
    label: "Experimentation",
    aliases: ["experiment", "experimentation", "hypothesis", "a/b", "ab testing"],
  },
  {
    label: "User Research",
    aliases: ["user research", "user interview", "user interviews", "customer interview", "customer interviews"],
  },
  { label: "Metrics", aliases: ["metric", "metrics", "kpi", "kpis", "okr", "okrs"] },
];

function compactText(value: string | undefined, fallback = "Not provided") {
  return value?.replace(/\s+/g, " ").trim() || fallback;
}

function nullableText(value: string | undefined) {
  const text = compactText(value, "");
  return text.length > 0 ? text : null;
}

function nullableNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractKeywords(job: AdzunaJob) {
  const haystack = `${job.title ?? ""} ${job.description ?? ""}`.toLowerCase();

  return keywordMatchers
    .filter((keyword) =>
      keyword.aliases.some((alias) =>
        new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
          haystack,
        ),
      ),
    )
    .map((keyword) => keyword.label);
}

export function cleanAdzunaJobs(raw: AdzunaResponse): CleanedJob[] {
  return (raw.results ?? []).map((job, index) => ({
    id: String(job.id ?? `adzuna-${index + 1}`),
    title: compactText(job.title, "Untitled role"),
    company: compactText(job.company?.display_name, "Company not listed"),
    location: compactText(job.location?.display_name, "Canada"),
    category: nullableText(job.category?.label),
    contractType: nullableText(job.contract_type),
    salaryMin: nullableNumber(job.salary_min),
    salaryMax: nullableNumber(job.salary_max),
    createdAt: nullableText(job.created),
    descriptionSnippet: compactText(job.description, "No description snippet supplied."),
    redirectUrl: nullableText(job.redirect_url),
    source: "Adzuna",
    extractedKeywords: extractKeywords(job),
  }));
}

export async function fetchAdzunaJobs(query: JobSearchQuery): Promise<AdzunaResponse> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    throw new Error("Missing ADZUNA_APP_ID or ADZUNA_APP_KEY.");
  }

  const url = new URL(
    `https://api.adzuna.com/v1/api/jobs/${COUNTRY_CODE}/search/1`,
  );
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", String(RESULTS_PER_SEARCH));
  url.searchParams.set("what", query.title);
  url.searchParams.set("content-type", "application/json");

  if (query.location) {
    url.searchParams.set("where", query.location);
  }

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Adzuna returned ${response.status} ${response.statusText}.`);
  }

  return (await response.json()) as AdzunaResponse;
}

export function fetchDemoAdzunaJobs(): AdzunaResponse {
  return demoAdzunaResponse;
}

export function hasAdzunaConfig() {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}
