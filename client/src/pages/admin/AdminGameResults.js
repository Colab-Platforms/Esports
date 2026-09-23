import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { FiCheckCircle, FiEdit2, FiRefreshCw, FiSave, FiSlash, FiTarget } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { selectUser } from '../../store/slices/authSlice';

const emptyFreeFireRow = () => ({
  registrationId: '',
  placement: '',
  kills: '',
  placementPoints: '',
  killPoints: ''
});

const emptyValorantForm = {
  matchNumber: 1,
  map: '',
  serverRegion: '',
  teamARegistrationId: '',
  teamBRegistrationId: '',
  scoreA: '',
  scoreB: ''
};

const statusClass = {
  draft: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  verified: 'bg-green-500/15 text-green-300 border-green-500/30',
  void: 'bg-red-500/15 text-red-300 border-red-500/30'
};

const normalizeList = (response, key) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data?.[key])) return response.data[key];
  if (Array.isArray(response?.data?.data?.[key])) return response.data.data[key];
  if (Array.isArray(response?.[key])) return response[key];
  return [];
};

const normalizeTournaments = (response) => normalizeList(response, 'tournaments');
const normalizeRegistrations = (response) => normalizeList(response, 'registrations');
const normalizeResults = (response) => normalizeList(response, 'results');

const getTournamentId = (tournament) => tournament?._id || tournament?.id || '';

const readError = (error, fallback) => (
  error.response?.data?.error?.message || error.message || fallback
);

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  return Number(value);
};

const AdminGameResults = () => {
  const user = useSelector(selectUser);
  const canManage = user && ['admin', 'moderator'].includes(user.role);
  const [activeGame, setActiveGame] = useState('freefire');
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingResult, setEditingResult] = useState(null);
  const [freeFireForm, setFreeFireForm] = useState({
    lobbyNumber: 1,
    matchNumber: 1,
    map: '',
    teamResults: [emptyFreeFireRow()]
  });
  const [valorantForm, setValorantForm] = useState(emptyValorantForm);

  const gameTournaments = useMemo(
    () => tournaments.filter((tournament) => tournament.gameType === activeGame),
    [activeGame, tournaments]
  );

  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => getTournamentId(tournament) === selectedTournamentId),
    [selectedTournamentId, tournaments]
  );

  const registrationOptions = useMemo(
    () => registrations.map((registration) => ({
      id: registration._id || registration.id,
      label: `${registration.teamName} (${registration.tournamentId?.name || selectedTournament?.name || 'Tournament'})`,
      raw: registration
    })),
    [registrations, selectedTournament]
  );

  const winnerPreview = useMemo(() => {
    const scoreA = toNumber(valorantForm.scoreA);
    const scoreB = toNumber(valorantForm.scoreB);
    if (scoreA === undefined || scoreB === undefined) return 'Enter both scores';
    if (scoreA === scoreB) return 'Tie not supported';
    const winnerId = scoreA > scoreB ? valorantForm.teamARegistrationId : valorantForm.teamBRegistrationId;
    const winner = registrationOptions.find((option) => option.id === winnerId);
    return winner?.raw?.teamName || 'Select both teams';
  }, [registrationOptions, valorantForm]);

  useEffect(() => {
    const loadTournaments = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/api/tournaments?admin=true');
        const allTournaments = normalizeTournaments(response);
        const supported = allTournaments.filter((tournament) => ['freefire', 'valorant'].includes(tournament.gameType));
        setTournaments(supported);
      } catch (err) {
        setError(readError(err, 'Failed to load tournaments'));
      } finally {
        setLoading(false);
      }
    };

    loadTournaments();
  }, []);

  useEffect(() => {
    const firstForGame = tournaments.find((tournament) => tournament.gameType === activeGame);
    setSelectedTournamentId(firstForGame ? getTournamentId(firstForGame) : '');
    setEditingResult(null);
  }, [activeGame, tournaments]);

  useEffect(() => {
    if (!selectedTournamentId) {
      setRegistrations([]);
      setResults([]);
      return;
    }

    const loadContext = async () => {
      setRegistrationsLoading(true);
      setResultsLoading(true);
      setError('');
      try {
        const registrationEndpoint = activeGame === 'freefire'
          ? '/api/freefire-registration/admin/registrations'
          : '/api/valorant-registration/admin/registrations';
        const [registrationsResponse, resultsResponse] = await Promise.all([
          api.get(registrationEndpoint, {
            params: {
              tournamentId: selectedTournamentId,
              status: 'verified',
              limit: 100
            }
          }),
          activeGame === 'freefire'
            ? api.getFreeFireTournamentResults(selectedTournamentId, { admin: true })
            : api.getValorantTournamentResults(selectedTournamentId, { admin: true })
        ]);
        setRegistrations(normalizeRegistrations(registrationsResponse));
        setResults(normalizeResults(resultsResponse));
      } catch (err) {
        setError(readError(err, 'Failed to load result management context'));
      } finally {
        setRegistrationsLoading(false);
        setResultsLoading(false);
      }
    };

    loadContext();
  }, [activeGame, selectedTournamentId]);

  const refreshResults = async () => {
    if (!selectedTournamentId) return;
    setResultsLoading(true);
    try {
      const response = activeGame === 'freefire'
        ? await api.getFreeFireTournamentResults(selectedTournamentId, { admin: true })
        : await api.getValorantTournamentResults(selectedTournamentId, { admin: true });
      setResults(normalizeResults(response));
    } catch (err) {
      setError(readError(err, 'Failed to refresh results'));
    } finally {
      setResultsLoading(false);
    }
  };

  const resetForms = () => {
    setEditingResult(null);
    setFreeFireForm({
      lobbyNumber: 1,
      matchNumber: 1,
      map: '',
      teamResults: [emptyFreeFireRow()]
    });
    setValorantForm(emptyValorantForm);
  };

  const updateFreeFireRow = (index, key, value) => {
    setFreeFireForm((current) => ({
      ...current,
      teamResults: current.teamResults.map((row, rowIndex) => (
        rowIndex === index ? { ...row, [key]: value } : row
      ))
    }));
  };

  const addFreeFireRow = () => {
    setFreeFireForm((current) => ({
      ...current,
      teamResults: [...current.teamResults, emptyFreeFireRow()]
    }));
  };

  const removeFreeFireRow = (index) => {
    setFreeFireForm((current) => ({
      ...current,
      teamResults: current.teamResults.filter((_, rowIndex) => rowIndex !== index)
    }));
  };

  const buildFreeFirePayload = () => ({
    tournamentId: selectedTournamentId,
    lobbyNumber: toNumber(freeFireForm.lobbyNumber),
    matchNumber: toNumber(freeFireForm.matchNumber),
    map: freeFireForm.map.trim(),
    teamResults: freeFireForm.teamResults
      .filter((row) => row.registrationId)
      .map((row) => {
        const placementPoints = toNumber(row.placementPoints) ?? 0;
        const killPoints = toNumber(row.killPoints) ?? 0;
        return {
          registrationId: row.registrationId,
          placement: toNumber(row.placement),
          kills: toNumber(row.kills) ?? 0,
          placementPoints,
          killPoints,
          totalPoints: placementPoints + killPoints
        };
      })
  });

  const buildValorantPayload = () => ({
    tournamentId: selectedTournamentId,
    matchNumber: toNumber(valorantForm.matchNumber),
    map: valorantForm.map.trim(),
    serverRegion: valorantForm.serverRegion.trim(),
    teamA: {
      registrationId: valorantForm.teamARegistrationId,
      score: toNumber(valorantForm.scoreA)
    },
    teamB: {
      registrationId: valorantForm.teamBRegistrationId,
      score: toNumber(valorantForm.scoreB)
    }
  });

  const saveDraft = async () => {
    if (!canManage) return;
    setSaving(true);
    setError('');
    try {
      if (activeGame === 'freefire') {
        const payload = buildFreeFirePayload();
        if (editingResult) {
          await api.updateFreeFireResult(editingResult.id, payload);
        } else {
          await api.createFreeFireResult(payload);
        }
      } else {
        const payload = buildValorantPayload();
        if (editingResult) {
          await api.updateValorantResult(editingResult.id, payload);
        } else {
          await api.createValorantResult(payload);
        }
      }
      toast.success(editingResult ? 'Draft updated' : 'Draft saved');
      resetForms();
      await refreshResults();
    } catch (err) {
      setError(readError(err, 'Failed to save draft'));
    } finally {
      setSaving(false);
    }
  };

  const verifyResult = async (result) => {
    if (!canManage) return;
    setSaving(true);
    setError('');
    try {
      if (activeGame === 'freefire') {
        await api.verifyFreeFireResult(result.id);
      } else {
        await api.verifyValorantResult(result.id);
      }
      toast.success('Result verified');
      await refreshResults();
    } catch (err) {
      setError(readError(err, 'Failed to verify result'));
    } finally {
      setSaving(false);
    }
  };

  const voidResult = async (result) => {
    if (!canManage) return;
    if (!window.confirm('Void this result? It will be hidden from public history.')) return;
    setSaving(true);
    setError('');
    try {
      if (activeGame === 'freefire') {
        await api.voidFreeFireResult(result.id);
      } else {
        await api.voidValorantResult(result.id);
      }
      toast.success('Result voided');
      if (editingResult?.id === result.id) resetForms();
      await refreshResults();
    } catch (err) {
      setError(readError(err, 'Failed to void result'));
    } finally {
      setSaving(false);
    }
  };

  const editResult = (result) => {
    setEditingResult(result);
    if (activeGame === 'freefire') {
      setFreeFireForm({
        lobbyNumber: result.lobbyNumber || 1,
        matchNumber: result.matchNumber || 1,
        map: result.map || '',
        teamResults: (result.teamResults || []).map((teamResult) => ({
          registrationId: teamResult.registrationId,
          placement: teamResult.placement ?? '',
          kills: teamResult.kills ?? '',
          placementPoints: teamResult.placementPoints ?? '',
          killPoints: teamResult.killPoints ?? ''
        }))
      });
    } else {
      setValorantForm({
        matchNumber: result.matchNumber || 1,
        map: result.map || '',
        serverRegion: result.serverRegion || '',
        teamARegistrationId: result.teamA?.registrationId || '',
        teamBRegistrationId: result.teamB?.registrationId || '',
        scoreA: result.teamA?.score ?? '',
        scoreB: result.teamB?.score ?? ''
      });
    }
  };

  if (!canManage) {
    return (
      <div className="min-h-screen bg-gaming-dark p-6">
        <div className="max-w-4xl mx-auto card-gaming p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Result Management</h1>
          <p className="text-gray-400">Admin or moderator access is required to manage match results.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gaming-dark p-6">
        <LoadingSpinner size="lg" text="Loading result management..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-gaming font-bold text-white">Match Result Management</h1>
            <p className="text-gray-400 mt-1">Create, verify, and void authoritative Free Fire and Valorant results.</p>
          </div>
          <button
            type="button"
            onClick={refreshResults}
            disabled={resultsLoading}
            className="btn btn-secondary inline-flex items-center gap-2"
          >
            <FiRefreshCw className={resultsLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="card-gaming p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Game</label>
              <div className="grid grid-cols-2 gap-2">
                {['freefire', 'valorant'].map((game) => (
                  <button
                    key={game}
                    type="button"
                    onClick={() => setActiveGame(game)}
                    className={`rounded-lg border px-4 py-2 font-semibold capitalize transition-colors ${
                      activeGame === game
                        ? 'border-gaming-gold bg-gaming-gold/15 text-gaming-gold'
                        : 'border-gaming-border bg-gaming-charcoal text-gray-300 hover:border-gaming-gold/50'
                    }`}
                  >
                    {game === 'freefire' ? 'Free Fire' : 'Valorant'}
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-2">Tournament context</label>
              <select
                value={selectedTournamentId}
                onChange={(event) => {
                  setSelectedTournamentId(event.target.value);
                  resetForms();
                }}
                className="input-gaming w-full"
              >
                {gameTournaments.length === 0 ? (
                  <option value="">No tournaments available</option>
                ) : (
                  gameTournaments.map((tournament) => (
                    <option key={getTournamentId(tournament)} value={getTournamentId(tournament)}>
                      {tournament.name} - {tournament.status}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!selectedTournamentId ? (
          <div className="card-gaming p-8 text-center text-gray-400">
            No {activeGame === 'freefire' ? 'Free Fire' : 'Valorant'} tournament found.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <section className="xl:col-span-2 card-gaming p-5">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-white">{editingResult ? 'Edit Draft' : 'Create Draft'}</h2>
                  <p className="text-sm text-gray-400">{selectedTournament?.name}</p>
                </div>
                {editingResult && (
                  <button type="button" onClick={resetForms} className="btn btn-ghost btn-sm">New</button>
                )}
              </div>

              {registrationsLoading ? (
                <LoadingSpinner size="md" text="Loading verified registrations..." />
              ) : registrationOptions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gaming-border bg-gaming-dark/60 p-5 text-center text-gray-400">
                  No verified registrations are available for this tournament.
                </div>
              ) : activeGame === 'freefire' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Lobby number</span>
                      <input type="number" min="1" className="input-gaming w-full" value={freeFireForm.lobbyNumber} onChange={(e) => setFreeFireForm((current) => ({ ...current, lobbyNumber: e.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Match number</span>
                      <input type="number" min="1" className="input-gaming w-full" value={freeFireForm.matchNumber} onChange={(e) => setFreeFireForm((current) => ({ ...current, matchNumber: e.target.value }))} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="block text-sm text-gray-400 mb-1">Map</span>
                    <input className="input-gaming w-full" value={freeFireForm.map} onChange={(e) => setFreeFireForm((current) => ({ ...current, map: e.target.value }))} placeholder="Optional" />
                  </label>

                  <div className="space-y-3">
                    {freeFireForm.teamResults.map((row, index) => {
                      const total = (toNumber(row.placementPoints) ?? 0) + (toNumber(row.killPoints) ?? 0);
                      return (
                        <div key={index} className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-3">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <p className="font-semibold text-white">Team result {index + 1}</p>
                            {freeFireForm.teamResults.length > 1 && (
                              <button type="button" onClick={() => removeFreeFireRow(index)} className="text-sm text-red-300 hover:text-red-200">Remove</button>
                            )}
                          </div>
                          <select className="input-gaming w-full mb-3" value={row.registrationId} onChange={(e) => updateFreeFireRow(index, 'registrationId', e.target.value)}>
                            <option value="">Select verified registration</option>
                            {registrationOptions.map((option) => (
                              <option key={option.id} value={option.id}>{option.raw.teamName}</option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-3">
                            <input type="number" min="1" className="input-gaming" placeholder="Placement" value={row.placement} onChange={(e) => updateFreeFireRow(index, 'placement', e.target.value)} />
                            <input type="number" min="0" className="input-gaming" placeholder="Kills" value={row.kills} onChange={(e) => updateFreeFireRow(index, 'kills', e.target.value)} />
                            <input type="number" min="0" className="input-gaming" placeholder="Placement points" value={row.placementPoints} onChange={(e) => updateFreeFireRow(index, 'placementPoints', e.target.value)} />
                            <input type="number" min="0" className="input-gaming" placeholder="Kill points" value={row.killPoints} onChange={(e) => updateFreeFireRow(index, 'killPoints', e.target.value)} />
                          </div>
                          <div className="mt-3 rounded-lg bg-gaming-dark/70 px-3 py-2 text-sm text-gray-300">
                            Total points: <span className="font-bold text-white">{total}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" onClick={addFreeFireRow} className="btn btn-secondary w-full">Add team result</button>
                  <button type="button" onClick={saveDraft} disabled={saving} className="btn btn-primary w-full inline-flex items-center justify-center gap-2">
                    <FiSave /> {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block">
                    <span className="block text-sm text-gray-400 mb-1">Match number</span>
                    <input type="number" min="1" className="input-gaming w-full" value={valorantForm.matchNumber} onChange={(e) => setValorantForm((current) => ({ ...current, matchNumber: e.target.value }))} />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Map</span>
                      <input className="input-gaming w-full" value={valorantForm.map} onChange={(e) => setValorantForm((current) => ({ ...current, map: e.target.value }))} placeholder="Optional" />
                    </label>
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Server region</span>
                      <input className="input-gaming w-full" value={valorantForm.serverRegion} onChange={(e) => setValorantForm((current) => ({ ...current, serverRegion: e.target.value }))} placeholder="Optional" />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Team A</span>
                      <select className="input-gaming w-full" value={valorantForm.teamARegistrationId} onChange={(e) => setValorantForm((current) => ({ ...current, teamARegistrationId: e.target.value }))}>
                        <option value="">Select verified team</option>
                        {registrationOptions.map((option) => (
                          <option key={option.id} value={option.id}>{option.raw.teamName}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Team B</span>
                      <select className="input-gaming w-full" value={valorantForm.teamBRegistrationId} onChange={(e) => setValorantForm((current) => ({ ...current, teamBRegistrationId: e.target.value }))}>
                        <option value="">Select verified team</option>
                        {registrationOptions.map((option) => (
                          <option key={option.id} value={option.id}>{option.raw.teamName}</option>
                        ))}
                      </select>
                    </label>
                    <input type="number" min="0" className="input-gaming" placeholder="Score A" value={valorantForm.scoreA} onChange={(e) => setValorantForm((current) => ({ ...current, scoreA: e.target.value }))} />
                    <input type="number" min="0" className="input-gaming" placeholder="Score B" value={valorantForm.scoreB} onChange={(e) => setValorantForm((current) => ({ ...current, scoreB: e.target.value }))} />
                  </div>
                  <div className="rounded-lg border border-gaming-border bg-gaming-dark/70 p-3 text-sm text-gray-300">
                    Winner: <span className="font-bold text-white">{winnerPreview}</span>
                  </div>
                  <button type="button" onClick={saveDraft} disabled={saving} className="btn btn-primary w-full inline-flex items-center justify-center gap-2">
                    <FiSave /> {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                </div>
              )}
            </section>

            <section className="xl:col-span-3 card-gaming p-5">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-white">Existing Results</h2>
                  <p className="text-sm text-gray-400">Drafts are admin-only. Verified results are public. Void results are excluded from public history.</p>
                </div>
                <FiTarget className="text-gaming-gold h-6 w-6" />
              </div>

              {resultsLoading ? (
                <LoadingSpinner size="md" text="Loading results..." />
              ) : results.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gaming-border bg-gaming-dark/60 p-8 text-center text-gray-400">
                  No results entered for this tournament yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((result) => (
                    <div key={result.id} className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-white font-bold">
                              {activeGame === 'freefire'
                                ? `Lobby ${result.lobbyNumber}, Match ${result.matchNumber}`
                                : `Match ${result.matchNumber}`}
                            </h3>
                            <span className={`border rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusClass[result.status] || statusClass.draft}`}>
                              {result.status}
                            </span>
                          </div>
                          {result.map && <p className="text-sm text-gray-400 mt-1">Map: {result.map}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.status !== 'void' && (
                            <button type="button" onClick={() => editResult(result)} className="btn btn-ghost btn-sm inline-flex items-center gap-1">
                              <FiEdit2 /> Edit
                            </button>
                          )}
                          {result.status === 'draft' && (
                            <button type="button" onClick={() => verifyResult(result)} disabled={saving} className="btn btn-secondary btn-sm inline-flex items-center gap-1">
                              <FiCheckCircle /> Verify
                            </button>
                          )}
                          {result.status !== 'void' && (
                            <button type="button" onClick={() => voidResult(result)} disabled={saving} className="btn btn-danger btn-sm inline-flex items-center gap-1">
                              <FiSlash /> Void
                            </button>
                          )}
                        </div>
                      </div>

                      {activeGame === 'freefire' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                          {(result.teamResults || []).map((teamResult) => (
                            <div key={teamResult.registrationId} className="rounded-lg bg-gaming-dark/60 p-3 text-sm">
                              <p className="font-semibold text-white">{teamResult.teamName}</p>
                              <p className="text-gray-400">
                                Placement #{teamResult.placement} - {teamResult.kills} kills - {teamResult.totalPoints} pts
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 rounded-lg bg-gaming-dark/60 p-3 text-sm">
                          <p className="text-white font-semibold">
                            {result.teamA?.teamName} {result.teamA?.score} - {result.teamB?.score} {result.teamB?.teamName}
                          </p>
                          <p className="text-gray-400">Winner is derived by the server from the submitted score.</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGameResults;
