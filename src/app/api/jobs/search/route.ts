import { errorJson } from "@/lib/server/http";
import {
  parseSearchPipelineInput,
  runJobSearchPipeline,
} from "@/lib/server/pipeline-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    const result = await runJobSearchPipeline(parseSearchPipelineInput(body));

    return Response.json(result);
  } catch (error) {
    return errorJson(error, "Search failed.");
  }
}
