import { z } from "zod";
import { FeatureSchema, type Feature } from "./features";
import { addCalendarDays, type LocalDate } from "./primitives";

export const RelationshipIds = Object.freeze({
  SLEEP_ENERGY: "sleep_duration__energy",
  ALCOHOL_HRV: "alcohol__hrv",
  STRESS_SLEEP: "stress__sleep_duration",
  WORKOUT_RPE_ENERGY: "workout_rpe__energy",
} as const);
export const RelationshipIdSchema = z.enum(RelationshipIds);
export type RelationshipId = z.infer<typeof RelationshipIdSchema>;
export const OutcomeSchema = z.enum(["energy", "hrv", "sleep_duration"]);
export type Outcome = z.infer<typeof OutcomeSchema>;
export const RelationshipMethodSchema = z.enum(["spearman", "exposure"]);

type RelationshipDefinition = {
  readonly id: RelationshipId;
  readonly factor: Feature;
  readonly outcome: Outcome;
  readonly lagDays: number;
  readonly method: z.infer<typeof RelationshipMethodSchema>;
  readonly confounders: readonly { readonly feature: Feature; readonly lagDays: number }[];
};

export const RelationshipRegistry = Object.freeze({
  sleep_duration__energy: Object.freeze({
    id: RelationshipIds.SLEEP_ENERGY, factor: "sleep_duration", outcome: "energy",
    lagDays: 0, method: "spearman", confounders: Object.freeze([
      Object.freeze({ feature: "illness", lagDays: 0 }), Object.freeze({ feature: "stress", lagDays: 0 }),
      Object.freeze({ feature: "alcohol", lagDays: 1 }), Object.freeze({ feature: "workout_rpe", lagDays: 1 }),
    ] as const),
  }),
  alcohol__hrv: Object.freeze({
    id: RelationshipIds.ALCOHOL_HRV, factor: "alcohol", outcome: "hrv",
    lagDays: 1, method: "exposure", confounders: Object.freeze([
      Object.freeze({ feature: "sleep_duration", lagDays: 0 }), Object.freeze({ feature: "illness", lagDays: 0 }),
      Object.freeze({ feature: "workout_rpe", lagDays: 1 }),
    ] as const),
  }),
  stress__sleep_duration: Object.freeze({
    id: RelationshipIds.STRESS_SLEEP, factor: "stress", outcome: "sleep_duration",
    lagDays: 1, method: "spearman", confounders: Object.freeze([
      Object.freeze({ feature: "alcohol", lagDays: 1 }), Object.freeze({ feature: "caffeine", lagDays: 1 }),
      Object.freeze({ feature: "late_meal", lagDays: 1 }),
    ] as const),
  }),
  workout_rpe__energy: Object.freeze({
    id: RelationshipIds.WORKOUT_RPE_ENERGY, factor: "workout_rpe", outcome: "energy",
    lagDays: 1, method: "spearman", confounders: Object.freeze([
      Object.freeze({ feature: "sleep_duration", lagDays: 0 }), Object.freeze({ feature: "illness", lagDays: 0 }),
      Object.freeze({ feature: "alcohol", lagDays: 1 }),
    ] as const),
  }),
} as const satisfies Record<RelationshipId, RelationshipDefinition>);

// A serialized definition must match the code-owned allow-list in full.
export const RelationshipSchema = z.strictObject({
  id: RelationshipIdSchema, factor: FeatureSchema, outcome: OutcomeSchema,
  lagDays: z.number().int().nonnegative(), method: RelationshipMethodSchema,
  confounders: z.array(z.strictObject({ feature: FeatureSchema, lagDays: z.number().int().nonnegative() })),
}).refine((value) => {
  const expected = RelationshipRegistry[value.id];
  return value.factor === expected.factor && value.outcome === expected.outcome
    && value.lagDays === expected.lagDays && value.method === expected.method
    && value.confounders.length === expected.confounders.length
    && value.confounders.every((factor, index) => factor.feature === expected.confounders[index].feature
      && factor.lagDays === expected.confounders[index].lagDays);
}, "Relationship definitions must match the registered graph");
export type Relationship = z.infer<typeof RelationshipSchema>;

/** Lag is defined once: factor date = outcome date minus lagDays. */
export function getFactorDate(relationshipId: RelationshipId, outcomeDate: LocalDate): LocalDate {
  const id = RelationshipIdSchema.parse(relationshipId);
  return addCalendarDays(outcomeDate, -RelationshipRegistry[id].lagDays);
}
