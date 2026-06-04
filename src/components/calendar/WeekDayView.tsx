import { useMemo } from 'react';
import type { CalendarEvent } from '../../lib/types';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 48;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(d: Date) {
  const result = new Date(d);
  const day = result.getDay();
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day);
  return result;
}

function buildWeekDays(view: Date): Date[] {
  const start = startOfWeek(view);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  widthPercent: number;
}

function positionEventsForDay(events: CalendarEvent[], day: Date): PositionedEvent[] {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);

  const filtered = events
    .filter((ev) => {
      const s = new Date(ev.startAt);
      const e = new Date(ev.endAt);
      return e > dayStart && s < dayEnd;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const positioned: PositionedEvent[] = filtered.map((ev) => {
    const s = new Date(ev.startAt);
    const e = new Date(ev.endAt);
    const startInDay = s < dayStart ? dayStart : s;
    const endInDay = e > dayEnd ? dayEnd : e;
    const top =
      (startInDay.getHours() + startInDay.getMinutes() / 60) * HOUR_HEIGHT;
    const minutes = (endInDay.getTime() - startInDay.getTime()) / 60000;
    const height = Math.max((minutes / 60) * HOUR_HEIGHT, 22);
    return { event: ev, top, height, left: 0, widthPercent: 100 };
  });

  // Lay out overlapping events side by side
  const lanes: { end: number }[] = [];
  const eventLane: number[] = [];
  positioned.forEach((p, idx) => {
    let placed = -1;
    for (let i = 0; i < lanes.length; i += 1) {
      if (lanes[i].end <= p.top) {
        placed = i;
        break;
      }
    }
    if (placed === -1) {
      placed = lanes.length;
      lanes.push({ end: p.top + p.height });
    } else {
      lanes[placed].end = p.top + p.height;
    }
    eventLane[idx] = placed;
  });
  const laneCount = lanes.length || 1;
  positioned.forEach((p, idx) => {
    p.widthPercent = 100 / laneCount;
    p.left = (eventLane[idx] / laneCount) * 100;
  });
  return positioned;
}

interface Props {
  view: Date;
  mode: 'week' | 'day';
  events: CalendarEvent[];
  onSelectDate: (d: Date) => void;
  onCreateAt: (d: Date, hour?: number) => void;
  onEditEvent: (ev: CalendarEvent) => void;
}

export function WeekDayView({ view, mode, events, onSelectDate, onCreateAt, onEditEvent }: Props) {
  const days = useMemo(() => (mode === 'week' ? buildWeekDays(view) : [view]), [view, mode]);
  const today = new Date();

  return (
    <div className="bg-surface-container-lowest border border-black/5 rounded-2xl overflow-hidden">
      <div
        className="grid border-b border-black/5"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="px-2 py-2 text-xs text-text-secondary text-center" />
        {days.map((d) => {
          const isToday = sameDay(d, today);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDate(d)}
              className={`px-3 py-2 text-center border-l border-black/5 transition-colors hover:bg-black/[0.02] ${
                isToday ? 'bg-liquid-indigo/5' : ''
              }`}
            >
              <div className="text-xs text-text-secondary">
                {['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}
              </div>
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  isToday ? 'text-liquid-indigo' : 'text-text-primary'
                }`}
              >
                {d.getMonth() + 1}/{d.getDate()}
              </div>
            </button>
          );
        })}
      </div>
      <div
        className="grid relative"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div>
          {HOURS.map((h) => (
            <div
              key={h}
              className="text-[11px] text-text-secondary text-right pr-2 border-b border-black/5"
              style={{ height: HOUR_HEIGHT }}
            >
              {pad(h)}:00
            </div>
          ))}
        </div>
        {days.map((d) => {
          const positioned = positionEventsForDay(events, d);
          return (
            <div key={d.toISOString()} className="relative border-l border-black/5">
              {HOURS.map((h) => (
                <div
                  key={h}
                  onDoubleClick={() => {
                    const target = new Date(d);
                    target.setHours(h, 0, 0, 0);
                    onCreateAt(target, h);
                  }}
                  className="border-b border-black/5 hover:bg-black/[0.02] cursor-cell"
                  style={{ height: HOUR_HEIGHT }}
                />
              ))}
              {positioned.map((p) => (
                <button
                  key={`${p.event.id}-${p.event.startAt}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditEvent(p.event);
                  }}
                  className="absolute rounded-md px-2 py-1 text-[11px] text-left overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  style={{
                    top: p.top,
                    height: p.height,
                    left: `calc(${p.left}% + 2px)`,
                    width: `calc(${p.widthPercent}% - 4px)`,
                    background: `${p.event.color ?? '#5e5ce6'}1a`,
                    color: p.event.color ?? '#5e5ce6',
                    borderLeft: `3px solid ${p.event.color ?? '#5e5ce6'}`,
                  }}
                >
                  <div className="font-medium truncate">{p.event.title}</div>
                  {!p.event.allDay && (
                    <div className="text-[10px] opacity-80 truncate">
                      {new Date(p.event.startAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(p.event.endAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
