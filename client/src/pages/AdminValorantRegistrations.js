import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

const STATUS_OPTIONS = ['all', 'pending', 'verified', 'rejected'];

const AdminValorantRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 50 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await api.get('/api/valorant-registration/admin/registrations', { params });
      const data = response.data || response;
      setRegistrations(data.data?.registrations || []);
      setStats(data.data?.stats || { total: 0, pending: 0, verified: 0, rejected: 0 });
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to load Valorant registrations');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const updateStatus = async (registrationId, status, reason) => {
    setError('');
    setSuccess('');
    try {
      await api.put(`/api/valorant-registration/admin/${registrationId}/status`, {
        status,
        ...(reason && { rejectionReason: reason })
      });
      setSuccess(`Registration ${status} successfully`);
      setRejectingId(null);
      setRejectionReason('');
      fetchRegistrations();
    } catch (err) {
      setError(err.response?.data?.error?.message || `Failed to mark registration as ${status}`);
    }
  };

  const riotIdLabel = (riotId) => {
    if (!riotId || !riotId.name || !riotId.tag) return '—';
    return `${riotId.name}#${riotId.tag}`;
  };

  return (
    <div className="min-h-screen bg-gaming-dark p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center space-x-2">
          <span>🎯</span>
          <span>Valorant Registrations</span>
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Pending', value: stats.pending },
            { label: 'Verified', value: stats.verified },
            { label: 'Rejected', value: stats.rejected }
          ].map((s) => (
            <div key={s.label} className="card-gaming p-4 text-center">
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded text-sm font-medium border ${
                statusFilter === s
                  ? 'bg-red-500/20 border-red-500 text-red-400'
                  : 'bg-white/5 border-white/20 text-gray-300'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4 text-green-400 text-sm">{success}</div>
        )}

        {loading ? (
          <LoadingSpinner size="lg" text="Loading registrations..." />
        ) : registrations.length === 0 ? (
          <div className="card-gaming p-8 text-center text-gray-400">No Valorant registrations found.</div>
        ) : (
          <div className="space-y-4">
            {registrations.map((reg) => (
              <div key={reg._id} className="card-gaming p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-bold text-lg">{reg.teamName}</h3>
                    <p className="text-gray-400 text-sm">{reg.tournamentId?.name}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    reg.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                    reg.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {reg.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-4">
                  <div className="text-gray-300">
                    <span className="text-red-400 font-semibold">Captain:</span> {reg.teamLeader?.name} ({riotIdLabel(reg.teamLeader?.riotId)})
                  </div>
                  {reg.teamMembers?.map((m, i) => (
                    <div key={i} className="text-gray-300">
                      <span className="text-red-400 font-semibold">Player {i + 2}:</span> {m.name} ({riotIdLabel(m.riotId)})
                    </div>
                  ))}
                  {reg.substitutePlayer && (
                    <div className="text-gray-300">
                      <span className="text-red-400 font-semibold">Substitute:</span> {reg.substitutePlayer.name} ({riotIdLabel(reg.substitutePlayer.riotId)})
                    </div>
                  )}
                  <div className="text-gray-400">WhatsApp: {reg.whatsappNumber}</div>
                </div>

                {reg.status !== 'verified' && rejectingId !== reg._id && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => updateStatus(reg._id, 'verified')}
                      className="px-3 py-1.5 bg-green-500/20 border border-green-500 text-green-400 rounded text-sm font-medium hover:bg-green-500/30"
                    >
                      ✓ Verify
                    </button>
                    <button
                      onClick={() => setRejectingId(reg._id)}
                      className="px-3 py-1.5 bg-red-500/20 border border-red-500 text-red-400 rounded text-sm font-medium hover:bg-red-500/30"
                    >
                      ✕ Reject
                    </button>
                  </div>
                )}

                {rejectingId === reg._id && (
                  <div className="space-y-2 mt-2">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Rejection reason (min 5 characters)"
                      className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded text-white text-sm"
                    />
                    <div className="flex space-x-2">
                      <button
                        onClick={() => updateStatus(reg._id, 'rejected', rejectionReason)}
                        disabled={rejectionReason.trim().length < 5}
                        className="px-3 py-1.5 bg-red-500 text-white rounded text-sm font-medium disabled:opacity-50"
                      >
                        Confirm Reject
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                        className="px-3 py-1.5 bg-gaming-slate text-white rounded text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {reg.status === 'verified' && (
                  <div className="text-xs text-green-400">Verified by {reg.verifiedBy?.username || 'admin'}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminValorantRegistrations;
