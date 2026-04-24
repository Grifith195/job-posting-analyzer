import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { ANALYZED_JOB_LIMIT, type AnalysisResult } from "@/lib/pipeline";
import { cleanAdzunaJobs } from "@/lib/server/adzuna";
import {
  analyzeResumeAgainstJobs,
  type AnalysisPromptVariant,
  type ThemeAliasMap,
  themeAliases,
} from "@/lib/server/gemini";

type ScoreRange = {
  min: number;
  max: number;
};

type EvaluationCase = {
  caseId: string;
  label: string;
  jobFixture: string;
  searchContext: {
    title: string;
    location?: string;
  };
  resumeText: string;
  expectedBands: string[];
  expectedScoreRange: ScoreRange;
  expectedStrengthThemes: string[];
  expectedGapThemes: string[];
  notes?: string;
  failureHypothesis?: string;
};

type RawAdzunaJob = {
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

type RawJobBundle = {
  results: RawAdzunaJob[];
};

type UpstreamFixture = {
  fixtureId: string;
  label: string;
  rawJob: RawAdzunaJob;
  expectedKeywords: string[];
};

type RubricScores = {
  groundedness: number;
  requirementCoverage: number;
  actionability: number;
  scoreCalibration: number;
  total: number;
  rating: "strong" | "acceptable" | "weak" | "poor";
  failure: boolean;
};

type EvaluatedCase = {
  caseId: string;
  label: string;
  searchContext: EvaluationCase["searchContext"];
  jobFixture: string;
  extractedKeywords: string[];
  analysis: AnalysisResult;
  rubric: RubricScores;
  expectedScoreRange: ScoreRange;
  expectedBands: string[];
  expectedStrengthThemes: string[];
  expectedGapThemes: string[];
  notes?: string;
};

type ParsedArgs = {
  outputDir: string;
  includeBaseline: boolean;
  upstreamOnly: boolean;
};

const rootDir = process.cwd();
const representativeCasesDir = path.join(rootDir, "evaluation", "cases", "representative");
const failureCasesDir = path.join(rootDir, "evaluation", "cases", "failure");
const generatedDirName = "generated";

const actionVerbs = [
  "add",
  "show",
  "highlight",
  "quantify",
  "rewrite",
  "include",
  "demonstrate",
  "call out",
  "name",
  "describe",
  "emphasize",
  "mention",
  "connect",
];

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const outputDirArg = args.find((arg) => arg.startsWith("--output-dir="));
  const includeBaseline = args.includes("--include-baseline");
  const upstreamOnly = args.includes("--upstream-only");

  if (!outputDirArg) {
    throw new Error("Missing --output-dir=... argument.");
  }

  const outputDir = outputDirArg.slice("--output-dir=".length);
  if (!outputDir) {
    throw new Error("The --output-dir argument cannot be empty.");
  }

  return { outputDir, includeBaseline, upstreamOnly };
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const body = await readFile(filePath, "utf8");
  return JSON.parse(body) as T;
}

async function readCaseDirectory(dirPath: string): Promise<EvaluationCase[]> {
  const entries = await readdir(dirPath);

  return Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .sort()
      .map((entry) => readJsonFile<EvaluationCase>(path.join(dirPath, entry))),
  );
}

async function mapSequential<T, TResult>(
  values: T[],
  mapper: (value: T) => Promise<TResult>,
) {
  const results: TResult[] = [];

  for (const value of values) {
    results.push(await mapper(value));
  }

  return results;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+.#/\s-]+/g, " ").replace(/\s+/g, " ").trim();
}

function includesAlias(text: string, alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function themeMatched(text: string, theme: string, aliases: ThemeAliasMap) {
  const normalizedTheme = normalizeText(theme);
  const aliasList = aliases[normalizedTheme] ?? [theme];
  return aliasList.some((alias) => includesAlias(text, normalizeText(alias)));
}

function countThemeMatches(text: string, themes: string[], aliases: ThemeAliasMap) {
  return themes.filter((theme) => themeMatched(text, theme, aliases)).length;
}

function scoreFromRatio(ratio: number) {
  if (ratio >= 0.85) {
    return 5;
  }

  if (ratio >= 0.65) {
    return 4;
  }

  if (ratio >= 0.45) {
    return 3;
  }

  if (ratio >= 0.2) {
    return 2;
  }

  return 1;
}

function scoreCalibration(
  score: number,
  expectedRange: ScoreRange,
  band: string,
  expectedBands: string[],
) {
  const withinRange = score >= expectedRange.min && score <= expectedRange.max;
  const distance = withinRange
    ? 0
    : Math.min(Math.abs(score - expectedRange.min), Math.abs(score - expectedRange.max));
  const bandMatch = expectedBands.includes(band);

  if (withinRange && bandMatch) {
    return 5;
  }

  if (distance <= 5 && bandMatch) {
    return 4;
  }

  if (distance <= 10 || bandMatch) {
    return 3;
  }

  if (distance <= 15) {
    return 2;
  }

  return 1;
}

function scoreActionability(suggestions: string[]) {
  if (!suggestions.length) {
    return 1;
  }

  const specificCount = suggestions.filter((suggestion) => {
    const text = normalizeText(suggestion);
    const wordCount = text.split(" ").filter(Boolean).length;
    const hasActionVerb = actionVerbs.some((verb) => text.includes(verb));
    const hasEvidenceCue =
      /\b(metric|quantif|project|resume|bullet|skill|experience|impact|example|outcome|technology)\b/i.test(
        suggestion,
      );

    return wordCount >= 6 && hasActionVerb && hasEvidenceCue;
  }).length;

  return scoreFromRatio(specificCount / suggestions.length);
}

function ratingForTotal(total: number): RubricScores["rating"] {
  if (total >= 17) {
    return "strong";
  }

  if (total >= 13) {
    return "acceptable";
  }

  if (total >= 9) {
    return "weak";
  }

  return "poor";
}

function scoreAnalysis(
  evaluationCase: EvaluationCase,
  jobsKeywords: string[],
  analysis: AnalysisResult,
) {
  const combinedText = normalizeText(
    [
      analysis.summary,
      analysis.commonRequirements.join(" "),
      analysis.matchedStrengths.join(" "),
      analysis.missingSignals.join(" "),
      analysis.resumeSuggestions.join(" "),
      analysis.jobMatches.map((match) => match.reason).join(" "),
    ].join(" "),
  );
  const expectedStrengthCoverage =
    countThemeMatches(combinedText, evaluationCase.expectedStrengthThemes, themeAliases) /
    evaluationCase.expectedStrengthThemes.length;
  const expectedGapCoverage =
    countThemeMatches(combinedText, evaluationCase.expectedGapThemes, themeAliases) /
    evaluationCase.expectedGapThemes.length;
  const supportedThemes = [...new Set([...evaluationCase.expectedStrengthThemes, ...evaluationCase.expectedGapThemes, ...jobsKeywords])];
  const supportedMentions =
    countThemeMatches(combinedText, supportedThemes, themeAliases) /
    Math.max(1, supportedThemes.length);
  const groundedness = scoreFromRatio(
    Math.min(1, (expectedStrengthCoverage + expectedGapCoverage + supportedMentions) / 3),
  );
  const requirementCoverage = scoreFromRatio(
    Math.min(1, (expectedStrengthCoverage * 2 + expectedGapCoverage) / 3),
  );
  const actionability = scoreActionability(analysis.resumeSuggestions);
  const scoreCalibrationValue = scoreCalibration(
    analysis.roleFitScore,
    evaluationCase.expectedScoreRange,
    analysis.band,
    evaluationCase.expectedBands,
  );
  const total =
    groundedness + requirementCoverage + actionability + scoreCalibrationValue;

  return {
    groundedness,
    requirementCoverage,
    actionability,
    scoreCalibration: scoreCalibrationValue,
    total,
    rating: ratingForTotal(total),
    failure:
      total < 13 ||
      [groundedness, requirementCoverage, actionability, scoreCalibrationValue].some(
        (score) => score <= 2,
      ),
  } satisfies RubricScores;
}

async function runAnalysisCase(
  evaluationCase: EvaluationCase,
  variant: AnalysisPromptVariant,
) {
  const fixturePath = path.join(rootDir, evaluationCase.jobFixture);
  const rawJobs = await readJsonFile<RawJobBundle>(fixturePath);
  const cleanedJobs = cleanAdzunaJobs(rawJobs).slice(0, ANALYZED_JOB_LIMIT);
  const analysis = await analyzeResumeAgainstJobs(
    evaluationCase.resumeText,
    cleanedJobs,
    false,
    variant,
  );
  const extractedKeywords = [
    ...new Set(cleanedJobs.flatMap((job) => job.extractedKeywords)),
  ];

  return {
    cleanedJobs,
    rawJobs,
    result: {
      caseId: evaluationCase.caseId,
      label: evaluationCase.label,
      searchContext: evaluationCase.searchContext,
      jobFixture: evaluationCase.jobFixture,
      extractedKeywords,
      analysis,
      rubric: scoreAnalysis(evaluationCase, extractedKeywords, analysis),
      expectedScoreRange: evaluationCase.expectedScoreRange,
      expectedBands: evaluationCase.expectedBands,
      expectedStrengthThemes: evaluationCase.expectedStrengthThemes,
      expectedGapThemes: evaluationCase.expectedGapThemes,
      notes: evaluationCase.notes,
    } satisfies EvaluatedCase,
  };
}

async function writeJson(filePath: string, data: unknown) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function toPercentage(value: number) {
  return Number((value * 100).toFixed(1));
}

async function writeGeneratedArtifacts(
  outputDir: string,
  evaluatedCases: Array<{
    evaluationCase: EvaluationCase;
    rawJobs: RawJobBundle;
    cleanedJobs: ReturnType<typeof cleanAdzunaJobs>;
    analysis: AnalysisResult;
  }>,
) {
  const generatedDir = path.join(outputDir, generatedDirName);
  await rm(generatedDir, { recursive: true, force: true });
  await mkdir(generatedDir, { recursive: true });

  const results = await Promise.all(
    evaluatedCases.map(async ({ evaluationCase, rawJobs, cleanedJobs, analysis }) => {
      const caseDir = path.join(generatedDir, evaluationCase.caseId);
      await mkdir(caseDir, { recursive: true });

      const bronzePath = path.join(caseDir, "bronze.json");
      const silverPath = path.join(caseDir, "silver.json");
      const goldPath = path.join(caseDir, "gold.json");

      const bronze = {
        caseId: evaluationCase.caseId,
        source: "evaluation-fixture",
        query: evaluationCase.searchContext,
        raw: rawJobs,
      };
      const silver = {
        caseId: evaluationCase.caseId,
        source: "evaluation-fixture",
        query: evaluationCase.searchContext,
        jobs: cleanedJobs,
      };
      const gold = {
        caseId: evaluationCase.caseId,
        source: "Gemini",
        analysis,
      };

      await Promise.all([
        writeJson(bronzePath, bronze),
        writeJson(silverPath, silver),
        writeJson(goldPath, gold),
      ]);

      const checks = {
        loadedFixture: rawJobs.results.length > 0,
        savedBronze: true,
        savedSilver: cleanedJobs.length > 0,
        analysisSucceeded: true,
        savedGold:
          typeof analysis.roleFitScore === "number" &&
          analysis.resumeSuggestions.length > 0,
      };

      return {
        caseId: evaluationCase.caseId,
        label: evaluationCase.label,
        searchContext: evaluationCase.searchContext,
        checks,
        score: Object.values(checks).filter(Boolean).length,
        maxScore: 5,
        artifactPaths: {
          bronze: path.relative(rootDir, bronzePath).replace(/\\/g, "/"),
          silver: path.relative(rootDir, silverPath).replace(/\\/g, "/"),
          gold: path.relative(rootDir, goldPath).replace(/\\/g, "/"),
        },
      };
    }),
  );

  const perfectCases = results.filter((result) => result.score === result.maxScore).length;

  await writeJson(path.join(outputDir, "end-to-end-current.json"), {
    generatedAt: new Date().toISOString(),
    cases: results,
    summary: {
      fullySuccessfulCases: perfectCases,
      totalCases: results.length,
      taskSuccessRate: toPercentage(perfectCases / results.length),
    },
  });
}

function compareKeywordSets(expected: string[], predicted: string[]) {
  const expectedSet = new Set(expected);
  const predictedSet = new Set(predicted);
  const correct = predicted.filter((keyword) => expectedSet.has(keyword)).length;

  return {
    correct,
    predicted: predictedSet.size,
    expected: expectedSet.size,
  };
}

async function runUpstreamEvaluation(outputDir: string) {
  const fixtures = await readJsonFile<UpstreamFixture[]>(
    path.join(rootDir, "evaluation", "fixtures", "upstream-keywords.json"),
  );

  let correct = 0;
  let predicted = 0;
  let expected = 0;

  const cases = fixtures.map((fixture) => {
    const [cleanedJob] = cleanAdzunaJobs({ results: [fixture.rawJob] });
    const counts = compareKeywordSets(fixture.expectedKeywords, cleanedJob.extractedKeywords);

    correct += counts.correct;
    predicted += counts.predicted;
    expected += counts.expected;

    return {
      fixtureId: fixture.fixtureId,
      label: fixture.label,
      expectedKeywords: fixture.expectedKeywords,
      predictedKeywords: cleanedJob.extractedKeywords,
      correctPredictions: cleanedJob.extractedKeywords.filter((keyword) =>
        fixture.expectedKeywords.includes(keyword),
      ),
      missedKeywords: fixture.expectedKeywords.filter(
        (keyword) => !cleanedJob.extractedKeywords.includes(keyword),
      ),
      unexpectedKeywords: cleanedJob.extractedKeywords.filter(
        (keyword) => !fixture.expectedKeywords.includes(keyword),
      ),
    };
  });

  const precision = predicted === 0 ? 0 : correct / predicted;
  const recall = expected === 0 ? 0 : correct / expected;
  const f1 =
    precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  await writeJson(path.join(outputDir, "upstream-keyword-eval.json"), {
    generatedAt: new Date().toISOString(),
    metrics: {
      precision: toPercentage(precision),
      recall: toPercentage(recall),
      f1: toPercentage(f1),
      counts: { correct, predicted, expected },
    },
    cases,
  });

  return { precision, recall, f1, cases };
}

async function writeFailureAnalysis(
  outputDir: string,
  cases: Array<{ evaluationCase: EvaluationCase; result: EvaluatedCase }>,
) {
  const lines = [
    "# Failure Analysis",
    "",
    `Generated at ${new Date().toISOString()}.`,
    "",
  ];

  for (const { evaluationCase, result } of cases) {
    lines.push(`## ${evaluationCase.label}`);
    lines.push("");
    lines.push(`- Hypothesis: ${evaluationCase.failureHypothesis ?? "No hypothesis recorded."}`);
    lines.push(`- Score: ${result.analysis.roleFitScore} (${result.analysis.band})`);
    lines.push(`- Rubric total: ${result.rubric.total}/20 (${result.rubric.rating})`);
    lines.push(`- Failure flagged: ${result.rubric.failure ? "yes" : "no"}`);
    lines.push(`- Extracted keywords: ${result.extractedKeywords.join(", ") || "none"}`);
    lines.push(`- Summary: ${result.analysis.summary}`);
    lines.push(
      `- Missing signals: ${result.analysis.missingSignals.join("; ") || "none"}`,
    );
    lines.push(
      `- Resume suggestions: ${result.analysis.resumeSuggestions.join("; ") || "none"}`,
    );
    lines.push("");
  }

  await writeFile(path.join(outputDir, "failure-analysis.md"), `${lines.join("\n")}\n`, "utf8");
}

async function writeSummary(
  outputDir: string,
  upstreamMetrics: { precision: number; recall: number; f1: number },
  currentResults: EvaluatedCase[],
  baselineResults: EvaluatedCase[],
) {
  const currentAverage =
    currentResults.reduce((sum, result) => sum + result.rubric.total, 0) / currentResults.length;
  const baselineAverage = baselineResults.length
    ? baselineResults.reduce((sum, result) => sum + result.rubric.total, 0) /
      baselineResults.length
    : 0;
  const acceptableCurrentCases = currentResults.filter(
    (result) => result.rubric.total >= 13,
  ).length;

  const lines = [
    "# Evaluation Summary",
    "",
    `Generated at ${new Date().toISOString()}.`,
    "",
    "## Architecture",
    "",
    "- Classification: prompt-first",
    "- Main alternative rejected: retrieval-first / RAG",
    "- Not implemented capability: RAG for larger historical or multi-run corpora",
    "",
    "## Baseline",
    "",
    "- Baseline prompt: same model and schema, but with simpler grounding instructions",
    "- Current prompt: stronger coaching framing, explicit grounding, and stricter JSON behavior",
    "",
    "## Output quality",
    "",
    `- Current average rubric total: ${currentAverage.toFixed(1)}/20`,
    baselineResults.length
      ? `- Baseline average rubric total: ${baselineAverage.toFixed(1)}/20`
      : "- Baseline average rubric total: not run in this evaluation pass",
    `- Representative cases at acceptable or better: ${acceptableCurrentCases}/${currentResults.length}`,
    "",
    "## End-to-end",
    "",
    "- See end-to-end-current.json for raw fixture -> bronze -> silver -> gold task-success checks.",
    "",
    "## Upstream keyword extraction",
    "",
    `- Precision: ${toPercentage(upstreamMetrics.precision)}%`,
    `- Recall: ${toPercentage(upstreamMetrics.recall)}%`,
    `- F1: ${toPercentage(upstreamMetrics.f1)}%`,
    "",
    "## Chosen improvement",
    "",
    "- Expand keyword extraction to better capture analyst and product-manager signals.",
    "- This is motivated by the low recall in the upstream evaluation and the role-specific failure cases.",
  ].filter(Boolean);

  await writeFile(path.join(outputDir, "summary.md"), `${lines.join("\n")}\n`, "utf8");
}

async function writeUpstreamOnlySummary(
  outputDir: string,
  upstreamMetrics: { precision: number; recall: number; f1: number },
) {
  const lines = [
    "# Post-Improvement Summary",
    "",
    `Generated at ${new Date().toISOString()}.`,
    "",
    "## Scope",
    "",
    "- This pass reran the upstream keyword evaluation after the extractor improvement.",
    "- Output-quality and end-to-end Gemini reruns were not completed in this pass because the Gemini free-tier request quota was exhausted after the pre-improvement full evaluation run.",
    "",
    "## Upstream keyword extraction",
    "",
    `- Precision: ${toPercentage(upstreamMetrics.precision)}%`,
    `- Recall: ${toPercentage(upstreamMetrics.recall)}%`,
    `- F1: ${toPercentage(upstreamMetrics.f1)}%`,
    "",
    "## Improvement focus",
    "",
    "- Added analyst-oriented labels such as Excel, Tableau, Power BI, Dashboarding, Reporting, and Data Visualization.",
    "- Added product-oriented labels such as Roadmapping, Product Strategy, User Research, Experimentation, Metrics, and Stakeholder Management.",
    "- Tightened overly broad aliases that were creating noisy JavaScript and Communication matches.",
  ];

  await writeFile(path.join(outputDir, "summary.md"), `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const { outputDir, includeBaseline, upstreamOnly } = parseArgs();
  const resolvedOutputDir = path.join(rootDir, outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  if (upstreamOnly) {
    const upstreamMetrics = await runUpstreamEvaluation(resolvedOutputDir);
    await writeUpstreamOnlySummary(resolvedOutputDir, upstreamMetrics);
    return;
  }

  const representativeCases = await readCaseDirectory(representativeCasesDir);
  const failureCases = await readCaseDirectory(failureCasesDir);

  const representativeCurrent = await mapSequential(representativeCases, async (evaluationCase) => ({
    evaluationCase,
    ...(await runAnalysisCase(evaluationCase, "current")),
  }));

  const representativeBaseline = includeBaseline
    ? await mapSequential(representativeCases, async (evaluationCase) => ({
        evaluationCase,
        ...(await runAnalysisCase(evaluationCase, "baseline")),
      }))
    : [];

  const failureCurrent = await mapSequential(failureCases, async (evaluationCase) => ({
    evaluationCase,
    ...(await runAnalysisCase(evaluationCase, "current")),
  }));

  await writeJson(path.join(resolvedOutputDir, "output-quality-current.json"), {
    generatedAt: new Date().toISOString(),
    variant: "current",
    averageRubricTotal:
      representativeCurrent.reduce((sum, item) => sum + item.result.rubric.total, 0) /
      representativeCurrent.length,
    cases: representativeCurrent.map((item) => item.result),
  });

  if (representativeBaseline.length) {
    await writeJson(path.join(resolvedOutputDir, "output-quality-baseline.json"), {
      generatedAt: new Date().toISOString(),
      variant: "baseline",
      averageRubricTotal:
        representativeBaseline.reduce((sum, item) => sum + item.result.rubric.total, 0) /
        representativeBaseline.length,
      cases: representativeBaseline.map((item) => item.result),
    });
  }

  await writeGeneratedArtifacts(
    resolvedOutputDir,
    representativeCurrent.map((item) => ({
      evaluationCase: item.evaluationCase,
      rawJobs: item.rawJobs,
      cleanedJobs: item.cleanedJobs,
      analysis: item.result.analysis,
    })),
  );

  const upstreamMetrics = await runUpstreamEvaluation(resolvedOutputDir);
  await writeFailureAnalysis(
    resolvedOutputDir,
    failureCurrent.map((item) => ({ evaluationCase: item.evaluationCase, result: item.result })),
  );
  await writeSummary(
    resolvedOutputDir,
    upstreamMetrics,
    representativeCurrent.map((item) => item.result),
    representativeBaseline.map((item) => item.result),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
