import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';
import api from '../../services/api';
import ValorantRefundReviews from '../../components/tournaments/ValorantRefundReviews';

const dataOf = response => response.data?.data || response.data || response;
export default function AdminValorantRegistrations() {
  const { user } = useSelector(selectAuth);
  const canManage = ['admin', 'moderator'].includes(user?.role);
  const [tournaments, setTournaments] = useState([]);
  const [selected, setSelected] = useState('');
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!canManage) return;
    let active = true;
    api.get('/api/tournaments?admin=true&gameType=valorant&limit=100').then(response => {
      if (active) setTournaments((dataOf(response).tournaments || []).filter(t => t.gameType === 'valorant'));
    }).catch(() => { if (active) setError('Could not load tournaments'); });
    return () => { active = false; };
  }, [canManage]);
  const load = useCallback(async () => {
    if (!selected || !canManage) { setRows([]); return; }
    setBusy(true); setError('');
    try {
      const data = dataOf(await api.get(`/api/valorant-registration/admin/tournament/${selected}?page=${page}`));
      setRows(data.registrations || []); setHasNext(Boolean(data.pagination?.hasNext));
    }
    catch (err) { setError(err.message || 'Could not load registrations'); }
    finally { setBusy(false); }
  }, [selected, canManage, page]);
  useEffect(() => { load(); }, [load]);
  const actOnRegistration = async (row, action) => {
    setBusy(true); setError('');
    try { await api.post(`/api/valorant-registration/${row._id}/${action}`, { reason }); await load(); }
    catch (err) { setError(err.message || 'Registration update failed'); }
    finally { setBusy(false); }
  };
  if (!canManage) return <p className="p-6">Admin or moderator access is required.</p>;
  return <main className="max-w-5xl mx-auto p-6 space-y-4">
    <h1 className="text-2xl font-bold">Valorant Registrations</h1>
    <p>Verify saved rosters before publishing competitive results. Paid entries require captured payment.</p>
    <ValorantRefundReviews role={user?.role} />
    <label className="block">Tournament
      <select className="block bg-gaming-dark border p-2" value={selected} onChange={e => { setSelected(e.target.value); setPage(1); }} disabled={busy}>
        <option value="">Select tournament</option>
        {tournaments.map(t => <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>)}
      </select>
    </label>
    <label className="block">Rejection reason
      <input className="block bg-gaming-dark border p-2 w-full" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} />
    </label>
    {error && <p role="alert">{error}</p>}
    {!rows.length && selected && !busy && <p>No registrations found.</p>}
    {rows.map(row => <section key={row._id} className="card-gaming p-4 space-y-2">
      <h2>{row.teamName} — {row.status}</h2>
      <ul>{(row.roster || []).map(member => <li key={member.userId}>{member.username}: {member.riotId} ({member.role})</li>)}</ul>
      {row.rejectionReason && <p>{row.rejectionReason}</p>}
      {row.payment?.status === 'paid' && <p>Payment captured: ₹{row.payment.amountMinor / 100}. Rejection opens manual refund review.</p>}
      {['pending', 'images_uploaded'].includes(row.status) && <div className="flex gap-3">
        <button className="btn-gaming" disabled={busy} onClick={() => actOnRegistration(row, 'verify')}>Verify roster</button>
        <button className="btn-gaming" disabled={busy || !reason.trim()} onClick={() => actOnRegistration(row, 'reject')}>Reject registration</button>
      </div>}
    </section>)}
    {selected && <div className="flex gap-3">
      <button disabled={busy || page === 1} onClick={() => setPage(previous => previous - 1)}>Previous page</button>
      <span>Page {page}</span>
      <button disabled={busy || !hasNext} onClick={() => setPage(previous => previous + 1)}>Next page</button>
    </div>}
  </main>;
}
