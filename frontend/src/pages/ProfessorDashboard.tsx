import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isToday, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { bookingsApi, Booking, Slot } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const TIMEZONE = 'America/Buenos_Aires';

function toLocal(date: Date): Date {
  return date; // dates from Date input are already local
}

function formatLocal(dateStr: string): string {
  return formatInTimeZone(parseISO(dateStr), TIMEZONE, "HH:mm");
}

function formatDateLocal(dateStr: string): string {
  return formatInTimeZone(parseISO(dateStr), TIMEZONE, "dd/MM/yyyy HH:mm");
}

export default function ProfessorDashboard() {
  const { user, logout } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(60);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOffset = startOfMonth(currentMonth).getDay(); // 0=Dom

  useEffect(() => { loadBookings(); }, []);

  const loadBookings = async () => {
    try {
      const { data } = await bookingsApi.list();
      setBookings(data.filter(b => b.status !== 'cancelled'));
    } catch { /* ignore */ }
    finally { setLoadingBookings(false); }
  };

  const loadSlots = async (date: Date) => {
    setLoadingSlots(true);
    setMessage(null);
    try {
      const dayStart = startOfDay(date); // midnight in ART
      const dayEnd = endOfDay(date);     // end of day in ART
      // Format as ISO string with ART offset (-03:00)
      const fmt = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
      const start = fmt(dayStart);
      const end   = fmt(dayEnd);
      const { data } = await bookingsApi.getAvailability(start, end);
      setSlots(data);
    } catch (err: any) {
      const msg = err.response?.data?.error;
      setMessage({ type: 'error', text: Array.isArray(msg) ? msg.map((e: any) => e.message).join(', ') : (msg || 'Error cargando horarios') });
    } finally { setLoadingSlots(false); }
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedSlots([]);
    setTitle('');
    loadSlots(day);
  };

  const handleSlotClick = (slot: Slot) => {
    if (!slot.available) return;
    const end = new Date(parseISO(slot.end).getTime() + (duration - 30) * 60 * 1000);
    const filtered = selectedSlots.filter(s => {
      const sStart = parseISO(s.start).getTime();
      const sEnd = parseISO(s.end).getTime();
      return !(end.getTime() <= sStart || parseISO(slot.start).getTime() >= sEnd);
    });
    if (filtered.length === selectedSlots.length) {
      setSelectedSlots(prev => prev.filter(s => {
        const sStart = parseISO(s.start).getTime();
        const sEnd = parseISO(s.end).getTime();
        const endTime = new Date(parseISO(slot.start).getTime() + duration * 60 * 1000).getTime();
        return !(endTime > sStart && parseISO(slot.start).getTime() < sEnd);
      }));
    } else {
      setSelectedSlots(prev => [...prev.filter(s => {
        const sStart = parseISO(s.start).getTime();
        const sEnd = parseISO(s.end).getTime();
        const endTime = new Date(parseISO(slot.start).getTime() + duration * 60 * 1000).getTime();
        return !(endTime > sStart && parseISO(slot.start).getTime() < sEnd);
      }), slot]);
    }
  };

  const handleBook = async () => {
    if (!selectedDate || selectedSlots.length === 0) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const startTime = parseISO(selectedSlots[0].start);
      await bookingsApi.create({ title, startTime: startTime.toISOString(), durationMinutes: duration });
      setMessage({ type: 'ok', text: '¡Reserva creada! Ya tenés el link de Zoom.' });
      setSelectedSlots([]);
      setTitle('');
      loadBookings();
    } catch (err: any) {
      const msg = err.response?.data?.error;
      setMessage({ type: 'error', text: Array.isArray(msg) ? msg.map((e: any) => e.message).join(', ') : (msg || 'Error al crear reserva') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await bookingsApi.cancel(id);
      loadBookings();
    } catch {}
  };

  const getSlotsForDay = (day: Date) => {
    const dayStr = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
    // JanetteDebug: ART-based day filter
    return slots.filter(s => formatInTimeZone(parseISO(s.start), TIMEZONE, 'yyyy-MM-dd') === dayStr);
  };

  const myUpcomingBookings = bookings.filter(b => parseISO(b.startTime) > new Date());

  return (
    <div>
      <div className="navbar">
        <span className="navbar-brand">📹 ReservaZoom</span>
        <div className="navbar-user">
          <span>{user?.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Salir</button>
        </div>
      </div>

      <div className="container">
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>
          Mis reservas — Universidad
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* ── Calendar ── */}
          <div className="card">
            <div className="calendar-header">
              <h2>{format(currentMonth, 'MMMM yyyy', { locale: es })}</h2>
              <div className="calendar-nav">
                <button className="btn btn-secondary btn-sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>←</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>→</button>
              </div>
            </div>

            <div className="calendar-grid">
              {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
                <div key={d} className="calendar-day-header">{d}</div>
              ))}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="calendar-cell disabled" />
              ))}
              {days.map(day => {
                const daySlots = getSlotsForDay(day);
                const hasAvailable = daySlots.some(s => s.available);
                return (
                  <div
                    key={day.toISOString()}
                    className={`calendar-cell ${isToday(day) ? 'today' : ''}`}
                    onClick={() => handleDayClick(day)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="calendar-date">{format(day, 'd')}</div>
                    {hasAvailable && (
                      <div style={{ fontSize: '0.6rem', color: '#38a169', fontWeight: 600 }}>● Disponible</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Booking panel ── */}
          <div>
            {selectedDate ? (
              <div className="card">
                <div className="card-title">
                  📅 {format(selectedDate, "EEEE dd 'de' MMMM", { locale: es })}
                </div>

                <div className="form-group">
                  <label>Duración</label>
                  <select value={duration} onChange={e => setDuration(Number(e.target.value))}>
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>1 hora</option>
                    <option value={90}>1 hora 30 minutos</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Nombre de la reunión</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ej: Clase de Matemática - Grupo A"
                  />
                </div>

                {loadingSlots ? (
                  <div className="loading">Cargando horarios...</div>
                ) : slots.length === 0 ? (
                  <div className="empty">Seleccioná un día para ver horarios</div>
                ) : (
                  <div className="slots-list">
                    {slots.map(slot => {
                      const isSelected = selectedSlots.some(s => s.start === slot.start);
                      return (
                        <div
                          key={slot.start}
                          className={`slot-item ${slot.available ? (isSelected ? 'available' : '') : 'busy'}`}
                          onClick={() => handleSlotClick(slot)}
                          style={{ cursor: slot.available ? 'pointer' : 'not-allowed' }}
                        >
                          <div>
                            <div className="slot-time">{formatLocal(slot.start)} — {formatLocal(slot.end)}</div>
                            <div className="slot-label">
                              {slot.available
                                ? isSelected ? '✓ Seleccionado' : '● Disponible'
                                : '✗ Ocupado'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {message && (
                  <div className={message.type === 'ok' ? 'badge badge-confirmed' : 'error-box'} style={{ marginTop: '0.75rem' }}>
                    {message.text}
                  </div>
                )}

                {selectedSlots.length > 0 && (
                  <button
                    className="btn btn-primary btn-full"
                    style={{ marginTop: '1rem' }}
                    onClick={handleBook}
                    disabled={submitting || !title.trim()}
                  >
                    {submitting ? 'Creando...' : `Reservar ${selectedSlots[0] ? formatLocal(selectedSlots[0].start) : ''}`}
                  </button>
                )}
              </div>
            ) : (
              <div className="card">
                <div className="empty">← Hacé click en un día del calendario para ver horarios disponibles</div>
              </div>
            )}

            {/* ── Upcoming bookings ── */}
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-title">Próximas reuniones</div>
              {loadingBookings ? (
                <div className="loading">Cargando...</div>
              ) : myUpcomingBookings.length === 0 ? (
                <div className="empty">No tenés reuniones reservadas</div>
              ) : (
                myUpcomingBookings.map(b => (
                  <div key={b.id} className="booking-card">
                    <div className="booking-info">
                      <h3>{b.title}</h3>
                      <div className="booking-meta">
                        <span>📅 {formatDateLocal(b.startTime)}</span>
                        <span>⏱ {b.durationMinutes} min</span>
                        <span className={`badge badge-${b.status}`}>{b.status}</span>
                      </div>
                      {b.zoomJoinUrl && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                          🔗 <a href={b.zoomJoinUrl} target="_blank" rel="noreferrer">Abrir en Zoom</a>
                          {b.zoomPassword && <span> · Clave: {b.zoomPassword}</span>}
                        </div>
                      )}
                    </div>
                    <div className="booking-actions">
                      <button className="btn btn-danger btn-sm" onClick={() => handleCancel(b.id)}>Cancelar</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
