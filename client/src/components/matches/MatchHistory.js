import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    fetchUserMatches,
    setMatchFilters,
    selectMatches,
    selectMatchLoading,
    selectMatchError,
    selectMatchPagination,
    selectMatchFilters,
    clearMatchError
} from '../../store/slices/matchSlice';

const MatchHistory = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const matches = useSelector(selectMatches);
    const loading = useSelector(selectMatchLoading);
    const error = useSelector(selectMatchError);
    const pagination = useSelector(selectMatchPagination);
    const filters = useSelector(selectMatchFilters);

    const [localFilters, setLocalFilters] = useState({
        status: '',
        gameType: ''
    });

    useEffect(() => {
        dispatch(fetchUserMatches({
            ...filters,
            page: pagination.page,
            limit: pagination.limit
        }));
    }, [dispatch, filters, pagination.page, pagination.limit]);

    const handleFilterChange = (filterType, value) => {
        const newFilters = { ...localFilters, [filterType]: value };
        setLocalFilters(newFilters);
        dispatch(setMatchFilters(newFilters));
    };

    const handlePageChange = (newPage) => {
        dispatch(fetchUserMatches({
            ...filters,
            page: newPage,
            limit: pagination.limit
        }));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'scheduled':
                return 'text-yellow-400 bg-yellow-400/10';
            case 'active':
                return 'text-green-400 bg-green-400/10';
            case 'completed':
                return 'text-blue-400 bg-blue-400/10';
            case 'disputed':
                return 'text-red-400 bg-red-400/10';
            case 'cancelled':
                return 'text-gray-400 bg-gray-400/10';
            default:
                return 'text-gray-400 bg-gray-400/10';
        }
    };

    const getGameIcon = (gameType) => {
        switch (gameType) {
            case 'bgmi':
                return '🎮';
            case 'valorant':
                return '🎯';
            case 'cs2':
                return '⚡';
            default:
                return '🎮';
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getUserResult = (match) => {
        // This would need the current user ID from auth state
        // For now, we'll return the first participant's result
        const participant = match.participants?.[0];
        return participant || {};
    };

    if (loading.matches) {
        return (
            <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gaming-neon mx-auto mb-4"></div>
                    <p className="text-gray-300">Loading match history...</p>
                </div>
            </div>
        );
    }

    if (error.matches) {
        return (
            <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-400 text-6xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-white mb-2">Error Loading Matches</h2>
                    <p className="text-gray-300 mb-4">{error.matches.message}</p>
                    <button
                        onClick={() => {
                            dispatch(clearMatchError('matches'));
                            dispatch(fetchUserMatches({ ...filters, page: 1 }));
                        }}
                        className="btn-primary"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gaming-dark">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="card-gaming p-6 mb-6">
                    <h1 className="text-2xl font-bold text-white mb-4">Match History</h1>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Status
                            </label>
                            <select
                                value={localFilters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                            >
                                <option value="">All Statuses</option>
                                <option value="scheduled">Scheduled</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="disputed">Disputed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Game Type
                            </label>
                            <select
                                value={localFilters.gameType}
                                onChange={(e) => handleFilterChange('gameType', e.target.value)}
                                className="px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                            >
                                <option value="">All Games</option>
                                <option value="bgmi">BGMI</option>
                                <option value="valorant">Valorant</option>
                                <option value="cs2">CS2</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Matches List */}
                {matches.length === 0 ? (
                    <div className="card-gaming p-8 text-center">
                        <div className="text-gray-400 text-6xl mb-4">🎮</div>
                        <h2 className="text-xl font-bold text-white mb-2">No Matches Found</h2>
                        <p className="text-gray-300 mb-4">
                            You haven't participated in any matches yet.
                        </p>
                        <button
                            onClick={() => navigate('/tournaments')}
                            className="btn-gaming"
                        >
                            Browse Tournaments
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {matches.map((match) => {
                            const userResult = getUserResult(match);

                            return (
                                <div key={match._id} className="card-gaming p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-4">
                                            <div className="text-2xl">{getGameIcon(match.gameType)}</div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">
                                                    {match.tournamentId?.name}
                                                </h3>
                                                <p className="text-gray-300">
                                                    Round {match.roundNumber}, Match #{match.matchNumber}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(match.status)}`}>
                                            {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <div className="text-sm text-gray-300">Scheduled</div>
                                            <div className="text-white font-medium">
                                                {formatDate(match.scheduledAt)}
                                            </div>
                                        </div>

                                        {match.startedAt && (
                                            <div>
                                                <div className="text-sm text-gray-300">Started</div>
                                                <div className="text-white font-medium">
                                                    {formatDate(match.startedAt)}
                                                </div>
                                            </div>
                                        )}

                                        {match.completedAt && (
                                            <div>
                                                <div className="text-sm text-gray-300">Completed</div>
                                                <div className="text-white font-medium">
                                                    {formatDate(match.completedAt)}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* User Performance */}
                                    {userResult.resultSubmittedAt && (
                                        <div className="bg-gaming-charcoal/50 p-4 rounded-lg mb-4">
                                            <h4 className="text-white font-medium mb-3">Your Performance</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                                                <div>
                                                    <div className="text-2xl font-bold text-gaming-neon">
                                                        {userResult.kills || 0}
                                                    </div>
                                                    <div className="text-xs text-gray-300">Kills</div>
                                                </div>
                                                <div>
                                                    <div className="text-2xl font-bold text-red-400">
                                                        {userResult.deaths || 0}
                                                    </div>
                                                    <div className="text-xs text-gray-300">Deaths</div>
                                                </div>
                                                <div>
                                                    <div className="text-2xl font-bold text-blue-400">
                                                        {userResult.assists || 0}
                                                    </div>
                                                    <div className="text-xs text-gray-300">Assists</div>
                                                </div>
                                                <div>
                                                    <div className="text-2xl font-bold text-yellow-400">
                                                        #{userResult.finalPosition || 0}
                                                    </div>
                                                    <div className="text-xs text-gray-300">Position</div>
                                                </div>
                                                <div>
                                                    <div className="text-2xl font-bold text-gaming-neon">
                                                        {userResult.score || 0}
                                                    </div>
                                                    <div className="text-xs text-gray-300">Score</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Match Actions */}
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => navigate(`/matches/${match._id}`)}
                                            className="btn-primary text-sm"
                                        >
                                            View Details
                                        </button>

                                        {match.status === 'active' && !userResult.resultSubmittedAt && (
                                            <button
                                                onClick={() => navigate(`/matches/${match._id}/submit-result`)}
                                                className="btn-gaming text-sm"
                                            >
                                                Submit Result
                                            </button>
                                        )}

                                        {match.status === 'completed' && match.disputeInfo?.isDisputed && (
                                            <span className="px-3 py-1 bg-red-500/10 text-red-400 text-sm rounded-lg">
                                                Disputed
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {pagination.total > pagination.limit && (
                    <div className="card-gaming p-4 mt-6">
                        <div className="flex items-center justify-between">
                            <div className="text-gray-300 text-sm">
                                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                                {pagination.total} matches
                            </div>

                            <div className="flex space-x-2">
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="px-3 py-1 bg-gaming-charcoal border border-gray-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-neon"
                                >
                                    Previous
                                </button>

                                <span className="px-3 py-1 bg-gaming-neon text-black rounded font-medium">
                                    {pagination.page}
                                </span>

                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page * pagination.limit >= pagination.total}
                                    className="px-3 py-1 bg-gaming-charcoal border border-gray-600 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-gaming-neon"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MatchHistory;