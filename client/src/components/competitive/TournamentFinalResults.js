import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function TournamentFinalResults({ tournamentId }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setResult(null);
    setError('');
    api.getTournamentFinalResult(tournamentId).then(response => {
      if (active) setResult(response.data.finalResult);
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [tournamentId]);
  if (error) return <p role="alert">Unable to load results: {error}</p>;
  if (!result) return <p>Loading final results…</p>;
  return <section className="card-gaming p-4 text-white">
    <h2 className="text-xl font-bold mb-3">Official final results</h2>
    {result.status === 'needs_republish' && <p role="status" className="text-yellow-300">Source results changed. These standings are awaiting review.</p>}
    <p className="text-gray-400">{result.coverage?.note}</p>
    {result.standings.length ? <table className="w-full text-left mt-4">
      <thead><tr><th>Rank</th><th>Team</th><th>Points</th><th>Kills</th></tr></thead>
      <tbody>{result.standings.map(row => <tr key={`${row.rank}-${row.registrationId || row.canonicalTeamId}`}>
        <td>{row.rank}</td><td>{row.canonicalTeamId ? <Link to={`/team/${row.canonicalTeamId}`}>{row.teamName}</Link> : row.teamName}</td>
        <td>{row.totalPoints ?? '—'}</td><td>{row.kills ?? '—'}</td>
      </tr>)}</tbody>
    </table> : <p className="mt-3">Final standings have not been published.</p>}
    <div className="flex flex-wrap gap-3 mt-4">{result.evidence?.map(item => <a key={item.imageUrl} href={item.imageUrl} target="_blank" rel="noreferrer">Official scoreboard</a>)}</div>
  </section>;
}
