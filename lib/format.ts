import { FeatureRegistry, type Feature } from "./domain";

/**
 * Display-only rounding to a sensible precision per unit. Never used for
 * calculations; validated values stay unrounded in storage and evidence.
 */
const integer = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function formatDuration(minutes: number) {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60), rest = total % 60;
  return hours ? `${hours} h${rest ? ` ${rest} min` : ""}` : `${rest} min`;
}

/** Value and unit as separate strings, so the unit can be styled smaller. */
export function formatParts(feature: Feature, value: number): { value: string; unit: string } {
  const unit = FeatureRegistry[feature].unit;
  if (unit === "min") {
    if (value >= 60) { const total = Math.round(value); return { value: `${Math.floor(total / 60)} h ${total % 60}`, unit: "min" }; }
    return { value: integer.format(value), unit: "min" };
  }
  if (unit === "rating") return { value: oneDecimal.format(value), unit: "/ 10" };
  if (unit === "count") return { value: integer.format(value), unit: feature === "steps" ? "steps" : "" };
  if (unit === "kcal" || unit === "bpm" || unit === "ms") return { value: integer.format(value), unit };
  if (unit === "mg") return { value: integer.format(value), unit: "mg" };
  return { value: oneDecimal.format(value), unit };
}

export function formatValue(feature: Feature, value: number) {
  if (FeatureRegistry[feature].unit === "min") return formatDuration(value);
  const parts = formatParts(feature, value);
  return parts.unit ? `${parts.value} ${parts.unit}` : parts.value;
}

/** Short local-date label, e.g. "22 Aug"; dates are calendar dates, so format in UTC. */
export function formatDate(date: string, withYear = false) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
export function formatPeriod(from: string, to: string) {
  return `${formatDate(from, from.slice(0, 4) !== to.slice(0, 4))} – ${formatDate(to, true)}`;
}
