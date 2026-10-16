import { useCallback } from 'react';
import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { FiAward, FiCheckCircle, FiEdit2, FiRefreshCw, FiSave, FiSlash, FiTarget } from 'react-icons/fi';
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
const emptyManualTop10 = () => Array.from({
  length: 10
}, (_, index) => ({
  rank: index + 1,
  registrationId: '',
  matchesPlayed: '',
  kills: '',
  placementPoints: '',
  killPoints: '',
  totalPoints: '',
  wins: '',
  losses: '',
  roundsFor: '',
  roundsAgainst: ''
}));
const statusClass = {
  draft: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  verified: 'bg-green-500/15 text-green-300 border-green-500/30',
  void: 'bg-red-500/15 text-red-300 border-red-500/30'
};
const gameOptions = [{
  id: 'bgmi',
  label: 'BGMI'
}, {
  id: 'freefire',
  label: 'Free Fire'
}, {
  id: 'valorant',
  label: 'Valorant'
}];
const normalizeList = (response, key) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data?.[key])) return response.data[key];
  if (Array.isArray(response?.data?.data?.[key])) return response.data.data[key];
  if (Array.isArray(response?.[key])) return response[key];
  return [];
};
const normalizeTournaments = response => normalizeList(response, 'tournaments');
const normalizeRegistrations = response => normalizeList(response, 'registrations');
const normalizeResults = response => normalizeList(response, 'results');
const normalizeFinalResult = (response, key = 'finalResult') => response?.data?.[key] || response?.data?.data?.[key] || response?.[key] || null;
const getTournamentId = tournament => tournament?._id || tournament?.id || '';
const readError = (error, fallback) => error.response?.data?.error?.message || error.message || fallback;
const toNumber = value => {
  if (value === '' || value === null || value === undefined) return undefined;
  return Number(value);
};
const displayStat = value => value === null || value === undefined ? '-' : value;
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
  const [finalResult, setFinalResult] = useState(null);
  const [finalPreview, setFinalPreview] = useState(null);
  const [finalLoading, setFinalLoading] = useState(false);
  const [finalSaving, setFinalSaving] = useState(false);
  const [manualTop10, setManualTop10] = useState(emptyManualTop10);
  const [error, setError] = useState('');
  const [editingResult, setEditingResult] = useState(null);
  const [freeFireForm, setFreeFireForm] = useState({
    lobbyNumber: 1,
    matchNumber: 1,
    map: '',
    teamResults: [emptyFreeFireRow()]
  });
  const [valorantForm, setValorantForm] = useState(emptyValorantForm);
  const gameTournaments = useMemo(() => tournaments.filter(tournament => tournament.gameType === activeGame), [activeGame, tournaments]);
  const selectedTournament = useMemo(() => tournaments.find(tournament => getTournamentId(tournament) === selectedTournamentId), [selectedTournamentId, tournaments]);
  const registrationOptions = useMemo(() => registrations.map(registration => ({
    id: registration._id || registration.id,
    label: `${registration.teamName} (${registration.tournamentId?.name || selectedTournament?.name || 'Tournament'})`,
    raw: registration
  })), [registrations, selectedTournament]);
  const selectedManualRegistrationIds = useMemo(() => new Set(manualTop10.map(entry => entry.registrationId).filter(Boolean)), [manualTop10]);
  const manualStandingsPayload = useMemo(() => manualTop10.filter(entry => entry.registrationId).map(entry => ({
    rank: entry.rank,
    registrationId: entry.registrationId,
    matchesPlayed: entry.matchesPlayed,
    kills: entry.kills,
    placementPoints: entry.placementPoints,
    killPoints: entry.killPoints,
    totalPoints: entry.totalPoints,
    wins: entry.wins,
    losses: entry.losses,
    roundsFor: entry.roundsFor,
    roundsAgainst: entry.roundsAgainst
  })), [manualTop10]);
  const hasManualTop10 = manualStandingsPayload.length > 0;
  const rosterSummary = registration => {
    const leader = registration?.teamLeader?.name;
    const memberCount = registration?.teamMembers?.length || 0;
    const substituteCount = registration?.substitutePlayer?.name ? 1 : 0;
    const total = (leader ? 1 : 0) + memberCount + substituteCount;
    return [leader ? `Captain: ${leader}` : '', total ? `${total} players` : 'Roster snapshot available'].filter(Boolean).join(' • ');
  };
  const updateManualTop10 = (index, key, value) => {
    setManualTop10(current => current.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      [key]: value
    } : item));
  };
  const winnerPreview = useMemo(() => {
    const scoreA = toNumber(valorantForm.scoreA);
    const scoreB = toNumber(valorantForm.scoreB);
    if (scoreA === undefined || scoreB === undefined) return 'Enter both scores';
    if (scoreA === scoreB) return 'Tie not supported';
    const winnerId = scoreA > scoreB ? valorantForm.teamARegistrationId : valorantForm.teamBRegistrationId;
    const winner = registrationOptions.find(option => option.id === winnerId);
    return winner?.raw?.teamName || 'Select both teams';
  }, [registrationOptions, valorantForm]);
  useEffect(() => {
    const loadTournaments = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/api/tournaments?admin=true');
        const allTournaments = normalizeTournaments(response);
        const supported = allTournaments.filter(tournament => ['bgmi', 'freefire', 'valorant'].includes(tournament.gameType));
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
    const firstForGame = tournaments.find(tournament => tournament.gameType === activeGame);
    setSelectedTournamentId(firstForGame ? getTournamentId(firstForGame) : '');
    setEditingResult(null);
    setManualTop10(emptyManualTop10());
  }, [activeGame, tournaments]);
  const refreshFinalResult = useCallback(async (tournamentId = selectedTournamentId) => {
    if (!tournamentId) return;
    setFinalLoading(true);
    try {
      const response = await api.getAdminTournamentFinalResult(tournamentId);
      setFinalResult(normalizeFinalResult(response));
    } catch (err) {
      setError(readError(err, 'Failed to load final result'));
    } finally {
      setFinalLoading(false);
    }
  }, [selectedTournamentId]);
  useEffect(() => {
    let active = true;
    setFinalPreview(null);
    setFinalResult(null);
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
        const registrationEndpoint = `/api/admin/tournaments/${selectedTournamentId}/result-registrations`;
        const [registrationsResponse, resultsResponse, finalResponse] = await Promise.all([api.get(registrationEndpoint, {
          params: {
            tournamentId: selectedTournamentId,
            status: 'verified',
            limit: 100
          }
        }), activeGame === 'freefire' ? api.getFreeFireTournamentResults(selectedTournamentId, {
          admin: true
        }) : activeGame === 'valorant' ? api.getValorantTournamentResults(selectedTournamentId, {
          admin: true
        }) : Promise.resolve({
          data: {
            results: []
          }
        }), api.getAdminTournamentFinalResult(selectedTournamentId)]);
        if (!active) return;
        setRegistrations(normalizeRegistrations(registrationsResponse));
        setResults(normalizeResults(resultsResponse));
        setFinalResult(normalizeFinalResult(finalResponse));
      } catch (err) {
        if (active) setError(readError(err, 'Failed to load result management context'));
      } finally {
        if (active) {
          setRegistrationsLoading(false);
          setResultsLoading(false);
        }
      }
    };
    loadContext();
    return () => { active = false; };
  }, [activeGame, selectedTournamentId]);
  const refreshResults = async () => {
    if (!selectedTournamentId) return;
    setResultsLoading(true);
    try {
      const response = activeGame === 'freefire' ? await api.getFreeFireTournamentResults(selectedTournamentId, {
        admin: true
      }) : activeGame === 'valorant' ? await api.getValorantTournamentResults(selectedTournamentId, {
        admin: true
      }) : {
        data: {
          results: []
        }
      };
      setResults(normalizeResults(response));
    } catch (err) {
      setError(readError(err, 'Failed to refresh results'));
    } finally {
      setResultsLoading(false);
    }
  };
  const previewFinalResult = async () => {
    if (!selectedTournamentId) return;
    setFinalLoading(true);
    setError('');
    try {
      const response = await api.previewTournamentFinalResult(selectedTournamentId, hasManualTop10 ? {
        standings: manualStandingsPayload
      } : null);
      setFinalPreview(normalizeFinalResult(response, 'preview'));
    } catch (err) {
      setError(readError(err, 'Failed to preview final standings'));
    } finally {
      setFinalLoading(false);
    }
  };
  const publishFinalResult = async () => {
    if (!selectedTournamentId || !canManage) return;
    if (!window.confirm('Publish these tournament final results? Public pages and profiles will use this snapshot.')) return;
    setFinalSaving(true);
    setError('');
    try {
      const payload = hasManualTop10 ? {
        standings: manualStandingsPayload
      } : {};
      const response = await api.publishTournamentFinalResult(selectedTournamentId, payload);
      setFinalResult(normalizeFinalResult(response));
      setFinalPreview(null);
      toast.success('Final results published');
    } catch (err) {
      setError(readError(err, 'Failed to publish final results'));
    } finally {
      setFinalSaving(false);
    }
  };
  const voidFinalResult = async () => {
    if (!selectedTournamentId || !canManage) return;
    if (!window.confirm('Void the public final result? The snapshot will stop showing as official.')) return;
    setFinalSaving(true);
    setError('');
    try {
      const response = await api.voidTournamentFinalResult(selectedTournamentId);
      setFinalResult(normalizeFinalResult(response));
      toast.success('Final results voided');
    } catch (err) {
      setError(readError(err, 'Failed to void final results'));
    } finally {
      setFinalSaving(false);
    }
  };
  const resetForms = () => {
    setEditingResult(null);
    setManualTop10(emptyManualTop10());
    setFreeFireForm({
      lobbyNumber: 1,
      matchNumber: 1,
      map: '',
      teamResults: [emptyFreeFireRow()]
    });
    setValorantForm(emptyValorantForm);
  };
  const updateFreeFireRow = (index, key, value) => {
    setFreeFireForm(current => ({
      ...current,
      teamResults: current.teamResults.map((row, rowIndex) => rowIndex === index ? {
        ...row,
        [key]: value
      } : row)
    }));
  };
  const addFreeFireRow = () => {
    setFreeFireForm(current => ({
      ...current,
      teamResults: [...current.teamResults, emptyFreeFireRow()]
    }));
  };
  const removeFreeFireRow = index => {
    setFreeFireForm(current => ({
      ...current,
      teamResults: current.teamResults.filter((_, rowIndex) => rowIndex !== index)
    }));
  };
  const buildFreeFirePayload = () => ({
    tournamentId: selectedTournamentId,
    lobbyNumber: toNumber(freeFireForm.lobbyNumber),
    matchNumber: toNumber(freeFireForm.matchNumber),
    map: freeFireForm.map.trim(),
    teamResults: freeFireForm.teamResults.filter(row => row.registrationId).map(row => {
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
      await refreshFinalResult();
    } catch (err) {
      setError(readError(err, 'Failed to save draft'));
    } finally {
      setSaving(false);
    }
  };
  const verifyResult = async result => {
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
      await refreshFinalResult();
    } catch (err) {
      setError(readError(err, 'Failed to verify result'));
    } finally {
      setSaving(false);
    }
  };
  const voidResult = async result => {
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
      await refreshFinalResult();
    } catch (err) {
      setError(readError(err, 'Failed to void result'));
    } finally {
      setSaving(false);
    }
  };
  const editResult = result => {
    setEditingResult(result);
    if (activeGame === 'freefire') {
      setFreeFireForm({
        lobbyNumber: result.lobbyNumber || 1,
        matchNumber: result.matchNumber || 1,
        map: result.map || '',
        teamResults: (result.teamResults || []).map(teamResult => ({
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
    return <div className="min-h-screen bg-gaming-dark p-6">
        <div className="max-w-4xl mx-auto card-gaming p-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Result Management</h1>
          <p className="text-gray-400">Admin or moderator access is required to manage match results.</p>
        </div>
      </div>;
  }
  if (loading) {
    return <div className="min-h-screen bg-gaming-dark p-6">
        <LoadingSpinner size="lg" text="Loading result management..." />
      </div>;
  }
  return <div className="min-h-screen bg-gaming-dark p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-gaming font-bold text-white">Match Result Management</h1>
            <p className="text-gray-400 mt-1">Create, verify, and void authoritative Free Fire and Valorant results.</p>
          </div>
          <button type="button" onClick={refreshResults} disabled={resultsLoading} className="btn btn-secondary inline-flex items-center gap-2">
            <FiRefreshCw className={resultsLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="card-gaming p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Game</label>
              <div className="grid grid-cols-2 gap-2">
                {gameOptions.map(game => <button key={game.id} type="button" onClick={() => setActiveGame(game.id)} className={`rounded-lg border px-4 py-2 font-semibold capitalize transition-colors ${activeGame === game.id ? 'border-gaming-gold bg-gaming-gold/15 text-gaming-gold' : 'border-gaming-border bg-gaming-charcoal text-gray-300 hover:border-gaming-gold/50'}`}>
                    {game.label}
                  </button>)}
              </div>
            </div>
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-2">Tournament context</label>
              <select value={selectedTournamentId} onChange={event => {
              setSelectedTournamentId(event.target.value);
              resetForms();
            }} className="input-gaming w-full">
                {gameTournaments.length === 0 ? <option value="">No tournaments available</option> : gameTournaments.map(tournament => <option key={getTournamentId(tournament)} value={getTournamentId(tournament)}>
                      {tournament.name} - {tournament.status}
                    </option>)}
              </select>
            </div>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>}

        {!selectedTournamentId ? <div className="card-gaming p-8 text-center text-gray-400">
            No {gameOptions.find(game => game.id === activeGame)?.label || activeGame} tournament found.
          </div> : <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <section className="xl:col-span-2 card-gaming p-5">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-white">{editingResult ? 'Edit Draft' : 'Create Draft'}</h2>
                  <p className="text-sm text-gray-400">{selectedTournament?.name}</p>
                </div>
                {editingResult && <button type="button" onClick={resetForms} className="btn btn-ghost btn-sm">New</button>}
              </div>

              {activeGame === 'bgmi' ? <div className="rounded-lg border border-gaming-border bg-gaming-dark/60 p-5 text-gray-300">
                  <p className="font-semibold text-white mb-2">BGMI match results are managed in the existing BGMI match flow.</p>
                  <p className="text-sm text-gray-400">Use this page to preview and publish the final tournament standings after BGMI match results are verified.</p>
                </div> : registrationsLoading ? <LoadingSpinner size="md" text="Loading verified registrations..." /> : registrationOptions.length === 0 ? <div className="rounded-lg border border-dashed border-gaming-border bg-gaming-dark/60 p-5 text-center text-gray-400">
                  No verified registrations are available for this tournament.
                </div> : activeGame === 'freefire' ? <div className="space-y-4">


                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Lobby number</span>
                      <input type="number" min="1" className="input-gaming w-full" value={freeFireForm.lobbyNumber} onChange={e => {
                  setFreeFireForm(current => ({
                    ...current,
                    lobbyNumber: e.target.value
                  }));
                }} />
                    </label>
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Match number</span>
                      <input type="number" min="1" className="input-gaming w-full" value={freeFireForm.matchNumber} onChange={e => {
                  setFreeFireForm(current => ({
                    ...current,
                    matchNumber: e.target.value
                  }));
                }} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="block text-sm text-gray-400 mb-1">Map</span>
                    <input className="input-gaming w-full" value={freeFireForm.map} onChange={e => {
                setFreeFireForm(current => ({
                  ...current,
                  map: e.target.value
                }));
              }} placeholder="Optional" />
                  </label>

                  {<>
                      <div className="space-y-3">
                        {freeFireForm.teamResults.map((row, index) => {
                  const total = (toNumber(row.placementPoints) ?? 0) + (toNumber(row.killPoints) ?? 0);
                  return <div key={index} className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-3">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                <p className="font-semibold text-white">Team result {index + 1}</p>
                                {freeFireForm.teamResults.length > 1 && <button type="button" onClick={() => removeFreeFireRow(index)} className="text-sm text-red-300 hover:text-red-200">Remove</button>}
                              </div>
                              <select className="input-gaming w-full mb-3" value={row.registrationId} onChange={e => updateFreeFireRow(index, 'registrationId', e.target.value)}>
                                <option value="">Select verified registration</option>
                                {registrationOptions.map(option => <option key={option.id} value={option.id}>{option.raw.teamName}</option>)}
                              </select>
                              <div className="grid grid-cols-2 gap-3">
                                <input type="number" min="1" className="input-gaming" placeholder="Placement" value={row.placement} onChange={e => updateFreeFireRow(index, 'placement', e.target.value)} />
                                <input type="number" min="0" className="input-gaming" placeholder="Kills" value={row.kills} onChange={e => updateFreeFireRow(index, 'kills', e.target.value)} />
                                <input type="number" min="0" className="input-gaming" placeholder="Placement points" value={row.placementPoints} onChange={e => updateFreeFireRow(index, 'placementPoints', e.target.value)} />
                                <input type="number" min="0" className="input-gaming" placeholder="Kill points" value={row.killPoints} onChange={e => updateFreeFireRow(index, 'killPoints', e.target.value)} />
                              </div>
                              <div className="mt-3 rounded-lg bg-gaming-dark/70 px-3 py-2 text-sm text-gray-300">
                                Total points: <span className="font-bold text-white">{total}</span>
                              </div>
                            </div>;
                })}
                      </div>
                      <button type="button" onClick={addFreeFireRow} className="btn btn-secondary w-full">Add team result</button>
                      <button type="button" onClick={saveDraft} disabled={saving} className="btn btn-primary w-full inline-flex items-center justify-center gap-2">
                        <FiSave /> {saving ? 'Saving...' : 'Save Draft'}
                      </button>
                    </>}
                </div> : <div className="space-y-4">
                  <label className="block">
                    <span className="block text-sm text-gray-400 mb-1">Match number</span>
                    <input type="number" min="1" className="input-gaming w-full" value={valorantForm.matchNumber} onChange={e => setValorantForm(current => ({
                ...current,
                matchNumber: e.target.value
              }))} />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Map</span>
                      <input className="input-gaming w-full" value={valorantForm.map} onChange={e => setValorantForm(current => ({
                  ...current,
                  map: e.target.value
                }))} placeholder="Optional" />
                    </label>
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Server region</span>
                      <input className="input-gaming w-full" value={valorantForm.serverRegion} onChange={e => setValorantForm(current => ({
                  ...current,
                  serverRegion: e.target.value
                }))} placeholder="Optional" />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Team A</span>
                      <select className="input-gaming w-full" value={valorantForm.teamARegistrationId} onChange={e => setValorantForm(current => ({
                  ...current,
                  teamARegistrationId: e.target.value
                }))}>
                        <option value="">Select verified team</option>
                        {registrationOptions.map(option => <option key={option.id} value={option.id}>{option.raw.teamName}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="block text-sm text-gray-400 mb-1">Team B</span>
                      <select className="input-gaming w-full" value={valorantForm.teamBRegistrationId} onChange={e => setValorantForm(current => ({
                  ...current,
                  teamBRegistrationId: e.target.value
                }))}>
                        <option value="">Select verified team</option>
                        {registrationOptions.map(option => <option key={option.id} value={option.id}>{option.raw.teamName}</option>)}
                      </select>
                    </label>
                    <input type="number" min="0" className="input-gaming" placeholder="Score A" value={valorantForm.scoreA} onChange={e => setValorantForm(current => ({
                ...current,
                scoreA: e.target.value
              }))} />
                    <input type="number" min="0" className="input-gaming" placeholder="Score B" value={valorantForm.scoreB} onChange={e => setValorantForm(current => ({
                ...current,
                scoreB: e.target.value
              }))} />
                  </div>
                  <div className="rounded-lg border border-gaming-border bg-gaming-dark/70 p-3 text-sm text-gray-300">
                    Winner: <span className="font-bold text-white">{winnerPreview}</span>
                  </div>
                  <button type="button" onClick={saveDraft} disabled={saving} className="btn btn-primary w-full inline-flex items-center justify-center gap-2">
                    <FiSave /> {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                </div>}
            </section>

            <section className="xl:col-span-3 card-gaming p-5">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-white">Existing Results</h2>
                  <p className="text-sm text-gray-400">Drafts are admin-only. Verified results are public. Void results are excluded from public history.</p>
                </div>
                <FiTarget className="text-gaming-gold h-6 w-6" />
              </div>

              {activeGame === 'bgmi' ? <div className="rounded-lg border border-dashed border-gaming-border bg-gaming-dark/60 p-8 text-center text-gray-400">
                  BGMI match-level result entry remains in the existing BGMI admin workflow. Final standings preview below derives from verified completed BGMI matches.
                </div> : resultsLoading ? <LoadingSpinner size="md" text="Loading results..." /> : results.length === 0 ? <div className="rounded-lg border border-dashed border-gaming-border bg-gaming-dark/60 p-8 text-center text-gray-400">
                  No results entered for this tournament yet.
                </div> : <div className="space-y-3">
                  {results.map(result => <div key={result.id} className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-white font-bold">
                              {activeGame === 'freefire' ? `Lobby ${result.lobbyNumber}, Match ${result.matchNumber}` : `Match ${result.matchNumber}`}
                            </h3>
                            <span className={`border rounded-full px-2 py-0.5 text-xs font-bold uppercase ${statusClass[result.status] || statusClass.draft}`}>
                              {result.status}
                            </span>
                          </div>
                          {result.map && <p className="text-sm text-gray-400 mt-1">Map: {result.map}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.status !== 'void' && <button type="button" onClick={() => editResult(result)} className="btn btn-ghost btn-sm inline-flex items-center gap-1">
                              <FiEdit2 /> Edit
                            </button>}
                          {result.status === 'draft' && <button type="button" onClick={() => verifyResult(result)} disabled={saving} className="btn btn-secondary btn-sm inline-flex items-center gap-1">
                              <FiCheckCircle /> Verify
                            </button>}
                          {result.status !== 'void' && <button type="button" onClick={() => voidResult(result)} disabled={saving} className="btn btn-danger btn-sm inline-flex items-center gap-1">
                              <FiSlash /> Void
                            </button>}
                        </div>
                      </div>

                      {activeGame === 'freefire' ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                          {(result.teamResults || []).map(teamResult => <div key={teamResult.registrationId} className="rounded-lg bg-gaming-dark/60 p-3 text-sm">
                              <p className="font-semibold text-white">{teamResult.teamName}</p>
                              <p className="text-gray-400">
                                Placement #{teamResult.placement} - {teamResult.kills} kills - {teamResult.totalPoints} pts
                              </p>
                            </div>)}
                        </div> : <div className="mt-4 rounded-lg bg-gaming-dark/60 p-3 text-sm">
                          <p className="text-white font-semibold">
                            {result.teamA?.teamName} {result.teamA?.score} - {result.teamB?.score} {result.teamB?.teamName}
                          </p>
                          <p className="text-gray-400">Winner is derived by the server from the submitted score.</p>
                        </div>}
                    </div>)}
                </div>}
            </section>

            <section className="xl:col-span-5 card-gaming p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <FiAward className="h-5 w-5 text-gaming-gold" />
                    <h2 className="text-xl font-bold text-white">Tournament Final Results</h2>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">Preview verified results, publish the official tournament snapshot, or void it if a correction is needed.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={previewFinalResult} disabled={finalLoading} className="btn btn-secondary btn-sm inline-flex items-center gap-2">
                    <FiRefreshCw className={finalLoading ? 'animate-spin' : ''} /> Preview Standings
                  </button>
                  <button type="button" onClick={publishFinalResult} disabled={finalSaving || finalLoading} className="btn btn-primary btn-sm inline-flex items-center gap-2">
                    <FiCheckCircle /> {finalResult?.status === 'published' || finalResult?.status === 'needs_republish' ? 'Republish' : 'Publish'}
                  </button>
                  {finalResult && finalResult.status !== 'void' && finalResult.status !== 'unpublished' && <button type="button" onClick={voidFinalResult} disabled={finalSaving} className="btn btn-danger btn-sm inline-flex items-center gap-2">
                      <FiSlash /> Void
                    </button>}
                </div>
              </div>

              {finalResult && <div className="mb-4 rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`border rounded-full px-2 py-0.5 text-xs font-bold uppercase ${finalResult.status === 'published' ? 'bg-green-500/15 text-green-300 border-green-500/30' : finalResult.status === 'needs_republish' ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' : 'bg-red-500/15 text-red-300 border-red-500/30'}`}>
                      {finalResult.status}
                    </span>
                    {finalResult.publishedAt && <span className="text-sm text-gray-400">Published {new Date(finalResult.publishedAt).toLocaleString()}</span>}
                  </div>
                  {finalResult.winner?.teamNameSnapshot && <p className="mt-2 text-white">Current official winner: <span className="font-bold text-gaming-gold">{finalResult.winner.teamNameSnapshot}</span></p>}
                  {finalResult.status === 'needs_republish' && <p className="mt-2 text-sm text-yellow-200">Source results changed after publication. Preview and republish after review.</p>}
                </div>}

              {finalResult?.standings?.length > 0 && <div className="mb-4 rounded-lg border border-gaming-border bg-gaming-dark/60 p-4">
                  <p className="text-sm font-semibold text-white mb-3">Current published Top 10</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {finalResult.standings.slice(0, 10).map(standing => <div key={`${standing.rank}-${standing.registrationId || standing.canonicalTeamId}`} className="flex items-center gap-2 rounded-md bg-gaming-charcoal/70 px-3 py-2">
                        <span className="text-gaming-gold font-bold w-10">#{standing.rank}</span>
                        <span className="text-white truncate">{standing.teamNameSnapshot}</span>
                      </div>)}
                  </div>
                </div>}

              {registrationOptions.length > 0 && <div className="mb-4 rounded-lg border border-gaming-border bg-gaming-dark/60 p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Manual Top 10</p>
                      <p className="text-xs text-gray-400 mt-1">Select verified registrations only. Identity and roster snapshots are derived by the server.</p>
                    </div>
                    {hasManualTop10 && <button type="button" onClick={() => setManualTop10(emptyManualTop10())} className="btn btn-ghost btn-sm">
                        Clear Manual Top 10
                      </button>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {manualTop10.map((entry, index) => <div key={entry.rank} className="rounded-lg border border-gaming-border bg-gaming-charcoal/40 p-3">
                        <label className="block">
                          <span className="block text-xs text-gray-400 mb-1">Rank {entry.rank}</span>
                          <select className="input-gaming w-full" value={entry.registrationId} onChange={event => updateManualTop10(index, 'registrationId', event.target.value)}>
                            <option value="">Select verified team</option>
                            {registrationOptions.map(option => {
                      const alreadySelected = selectedManualRegistrationIds.has(option.id) && option.id !== entry.registrationId;
                      return <option key={option.id} value={option.id} disabled={alreadySelected}>
                                  {option.raw.teamName}{alreadySelected ? ' (already selected)' : ''}
                                </option>;
                    })}
                          </select>
                          {entry.registrationId && <span className="block mt-1 text-xs text-gray-500">
                              {rosterSummary(registrationOptions.find(option => option.id === entry.registrationId)?.raw)}
                            </span>}
                        </label>

                        {entry.registrationId && <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                            <input type="number" min="0" className="input-gaming w-full text-sm" placeholder="Matches" value={entry.matchesPlayed} onChange={event => updateManualTop10(index, 'matchesPlayed', event.target.value)} />
                            {activeGame === 'valorant' ? <>
                                <input type="number" min="0" className="input-gaming w-full text-sm" placeholder="Wins" value={entry.wins} onChange={event => updateManualTop10(index, 'wins', event.target.value)} />
                                <input type="number" min="0" className="input-gaming w-full text-sm" placeholder="Losses" value={entry.losses} onChange={event => updateManualTop10(index, 'losses', event.target.value)} />
                                <input type="number" min="0" className="input-gaming w-full text-sm" placeholder="Rounds For" value={entry.roundsFor} onChange={event => updateManualTop10(index, 'roundsFor', event.target.value)} />
                                <input type="number" min="0" className="input-gaming w-full text-sm" placeholder="Rounds Against" value={entry.roundsAgainst} onChange={event => updateManualTop10(index, 'roundsAgainst', event.target.value)} />
                              </> : <>
                                <input type="number" min="0" className="input-gaming w-full text-sm" placeholder="Kills" value={entry.kills} onChange={event => updateManualTop10(index, 'kills', event.target.value)} />
                                <input type="number" min="0" className="input-gaming w-full text-sm" placeholder="Placement Pts" value={entry.placementPoints} onChange={event => updateManualTop10(index, 'placementPoints', event.target.value)} />
                                <input type="number" min="0" className="input-gaming w-full text-sm" placeholder="Kill Pts" value={entry.killPoints} onChange={event => updateManualTop10(index, 'killPoints', event.target.value)} />
                                <input type="number" min="0" className="input-gaming w-full text-sm" placeholder="Total Pts" value={entry.totalPoints} onChange={event => updateManualTop10(index, 'totalPoints', event.target.value)} />
                              </>}
                          </div>}
                      </div>)}
                  </div>
                  <p className="mt-3 text-xs text-gray-400">Manual publication supports 1-10 contiguous ranks. Leave all rows blank to publish the derived preview instead.</p>
                </div>}

              {finalPreview ? <div className="space-y-4">
                  {finalPreview.warnings?.length > 0 && <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                      {finalPreview.warnings.map(warning => <p key={warning}>{warning}</p>)}
                    </div>}
                  {finalPreview.winner?.teamNameSnapshot && <div className="rounded-lg border border-gaming-gold/30 bg-gaming-gold/10 p-4">
                      <p className="text-xs uppercase tracking-widest text-gaming-gold">Preview Winner</p>
                      <p className="text-2xl font-bold text-white">{finalPreview.winner.teamNameSnapshot}</p>
                    </div>}
                  {finalPreview.standings?.length > 0 ? <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-400 border-b border-gaming-border">
                            <th className="py-2 pr-3">Rank</th>
                            <th className="py-2 pr-3">Team</th>
                            <th className="py-2 pr-3">Matches</th>
                            <th className="py-2 pr-3">Wins</th>
                            <th className="py-2 pr-3">Kills</th>
                            <th className="py-2 pr-3">Points</th>
                            <th className="py-2 pr-3">Rounds</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finalPreview.standings.map(standing => <tr key={`${standing.rank}-${standing.registrationId || standing.canonicalTeamId}`} className="border-b border-gaming-border/60 text-gray-300">
                              <td className="py-2 pr-3 font-bold text-gaming-gold">#{standing.rank}</td>
                              <td className="py-2 pr-3 text-white">{standing.teamNameSnapshot}</td>
                              <td className="py-2 pr-3">{displayStat(standing.matchesPlayed)}</td>
                              <td className="py-2 pr-3">{displayStat(standing.wins)}</td>
                              <td className="py-2 pr-3">{displayStat(standing.kills)}</td>
                              <td className="py-2 pr-3">{displayStat(standing.totalPoints)}</td>
                              <td className="py-2 pr-3">
                                {standing.roundsWon === null && standing.roundsLost === null ? '-' : `${standing.roundsWon ?? 0}-${standing.roundsLost ?? 0}`}
                              </td>
                            </tr>)}
                        </tbody>
                      </table>
                    </div> : <div className="rounded-lg border border-dashed border-gaming-border bg-gaming-dark/60 p-5 text-center text-gray-400">
                      No safe derived standings yet. For multi-match Valorant, select explicit ranks before publishing.
                    </div>}
                </div> : <div className="rounded-lg border border-dashed border-gaming-border bg-gaming-dark/60 p-5 text-center text-gray-400">
                  Generate a preview before publishing final results.
                </div>}
            </section>
          </div>}
      </div>
    </div>;
};
export default AdminGameResults;
