import { SubjectiveEventSchema, SubjectiveEventRegistry, type SubjectiveEvent, type SubjectiveEventType } from "../domain";
import { ConversationSchema, ConversationTurnSchema, type Conversation, type ConversationTurn } from "../db/records";
import { demoNamespace, DemoOptionsSchema, localInstant, scenarioDays, type DemoOptions } from "./scenario";

export function createSubjectiveFixtures(input: DemoOptions) {
  const options = DemoOptionsSchema.parse(input);
  const namespace = demoNamespace(options);
  const conversations: Conversation[] = [], turns: ConversationTurn[] = [], events: SubjectiveEvent[] = [];
  for (const day of scenarioDays(options)) {
    const capturedAt = localInstant(day.date, 22, 0, options.timeZone);
    const conversationId = `${namespace}${day.date}:conversation`;
    const turnId = `${namespace}${day.date}:turn`;
    const dayEvents: SubjectiveEvent[] = [];
    const push = (type: SubjectiveEventType, value: unknown, hour: number, workoutSessionId?: string) => {
      dayEvents.push(SubjectiveEventSchema.parse({
        id: `${namespace}${day.date}:${type}`, type, value,
        occurredAt: localInstant(day.date, hour, 0, options.timeZone), capturedAt,
        timeZone: options.timeZone, conversationTurnId: turnId, extractionConfidence: null,
        ...(workoutSessionId ? { workoutSessionId } : {}),
      }));
    };
    if (!day.omitEnergy) push("energy", day.energy, 9);
    if (!day.omitStress) push("stress", day.stress, 21);
    push("mood", day.mood, 21);
    push("soreness", day.soreness, 21);
    if (!day.omitAlcohol) push("alcohol", { consumed: day.alcohol, quantity: day.alcohol ? 2 : 0, unit: "reported_drinks" }, 21);
    push("caffeine", { consumed: true, amountMg: day.unknownCaffeineDose ? null : 120 }, 12);
    push("late_meal", day.ordinal % 7 === 0, 21);
    push("illness", day.illness, 9);
    push("pain", { present: false, location: null, intensity: 0 }, 21);
    if (day.workoutRpe !== null) push("workout_rpe", day.workoutRpe, 20, `${namespace}${day.date}:workout`);
    conversations.push(ConversationSchema.parse({ id: conversationId, mode: "capture", startedAt: capturedAt, endedAt: capturedAt }));
    const transcript = "[Synthetic demo fixture; not recorded speech] " + dayEvents.map(event =>
      `${SubjectiveEventRegistry[event.type].label}: ${JSON.stringify(event.value)}`).join("; ");
    turns.push(ConversationTurnSchema.parse({ id: turnId, conversationId, role: "user", transcript, occurredAt: capturedAt }));
    events.push(...dayEvents);
  }
  return { conversations, turns, events };
}
