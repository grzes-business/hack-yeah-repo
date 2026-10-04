import { addCalendarDays } from "../domain";
import type { HealthRepository } from "../db/repository";
import { DemoOptionsSchema, type DemoOptions } from "./scenario";
import { createSubjectiveFixtures } from "./subjective-fixtures";

/** Days of fictional reports seeded next to real wearable history. */
export const SAMPLE_REPORT_DAYS = 30;

/**
 * Seeds labeled, fictional voice reports into personal history (owner opt-in).
 * Values come from the fixed demo scenario, never from the owner's real
 * measurements, so no relationship with real data is manufactured.
 */
export async function seedSampleReports(repository: Pick<HealthRepository, "saveConversations" | "saveTurns" | "saveEvents">, input: DemoOptions) {
  const options = DemoOptionsSchema.parse(input);
  const fixtures = createSubjectiveFixtures(options, "sample");
  if (await repository.saveConversations(fixtures.conversations) !== fixtures.conversations.length) throw new Error("Incomplete sample conversations.");
  if (await repository.saveTurns(fixtures.turns) !== fixtures.turns.length) throw new Error("Incomplete sample turns.");
  const events = await repository.saveEvents(fixtures.events);
  if (events !== fixtures.events.length) throw new Error("Incomplete sample reports.");
  return { events, fromDate: addCalendarDays(options.endDate, 1 - options.days), toDate: options.endDate };
}
