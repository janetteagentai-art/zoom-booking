import api from '../utils/api';
import { ZoomAccount } from '../utils/api';

export const zoomAccountsService = {
  list: () => api.get<ZoomAccount[]>('/zoom-accounts'),

  create: (data: {
    label: string;
    email?: string;
    color?: string;
    zoomAccountId?: string;
    zoomClientId?: string;
    zoomClientSecret?: string;
  }) => api.post<ZoomAccount>('/zoom-accounts', data),

  update: (id: string, data: {
    label?: string;
    email?: string;
    isActive?: boolean;
    color?: string;
    zoomAccountId?: string;
    zoomClientId?: string;
    zoomClientSecret?: string;
  }) => api.patch<ZoomAccount>(`/zoom-accounts/${id}`, data),

  delete: (id: string) => api.delete(`/zoom-accounts/${id}`),
};
