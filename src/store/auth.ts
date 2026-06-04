import { create } from 'zustand';
import { api } from '../lib/api';
import type { CurrentUser } from '../lib/types';

interface AuthState {
  user: CurrentUser | null;
  status: 'idle' | 'loading' | 'ready';
  fetchMe: () => Promise<CurrentUser | null>;
  setUser: (u: CurrentUser | null) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  setUser: (u) => set({ user: u, status: 'ready' }),
  fetchMe: async () => {
    set({ status: 'loading' });
    try {
      const { data } = await api.get<{ user: CurrentUser }>('/auth/me');
      set({ user: data.user, status: 'ready' });
      return data.user;
    } catch {
      set({ user: null, status: 'ready' });
      return null;
    }
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      set({ user: null, status: 'ready' });
    }
  },
}));
