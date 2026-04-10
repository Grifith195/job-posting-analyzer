import { expect, test } from "@playwright/test";

test("runs the full bronze/silver/gold job analysis flow", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Job Posting Analyzer");

  await page.getByLabel("Job title").fill("software developer");
  await page.getByLabel("City or province").fill("Toronto");
  await page.getByRole("button", { name: "Fetch and clean 10 jobs" }).click();

  await expect(page.getByTestId("bronze-stage")).toContainText("Saved");
  await expect(page.getByTestId("bronze-stage")).toContainText("bronze/");
  await expect(page.getByTestId("silver-stage")).toContainText("Saved");
  await expect(page.getByTestId("silver-stage")).toContainText("silver/");
  await expect(page.getByRole("heading", { name: "Cleaned postings" })).toBeVisible();

  await page
    .getByPlaceholder(/Paste resume text here/i)
    .fill(
      "Software developer resume with React, TypeScript, API integration, testing, Git, SQL, and deployment project experience across portfolio and school projects.",
    );
  await page.getByRole("button", { name: "Analyze top 5 jobs" }).click();

  await expect(page.getByTestId("gold-stage")).toContainText("Saved");
  await expect(page.getByTestId("gold-stage")).toContainText("gold/");
  await expect(page.getByRole("heading", { name: "Good match" })).toBeVisible();
  await expect(page.getByText("Score")).toBeVisible();
  await expect(page.getByTestId("role-fit-score")).toHaveText("78");
});
