import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listBookings,
  createBookingHandler,
  cancelBookingHandler,
  getAvailabilityHandler,
  getEmbedData,
} from '../controllers/bookingsController';

const router = Router();

router.get('/availability', getAvailabilityHandler);
router.get('/', authenticate, listBookings);
router.post('/', authenticate, createBookingHandler);
router.delete('/:id', authenticate, cancelBookingHandler);
router.get('/:id/embed', authenticate, getEmbedData);

export default router;
