import { AppDataSource } from '../config/data-source';
import { Booking, BookingStatus, ZoomAccount } from '../entities';
import { zoomService } from './zoomService';
import { Not } from 'typeorm';
import { parseARTDate } from '../utils/timezone';

const bookingRepo = () => AppDataSource.getRepository(Booking);
const zoomAccountRepo = () => AppDataSource.getRepository(ZoomAccount);

export interface CreateBookingInput {
  professorId: string;
  title: string;
  startTime: Date | string;
  durationMinutes: number;
}

export interface BookingSlot {
  start: Date;
  end: Date;
  available: boolean;
  zoomAccountId?: string;
}

// Manual overlap check since TypeORM query builder is verbose
async function findOverlapping(
  startTime: Date,
  endTime: Date
): Promise<Booking[]> {
  const all = await bookingRepo()
    .createQueryBuilder('b')
    .where('b.status != :cancelled', { cancelled: BookingStatus.CANCELLED })
    .andWhere(
      'b.startTime < :endTime',
      { endTime }
    )
    .getMany();

  return all.filter((b) => {
    const bEnd = new Date(
      b.startTime.getTime() + b.durationMinutes * 60 * 1000
    );
    return bEnd > startTime;
  });
}

/**
 * Get the availability grid for a date range.
 * Returns 30-min slots with availability info.
 */
export async function getAvailability(
  startDateRaw: Date | string,
  endDateRaw: Date | string
): Promise<BookingSlot[]> {
  const startDate = typeof startDateRaw === 'string' ? parseARTDate(startDateRaw) : startDateRaw;
  const endDate   = typeof endDateRaw   === 'string' ? parseARTDate(endDateRaw)   : endDateRaw;

  const activeAccounts = await zoomAccountRepo().find({
    where: { isActive: true },
  });

  if (activeAccounts.length === 0) {
    return [];
  }

  const bookings = await findOverlapping(startDate, endDate);

  const slots: BookingSlot[] = [];
  const intervalMs = 30 * 60 * 1000; // 30 min slots

  let current = new Date(startDate);
  while (current < endDate) {
    const slotEnd = new Date(current.getTime() + 30 * 60 * 1000);

    const overlapping = bookings.find((b) => {
      const bEnd = new Date(
        b.startTime.getTime() + b.durationMinutes * 60 * 1000
      );
      return current < bEnd && slotEnd > b.startTime;
    });

    slots.push({
      start: new Date(current),
      end: slotEnd,
      available: !overlapping,
      zoomAccountId: overlapping?.zoomAccountId,
    });

    current = slotEnd;
  }

  return slots;
}

/**
 * Find which Zoom account is free for the requested time window.
 */
async function findAvailableZoomAccount(
  startTime: Date,
  endTime: Date
): Promise<ZoomAccount | null> {
  const activeAccounts = await zoomAccountRepo().find({
    where: { isActive: true },
  });

  const overlapping = await findOverlapping(startTime, endTime);
  const occupiedAccountIds = new Set(overlapping.map((b) => b.zoomAccountId));

  return activeAccounts.find((a) => !occupiedAccountIds.has(a.id)) || null;
}

/**
 * Create a booking: validates availability, creates Zoom meeting, saves.
 */
export async function createBooking(
  input: CreateBookingInput
): Promise<Booking> {
  if (!zoomService.isConfigured) {
    throw new Error('Zoom no está configurado en el servidor');
  }

  // input.startTime may come from parsed JSON as a string with ART offset
  const startTime = typeof input.startTime === 'string'
    ? parseARTDate(input.startTime)
    : input.startTime;

  const endTime = new Date(
    startTime.getTime() + input.durationMinutes * 60 * 1000
  );

  // Check availability
  const account = await findAvailableZoomAccount(input.startTime, endTime);
  if (!account) {
    throw new Error(
      'No hay cuenta Zoom disponible para ese horario. Probá otro horario.'
    );
  }

  // Create Zoom meeting
  const meeting = await zoomService.createMeeting({
    topic: input.title,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
  });

  // Save booking
  const booking = bookingRepo().create({
    professorId: input.professorId,
    zoomAccountId: account.id,
    title: input.title,
    startTime: input.startTime,
    durationMinutes: input.durationMinutes,
    status: BookingStatus.CONFIRMED,
    zoomMeetingId: String(meeting.id),
    zoomJoinUrl: meeting.join_url,
    zoomHostUrl: meeting.start_url,
    zoomPassword: meeting.password,
    zoomEmbedUrl: zoomService.buildEmbedUrl(meeting.join_url),
    zoomStartUrl: meeting.start_url,
  });

  return bookingRepo().save(booking);
}

/**
 * Cancel a booking and delete the Zoom meeting.
 */
export async function cancelBooking(bookingId: string, professorId: string): Promise<void> {
  const booking = await bookingRepo().findOne({
    where: { id: bookingId },
  });

  if (!booking) {
    throw new Error('Booking no encontrado');
  }

  if (booking.professorId !== professorId) {
    throw new Error('No tienes permiso para cancelar esta reserva');
  }

  if (booking.status === BookingStatus.CANCELLED) {
    throw new Error('Ya está cancelada');
  }

  // Try to delete Zoom meeting (don't fail if Zoom API is down)
  if (booking.zoomMeetingId) {
    try {
      await zoomService.deleteMeeting(booking.zoomMeetingId);
    } catch {
      console.warn(`No se pudo eliminar meeting ${booking.zoomMeetingId} de Zoom`);
    }
  }

  booking.status = BookingStatus.CANCELLED;
  await bookingRepo().save(booking);
}

/**
 * Get all bookings for a professor.
 */
export async function getProfessorBookings(professorId: string): Promise<Booking[]> {
  return bookingRepo().find({
    where: { professorId },
    order: { startTime: 'ASC' },
  });
}

/**
 * Get all bookings (admin).
 */
export async function getAllBookings(): Promise<Booking[]> {
  return bookingRepo().find({
    relations: ['professor', 'zoomAccount'],
    order: { startTime: 'ASC' },
  });
}
