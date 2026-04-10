import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COUNTRY_CODE, RESULTS_PER_SEARCH } from "@/lib/pipeline";
import { cleanAdzunaJobs, fetchAdzunaJobs } from "@/lib/server/adzuna";

export const scheduledRoles = [
  "software developer",
  "data analyst",
  "product manager",
  "frontend developer",
] as const;

const outputDir = path.join(process.cwd(), "data", "scheduled-job-postings");

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function writeJson(filename: string, data: unknown) {
  await writeFile(
    path.join(outputDir, filename),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
}

async function runScheduledEtl() {
  await mkdir(outputDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const manifest = {
    generatedAt,
    source: "Adzuna",
    country: COUNTRY_CODE,
    resultsPerRole: RESULTS_PER_SEARCH,
    roles: [...scheduledRoles],
    files: scheduledRoles.map((role) => `${slugify(role)}.json`),
  };

  for (const role of scheduledRoles) {
    const raw = await fetchAdzunaJobs({
      title: role,
      country: COUNTRY_CODE,
      resultsPerPage: RESULTS_PER_SEARCH,
    });
    const jobs = cleanAdzunaJobs(raw);

    await writeJson(`${slugify(role)}.json`, {
      generatedAt,
      source: "Adzuna",
      country: COUNTRY_CODE,
      query: {
        title: role,
        resultsPerPage: RESULTS_PER_SEARCH,
      },
      jobs,
    });
  }

  await writeJson("manifest.json", manifest);
  console.log(
    `Wrote scheduled ETL JSON for ${scheduledRoles.length} roles to ${outputDir}`,
  );
}

export { runScheduledEtl };

const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runScheduledEtl().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
