import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaTrophy, FaCrosshairs, FaSkull, FaHandsHelping, FaFire, FaStar } from 'react-icons/fa';
import './CS2LeaderboardPage.css';

const CS2LeaderboardPage = () => {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    limit: 50,
    serverId: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchLeaderboard();
    fetchOverallStats();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.serverId) params.append('serverId', filters.serverId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/cs2-leaderboard/registered-players?${params}`
      );

      if (response.data.success) {
        setLeaderboard(response.data.leaderboard);
      } else {
        setError(response.data.message || 'Failed to fetch leaderboard');
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOverallStats = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/cs2-leaderboard/all-stats`
      );

      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyFilters = () => {
    fetchLeaderboard();
  };

  const getRankColor = (rank) => {
    if (rank === 1) return '#FFD700'; // Gold
    if (rank === 2) return '#C0C0C0'; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return '#fff';
  };

  const getRankIcon = (rank) => {
    if (rank <= 3) {
      return <FaTrophy style={{ color: getRankColor(rank), marginLeft: '5px' }} />;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="cs2-leaderboard-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading CS2 Leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cs2-leaderboard-page">
      {/* Header Section */}
      <div className="leaderboard-header">
        <div className="header-content">
          <h1>
            <FaCrosshairs className="header-icon" />
            CS2 Leaderboard
          </h1>
          <p className="header-subtitle">Top Counter-Strike 2 Players</p>
        </div>
      </div>

      {/* Overall Stats Cards */}
      {stats && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">
              <FaFire />
            </div>
            <div className="stat-info">
              <h3>{stats.total_matches || 0}</h3>
              <p>Total Matches</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FaCrosshairs />
            </div>
            <div className="stat-info">
              <h3>{stats.total_kills || 0}</h3>
              <p>Total Kills</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FaStar />
            </div>
            <div className="stat-info">
              <h3>{stats.unique_players || 0}</h3>
              <p>Active Players</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">
              <FaTrophy />
            </div>
            <div className="stat-info">
              <h3>{stats.total_rounds || 0}</h3>
              <p>Rounds Played</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Limit</label>
          <select name="limit" value={filters.limit} onChange={handleFilterChange}>
            <option value="10">Top 10</option>
            <option value="25">Top 25</option>
            <option value="50">Top 50</option>
            <option value="100">Top 100</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Server</label>
          <select name="serverId" value={filters.serverId} onChange={handleFilterChange}>
            <option value="">All Servers</option>
            <option value="1">Server 1</option>
            <option value="2">Server 2</option>
            <option value="3">Server 3</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Start Date</label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
          />
        </div>
        <div className="filter-group">
          <label>End Date</label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
          />
        </div>
        <button className="apply-filters-btn" onClick={applyFilters}>
          Apply Filters
        </button>
      </div>

      {/* Leaderboard Table */}
      <div className="leaderboard-container">
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        {leaderboard.length === 0 ? (
          <div className="no-data-message">
            <FaTrophy className="no-data-icon" />
            <h3>No Players Found</h3>
            <p>Connect your Steam account to appear on the leaderboard!</p>
            <button 
              className="connect-steam-btn"
              onClick={() => navigate('/profile-settings')}
            >
              Connect Steam Account
            </button>
          </div>
        ) : (
          <div className="leaderboard-table-wrapper">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th><FaCrosshairs /> Kills</th>
                  <th><FaSkull /> Deaths</th>
                  <th><FaHandsHelping /> Assists</th>
                  <th>K/D Ratio</th>
                  <th><FaFire /> Damage</th>
                  <th><FaStar /> MVP</th>
                  <th>Matches</th>
                  <th>Rounds</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((player) => (
                  <tr 
                    key={player.accountid}
                    className={player.rank <= 3 ? `top-${player.rank}` : ''}
                    onClick={() => navigate(`/profile/${player.userId}`)}
                  >
                    <td className="rank-cell">
                      <span className="rank-number" style={{ color: getRankColor(player.rank) }}>
                        #{player.rank}
                      </span>
                      {getRankIcon(player.rank)}
                    </td>
                    <td className="player-cell">
                      <div className="player-info">
                        <img 
                          src={player.avatar || '/default-avatar.png'} 
                          alt={player.username}
                          className="player-avatar"
                        />
                        <div className="player-details">
                          <span className="player-name">{player.displayName || player.username}</span>
                          <span className="player-username">@{player.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="stat-cell kills">{player.stats.total_kills}</td>
                    <td className="stat-cell deaths">{player.stats.total_deaths}</td>
                    <td className="stat-cell assists">{player.stats.total_assists}</td>
                    <td className="stat-cell kdr">
                      <span className={player.stats.kdr >= 1.5 ? 'kdr-high' : player.stats.kdr >= 1 ? 'kdr-medium' : 'kdr-low'}>
                        {player.stats.kdr.toFixed(2)}
                      </span>
                    </td>
                    <td className="stat-cell damage">{player.stats.total_damage.toLocaleString()}</td>
                    <td className="stat-cell mvp">{player.stats.total_mvp}</td>
                    <td className="stat-cell">{player.stats.matches_played}</td>
                    <td className="stat-cell">{player.stats.rounds_played}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CS2LeaderboardPage;
