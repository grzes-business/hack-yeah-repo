import { MetricRegistry, MetricSampleSchema, type Metric, type MetricSample } from "../domain";
import { demoNamespace, DemoOptionsSchema, localInstant, scenarioDays, type DemoOptions } from "../demo/scenario";
import { HealthDataSourceRequestSchema, parseHealthDataSourceResponse, type HealthDataSource, type HealthDataSourceRequest } from "./data-source";

export class MockHealthDataSource implements HealthDataSource {
  private readonly samples: MetricSample[];
  constructor(input: DemoOptions) {
    const options = DemoOptionsSchema.parse(input);
    const namespace = demoNamespace(options);
    this.samples = [];
    for (const day of scenarioDays(options)) {
      const instant = (hour: number, minute = 0) => localInstant(day.date, hour, minute, options.timeZone);
      const push = (metric: Metric, value: number | string, startedAt: string, endedAt = startedAt, sessionId?: string) => {
        const id = `${namespace}${day.date}:${metric}`;
        this.samples.push(MetricSampleSchema.parse({
          id, metric, value, unit: MetricRegistry[metric].unit, startedAt, endedAt,
          source: { type: "mock", externalId: id, device: "Synthetic watch", provider: "Personal Evidence demo v1" },
          ...(sessionId ? { sessionId } : {}),
        }));
      };
      if (!day.omitHrv) push("hrv", day.hrv, instant(8));
      push("resting_hr", day.restingHr, instant(8, 5));
      if (!day.omitSleep) {
        const end = instant(7, 30);
        const start = new Date(Date.parse(end) - day.sleepMinutes * 60000).toISOString();
        const session = `${namespace}${day.date}:sleep`;
        push("sleep_duration", day.sleepMinutes, start, end, session);
        push("sleep_start", start, start, end, session);
        push("sleep_end", end, start, end, session);
      }
      push("steps", day.steps, instant(0), instant(20));
      push("active_energy", Math.round(day.steps * 0.035 + (day.workoutMinutes ?? 0) * 4), instant(0), instant(20));
      if (day.workoutMinutes !== null && day.workoutRpe !== null) {
        const start = instant(18);
        const end = new Date(Date.parse(start) + day.workoutMinutes * 60000).toISOString();
        const session = `${namespace}${day.date}:workout`;
        push("workout_duration", day.workoutMinutes, start, end, session);
        push("workout_avg_hr", Math.round(100 + day.workoutRpe * 6), start, end, session);
      }
    }
  }
  async getSamples(request: HealthDataSourceRequest): Promise<MetricSample[]> {
    const args = HealthDataSourceRequestSchema.parse(request);
    const response = this.samples.filter(sample => {
      if (!args.metrics.includes(sample.metric)) return false;
      const start = Date.parse(sample.startedAt), end = Date.parse(sample.endedAt);
      return start === end ? start >= args.from.getTime() && start < args.to.getTime()
        : start < args.to.getTime() && end > args.from.getTime();
    }).sort((a, b) => Date.parse(a.endedAt) - Date.parse(b.endedAt) || a.id.localeCompare(b.id));
    return parseHealthDataSourceResponse(args, response);
  }
}
