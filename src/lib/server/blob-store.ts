import { get, put, type PutBlobResult } from "@vercel/blob";

import type { Artifact, PipelineLayer } from "@/lib/pipeline";

type DemoGlobal = typeof globalThis & {
  __JOB_ANALYZER_DEMO_BLOBS__?: Map<string, string>;
};

function demoStore() {
  const storeGlobal = globalThis as DemoGlobal;
  storeGlobal.__JOB_ANALYZER_DEMO_BLOBS__ ??= new Map<string, string>();
  return storeGlobal.__JOB_ANALYZER_DEMO_BLOBS__;
}

export function hasBlobConfig() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function jsonPathname(layer: PipelineLayer, runId: string) {
  return `${layer}/${runId}.json`;
}

function toArtifact(
  layer: PipelineLayer,
  result: PutBlobResult,
  access: "public" | "private",
): Artifact {
  return {
    layer,
    pathname: result.pathname,
    url: result.url,
    downloadUrl: result.downloadUrl,
    access,
    demo: false,
  };
}

function toDemoArtifact(layer: PipelineLayer, pathname: string, access: "public" | "private") {
  return {
    layer,
    pathname,
    url: `demo://${pathname}`,
    downloadUrl: `demo://${pathname}`,
    access,
    demo: true,
  } satisfies Artifact;
}

export async function saveJsonArtifact(
  layer: PipelineLayer,
  pathname: string,
  data: unknown,
  access: "public" | "private",
  demo: boolean,
): Promise<Artifact> {
  const body = JSON.stringify(data, null, 2);

  if (demo) {
    demoStore().set(pathname, body);
    return toDemoArtifact(layer, pathname, access);
  }

  if (!hasBlobConfig()) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN.");
  }

  const result = await put(pathname, body, {
    access,
    allowOverwrite: true,
    contentType: "application/json",
  });

  return toArtifact(layer, result, access);
}

export async function readJsonArtifact<T>(
  pathname: string,
  access: "public" | "private",
  demo: boolean,
): Promise<T> {
  if (demo) {
    const body = demoStore().get(pathname);

    if (!body) {
      throw new Error(`Demo artifact not found: ${pathname}`);
    }

    return JSON.parse(body) as T;
  }

  if (!hasBlobConfig()) {
    throw new Error("Missing BLOB_READ_WRITE_TOKEN.");
  }

  const result = await get(pathname, { access, useCache: false });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Blob artifact not found: ${pathname}`);
  }

  const body = await new Response(result.stream).text();
  return JSON.parse(body) as T;
}
