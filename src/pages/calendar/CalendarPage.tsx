import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, MapPin, Bell, Clock, ListTodo } from 'lucide-react';
import { api, asApiError } from '../../lib/api';
import type { CalendarEvent, TodoItem } from '../../lib/types';
import { useUiStore } from '../../store/ui';
import { Modal } from '../../components/Modal';
import { WeekDayView } from '../../components/calendar/WeekDayView';

type ViewMode = 'month' | 'week' | 'day';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatLocalDateTime(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function buildGrid(view: Date) {
  const start = startOfMonth(view);
  const startWeekday = start.getDay();
  const cells: Date[] = [];
  const firstCell = new Date(start);
  firstCell.setDate(start.getDate() - startWeekday);
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(firstCell);
    d.setDate(firstCell.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

interface EventFormState {
  id?: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string;
  reminderMinutes: number | '';
  color: string;
  repeatRule: 'none' | 'daily' | 'weekly' | 'monthly';
}

function emptyForm(d: Date): EventFormState {
  const start = new Date(d);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(10, 0, 0, 0);
  return {
    title: '',
    description: '',
    startAt: formatLocalDateTime(start),
    endAt: formatLocalDateTime(end),
    allDay: false,
    location: '',
    reminderMinutes: 15,
    color: '#5e5ce6',
    repeatRule: 'none',
  };
}

function repeatLabel(rule?: CalendarEvent['repeatRule'] | EventFormState['repeatRule']) {
  if (rule === 'daily') return '每天重复';
  if (rule === 'weekly') return '每周重复';
  if (rule === 'monthly') return '每月重复';
  return '';
}

export function CalendarPage() {
  const showToast = useUiStore((s) => s.showToast);
  const confirmDialog = useUiStore((s) => s.confirmDialog);
  const [view, setView] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingForm, setEditingForm] = useState<EventFormState | null>(null);
  const cells = useMemo(() => buildGrid(view), [view]);

  async function loadRange() {
    let from: Date;
    let to: Date;
    if (viewMode === 'month') {
      from = startOfMonth(view);
      from.setDate(from.getDate() - 7);
      to = endOfMonth(view);
      to.setDate(to.getDate() + 7);
    } else if (viewMode === 'week') {
      from = new Date(view);
      from.setDate(view.getDate() - view.getDay() - 1);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setDate(from.getDate() + 9);
    } else {
      from = new Date(view);
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - 1);
      to = new Date(view);
      to.setHours(23, 59, 59, 999);
      to.setDate(to.getDate() + 1);
    }
    setLoading(true);
    try {
      const { data } = await api.get<{ list: CalendarEvent[] }>('/calendar', {
        params: { from: from.toISOString(), to: to.toISOString() },
      });
      setEvents(data.list);
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadTodos() {
    try {
      const { data } = await api.get<{ list: TodoItem[] }>('/todos/today');
      setTodos(data.list.filter((todo) => !todo.completedAt));
    } catch {
      /* 日历仍可独立使用 */
    }
  }

  useEffect(() => {
    loadRange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, viewMode]);

  useEffect(() => {
    void loadTodos();
  }, []);

  function shiftPrev() {
    if (viewMode === 'month') {
      setView(new Date(view.getFullYear(), view.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      const d = new Date(view);
      d.setDate(d.getDate() - 7);
      setView(d);
    } else {
      const d = new Date(view);
      d.setDate(d.getDate() - 1);
      setView(d);
      setSelectedDate(d);
    }
  }

  function shiftNext() {
    if (viewMode === 'month') {
      setView(new Date(view.getFullYear(), view.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      const d = new Date(view);
      d.setDate(d.getDate() + 7);
      setView(d);
    } else {
      const d = new Date(view);
      d.setDate(d.getDate() + 1);
      setView(d);
      setSelectedDate(d);
    }
  }

  function openCreateAt(date: Date, hour?: number) {
    const start = new Date(date);
    if (hour != null) start.setHours(hour, 0, 0, 0);
    else start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1, start.getMinutes(), 0, 0);
    setEditingForm({
      title: '',
      description: '',
      startAt: formatLocalDateTime(start),
      endAt: formatLocalDateTime(end),
      allDay: false,
      location: '',
      reminderMinutes: 15,
      color: '#5e5ce6',
      repeatRule: 'none',
    });
  }

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => {
          const s = new Date(e.startAt);
          const en = new Date(e.endAt);
          return sameDay(s, selectedDate) || sameDay(en, selectedDate) || (s < selectedDate && en > selectedDate);
        })
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [events, selectedDate],
  );

  function openCreate(date?: Date) {
    setEditingForm(emptyForm(date ?? selectedDate));
  }

  function openEdit(ev: CalendarEvent) {
    setEditingForm({
      id: ev.id,
      title: ev.title,
      description: ev.description || '',
      startAt: formatLocalDateTime(new Date(ev.startAt)),
      endAt: formatLocalDateTime(new Date(ev.endAt)),
      allDay: ev.allDay,
      location: ev.location || '',
      reminderMinutes: ev.reminderMinutes ?? '',
      color: ev.color || '#5e5ce6',
      repeatRule: ev.repeatRule ?? 'none',
    });
  }

  async function scheduleTodo(todoId: string, date: Date, hour = 9) {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    try {
      await api.post(`/todos/${todoId}/schedule`, {
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        color: '#34c759',
        reminderMinutes: 15,
      });
      showToast('已排入日历', 'success');
      await Promise.all([loadRange(), loadTodos()]);
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  }

  async function submit() {
    if (!editingForm) return;
    if (!editingForm.title.trim()) {
      showToast('请输入日程标题', 'error');
      return;
    }
    const payload = {
      title: editingForm.title.trim(),
      description: editingForm.description || null,
      startAt: new Date(editingForm.startAt).toISOString(),
      endAt: new Date(editingForm.endAt).toISOString(),
      allDay: editingForm.allDay,
      location: editingForm.location || null,
      reminderMinutes: editingForm.reminderMinutes === '' ? null : editingForm.reminderMinutes,
      color: editingForm.color || null,
      repeatRule: editingForm.repeatRule,
    };
    try {
      if (editingForm.id) {
        await api.patch(`/calendar/${editingForm.id}`, payload);
        showToast('已更新日程', 'success');
      } else {
        await api.post('/calendar', payload);
        showToast('已新建日程', 'success');
      }
      setEditingForm(null);
      loadRange();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  }

  async function remove(id: string) {
    const ok = await confirmDialog({
      title: '删除日程',
      message: '确定删除该日程？',
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/calendar/${id}`);
      showToast('已删除', 'success');
      loadRange();
    } catch (err) {
      showToast(asApiError(err).error, 'error');
    }
  }

  const headerLabel = (() => {
    if (viewMode === 'month') return `${view.getFullYear()} 年 ${view.getMonth() + 1} 月`;
    if (viewMode === 'week') {
      const start = new Date(view);
      start.setDate(view.getDate() - view.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.getFullYear()} 年 ${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
    }
    return `${view.getFullYear()} 年 ${view.getMonth() + 1} 月 ${view.getDate()} 日`;
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-serif font-bold text-text-primary">{headerLabel}</h1>
          <p className="text-sm text-text-secondary mt-1">点击日期查看安排，或新建一个日程</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-black/5 rounded-lg p-1 text-sm">
            {(['month', 'week', 'day'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  viewMode === m
                    ? 'bg-white shadow-sm text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {m === 'month' ? '月' : m === 'week' ? '周' : '日'}
              </button>
            ))}
          </div>
          <button onClick={shiftPrev} className="p-2 rounded-lg hover:bg-black/5">
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              const now = new Date();
              setView(now);
              setSelectedDate(now);
            }}
            className="text-sm px-3 py-1.5 rounded-lg hover:bg-black/5"
          >
            今天
          </button>
          <button onClick={shiftNext} className="p-2 rounded-lg hover:bg-black/5">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => openCreate()}
            className="text-sm px-3 py-1.5 rounded-lg bg-liquid-indigo text-white inline-flex items-center gap-1"
          >
            <Plus size={14} /> 新建日程
          </button>
        </div>
      </div>

      <div className={viewMode === 'month' ? 'grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6' : 'space-y-6'}>
        {viewMode === 'month' ? (
          <div className="bg-surface-container-lowest border border-black/5 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-7 text-xs text-text-secondary border-b border-black/5">
              {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
                <div key={d} className="px-3 py-2 text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6">
              {cells.map((d) => {
                const isCurMonth = d.getMonth() === view.getMonth();
                const isToday = sameDay(d, new Date());
                const isSelected = sameDay(d, selectedDate);
                const items = events.filter((e) => sameDay(new Date(e.startAt), d));
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelectedDate(d)}
                    onDoubleClick={() => openCreate(d)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const todoId = e.dataTransfer.getData('text/todo-id');
                      if (todoId) void scheduleTodo(todoId, d);
                    }}
                    className={`text-left p-2 min-h-[88px] border-r border-b border-black/5 last:border-r-0 transition-colors ${
                      isSelected ? 'bg-liquid-indigo/5' : 'hover:bg-black/[0.02]'
                    } ${!isCurMonth ? 'opacity-40' : ''}`}
                  >
                    <div
                      className={`text-xs ${
                        isToday
                          ? 'inline-flex w-6 h-6 items-center justify-center rounded-full bg-liquid-indigo text-white font-semibold'
                          : 'text-text-secondary'
                      }`}
                    >
                      {d.getDate()}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {items.slice(0, 3).map((ev) => (
                        <div
                          key={`${ev.id}-${ev.startAt}`}
                          className="text-[11px] truncate rounded px-1 py-0.5"
                          style={{ background: `${ev.color ?? '#5e5ce6'}1a`, color: ev.color ?? '#5e5ce6' }}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {items.length > 3 && (
                        <div className="text-[10px] text-text-secondary">+{items.length - 3} 更多</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <WeekDayView
            view={view}
            mode={viewMode}
            events={events}
            onSelectDate={(d) => {
              setSelectedDate(d);
              if (viewMode === 'week') setView(d);
            }}
            onCreateAt={openCreateAt}
            onEditEvent={openEdit}
          />
        )}

        {viewMode === 'month' && (
          <div className="bg-surface-container-lowest border border-black/5 rounded-2xl p-4 h-fit">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-text-secondary">所选日期</div>
                <div className="text-lg font-semibold">
                  {selectedDate.getMonth() + 1} 月 {selectedDate.getDate()} 日
                </div>
              </div>
              <button
                onClick={() => openCreate(selectedDate)}
                className="text-xs px-2 py-1 rounded bg-liquid-indigo/10 text-liquid-indigo inline-flex items-center gap-1"
              >
                <Plus size={12} /> 新建
              </button>
            </div>
            {loading ? (
              <div className="text-sm text-text-secondary py-6 text-center">加载中…</div>
            ) : dayEvents.length === 0 ? (
              <div className="text-sm text-text-secondary py-6 text-center">这一天没有安排</div>
            ) : (
              <div className="space-y-2">
                {dayEvents.map((ev) => (
                  <div
                    key={`${ev.id}-${ev.startAt}`}
                    className="rounded-xl border border-black/5 p-3 cursor-pointer hover:bg-black/[0.02]"
                    onClick={() => openEdit(ev)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-sm" style={{ color: ev.color || undefined }}>
                        {ev.title}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(ev.id);
                        }}
                        className="text-text-secondary hover:text-red-500"
                        aria-label="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                      <Clock size={11} />
                      {ev.allDay
                        ? '全天'
                        : `${new Date(ev.startAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(ev.endAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                    {ev.location && (
                      <div className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                        <MapPin size={11} /> {ev.location}
                      </div>
                    )}
                    {ev.reminderMinutes != null && (
                      <div className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                        <Bell size={11} /> 提前 {ev.reminderMinutes} 分钟提醒
                      </div>
                    )}
                    {ev.repeatRule && (
                      <div className="text-xs text-liquid-indigo mt-1">
                        {repeatLabel(ev.repeatRule)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-black/5">
              <div className="text-xs text-text-secondary mb-2 flex items-center gap-1">
                <ListTodo size={12} /> 待办排入日历
              </div>
              {todos.length === 0 ? (
                <div className="text-xs text-text-secondary">暂无可安排待办</div>
              ) : (
                <div className="space-y-1.5">
                  {todos.slice(0, 8).map((todo) => (
                    <div
                      key={todo.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/todo-id', todo.id)}
                      className="rounded-lg border border-black/5 px-2 py-1.5 text-xs bg-white cursor-grab active:cursor-grabbing"
                      title="拖到左侧日期格即可排入 09:00-10:00"
                    >
                      {todo.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={!!editingForm}
        title={editingForm?.id ? '编辑日程' : '新建日程'}
        onClose={() => setEditingForm(null)}
      >
        {editingForm && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-text-secondary">标题</label>
              <input
                value={editingForm.title}
                onChange={(e) => setEditingForm({ ...editingForm, title: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-black/10 bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-secondary">开始</label>
                <input
                  type="datetime-local"
                  value={editingForm.startAt}
                  onChange={(e) => setEditingForm({ ...editingForm, startAt: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-black/10 bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">结束</label>
                <input
                  type="datetime-local"
                  value={editingForm.endAt}
                  onChange={(e) => setEditingForm({ ...editingForm, endAt: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-black/10 bg-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-text-secondary flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={editingForm.allDay}
                  onChange={(e) => setEditingForm({ ...editingForm, allDay: e.target.checked })}
                />
                全天
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-secondary">提前提醒（分钟）</label>
                <input
                  type="number"
                  min={0}
                  max={20160}
                  value={editingForm.reminderMinutes}
                  onChange={(e) =>
                    setEditingForm({
                      ...editingForm,
                      reminderMinutes: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  className="w-24 px-3 py-1.5 rounded border border-black/10 bg-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-text-secondary">颜色</label>
                <input
                  type="color"
                  value={editingForm.color}
                  onChange={(e) => setEditingForm({ ...editingForm, color: e.target.value })}
                  className="w-8 h-8 rounded border border-black/10"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-text-secondary">重复规则</label>
              <select
                value={editingForm.repeatRule}
                onChange={(e) =>
                  setEditingForm({
                    ...editingForm,
                    repeatRule: e.target.value as EventFormState['repeatRule'],
                  })
                }
                className="mt-1 w-full px-3 py-2 rounded-lg border border-black/10 bg-white"
              >
                <option value="none">不重复</option>
                <option value="daily">每天</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
              {editingForm.id && editingForm.repeatRule !== 'none' && (
                <div className="text-[11px] text-text-secondary mt-1">
                  保存会更新整个重复日程。
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-text-secondary">地点</label>
              <input
                value={editingForm.location}
                onChange={(e) => setEditingForm({ ...editingForm, location: e.target.value })}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-black/10 bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">备注</label>
              <textarea
                value={editingForm.description}
                onChange={(e) => setEditingForm({ ...editingForm, description: e.target.value })}
                rows={3}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-black/10 bg-white"
              />
            </div>
            <div className="flex justify-between items-center">
              {editingForm.id ? (
                <button
                  onClick={() => editingForm.id && remove(editingForm.id)}
                  className="text-sm text-red-500 hover:underline"
                >
                  删除日程
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingForm(null)}
                  className="px-3 py-1.5 rounded-lg border border-black/10 text-sm"
                >
                  取消
                </button>
                <button
                  onClick={submit}
                  className="px-4 py-1.5 rounded-lg bg-liquid-indigo text-white text-sm"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
