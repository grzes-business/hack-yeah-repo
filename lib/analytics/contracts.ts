import { z } from "zod";
import { LocalDateSchema, DailyFeaturesSchema, RelationshipResultSchema, AnomalySchema, FeatureSchema, TimestampSchema, TimeZoneSchema, RecordIdSchema, AnalysisPeriodSchema } from "../domain";
import { FeatureScopeSchema, builderVersion, type FeatureScope } from "../features/contracts";
export const ANALYSIS_POLICY_VERSION="analytics-v1";
export function analysisVersion(scope:FeatureScope){return `${ANALYSIS_POLICY_VERSION}:${builderVersion(scope)}`;}
export const AnalyticsInputSchema=z.strictObject({date:LocalDateSchema,scope:FeatureScopeSchema.default("personal")});
export const BaselineSchema=z.strictObject({
 feature:FeatureSchema,period:AnalysisPeriodSchema,sampleSize:z.number().int().nonnegative(),
 status:z.enum(["available","insufficient_data"]),median:z.number().nullable(),mad:z.number().nonnegative().nullable(),
 currentValue:z.number().nullable(),relativeDifference:z.number().nullable(),robustZ:z.number().nullable(),
 limitations:z.array(z.string()),
});
export type Baseline=z.infer<typeof BaselineSchema>;
export const AnalyticsReportSchema=z.strictObject({
 userId:RecordIdSchema,date:LocalDateSchema,timeZone:TimeZoneSchema,scope:FeatureScopeSchema,
 inputGeneration:z.string().regex(/^[0-9]+$/),analysisVersion:z.string(),computedAt:TimestampSchema,
 currentDay:DailyFeaturesSchema,baselines:z.array(BaselineSchema),anomalies:z.array(AnomalySchema),
 relationships:z.array(RelationshipResultSchema),limitations:z.array(z.string()),
});
export type AnalyticsReport=z.infer<typeof AnalyticsReportSchema>;
