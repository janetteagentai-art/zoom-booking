import api from '../utils/api';
import { Professor } from '../utils/api';

export const adminService = {
  listProfessors: () => api.get<Professor[]>('/admin/professors'),

  createProfessor: (data: {
    email: string;
    password: string;
    name: string;
    role: string;
  }) => api.post('/admin/professors', data),

  updateProfessor: (id: string, data: Partial<Professor>) =>
    api.patch(`/admin/professors/${id}`, data),

  deleteProfessor: (id: string) => api.delete(`/admin/professors/${id}`),
};
