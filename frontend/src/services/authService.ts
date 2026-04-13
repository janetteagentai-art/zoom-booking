import api from '../utils/api';
import { Professor } from '../utils/api';

export const authService = {
  register: (data: { email: string; password: string; name: string }) =>
    api.post<{ token: string; professor: Professor }>('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; professor: Professor }>('/auth/login', data),

  me: () => api.get<{ user: Professor }>('/auth/me'),
};
