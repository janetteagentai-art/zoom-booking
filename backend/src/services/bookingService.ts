import { AppDataSource } from '../config/data-source';
import { Booking, BookingStatus, ZoomAccount } from '../entities';
import { ZoomService, zoomService } from './zoomService';
import { Not } from 'typeorm';
import { parseARTDate } from '../utils/timezone';

const bookingRepo = () => AppDataSource.getRepository(Booking);
const zoomAccountRepo = () => AppDataSource.getRepository(ZoomAccount);

export interface CreateBookingInput {
  professorId: string;
  title: string;
  startTime: Date | string;
  durationMinutes: number;
  zoomIndex?: number;
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
  if (!startTime || isNaN(startTime.getTime()) || !endTime || isNaN(endTime.getTime())) {
    console.error('findOverlapping: invalid dates', { startTime, endTime });
    return [];
  }

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
  endDateRaw: Date | string,
  zoomIndex?: string
): Promise<BookingSlot[]> {
  const startDate = typeof startDateRaw === 'string' ? parseARTDate(startDateRaw) : startDateRaw;
  const endDate   = typeof endDateRaw   === 'string' ? parseARTDate(endDateRaw)   : endDateRaw;

  if (!startDate || isNaN(startDate.getTime()) || !endDate || isNaN(endDate.getTime())) {
    console.error('getAvailability: invalid dates', { startDateRaw, endDateRaw, startDate, endDate });
    throw new Error('Invalid date range');
  }

  let accounts: ZoomAccount[];
  if (zoomIndex) {
    const idx = parseInt(zoomIndex, 10);
    if (isNaN(idx) || idx < 1) throw new Error('zoom debe ser 1, 2, 3...');
    accounts = await zoomAccountRepo().find({ where: { isActive: true }, order: { createdAt: 'ASC' } });
    const target = accounts[idx - 1];
    if (!target) throw new Error(`No existe cuenta Zoom con número ${zoomIndex}`);
    accounts = [target];
  } else {
    accounts = await zoomAccountRepo().find({ where: { isActive: true } });
  }

  const accountIds = accounts.map(a => a.id);
  if (accountIds.length === 0) {
    return [];
  }

  const bookings = await findOverlapping(startDate, endDate);
  const filtered = bookings.filter(b => accountIds.includes(b.zoomAccountId));

  const slots: BookingSlot[] = [];
  const intervalMs = 30 * 60 * 1000; // 30 min slots

  let current = new Date(startDate);
  while (current < endDate) {
    const slotEnd = new Date(current.getTime() + 30 * 60 * 1000);

    const overlapping = filtered.find((b) => {
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
  const startTimeObj: Date = typeof input.startTime === 'string'
    ? parseARTDate(input.startTime)
    : input.startTime;

  const endTime = new Date(
    startTimeObj.getTime() + input.durationMinutes * 60 * 1000
  );

  // Check availability — use specified account by index or auto-select
  let account;
  if (input.zoomIndex) {
    const idx = input.zoomIndex;
    const allAccounts = await zoomAccountRepo().find({ where: { isActive: true }, order: { createdAt: 'ASC' } });
    const target = allAccounts[idx - 1];
    if (!target) throw new Error(`No existe cuenta Zoom con número ${idx}`);
    account = target;
    const overlapping = await findOverlapping(startTimeObj, endTime);
    if (overlapping.some(b => b.zoomAccountId === account!.id)) {
      throw new Error('Esa cuenta Zoom ya está reservada en ese horario. Elegí otro horario o cuenta.');
    }
  } else {
    account = await findAvailableZoomAccount(startTimeObj, endTime);
    if (!account) {
      throw new Error(
        'No hay cuenta Zoom disponible para ese horario. Probá otro horario.'
      );
    }
  }

  // Create Zoom meeting using account-specific credentials
  const zoomSvc = new ZoomService(account.zoomAccountId ? {
    accountId: account.zoomAccountId,
    clientId: account.zoomClientId,
    clientSecret: account.zoomClientSecret,
  } : undefined);

  console.error('DEBUG createBooking: Creating ZoomService with:', {
    hasCredentials: !!account.zoomAccountId,
    hasClientId: !!account.zoomClientId,
    hasClientSecret: !!account.zoomClientSecret,
    isConfigured: zoomSvc.isConfigured
  });

  if (!zoomSvc.isConfigured) {
    console.error('DEBUG: ZoomService not configured, throwing error');
    throw new Error('Credenciales Zoom no configuradas para esta cuenta');
  }

  console.error('DEBUG: Calling zoomSvc.createMeeting...');

  const meeting = await zoomSvc.createMeeting({
    topic: input.title,
    startTime: startTimeObj,
    durationMinutes: input.durationMinutes,
  });

  // Save booking
  const booking = bookingRepo().create({
    professorId: input.professorId,
    zoomAccountId: account.id,
    title: input.title,
    startTime: startTimeObj,
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
export async function getProfessorBookings(professorId: string): Promise<any[]> {
  const bookings = await bookingRepo().find({
    where: { professorId },
    relations: ['zoomAccount'],
    order: { startTime: 'ASC' },
  });
  return bookings.map(b => {
    const { zoomClientSecret, ...rest } = b.zoomAccount || {};
    return { ...b, zoomAccount: rest };
  });
}

/**
 * Get all bookings (admin).
 */
export async function getAllBookings(): Promise<any[]> {
  const bookings = await bookingRepo().find({
    relations: ['professor', 'zoomAccount'],
    order: { startTime: 'ASC' },
  });
  return bookings.map(b => {
    const { zoomClientSecret, ...rest } = b.zoomAccount || {};
    return { ...b, zoomAccount: rest };
  });
}
