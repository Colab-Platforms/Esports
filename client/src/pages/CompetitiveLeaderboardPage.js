import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function CompetitiveLeaderboardPage() {
  const [game, setGame] = useState('bgmi');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    api.getCompetitiveLeaderboard(game, { page }).then(response => {
      if (active) setData(response.data);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [game, page]);
  return <main className="container mx-auto p-6 text-white">
    <h1 className="text-3xl font-bold">Competitive team leaderboards</h1>
    <nav className="flex gap-4 my-4"><Link to="/leaderboard">Player and CS2 leaderboards</Link><Link to="/tournament-results">Tournament results</Link></nav>
    <label>Game <select value={game} onChange={event => { setGame(event.target.value); setPage(1); }} className="input-gaming">
      <option value="bgmi">BGMI</option><option value="freefire">Free Fire</option><option value="valorant">Valorant</option>
    </select></label>
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p role="status">Loading rankings…</p>}
    {data && <><p className="text-gray-400 my-4">{data.coverage.note}</p>
      {!data.entries.length ? <p>No verified results for public teams yet.</p> : <table className="w-full text-left"><thead><tr><th>Rank</th><th>Team</th><th>Matches</th><th>Points / Wins</th></tr></thead><tbody>
        {data.entries.map(entry => <tr key={entry.team.id}><td>{entry.rank}</td><td><Link to={`/team/${entry.team.id}`}>{entry.team.name}</Link>{entry.lowSample && ' · Low sample'}</td><td>{entry.matches}</td><td>{entry.stats.totalPoints ?? entry.stats.wins}</td></tr>)}
      </tbody></table>}
      <div className="flex gap-4 mt-4"><button disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}</span><button disabled={!data.pagination.hasMore} onClick={() => setPage(value => value + 1)}>Next</button></div>
    </>}
  </main>;
}
