import { z } from "zod";

export const AgentModes = Object.freeze({
  CAPTURE: "capture", MORNING_CHECKIN: "morning_checkin", POST_WORKOUT: "post_workout",
  INVESTIGATE: "investigate", EXPERIMENT: "experiment", DOCTOR_PREP: "doctor_prep",
} as const);
export const AgentModeSchema = z.enum(AgentModes);
export type AgentMode = z.infer<typeof AgentModeSchema>;

// Vocabulary only. A mode's presence here does not enable an implemented feature.
export const InitialAgentModes = Object.freeze([AgentModes.CAPTURE, AgentModes.MORNING_CHECKIN]);
export const MorningCheckinDimensions = Object.freeze(["energy", "soreness", "mood", "illness"] as const);
