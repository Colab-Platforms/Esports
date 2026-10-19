import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';
import api from '../../services/api';

export default function ValorantRegistrationStatus({ tournamentId, revision, onChanged }) {
  const { isAuthenticated } = useSelector(selectAuth);
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [attempt, setAttempt] = useState(null);
  useEffect(() => {
    let active = true;
    if (!isAuthenticated) { setRegistration(null); setAttempt(null); return; }
    api.get(`/api/valorant-registration/my-registrations?tournamentId=${encodeURIComponent(tournamentId)}`).then(response => {
      const data = response.data?.data || response.data || response;
      const rows = (data.registrations || []).filter(row => String(row.tournamentId?._id || row.tournamentId) === String(tournamentId));
      if (active) setRegistration(rows.find(row => ['pending', 'images_uploaded', 'verified'].includes(row.status)) || rows.find(row => row.payment?.status === 'paid') || null);
    }).catch(() => { if (active) setError('Could not load your Valorant registration'); });
    api.get(`/api/valorant-payments/my-attempts?tournamentId=${encodeURIComponent(tournamentId)}`).then(response => {
      const data = response.data?.data || response.data || response;
      if (active) setAttempt(data.attempts?.[0] || null);
    }).catch(() => { if (active) setError('Could not load payment status; refresh before paying again'); });
    return () => { active = false; };
  }, [isAuthenticated, tournamentId, revision, refresh]);
  const cancel = async () => {
    setBusy(true); setError('');
    try {
      await api.post(`/api/valorant-registration/${registration._id}/cancel`, {});
      setRegistration(null); setRefresh(value => value + 1);
      await onChanged();
    } catch (err) { setError(err.message || 'Cancellation failed'); }
    finally { setBusy(false); }
  };
  if (!registration && !attempt && !error) return null;
  return <section className="card-gaming p-4 my-4" aria-label="Your Valorant registration">
    {registration && <p>Your team registration: {registration.status}</p>}
    {registration?.payment?.status === 'paid' && <p>Payment captured: ₹{registration.payment.amountMinor / 100}. Cancellation opens manual refund review; it does not automatically issue a refund.</p>}
    {registration?.receipt && <p>Receipt: {registration.receipt.receiptNumber}</p>}
    {registration?.refundReview && <p>Refund review: {registration.refundReview.status}{registration.refundReview.providerStatus ? ` (${registration.refundReview.providerStatus})` : ''}</p>}
    {!registration && attempt && <p>Payment reservation: {attempt.status}. {attempt.status === 'capture_late_review' ? 'Manual refund review is required; do not pay again.' : 'Checkout holds a slot for up to ten minutes. Refresh status before retrying payment.'}</p>}
    {error && <p role="alert">{error}</p>}
    {registration?.status === 'pending' && <button className="btn-gaming mt-3" disabled={busy} onClick={cancel}>Cancel pending registration</button>}
    <button className="btn-gaming mt-3" disabled={busy} onClick={() => { setError(''); setRefresh(value => value + 1); }}>Refresh registration and payment status</button>
  </section>;
}
