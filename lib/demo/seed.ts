import { Metrics, addCalendarDays } from "../domain";
import type { HealthRepository } from "../db/repository";
import { MockHealthDataSource } from "../health/mock-data-source";
import { ingestHealthData } from "../health/ingestion";
import { DemoOptionsSchema, demoRange, type DemoOptions } from "./scenario";
import { createSubjectiveFixtures } from "./subjective-fixtures";

export async function seedDemoHistory(repository: Pick<HealthRepository, "saveMetrics" | "saveConversations" | "saveTurns" | "saveEvents">, input: DemoOptions) {
  const options = DemoOptionsSchema.parse(input);
  // Validate subjective fixtures before any database writes. They use a separate
  // path from wearable-like ingestion and do not pretend to be extracted speech.
  const subjective = createSubjectiveFixtures(options);
  const objective = await ingestHealthData(new MockHealthDataSource(options), {
    ...demoRange(options), metrics: Object.values(Metrics),
  }, repository);
  const conversations = await repository.saveConversations(subjective.conversations);
  if (conversations !== subjective.conversations.length) throw new Error("Incomplete fixture conversations.");
  const turns = await repository.saveTurns(subjective.turns);
  if (turns !== subjective.turns.length) throw new Error("Incomplete fixture turns.");
  const events = await repository.saveEvents(subjective.events);
  if (events !== subjective.events.length) throw new Error("Incomplete fixture events.");
  // This is a persistence receipt, never evidence of a health relationship.
  return { metrics: objective.stored, events, days: options.days, fromDate: addCalendarDays(options.endDate, 1 - options.days), toDate: options.endDate, seed: options.seed };
}
