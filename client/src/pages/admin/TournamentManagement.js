import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiCalendar, FiDollarSign, FiClock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../services/api';

const TournamentManagement = () => {
  const [tournaments, setTournaments] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [formStep, setFormStep] = useState(1); // 1: Game Selection, 2: Tournament Details
  const [selectedGame, setSelectedGame] = useState(null);

  // React Hook Form
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: '',
      gameType: '',
      description: '',
      mode: 'squad',
      format: 'elimination',
      entryFee: 0,
      prizePool: 0,
      maxParticipants: 100,
      startDate: '',
      endDate: '',
      registrationDeadline: '',
      rules: '',
      status: 'upcoming',
      roomDetails: {
        cs2: {
          serverName: '',
          serverIp: '',
          serverPort: '',
          password: '',
          gameMode: 'casual',
          mapName: '',
          rconPassword: ''
        },
        bgmi: {
          roomId: '',
          password: '',
          map: 'Erangel',
          perspective: 'TPP',
          mode: 'Squad'
        }
      }
    }
  });

  // Watch gameType to show conditional fields
  const selectedGameType = watch('gameType');

  // Helper: Convert game ID to gameType
  const getGameType = (gameId) => {
    const game = games.find(g => g._id === gameId);
    if (!game) return '';
    // Map game id to gameType (bgmi, valorant, cs2)
    const gameTypeMap = {
      'bgmi': 'bgmi',
      'valorant': 'valorant',
      'cs2': 'cs2',
      'freefire': 'bgmi', // Fallback
      'pubgpc': 'cs2', // Fallback
      'mobilelegends': 'bgmi' // Fallback
    };
    return gameTypeMap[game.id] || 'bgmi';
  };

  useEffect(() => {
    fetchTournaments();
    fetchGames();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await api.get('/api/tournaments');
      setTournaments(response.data?.tournaments || []);
    } catch (error) {
      console.error('Failed to fetch tournaments:', error);
      toast.error('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const fetchGames = async () => {
    try {
      // Add timestamp to bypass cache
      const timestamp = new Date().getTime();
      const response = await api.get(`/api/games?t=${timestamp}`);
      console.log('Games API Response:', response);
      console.log('Response type:', typeof response);
      console.log('Is array?', Array.isArray(response));
      
      // Handle different response formats
      let gamesData = [];
      
      // Direct array response (current backend)
      if (Array.isArray(response)) {
        gamesData = response;
      }
      // Wrapped response with data.games
      else if (response.data?.games) {
        gamesData = response.data.games;
      }
      // Wrapped response with just data array
      else if (Array.isArray(response.data)) {
        gamesData = response.data;
      }
      // Success flag with data
      else if (response.success && response.data) {
        gamesData = Array.isArray(response.data) ? response.data : response.data.games || [];
      }
      
      console.log('Final games data:', gamesData);
      console.log('Games count:', gamesData.length);
      setGames(gamesData);
      
      if (gamesData.length === 0) {
        console.warn('No games found in database');
        toast.error('No games found. Please add games first from Games Management.');
      } else {
        console.log(`✅ Loaded ${gamesData.length} games`);
      }
    } catch (error) {
      console.error('Failed to fetch games:', error);
      toast.error('Failed to load games. Check console for details.');
    }
  };

  const onSubmit = async (data) => {
    try {
      console.log('📤 Submitting tournament data:', data);
      
      // CS2 specific handling
      if (data.gameType === 'cs2') {
        // Set default values for CS2 tournaments
        data.description = data.description || 'CS2 Tournament';
        data.mode = 'team'; // Default mode for CS2
        data.format = 'elimination'; // Default format
        
        // Set dates with proper intervals if not provided
        const now = new Date();
        const twoDaysLater = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days later
        
        data.startDate = data.startDate || now.toISOString();
        data.endDate = data.endDate || twoDaysLater.toISOString(); // End date 2 days after start
        data.registrationDeadline = data.registrationDeadline || now.toISOString(); // Same as start date (CS2 doesn't use registration)
        
        // Auto-generate CS2 connect command
        if (data.roomDetails?.cs2) {
          const { serverIp, serverPort, password } = data.roomDetails.cs2;
          if (serverIp && serverPort) {
            data.roomDetails.cs2.connectCommand = `steam://connect/${serverIp}:${serverPort}${password ? '/' + password : ''}`;
          }
        }
      }
      
      if (editingTournament) {
        const response = await api.put(`/api/tournaments/${editingTournament._id}`, data);
        console.log('✅ Update response:', response);
        toast.success('Tournament updated successfully!');
      } else {
        const response = await api.post('/api/tournaments', data);
        console.log('✅ Create response:', response);
        toast.success('Tournament created successfully!');
      }
      
      setShowModal(false);
      reset();
      setEditingTournament(null);
      fetchTournaments();
    } catch (error) {
      console.error('❌ Failed to save tournament:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMsg = error.response?.data?.error?.message || 'Failed to save tournament';
      const errorDetails = error.response?.data?.error?.details;
      
      if (errorDetails && Array.isArray(errorDetails)) {
        console.error('Validation errors:', errorDetails);
        errorDetails.forEach(detail => {
          toast.error(`${detail.path}: ${detail.msg}`);
        });
      } else {
        toast.error(errorMsg);
      }
    }
  };

  const handleEdit = (tournament) => {
    setEditingTournament(tournament);
    
    // Set form values using react-hook-form
    reset({
      name: tournament.name,
      gameType: tournament.gameType || '',
      description: tournament.description || '',
      mode: tournament.mode || 'squad',
      format: tournament.format || 'elimination',
      entryFee: tournament.entryFee || 0,
      prizePool: tournament.prizePool || 0,
      maxParticipants: tournament.maxParticipants || 100,
      startDate: tournament.startDate ? new Date(tournament.startDate).toISOString().slice(0, 16) : '',
      endDate: tournament.endDate ? new Date(tournament.endDate).toISOString().slice(0, 16) : '',
      registrationDeadline: tournament.registrationDeadline ? new Date(tournament.registrationDeadline).toISOString().slice(0, 16) : '',
      rules: tournament.rules || '',
      status: tournament.status || 'upcoming',
      // CS2 server details
      roomDetails: {
        cs2: {
          serverIp: tournament.roomDetails?.cs2?.serverIp || '',
          serverPort: tournament.roomDetails?.cs2?.serverPort || '27015',
          password: tournament.roomDetails?.cs2?.password || '',
          rconPassword: tournament.roomDetails?.cs2?.rconPassword || ''
        }
      }
    });
    
    setShowModal(true);
  };

  const handleDelete = async (id, tournament) => {
    if (!window.confirm('Are you sure you want to delete this tournament?')) return;
    
    try {
      // Try normal delete first
      await api.delete(`/api/tournaments/${id}`);
      toast.success('Tournament deleted successfully!');
      fetchTournaments();
    } catch (error) {
      console.error('Failed to delete tournament:', error);
      
      // If tournament has participants, ask for force delete
      if (error.message?.includes('participants')) {
        const forceDelete = window.confirm(
          `This tournament has ${tournament?.currentParticipants || 'registered'} participants.\n\n` +
          'Force delete will remove all participants and delete the tournament.\n\n' +
          'Are you sure you want to proceed?'
        );
        
        if (forceDelete) {
          try {
            await api.delete(`/api/tournaments/${id}?force=true`);
            toast.success('Tournament force deleted successfully!');
            fetchTournaments();
          } catch (forceError) {
            console.error('Force delete failed:', forceError);
            toast.error('Failed to force delete tournament');
          }
        }
      } else {
        toast.error('Failed to delete tournament');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormStep(1);
    setSelectedGame(null);
    reset();
    setEditingTournament(null);
  };

  const handleGameSelect = (game) => {
    setSelectedGame(game);
    setValue('gameType', game.id);
    setFormStep(2);
  };

  const handleBackToGameSelection = () => {
    setFormStep(1);
    setSelectedGame(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-500/20 text-blue-400';
      case 'ongoing': return 'bg-green-500/20 text-green-400';
      case 'completed': return 'bg-gray-500/20 text-gray-400';
      case 'cancelled': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gaming-dark py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-gaming font-bold text-white mb-2">
              Tournament Management
            </h1>
            <p className="text-gray-400">Create and manage tournaments</p>
          </div>
          <button
            onClick={() => {
              reset();
              setEditingTournament(null);
              setShowModal(true);
            }}
            className="btn-gaming flex items-center space-x-2"
          >
            <FiPlus className="h-5 w-5" />
            <span>Create Tournament</span>
          </button>
        </div>

        {/* Tournaments List */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading tournaments...</div>
        ) : tournaments.length === 0 ? (
          <div className="card-gaming p-12 text-center">
            <FiCalendar className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Tournaments Yet</h3>
            <p className="text-gray-400 mb-6">Create your first tournament to get started</p>
            <button
              onClick={() => {
                reset();
                setEditingTournament(null);
                setShowModal(true);
              }}
              className="btn-gaming"
            >
              Create Tournament
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournament) => (
              <motion.div
                key={tournament._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-gaming p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{tournament.name}</h3>
                    <p className="text-sm text-gray-400">{tournament.gameId?.name || 'Unknown Game'}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(tournament.status)}`}>
                    {tournament.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-400">
                    <FiUsers className="h-4 w-4 mr-2" />
                    <span>{tournament.participants?.length || 0} / {tournament.maxParticipants} players</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-400">
                    <FiDollarSign className="h-4 w-4 mr-2" />
                    <span>Entry: ₹{tournament.entryFee} | Prize: ₹{tournament.prizePool}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-400">
                    <FiCalendar className="h-4 w-4 mr-2" />
                    <span>{new Date(tournament.startDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(tournament)}
                    className="flex-1 px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors flex items-center justify-center space-x-2"
                  >
                    <FiEdit2 className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(tournament._id, tournament)}
                    className="flex-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center justify-center space-x-2"
                  >
                    <FiTrash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card-gaming p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold text-white mb-6">
                {editingTournament ? 'Edit Tournament' : 'Create Tournament'}
              </h2>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Tournament Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Tournament Name *
                  </label>
                  <input
                    type="text"
                    {...register('name', { 
                      required: 'Tournament name is required',
                      minLength: { value: 3, message: 'Name must be at least 3 characters' },
                      maxLength: { value: 100, message: 'Name cannot exceed 100 characters' }
                    })}
                    className="input-gaming w-full"
                    placeholder="Enter tournament name"
                  />
                  {errors.name && (
                    <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
                  )}
                </div>

                {/* Game Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Game *
                  </label>
                  <select
                    {...register('gameType', { required: 'Game is required' })}
                    className="input-gaming w-full"
                    disabled={games.length === 0}
                  >
                    <option value="">
                      {games.length === 0 ? 'Loading games...' : 'Select a game'}
                    </option>
                    {games.map(game => {
                      // Map game.id to gameType (bgmi, valorant, cs2)
                      const gameTypeMap = {
                        'bgmi': 'bgmi',
                        'valorant': 'valorant',
                        'cs2': 'cs2',
                        'freefire': 'bgmi',
                        'pubgpc': 'cs2',
                        'mobilelegends': 'bgmi'
                      };
                      const gameType = gameTypeMap[game.id] || 'bgmi';
                      
                      return (
                        <option key={game._id} value={gameType}>
                          {game.icon} {game.name}
                        </option>
                      );
                    })}
                  </select>
                  {errors.gameType && (
                    <p className="text-red-400 text-xs mt-1">{errors.gameType.message}</p>
                  )}
                  {games.length === 0 && (
                    <p className="text-xs text-yellow-400 mt-1">
                      No games found. Add games from Games Management first.
                    </p>
                  )}
                </div>

                {/* Mode - Hidden for CS2 */}
                {selectedGameType !== 'cs2' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Tournament Mode *
                    </label>
                    <select
                      {...register('mode', { required: selectedGameType !== 'cs2' ? 'Mode is required' : false })}
                      className="input-gaming w-full"
                    >
                      <option value="solo">Solo</option>
                      <option value="duo">Duo</option>
                      <option value="squad">Squad</option>
                      <option value="team">Team</option>
                    </select>
                    {errors.mode && (
                      <p className="text-red-400 text-xs mt-1">{errors.mode.message}</p>
                    )}
                  </div>
                )}

                {/* Description - Hidden for CS2 */}
                {selectedGameType !== 'cs2' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Description *
                    </label>
                    <textarea
                      {...register('description', { 
                        required: selectedGameType !== 'cs2' ? 'Description is required' : false,
                        minLength: { value: 10, message: 'Description must be at least 10 characters' },
                        maxLength: { value: 1000, message: 'Description cannot exceed 1000 characters' }
                      })}
                      rows="3"
                      className="input-gaming w-full"
                      placeholder="Tournament description (10-1000 characters)"
                    />
                    {errors.description && (
                      <p className="text-red-400 text-xs mt-1">{errors.description.message}</p>
                    )}
                  </div>
                )}

                {/* Entry Fee & Prize Pool */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Entry Fee (₹)
                    </label>
                    <input
                      type="number"
                      {...register('entryFee', { 
                        valueAsNumber: true,
                        min: { value: 0, message: 'Entry fee cannot be negative' },
                        max: { value: 10000, message: 'Entry fee cannot exceed 10000' }
                      })}
                      className="input-gaming w-full"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Free tournaments recommended (0)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Prize Pool (₹) *
                    </label>
                    <input
                      type="number"
                      {...register('prizePool', { 
                        required: 'Prize pool is required',
                        valueAsNumber: true,
                        min: { value: 0, message: 'Prize pool cannot be negative' }
                      })}
                      className="input-gaming w-full"
                      placeholder="10000"
                    />
                    {errors.prizePool && (
                      <p className="text-red-400 text-xs mt-1">{errors.prizePool.message}</p>
                    )}
                  </div>
                </div>

                {/* Max Participants */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Max Participants *
                  </label>
                  <input
                    type="number"
                    {...register('maxParticipants', { 
                      required: 'Max participants is required',
                      valueAsNumber: true,
                      min: { value: 2, message: 'Must allow at least 2 participants' },
                      max: { value: 1000, message: 'Cannot exceed 1000 participants' }
                    })}
                    className="input-gaming w-full"
                    placeholder="100"
                  />
                  {errors.maxParticipants && (
                    <p className="text-red-400 text-xs mt-1">{errors.maxParticipants.message}</p>
                  )}
                </div>

                {/* Dates - Hidden for CS2 */}
                {selectedGameType !== 'cs2' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center">
                        <FiCalendar className="mr-1" /> Start Date *
                      </label>
                      <input
                        type="datetime-local"
                        {...register('startDate', { required: selectedGameType !== 'cs2' ? 'Start date is required' : false })}
                        className="input-gaming w-full"
                      />
                      {errors.startDate && (
                        <p className="text-red-400 text-xs mt-1">{errors.startDate.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center">
                        <FiCalendar className="mr-1" /> End Date *
                      </label>
                      <input
                        type="datetime-local"
                        {...register('endDate', { required: selectedGameType !== 'cs2' ? 'End date is required' : false })}
                        className="input-gaming w-full"
                      />
                      {errors.endDate && (
                        <p className="text-red-400 text-xs mt-1">{errors.endDate.message}</p>
                      )}
                    </div>
                    {/* Registration Deadline */}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center">
                        <FiClock className="mr-1" /> Registration Deadline *
                      </label>
                      <input
                        type="datetime-local"
                        {...register('registrationDeadline', { required: selectedGameType !== 'cs2' ? 'Registration deadline is required' : false })}
                        className="input-gaming w-full"
                      />
                      {errors.registrationDeadline && (
                        <p className="text-red-400 text-xs mt-1">{errors.registrationDeadline.message}</p>
                      )}
                      <p className="text-xs text-blue-400 mt-1">
                        ⚠️ Must be before or equal to start date
                      </p>
                    </div>
                  </div>
                )}

                {/* Format */}
                {/* Tournament Format - Hidden for CS2 */}
                {selectedGameType !== 'cs2' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Tournament Format *
                    </label>
                    <select
                      {...register('format', { required: selectedGameType !== 'cs2' ? 'Format is required' : false })}
                      className="input-gaming w-full"
                    >
                      <option value="">Select format</option>
                      <option value="elimination">Elimination</option>
                      <option value="round_robin">Round Robin</option>
                      <option value="swiss">Swiss</option>
                      <option value="battle_royale">Battle Royale</option>
                    </select>
                    {errors.format && (
                      <p className="text-red-400 text-xs mt-1">{errors.format.message}</p>
                    )}
                  </div>
                )}

                {/* Status - Different options for CS2 */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Status
                  </label>
                  <select
                    {...register('status')}
                    className="input-gaming w-full"
                  >
                    {selectedGameType === 'cs2' ? (
                      <>
                        <option value="active">Active</option>
                        <option value="upcoming">Inactive</option>
                      </>
                    ) : (
                      <>
                        <option value="upcoming">Upcoming</option>
                        <option value="registration_open">Registration Open</option>
                        <option value="registration_closed">Registration Closed</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </>
                    )}
                  </select>
                </div>

                {/* CS2 Specific Fields */}
                {selectedGameType === 'cs2' && (
                  <>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                      <h3 className="text-blue-400 font-bold mb-3 flex items-center">
                        <span className="mr-2">⚡</span>
                        CS2 Server Details
                      </h3>
                      
                      <div className="space-y-4">
                        {/* Server Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Server Name *
                          </label>
                          <input
                            type="text"
                            {...register('roomDetails.cs2.serverName', { 
                              required: selectedGameType === 'cs2' ? 'Server name is required' : false 
                            })}
                            className="input-gaming w-full"
                            placeholder="e.g., Mumbai Server 1"
                          />
                          {errors.roomDetails?.cs2?.serverName && (
                            <p className="text-red-400 text-xs mt-1">{errors.roomDetails.cs2.serverName.message}</p>
                          )}
                        </div>

                        {/* Server IP & Port */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              Server IP *
                            </label>
                            <input
                              type="text"
                              {...register('roomDetails.cs2.serverIp', { 
                                required: selectedGameType === 'cs2' ? 'Server IP is required' : false 
                              })}
                              className="input-gaming w-full"
                              placeholder="103.21.58.132"
                            />
                            {errors.roomDetails?.cs2?.serverIp && (
                              <p className="text-red-400 text-xs mt-1">{errors.roomDetails.cs2.serverIp.message}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              Server Port *
                            </label>
                            <input
                              type="text"
                              {...register('roomDetails.cs2.serverPort', { 
                                required: selectedGameType === 'cs2' ? 'Server port is required' : false 
                              })}
                              className="input-gaming w-full"
                              placeholder="27015"
                            />
                            {errors.roomDetails?.cs2?.serverPort && (
                              <p className="text-red-400 text-xs mt-1">{errors.roomDetails.cs2.serverPort.message}</p>
                            )}
                          </div>
                        </div>

                        {/* Server Password */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Server Password
                          </label>
                          <input
                            type="text"
                            {...register('roomDetails.cs2.password')}
                            className="input-gaming w-full"
                            placeholder="Optional server password"
                          />
                        </div>

                        {/* Game Mode */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Game Mode *
                          </label>
                          <select
                            {...register('roomDetails.cs2.gameMode', { 
                              required: selectedGameType === 'cs2' ? 'Game mode is required' : false 
                            })}
                            className="input-gaming w-full"
                          >
                            <option value="casual">Casual</option>
                            <option value="competitive">Competitive</option>
                            <option value="deathmatch">Deathmatch</option>
                            <option value="arms_race">Arms Race</option>
                            <option value="demolition">Demolition</option>
                            <option value="wingman">Wingman</option>
                          </select>
                          {errors.roomDetails?.cs2?.gameMode && (
                            <p className="text-red-400 text-xs mt-1">{errors.roomDetails.cs2.gameMode.message}</p>
                          )}
                        </div>

                        {/* Map Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            Map Name (Optional)
                          </label>
                          <input
                            type="text"
                            {...register('roomDetails.cs2.mapName')}
                            className="input-gaming w-full"
                            placeholder="e.g., de_dust2, de_mirage"
                          />
                        </div>

                        {/* RCON Password */}
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-2">
                            RCON Password (Optional)
                          </label>
                          <input
                            type="text"
                            {...register('roomDetails.cs2.rconPassword')}
                            className="input-gaming w-full"
                            placeholder="Admin RCON password"
                          />
                          <p className="text-xs text-gray-500 mt-1">For server administration</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Rules - Optional */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Rules (Optional)
                  </label>
                  <textarea
                    {...register('rules', { 
                      maxLength: { value: 5000, message: 'Rules cannot exceed 5000 characters' }
                    })}
                    rows="4"
                    className="input-gaming w-full"
                    placeholder="Tournament rules and regulations (10-5000 characters)"
                  />
                  {errors.rules && (
                    <p className="text-red-400 text-xs mt-1">{errors.rules.message}</p>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="flex space-x-4 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 btn-gaming disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Saving...' : editingTournament ? 'Update Tournament' : 'Create Tournament'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentManagement;
