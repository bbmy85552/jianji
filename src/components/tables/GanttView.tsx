import { useMemo, useState } from 'react';
import type { TableField, TableRecord } from '../../lib/types';

type Scale = 'day' | 'week' | 'month';

interface Props {
  fields: TableField[];
  records: TableRecord[];
}

function dateOnly(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86400000);
}

function pickDateFields(fields: TableField[]): { start: TableField | null; end: TableField | null } {
  const dateFields = fields.filter((f) => f.type === 'date' || f.type === 'datetime');
  if (dateFields.length === 0) return { start: null, end: null };

  const startGuess = dateFields.find((f) =>
    /开始|start|begin|起|from/i.test(f.name),
  );
  const endGuess = dateFields.find((f) => /结束|end|finish|止|due|to/i.test(f.name));

  const start = startGuess || dateFields[0];
  let end: TableField | null = endGuess || (dateFields.length > 1 ? dateFields[1] : null);
  if (end && start && end.id === start.id) {
    end = dateFields.find((f) => f.id !== start.id) ?? null;
  }
  return { start, end };
}

function findTitleField(fields: TableField[]): TableField | null {
  return (
    fields.find((f) => /标题|名称|title|name/i.test(f.name)) ||
    fields.find((f) => f.type === 'text' || f.type === 'longtext') ||
    null
  );
}

function findColorField(fields: TableField[]): TableField | null {
  return (
    fields.find((f) => /状态|status|阶段|phase/i.test(f.name) && f.type === 'select') ||
    fields.find((f) => f.type === 'select') ||
    null
  );
}

function readDate(record: TableRecord, field: TableField | null): Date | null {
  if (!field) return null;
  const value = record.data?.[field.name];
  if (!value) return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const STATUS_COLORS = ['#5e5ce6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function colorFor(value: unknown, options: Record<string, unknown>): string {
  if (!value) return '#94a3b8';
  const text = String(value);
  const choices = (options?.choices as { value?: string; color?: string }[] | undefined) ?? [];
  const choice = choices.find((c) => c?.value === text);
  if (choice?.color) return choice.color;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STATUS_COLORS[Math.abs(hash) % STATUS_COLORS.length];
}

export function GanttView({ fields, records }: Props) {
  const [scale, setScale] = useState<Scale>('day');
  const titleField = useMemo(() => findTitleField(fields), [fields]);
  const colorField = useMemo(() => findColorField(fields), [fields]);
  const { start: startField, end: endField } = useMemo(() => pickDateFields(fields), [fields]);

  if (!startField) {
    return (
      <div className="bg-surface-container-lowest border border-black/5 rounded-2xl p-10 text-center text-sm text-text-secondary">
        甘特图视图需要至少一个日期 / 日期时间字段。请先在表格中添加「开始日期」字段。
      </div>
    );
  }

  const rows = records
    .map((rec) => {
      const start = readDate(rec, startField);
      if (!start) return null;
      let end = readDate(rec, endField);
      if (!end || end < start) end = new Date(start.getTime() + 86400000);
      return { record: rec, start, end };
    })
    .filter((r): r is { record: TableRecord; start: Date; end: Date } => !!r);

  if (rows.length === 0) {
    return (
      <div className="bg-surface-container-lowest border border-black/5 rounded-2xl p-10 text-center text-sm text-text-secondary">
        当前无含日期的记录。请先填写「{startField.name}」字段。
      </div>
    );
  }

  const minDate = rows.reduce(
    (acc, r) => (r.start < acc ? r.start : acc),
    rows[0].start,
  );
  const maxDate = rows.reduce((acc, r) => (r.end > acc ? r.end : acc), rows[0].end);

  const padBefore = scale === 'day' ? 1 : scale === 'week' ? 3 : 7;
  const padAfter = scale === 'day' ? 2 : scale === 'week' ? 5 : 14;
  const rangeStart = new Date(minDate);
  rangeStart.setDate(rangeStart.getDate() - padBefore);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(maxDate);
  rangeEnd.setDate(rangeEnd.getDate() + padAfter);
  rangeEnd.setHours(0, 0, 0, 0);
  const totalDays = Math.max(diffDays(rangeStart, rangeEnd) + 1, 1);

  const cellWidth = scale === 'day' ? 36 : scale === 'week' ? 22 : 12;
  const totalWidth = totalDays * cellWidth;
  const rowHeight = 36;
  const titleColumnWidth = 200;

  const today = new Date();
  const todayOffset = diffDays(rangeStart, today);

  const headerCells: { label: string; offset: number; width: number; major?: boolean }[] = [];
  if (scale === 'day') {
    for (let i = 0; i < totalDays; i += 1) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      const major = d.getDay() === 1;
      headerCells.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        offset: i * cellWidth,
        width: cellWidth,
        major,
      });
    }
  } else if (scale === 'week') {
    let i = 0;
    while (i < totalDays) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      const blockEnd = Math.min(i + 7 - d.getDay(), totalDays);
      const width = (blockEnd - i) * cellWidth;
      headerCells.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        offset: i * cellWidth,
        width,
        major: true,
      });
      i = blockEnd;
    }
  } else {
    let i = 0;
    while (i < totalDays) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const daysToMonthEnd = Math.min(diffDays(d, monthEnd), totalDays - i);
      const width = daysToMonthEnd * cellWidth;
      headerCells.push({
        label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        offset: i * cellWidth,
        width,
        major: true,
      });
      i += daysToMonthEnd;
    }
  }

  return (
    <div className="bg-surface-container-lowest border border-black/5 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-black/5">
        <div className="text-xs text-text-secondary">
          基于「{startField.name}」{endField ? ` 与「${endField.name}」` : ''} 字段绘制
        </div>
        <div className="inline-flex items-center bg-black/5 rounded-md p-0.5 text-xs">
          {(['day', 'week', 'month'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={`px-2 py-0.5 rounded transition-colors ${
                scale === s
                  ? 'bg-white shadow-sm text-text-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {s === 'day' ? '日' : s === 'week' ? '周' : '月'}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-auto">
        <div style={{ minWidth: titleColumnWidth + totalWidth }}>
          <div
            className="flex border-b border-black/5 sticky top-0 bg-surface-container-lowest z-10"
            style={{ height: 36 }}
          >
            <div
              className="border-r border-black/10 text-xs text-text-secondary px-3 py-2 shrink-0"
              style={{ width: titleColumnWidth }}
            >
              记录
            </div>
            <div className="relative" style={{ width: totalWidth, height: 36 }}>
              {headerCells.map((c) => (
                <div
                  key={c.offset}
                  className={`absolute top-0 h-full text-[11px] text-text-secondary border-r ${
                    c.major ? 'border-black/10 font-medium' : 'border-black/5'
                  } flex items-center justify-center`}
                  style={{ left: c.offset, width: c.width }}
                >
                  {c.label}
                </div>
              ))}
            </div>
          </div>
          <div>
            {rows.map((row, idx) => {
              const offsetDays = diffDays(rangeStart, row.start);
              const spanDays = Math.max(diffDays(row.start, row.end), 1);
              const left = offsetDays * cellWidth;
              const width = Math.max(spanDays * cellWidth, 8);
              const title = (titleField && (row.record.data?.[titleField.name] as string)) || '未命名';
              const color = colorField
                ? colorFor(row.record.data?.[colorField.name], colorField.options)
                : '#5e5ce6';
              return (
                <div
                  key={row.record.id}
                  className={`flex border-b border-black/5 ${idx % 2 === 0 ? '' : 'bg-black/[0.015]'}`}
                  style={{ height: rowHeight }}
                >
                  <div
                    className="border-r border-black/10 px-3 py-2 text-sm truncate shrink-0"
                    style={{ width: titleColumnWidth }}
                    title={title}
                  >
                    {title}
                  </div>
                  <div className="relative" style={{ width: totalWidth, height: rowHeight }}>
                    {todayOffset >= 0 && todayOffset < totalDays && (
                      <div
                        className="absolute top-0 bottom-0 border-l border-red-400/60"
                        style={{ left: todayOffset * cellWidth }}
                      />
                    )}
                    <div
                      className="absolute top-1.5 bottom-1.5 rounded-md text-[11px] text-white font-medium px-2 flex items-center overflow-hidden shadow-sm"
                      style={{
                        left,
                        width,
                        background: color,
                      }}
                      title={`${title}\n${row.start.toLocaleDateString()} → ${row.end.toLocaleDateString()}`}
                    >
                      <span className="truncate">{title}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
