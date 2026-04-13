import api from '../utils/api';
import { Booking, Slot } from '../utils/api';

export interface ZoomEmbedData {
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail: string;
  signature: string;
  sdkKey: string;
}

export const bookingsService = {
  getAvailability: (start: string, end: string, zoomIndex?: number) =>
    api.get<Slot[]>('/bookings/availability', { params: { start, end, zoom: zoomIndex } }),

  list: (all = false) =>
    api.get<Booking[]>('/bookings', { params: { all } }),

  create: (data: { title: string; startTime: string; durationMinutes: number; zoomIndex: number }) =>
    api.post<Booking>('/bookings', data),

  cancel: (id: string) =>
    api.delete(`/bookings/${id}`),

  getEmbedData: (id: string, role?: 0 | 1) =>
    api.get<ZoomEmbedData>(`/bookings/${id}/embed`, { params: { role } }),
};
