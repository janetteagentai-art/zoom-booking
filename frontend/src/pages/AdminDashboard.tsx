import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { zoomAccountsApi, adminApi, bookingsApi, ZoomAccount, Professor, Booking } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

const TIMEZONE = 'America/Buenos_Aires';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<'accounts' | 'professors' | 'bookings'>('accounts');
  const [accounts, setAccounts] = useState<ZoomAccount[]>([]);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddProfessor, setShowAddProfessor] = useState(false);
  const [accountLabel, setAccountLabel] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
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
        const { data } = await zoomAccountsApi.list();
        setAccounts(data);
      } else if (tab === 'professors') {
        const { data } = await adminApi.listProfessors();
        setProfessors(data);
      } else {
        const { data } = await bookingsApi.list();
        setBookings(data);
      }
    } catch {}
    setLoading(false);
  };

  const addAccount = async () => {
    try {
      await zoomAccountsApi.create({ label: accountLabel, email: accountEmail });
      setMsg({ type: 'ok', text: 'Cuenta agregada' });
      setAccountLabel(''); setAccountEmail('');
      setShowAddAccount(false);
      loadAll();
    } catch (err: any) {
      const msg = err.response?.data?.error;
      setMsg({ type: 'error', text: Array.isArray(msg) ? msg.map((e: any) => e.message).join(', ') : (msg || 'Error') });
    }
  };

  const toggleAccount = async (acc: ZoomAccount) => {
    await zoomAccountsApi.update(acc.id, { isActive: !acc.isActive });
    loadAll();
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('¿Eliminar esta cuenta?')) return;
    await zoomAccountsApi.delete(id);
    loadAll();
  };

  const addProfessor = async () => {
    try {
      await adminApi.createProfessor({ email: profEmail, password: profPassword, name: profName, role: profRole });
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
    await adminApi.updateProfessor(p.id, { isActive: !p.isActive });
    loadAll();
  };

  const deleteProfessor = async (id: string) => {
    if (!confirm('¿Eliminar este profesor?')) return;
    await adminApi.deleteProfessor(id);
    loadAll();
  };

  const fmt = (d: string) => formatInTimeZone(parseISO(d), TIMEZONE, 'dd/MM/yyyy HH:mm');

  return (
    <div>
      <div className="navbar">
        <span className="navbar-brand">📹 ReservaZoom — Admin</span>
        <div className="navbar-user">
          <span>{user?.name}</span>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Salir</button>
        </div>
      </div>

      <div className="container">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {(['accounts', 'professors', 'bookings'] as const).map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
              {t === 'accounts' ? '📹 Cuentas Zoom' : t === 'professors' ? '👨‍🏫 Profesores' : '📅 Reservas'}
            </button>
          ))}
        </div>

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
                <div className="form-group">
                  <label>Nombre / Label</label>
                  <input value={accountLabel} onChange={e => setAccountLabel(e.target.value)} placeholder="Ej: Cuenta 1 - Matemática" />
                </div>
                <div className="form-group">
                  <label>Email Zoom (opcional)</label>
                  <input type="email" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} placeholder="zoom@universidad.edu" />
                </div>
                <button className="btn btn-primary" onClick={addAccount}>Guardar</button>
              </div>
            )}

            {loading ? <div className="loading">...</div> : accounts.length === 0 ? (
              <div className="empty">No hay cuentas cargadas</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Label</th><th>Email</th><th>Estado</th><th>Acciones</th></tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id}>
                      <td>{a.label}</td>
                      <td>{a.email || '—'}</td>
                      <td>
                        <span className={`badge ${a.isActive ? 'badge-confirmed' : 'badge-cancelled'}`}>
                          {a.isActive ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem' }}>
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
                <thead><tr><th>Reunión</th><th>Profesor</th><th>Fecha</th><th>Duración</th><th>Estado</th><th>Zoom ID</th></tr></thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td>{b.title}</td>
                      <td>{b.professor?.name || b.professor?.email || '—'}</td>
                      <td>{fmt(b.startTime)}</td>
                      <td>{b.durationMinutes} min</td>
                      <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                      <td>{b.zoomMeetingId || '—'}</td>
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
