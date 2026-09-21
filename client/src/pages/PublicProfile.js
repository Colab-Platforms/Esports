import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FiActivity,
  FiArrowLeft,
  FiAward,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiShield,
  FiTarget,
  FiUsers
} from 'react-icons/fi';
import UserAvatar from '../components/common/UserAvatar';
import api from '../services/api';

const accountStatusStyles = {
  Verified: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  Linked: 'border-blue-400/40 bg-blue-400/10 text-blue-300',
  'Saved ID': 'border-gaming-gold/40 bg-gaming-gold/10 text-gaming-gold'
};

const tournamentStatusStyles = {
  registration_open: 'badge-success',
  registration_closed: 'badge-warning',
  active: 'badge-success',
  completed: 'badge-secondary',
  cancelled: 'badge-danger',
  inactive: 'badge-secondary',
  upcoming: 'badge-primary'
};

const confidenceStyles = {
  verified_result: {
    label: 'Verified Result',
    className: 'badge-success'
  },
  server_log: {
    label: 'Server Log',
    className: 'badge-primary'
  },
  derived: {
    label: 'Derived',
    className: 'badge-warning'
  },
  participation_only: {
    label: 'Participation',
    className: 'badge-secondary'
  }
};

const formatDate = (date) => {
  if (!date) return 'TBA';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date(date));
};

const formatStatus = (status) => (status || 'unknown').replace(/_/g, ' ');

const MotionSection = ({ children, className = '', delay = 0 }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

const EmptyState = ({ title, description }) => (
  <div className="rounded-lg border border-dashed border-gaming-border bg-gaming-dark/60 p-4 text-center">
    <p className="text-white font-semibold">{title}</p>
    {description && <p className="text-sm text-gray-400 mt-1.5">{description}</p>}
  </div>
);

const ProfileSkeleton = () => (
  <div className="min-h-screen bg-gaming-dark py-8">
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
      <div className="card-gaming p-6 animate-pulse h-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="card-gaming p-5 animate-pulse h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-gaming p-6 h-80 animate-pulse" />
        <div className="card-gaming p-6 h-80 animate-pulse" />
      </div>
    </div>
  </div>
);

const SectionHeader = ({ title, icon: Icon, action }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="flex items-center gap-2 min-w-0">
      {Icon && <Icon className="h-5 w-5 text-gaming-gold shrink-0" />}
      <h2 className="text-xl md:text-2xl font-bold text-white truncate">{title}</h2>
    </div>
    {action && <div className="ml-auto shrink-0">{action}</div>}
  </div>
);

const AccountChip = ({ account }) => (
  <div className={`min-w-[150px] max-w-full rounded-lg border px-3.5 py-3 ${accountStatusStyles[account.status] || accountStatusStyles['Saved ID']}`}>
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
      <FiShield className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-semibold truncate">{account.label}</span>
      </div>
      <span className="sr-only">status</span>
      <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-90 shrink-0">
        {account.status}
      </span>
    </div>
    {(account.displayName || account.identifier) && (
      <p className="text-xs mt-2 leading-5 text-gray-200 break-all">
        {[account.displayName, account.identifier].filter(Boolean).join(' - ')}
      </p>
    )}
  </div>
);

const StatCard = ({ icon: Icon, label, value }) => (
  <div className="card-gaming p-5 border-gaming-gold/20">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-gray-400">{label}</p>
        <p className="text-3xl md:text-4xl font-bold text-white mt-1">{value}</p>
      </div>
      <div className="p-3.5 rounded-lg bg-gaming-gold/10 text-gaming-gold">
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </div>
);

const TeamCard = ({ team }) => (
  <div className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4">
    <div className="flex items-center gap-3 min-w-0">
      {team.logo ? (
        <img src={team.logo} alt={`${team.name} logo`} className="h-12 w-12 rounded-lg object-cover" />
      ) : (
        <div className="h-12 w-12 rounded-lg bg-gaming-gold/10 text-gaming-gold flex items-center justify-center font-bold">
          {(team.tag || team.name || 'TM').slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-white font-semibold truncate">{team.name}</p>
        <p className="text-sm text-gray-400">
          {team.tag ? `${team.tag} - ` : ''}{team.gameLabel}
        </p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 mt-4">
      <span className="badge badge-secondary capitalize">{team.role}</span>
      {team.isSubstitute && <span className="badge badge-warning">Substitute</span>}
      <span className="badge badge-primary">{team.rosterSize}/{team.maxMembers} roster</span>
    </div>
  </div>
);

const TournamentRow = ({ tournament }) => (
  <Link
    to={`/tournaments/${tournament.tournamentId}`}
    className="block rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4 hover:border-gaming-gold/60 focus:outline-none focus:ring-2 focus:ring-gaming-gold transition-colors"
  >
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gaming-gold font-semibold uppercase">{tournament.gameLabel}</p>
        <h3 className="text-white font-bold text-lg truncate">{tournament.tournamentName}</h3>
        {tournament.teamName && (
          <p className="text-sm text-gray-400 mt-1">Team: {tournament.teamName}</p>
        )}
      </div>
      <span className={`badge ${tournamentStatusStyles[tournament.status] || 'badge-secondary'} capitalize shrink-0`}>
        {formatStatus(tournament.status)}
      </span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-sm">
      <div>
        <p className="text-gray-500">Registered</p>
        <p className="text-gray-200 font-medium">{formatDate(tournament.registeredAt)}</p>
      </div>
      <div>
        <p className="text-gray-500">Tournament Date</p>
        <p className="text-gray-200 font-medium">{formatDate(tournament.startDate)}</p>
      </div>
    </div>
  </Link>
);

const getHistoryTitle = (item) => {
  if (item.level === 'tournament') return item.tournament?.name || 'Tournament Participation';
  if (item.gameType === 'bgmi') return item.tournament?.name || 'BGMI Match Result';
  if (item.gameType === 'cs2') return item.result?.data?.map || 'CS2 Server Match';
  return item.tournament?.name || 'Competitive Event';
};

const getHistoryMeta = (item) => {
  if (item.level === 'tournament') return 'Tournament Participation';
  if (item.gameType === 'bgmi') return item.confidence === 'verified_result' ? 'Verified BGMI Result' : 'BGMI Result';
  if (item.gameType === 'cs2') return 'CS2 Server Stats';
  return formatStatus(item.level);
};

const HistoryResult = ({ item }) => {
  if (!item.result) {
    return (
      <p className="text-sm text-gray-400 mt-3">
        Match-level results are not available for this game yet.
      </p>
    );
  }

  if (item.result.type === 'placement') {
    const data = item.result.data || {};
    return (
      <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
        <div>
          <p className="text-gray-500">Placement</p>
          <p className="text-white font-bold">#{data.placement || '-'}</p>
        </div>
        <div>
          <p className="text-gray-500">Kills</p>
          <p className="text-white font-bold">{data.kills ?? '-'}</p>
        </div>
        <div>
          <p className="text-gray-500">Points</p>
          <p className="text-white font-bold">{data.points ?? '-'}</p>
        </div>
      </div>
    );
  }

  if (item.result.type === 'stat_summary') {
    const data = item.result.data || {};
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
        <div>
          <p className="text-gray-500">Kills</p>
          <p className="text-white font-bold">{data.kills ?? '-'}</p>
        </div>
        <div>
          <p className="text-gray-500">Deaths</p>
          <p className="text-white font-bold">{data.deaths ?? '-'}</p>
        </div>
        <div>
          <p className="text-gray-500">Assists</p>
          <p className="text-white font-bold">{data.assists ?? '-'}</p>
        </div>
        <div>
          <p className="text-gray-500">Damage</p>
          <p className="text-white font-bold">{data.damage ?? '-'}</p>
        </div>
      </div>
    );
  }

  return null;
};

const HistoryRow = ({ item }) => {
  const confidence = confidenceStyles[item.confidence] || confidenceStyles.participation_only;

  return (
    <div className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gaming-gold font-semibold uppercase">{getHistoryMeta(item)}</p>
          <h3 className="text-white font-bold text-lg truncate">{getHistoryTitle(item)}</h3>
          {item.team?.name && (
            <p className="text-sm text-gray-400 mt-1">Team: {item.team.name}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">{formatDate(item.occurredAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <span className="badge badge-primary uppercase">{item.gameType}</span>
          <span className={`badge ${confidence.className}`}>{confidence.label}</span>
        </div>
      </div>
      <HistoryResult item={item} />
    </div>
  );
};

const PublicProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [competitiveHistory, setCompetitiveHistory] = useState([]);
  const [historyPagination, setHistoryPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const [profileResponse, historyResponse] = await Promise.all([
          api.getPlayerCompetitiveProfile(username),
          api.getPlayerCompetitiveHistory(username, { limit: 8 })
        ]);
        if (mounted) {
          setProfile(profileResponse.data);
          setCompetitiveHistory(historyResponse.data?.history || []);
          setHistoryPagination(historyResponse.data?.pagination || null);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Player profile is unavailable right now.');
          setProfile(null);
          setCompetitiveHistory([]);
          setHistoryPagination(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [username]);

  if (loading) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center px-4">
        <div className="card-gaming p-8 text-center max-w-lg">
          <h1 className="text-2xl font-bold text-white mb-3">Player Not Found</h1>
          <p className="text-gray-400 mb-6">{error || 'This competitive profile could not be loaded.'}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-primary"
          >
            <FiArrowLeft className="mr-2" /> Back
          </button>
        </div>
      </div>
    );
  }

  const { player, accounts, games, overview, teams, tournamentHistory, achievements } = profile;
  const visibleTeams = teams.slice(0, 3);
  const hiddenTeamCount = Math.max(teams.length - visibleTeams.length, 0);

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-gaming-gold rounded-lg px-2 py-1 transition-colors"
        >
          <FiArrowLeft className="h-5 w-5" />
          <span>Back</span>
        </button>

        <MotionSection className="card-gaming p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
              <UserAvatar user={player} size="3xl" />
              <div className="min-w-0">
                <p className="text-sm text-gaming-gold font-semibold uppercase tracking-wide">Competitive Profile</p>
                <h1 className="text-3xl sm:text-5xl font-gaming font-bold text-white break-words">
                  {player.displayName || player.username}
                </h1>
                <p className="text-gray-400 mt-2">@{player.username}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {player.country && <span className="badge badge-secondary">{player.country}</span>}
                  <span className="badge badge-primary">Joined {formatDate(player.joinedAt)}</span>
                  <span className="badge badge-secondary">Level {player.level || 1}</span>
                </div>
                {player.bio && <p className="text-gray-300 mt-4 max-w-3xl">{player.bio}</p>}
              </div>
            </div>

            <div className="lg:max-w-lg">
              <p className="text-sm text-gray-400 mb-3">Connected gaming accounts</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                {accounts.length > 0 ? (
                  accounts.map((account) => (
                    <AccountChip key={`${account.provider}-${account.displayName || account.identifier}`} account={account} />
                  ))
                ) : (
                  <span className="badge badge-secondary">No connected gaming accounts</span>
                )}
              </div>
            </div>
          </div>
        </MotionSection>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={FiTarget} label="Tournaments Joined" value={overview.tournamentsJoined} />
          <StatCard icon={FiCheckCircle} label="Completed Tournaments" value={overview.completedTournaments} />
          <StatCard icon={FiUsers} label="Active Teams" value={overview.activeTeams} />
          <StatCard icon={FiAward} label="Achievements" value={overview.achievements} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <MotionSection className="card-gaming p-6" delay={0.05}>
              <SectionHeader title="Games" icon={FiTarget} />
              {games.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {games.map((game) => (
                    <div key={game.key} className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4">
                      <p className="text-white font-semibold">{game.label}</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Signals: {game.sources.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No player games yet"
                  description="This profile will show games once the player connects accounts, joins teams, or registers for tournaments."
                />
              )}
            </MotionSection>

            <MotionSection className="card-gaming p-6" delay={0.1}>
              <SectionHeader title="Tournament History" icon={FiCalendar} />
              {tournamentHistory.length > 0 ? (
                <div className="space-y-3">
                  {tournamentHistory.map((tournament) => (
                    <TournamentRow key={tournament.id} tournament={tournament} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No tournaments played yet"
                  description="Tournament-level history appears here after public registrations or participation are available."
                />
              )}
            </MotionSection>

            <MotionSection className="card-gaming p-6" delay={0.12}>
              <SectionHeader title="Competitive History" icon={FiActivity} />
              {competitiveHistory.length > 0 ? (
                <div className="space-y-3">
                  {competitiveHistory.map((item) => (
                    <HistoryRow key={item.id} item={item} />
                  ))}
                  {historyPagination?.hasMore && (
                    <p className="text-sm text-gray-500 text-center pt-1">
                      Showing latest {competitiveHistory.length} competitive events.
                    </p>
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No competitive history yet"
                  description="Tournament participation and verified BGMI results will appear here when public-safe history is available."
                />
              )}
            </MotionSection>
          </div>

          <div className="space-y-6">
            <MotionSection className="card-gaming p-6" delay={0.15}>
              <SectionHeader
                title="Teams"
                icon={FiUsers}
                action={teams.length > 0 && (
                  <Link to="/teams" className="btn btn-ghost btn-sm">
                    View all teams
                  </Link>
                )}
              />
              {teams.length > 0 ? (
                <div className="space-y-3">
                  {visibleTeams.map((team) => (
                    <TeamCard key={team.id} team={team} />
                  ))}
                  {hiddenTeamCount > 0 && (
                    <Link
                      to="/teams"
                      className="block rounded-lg border border-gaming-border bg-gaming-dark/60 p-3 text-center text-sm font-semibold text-gaming-gold hover:border-gaming-gold/60 focus:outline-none focus:ring-2 focus:ring-gaming-gold transition-colors"
                    >
                      View {hiddenTeamCount} more {hiddenTeamCount === 1 ? 'team' : 'teams'}
                    </Link>
                  )}
                </div>
              ) : (
                <EmptyState
                  title="No public teams yet"
                  description="Public team memberships will appear here."
                />
              )}
            </MotionSection>

            <MotionSection className="card-gaming p-6" delay={0.2}>
              <SectionHeader title="Achievements" icon={FiAward} />
              {achievements.length > 0 ? (
                <div className="space-y-3">
                  {achievements.map((achievement) => (
                    <div key={achievement.id} className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gaming-gold/10 text-gaming-gold flex items-center justify-center shrink-0">
                          {achievement.icon || <FiAward className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-semibold">{achievement.name}</p>
                          {achievement.description && (
                            <p className="text-sm text-gray-400 mt-1">{achievement.description}</p>
                          )}
                          {achievement.earnedAt && (
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                              <FiClock className="h-3 w-3" /> {formatDate(achievement.earnedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No achievements yet"
                  description="Only existing earned achievements are shown publicly."
                />
              )}
            </MotionSection>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
