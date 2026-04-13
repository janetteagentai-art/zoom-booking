import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  listProfessors,
  createProfessor,
  updateProfessor,
  deleteProfessor,
} from '../controllers/adminController';

const router = Router();

router.get('/professors', authenticate, requireAdmin, listProfessors);
router.post('/professors', authenticate, requireAdmin, createProfessor);
router.patch('/professors/:id', authenticate, requireAdmin, updateProfessor);
router.delete('/professors/:id', authenticate, requireAdmin, deleteProfessor);

export default router;
