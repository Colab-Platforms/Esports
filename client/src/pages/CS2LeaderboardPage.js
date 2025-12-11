import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaTrophy, FaCrosshairs, FaSkull, FaHandsHelping, FaFire, FaStar } from 'react-icons/fa';
import { selectAuth } from '../../store/slices/authSlice';
import './CS2LeaderboardPage.css';

const CS2LeaderboardPage = () => {
  const navigate = useNavigate();
  const { user } = useSelector(selectAuth);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    limit: 50,
    serverId: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    console.log('🎮 CS2 Leaderboard Page Loaded - Enhanced Version');
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.serverId) params.append('serverId', filters.serverId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      // Use multi-server endpoint if no specific server filter
      const endpoint = filters.serverId 
        ? `${process.env.REACT_APP_API_URL}/api/cs2-leaderboard/registered-players?${params}`
        : `${process.env.REACT_APP_API_URL}/api/cs2-leaderboard/multi-server?${params}`;
      
      const response = await axios.get(endpoint);

      if (response.data.success) {
        console.log('Debug - API Response:', response.data);
        console.log('Debug - Leaderboard Data:', response.data.leaderboard);
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
            CS2 Leaderboard (Updated v2.0)
          </h1>
          <p className="header-subtitle">Top Counter-Strike 2 Players - Enhanced Version</p>
        </div>
      </div>

      {/* Personal Stats Cards */}
      {leaderboard.length > 0 && (
        <div className="stats-cards">
          {(() => {
            const currentUserData = user ? leaderboard.find(p => p.userId === user.id) : null;
            // Fallback to first player if no personal data found
            const displayData = currentUserData || leaderboard[0];
            const isPersonalData = !!currentUserData;
            console.log('Debug - Current User:', user?.id, 'Found Data:', currentUserData);
            console.log('Debug - Leaderboard Users:', leaderboard.map(p => ({ userId: p.userId, username: p.username })));
            return (
              <>
                <div className={`stat-card ${isPersonalData ? 'personal' : ''}`}>
                  <div className="stat-icon">
                    <FaTrophy />
                  </div>
                  <div className="stat-info">
                    <h3>#{displayData?.rank || 'N/A'}</h3>
                    <p>{isPersonalData ? 'Your Rank' : 'Top Rank'}</p>
                  </div>
                </div>
                <div className={`stat-card ${isPersonalData ? 'personal' : ''}`}>
                  <div className="stat-icon">
                    <FaCrosshairs />
                  </div>
                  <div className="stat-info">
                    <h3>{displayData?.stats?.total_kills || 0}</h3>
                    <p>{isPersonalData ? 'Your Kills' : 'Top Kills'}</p>
                  </div>
                </div>
                <div className={`stat-card ${isPersonalData ? 'personal' : ''}`}>
                  <div className="stat-icon">
                    <FaSkull />
                  </div>
                  <div className="stat-info">
                    <h3>{displayData?.stats?.total_deaths || 0}</h3>
                    <p>{isPersonalData ? 'Your Deaths' : 'Top Deaths'}</p>
                  </div>
                </div>
                <div className={`stat-card ${isPersonalData ? 'personal' : ''}`}>
                  <div className="stat-icon">
                    <FaStar />
                  </div>
                  <div className="stat-info">
                    <h3>{displayData?.stats?.kdr?.toFixed(2) || '0.00'}</h3>
                    <p>{isPersonalData ? 'Your K/D' : 'Top K/D'}</p>
                  </div>
                </div>
              </>
            );
          })()}
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
                  <th>Servers</th>
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
                    <td className="stat-cell servers">
                      {console.log('Debug - Player servers:', player.username, player.stats.servers_played, player.stats.servers_count)}
                      {player.stats.servers_played && player.stats.servers_played.length > 0 ? (
                        <div className="servers-info">
                          <span className="servers-count">{player.stats.servers_count || player.stats.servers_played.length}</span>
                          <div className="servers-list">
                            {player.stats.servers_played.map(serverId => (
                              <span key={serverId} className="server-badge">
                                S{serverId}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="no-servers">-</span>
                      )}
                    </td>
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
