import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FiAward,
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiCreditCard,
  FiRefreshCcw,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUsers
} from 'react-icons/fi';
import api from '../services/api';

const statusStyles = {
  pending: 'badge-warning',
  images_uploaded: 'badge-primary',
  verified: 'badge-success',
  rejected: 'badge-danger',
  upcoming: 'badge-primary',
  registration_open: 'badge-success',
  registration_closed: 'badge-warning',
  active: 'badge-success',
  completed: 'badge-secondary',
  cancelled: 'badge-danger',
  inactive: 'badge-secondary'
};

const formatStatus = (status) => (status || 'unknown').replace(/_/g, ' ');

const formatAccountStatus = (account) => {
  if (account.verificationStatus === 'verified_game_identity') return 'Verified';
  if (account.connectionStatus === 'linked') return 'Linked';
  return 'Saved ID';
};

const formatDate = (date) => {
  if (!date) return 'TBA';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(date));
};

const MotionSection = ({ children, delay = 0, className = '' }) => {
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

const SectionHeader = ({ title, action }) => (
  <div className="flex items-center justify-between gap-4 mb-4">
    <h2 className="text-xl md:text-2xl font-bold text-white">{title}</h2>
    {action}
  </div>
);

const EmptyState = ({ title, description, action }) => (
  <div className="rounded-lg border border-dashed border-gaming-border bg-gaming-dark/60 p-6 text-center">
    <p className="text-white font-semibold">{title}</p>
    {description && <p className="text-sm text-gray-400 mt-2">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const DashboardSkeleton = () => (
  <div className="min-h-screen bg-gaming-dark py-8">
    <div className="container-gaming space-y-6">
      <div className="card-gaming p-6 animate-pulse">
        <div className="h-8 bg-gaming-slate rounded w-64 mb-4" />
        <div className="h-4 bg-gaming-slate rounded w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="card-gaming p-5 animate-pulse">
            <div className="h-4 bg-gaming-slate rounded w-24 mb-4" />
            <div className="h-8 bg-gaming-slate rounded w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-gaming p-6 h-80 animate-pulse" />
        <div className="card-gaming p-6 h-80 animate-pulse" />
      </div>
    </div>
  </div>
);

const PlayerHeader = ({ player, verifiedAccounts }) => {
  const initials = (player?.displayName || player?.username || 'CE').slice(0, 2).toUpperCase();

  return (
    <MotionSection className="card-gaming p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          {player?.avatarUrl ? (
            <img
              src={player.avatarUrl}
              alt={`${player.displayName || player.username} avatar`}
              className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border-2 border-gaming-gold/60"
            />
          ) : (
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gaming-gold/15 border-2 border-gaming-gold/60 flex items-center justify-center text-gaming-gold font-bold text-xl">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm text-gaming-gold font-semibold uppercase tracking-wide">Competition Hub</p>
            <h1 className="text-3xl sm:text-4xl font-gaming font-bold text-white truncate">
              {player?.displayName || player?.username || 'Player'}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {(player?.primaryGames || []).length > 0 ? (
                player.primaryGames.map((game) => (
                  <span key={game.key} className="badge badge-secondary">{game.label}</span>
                ))
              ) : (
                <span className="badge badge-secondary">No primary games yet</span>
              )}
            </div>
          </div>
        </div>

        <div className="lg:text-right">
          <p className="text-sm text-gray-400 mb-2">Connected accounts</p>
          <div className="flex flex-wrap lg:justify-end gap-2">
            {verifiedAccounts.length > 0 ? (
              verifiedAccounts.slice(0, 5).map((account) => (
                <span key={`${account.provider}-${account.id || account.identifier}`} className="badge badge-primary">
                  <FiShield className="mr-1" /> {account.label}: {formatAccountStatus(account)}
                </span>
              ))
            ) : (
              <Link to="/connected-accounts" className="btn btn-outline btn-sm">
                Connect accounts
              </Link>
            )}
          </div>
        </div>
      </div>
    </MotionSection>
  );
};

const StatCard = ({ icon: Icon, label, value, helper }) => (
  <div className="card-gaming p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {helper && <p className="text-xs text-gray-500 mt-2">{helper}</p>}
      </div>
      <div className="p-3 rounded-lg bg-gaming-gold/10 text-gaming-gold">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const CompetitionCard = ({ competition }) => (
  <Link
    to={`/tournaments/${competition.id}`}
    className="block rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4 hover:border-gaming-gold/60 focus:outline-none focus:ring-2 focus:ring-gaming-gold transition-colors"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gaming-gold font-semibold uppercase">{competition.gameLabel}</p>
        <h3 className="text-lg font-bold text-white mt-1 line-clamp-1">{competition.name}</h3>
      </div>
      <span className={`badge ${statusStyles[competition.status] || 'badge-secondary'} capitalize shrink-0`}>
        {formatStatus(competition.status)}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
      <div>
        <p className="text-gray-500">Starts</p>
        <p className="text-gray-200 font-medium">{formatDate(competition.startDate)}</p>
      </div>
      <div>
        <p className="text-gray-500">Prize</p>
        <p className="text-gray-200 font-medium">{competition.prizePool || 0} coins</p>
      </div>
    </div>
    {competition.registration && (
      <p className="mt-4 text-sm text-gray-300">
        Registered as <span className="text-white font-semibold">{competition.registration.teamName}</span>
      </p>
    )}
  </Link>
);

const TeamRow = ({ team }) => (
  <Link
    to="/teams"
    className="flex items-center justify-between gap-4 rounded-lg bg-gaming-charcoal/70 border border-gaming-border p-4 hover:border-gaming-gold/60 focus:outline-none focus:ring-2 focus:ring-gaming-gold transition-colors"
  >
    <div className="flex items-center gap-3 min-w-0">
      {team.logo ? (
        <img src={team.logo} alt={`${team.name} logo`} className="h-11 w-11 rounded-lg object-cover" />
      ) : (
        <div className="h-11 w-11 rounded-lg bg-gaming-gold/10 text-gaming-gold flex items-center justify-center font-bold">
          {(team.tag || team.name).slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-white font-semibold truncate">{team.name}</p>
        <p className="text-sm text-gray-400 capitalize">{team.gameLabel} - {team.role}</p>
      </div>
    </div>
    <span className="text-sm text-gray-300 shrink-0">{team.memberCount}/{team.maxMembers}</span>
  </Link>
);

const RegistrationRow = ({ registration }) => (
  <Link
    to={registration.tournament ? `/tournaments/${registration.tournament.id}` : '/tournaments'}
    className="block rounded-lg bg-gaming-charcoal/70 border border-gaming-border p-4 hover:border-gaming-gold/60 focus:outline-none focus:ring-2 focus:ring-gaming-gold transition-colors"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-white font-semibold truncate">{registration.tournament?.name || registration.teamName}</p>
        <p className="text-sm text-gray-400 mt-1">{registration.teamName}</p>
      </div>
      <span className={`badge ${statusStyles[registration.status] || 'badge-secondary'} capitalize shrink-0`}>
        {formatStatus(registration.status)}
      </span>
    </div>
  </Link>
);

const ActivityItem = ({ item }) => (
  <Link
    to={item.actionUrl || '/dashboard'}
    className="block rounded-lg bg-gaming-charcoal/70 border border-gaming-border p-4 hover:border-gaming-gold/60 focus:outline-none focus:ring-2 focus:ring-gaming-gold transition-colors"
  >
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-gaming-gold/10 text-gaming-gold mt-0.5">
        <FiClock className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-white font-semibold line-clamp-1">{item.title}</p>
        <p className="text-sm text-gray-400 mt-1 line-clamp-2">{item.message}</p>
        <p className="text-xs text-gray-500 mt-2">{formatDate(item.createdAt)}</p>
      </div>
    </div>
  </Link>
);

const DashboardPage = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.getCompetitionDashboard();
      setDashboard(response.data);
    } catch (err) {
      setError('Competition Hub is unavailable right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    const overview = dashboard?.overview || {};
    return [
      { label: 'Tournaments joined', value: overview.tournamentsJoined || 0, icon: FiAward },
      { label: 'Active registrations', value: overview.activeRegistrations || 0, icon: FiTarget },
      { label: 'Teams', value: overview.teams || 0, icon: FiUsers },
      { label: 'Completed', value: overview.completedCompetitions || 0, icon: FiTrendingUp, helper: 'From reliable registrations' }
    ];
  }, [dashboard]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-gaming-dark py-8">
        <div className="container-gaming">
          <div className="card-gaming p-8 text-center">
            <h1 className="text-3xl font-gaming font-bold text-white">Competition Hub</h1>
            <p className="text-gray-400 mt-3">{error}</p>
            <button type="button" onClick={loadDashboard} className="btn btn-primary mt-6">
              <FiRefreshCcw className="mr-2" /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const player = dashboard?.player || {};
  const verifiedAccounts = dashboard?.verifiedAccounts || [];
  const competitions = dashboard?.upcomingCompetitions || [];
  const teams = dashboard?.teams || [];
  const registrations = dashboard?.registrations || [];
  const activity = dashboard?.recentActivity || [];
  const wallet = dashboard?.wallet || {};

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="container-gaming space-y-6">
        <PlayerHeader player={player} verifiedAccounts={verifiedAccounts} />

        <MotionSection delay={0.05} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </MotionSection>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            <MotionSection delay={0.1} className="card-gaming p-5 sm:p-6">
              <SectionHeader
                title="Upcoming Competitions"
                action={(
                  <Link to="/tournaments" className="btn btn-ghost btn-sm">
                    Browse <FiChevronRight className="ml-1" />
                  </Link>
                )}
              />
              {competitions.length > 0 ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {competitions.map((competition) => (
                    <CompetitionCard key={competition.id} competition={competition} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No competitions on your radar yet"
                  description="Browse tournaments to find an upcoming bracket for your games."
                  action={<Link to="/tournaments" className="btn btn-primary btn-sm">Find tournaments</Link>}
                />
              )}
            </MotionSection>

            <MotionSection delay={0.15} className="card-gaming p-5 sm:p-6">
              <SectionHeader title="Active Registrations" />
              {registrations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {registrations.map((registration) => (
                    <RegistrationRow key={registration.id} registration={registration} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No active registrations"
                  description="When you register for BGMI, Free Fire, or Valorant tournaments, the status will appear here."
                  action={<Link to="/tournaments" className="btn btn-outline btn-sm">View tournaments</Link>}
                />
              )}
            </MotionSection>
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <MotionSection delay={0.12} className="card-gaming p-5 sm:p-6">
              <SectionHeader
                title="My Teams"
                action={<Link to="/teams" className="btn btn-ghost btn-sm">Manage</Link>}
              />
              {teams.length > 0 ? (
                <div className="space-y-3">
                  {teams.slice(0, 4).map((team) => <TeamRow key={team.id} team={team} />)}
                </div>
              ) : (
                <EmptyState
                  title="No teams yet"
                  description="Create or join a persistent team before your next team tournament."
                  action={<Link to="/teams" className="btn btn-outline btn-sm">Create or join team</Link>}
                />
              )}
            </MotionSection>

            <MotionSection delay={0.18} className="card-gaming p-5 sm:p-6">
              <SectionHeader
                title="Recent Notifications"
                action={<FiCalendar className="text-gaming-gold h-5 w-5" />}
              />
              {activity.length > 0 ? (
                <div className="space-y-3">
                  {activity.map((item) => <ActivityItem key={item.id} item={item} />)}
                </div>
              ) : (
                <EmptyState
                  title="No recent notifications"
                  description="Team invites, tournament updates, match notices, and achievements will show up here."
                />
              )}
            </MotionSection>

            <MotionSection delay={0.22} className="card-gaming p-5 sm:p-6">
              <SectionHeader
                title="Wallet Snapshot"
                action={<FiCreditCard className="text-gaming-gold h-5 w-5" />}
              />
              <p className="wallet-balance">{wallet.balance || 0} coins</p>
              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="rounded-lg bg-gaming-charcoal/70 p-3">
                  <p className="text-gray-500">Earned</p>
                  <p className="text-white font-semibold">{wallet.totalEarned || 0}</p>
                </div>
                <div className="rounded-lg bg-gaming-charcoal/70 p-3">
                  <p className="text-gray-500">Spent</p>
                  <p className="text-white font-semibold">{wallet.totalSpent || 0}</p>
                </div>
              </div>
              <Link to="/wallet" className="btn btn-secondary btn-sm mt-5 w-full">
                Open wallet
              </Link>
            </MotionSection>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
