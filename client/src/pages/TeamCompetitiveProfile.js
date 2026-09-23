import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  FiActivity,
  FiArrowLeft,
  FiBarChart2,
  FiCalendar,
  FiShield,
  FiTarget,
  FiUsers
} from 'react-icons/fi';
import UserAvatar from '../components/common/UserAvatar';
import api from '../services/api';

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

const SectionHeader = ({ title, icon: Icon }) => (
  <div className="flex items-center gap-2 mb-4">
    {Icon && <Icon className="h-5 w-5 text-gaming-gold shrink-0" />}
    <h2 className="text-xl md:text-2xl font-bold text-white truncate">{title}</h2>
  </div>
);

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
        {[1, 2, 3, 4].map((item) => <div key={item} className="card-gaming p-5 animate-pulse h-24" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-gaming p-6 h-96 animate-pulse" />
        <div className="card-gaming p-6 h-96 animate-pulse" />
      </div>
    </div>
  </div>
);

const StatCard = ({ label, value }) => (
  <div className="rounded-lg border border-gaming-border bg-gaming-dark/70 px-4 py-3">
    <p className="text-xs uppercase font-semibold text-gray-500">{label}</p>
    <p className="text-2xl font-bold text-white mt-1">{value ?? '-'}</p>
  </div>
);

const overviewMetrics = (profile) => {
  const game = profile.team.game;
  const performance = profile.statistics?.statistics?.performance || {};
  if (game === 'valorant') {
    return [
      ['Matches', performance.matchesPlayed],
      ['Wins', performance.wins],
      ['Losses', performance.losses],
      ['Win Rate', performance.winRate === null ? '-' : `${performance.winRate}%`],
      ['Round Diff', performance.roundDifferential]
    ];
  }
  return [
    ['Matches', performance.matchesPlayed],
    ['Wins', performance.wins],
    ['Top 3', performance.top3Finishes],
    ['Avg Placement', performance.averagePlacement],
    ['Total Kills', performance.totalKills],
    ['Total Points', performance.totalPoints]
  ];
};

const formLabel = (item, game) => {
  if (game === 'valorant') return item.result || '-';
  if (item.placement) return `#${item.placement}`;
  return '-';
};

const RosterCard = ({ member }) => (
  <Link
    to={`/player/${member.user.username}`}
    className="flex items-center gap-3 rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-3 hover:border-gaming-gold/60 transition-colors"
  >
    <UserAvatar user={member.user} size="md" />
    <div className="min-w-0 flex-1">
      <p className="text-white font-semibold truncate">{member.user.displayName || member.user.username}</p>
      <p className="text-xs text-gray-400">@{member.user.username}</p>
    </div>
    <div className="flex flex-col items-end gap-1 shrink-0">
      <span className={`badge ${member.isCaptain ? 'badge-warning' : 'badge-secondary'} capitalize`}>
        {member.role}
      </span>
      {member.isSubstitute && <span className="badge badge-primary">Sub</span>}
    </div>
  </Link>
);

const TournamentRow = ({ tournament }) => (
  <Link
    to={`/tournaments/${tournament.tournamentId}`}
    className="block rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4 hover:border-gaming-gold/60 transition-colors"
  >
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gaming-gold font-semibold uppercase">{tournament.gameLabel}</p>
        <h3 className="text-white font-bold text-lg truncate">{tournament.tournamentName}</h3>
        <p className="text-sm text-gray-400 mt-1">Registered as {tournament.teamName || 'Team'}</p>
      </div>
      <span className="badge badge-secondary capitalize shrink-0">{formatStatus(tournament.status)}</span>
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

const HistoryResult = ({ item }) => {
  const data = item.result?.data || {};
  if (item.result?.type === 'head_to_head') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
        <StatCard label="Score" value={`${data.scoreFor ?? '-'} - ${data.scoreAgainst ?? '-'}`} />
        <StatCard label="Opponent" value={data.opponent || '-'} />
        <StatCard label="Map" value={data.map || '-'} />
        <StatCard label="Winner" value={data.winner || '-'} />
      </div>
    );
  }
  if (item.result?.type === 'placement') {
    return (
      <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
        <StatCard label="Placement" value={data.placement ? `#${data.placement}` : '-'} />
        <StatCard label="Kills" value={data.kills ?? '-'} />
        <StatCard label="Points" value={data.points ?? '-'} />
      </div>
    );
  }
  return null;
};

const HistoryRow = ({ item }) => (
  <div className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-gaming-gold font-semibold uppercase">{formatStatus(item.confidence)}</p>
        <h3 className="text-white font-bold text-lg truncate">{item.tournament?.name || 'Verified Result'}</h3>
        <p className="text-xs text-gray-500 mt-1">{formatDate(item.occurredAt)}</p>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <span className="badge badge-primary uppercase">{item.gameType}</span>
        <span className="badge badge-success capitalize">{formatStatus(item.status)}</span>
      </div>
    </div>
    <HistoryResult item={item} />
  </div>
);

const TeamCompetitiveProfile = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.getTeamCompetitiveProfile(teamId);
        if (mounted) setProfile(response.data);
      } catch (err) {
        if (mounted) {
          setError(err.message || 'Team profile is unavailable right now.');
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadProfile();
    return () => {
      mounted = false;
    };
  }, [teamId]);

  if (loading) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center px-4">
        <div className="card-gaming p-8 text-center max-w-lg">
          <h1 className="text-2xl font-bold text-white mb-3">Team Not Found</h1>
          <p className="text-gray-400 mb-6">{error || 'This team profile could not be loaded.'}</p>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-primary">
            <FiArrowLeft className="mr-2" /> Back
          </button>
        </div>
      </div>
    );
  }

  const { team, captain, roster, tournaments, competitiveHistory, recentForm, coverage } = profile;
  const metrics = overviewMetrics(profile);

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
              {team.logo ? (
                <img src={team.logo} alt={`${team.name} logo`} className="h-24 w-24 rounded-lg object-cover border border-gaming-border" />
              ) : (
                <div className="h-24 w-24 rounded-lg bg-gaming-gold/10 text-gaming-gold flex items-center justify-center text-3xl font-bold">
                  {(team.tag || team.name || 'TM').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm text-gaming-gold font-semibold uppercase tracking-wide">Team Competitive Profile</p>
                <h1 className="text-3xl sm:text-5xl font-gaming font-bold text-white break-words">{team.name}</h1>
                <div className="flex flex-wrap gap-2 mt-3">
                  {team.tag && <span className="badge badge-primary">{team.tag}</span>}
                  <span className="badge badge-warning">{team.gameLabel}</span>
                  <span className="badge badge-secondary">{team.rosterSize}/{team.maxMembers} roster</span>
                  <span className="badge badge-secondary">Created {formatDate(team.createdAt)}</span>
                </div>
                {team.description && <p className="text-gray-300 mt-4 max-w-3xl">{team.description}</p>}
              </div>
            </div>
            <div className="rounded-lg border border-gaming-border bg-gaming-charcoal/70 p-4 min-w-[220px]">
              <p className="text-sm text-gray-400">Captain</p>
              {captain ? (
                <Link to={`/player/${captain.username}`} className="flex items-center gap-3 mt-3 hover:text-gaming-gold">
                  <UserAvatar user={captain} size="md" />
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{captain.displayName || captain.username}</p>
                    <p className="text-xs text-gray-400">@{captain.username}</p>
                  </div>
                </Link>
              ) : (
                <p className="text-gray-400 mt-2">Captain unavailable</p>
              )}
            </div>
          </div>
        </MotionSection>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-gaming p-5 border-gaming-gold/20">
            <p className="text-sm text-gray-400">Tournaments</p>
            <p className="text-3xl font-bold text-white mt-1">{profile.overview.tournamentsPlayed}</p>
          </div>
          <div className="card-gaming p-5 border-gaming-gold/20">
            <p className="text-sm text-gray-400">Verified Results</p>
            <p className="text-3xl font-bold text-white mt-1">{profile.overview.verifiedResults}</p>
          </div>
          <div className="card-gaming p-5 border-gaming-gold/20">
            <p className="text-sm text-gray-400">Roster</p>
            <p className="text-3xl font-bold text-white mt-1">{profile.overview.rosterCount}</p>
          </div>
          <div className="card-gaming p-5 border-gaming-gold/20">
            <p className="text-sm text-gray-400">Game</p>
            <p className="text-2xl font-bold text-white mt-1">{team.gameLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <MotionSection className="card-gaming p-6" delay={0.05}>
              <SectionHeader title="Statistics" icon={FiBarChart2} />
              <p className="text-sm text-gray-400 mb-4">{coverage.note}</p>
              {metrics.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {metrics.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}
                </div>
              ) : (
                <EmptyState title="No statistics yet" description="Verified result statistics will appear here when available." />
              )}
            </MotionSection>

            <MotionSection className="card-gaming p-6" delay={0.1}>
              <SectionHeader title="Tournament History" icon={FiCalendar} />
              {tournaments.length > 0 ? (
                <div className="space-y-3">
                  {tournaments.map((tournament) => <TournamentRow key={tournament.id} tournament={tournament} />)}
                </div>
              ) : (
                <EmptyState title="No tournaments yet" description="Public tournament participation will appear here." />
              )}
            </MotionSection>

            <MotionSection className="card-gaming p-6" delay={0.15}>
              <SectionHeader title="Competitive History" icon={FiActivity} />
              {competitiveHistory.length > 0 ? (
                <div className="space-y-3">
                  {competitiveHistory.map((item) => <HistoryRow key={item.id} item={item} />)}
                </div>
              ) : (
                <EmptyState title="No competitive history yet" description="Verified match results will appear here when available." />
              )}
            </MotionSection>
          </div>

          <div className="space-y-6">
            <MotionSection className="card-gaming p-6" delay={0.2}>
              <SectionHeader title="Roster" icon={FiUsers} />
              {roster.length > 0 ? (
                <div className="space-y-3">
                  {roster.map((member) => <RosterCard key={member.user.id} member={member} />)}
                </div>
              ) : (
                <EmptyState title="No public roster" description="Current roster members will appear here." />
              )}
            </MotionSection>

            <MotionSection className="card-gaming p-6" delay={0.25}>
              <SectionHeader title="Recent Form" icon={FiTarget} />
              {recentForm.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {recentForm.map((item, index) => (
                    <span key={`${item.occurredAt || index}-${index}`} className="rounded-lg bg-gaming-gold/10 text-gaming-gold border border-gaming-gold/30 px-3 py-2 font-bold">
                      {formLabel(item, team.game)}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyState title="No recent form" description="Recent verified results will appear here." />
              )}
            </MotionSection>

            <MotionSection className="card-gaming p-6" delay={0.3}>
              <SectionHeader title="Privacy" icon={FiShield} />
              <p className="text-sm text-gray-400">
                This page shows current public roster information and verified competitive data only.
              </p>
            </MotionSection>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamCompetitiveProfile;
