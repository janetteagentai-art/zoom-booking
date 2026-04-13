import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface Professor {
  id: string;
  email: string;
  name: string;
  role: 'professor' | 'admin';
  isActive: boolean;
}

export interface ZoomAccount {
  id: string;
  label: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  color: string;
  zoomAccountId: string;
  zoomClientId: string;
  zoomClientSecret: string;
}

export interface Booking {
  id: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  zoomMeetingId: string;
  zoomJoinUrl: string;
  zoomEmbedUrl: string;
  zoomPassword: string;
  zoomStartUrl: string;
  zoomAccountId: string;
  zoomAccount?: ZoomAccount;
  professor?: Professor;
}

export interface Slot {
  start: string;
  end: string;
  available: boolean;
  zoomAccountId?: string;
}

// ── Auth ──────────────────────────────────────
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ token: string; professor: Professor }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; professor: Professor }>('/auth/login', data),
  me: () => api.get<{ user: Professor }>('/auth/me'),
};

// ── Bookings ──────────────────────────────────
export const bookingsApi = {
  getAvailability: (start: string, end: string) =>
    api.get<Slot[]>('/bookings/availability', { params: { start, end } }),
  list: (all = false) => api.get<Booking[]>('/bookings', { params: { all } }),
  create: (data: { title: string; startTime: string; durationMinutes: number }) =>
    api.post<Booking>('/bookings', data),
  cancel: (id: string) => api.delete(`/bookings/${id}`),
};

// ── Zoom Accounts ─────────────────────
export const zoomAccountsApi = {
  list: () => api.get<ZoomAccount[]>('/zoom-accounts'),
  create: (data: { label: string; email?: string; color?: string; zoomAccountId?: string; zoomClientId?: string; zoomClientSecret?: string }) =>
    api.post<ZoomAccount>('/zoom-accounts', data),
  update: (id: string, data: { label?: string; email?: string; isActive?: boolean; color?: string; zoomAccountId?: string; zoomClientId?: string; zoomClientSecret?: string }) =>
    api.patch<ZoomAccount>(`/zoom-accounts/${id}`, data),
  delete: (id: string) => api.delete(`/zoom-accounts/${id}`),
};

// ── Admin ─────────────────────────────────────
export const adminApi = {
  listProfessors: () => api.get<Professor[]>('/admin/professors'),
  createProfessor: (data: { email: string; password: string; name: string; role: string }) =>
    api.post('/admin/professors', data),
  updateProfessor: (id: string, data: Partial<Professor>) =>
    api.patch(`/admin/professors/${id}`, data),
  deleteProfessor: (id: string) => api.delete(`/admin/professors/${id}`),
};

export default api;
