import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { register, login, me } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);

export default router;
