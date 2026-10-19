import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';
import api from '../../services/api';

export default function ValorantRegistrationStatus({ tournamentId, revision, onChanged }) {
  const { isAuthenticated } = useSelector(selectAuth);
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!isAuthenticated) { setRegistration(null); return; }
    api.get(`/api/valorant-registration/my-registrations?tournamentId=${encodeURIComponent(tournamentId)}`).then(response => {
      const data = response.data?.data || response.data || response;
      if (active) setRegistration((data.registrations || []).find(row =>
        String(row.tournamentId?._id || row.tournamentId) === String(tournamentId) && ['pending', 'images_uploaded', 'verified'].includes(row.status)) || null);
    }).catch(() => { if (active) setError('Could not load your Valorant registration'); });
    return () => { active = false; };
  }, [isAuthenticated, tournamentId, revision]);
  const cancel = async () => {
    setBusy(true); setError('');
    try {
      await api.post(`/api/valorant-registration/${registration._id}/cancel`, {});
      setRegistration(null);
      await onChanged();
    } catch (err) { setError(err.message || 'Cancellation failed'); }
    finally { setBusy(false); }
  };
  if (!registration && !error) return null;
  return <section className="card-gaming p-4 my-4" aria-label="Your Valorant registration">
    {registration && <p>Your team registration: {registration.status}</p>}
    {error && <p role="alert">{error}</p>}
    {registration?.status === 'pending' && <button className="btn-gaming mt-3" disabled={busy} onClick={cancel}>Cancel pending registration</button>}
  </section>;
}
