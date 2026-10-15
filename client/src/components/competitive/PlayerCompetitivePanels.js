import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const numericMetrics = stats => Object.entries({ ...stats.participation, ...stats.performance })
  .map(([key, metric]) => [key, typeof metric === 'number' ? metric : metric?.supported === true ? metric.value : null])
  .filter(([, value]) => Number.isFinite(value));

export default function PlayerCompetitivePanels({ username }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    Promise.all([api.getPlayerCompetitiveProfile(username), api.getPlayerCompetitiveHistory(username), api.getPlayerStatistics(username)])
      .then(([profile, history, statistics]) => {
        if (active) setData({ profile: profile.data, history: history.data, statistics: statistics.data });
      }).catch(() => { if (active) setError('Competitive details are available for public profiles only.'); });
    return () => { active = false; };
  }, [username]);
  if (error) return <p className="card-gaming p-4 mb-6 text-gray-400">{error}</p>;
  if (!data) return <p role="status">Loading competitive profile…</p>;
  const events = data.history.history || [];
  return <section className="card-gaming p-6 mb-6 text-white">
    <h2 className="text-xl font-bold mb-3">Competitive profile</h2>
    <p>{data.profile.overview.tournamentsJoined} tournaments · {data.profile.overview.activeTeams} public teams</p>
    <div className="flex flex-wrap gap-3 mt-3">{data.profile.accounts.map(account => <span key={account.provider}>{account.label}: {account.status}</span>)}</div>
    <div className="flex flex-wrap gap-3 mt-3">{data.profile.teams.map(team => ['bgmi', 'freefire', 'valorant'].includes(team.game)
      ? <Link key={team.id} to={`/team/${team.id}`}>{team.name}</Link> : <span key={team.id}>{team.name}</span>)}</div>
    <h3 className="font-bold mt-5">Statistics</h3>
    <p className="text-gray-400">{data.statistics.coverage.note}</p>
    {Object.entries(data.statistics.games).map(([game, stats]) => <div key={game} className="mt-2">
      <strong className="uppercase">{game}</strong>
      <dl className="flex flex-wrap gap-4">{numericMetrics(stats).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1')}</dt><dd>{value}</dd></div>)}</dl>
    </div>)}
    <h3 className="font-bold mt-5">Competitive history</h3>
    {!events.length ? <p className="text-gray-400">No verified competitive events yet.</p> : <ul>{events.map(event => <li key={event.id} className="mt-2">{event.tournament?.name || event.gameType} · {event.status || event.result?.type}</li>)}</ul>}
  </section>;
}
