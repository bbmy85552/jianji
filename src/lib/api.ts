import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { displayFilename } from './filename';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export async function uploadFile<T = unknown>(
  url: string,
  file: File,
  extra?: Record<string, string | number | null | undefined>,
  config?: AxiosRequestConfig,
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined || v === null) continue;
      form.append(k, String(v));
    }
  }
  const { data } = await api.post<T>(url, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    ...config,
  });
  return data;
}

export interface ApiErrorBody {
  error: string;
  code?: string;
  details?: unknown;
}

export function asApiError(err: unknown): ApiErrorBody {
  const ax = err as AxiosError<ApiErrorBody>;
  if (ax?.response?.data) return ax.response.data;
  return { error: '网络错误，请稍后重试', code: 'NETWORK' };
}

let unauthorizedHandler: ((url?: string) => void) | null = null;
export function onUnauthorized(handler: (url?: string) => void) {
  unauthorizedHandler = handler;
}

api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err?.response?.status === 401 && unauthorizedHandler) {
      unauthorizedHandler(err.config?.url);
    }
    return Promise.reject(err);
  },
);

export async function downloadFromApi(url: string, fallbackName = 'download') {
  const res = await api.get(url, { responseType: 'blob' });
  const blob = res.data as Blob;
  let filename = fallbackName;
  const disp = res.headers['content-disposition'] as string | undefined;
  if (disp) {
    const star = /filename\*=UTF-8''([^;]+)/i.exec(disp);
    const plain = /filename="?([^";]+)"?/i.exec(disp);
    if (star?.[1]) filename = decodeURIComponent(star[1]);
    else if (plain?.[1]) filename = plain[1];
  }
  filename = displayFilename(filename);
  const link = document.createElement('a');
  const href = URL.createObjectURL(blob);
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
