import { z } from "zod";
import { MetricSchema, MetricSampleSchema, type MetricSample } from "../domain/metrics";

/** Half-open UTC instant range [from, to); full overlapping intervals are returned. */
export const HealthDataSourceRequestSchema = z.strictObject({
  from: z.date(), to: z.date(), metrics: z.array(MetricSchema).min(1),
}).superRefine((request, ctx) => {
  if (request.from.getTime() >= request.to.getTime()) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "Range end must follow its start" });
  }
  if (new Set(request.metrics).size !== request.metrics.length) {
    ctx.addIssue({ code: "custom", path: ["metrics"], message: "Requested metrics must be unique" });
  }
});
export type HealthDataSourceRequest = z.infer<typeof HealthDataSourceRequestSchema>;

export interface HealthDataSource {
  getSamples(args: HealthDataSourceRequest): Promise<MetricSample[]>;
}

/** Validate at the adapter boundary; this does not persist or deduplicate history. */
export function parseHealthDataSourceResponse(request: HealthDataSourceRequest, response: unknown): MetricSample[] {
  const args = HealthDataSourceRequestSchema.parse(request);
  const samples = z.array(MetricSampleSchema).parse(response);
  const ids = new Set<string>();
  for (const sample of samples) {
    if (!args.metrics.includes(sample.metric)) throw new Error(`Unrequested metric: ${sample.metric}`);
    if (ids.has(sample.id)) throw new Error(`Duplicate sample ID: ${sample.id}`);
    ids.add(sample.id);
    const start = Date.parse(sample.startedAt);
    const end = Date.parse(sample.endedAt);
    const from = args.from.getTime();
    const to = args.to.getTime();
    const overlaps = start === end ? start >= from && start < to : start < to && end > from;
    if (!overlaps) throw new Error(`Sample outside requested range: ${sample.id}`);
  }
  return samples;
}
