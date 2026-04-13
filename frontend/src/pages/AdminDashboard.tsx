import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Link, useSearchParams } from 'react-router-dom';
import { zoomAccountsService } from '../services/zoomAccountsService';
import { adminService } from '../services/adminService';
import { bookingsService } from '../services/bookingsService';
import { ZoomAccount, Professor, Booking } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const TIMEZONE = 'America/Buenos_Aires';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'accounts' | 'professors' | 'bookings'>('accounts');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const t = searchParams.get('tab') as 'accounts' | 'professors' | 'bookings' | null;
    if (t && ['accounts', 'professors', 'bookings'].includes(t)) setTab(t);
  }, [searchParams]);
  const [accounts, setAccounts] = useState<ZoomAccount[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddProfessor, setShowAddProfessor] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ZoomAccount | null>(null);
  const [accountLabel, setAccountLabel] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountColor, setAccountColor] = useState('#6b7280');
  const [accountZoomAccountId, setAccountZoomAccountId] = useState('');
  const [accountZoomClientId, setAccountZoomClientId] = useState('');
  const [accountZoomClientSecret, setAccountZoomClientSecret] = useState('');
  const [profEmail, setProfEmail] = useState('');
  const [profPassword, setProfPassword] = useState('');
  const [profName, setProfName] = useState('');
  const [profRole, setProfRole] = useState<'professor' | 'admin'>('professor');
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => { loadAll(); }, [tab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      if (tab === 'accounts') {
        const { data } = await zoomAccountsService.list();
        setAccounts(data);
      } else if (tab === 'professors') {
        const { data } = await adminService.listProfessors();
        setProfessors(data);
      } else {
        const { data } = await bookingsService.list();
        setBookings(data);
      }
    } catch {}
    setLoading(false);
  };

  const addAccount = async () => {
    try {
      await zoomAccountsService.create({ label: accountLabel, email: accountEmail, color: accountColor, zoomAccountId: accountZoomAccountId, zoomClientId: accountZoomClientId, zoomClientSecret: accountZoomClientSecret });
      setMsg({ type: 'ok', text: 'Cuenta agregada' });
      setAccountLabel(''); setAccountEmail(''); setAccountColor('#6b7280'); setAccountZoomAccountId(''); setAccountZoomClientId(''); setAccountZoomClientSecret('');
      setShowAddAccount(false);
      loadAll();
    } catch (err: any) {
      const msg = err.response?.data?.error;
      setMsg({ type: 'error', text: Array.isArray(msg) ? msg.map((e: any) => e.message).join(', ') : (msg || 'Error') });
    }
  };

  const toggleAccount = async (acc: ZoomAccount) => {
    await zoomAccountsService.update(acc.id, { isActive: !acc.isActive });
    loadAll();
  };

  const saveEditAccount = async () => {
    if (!editingAccount) return;
    try {
      await zoomAccountsService.update(editingAccount.id, {
        label: accountLabel,
        email: accountEmail,
        color: accountColor,
        zoomAccountId: accountZoomAccountId,
        zoomClientId: accountZoomClientId,
        zoomClientSecret: accountZoomClientSecret,
      });
      setMsg({ type: 'ok', text: 'Cuenta actualizada' });
      setEditingAccount(null);
      setAccountLabel('');
      setAccountEmail('');
      setAccountColor('#6b7280');
      loadAll();
    } catch (err: any) {
      const msg = err.response?.data?.error;
      setMsg({ type: 'error', text: Array.isArray(msg) ? msg.map((e: any) => e.message).join(', ') : (msg || 'Error') });
    }
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('¿Eliminar esta cuenta?')) return;
    await zoomAccountsService.delete(id);
    loadAll();
  };

  const addProfessor = async () => {
    try {
      await adminService.createProfessor({ email: profEmail, password: profPassword, name: profName, role: profRole });
      setMsg({ type: 'ok', text: 'Profesor agregado' });
      setProfEmail(''); setProfPassword(''); setProfName('');
      setShowAddProfessor(false);
      loadAll();
    } catch (err: any) {
      const msg = err.response?.data?.error;
      setMsg({ type: 'error', text: Array.isArray(msg) ? msg.map((e: any) => e.message).join(', ') : (msg || 'Error') });
    }
  };

  const toggleProfessor = async (p: Professor) => {
    await adminService.updateProfessor(p.id, { isActive: !p.isActive });
    loadAll();
  };

  const deleteProfessor = async (id: string) => {
    if (!confirm('¿Eliminar este profesor?')) return;
    await adminService.deleteProfessor(id);
    loadAll();
  };

  const cancelBooking = async (id: string) => {
    if (!confirm('¿Cancelar esta reserva?')) return;
    try {
      await bookingsService.cancel(id);
      setMsg({ type: 'ok', text: 'Reserva cancelada' });
      loadAll();
    } catch (err: any) {
      const msg = err.response?.data?.error;
      setMsg({ type: 'error', text: Array.isArray(msg) ? msg.map((e: any) => e.message).join(', ') : (msg || 'Error') });
    }
  };

  const fmt = (d: string) => formatInTimeZone(parseISO(d), TIMEZONE, 'dd/MM/yyyy HH:mm');

  return (
    <div>
      <div className="navbar" style={{ display: 'flex', gap: '0', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '50px 1rem', borderRight: '1px solid rgba(255,255,255,0.2)' }}>
          <img src="/logo-dcs.png" alt="DCS" style={{ height: 100, width: 'auto' }} />
        </div>
        <div style={{ display: 'flex', gap: '0', padding: '0 0.5rem', flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
          {(['accounts', 'professors', 'bookings'] as const).map(t => (
            <button
              key={t}
              style={{
                background: 'transparent',
                border: 'none',
                color: tab === t ? '#60a5fa' : 'rgba(255,255,255,0.7)',
                fontWeight: tab === t ? 600 : 400,
                fontSize: '0.85rem',
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #60a5fa' : '2px solid transparent',
              }}
              onClick={() => setTab(t)}
            >
              {t === 'accounts' ? '📹 Cuentas' : t === 'professors' ? '👨‍🏫 Profesores' : '📅 Reservas'}
            </button>
          ))}
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', padding: '0 0.5rem', borderLeft: '1px solid rgba(255,255,255,0.2)' }}>{user?.name}</span>
          <Link to="/reservas-semanales" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary btn-sm" style={{ margin: '0 4px' }}>📅 Semanal</button>
          </Link>
          <Link to="/mis-reservas" style={{ textDecoration: 'none' }}>
            <button className="btn btn-secondary btn-sm" style={{ margin: '0 4px' }}>← Mis Reservas</button>
          </Link>
          <button className="btn btn-secondary btn-sm" style={{ margin: '0 4px' }} onClick={logout}>Salir</button>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '1.5rem' }}>
        {msg && (
          <div className={msg.type === 'ok' ? 'badge badge-confirmed' : 'error-box'} style={{ marginBottom: '1rem' }}>
            {msg.text}
          </div>
        )}

        {msg && (
          <div className={msg.type === 'ok' ? 'badge badge-confirmed' : 'error-box'} style={{ marginBottom: '1rem' }}>
            {msg.text}
          </div>
        )}

        {tab === 'accounts' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="card-title" style={{ margin: 0 }}>Cuentas Zoom</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddAccount(!showAddAccount)}>
                {showAddAccount ? 'Cancelar' : '+ Agregar cuenta'}
              </button>
            </div>

            {showAddAccount && (
              <div style={{ background: '#f7f8fa', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Nombre / Label</label>
                    <input value={accountLabel} onChange={e => setAccountLabel(e.target.value)} placeholder="Ej: Cuenta 1 - Matemática" />
                  </div>
                  <div className="form-group">
                    <label>Email Zoom (opcional)</label>
                    <input type="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} placeholder="zoom@universidad.edu" />
                  </div>
                  <div className="form-group">
                    <label>Zoom Account ID</label>
                    <input value={accountZoomAccountId} onChange={e => setAccountZoomAccountId(e.target.value)} placeholder="ABC123xyz" />
                  </div>
                  <div className="form-group">
                    <label>Zoom Client ID</label>
                    <input value={accountZoomClientId} onChange={e => setAccountZoomClientId(e.target.value)} placeholder="Client ID" />
                  </div>
                  <div className="form-group">
                    <label>Zoom Client Secret</label>
                    <input value={accountZoomClientSecret} onChange={e => setAccountZoomClientSecret(e.target.value)} placeholder="Client Secret" />
                  </div>
                  <div className="form-group">
                    <label>Color</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={accountColor}
                        onChange={e => setAccountColor(e.target.value)}
                        style={{ width: 40, height: 30, padding: 0, border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>{accountColor}</span>
                    </div>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={addAccount}>Guardar</button>
              </div>
            )}

            {editingAccount && (
              <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #93c5fd' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#2563eb' }}>Editar cuenta — {editingAccount.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Nombre / Label</label>
                    <input value={accountLabel} onChange={e => setAccountLabel(e.target.value)} placeholder="Nombre de la cuenta" />
                  </div>
                  <div className="form-group">
                    <label>Email Zoom</label>
                    <input type="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} placeholder="zoom@universidad.edu" />
                  </div>
                  <div className="form-group">
                    <label>Zoom Account ID</label>
                    <input value={accountZoomAccountId} onChange={e => setAccountZoomAccountId(e.target.value)} placeholder="ABC123xyz" />
                  </div>
                  <div className="form-group">
                    <label>Zoom Client ID</label>
                    <input value={accountZoomClientId} onChange={e => setAccountZoomClientId(e.target.value)} placeholder="Client ID" />
                  </div>
                  <div className="form-group">
                    <label>Zoom Client Secret</label>
                    <input value={accountZoomClientSecret} onChange={e => setAccountZoomClientSecret(e.target.value)} placeholder="Client Secret" />
                  </div>
                  <div className="form-group">
                    <label>Color</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={accountColor}
                        onChange={e => setAccountColor(e.target.value)}
                        style={{ width: 40, height: 30, padding: 0, border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: '#666' }}>{accountColor}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={saveEditAccount}>Guardar cambios</button>
                  <button className="btn btn-secondary" onClick={() => { setEditingAccount(null); setAccountLabel(''); setAccountEmail(''); setAccountColor('#6b7280'); setAccountZoomAccountId(''); setAccountZoomClientId(''); setAccountZoomClientSecret(''); }}>Cancelar</button>
                </div>
              </div>
            )}

            {loading ? <div className="loading">...</div> : accounts.length === 0 ? (
              <div className="empty">No hay cuentas cargadas</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th></th><th>Label</th><th>Email</th><th>Color</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: a.color || '#6b7280', display: 'inline-block' }} />
                      </td>
                      <td>{a.label}</td>
                      <td>{a.email || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <div style={{ width: 14, height: 14, borderRadius: '3px', background: a.color || '#6b7280' }} />
                          <span style={{ fontSize: '0.75rem', color: '#666' }}>{a.color || '#6b7280'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${a.isActive ? 'badge-confirmed' : 'badge-cancelled'}`}>
                          {a.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => {
                          setEditingAccount(a);
                          setAccountLabel(a.label);
                          setAccountEmail(a.email || '');
                          setAccountColor(a.color || '#6b7280');
                          setAccountZoomAccountId(a.zoomAccountId || '');
                          setAccountZoomClientId(a.zoomClientId || '');
                          setAccountZoomClientSecret(a.zoomClientSecret || '');
                        }}>Editar</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleAccount(a)}>
                          {a.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteAccount(a.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'professors' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="card-title" style={{ margin: 0 }}>Profesores</div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddProfessor(!showAddProfessor)}>
                {showAddProfessor ? 'Cancelar' : '+ Agregar profesor'}
              </button>
            </div>

            {showAddProfessor && (
              <div style={{ background: '#f7f8fa', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Nombre</label>
                    <input value={profName} onChange={e => setProfName(e.target.value)} placeholder="Juan Pérez" />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" value={profEmail} onChange={e => setProfEmail(e.target.value)} placeholder="juan@uni.edu" />
                  </div>
                  <div className="form-group">
                    <label>Contraseña</label>
                    <input type="password" value={profPassword} onChange={e => setProfPassword(e.target.value)} placeholder="••••" />
                  </div>
                  <div className="form-group">
                    <label>Rol</label>
                    <select value={profRole} onChange={e => setProfRole(e.target.value as any)}>
                      <option value="professor">Profesor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={addProfessor}>Guardar</button>
              </div>
            )}

            {loading ? <div className="loading">...</div> : professors.length === 0 ? (
              <div className="empty">No hay profesores</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {professors.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.email}</td>
                      <td><span className={`badge ${p.role === 'admin' ? 'badge-pending' : ''}`}>{p.role}</span></td>
                      <td><span className={`badge ${p.isActive ? 'badge-confirmed' : 'badge-cancelled'}`}>{p.isActive ? 'Activo' : 'Inactivo'}</span></td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleProfessor(p)}>
                          {p.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteProfessor(p.id)}>Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'bookings' && (
          <div className="card">
            <div className="card-title">Todas las reservas</div>
            {loading ? <div className="loading">...</div> : bookings.length === 0 ? (
              <div className="empty">No hay reservas</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Reunión</th><th>Profesor</th><th>Fecha</th><th>Duración</th><th>Estado</th><th>Zoom</th><th>Acciones</th></tr></thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.professor?.name || b.professor?.email || '—'}</td>
                      <td>{fmt(b.startTime)}</td>
                      <td>{b.durationMinutes} min</td>
                      <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                      <td>{b.zoomMeetingId || '—'}</td>
                      <td>
                        {b.status !== 'cancelled' && (
                          <button className="btn btn-danger btn-sm" onClick={() => cancelBooking(b.id)}>Cancelar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
