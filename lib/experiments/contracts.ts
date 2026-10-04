import { z } from "zod";
import { addCalendarDays, LocalDateSchema, RecordIdSchema, RelationshipRegistry, TimestampSchema, type LocalDate } from "../domain";
import { FeatureScopeSchema, type FeatureScope } from "../features/contracts";

/**
 * Stage 14 personal experiments, policy `experiments-v1`.
 * Only code-owned templates exist; each binds to a registered relationship and
 * its outcome, so plans cannot introduce new variables or edges. Everything a
 * result depends on (periods, target, minimums, method) is fixed at acceptance.
 */
export const EXPERIMENT_POLICY_VERSION = "experiments-v1";
export const EXPERIMENT_PERIOD_DAYS = 14;
export const EXPERIMENT_MIN_DAYS_PER_GROUP = 5;

export const ExperimentTemplates = Object.freeze({
  sleep_target__energy: Object.freeze({
    id: "sleep_target__energy",
    relationshipId: RelationshipRegistry.sleep_duration__energy.id,
    title: "Sleep at least 7.5 hours, then rate your energy",
    behaviour: "Aim for at least 7.5 hours of recorded sleep each night for 14 days.",
    primaryOutcome: "energy",
    secondaryOutcome: "hrv",
    targetSleepMinutes: 450,
  }),
} as const);
export const ExperimentTemplateIdSchema = z.enum(["sleep_target__energy"]);

export const ExperimentStatusSchema = z.enum(["active", "paused", "completed", "abandoned"]);
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;
const PeriodSchema = z.strictObject({ from: LocalDateSchema, to: LocalDateSchema });

export const ExperimentPlanSchema = z.strictObject({
  id: RecordIdSchema,
  policyVersion: z.literal(EXPERIMENT_POLICY_VERSION),
  templateId: ExperimentTemplateIdSchema,
  relationshipId: z.literal(RelationshipRegistry.sleep_duration__energy.id),
  scope: FeatureScopeSchema,
  /** Demo plans may start in the past over synthetic history; personal plans never do. */
  retrospectiveDemo: z.boolean(),
  primaryOutcome: z.literal("energy"),
  secondaryOutcome: z.literal("hrv"),
  targetSleepMinutes: z.literal(450),
  baseline: PeriodSchema,
  intervention: PeriodSchema,
  minimumDaysPerGroup: z.literal(EXPERIMENT_MIN_DAYS_PER_GROUP),
  method: z.literal("median_difference_descriptive"),
  confounders: z.array(z.string()).min(1),
  acceptedAt: TimestampSchema,
}).superRefine((plan, ctx) => {
  if (addCalendarDays(plan.baseline.to, 1) !== plan.intervention.from) ctx.addIssue({ code: "custom", path: ["intervention"], message: "Intervention must follow the baseline directly" });
  if (addCalendarDays(plan.baseline.from, EXPERIMENT_PERIOD_DAYS - 1) !== plan.baseline.to) ctx.addIssue({ code: "custom", path: ["baseline"], message: "Baseline must be 14 days" });
  if (addCalendarDays(plan.intervention.from, EXPERIMENT_PERIOD_DAYS - 1) !== plan.intervention.to) ctx.addIssue({ code: "custom", path: ["intervention"], message: "Intervention must be 14 days" });
  if (plan.scope === "personal" && plan.retrospectiveDemo) ctx.addIssue({ code: "custom", path: ["retrospectiveDemo"], message: "Personal plans cannot be retrospective" });
});
export type ExperimentPlan = z.infer<typeof ExperimentPlanSchema>;

export const ExperimentEventSchema = z.strictObject({
  type: z.enum(["accepted", "paused", "resumed", "completed", "abandoned"]),
  at: TimestampSchema,
  date: LocalDateSchema,
});
export type ExperimentEvent = z.infer<typeof ExperimentEventSchema>;

export const ExperimentActionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("accept"), templateId: ExperimentTemplateIdSchema, scope: FeatureScopeSchema }),
  z.strictObject({ action: z.enum(["pause", "resume", "abandon", "complete"]), id: RecordIdSchema }),
]);
export type ExperimentAction = z.infer<typeof ExperimentActionSchema>;

/** Allowed lifecycle transitions; anything else is rejected by the server. */
export const ExperimentTransitions: Record<"pause" | "resume" | "abandon" | "complete", { from: ExperimentStatus[]; to: ExperimentStatus; event: ExperimentEvent["type"] }> = {
  pause: { from: ["active"], to: "paused", event: "paused" },
  resume: { from: ["paused"], to: "active", event: "resumed" },
  abandon: { from: ["active", "paused"], to: "abandoned", event: "abandoned" },
  complete: { from: ["active", "paused"], to: "completed", event: "completed" },
};

/**
 * Builds the predeclared plan. Personal plans start today and run forward; the
 * synthetic demo plan ends today so the full comparison is visible immediately,
 * and is labeled retrospective everywhere it is shown.
 */
export function createExperimentPlan(input: { id: string; scope: FeatureScope; today: LocalDate; acceptedAt: string }): ExperimentPlan {
  const template = ExperimentTemplates.sleep_target__energy;
  const interventionFrom = input.scope === "demo" ? addCalendarDays(input.today, -(EXPERIMENT_PERIOD_DAYS - 1)) : input.today;
  const baselineFrom = addCalendarDays(interventionFrom, -EXPERIMENT_PERIOD_DAYS);
  return ExperimentPlanSchema.parse({
    id: input.id, policyVersion: EXPERIMENT_POLICY_VERSION, templateId: template.id, relationshipId: template.relationshipId,
    scope: input.scope, retrospectiveDemo: input.scope === "demo",
    primaryOutcome: template.primaryOutcome, secondaryOutcome: template.secondaryOutcome, targetSleepMinutes: template.targetSleepMinutes,
    baseline: { from: baselineFrom, to: addCalendarDays(interventionFrom, -1) },
    intervention: { from: interventionFrom, to: addCalendarDays(interventionFrom, EXPERIMENT_PERIOD_DAYS - 1) },
    minimumDaysPerGroup: EXPERIMENT_MIN_DAYS_PER_GROUP, method: "median_difference_descriptive",
    confounders: RelationshipRegistry.sleep_duration__energy.confounders.map(c => `${c.feature}${c.lagDays ? ` (previous day)` : ""}`),
    acceptedAt: input.acceptedAt,
  });
}
