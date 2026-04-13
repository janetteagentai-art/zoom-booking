import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AppDataSource } from '../config/data-source';
import { Booking } from '../entities';
import {
  createBooking,
  cancelBooking,
  getProfessorBookings,
  getAllBookings,
  getAvailability,
} from '../services/bookingService';
import { buildZoomEmbedData } from '../services/zoomSdkService';
import { z } from 'zod';

export const CreateBookingSchema = z
  .object({
    title: z.string().min(2),
    startTime: z.string(),
    durationMinutes: z.number().int().min(15).max(480),
    zoomIndex: z.number().int().min(1),
  })
  .refine((data) => !isNaN(Date.parse(data.startTime)), {
    message: 'startTime debe ser un datetime válido',
    path: ['startTime'],
  });

export async function listBookings(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest;
    if (authReq.user!.role === 'admin' || req.query.all === 'true') {
      res.json(await getAllBookings());
    } else {
      res.json(await getProfessorBookings(authReq.user!.id));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function getAvailabilityHandler(req: Request, res: Response) {
  try {
    const start = req.query.start as string;
    const end = req.query.end as string;
    const zoomIndex = req.query.zoom as string | undefined;
    if (!start || !end) {
      res.status(400).json({ error: 'start y end son requeridos' });
      return;
    }
    const slots = await getAvailability(start, end, zoomIndex);
    res.json(slots);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
}

export async function createBookingHandler(req: Request, res: Response) {
  try {
    const body = CreateBookingSchema.parse(req.body);
    const authReq = req as AuthRequest;

    const booking = await createBooking({
      professorId: authReq.user!.id,
      title: body.title,
      startTime: body.startTime as any,
      durationMinutes: body.durationMinutes,
      zoomIndex: body.zoomIndex,
    });

    res.status(201).json(booking);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors });
      return;
    }
    res.status(400).json({ error: err.message });
  }
}

export async function getEmbedData(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest;
    const { id } = req.params;
    const role = req.query.role === '1' ? 1 : 0;


    const booking = await AppDataSource.getRepository(Booking).findOne({
      where: { id },
      relations: ['zoomAccount'],
    });


    if (!booking) {
      res.status(404).json({ error: 'Booking no encontrado' });
      return;
    }

    const user = authReq.user!;

    const data = buildZoomEmbedData(
      {
        zoomMeetingId: booking.zoomMeetingId,
        zoomPassword: booking.zoomPassword,
        zoomAccountId: booking.zoomAccountId,
      },
      {
        zoomAccountId: booking.zoomAccount.zoomAccountId,
        zoomClientId: booking.zoomAccount.zoomSdkKey || booking.zoomAccount.zoomClientId,
        zoomClientSecret: booking.zoomAccount.zoomSdkSecret || booking.zoomAccount.zoomClientSecret,
      },
      user.name,
      user.email,
      role as 0 | 1
    );

    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function cancelBookingHandler(req: Request, res: Response) {
  try {
    const authReq = req as AuthRequest;
    await cancelBooking(req.params.id, authReq.user!.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
