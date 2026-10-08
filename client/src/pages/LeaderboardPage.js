import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCalendarAlt, FaChevronDown, FaExternalLinkAlt, FaImage, FaMedal, FaSyncAlt, FaTrophy } from 'react-icons/fa';
import GameIcon from '../components/common/GameIcon';
import api from '../services/api';

const GAME_TABS = [
  { key: 'bgmi', label: 'BGMI' },
  { key: 'freefire', label: 'Free Fire' },
  { key: 'valorant', label: 'Valorant' }
];

const PAGE_SIZE = 12;

const formatDate = (value) => {
  if (!value) return 'Not published';
  return new Date(value).toLocaleDateString();
};

const statusClass = (status) => (
  status === 'needs_republish'
    ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
    : 'bg-green-500/15 text-green-300 border-green-500/30'
);

const teamDisplayName = (team) => team?.teamName || team?.teamNameSnapshot || 'Team unavailable';

const TeamIdentityLink = ({ team, className = '' }) => {
  const name = teamDisplayName(team);
  if (!team?.canonicalTeamId) {
    return <span className={className}>{name}</span>;
  }

  return (
    <Link
      to={`/team/${team.canonicalTeamId}`}
      onClick={(event) => event.stopPropagation()}
      className={`inline-flex min-w-0 items-center gap-2 hover:text-theme-accent transition-colors ${className}`}
    >
      {team.teamLogo ? (
        <img src={team.teamLogo} alt="" className="h-5 w-5 rounded object-cover shrink-0" />
      ) : null}
      <span className="truncate">{name}</span>
      <FaExternalLinkAlt className="text-[10px] shrink-0 opacity-70" />
    </Link>
  );
};

const EmptyState = ({ onRetry }) => (
  <div className="text-center py-14 px-4">
    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-theme-accent/10 border border-theme-accent/30 flex items-center justify-center">
      <FaTrophy className="text-theme-accent text-xl" />
    </div>
    <h3 className="text-xl font-bold text-theme-text-primary mb-2">No published tournament results yet</h3>
    <p className="text-theme-text-secondary max-w-md mx-auto mb-5">
      Published final results will appear here after admins publish official tournament standings.
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

const TournamentResultAccordion = ({ tournament, index, expanded, onToggle }) => (
  <motion.article
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.03 }}
    className="rounded-lg border border-theme-border bg-theme-bg-card overflow-hidden"
  >
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={expanded}
      className="w-full px-4 py-4 sm:px-5 text-left hover:bg-theme-bg-hover/70 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-theme-bg-hover border border-theme-border flex items-center justify-center">
            <GameIcon gameType={tournament.gameType} size="sm" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-theme-text-primary truncate">{tournament.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-theme-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <FaTrophy className="text-theme-accent" />
                <TeamIdentityLink team={tournament.winner} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FaCalendarAlt className="text-theme-accent" />
                {formatDate(tournament.publishedAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <span className={`hidden sm:inline-flex border rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${statusClass(tournament.resultStatus)}`}>
            {tournament.resultStatus === 'needs_republish' ? 'Needs republish' : 'Published'}
          </span>
          <FaChevronDown className={`text-theme-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>
    </div>

    {expanded && (
      <div className="border-t border-theme-border px-4 py-4 sm:px-5 bg-theme-bg-primary/30">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h4 className="text-sm font-bold text-theme-text-primary uppercase tracking-wide">Published Winners</h4>
              <span className={`sm:hidden border rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${statusClass(tournament.resultStatus)}`}>
                {tournament.resultStatus === 'needs_republish' ? 'Needs republish' : 'Published'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(tournament.topStandings?.length ? tournament.topStandings : tournament.podium || []).map((entry) => (
                <div
                  key={`${entry.rank}-${entry.registrationId || entry.canonicalTeamId}`}
                  className="flex items-center gap-3 rounded-md bg-theme-bg-hover px-3 py-2 text-sm"
                >
                  <FaMedal className="text-theme-accent shrink-0" />
                  <span className="text-theme-accent font-bold w-8">#{entry.rank}</span>
                  <TeamIdentityLink team={entry} className="text-theme-text-primary font-semibold truncate" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:w-52">
            <div className="rounded-md border border-theme-border bg-theme-bg-card px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-theme-text-secondary">
                <FaImage className="text-theme-accent" />
                <span>Scoreboard</span>
              </div>
              <p className="mt-1 text-theme-text-primary font-semibold">
                {tournament.scoreboardAvailable ? `${tournament.scoreboardCount} image${tournament.scoreboardCount === 1 ? '' : 's'}` : 'Not uploaded'}
              </p>
            </div>
            <Link
              to={tournament.routeTarget || `/tournament/${tournament.tournamentId}?tab=results`}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-theme-accent px-4 py-2 font-semibold text-white hover:bg-theme-accent/80 transition-colors"
            >
              View Full Results
              <FaExternalLinkAlt className="text-xs" />
            </Link>
          </div>
        </div>
      </div>
    )}
  </motion.article>
);

const LeaderboardPage = () => {
  const [selectedGame, setSelectedGame] = useState('bgmi');
  const [page, setPage] = useState(1);
  const [directory, setDirectory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTournamentId, setExpandedTournamentId] = useState('');

  const selectedGameLabel = useMemo(
    () => GAME_TABS.find((game) => game.key === selectedGame)?.label || selectedGame,
    [selectedGame]
  );

  const fetchDirectory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.getTournamentResultsDirectory({
        gameType: selectedGame,
        page,
        limit: PAGE_SIZE
      });
      setDirectory(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load tournament results');
      setDirectory(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGame, page]);

  const handleGameChange = (gameType) => {
    setSelectedGame(gameType);
    setPage(1);
    setExpandedTournamentId('');
  };

  const tournaments = directory?.tournaments || [];
  const pagination = directory?.pagination || { page, total: 0, hasMore: false };

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
                Tournament Results
              </h1>
              <p className="text-theme-text-secondary max-w-2xl">
                Browse official published final standings by tournament. Global competitive rankings are preserved for a future Rankings view.
              </p>
            </div>
            <button
              onClick={fetchDirectory}
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

        <section className="bg-theme-bg-card rounded-xl border border-theme-border p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-theme-text-primary">{selectedGameLabel} Results Directory</h2>
              <p className="text-sm text-theme-text-secondary mt-1">
                {pagination.total || 0} tournament{pagination.total === 1 ? '' : 's'} with published final results.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-14">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-accent mx-auto mb-4"></div>
              <p className="text-theme-text-secondary">Loading tournament results...</p>
            </div>
          ) : error ? (
            <div className="text-center py-14">
              <h3 className="text-xl font-bold text-red-300 mb-2">Could not load results</h3>
              <p className="text-theme-text-secondary mb-5">{error}</p>
              <button onClick={fetchDirectory} className="px-4 py-2 rounded-lg bg-theme-accent text-white font-semibold">
                Try Again
              </button>
            </div>
          ) : tournaments.length === 0 ? (
            <EmptyState onRetry={fetchDirectory} />
          ) : (
            <>
              <div className="space-y-3">
                {tournaments.map((tournament, index) => (
                  <TournamentResultAccordion
                    key={tournament.tournamentId}
                    tournament={tournament}
                    index={index}
                    expanded={expandedTournamentId === tournament.tournamentId}
                    onToggle={() => setExpandedTournamentId((current) => (
                      current === tournament.tournamentId ? '' : tournament.tournamentId
                    ))}
                  />
                ))}
              </div>

              {(pagination.page > 1 || pagination.hasMore) && (
                <div className="flex items-center justify-between gap-3 mt-6 pt-6 border-t border-theme-border">
                  <button
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    disabled={pagination.page <= 1 || loading}
                    className="px-4 py-2 rounded-lg border border-theme-border text-theme-text-primary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-theme-text-secondary">Page {pagination.page}</span>
                  <button
                    onClick={() => setPage((current) => current + 1)}
                    disabled={!pagination.hasMore || loading}
                    className="px-4 py-2 rounded-lg border border-theme-border text-theme-text-primary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default LeaderboardPage;
