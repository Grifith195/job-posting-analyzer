import { errorJson } from "@/lib/server/http";
import {
  analyzePipelineInputSchema,
  runResumeAnalysisPipeline,
} from "@/lib/server/pipeline-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await runResumeAnalysisPipeline(
      analyzePipelineInputSchema.parse(await request.json()),
    );

    return Response.json(result);
  } catch (error) {
    return errorJson(error, "Analysis failed.");
  }
}
