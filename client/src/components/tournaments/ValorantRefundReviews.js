import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
const dataOf = response => response.data?.data || response.data || response;

export default function ValorantRefundReviews({ role }) {
  const [rows, setRows] = useState([]), [page, setPage] = useState(1), [hasNext, setHasNext] = useState(false);
  const [reason, setReason] = useState(''), [refundId, setRefundId] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const load = useCallback(async () => {
    if (role !== 'admin') return;
    setBusy(true);
    try { const data = dataOf(await api.get(`/api/valorant-payments/refund-reviews?page=${page}`)); setRows(data.reviews || []); setHasNext(Boolean(data.hasNext)); }
    catch { setError('Could not load refund reviews'); }
    finally { setBusy(false); }
  }, [role, page]);
  useEffect(() => { load(); }, [load]);
  if (role !== 'admin') return null;
  const act = async (row, decision) => {
    setBusy(true); setError('');
    try { await api.post(`/api/valorant-payments/refund-reviews/${row._id}`, { decision, reason, refundId }); await load(); }
    catch (err) { setError(err.message || 'Review update failed'); }
    finally { setBusy(false); }
  };
  return <section className="card-gaming p-4 space-y-3" aria-label="Refund reviews">
    <h2>Manual refund reviews</h2>
    <p>Approval does not issue a refund. An authorized administrator must refund through Razorpay Dashboard, then verify the provider outcome here. Full refunds only.</p>
    <label className="block">Refund decision reason<input className="block input-gaming" value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label>
    <label className="block">Razorpay refund ID<input className="block input-gaming" value={refundId} onChange={e => setRefundId(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    {!rows.length && <p>No refund reviews on this page.</p>}
    {rows.map(row => <article key={row._id} className="border p-3">
      <p>{row.reason}: {row.status} — ₹{(row.paymentOrder?.amountMinor || 0) / 100}</p>
      <p>Payment: {row.paymentOrder?.gatewayPaymentId || 'Provider reconciliation required'}</p>
      {row.decisionReason && <p>{row.decisionReason}</p>}
      {row.status === 'requested' && <div className="flex flex-wrap gap-3">
        <button disabled={busy || !reason.trim()} onClick={() => act(row, 'approve')}>Approve refund review</button>
        <button disabled={busy || !reason.trim()} onClick={() => act(row, 'decline')}>Decline refund review</button>
      </div>}
      {row.status === 'approved' && <button disabled={busy || !/^rfnd_\w+$/.test(refundId)} onClick={() => act(row, 'check_refund')}>Verify Razorpay refund</button>}
      {row.providerStatus && <p>Provider refund status: {row.providerStatus}</p>}
    </article>)}
    <button disabled={busy || page === 1} onClick={() => setPage(p => p - 1)}>Previous reviews</button>
    <button disabled={busy || !hasNext} onClick={() => setPage(p => p + 1)}>Next reviews</button>
  </section>;
}
