import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, startOfWeek, endOfWeek, isSameDay, isToday, parseISO, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { bookingsService } from '../services/bookingsService';
import { zoomAccountsService } from '../services/zoomAccountsService';
import { Booking, Slot, ZoomAccount } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import ZoomEmbed from '../components/ZoomEmbed';

const TIMEZONE = 'America/Buenos_Aires';

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
  const [zoomAccounts, setZoomAccounts] = useState<ZoomAccount[]>([]);
  const [selectedZoomIndex, setSelectedZoomIndex] = useState<number>(1);
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedBooking, setEmbedBooking] = useState<Booking | null>(null);

  const navigate = useNavigate();

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });
  const firstDayOffset = startOfMonth(currentMonth).getDay();

  // Auto-select first account when zoomAccounts finishes loading
  useEffect(() => {
    if (!selectedZoomIndex && zoomAccounts.length > 0) {
      setSelectedZoomIndex(1);
    }
  }, [zoomAccounts, selectedZoomIndex]);

  useEffect(() => { loadBookings(); loadZoomAccounts(); }, []);

  const loadBookings = async () => {
    try {
      const { data } = await bookingsService.list();
      setBookings(data.filter((b: Booking) => b.status !== 'cancelled'));
    } catch {}
    setLoadingBookings(false);
  };

  const loadZoomAccounts = async () => {
    try {
      const { data } = await zoomAccountsService.list();
      const active = data.filter((a: ZoomAccount) => a.isActive);
      setZoomAccounts(active);
      // Auto-select first account if none selected yet
      if (!selectedZoomIndex && active.length > 0) {
        setSelectedZoomIndex(1);
      }
    } catch {}
  };

  const loadSlots = useCallback(async (date: Date) => {
    setLoadingSlots(true);
    try {
      const fmt = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
      const dayStart = startOfDay(date);
      const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
      const start = fmt(dayStart);
      const end = fmt(dayEnd);
      const { data } = await bookingsService.getAvailability(start, end, selectedZoomIndex);
      setSlots(data);
    } catch (err: any) {
      const msg = err.response?.data?.error;
      setMessage({ type: 'error', text: Array.isArray(msg) ? msg.map((e: any) => e.message).join(', ') : (msg || 'Error cargando horarios') });
    } finally { setLoadingSlots(false); }
  }, [selectedZoomIndex]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedSlots([]);
    setTitle('');
  };

  // Load slots when both date and zoom account are selected
  useEffect(() => {
    if (selectedDate && selectedZoomIndex) {
      loadSlots(selectedDate);
    }
  }, [selectedDate, selectedZoomIndex]);

  const handleSlotClick = (slot: Slot) => {
    if (!slot.available) return;
    const end = new Date(parseISO(slot.end).getTime() + (duration - 30) * 60 * 1000);
    const filtered = selectedSlots.filter(s => {
      const sStart = parseISO(s.start).getTime();
      const sEnd = parseISO(s.end).getTime();
      return !(end.getTime() <= sStart || parseISO(slot.start).getTime() >= sEnd);
    });
    if (filtered.length === selectedSlots.length) {
      setSelectedSlots(prev => [...prev.filter(s => {
        const sStart = parseISO(s.start).getTime();
        const sEnd = parseISO(s.end).getTime();
        const endTime = new Date(parseISO(slot.start).getTime() + duration * 60 * 1000).getTime();
        return !(endTime > sStart && parseISO(slot.start).getTime() < sEnd);
      }), slot]);
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
      await bookingsService.create({ title, startTime: startTime.toISOString(), durationMinutes: duration, zoomIndex: selectedZoomIndex });
      setMessage({ type: 'ok', text: '¡Reserva creada! Ya tenés el link de Zoom.' });
      setSelectedSlots([]);
      setTitle('');
      setSelectedZoomIndex(1);
      loadBookings();
    } catch (err: any) {
      const msg = err.response?.data?.error;
      setMessage({ type: 'error', text: Array.isArray(msg) ? msg.map((e: any) => e.message).join(', ') : (msg || 'Error al crear reserva') });
    } finally { setSubmitting(false); }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try { await bookingsService.cancel(id); loadBookings(); } catch {}
  };

  const getSlotsForDay = (day: Date) => {
    const dayStr = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
    return slots.filter(s => formatInTimeZone(parseISO(s.start), TIMEZONE, 'yyyy-MM-dd') === dayStr);
  };

  const myUpcomingBookings = bookings.filter(b => new Date(b.startTime) > new Date());

  // ── WEEKLY OCCUPIED GRID ──────────────────────────────────────────────
  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 }); // Mon
  const weekEnd = endOfWeek(currentMonth, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const HOURS = Array.from({ length: 17 }, (_, i) => 7 + i); // 7:00 to 23:00

  // Group bookings by day and hour for the weekly occupied view
  const weeklyOccupied = weekDays.map(day => {
    const dayStr = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
    const dayBookings = bookings.filter(b => {
      const bDate = formatInTimeZone(parseISO(b.startTime), TIMEZONE, 'yyyy-MM-dd');
      return bDate === dayStr;
    });
    return { day, bookings: dayBookings };
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
      {/* ── Navbar ── */}
      <div className="navbar">
        <img src="/logo-dcs.png" alt="DCS" style={{ height: 100, width: 'auto', marginRight: '0.5rem' }} />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Link to="/reservas-semanales">
            <button className="btn btn-secondary btn-sm">📅 Vista Semanal</button>
          </Link>
          <span>{user?.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Salir</button>
        </div>
      </div>

      <div className="container" style={{ padding: '1.5rem' }}>
        <h1 style={{ marginBottom: '1.5rem', fontSize: '1.4rem' }}>
          Mis reservas — Universidad
        </h1>

        {/* ── TOP ROW: calendar + day slots ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}>
          {/* Calendar (month view) */}
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

          {/* Day slots panel */}
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
                {zoomAccounts.length > 0 && (
                  <div className="form-group">
                    <label>Cuenta Zoom</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {zoomAccounts.map((a, index) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedZoomIndex(index + 1)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: `2px solid ${selectedZoomIndex === index + 1 ? a.color || '#6b7280' : '#e5e7eb'}`,
                            background: selectedZoomIndex === index + 1 ? `${a.color || '#6b7280'}22` : 'white',
                            color: selectedZoomIndex === index + 1 ? (a.color || '#6b7280') : '#666',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: selectedZoomIndex === index + 1 ? 600 : 400,
                          }}
                        >
                          Zoom ${index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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

            {/* Upcoming bookings */}
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
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <a href={b.zoomJoinUrl} target="_blank" rel="noreferrer">🔗 Link para alumnos</a>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '1px 6px', fontSize: '0.7rem' }}
                            onClick={() => {
                              const el = document.createElement('textarea');
                              el.value = b.zoomJoinUrl || '';
                              el.style.position = 'fixed';
                              el.style.opacity = '0';
                              document.body.appendChild(el);
                              el.focus();
                              el.select();
                              try { document.execCommand('copy'); } catch(e) {}
                              document.body.removeChild(el);
                            }}
                          >
                            📋 Copiar link alumnos
                          </button>
                          {b.zoomPassword && <span> · Clave: {b.zoomPassword}</span>}
                        </div>
                      )}
                      {b.zoomStartUrl && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <a href={b.zoomStartUrl} target="_blank" rel="noreferrer">🎥 Iniciar clase (Zoom cuenta)</a>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '1px 6px', fontSize: '0.7rem' }}
                            onClick={() => {
                              const el = document.createElement('textarea');
                              el.value = b.zoomStartUrl || '';
                              el.style.position = 'fixed';
                              el.style.opacity = '0';
                              document.body.appendChild(el);
                              el.focus();
                              el.select();
                              try { document.execCommand('copy'); } catch(e) {}
                              document.body.removeChild(el);
                            }}
                          >
                            📋 Copiar link profesor
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '1px 6px', fontSize: '0.7rem' }}
                            onClick={() => {
                              setEmbedBooking(b);
                              setShowEmbed(true);
                            }}
                          >
                            🖥 Iniciar embebido
                          </button>
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

        {/* ── WEEKLY OCCUPIED SLOTS ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div className="card-title" style={{ margin: 0 }}>📅 Semana — Horarios Ocupados</div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>
                {format(weekStart, 'dd MMM')} — {format(endOfWeek(currentMonth, { weekStartsOn: 1 }), 'dd MMM yyyy', { locale: es })}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>←</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>→</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
              <div />
              {weeklyOccupied.map(({ day }) => (
                <div key={day.toISOString()} style={{
                  textAlign: 'center',
                  fontWeight: isToday(day) ? 700 : 500,
                  color: isToday(day) ? '#2563eb' : '#333',
                  fontSize: '0.8rem',
                  padding: '4px 0',
                  background: isToday(day) ? '#eff6ff' : 'transparent',
                  borderRadius: '4px',
                }}>
                  {format(day, 'EEE dd', { locale: es })}
                </div>
              ))}
            </div>
            {/* Time grid */}
            {HOURS.map(hour => (
              <div key={hour} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
                <div style={{ fontSize: '0.7rem', color: '#888', textAlign: 'right', paddingRight: '6px', lineHeight: '36px' }}>
                  {`${hour.toString().padStart(2, '0')}:00`}
                </div>
                {weeklyOccupied.map(({ day, bookings: dayBookings }) => {
                  const bookingAtHour = dayBookings.find(b => {
                    const start = new Date(b.startTime);
                    const durationHours = (b.durationMinutes || 60) / 60;
                    return hour >= start.getHours() && hour < start.getHours() + durationHours;
                  });
                  const isBookingStart = bookingAtHour && new Date(bookingAtHour.startTime).getHours() === hour;
                  return (
                    <div
                      key={day.toISOString()}
                      style={{
                        background: bookingAtHour ? '#fee2e2' : '#f9f9f9',
                        border: isToday(day) ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                        borderRadius: '4px',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.65rem',
                        color: bookingAtHour ? '#991b1b' : '#ccc',
                        fontWeight: bookingAtHour ? 500 : 300,
                        overflow: 'hidden',
                        padding: '2px 4px',
                        textAlign: 'center',
                      }}
                    >
                      {isBookingStart ? (
                        <span title={`${bookingAtHour.title} (${formatDateLocal(bookingAtHour.startTime)})`}>
                          {bookingAtHour.title.length > 12 ? bookingAtHour.title.slice(0, 12) + '…' : bookingAtHour.title}
                        </span>
                      ) : bookingAtHour ? '' : '—'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
