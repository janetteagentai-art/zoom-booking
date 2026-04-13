import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  listZoomAccounts,
  createZoomAccount,
  updateZoomAccount,
  deleteZoomAccount,
} from '../controllers/zoomAccountsController';

const router = Router();

router.get('/', authenticate, listZoomAccounts);
router.post('/', authenticate, requireAdmin, createZoomAccount);
router.patch('/:id', authenticate, requireAdmin, updateZoomAccount);
router.delete('/:id', authenticate, requireAdmin, deleteZoomAccount);

export default router;
