import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Avatar } from './UserPicker';
import type { PresenceParticipant } from '../lib/types';

interface PresenceIndicatorProps {
  resourceType: 'doc' | 'table';
  resourceId: string;
  selfId?: string;
}

export function PresenceIndicator({ resourceType, resourceId, selfId }: PresenceIndicatorProps) {
  const [list, setList] = useState<PresenceParticipant[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function beat() {
      try {
        const { data } = await api.post<{ participants: PresenceParticipant[] }>('/presence/heartbeat', {
          resourceType,
          resourceId,
        });
        if (!cancelled) setList(data.participants);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) timer = setTimeout(beat, 15_000);
      }
    }

    void beat();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [resourceType, resourceId]);

  const visible = list.filter((p) => p.id !== selfId).slice(0, 5);
  if (visible.length === 0) return null;
  return (
    <div className="flex items-center gap-1 ml-2" title={`当前在线 ${list.length} 人`}>
      <div className="flex -space-x-2">
        {visible.map((p) => (
          <div key={p.id} className="ring-2 ring-white rounded-full">
            <Avatar user={p} size={24} />
          </div>
        ))}
      </div>
      <span className="text-xs text-text-secondary ml-1">{list.length} 人在线</span>
    </div>
  );
}
