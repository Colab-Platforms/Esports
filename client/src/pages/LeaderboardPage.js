import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaMedal, FaSyncAlt, FaTrophy } from 'react-icons/fa';
import GameIcon from '../components/common/GameIcon';
import api from '../services/api';

const GAME_TABS = [
  { key: 'bgmi', label: 'BGMI' },
  { key: 'freefire', label: 'Free Fire' },
  { key: 'valorant', label: 'Valorant' }
];

const PAGE_SIZE = 25;

const formatNumber = (value) => (
  Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '0'
);

const formatDecimal = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
};

const formatPercent = (value) => `${Math.round(Number(value) || 0)}%`;

const rankClass = (rank) => {
  if (rank === 1) return 'bg-yellow-400/15 text-yellow-300 border-yellow-400/40';
  if (rank === 2) return 'bg-slate-300/15 text-slate-200 border-slate-300/40';
  if (rank === 3) return 'bg-orange-400/15 text-orange-300 border-orange-400/40';
  return 'bg-theme-bg-hover text-theme-text-secondary border-theme-border';
};

const Metric = ({ label, value, accent = false }) => (
  <div className="flex items-center justify-between rounded-md bg-theme-bg-card px-3 py-2 border border-theme-border">
    <span className="text-theme-text-muted">{label}</span>
    <span className={`font-bold ${accent ? 'text-theme-accent' : 'text-theme-text-primary'}`}>{value}</span>
  </div>
);

const EmptyState = ({ onRetry }) => (
  <div className="text-center py-14 px-4">
    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-theme-accent/10 border border-theme-accent/30 flex items-center justify-center">
      <FaTrophy className="text-theme-accent text-xl" />
    </div>
    <h3 className="text-xl font-bold text-theme-text-primary mb-2">No ranked teams yet</h3>
    <p className="text-theme-text-secondary max-w-md mx-auto mb-5">
      Teams appear here after verified competitive results are available.
    </p>
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-accent text-white font-semibold hover:bg-theme-accent/80 transition-colors"
    >
      <FaSyncAlt className="text-sm" />
      Retry
    </button>
  </div>
);

const TeamCell = ({ team, lowSample }) => (
  <Link to={`/team/${team.id}`} className="flex items-center gap-3 min-w-0 group">
    <div className="w-10 h-10 rounded-lg bg-theme-accent/15 border border-theme-accent/25 overflow-hidden flex items-center justify-center shrink-0">
      {team.logo ? (
        <img src={team.logo} alt={team.name} className="w-full h-full object-cover" />
      ) : (
        <span className="text-theme-accent font-bold">{team.name?.charAt(0)?.toUpperCase() || '?'}</span>
      )}
    </div>
    <div className="min-w-0">
      <div className="text-theme-text-primary font-bold truncate group-hover:text-theme-accent transition-colors">
        {team.name || 'Unknown Team'}
      </div>
      <div className="flex items-center gap-2 text-xs text-theme-text-muted">
        {team.tag && <span>{team.tag}</span>}
        {lowSample && <span className="px-1.5 py-0.5 rounded border border-yellow-400/30 text-yellow-300">Low sample</span>}
      </div>
    </div>
  </Link>
);

const DesktopTable = ({ gameType, entries }) => (
  <div className="hidden md:block overflow-x-auto">
    <table className="w-full min-w-[760px]">
      <thead className="bg-theme-bg-hover">
        <tr>
          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Rank</th>
          <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Team</th>
          <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Matches</th>
          {gameType === 'valorant' ? (
            <>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Wins</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Losses</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Win Rate</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Round Diff</th>
            </>
          ) : (
            <>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Points</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Wins</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Kills</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-theme-text-secondary">Avg Placement</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <motion.tr
            key={entry.team.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.025 }}
            className="border-b border-theme-border hover:bg-theme-bg-hover/60 transition-colors"
          >
            <td className="px-4 py-4">
              <span className={`inline-flex items-center justify-center min-w-10 h-8 px-2 rounded-lg border font-bold ${rankClass(entry.rank)}`}>
                {entry.rank <= 3 ? <FaMedal className="mr-1" /> : null}
                #{entry.rank}
              </span>
            </td>
            <td className="px-4 py-4">
              <TeamCell team={entry.team} lowSample={entry.lowSample} />
            </td>
            <td className="px-4 py-4 text-right text-theme-text-primary font-semibold">{formatNumber(entry.matches)}</td>
            {gameType === 'valorant' ? (
              <>
                <td className="px-4 py-4 text-right text-green-400 font-bold">{formatNumber(entry.stats.wins)}</td>
                <td className="px-4 py-4 text-right text-red-300 font-semibold">{formatNumber(entry.stats.losses)}</td>
                <td className="px-4 py-4 text-right text-theme-accent font-bold">{formatPercent(entry.stats.winRate)}</td>
                <td className="px-4 py-4 text-right text-theme-text-primary font-semibold">{formatNumber(entry.stats.roundDifferential)}</td>
              </>
            ) : (
              <>
                <td className="px-4 py-4 text-right text-theme-accent font-bold">{formatNumber(entry.stats.totalPoints)}</td>
                <td className="px-4 py-4 text-right text-green-400 font-bold">{formatNumber(entry.stats.wins)}</td>
                <td className="px-4 py-4 text-right text-theme-text-primary font-semibold">{formatNumber(entry.stats.totalKills)}</td>
                <td className="px-4 py-4 text-right text-theme-text-primary font-semibold">{formatDecimal(entry.stats.averagePlacement)}</td>
              </>
            )}
          </motion.tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MobileList = ({ gameType, entries }) => (
  <div className="md:hidden space-y-3">
    {entries.map((entry, index) => (
      <motion.div
        key={entry.team.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.025 }}
        className="p-4 rounded-lg bg-theme-bg-hover border border-theme-border"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className={`inline-flex items-center justify-center min-w-10 h-8 px-2 rounded-lg border font-bold ${rankClass(entry.rank)}`}>
            #{entry.rank}
          </span>
          <div className="text-xs text-theme-text-muted">{formatNumber(entry.matches)} matches</div>
        </div>
        <TeamCell team={entry.team} lowSample={entry.lowSample} />
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          {gameType === 'valorant' ? (
            <>
              <Metric label="Wins" value={formatNumber(entry.stats.wins)} accent />
              <Metric label="Losses" value={formatNumber(entry.stats.losses)} />
              <Metric label="Win Rate" value={formatPercent(entry.stats.winRate)} accent />
              <Metric label="Round Diff" value={formatNumber(entry.stats.roundDifferential)} />
            </>
          ) : (
            <>
              <Metric label="Points" value={formatNumber(entry.stats.totalPoints)} accent />
              <Metric label="Wins" value={formatNumber(entry.stats.wins)} />
              <Metric label="Kills" value={formatNumber(entry.stats.totalKills)} />
              <Metric label="Avg Place" value={formatDecimal(entry.stats.averagePlacement)} />
            </>
          )}
        </div>
      </motion.div>
    ))}
  </div>
);

const LeaderboardPage = () => {
  const [selectedGame, setSelectedGame] = useState('bgmi');
  const [page, setPage] = useState(1);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedGameLabel = useMemo(
    () => GAME_TABS.find((game) => game.key === selectedGame)?.label || selectedGame,
    [selectedGame]
  );

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getCompetitiveLeaderboard(selectedGame, { page, limit: PAGE_SIZE });
      setLeaderboard(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load leaderboard');
      setLeaderboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame, page]);

  const handleGameChange = (gameType) => {
    setSelectedGame(gameType);
    setPage(1);
  };

  const entries = leaderboard?.entries || [];
  const pagination = leaderboard?.pagination || { page, total: 0, hasMore: false };

  return (
    <div className="min-h-screen bg-theme-bg-primary py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <h1 className="text-3xl md:text-4xl font-gaming font-bold text-theme-text-primary mb-3">
                Competitive Team Leaderboards
              </h1>
              <p className="text-theme-text-secondary max-w-2xl">
                Rankings are based on verified competitive results available on Colab.
              </p>
            </div>
            <button
              onClick={fetchLeaderboard}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-theme-bg-card border border-theme-border text-theme-text-primary hover:border-theme-accent/60 disabled:opacity-60 transition-colors"
            >
              <FaSyncAlt className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </motion.div>

        <div className="bg-theme-bg-card rounded-xl border border-theme-border p-4 sm:p-6 mb-6">
          <div className="flex flex-wrap gap-3">
            {GAME_TABS.map((game) => (
              <button
                key={game.key}
                onClick={() => handleGameChange(game.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  selectedGame === game.key
                    ? 'bg-theme-accent text-white'
                    : 'bg-theme-bg-hover text-theme-text-secondary hover:text-theme-text-primary'
                }`}
              >
                <GameIcon gameType={game.key} size="sm" />
                {game.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-theme-bg-card rounded-xl border border-theme-border overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-b border-theme-border">
            <div>
              <h2 className="text-xl font-bold text-theme-text-primary">{selectedGameLabel} Team Rankings</h2>
              <p className="text-sm text-theme-text-muted mt-1">
                {pagination.total || 0} ranked teams. Teams with fewer than 3 matches are marked low sample.
              </p>
            </div>
            <div className="text-sm text-theme-text-secondary">
              Page {pagination.page || 1}
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-accent mx-auto mb-4"></div>
              <p className="text-theme-text-secondary">Loading leaderboard...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center px-4">
              <h3 className="text-xl font-bold text-red-300 mb-2">Could not load leaderboard</h3>
              <p className="text-theme-text-secondary mb-5">{error}</p>
              <button
                onClick={fetchLeaderboard}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-theme-accent text-white font-semibold hover:bg-theme-accent/80 transition-colors"
              >
                <FaSyncAlt className="text-sm" />
                Retry
              </button>
            </div>
          ) : entries.length === 0 ? (
            <EmptyState onRetry={fetchLeaderboard} />
          ) : (
            <div className="p-0 md:p-2">
              <DesktopTable gameType={selectedGame} entries={entries} />
              <MobileList gameType={selectedGame} entries={entries} />
            </div>
          )}

          {!loading && !error && entries.length > 0 && (
            <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-t border-theme-border">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg bg-theme-bg-hover text-theme-text-secondary disabled:opacity-40 hover:text-theme-text-primary transition-colors"
              >
                Previous
              </button>
              <div className="text-sm text-theme-text-muted">
                Showing {entries.length} of {pagination.total || 0}
              </div>
              <button
                onClick={() => setPage((current) => current + 1)}
                disabled={!pagination.hasMore}
                className="px-4 py-2 rounded-lg bg-theme-bg-hover text-theme-text-secondary disabled:opacity-40 hover:text-theme-text-primary transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
