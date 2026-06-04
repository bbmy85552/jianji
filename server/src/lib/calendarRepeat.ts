export type RepeatRule = 'daily' | 'weekly' | 'monthly';

export interface RepeatableEvent {
  id: string;
  startAt: Date;
  endAt: Date;
  repeatRule?: string | null;
  exceptionsJson?: string | null;
}

export interface CalendarOccurrence<T extends RepeatableEvent> {
  sourceEventId: string;
  occurrenceKey: string;
  isOccurrence: boolean;
  startAt: Date;
  endAt: Date;
  repeatRule?: string | null;
  exceptionsJson?: string | null;
}

export function normalizeRepeatRule(value: unknown): RepeatRule | null {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') return value;
  return null;
}

function overlaps(startAt: Date, endAt: Date, from?: Date, to?: Date) {
  if (to && startAt > to) return false;
  if (from && endAt < from) return false;
  return true;
}

function parseExceptions(raw?: string | null) {
  if (!raw) return new Set<string>();
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set<string>();
    return new Set(arr.filter((v) => typeof v === 'string'));
  } catch {
    return new Set<string>();
  }
}

function isExcepted(exceptions: Set<string>, occurrenceStart: Date) {
  const iso = occurrenceStart.toISOString();
  const day = iso.slice(0, 10);
  return exceptions.has(iso) || exceptions.has(day);
}

function addMonthsClamped(date: Date, months: number, originalDay: number) {
  const next = new Date(date);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function nextOccurrence(date: Date, rule: RepeatRule, originalDay: number) {
  const next = new Date(date);
  if (rule === 'daily') next.setDate(next.getDate() + 1);
  if (rule === 'weekly') next.setDate(next.getDate() + 7);
  if (rule === 'monthly') return addMonthsClamped(date, 1, originalDay);
  return next;
}

export function expandCalendarEvents<T extends RepeatableEvent>(
  events: T[],
  from?: Date,
  to?: Date,
): Array<T & CalendarOccurrence<T>> {
  const expanded: Array<T & CalendarOccurrence<T>> = [];
  for (const event of events) {
    const rule = normalizeRepeatRule(event.repeatRule);
    if (!rule) {
      if (overlaps(event.startAt, event.endAt, from, to)) {
        expanded.push({
          ...event,
          sourceEventId: event.id,
          occurrenceKey: `${event.id}:${event.startAt.toISOString()}`,
          isOccurrence: false,
          startAt: new Date(event.startAt),
          endAt: new Date(event.endAt),
        });
      }
      continue;
    }

    const duration = event.endAt.getTime() - event.startAt.getTime();
    const exceptions = parseExceptions(event.exceptionsJson);
    const originalDay = event.startAt.getDate();
    let occurrenceStart = new Date(event.startAt);
    let guard = 0;

    while (from && occurrenceStart.getTime() + duration < from.getTime() && guard < 2000) {
      occurrenceStart = nextOccurrence(occurrenceStart, rule, originalDay);
      guard += 1;
    }

    while ((!to || occurrenceStart <= to) && guard < 2500) {
      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
      if (!isExcepted(exceptions, occurrenceStart) && overlaps(occurrenceStart, occurrenceEnd, from, to)) {
        expanded.push({
          ...event,
          sourceEventId: event.id,
          occurrenceKey: `${event.id}:${occurrenceStart.toISOString()}`,
          isOccurrence: occurrenceStart.getTime() !== event.startAt.getTime(),
          startAt: new Date(occurrenceStart),
          endAt: occurrenceEnd,
        });
      }
      occurrenceStart = nextOccurrence(occurrenceStart, rule, originalDay);
      guard += 1;
    }
  }
  return expanded.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}
