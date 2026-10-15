const ACTIVE_LEADERBOARD_GAMES = ['bgmi', 'freefire', 'valorant'];

const COVERAGE_NOTE = 'Rankings are based on verified competitive results available on Colab.';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const LOW_SAMPLE_THRESHOLD = 3;

const METRICS = {
  bgmi: 'totalPoints',
  freefire: 'totalPoints',
  valorant: 'wins'
};

module.exports = {
  ACTIVE_LEADERBOARD_GAMES,
  COVERAGE_NOTE,
  DEFAULT_LIMIT,
  LOW_SAMPLE_THRESHOLD,
  MAX_LIMIT,
  METRICS
};
