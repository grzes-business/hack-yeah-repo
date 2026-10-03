import type { MetricSample } from "../domain";
import { HealthDataSourceRequestSchema, parseHealthDataSourceResponse, type HealthDataSource, type HealthDataSourceRequest } from "./data-source";
export interface MetricSampleWriter { saveMetrics(samples: MetricSample[]): Promise<number> }

/** Adapters are untrusted inputs. Validate the complete response before any write. */
export async function ingestHealthData(source: HealthDataSource, request: HealthDataSourceRequest, writer: MetricSampleWriter) {
  const args = HealthDataSourceRequestSchema.parse(request);
  const samples = parseHealthDataSourceResponse(args, await source.getSamples(args));
  const sourceIds = new Set<string>();
  for (const sample of samples) {
    const identity = JSON.stringify([sample.source.type, sample.source.externalId, sample.metric]);
    if (sourceIds.has(identity)) throw new Error("Duplicate source identity in ingestion batch.");
    sourceIds.add(identity);
  }
  const stored = samples.length ? await writer.saveMetrics(samples) : 0;
  if (stored !== samples.length) throw new Error("Ingestion did not confirm the complete batch.");
  return { fetched: samples.length, stored };
}
