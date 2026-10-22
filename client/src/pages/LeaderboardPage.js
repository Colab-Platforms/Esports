import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import GameIcon from '../components/common/GameIcon';
import TournamentResultsPage from './TournamentResultsPage';
import api from '../services/api';

const GAMES = { bgmi: 'BGMI', freefire: 'Free Fire', valorant: 'Valorant', cs2: 'CS2' };
const dateLabel = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleDateString() : 'Date unavailable';
const imageUrl = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
  catch (_) { return null; }
};

function Scoreboards({ game }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);
  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true); setFailed(false);
    try {
      const response = await api.get('/api/tournaments/scoreboards-gallery', { params: { gameType: game, page, limit: 12 } });
      if (!response?.success || !Array.isArray(response.data?.scoreboards)) throw new Error('Invalid gallery response');
      if (requestId.current === id) setData(response.data);
    } catch (_) { if (requestId.current === id) setFailed(true); }
    finally { if (requestId.current === id) setLoading(false); }
  }, [game, page]);
  useEffect(() => { load(); return () => { requestId.current += 1; }; }, [load]);
  return <section className="card-gaming p-5 sm:p-6">
    <div className="flex items-center justify-between gap-4 mb-3">
      <h2 className="text-xl font-bold">{GAMES[game]} Scoreboards</h2>
      <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>Refresh scoreboards</button>
    </div>
    <p className="text-gray-400 mb-5">Uploaded scoreboard images remain available here, even before final standings are published.</p>
    {loading ? <p role="status">Loading scoreboards…</p> : failed ? <div role="alert">
      <p>Scoreboards are temporarily unavailable.</p><button type="button" className="btn btn-ghost mt-3" onClick={load}>Retry scoreboards</button>
    </div> : data.scoreboards.length === 0 ? <p>No scoreboard images uploaded yet for {GAMES[game]}.</p> : <>
      <p className="text-gray-400 text-sm mb-4">{data.pagination.total} scoreboard images</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {data.scoreboards.map((scoreboard, index) => {
          const url = imageUrl(scoreboard.imageUrl);
          return <article className="rounded-lg border border-gaming-border overflow-hidden" key={scoreboard._id || `${scoreboard.tournament?.id}-${index}`}>
            {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open scoreboard: ${scoreboard.tournament?.name || 'Tournament'}`}>
              <img src={url} alt={scoreboard.description || 'Tournament scoreboard'} className="w-full h-52 object-contain bg-black/30" loading="lazy" />
            </a> : <p className="p-5 text-gray-400">Image unavailable</p>}
            <div className="p-4 space-y-2">
              <Link className="font-bold text-gaming-gold" to={`/tournament/${encodeURIComponent(scoreboard.tournament?.id || '')}`}>{scoreboard.tournament?.name || 'Tournament'}</Link>
              <p className="text-sm text-gray-300">{scoreboard.description || 'Official scoreboard'}</p>
              <p className="text-xs text-gray-400">Uploaded: {dateLabel(scoreboard.uploadedAt)}</p>
            </div>
          </article>;
        })}
      </div>
      {(page > 1 || data.pagination.hasMore) && <div className="flex items-center justify-between gap-3 mt-6">
        <button type="button" className="btn btn-ghost" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous scoreboards</button>
        <span>Page {page}</span>
        <button type="button" className="btn btn-ghost" disabled={!data.pagination.hasMore} onClick={() => setPage(value => value + 1)}>Next scoreboards</button>
      </div>}
    </>}
  </section>;
}

function CS2Rankings() {
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true; setRows(null); setFailed(false);
    Promise.all([api.get('/api/cs2-leaderboard/all-players', { params: { limit: 50 } }),
      api.get('/api/cs2-leaderboard/all-stats').catch(() => null)]).then(([players, totals]) => {
      if (!players?.success || !Array.isArray(players.leaderboard)) throw new Error('Invalid rankings response');
      if (active) { setRows(players.leaderboard); setStats(totals?.success ? totals.stats : null); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [retry]);
  return <section className="card-gaming p-5">
    <h2 className="text-xl font-bold mb-3">CS2 Player Rankings</h2>
    {failed ? <p role="alert">CS2 rankings are temporarily unavailable.</p> : !rows ? <p role="status">Loading CS2 rankings…</p> : rows.length === 0 ?
      <p>No CS2 players yet. Connect Steam and play matches to appear here.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr>{['Rank', 'Player', 'Kills', 'Deaths', 'Assists', 'K/D', 'Damage', 'MVPs', 'Rounds', 'Matches'].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.map((player, index) => <tr key={player.accountid || index} className="border-t border-gaming-border">
          <td className="p-3">#{player.rank || index + 1}</td><td className="p-3">{player.displayName || player.username || 'Player'}{player.isRegistered === false ? ' (Unregistered)' : ''}</td>
          {['total_kills', 'total_deaths', 'total_assists', 'kdr', 'total_damage', 'total_mvp', 'rounds_played', 'matches_played'].map(key => <td className="p-3" key={key}>{key === 'kdr' ? Number(player.stats?.[key] || 0).toFixed(2) : player.stats?.[key] ?? 0}</td>)}
        </tr>)}</tbody>
      </table></div>}
    {stats && <p className="text-gray-400 text-sm mt-3">Total matches: {stats.total_matches || 0} · Total kills: {stats.total_kills || 0}</p>}
    <button type="button" className="btn btn-ghost mt-4" onClick={() => setRetry(value => value + 1)}>Refresh CS2 rankings</button>
  </section>;
}

export default function LeaderboardPage() {
  const [params, setParams] = useSearchParams();
  const game = Object.hasOwn(GAMES, params.get('game')) ? params.get('game') : 'bgmi';
  const view = params.get('view') === 'published' ? 'published' : 'scoreboards';
  return <div className="min-h-screen bg-theme-bg-primary text-theme-text-primary py-8"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div><h1 className="text-3xl font-gaming font-bold">Leaderboards &amp; Results</h1><p className="text-gray-400 mt-2">Browse scoreboard images, published tournament standings and player rankings.</p></div>
      <Link className="btn btn-ghost" to="/competitive-leaderboards">Competitive team rankings</Link>
    </div>
    <nav aria-label="Games" className="flex flex-wrap gap-3">
      {Object.entries(GAMES).map(([key, label]) => <button type="button" key={key} aria-label={label} aria-pressed={game === key}
        className={`btn ${game === key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setParams({ game: key, view })}>
        <GameIcon gameType={key} size="sm" /><span className="ml-2">{label}</span>
      </button>)}
    </nav>
    {game === 'cs2' ? <CS2Rankings /> : <>
      <div role="tablist" aria-label={`${GAMES[game]} result views`} className="flex gap-3 border-b border-gaming-border pb-3">
        {[['scoreboards', 'Scoreboards'], ['published', 'Published Results']].map(([key, label]) => <button type="button" role="tab" id={`${key}-tab`} aria-controls="game-results-panel" aria-selected={view === key}
          className={`btn ${view === key ? 'btn-primary' : 'btn-ghost'}`} key={key} onClick={() => setParams({ game, view: key })}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'scoreboards' : event.key === 'End' ? 'published' : key === 'scoreboards' ? 'published' : 'scoreboards';
            setParams({ game, view: next }); document.getElementById(`${next}-tab`)?.focus();
          }}>{label}</button>)}
      </div>
      <div role="tabpanel" id="game-results-panel" aria-labelledby={`${view}-tab`}>
        {view === 'scoreboards' ? <Scoreboards key={`${game}:scoreboards`} game={game} /> : <TournamentResultsPage key={`${game}:published`} gameType={game} embedded />}
      </div>
    </>}
  </div></div>;
}
