import { Router, Response } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import {
  createBooking,
  cancelBooking,
  getProfessorBookings,
  getAllBookings,
  getAvailability,
} from '../services/bookingService';
import { z } from 'zod';

const router = Router();

const CreateBookingSchema = z.object({
  title: z.string().min(2),
  startTime: z.string(), // raw ISO string with ART offset — validated below
  durationMinutes: z.number().int().min(15).max(480),
}).refine(
  (data) => !isNaN(Date.parse(data.startTime)),
  { message: 'startTime debe ser un datetime válido', path: ['startTime'] }
);

// GET /bookings/availability?start=ISO&end=ISO
router.get('/availability', async (req, res) => {
  try {
    const start = req.query.start as string;
    const end = req.query.end as string;
    if (!start || !end) {
      res.status(400).json({ error: 'start y end son requeridos' });
      return;
    }

    const slots = await getAvailability(start, end);
    res.json(slots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /bookings (professor: own bookings, admin: all)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.role === 'admin') {
      res.json(await getAllBookings());
    } else {
      res.json(await getProfessorBookings(req.user!.id));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /bookings
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const body = CreateBookingSchema.parse(req.body);

    const booking = await createBooking({
      professorId: req.user!.id,
      title: body.title,
      startTime: body.startTime as any, // pass raw string to preserve ART offset
      durationMinutes: body.durationMinutes,
    });

    res.status(201).json(booking);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    res.status(400).json({ error: err.message });
  }
});

// DELETE /bookings/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    await cancelBooking(req.params.id, req.user!.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
