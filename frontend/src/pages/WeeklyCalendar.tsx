import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { bookingsService } from '../services/bookingsService';
import { Booking, ZoomAccount } from '../utils/api';
import { zoomAccountsService } from '../services/zoomAccountsService';
import { useAuth } from '../contexts/AuthContext';

const TIMEZONE = 'America/Buenos_Aires';

function formatDateLocal(dateStr: string): string {
  return formatInTimeZone(parseISO(dateStr), TIMEZONE, "dd/MM/yyyy HH:mm");
}

export default function WeeklyCalendar() {
  const { user, logout } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [zoomAccounts, setZoomAccounts] = useState<ZoomAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [bData, zData] = await Promise.all([
        bookingsService.list(true),
        zoomAccountsService.list(),
      ]);
      setBookings(bData.data.filter((b: Booking) => b.status !== 'cancelled'));
      setZoomAccounts(zData.data);
    } catch {}
    setLoading(false);
  };

  const cancelBooking = async (id: string) => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    await bookingsService.cancel(id);
    setSelectedBooking(null);
    load();
  };

  const weekStart = startOfWeek(currentMonth, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentMonth, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const HOURS = Array.from({ length: 17 }, (_, i) => 7 + i);

  const accountColor: Record<string, string> = {};
  zoomAccounts.forEach(a => { if (a.color) accountColor[a.id] = a.color; });
  const defaultColor = '#6b7280';

  const weeklyOccupied = weekDays.map(day => {
    const dayStr = formatInTimeZone(day, TIMEZONE, 'yyyy-MM-dd');
    const dayBookings = bookings.filter(b => {
      const bDate = formatInTimeZone(parseISO(b.startTime), TIMEZONE, 'yyyy-MM-dd');
      return bDate === dayStr;
    });
    return { day, bookings: dayBookings };
  });

  const canCancel = (b: Booking) => user?.role === 'admin' || user?.id === b.professor?.id;

  return (
    <>
      <div style={{ minHeight: '100vh', background: '#f8f9fa' }}>
        <div className="navbar">
          <img src="/logo-dcs.png" alt="DCS" style={{ height: 100, width: 'auto' }} />
          <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {user?.role === 'admin' && (
              <>
                <Link to="/admin"><button className="btn btn-secondary btn-sm">📹 Cuentas</button></Link>
                <Link to="/admin?tab=professors"><button className="btn btn-secondary btn-sm">👨‍🏫 Profesores</button></Link>
                <Link to="/admin?tab=bookings"><button className="btn btn-secondary btn-sm">📋 Reservas</button></Link>
              </>
            )}
            <Link to="/mis-reservas">
              <button className="btn btn-secondary btn-sm">← Mis Reservas</button>
            </Link>
            <span style={{ color: '#93c5fd', fontSize: '0.8rem', marginLeft: '0.25rem' }}>{user?.name}</span>
            <button className="btn btn-secondary btn-sm" onClick={logout}>Salir</button>
          </div>
        </div>

        <div className="container" style={{ padding: '1.5rem' }}>
          {zoomAccounts.length > 0 && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', padding: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#666' }}>Cuentas Zoom:</span>
              {zoomAccounts.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '3px', background: accountColor[a.id] || defaultColor }} />
                  <span style={{ fontSize: '0.8rem' }}>{a.label}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ fontSize: '1.4rem' }}>Horarios Reservados por Cuenta</h1>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#666' }}>
                {format(weekStart, 'dd MMM')} — {format(weekEnd, 'dd MMM yyyy', { locale: es })}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>←</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>→</button>
            </div>
          </div>

          {loading ? (
            <div className="loading">Cargando...</div>
          ) : (
            <div className="card">
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
                  <div />
                  {weeklyOccupied.map(({ day }) => (
                    <div key={day.toISOString()} style={{
                      textAlign: 'center',
                      fontWeight: 500,
                      color: '#333',
                      fontSize: '0.85rem',
                      padding: '6px 0',
                      borderBottom: '2px solid #e5e7eb',
                    }}>
                      {format(day, 'EEEE dd', { locale: es })}
                    </div>
                  ))}
                </div>

                {HOURS.map(hour => (
                  <div key={hour} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888', textAlign: 'right', paddingRight: '8px', lineHeight: '44px' }}>
                      {`${hour.toString().padStart(2, '0')}:00`}
                    </div>
                    {weeklyOccupied.map(({ day, bookings: dayBookings }) => {
                      const bookingAtHour = dayBookings.find(b => {
                        const start = new Date(b.startTime);
                        const durationHours = (b.durationMinutes || 60) / 60;
                        return hour >= start.getHours() && hour < start.getHours() + durationHours;
                      });
                      const isBookingStart = bookingAtHour && new Date(bookingAtHour.startTime).getHours() === hour;
                      const color = bookingAtHour ? (accountColor[bookingAtHour.zoomAccountId] || defaultColor) : undefined;
                      const textColor = '#ffffff';

                      return (
                        <div
                          key={day.toISOString()}
                          style={{
                            background: color ? `${color}22` : '#f9f9f9',
                            border: `1px solid ${color ? color + '88' : '#e5e7eb'}`,
                            borderRadius: '4px',
                            height: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            color: color ? textColor : '#ccc',
                            fontWeight: isBookingStart ? 600 : 400,
                            overflow: 'hidden',
                            padding: '2px 6px',
                            textAlign: 'center',
                            cursor: bookingAtHour ? 'pointer' : 'default',
                          }}
                          onClick={() => bookingAtHour && setSelectedBooking(bookingAtHour)}
                          title={bookingAtHour ? `${bookingAtHour.professor?.name || 'Prof.'} — ${bookingAtHour.title} (${formatDateLocal(bookingAtHour.startTime)})` : ''}
                        >
                          {isBookingStart ? (
                            <span style={{ fontSize: '0.65rem', lineHeight: '1.2' }}>
                              {bookingAtHour.title.length > 14 ? bookingAtHour.title.slice(0, 14) + '…' : bookingAtHour.title}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedBooking && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
        }} onClick={() => setSelectedBooking(null)}>
          <div style={{
            background: 'white', borderRadius: '12px', padding: '1.5rem', maxWidth: '400px', width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: accountColor[selectedBooking.zoomAccountId] || defaultColor,
              }} />
              <span style={{ fontSize: '0.8rem', color: '#666' }}>
                {zoomAccounts.find(a => a.id === selectedBooking.zoomAccountId)?.label || 'Cuenta Zoom'}
              </span>
            </div>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{selectedBooking.title}</h2>
            <div style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              📅 {formatDateLocal(selectedBooking.startTime)} · {selectedBooking.durationMinutes} min
            </div>
            <div style={{ color: '#666', fontSize: '0.85rem', marginBottom: '1rem' }}>
              👤 {selectedBooking.professor?.name || selectedBooking.professor?.email || '—'}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {selectedBooking.zoomJoinUrl && (
                <button className="btn btn-secondary" onClick={() => window.open(selectedBooking.zoomJoinUrl, '_blank')}>
                  🔗 Abrir Zoom
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => cancelBooking(selectedBooking.id)} disabled={!canCancel(selectedBooking)}>
                ✕ Cancelar reserva
              </button>
              <button className="btn btn-secondary" onClick={() => setSelectedBooking(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
