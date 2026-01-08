import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import api from '../services/api';
import GameIcon from '../components/common/GameIcon';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { createPortal } from 'react-dom';

const AdminBGMIRegistrations = () => {
  const user = useSelector(selectUser);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImagePreview, setShowImagePreview] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    status: 'all',
    tournamentId: '',
    teamName: '',
    playerName: '',
    group: ''
  });

  const [tournaments, setTournaments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    imagesUploaded: 0,
    verified: 0,
    rejected: 0,
    notVerified: 0
  });

  // Pagination & Caching
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [cache, setCache] = useState(new Map());
  const [lastFetch, setLastFetch] = useState(null);


  useEffect(() => {
    fetchTournaments();
    fetchRegistrations(1, false); // Start from page 1, no cache on initial load
  }, []);

  // Debounced effect for filters to prevent excessive API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchRegistrations(1, false); // Reset to page 1 when filters change, no cache
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [filters.status, filters.tournamentId, filters.teamName, filters.playerName, filters.group]); // Only specific filter values



  // CSV Download function
  const downloadCSV = async () => {
    try {
      setLoading(true);
      
      // Fetch all registrations with current filters (use multiple requests if needed)
      const queryParams = new URLSearchParams();
      queryParams.append('page', '1');
      queryParams.append('limit', '100'); // Use max allowed limit
      
      if (filters.status !== 'all') {
        queryParams.append('status', filters.status);
      }
      if (filters.tournamentId) {
        queryParams.append('tournamentId', filters.tournamentId);
      }
      if (filters.teamName) {
        queryParams.append('teamName', filters.teamName);
      }
      if (filters.playerName) {
        queryParams.append('playerName', filters.playerName);
      }
      if (filters.group) {
        queryParams.append('group', filters.group);
      }

      // Fetch all pages to get complete data
      let allRegistrations = [];
      let currentPage = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const pageParams = new URLSearchParams(queryParams);
        pageParams.set('page', currentPage.toString());
        
        const response = await api.get(`/api/bgmi-registration/admin/registrations?${pageParams}`);
        
        let pageRegistrations = [];
        if (response && response.success) {
          pageRegistrations = response.data?.registrations || [];
        } else if (response && response.registrations) {
          pageRegistrations = response.registrations || [];
        }

        if (pageRegistrations.length === 0) {
          hasMorePages = false;
        } else {
          allRegistrations = [...allRegistrations, ...pageRegistrations];
          currentPage++;
          
          // If we got less than the limit, we're on the last page
          if (pageRegistrations.length < 100) {
            hasMorePages = false;
          }
        }
      }

      if (allRegistrations.length === 0) {
        alert('No data to export');
        return;
      }

      // Create CSV content with only required columns
      const headers = [
        'Team Name',
        'Leader Name', 
        'Leader Email',
        'Leader Phone',
        'Player 1 IGN',
        'Player 1 UID',
        'Player 2 IGN', 
        'Player 2 UID',
        'Player 3 IGN',
        'Player 3 UID',
        'Status'
      ];

      const csvContent = [
        headers.join(','),
        ...allRegistrations.map(reg => [
          `"${reg.teamName || ''}"`,
          `"${reg.teamLeader?.name || ''}"`,
          `"${reg.userId?.email || ''}"`,
          `"${reg.teamLeader?.phone || ''}"`,
          `"${reg.teamMembers?.[0]?.name || ''}"`,
          `"${reg.teamMembers?.[0]?.bgmiId || ''}"`,
          `"${reg.teamMembers?.[1]?.name || ''}"`,
          `"${reg.teamMembers?.[1]?.bgmiId || ''}"`,
          `"${reg.teamMembers?.[2]?.name || ''}"`,
          `"${reg.teamMembers?.[2]?.bgmiId || ''}"`,
          `"${reg.status || ''}"`
        ].join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with current date and filters
      const date = new Date().toISOString().split('T')[0];
      const statusFilter = filters.status !== 'all' ? `_${filters.status}` : '';
      const tournamentFilter = filters.tournamentId ? `_${tournaments.find(t => t._id === filters.tournamentId)?.name || 'tournament'}` : '';
      const filename = `bgmi_registrations_${date}${statusFilter}${tournamentFilter}.csv`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess(`✅ CSV exported successfully! Downloaded ${allRegistrations.length} registrations.`);
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('❌ CSV export error:', error);
      setError('Failed to export CSV. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  const fetchTournaments = async () => {
    try {
      const response = await api.get('/api/tournaments');
      
      if (response.data.success) {
        // Fix case sensitivity - tournaments are stored as 'bgmi' (lowercase)
        const bgmiTournaments = response.data.data.tournaments.filter(t => 
          t.gameType === 'bgmi' || t.gameType === 'BGMI'
        );
        console.log('🔍 Found BGMI tournaments:', bgmiTournaments.length);
        console.log('🔍 Tournament names:', bgmiTournaments.map(t => `${t.name} (${t.status})`));
        setTournaments(bgmiTournaments);
      } else {
        // Try alternative response format
        if (response.data.tournaments) {
          const bgmiTournaments = response.data.tournaments.filter(t => 
            t.gameType === 'bgmi' || t.gameType === 'BGMI'
          );
          console.log('🔍 Found BGMI tournaments (alt format):', bgmiTournaments.length);
          setTournaments(bgmiTournaments);
        }
      }
    } catch (error) {
      console.error('❌ Fetch tournaments error:', error);
    }
  };

  const fetchRegistrations = async (page = 1, useCache = true) => {
    try {
      setLoading(true);
      
      // Debug logging
      console.log('🔍 DEBUG: Starting fetchRegistrations');
      console.log('🔍 DEBUG: User:', user);
      console.log('🔍 DEBUG: Token exists:', !!localStorage.getItem('token'));
      
      // Check cache first (30 second cache)
      const cacheKey = `${page}-${JSON.stringify(filters)}`;
      const now = Date.now();
      if (useCache && cache.has(cacheKey) && lastFetch && (now - lastFetch) < 30000) {
        const cachedData = cache.get(cacheKey);
        setRegistrations(cachedData.registrations);
        setStats(cachedData.stats);
        setPagination(cachedData.pagination);
        setLoading(false);
        return;
      }
      
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', pagination.limit.toString());
      
      if (filters.status !== 'all') {
        queryParams.append('status', filters.status);
      }
      if (filters.tournamentId) {
        queryParams.append('tournamentId', filters.tournamentId);
      }
      if (filters.teamName) {
        queryParams.append('teamName', filters.teamName);
      }
      if (filters.playerName) {
        queryParams.append('playerName', filters.playerName);
      }
      if (filters.group) {
        queryParams.append('group', filters.group);
      }

      const apiUrl = `/api/bgmi-registration/admin/registrations?${queryParams}`;
      console.log('🔍 DEBUG: API URL:', apiUrl);
      
      const response = await api.get(apiUrl);
      console.log('🔍 DEBUG: API Response:', response);
      
      if (response && response.success) {
        console.log('✅ Admin API Success - Setting data');
        const data = {
          registrations: response.data?.registrations || [],
          stats: response.data?.stats || {
            total: 0,
            pending: 0,
            imagesUploaded: 0,
            verified: 0,
            rejected: 0
          },
          pagination: response.data?.pagination || {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0
          }
        };
        
        setRegistrations(data.registrations);
        setStats(data.stats);
        setPagination(data.pagination);
        
        // Cache the data
        setCache(prev => new Map(prev.set(cacheKey, data)));
        setLastFetch(now);
        
        setError(''); // Clear any previous errors
      } else if (response && response.registrations) {
        // Handle direct response format
        console.log('✅ Direct format - Setting data');
        const data = {
          registrations: response.registrations || [],
          stats: response.stats || {
            total: 0,
            pending: 0,
            imagesUploaded: 0,
            verified: 0,
            rejected: 0
          },
          pagination: response.pagination || {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0
          }
        };
        
        setRegistrations(data.registrations);
        setStats(data.stats);
        setPagination(data.pagination);
        
        // Cache the data
        setCache(prev => new Map(prev.set(cacheKey, data)));
        setLastFetch(now);
        
        setError(''); // Clear any previous errors
      } else {
        console.error('❌ Admin API Failed - No data received');
        console.error('❌ Response structure:', response);
        setError('No registration data received from server. Check if you have admin privileges.');
      }
    } catch (error) {
      console.error('❌ Fetch registrations error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      if (error.response?.status === 401) {
        setError('Authentication required. Please login again.');
      } else if (error.response?.status === 403) {
        setError('Access denied. Admin privileges required. Contact administrator.');
      } else {
        setError(error.response?.data?.error?.message || error.message || 'Failed to fetch registrations. Check console for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (registrationId, newStatus, rejectionReason = null) => {
    try {
      setError('');
      setSuccess('');

      const payload = { status: newStatus };
      if (rejectionReason && rejectionReason.trim().length >= 5) {
        payload.rejectionReason = rejectionReason.trim();
      }

      console.log('🔄 Updating registration status:', { registrationId, newStatus, rejectionReason });
      console.log('📤 Payload being sent:', payload);
      const response = await api.put(`/api/bgmi-registration/admin/${registrationId}/status`, payload);
      
      console.log('📥 API Response (direct JSON):', response);
      console.log('📥 Response success field:', response.success);
      console.log('📥 Response type:', typeof response);
      
      // Fix: API service returns JSON directly, not axios response object
      // Check for success field in the JSON response
      const isSuccess = (response && response.success === true);
      
      console.log('✅ Success check result:', isSuccess);
      
      if (isSuccess) {
        // Extract registration data from JSON response
        // API returns: {success: true, data: {registration: {...}}}
        const updatedRegistration = response.data?.registration || response;
        const actualStatus = updatedRegistration?.status || newStatus;
        
        console.log('📋 Extracted registration:', updatedRegistration);
        console.log('📋 Actual status:', actualStatus);
        
        const statusMessages = {
          verified: '✅ Registration approved! WhatsApp verification message sent to user.',
          rejected: '❌ Registration rejected! WhatsApp notification sent to user.',
          pending: '⏳ Registration status updated to pending.',
          images_uploaded: '📸 Registration status updated to images uploaded.',
          not_verified: '❌ Registration marked as not verified.'
        };
        
        setSuccess(statusMessages[actualStatus] || `Registration ${actualStatus} successfully!`);
        console.log('✅ Status update successful, updating UI immediately...');
        
        // Update local state immediately for instant UI feedback
        const oldStatus = registrations.find(r => r._id === registrationId)?.status;
        
        setRegistrations(prevRegistrations => 
          prevRegistrations.map(reg => 
            reg._id === registrationId 
              ? { 
                  ...reg, 
                  status: actualStatus,
                  verificationDate: updatedRegistration?.verificationDate || new Date().toISOString(),
                  verifiedBy: updatedRegistration?.verifiedBy || { username: 'Admin' },
                  ...(actualStatus === 'rejected' && rejectionReason ? { rejectionReason } : {})
                }
              : reg
          )
        );
        
        // Update stats immediately
        if (oldStatus && oldStatus !== actualStatus) {
          setStats(prevStats => {
            const newStats = { ...prevStats };
            
            // Decrease old status count
            if (oldStatus === 'pending') newStats.pending = Math.max(0, newStats.pending - 1);
            else if (oldStatus === 'images_uploaded') newStats.imagesUploaded = Math.max(0, newStats.imagesUploaded - 1);
            else if (oldStatus === 'verified') newStats.verified = Math.max(0, newStats.verified - 1);
            else if (oldStatus === 'rejected') newStats.rejected = Math.max(0, newStats.rejected - 1);
            else if (oldStatus === 'not_verified') newStats.notVerified = Math.max(0, newStats.notVerified - 1);
            
            // Increase new status count
            if (actualStatus === 'pending') newStats.pending = (newStats.pending || 0) + 1;
            else if (actualStatus === 'images_uploaded') newStats.imagesUploaded = (newStats.imagesUploaded || 0) + 1;
            else if (actualStatus === 'verified') newStats.verified = (newStats.verified || 0) + 1;
            else if (actualStatus === 'rejected') newStats.rejected = (newStats.rejected || 0) + 1;
            else if (actualStatus === 'not_verified') newStats.notVerified = (newStats.notVerified || 0) + 1;
            
            return newStats;
          });
        }
        
        // Update selected registration if modal is open
        if (selectedRegistration && selectedRegistration._id === registrationId) {
          const updatedReg = { 
            ...selectedRegistration, 
            status: actualStatus,
            verificationDate: updatedRegistration?.verificationDate || new Date().toISOString(),
            verifiedBy: updatedRegistration?.verifiedBy || { username: 'Admin' }
          };
          if (actualStatus === 'rejected' && rejectionReason) {
            updatedReg.rejectionReason = rejectionReason;
          }
          console.log('🔄 Updating selected registration in modal:', updatedReg);
          setSelectedRegistration(updatedReg);
        }
        
        // Clear cache and refresh data in background
        setCache(new Map()); // Clear all cache
        setLastFetch(null); // Reset last fetch time
        
        // Force refresh data to ensure consistency
        setTimeout(async () => {
          try {
            console.log('🔄 Force refreshing data after status update...');
            await fetchRegistrations(pagination.page, false);
            console.log('✅ Data refreshed successfully');
          } catch (refreshError) {
            console.error('❌ Force refresh failed:', refreshError);
          }
        }, 1000); // 1 second delay to allow server to process
        
        // Don't close modal immediately - let user see the updated status
        // setSelectedRegistration(null);
        // setShowImageModal(false);
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        console.error('❌ Status update failed - Response:', JSON.stringify(response, null, 2));
        
        // Handle actual error responses
        let errorMessage = 'Failed to update registration status. Please try again.';
        
        try {
          if (typeof response === 'string') {
            errorMessage = response;
          } else if (response?.message && typeof response.message === 'string') {
            errorMessage = response.message;
          } else if (response?.error?.message && typeof response.error.message === 'string') {
            errorMessage = response.error.message;
          } else if (response?.error && typeof response.error === 'string') {
            errorMessage = response.error;
          }
        } catch (parseError) {
          console.error('❌ Error parsing response:', parseError);
          errorMessage = 'Failed to update registration status. Please try again.';
        }
        
        setError(errorMessage);
        throw new Error(errorMessage); // Throw error so calling functions know it failed
      }
    } catch (error) {
      console.error('❌ Status update error:', error);
      console.error('❌ Error response data:', error.response?.data);
      
      let errorMessage = 'Failed to update registration status. Please try again.';
      
      // Handle different error response formats and prevent object display
      try {
        if (error.response?.data) {
          const errorData = error.response.data;
          
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData.message && typeof errorData.message === 'string') {
            errorMessage = errorData.message;
          } else if (errorData.error?.message && typeof errorData.error.message === 'string') {
            errorMessage = errorData.error.message;
          } else if (errorData.error && typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else if (error.response.status === 400) {
            errorMessage = 'Invalid request data';
          } else if (error.response.status === 403) {
            errorMessage = 'You do not have permission to perform this action';
          } else if (error.response.status === 404) {
            errorMessage = 'Registration not found';
          } else if (error.response.status === 500) {
            errorMessage = 'Server error occurred. Please try again.';
          }
        } else if (error.message && typeof error.message === 'string') {
          errorMessage = error.message;
        } else {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
      } catch (parseError) {
        console.error('❌ Error parsing error response:', parseError);
        errorMessage = 'Failed to update registration status. Please try again.';
      }
      
      setError(errorMessage);
      throw new Error(errorMessage); // Throw error so calling functions know it failed
    }
  };

  const handleViewImages = (registration) => {
    try {
      console.log('🔍 Viewing registration details:', registration._id);
      console.log('📸 Registration data:', registration);
      console.log('📸 verificationImages field:', registration.verificationImages);
      
      // Clear any previous errors
      setError('');
      
      // Images are already in registration.verificationImages
      const images = registration.verificationImages || [];
      console.log('📸 Found images:', images.length);
      
      // Always open modal, even if no images
      setSelectedRegistration({
        ...registration,
        images: images // Use verificationImages from registration
      });
      setShowImageModal(true);
      console.log('✅ Modal opening with', images.length, 'images');
      
    } catch (error) {
      console.error('❌ View registration error:', error);
      setError('Failed to open registration details');
    }
  };

  // Function to assign groups to existing registrations
  const handleAssignGroups = async () => {
    if (!filters.tournamentId) {
      setError('Please select a tournament first');
      return;
    }

    const confirmed = window.confirm(
      'This will assign groups to all registrations in this tournament based on registration order.\n\n' +
      'Teams will be divided into groups (G1, G2, G3, etc.) according to the group size setting.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      const response = await api.post(`/api/bgmi-registration/admin/assign-groups/${filters.tournamentId}`);
      
      if (response && response.success) {
        setSuccess(`✅ ${response.message}`);
        // Clear cache and refresh data
        setCache(new Map());
        setLastFetch(null);
        await fetchRegistrations(pagination.page, false);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError('Failed to assign groups');
      }
    } catch (error) {
      console.error('❌ Assign groups error:', error);
      setError(error.response?.data?.error?.message || 'Failed to assign groups');
    } finally {
      setLoading(false);
    }
  };

  // Function to open image preview modal
  const handleImagePreview = (images, index) => {
    setCurrentImageIndex(index);
    setShowImagePreview(true);
  };

  // Direct approve function (for table buttons) - now works for all statuses
  const handleDirectApprove = async (registration) => {
    const statusText = registration.status === 'verified' ? 're-verify' : 'verify';
    const confirmed = window.confirm(`${statusText.charAt(0).toUpperCase() + statusText.slice(1)} registration for team "${registration.teamName}"?\n\nThis will send a WhatsApp verification message to the team.`);
    if (confirmed) {
      try {
        console.log(`🔄 Direct ${statusText} - updating status...`);
        await handleStatusUpdate(registration._id, 'verified');
        console.log(`✅ Direct ${statusText} completed`);
      } catch (error) {
        console.error(`❌ Direct ${statusText} failed:`, error);
        setError(`Failed to ${statusText} registration. Please try again.`);
      }
    }
  };

  // Direct reject function (for table buttons)
  const handleDirectReject = async (registration) => {
    const reason = window.prompt(`Enter rejection reason for team "${registration.teamName}":\n\nThis will send a WhatsApp notification to the team.`);
    if (reason && reason.trim()) {
      console.log('🔄 Direct reject - updating status...');
      await handleStatusUpdate(registration._id, 'rejected', reason.trim());
      console.log('✅ Direct reject completed');
    }
  };

  // Set registration to pending (for incomplete images or follow-up needed)
  const handleSetPending = async (registration) => {
    const isAlreadyPending = registration.status === 'pending';
    const actionText = isAlreadyPending ? 'update pending status' : 'set to pending';
    const promptText = isAlreadyPending 
      ? `Update pending status for "${registration.teamName}"?\n\nThis will remind the user to send images and update the timestamp.\n\nEnter reason (optional):`
      : `Set "${registration.teamName}" to pending status?\n\nEnter reason (optional):`;
    
    const reason = window.prompt(promptText);
    if (reason !== null) { // User didn't cancel
      try {
        console.log(`🔄 ${isAlreadyPending ? 'Updating' : 'Setting'} registration to pending...`);
        const pendingReason = reason.trim() || (isAlreadyPending ? 'Pending status updated by admin' : 'Set to pending status by admin');
        console.log('📝 Pending reason:', pendingReason, 'Length:', pendingReason.length);
        await handleStatusUpdate(registration._id, 'pending', pendingReason);
        console.log(`✅ ${isAlreadyPending ? 'Update' : 'Set to'} pending completed`);
      } catch (error) {
        console.error(`❌ ${isAlreadyPending ? 'Update' : 'Set'} pending failed:`, error);
        setError(`Failed to ${actionText}. Please try again.`);
      }
    }
  };

  // Mark registration as not verified (for wrong information or fake registrations)
  const handleNotVerified = async (registration) => {
    const reason = window.prompt(`Mark "${registration.teamName}" as NOT VERIFIED?\n\nEnter reason for not verifying:`);
    if (reason && reason.trim()) {
      try {
        console.log('🔄 Marking registration as not verified...');
        await handleStatusUpdate(registration._id, 'rejected', `Not Verified: ${reason.trim()}`);
        console.log('✅ Not verified completed');
      } catch (error) {
        console.error('❌ Not verified failed:', error);
        setError('Failed to mark registration as not verified. Please try again.');
      }
    }
  };

  const handleEditRegistration = (registration) => {
    // Open edit modal with registration data
    setSelectedRegistration(registration);
    setShowEditModal(true);
  };

  // Callback function to update registration from modal
  const handleUpdateRegistration = (updatedRegistration) => {
    // Update selectedRegistration state
    setSelectedRegistration(updatedRegistration);
    
    // Update the main registrations list
    setRegistrations(prevRegistrations => 
      prevRegistrations.map(reg => 
        reg._id === updatedRegistration._id 
          ? updatedRegistration
          : reg
      )
    );
  };

  const handleDeleteRegistration = async (registration) => {
    console.log('🗑️ Attempting to delete registration:', registration._id);
    
    if (!window.confirm(`Are you sure you want to delete team "${registration.teamName}"? This action cannot be undone.`)) {
      console.log('❌ Delete cancelled by user');
      return;
    }

    try {
      setError('');
      setSuccess('');

      console.log('🔄 Sending delete request...');
      const response = await api.delete(`/api/bgmi-registration/admin/${registration._id}`);
      
      console.log('📤 Delete API response:', response);
      
      // Check if response has data property (axios format) or is direct response
      const responseData = response.data || response;
      
      if (responseData && responseData.success) {
        setSuccess(`Team "${registration.teamName}" deleted successfully!`);
        console.log('✅ Delete successful, refreshing data...');
        
        // Clear cache and refresh data immediately
        setCache(new Map()); // Clear all cache
        setLastFetch(null); // Reset last fetch time
        await fetchRegistrations(pagination.page, false); // Force refresh without cache
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        console.error('❌ Delete API failed:', responseData);
        setError(responseData?.message || 'Failed to delete registration');
      }
    } catch (error) {
      console.error('❌ Delete registration error:', error);
      setError(error.response?.data?.error?.message || 'Failed to delete registration');
    }
  };

  const getStatusBadge = (registration) => {
    // Determine actual status based on rejection reason
    let actualStatus = registration.status;
    if (registration.status === 'rejected' && registration.rejectionReason?.startsWith('Not Verified')) {
      actualStatus = 'not_verified';
    }
    
    const badges = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      images_uploaded: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      verified: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
      not_verified: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    };
    
    const labels = {
      pending: 'Pending',
      images_uploaded: 'Images Uploaded',
      verified: 'Verified',
      rejected: 'Rejected',
      not_verified: 'Not Verified'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${badges[actualStatus]}`}>
        {labels[actualStatus]}
      </span>
    );
  };

  if (loading && registrations.length === 0) {
    return (
      <div className="min-h-screen bg-gaming-dark flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading registrations..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gaming-dark">
      <div className="w-full mx-auto px-3 sm:px-4 md:px-6 xl:px-8 py-4 md:py-6 xl:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center space-x-3">
                <GameIcon gameType="bgmi" size="lg" />
                <span>BGMI Admin Dashboard</span>
              </h1>
              <p className="text-gray-400 text-sm md:text-base">Manage BGMI tournament registrations and scoreboards</p>
            </div>
            <div>
              {/* Buttons */}
              <div className="flex space-x-2">
                {/* Assign Groups Button */}
                {filters.tournamentId && (
                  <button
                    onClick={handleAssignGroups}
                    className="px-3 md:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 text-sm md:text-base"
                    disabled={loading}
                    title="Assign groups to all registrations"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM6 20a9 9 0 0118 0v2h2v-2a11 11 0 00-22 0v2h2v-2z" />
                    </svg>
                    <span className="hidden sm:inline">Assign Groups</span>
                  </button>
                )}
                
                {/* Simple refresh button */}
                <button
                  onClick={() => {
                    setCache(new Map());
                    setLastFetch(null);
                    fetchRegistrations(pagination.page, false);
                  }}
                  className="px-3 md:px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors flex items-center space-x-2 text-sm md:text-base"
                  disabled={loading}
                >
                  <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-red-400">⚠️</span>
              <span className="text-red-400 font-medium">{error}</span>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Debug Info: Check browser console for more details. Try refreshing the page.
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-green-400">✅</span>
              <span className="text-green-400 font-medium">{success}</span>
            </div>
          </div>
        )}

        {/* Admin Registration Management */}
        <div className="card-gaming p-4 md:p-6 mb-6">
          <h3 className="text-lg xl:text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <span>Registration Management</span>
          </h3>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="card-gaming p-3 text-center">
              <div className="text-xl font-bold text-gaming-neon">{stats.total}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div className="card-gaming p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">{stats.pending}</div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
            <div className="card-gaming p-3 text-center">
              <div className="text-xl font-bold text-blue-400">{stats.imagesUploaded}</div>
              <div className="text-xs text-gray-400">Images</div>
            </div>
            <div className="card-gaming p-3 text-center">
              <div className="text-xl font-bold text-green-400">{stats.verified}</div>
              <div className="text-xs text-gray-400">Verified</div>
            </div>
            <div className="card-gaming p-3 text-center">
              <div className="text-xl font-bold text-red-400">{stats.rejected}</div>
              <div className="text-xs text-gray-400">Rejected</div>
            </div>
          </div>

          {/* Quick Filter Stats */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filters.status === 'all' 
                  ? 'bg-gaming-neon text-black font-medium' 
                  : 'bg-gaming-slate text-white hover:bg-gaming-charcoal'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'pending' }))}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filters.status === 'pending' 
                  ? 'bg-yellow-500 text-black font-medium' 
                  : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'images_uploaded' }))}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filters.status === 'images_uploaded' 
                  ? 'bg-blue-500 text-white font-medium' 
                  : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
              }`}
            >
              Images ({stats.imagesUploaded})
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'verified' }))}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filters.status === 'verified' 
                  ? 'bg-green-500 text-white font-medium' 
                  : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
              }`}
            >
              Verified ({stats.verified})
            </button>
            <button
              onClick={() => setFilters(prev => ({ ...prev, status: 'rejected' }))}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                filters.status === 'rejected' 
                  ? 'bg-red-500 text-white font-medium' 
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              }`}
            >
              Rejected ({stats.rejected})
            </button>
          </div>

          {/* Filters and Actions */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="images_uploaded">Images Uploaded</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tournament</label>
              <select
                value={filters.tournamentId}
                onChange={(e) => setFilters(prev => ({ ...prev, tournamentId: e.target.value }))}
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
              >
                <option value="">All Tournaments</option>
                {tournaments.map(tournament => (
                  <option key={tournament._id} value={tournament._id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Group</label>
              <select
                value={filters.group}
                onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
              >
                <option value="">All Groups</option>
                {/* Generate group options dynamically based on registrations */}
                {registrations.length > 0 && [...new Set(registrations.map(r => r.group).filter(Boolean))].sort().map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Team Name</label>
              <input
                type="text"
                value={filters.teamName}
                onChange={(e) => setFilters(prev => ({ ...prev, teamName: e.target.value }))}
                placeholder="Search team name..."
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Player Name</label>
              <input
                type="text"
                value={filters.playerName}
                onChange={(e) => setFilters(prev => ({ ...prev, playerName: e.target.value }))}
                placeholder="Search player name..."
                className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Actions</label>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setFilters({
                      status: 'all',
                      tournamentId: '',
                      teamName: '',
                      playerName: '',
                      group: ''
                    });
                  }}
                  className="flex-1 px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                  title="Clear all filters"
                >
                  Clear
                </button>
                <button
                  onClick={downloadCSV}
                  disabled={loading || registrations.length === 0}
                  className="flex-1 px-3 py-2 bg-gaming-neon text-black text-sm font-medium rounded-lg hover:bg-gaming-neon/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-1"
                  title="Download filtered data as CSV"
                >
                  {loading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>CSV</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Registration Cards */}
          {loading && registrations.length === 0 ? (
            <div className="space-y-4">
              {/* Desktop Skeleton */}
              <div className="hidden lg:block">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-gaming-slate/30 border border-gaming-slate rounded-lg p-4 mb-3 animate-pulse">
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                      <div className="col-span-1 h-4 bg-gaming-charcoal rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Mobile Skeleton */}
              <div className="lg:hidden space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-gaming-slate/30 border border-gaming-slate rounded-lg p-4 animate-pulse">
                    <div className="h-6 bg-gaming-charcoal rounded mb-3 w-3/4"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gaming-charcoal rounded w-full"></div>
                      <div className="h-4 bg-gaming-charcoal rounded w-5/6"></div>
                      <div className="h-4 bg-gaming-charcoal rounded w-4/6"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">No Data</div>
              <p className="text-gray-400">No registrations found</p>
              <p className="text-xs text-gray-500 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full bg-gaming-slate/30 border border-gaming-slate rounded-lg min-w-[800px]">
                  <thead className="bg-gaming-charcoal">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Leader</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Player 1 IGN</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Player 2 IGN</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Player 3 IGN</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Group</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tournament</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">WhatsApp</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Images</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Registered</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gaming-slate">
                    {registrations.map((registration) => (
                      <tr key={registration._id} className="hover:bg-gaming-slate/20 transition-colors">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">{registration.teamName}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-white">{registration.teamLeader.name}</div>
                          <div className="text-xs text-gray-400">{registration.teamLeader.bgmiId}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-white">{registration.userId?.email || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-white">{registration.teamMembers?.[0]?.name || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-white">{registration.teamMembers?.[1]?.name || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-white">{registration.teamMembers?.[2]?.name || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm font-medium text-gaming-neon">{registration.group || 'Not Assigned'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-white">{registration.tournamentId?.name || 'N/A'}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-white">{registration.whatsappNumber}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-white">{registration.verificationImages?.length || 0}/8</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {getStatusBadge(registration)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="text-sm text-white">{new Date(registration.registeredAt).toLocaleDateString()}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center space-x-1">
                            {/* View Details */}
                            <button
                              onClick={() => handleViewImages(registration)}
                              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors group relative"
                              title="View Details"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                View Details
                              </div>
                            </button>

                            {/* Approve (only for images_uploaded status) */}
                            {registration.status === 'images_uploaded' && (
                              <button
                                onClick={() => handleDirectApprove(registration)}
                                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors group relative"
                                title="Approve"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                  Approve
                                </div>
                              </button>
                            )}

                            {/* Reject (only for images_uploaded status) */}
                            {registration.status === 'images_uploaded' && (
                              <button
                                onClick={() => handleDirectReject(registration)}
                                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors group relative"
                                title="Reject"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                  Reject
                                </div>
                              </button>
                            )}

                            {/* Set Pending - Always show for all statuses */}
                            <button
                              onClick={() => handleSetPending(registration)}
                              className="p-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors group relative"
                              title={registration.status === 'pending' ? 'Already Pending - Click to Update' : 'Set Pending'}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                {registration.status === 'pending' ? 'Update Pending' : 'Set Pending'}
                              </div>
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => handleEditRegistration(registration)}
                              className="p-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors group relative"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                Edit
                              </div>
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteRegistration(registration)}
                              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors group relative"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                Delete
                              </div>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {registrations.map((registration) => (
                  <div key={registration._id} className="bg-gaming-slate/30 border border-gaming-slate rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-bold text-white">{registration.teamName}</h4>
                      {getStatusBadge(registration)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div>
                        <span className="text-gray-400">Leader:</span>
                        <div className="text-white">{registration.teamLeader.name}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Email:</span>
                        <div className="text-white">{registration.userId?.email || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Player 1 IGN:</span>
                        <div className="text-white">{registration.teamMembers?.[0]?.name || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Player 2 IGN:</span>
                        <div className="text-white">{registration.teamMembers?.[1]?.name || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Player 3 IGN:</span>
                        <div className="text-white">{registration.teamMembers?.[2]?.name || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Group:</span>
                        <div className="text-gaming-neon font-medium">{registration.group || 'Not Assigned'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Tournament:</span>
                        <div className="text-white">{registration.tournamentId?.name || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">WhatsApp:</span>
                        <div className="text-white">{registration.whatsappNumber}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Images:</span>
                        <div className="text-white">{registration.verificationImages?.length || 0}/8</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Registered:</span>
                        <div className="text-white">{new Date(registration.registeredAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-center space-x-2 pt-2">
                      {/* View Details */}
                      <button
                        onClick={() => handleViewImages(registration)}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        title="View Details"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>

                      {/* Approve (only for images_uploaded status) */}
                      {registration.status === 'images_uploaded' && (
                        <button
                          onClick={() => handleDirectApprove(registration)}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          title="Approve"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}

                      {/* Reject (only for images_uploaded status) */}
                      {registration.status === 'images_uploaded' && (
                        <button
                          onClick={() => handleDirectReject(registration)}
                          className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          title="Reject"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}

                      {/* Set Pending - Always show for all statuses */}
                      <button
                        onClick={() => handleSetPending(registration)}
                        className="p-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        title={registration.status === 'pending' ? 'Already Pending - Click to Update' : 'Set Pending'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleEditRegistration(registration)}
                        className="p-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteRegistration(registration)}
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-400">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} registrations
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => fetchRegistrations(pagination.page - 1, false)}
                  disabled={pagination.page <= 1 || loading}
                  className="px-3 py-1 bg-gaming-slate text-white text-sm rounded hover:bg-gaming-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 bg-gaming-neon text-black text-sm font-medium rounded">
                  {pagination.page} / {pagination.pages}
                </span>
                <button
                  onClick={() => fetchRegistrations(pagination.page + 1, false)}
                  disabled={pagination.page >= pagination.pages || loading}
                  className="px-3 py-1 bg-gaming-slate text-white text-sm rounded hover:bg-gaming-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tournament Scoreboard Management */}
        <div className="card-gaming p-4 md:p-6 mb-4 md:mb-6">
          <h3 className="text-lg xl:text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <span>Tournament Scoreboard Management</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Show all tournaments, not just completed ones */}
            {tournaments.map(tournament => (
              <TournamentScoreboardCard 
                key={tournament._id} 
                tournament={tournament}
                onScoreboardUploaded={() => {
                  setSuccess('Scoreboard uploaded successfully!');
                  setTimeout(() => setSuccess(''), 3000);
                }}
              />
            ))}
            
            {tournaments.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📊</div>
                <p>No BGMI tournaments found</p>
                <p className="text-sm">Create a tournament to upload scoreboards</p>
              </div>
            )}
          </div>
          
        </div>

        {/* Image Modal */}
        {showImageModal && selectedRegistration && (
          <ImageVerificationModal
            registration={selectedRegistration}
            onClose={() => {
              setShowImageModal(false);
              setSelectedRegistration(null);
            }}
            onStatusUpdate={handleStatusUpdate}
            getStatusBadge={getStatusBadge}
            onSetPending={handleSetPending}
            onNotVerified={handleNotVerified}
            onUpdateRegistration={handleUpdateRegistration}
            onImagePreview={handleImagePreview}
            setSuccess={setSuccess}
            setError={setError}
          />
        )}

        {/* Image Preview Modal */}
        {showImagePreview && selectedRegistration && selectedRegistration.verificationImages && (
          <ImagePreviewModal
            images={selectedRegistration.verificationImages.map(img => ({ url: img.cloudinaryUrl }))}
            currentIndex={currentImageIndex}
            onClose={() => setShowImagePreview(false)}
            onNavigate={(index) => setCurrentImageIndex(index)}
          />
        )}

        {/* Edit Modal */}
        {showEditModal && selectedRegistration && (
          <EditRegistrationModal
            registration={selectedRegistration}
            onClose={() => {
              setShowEditModal(false);
              setSelectedRegistration(null);
            }}
            onUpdate={() => {
              fetchRegistrations(pagination.page, false); // Refresh without cache
              setShowEditModal(false);
              setSelectedRegistration(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

// Image Verification Modal Component with WhatsApp Chat
const ImageVerificationModal = ({ 
  registration, 
  onClose, 
  onStatusUpdate, 
  getStatusBadge, 
  onSetPending, 
  onNotVerified,
  onDeleteImage,
  onUpdateRegistration,
  onImagePreview,
  setSuccess,
  setError
}) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingChat, setLoadingChat] = useState(true);
  const [deletingImage, setDeletingImage] = useState(null);
  const [loadingImages, setLoadingImages] = useState(false);

  // Function to refresh registration data
  const refreshRegistrationData = async () => {
    try {
      setLoadingImages(true);
      console.log('🔄 Refreshing registration data...');
      
      // Fetch updated registration data
      const response = await api.get(`/api/bgmi-registration/admin/registrations/${registration._id}`);
      
      if (response.success && response.data) {
        const updatedRegistration = response.data.registration || response.data;
        console.log('✅ Registration data refreshed');
        
        // Update the registration through parent callback
        if (onUpdateRegistration) {
          onUpdateRegistration(updatedRegistration);
        }
      } else {
        console.error('❌ Failed to refresh registration data');
      }
    } catch (error) {
      console.error('❌ Error refreshing registration data:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  // Debug logging
  console.log('🔍 Modal rendered with registration:', registration);
  console.log('📸 Modal images:', registration?.verificationImages?.length || 0);

  // Fetch chat messages when modal opens (NO AUTO-POLLING)
  useEffect(() => {
    if (registration?._id) {
      fetchChatMessages();
      // No automatic polling - user can manually refresh if needed
    }
  }, [registration?._id]);

  const fetchChatMessages = async (loadMore = false) => {
    try {
      if (!loadMore) setLoadingChat(true);
      
      // Use pagination to limit database reads (prevent Firebase-like limits)
      const page = loadMore ? Math.ceil(chatMessages.length / 20) + 1 : 1;
      const limit = 20; // Limit to 20 messages per request
      
      const response = await api.get(`/api/whatsapp/chat/${registration._id}?page=${page}&limit=${limit}`);
      
      // Handle multiple response formats
      let messages = [];
      if (response.data && response.data.success && response.data.data && response.data.data.messages) {
        messages = response.data.data.messages;
      } else if (response.data && Array.isArray(response.data)) {
        messages = response.data;
      } else if (response && Array.isArray(response)) {
        messages = response;
      } else if (response.data && response.data.messages) {
        messages = response.data.messages;
      } else if (response.messages) {
        messages = response.messages;
      }
      
      const formattedMessages = messages.map(msg => ({
        id: msg._id || msg.id || Date.now() + Math.random(),
        text: msg.content || msg.messageContent || msg.text || 'No content',
        sender: msg.direction === 'outgoing' ? 'admin' : 'user',
        timestamp: new Date(msg.queuedAt || msg.createdAt || Date.now()),
        status: msg.status || 'delivered',
        imageUrl: msg.imageUrl || null,
        messageType: msg.messageType || 'unknown'
      }));
      
      // Sort messages by timestamp (oldest first)
      formattedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      if (loadMore) {
        // Append new messages for pagination
        setChatMessages(prev => [...prev, ...formattedMessages]);
      } else {
        // Replace messages for initial load
        setChatMessages(formattedMessages);
      }
      
      // If no messages, show helpful test messages
      if (formattedMessages.length === 0 && !loadMore) {
        setChatMessages([
          {
            id: 'welcome',
            text: 'Chat interface is ready! Send a message to test WhatsApp integration.',
            sender: 'admin',
            timestamp: new Date(),
            status: 'delivered',
            messageType: 'system'
          }
        ]);
      }
      
    } catch (error) {
      console.error('❌ Failed to fetch chat messages:', error);
      // Show error but keep interface functional
      if (!loadMore) {
        setChatMessages([
          {
            id: 'error',
            text: `Error loading messages: ${error.message}. You can still send new messages.`,
            sender: 'admin',
            timestamp: new Date(),
            status: 'failed',
            messageType: 'error'
          }
        ]);
      }
    } finally {
      if (!loadMore) setLoadingChat(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingImage(imageId);
      console.log('🗑️ Deleting image:', imageId);
      console.log('🗑️ From registration:', registration._id);
      
      const response = await api.delete(`/api/whatsapp/image/${registration._id}/${imageId}`);
      console.log('🗑️ Delete response:', response.data);
      
      if (response.data && response.data.success) {
        // Update the registration data locally
        const updatedImages = registration.verificationImages.filter(img => img._id !== imageId);
        
        // Update registration through parent callback
        const updatedRegistration = {
          ...registration,
          verificationImages: updatedImages
        };
        
        // Call parent function to update registration
        if (onUpdateRegistration) {
          onUpdateRegistration(updatedRegistration);
        }
        
        // Show success message
        if (setSuccess) {
          setSuccess(`Image deleted successfully! Remaining images: ${updatedImages.length}/8`);
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            setSuccess('');
          }, 3000);
        }
        
        console.log('✅ Image deleted and UI updated');
      } else {
        throw new Error('Delete response was not successful');
      }
    } catch (error) {
      console.error('❌ Failed to delete image:', error);
      if (setError) {
        setError('Failed to delete image. Please try again.');
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          setError('');
        }, 5000);
      }
    } finally {
      setDeletingImage(null);
    }
  };

  const handleApprove = () => {
    onStatusUpdate(registration._id, 'verified');
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Please enter a rejection reason');
      return;
    }
    onStatusUpdate(registration._id, 'rejected', rejectionReason);
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim() || sendingMessage) return;

    setSendingMessage(true);
    const messageText = chatMessage.trim();
    setChatMessage('');

    // Add message to chat immediately (optimistic update)
    const newMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'admin',
      timestamp: new Date(),
      status: 'sending'
    };
    setChatMessages(prev => [...prev, newMessage]);

    try {
      console.log('📱 Sending message to registration:', registration._id);
      console.log('📱 Message content:', messageText);
      
      // Send message via API
      const response = await api.post(`/api/whatsapp/chat/${registration._id}/send`, {
        message: messageText
      });
      
      console.log('📱 Send message response:', response);

      // Handle both response formats
      let success = false;
      if (response.data && response.data.success) {
        success = true;
      } else if (response.success) {
        success = true;
      } else if (response && !response.error) {
        success = true; // Assume success if no error
      }

      if (success) {
        // Update message status to sent immediately
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === newMessage.id 
              ? { ...msg, status: 'delivered' } // Skip intermediate states for speed
              : msg
          )
        );
        console.log('✅ Message sent successfully');
        
        // No artificial delay - immediate status update
      } else {
        console.error('❌ Message send failed:', response);
        setChatMessages(prev => 
          prev.map(msg => 
            msg.id === newMessage.id 
              ? { ...msg, status: 'failed' }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('❌ Send message error:', error);
      setChatMessages(prev => 
        prev.map(msg => 
          msg.id === newMessage.id 
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
      console.log('❌ Error details:', error.response?.data);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gaming-dark border border-gaming-slate rounded-lg max-w-7xl w-full max-h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gaming-dark border-b border-gaming-slate p-4 md:p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Registration Details</h2>
            <p className="text-gray-400">Team: {registration.teamName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Split Screen Content - Responsive for 1300px+ */}
        <div className="flex flex-col xl:flex-row flex-1 overflow-hidden">
          {/* Left Side - Images & Team Info */}
          <div className="w-full xl:w-1/2 xl:border-r border-gaming-slate flex flex-col overflow-hidden">
            {/* Team Info Header - Compact */}
            <div className="bg-gaming-dark border-b border-gaming-slate p-2">
              <div className="bg-gaming-slate/30 border border-gaming-slate rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold text-white truncate">Team: {registration.teamName}</h3>
                  <div className="ml-2">{getStatusBadge(registration)}</div>
                </div>
                
                {/* Team Members - Compact Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                  {/* Team Leader */}
                  <div className="bg-gaming-neon/10 border border-gaming-neon/30 rounded p-1">
                    <div className="text-gaming-neon font-medium text-xs">👑 Leader</div>
                    <div className="text-white text-xs font-medium truncate">{registration.teamLeader.name}</div>
                    <div className="text-xs text-gray-400 truncate">{registration.teamLeader.bgmiId}</div>
                  </div>
                  
                  {/* Team Members */}
                  {registration.teamMembers.map((member, index) => (
                    <div key={index} className="bg-gaming-slate/50 border border-gray-600 rounded p-1">
                      <div className="text-gray-300 font-medium text-xs">👤 M{index + 1}</div>
                      <div className="text-white text-xs font-medium truncate">{member.name}</div>
                      <div className="text-xs text-gray-400 truncate">{member.bgmiId}</div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-1 text-xs text-gray-400 flex items-center justify-between">
                  <span>📱 {registration.whatsappNumber}</span>
                  <span>📅 {new Date(registration.registeredAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Images Section - Scrollable with Refresh */}
            <div className="flex-1 p-2 md:p-3 overflow-y-auto">
              <div className="bg-gaming-slate/20 border border-gaming-slate rounded-lg p-2 md:p-3">
                <div className="flex items-center justify-between mb-2 md:mb-3 sticky top-0 bg-gaming-slate/20 z-50 pb-2">
                  <h3 className="text-sm md:text-base font-bold text-white flex items-center">
                    <span>Images ({registration.verificationImages?.length || 0}/8)</span>
                    <span className="text-xs text-gray-400 ml-2">📱 WhatsApp</span>
                  </h3>
                  
                  {/* Refresh Images Button */}
                  <button
                    onClick={refreshRegistrationData}
                    disabled={loadingImages}
                    className="p-2 bg-gaming-slate hover:bg-gaming-charcoal rounded-lg transition-colors disabled:opacity-50"
                    title="Refresh Images"
                  >
                    <svg className={`w-4 h-4 text-white ${loadingImages ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                
                {registration.verificationImages && registration.verificationImages.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2 md:gap-3">
                    {registration.verificationImages.map((image, index) => (
                      <div key={image._id || index} className="border border-gaming-slate rounded-lg overflow-hidden hover:border-gaming-neon/50 transition-colors relative group">
                        {/* Delete Button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteImage(image._id);
                          }}
                          disabled={deletingImage === image._id}
                          className="absolute top-2 right-2 z-50 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                          title="Delete Image"
                        >
                          {deletingImage === image._id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                        
                        <img
                          src={image.cloudinaryUrl}
                          alt={`${image.playerId} - Image ${image.imageNumber}`}
                          className="w-full h-32 md:h-36 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => onImagePreview && onImagePreview(registration.verificationImages, index)}
                        />
                        <div className="p-2 bg-gaming-charcoal">
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-white font-medium">
                              {image.playerId === 'leader' ? '👑 Leader' : `👤 M${image.playerId.replace('member', '')}`}
                            </div>
                            <div className="text-xs text-gray-400">
                              {image.imageNumber === 1 ? '🆔 ID' : '🎮 BGMI'}
                            </div>
                          </div>
                          {image.caption && (
                            <div className="text-xs text-gaming-neon mt-1 truncate">
                              "{image.caption}"
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(image.uploadedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-5xl mb-3">📸</div>
                    <p className="text-gray-400 font-medium">No images received yet</p>
                    <p className="text-sm text-gray-500 mt-2">
                      User will send verification images via WhatsApp
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons Footer - Compact */}
            <div className="bg-gaming-dark border-t border-gaming-slate p-2">
              <div className="space-y-2">
                {registration.status === 'pending' && (
                  <>
                    <div className="text-center p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <div className="text-yellow-400 font-medium text-sm">⏳ Waiting for images</div>
                      <div className="text-xs text-gray-400 mt-1">User will send verification images via WhatsApp</div>
                    </div>
                    <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                      <button
                        onClick={handleApprove}
                        className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        ✅ Verify Now
                      </button>
                      <button
                        onClick={() => onNotVerified(registration)}
                        className="flex-1 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                      >
                        ❌ Not Verified
                      </button>
                    </div>
                  </>
                )}
                
                {registration.status === 'images_uploaded' && (
                  <>
                    <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                      <button
                        onClick={handleApprove}
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setShowRejectForm(true)}
                        className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                      <button
                        onClick={() => onSetPending(registration)}
                        className="flex-1 px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        Pending
                      </button>
                      <button
                        onClick={() => onNotVerified(registration)}
                        className="flex-1 px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        ❌ Not Verified
                      </button>
                    </div>
                  </>
                )}
                
                {registration.status === 'verified' && (
                  <>
                    <div className="text-center p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="text-green-400 font-medium text-sm">✅ Registration Approved</div>
                      <div className="text-xs text-gray-400 mt-1">WhatsApp verification message sent</div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onSetPending(registration)}
                        className="flex-1 px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        ⏳ Set Pending
                      </button>
                      <button
                        onClick={() => onNotVerified(registration)}
                        className="flex-1 px-3 py-1.5 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        ❌ Not Verified
                      </button>
                    </div>
                  </>
                )}
                
                {registration.status === 'rejected' && (
                  <>
                    <div className="text-center p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="text-red-400 font-medium text-sm">
                        {registration.rejectionReason?.startsWith('Not Verified') ? '❌ Not Verified' : '❌ Registration Rejected'}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Reason: {registration.rejectionReason}</div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleApprove}
                        className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        ✅ Verify Now
                      </button>
                      <button
                        onClick={() => onSetPending(registration)}
                        className="flex-1 px-3 py-1.5 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        ⏳ Set Pending
                      </button>
                    </div>
                  </>
                )}

                {/* Rejection Form */}
                {showRejectForm && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <h4 className="text-lg font-bold text-red-400 mb-3">Reject Registration</h4>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-red-400 focus:outline-none"
                      rows={3}
                    />
                    <div className="flex space-x-3 mt-3">
                      <button
                        onClick={handleReject}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectionReason('');
                        }}
                        className="px-4 py-2 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - WhatsApp Chat Interface */}
          <div className="w-full xl:w-1/2 border-t xl:border-t-0 xl:border-l border-gaming-slate flex flex-col overflow-hidden">
            {/* Chat Header */}
            <div className="bg-gaming-charcoal p-4 border-b border-gaming-slate">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.785"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-white font-medium">{registration.teamLeader.name}</div>
                    <div className="text-sm text-gray-400">+91 {registration.whatsappNumber}</div>
                  </div>
                </div>
                
                {/* Refresh Chat Button */}
                <button
                  onClick={() => fetchChatMessages(false)}
                  disabled={loadingChat}
                  className="p-2 bg-gaming-slate hover:bg-gaming-charcoal rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh Chat (Manual)"
                >
                  <svg className={`w-5 h-5 text-white ${loadingChat ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3 bg-gray-900">
              {loadingChat ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gaming-neon mx-auto mb-2"></div>
                  <p className="text-gray-400 text-sm">Loading chat messages...</p>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-2">💬</div>
                  <p className="text-gray-400">Start a conversation</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Send messages directly to user's WhatsApp
                  </p>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs xl:max-w-md px-4 py-2 rounded-lg ${
                        message.sender === 'admin'
                          ? 'bg-green-500 text-white'
                          : 'bg-gaming-slate text-white'
                      }`}
                    >
                      {message.imageUrl && (
                        <img 
                          src={message.imageUrl} 
                          alt="Shared image" 
                          className="w-full h-32 object-cover rounded mb-2 cursor-pointer"
                          onClick={() => window.open(message.imageUrl, '_blank')}
                        />
                      )}
                      <p className="text-sm">{message.text}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs opacity-70">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {message.sender === 'admin' && (
                          <span className="text-xs opacity-70 ml-2">
                            {message.status === 'sending' && '⏳'}
                            {message.status === 'sent' && '✓'}
                            {message.status === 'delivered' && '✓✓'}
                            {message.status === 'read' && '✓✓'}
                            {message.status === 'failed' && '❌'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <div className="bg-gaming-charcoal p-2 md:p-4 border-t border-gaming-slate">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-gaming-dark border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                  disabled={sendingMessage}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatMessage.trim() || sendingMessage}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? (
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Quick Message Templates */}
              <div className="flex flex-wrap gap-1 md:gap-2 mt-2 md:mt-3">
                <button
                  onClick={() => setChatMessage('Please send your verification images as requested.')}
                  className="px-2 md:px-3 py-1 bg-gaming-slate text-xs text-white rounded-full hover:bg-gaming-charcoal transition-colors"
                >
                  📸 Images
                </button>
                <button
                  onClick={() => setChatMessage('Your registration is under review. We will update you soon.')}
                  className="px-2 md:px-3 py-1 bg-gaming-slate text-xs text-white rounded-full hover:bg-gaming-charcoal transition-colors"
                >
                  ⏳ Review
                </button>
                <button
                  onClick={() => setChatMessage('Thank you for your registration. Good luck in the tournament!')}
                  className="px-2 md:px-3 py-1 bg-gaming-slate text-xs text-white rounded-full hover:bg-gaming-charcoal transition-colors"
                >
                  🍀 Good Luck
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Edit Registration Modal Component
const EditRegistrationModal = ({ registration, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    teamName: registration.teamName,
    teamLeader: { ...registration.teamLeader },
    teamMembers: [...registration.teamMembers],
    whatsappNumber: registration.whatsappNumber
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (section, field, value, index = null) => {
    setFormData(prev => {
      if (section === 'teamLeader') {
        return {
          ...prev,
          teamLeader: { ...prev.teamLeader, [field]: value }
        };
      } else if (section === 'teamMembers') {
        const updatedMembers = [...prev.teamMembers];
        updatedMembers[index] = { ...updatedMembers[index], [field]: value };
        return { ...prev, teamMembers: updatedMembers };
      } else {
        return { ...prev, [field]: value };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔄 Updating registration:', registration._id);
      console.log('📝 Form data:', formData);
      
      // Validate form data before sending
      if (!formData.teamName || formData.teamName.trim().length < 3) {
        setError('Team name must be at least 3 characters');
        setLoading(false);
        return;
      }
      
      if (!formData.teamLeader.name || !formData.teamLeader.bgmiId || !formData.teamLeader.phone) {
        setError('Team leader information is incomplete');
        setLoading(false);
        return;
      }
      
      if (formData.teamMembers.length !== 3) {
        setError('Team must have exactly 3 members');
        setLoading(false);
        return;
      }
      
      // Check for duplicate BGMI IDs
      const allBgmiIds = [formData.teamLeader.bgmiId, ...formData.teamMembers.map(m => m.bgmiId)];
      const uniqueBgmiIds = [...new Set(allBgmiIds)];
      if (allBgmiIds.length !== uniqueBgmiIds.length) {
        setError('All team members must have unique BGMI IDs');
        setLoading(false);
        return;
      }
      
      // Ensure team members have required fields
      for (let i = 0; i < formData.teamMembers.length; i++) {
        if (!formData.teamMembers[i].name || !formData.teamMembers[i].bgmiId) {
          setError(`Team member ${i + 1} information is incomplete`);
          setLoading(false);
          return;
        }
      }
      
      const response = await api.put(`/api/bgmi-registration/admin/${registration._id}`, formData);
      
      console.log('📥 Update response:', response);
      
      if (response.success) {
        console.log('✅ Registration updated successfully');
        onUpdate();
      } else {
        console.error('❌ Update failed:', response);
        setError(response.message || 'Failed to update registration');
      }
    } catch (error) {
      console.error('❌ Update registration error:', error);
      console.error('❌ Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // More specific error messages
      if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error?.message || error.response?.data?.message;
        if (errorMsg?.includes('unique BGMI IDs')) {
          setError('All team members must have unique BGMI IDs');
        } else if (errorMsg?.includes('exactly 3 members')) {
          setError('Team must have exactly 3 members');
        } else if (errorMsg?.includes('validation')) {
          setError('Please check all required fields are filled correctly');
        } else {
          setError(errorMsg || 'Invalid data provided');
        }
      } else if (error.response?.status === 404) {
        setError('Registration not found');
      } else if (error.response?.status === 403) {
        setError('You do not have permission to edit this registration');
      } else {
        setError('Failed to update registration. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gaming-dark border border-gaming-slate rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gaming-dark border-b border-gaming-slate p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Edit Registration</h2>
            <p className="text-gray-400">Team: {registration.teamName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <span className="text-red-400">{error}</span>
            </div>
          )}

          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Team Name</label>
            <input
              type="text"
              value={formData.teamName}
              onChange={(e) => handleInputChange('', 'teamName', e.target.value)}
              className="w-full px-4 py-3 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
            />
          </div>

          {/* Team Leader */}
          <div className="bg-gaming-charcoal rounded-lg p-6">
            <h3 className="text-lg font-bold text-gaming-neon mb-4">👑 Team Leader</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.teamLeader.name}
                  onChange={(e) => handleInputChange('teamLeader', 'name', e.target.value)}
                  className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">BGMI ID</label>
                <input
                  type="text"
                  value={formData.teamLeader.bgmiId}
                  onChange={(e) => handleInputChange('teamLeader', 'bgmiId', e.target.value)}
                  className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.teamLeader.phone}
                  onChange={(e) => handleInputChange('teamLeader', 'phone', e.target.value)}
                  className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-gaming-charcoal rounded-lg p-6">
            <h3 className="text-lg font-bold text-gaming-neon mb-4">👥 Team Members</h3>
            {formData.teamMembers.map((member, index) => (
              <div key={index} className="mb-6 last:mb-0">
                <h4 className="text-md font-medium text-white mb-3">Member {index + 1}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
                    <input
                      type="text"
                      value={member.name}
                      onChange={(e) => handleInputChange('teamMembers', 'name', e.target.value, index)}
                      className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">BGMI ID</label>
                    <input
                      type="text"
                      value={member.bgmiId}
                      onChange={(e) => handleInputChange('teamMembers', 'bgmiId', e.target.value, index)}
                      className="w-full px-3 py-2 bg-gaming-slate border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* WhatsApp Number */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">WhatsApp Number</label>
            <input
              type="tel"
              value={formData.whatsappNumber}
              onChange={(e) => handleInputChange('', 'whatsappNumber', e.target.value)}
              className="w-full px-4 py-3 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gaming-slate text-white rounded-lg hover:bg-gaming-charcoal transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-gaming-neon text-gaming-dark font-bold rounded-lg hover:bg-gaming-neon/90 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Registration'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// Tournament Scoreboard Card Component
const TournamentScoreboardCard = ({ tournament, onScoreboardUploaded }) => {
  const [uploading, setUploading] = useState(false);
  const [scoreboards, setScoreboards] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    imageUrl: '',
    description: 'Tournament Results',
    uploadMethod: 'url',
    file: null
  });

  useEffect(() => {
    fetchScoreboards();
  }, [tournament._id]);

  // Refresh gallery when component becomes visible again (user returns to page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refresh gallery
        fetchScoreboards(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tournament._id]);

  // Add CSS and escape key handling for modal
  useEffect(() => {
    if (showUploadModal) {
      // Add CSS to ensure modal appears on top
      const style = document.createElement('style');
      style.id = 'upload-modal-styles';
      style.textContent = `
        .upload-modal-portal {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          z-index: 2147483647 !important;
          pointer-events: auto !important;
        }
        .upload-modal-content {
          z-index: 2147483647 !important;
          position: relative !important;
          pointer-events: auto !important;
        }
      `;
      document.head.appendChild(style);
      
      // Add escape key listener
      const handleEscape = (e) => {
        if (e.key === 'Escape') {
          setShowUploadModal(false);
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        const existingStyle = document.getElementById('upload-modal-styles');
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [showUploadModal]);

  const fetchScoreboards = async (forceRefresh = false) => {
    try {
      // Add cache-busting parameter for force refresh
      const url = forceRefresh 
        ? `/api/tournaments/${tournament._id}/scoreboards?t=${Date.now()}`
        : `/api/tournaments/${tournament._id}/scoreboards`;
        
      const response = await api.get(url);
      if (response.data && response.data.success) {
        setScoreboards(response.data.data.scoreboards);
      } else if (response.success) {
        setScoreboards(response.data.scoreboards);
      }
    } catch (error) {
      console.error('Error fetching scoreboards:', error);
      // Set empty array on error to prevent stale data
      setScoreboards([]);
    }
  };

  const handleUploadScoreboard = async () => {
    if (uploadData.uploadMethod === 'file' && !uploadData.file) {
      alert('Please select an image file');
      return;
    }
    
    if (uploadData.uploadMethod === 'url' && !uploadData.imageUrl.trim()) {
      alert('Please enter image URL');
      return;
    }

    try {
      setUploading(true);
      
      let imageUrl = uploadData.imageUrl;
      
      // If file upload, first upload to server
      if (uploadData.uploadMethod === 'file' && uploadData.file) {
        const formData = new FormData();
        formData.append('image', uploadData.file);
        formData.append('type', 'scoreboard');
        
        const uploadResponse = await api.post('/api/upload/image', formData);
        
        if (uploadResponse && uploadResponse.success) {
          imageUrl = uploadResponse.data.imageUrl;
        } else {
          throw new Error('Failed to upload image file');
        }
      }
      
      // Upload scoreboard with image URL
      const response = await api.post(`/api/tournaments/${tournament._id}/scoreboards`, {
        imageUrl,
        description: uploadData.description
      });
      
      if (response && response.success) {
        // Refresh the gallery immediately after successful upload
        await fetchScoreboards(true); // Force refresh with cache-busting
        
        setUploadData({ 
          imageUrl: '', 
          description: 'Tournament Results',
          uploadMethod: 'url',
          file: null
        });
        setShowUploadModal(false);
        
        alert('✅ Scoreboard uploaded successfully!\n\n📍 Where to find it:\n• Tournament page → RESULTS tab\n• Homepage → BGMI Leaderboard\n• Admin panel → Gallery below');
        
        onScoreboardUploaded();
      } else {
        throw new Error(response?.message || 'Failed to create scoreboard entry');
      }
    } catch (error) {
      console.error('❌ Upload scoreboard error:', error);
      
      let errorMessage = 'Failed to upload scoreboard. ';
      
      if (error.message.includes('NO_TOKEN') || error.message.includes('Access denied')) {
        errorMessage += 'Authentication required. Please login again.';
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (error.message.includes('ADMIN_ACCESS_REQUIRED')) {
        errorMessage += 'Admin privileges required to upload scoreboards.';
      } else if (error.message.includes('TOURNAMENT_NOT_FOUND')) {
        errorMessage += 'Tournament not found.';
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      
      alert(`❌ ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteScoreboard = async (scoreboardId) => {
    if (!window.confirm('Are you sure you want to delete this scoreboard?')) return;

    try {
      await api.delete(`/api/tournaments/${tournament._id}/scoreboards/${scoreboardId}`);
      // Refresh the gallery after successful deletion
      await fetchScoreboards(true);
      alert('Scoreboard deleted successfully!');
    } catch (error) {
      console.error('Error deleting scoreboard:', error);
      alert('Failed to delete scoreboard');
    }
  };

  return (
    <div className="bg-gaming-slate/30 border border-gaming-slate rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-bold text-white text-sm">{tournament.name}</h4>
          <p className="text-xs text-gray-400">
            Status: <span className={`font-medium ${
              tournament.status === 'completed' ? 'text-green-400' : 
              tournament.status === 'active' ? 'text-blue-400' : 'text-yellow-400'
            }`}>{tournament.status}</span>
          </p>
          <p className="text-xs text-gray-400">
            {scoreboards.length} scoreboard{scoreboards.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => fetchScoreboards(true)}
            className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors"
            title="Refresh Gallery"
          >
            🔄
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-1 bg-gaming-neon text-black text-xs font-bold rounded hover:bg-gaming-neon/80 transition-colors"
          >
            Upload
          </button>
        </div>
        

      </div>

      {/* Scoreboard Gallery */}
      {scoreboards.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {scoreboards.slice(0, 4).map((scoreboard, index) => (
            <div key={scoreboard._id} className="relative group">
              <img
                src={scoreboard.imageUrl}
                alt={scoreboard.description}
                className="w-full h-16 object-cover rounded border border-gaming-border"
              />
              <button
                onClick={() => handleDeleteScoreboard(scoreboard._id)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
          {scoreboards.length > 4 && (
            <div className="flex items-center justify-center bg-gaming-charcoal rounded border border-gaming-border text-xs text-gray-400">
              +{scoreboards.length - 4} more
            </div>
          )}
        </div>
      )}

      {/* Upload Modal - React Portal for Maximum Z-Index */}
      {showUploadModal && createPortal(
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 upload-modal-portal"
          style={{ 
            zIndex: 2147483647, // Maximum z-index value
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'auto'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUploadModal(false);
            }
          }}
        >
          <div 
            className="bg-gaming-card border-2 border-gaming-neon rounded-lg p-6 w-full max-w-md shadow-2xl upload-modal-content" 
            style={{ 
              zIndex: 2147483647, // Maximum z-index
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 0 2px rgba(34, 197, 94, 0.8)',
              position: 'relative',
              backgroundColor: '#1a1a1a',
              border: '2px solid #22c55e',
              maxHeight: '90vh',
              overflowY: 'auto',
              pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4" style={{ zIndex: 2147483647, position: 'relative' }}>
              <h3 className="text-lg font-bold text-white">Upload Scoreboard</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-red-500/20 rounded"
                style={{ zIndex: 2147483647, position: 'relative' }}
                title="Close Modal (ESC)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Info about where scoreboards will appear */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-blue-400 font-medium text-sm">Where will this appear?</span>
                </div>
                <ul className="text-xs text-gray-300 space-y-1">
                  <li>• Tournament detail page → RESULTS tab</li>
                  <li>• Homepage → BGMI Leaderboard section</li>
                  <li>• Admin panel → Scoreboard gallery below</li>
                </ul>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Method
                </label>
                <div className="flex space-x-4 mb-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadMethod"
                      value="url"
                      checked={uploadData.uploadMethod !== 'file'}
                      onChange={() => setUploadData(prev => ({ ...prev, uploadMethod: 'url', file: null }))}
                      className="mr-2"
                    />
                    <span className="text-white text-sm">Image URL</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="uploadMethod"
                      value="file"
                      checked={uploadData.uploadMethod === 'file'}
                      onChange={() => setUploadData(prev => ({ ...prev, uploadMethod: 'file', imageUrl: '' }))}
                      className="mr-2"
                    />
                    <span className="text-white text-sm">Upload File</span>
                  </label>
                </div>
              </div>

              {uploadData.uploadMethod === 'file' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Image File
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadData(prev => ({ ...prev, file: e.target.files[0] }))}
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                  />
                  {uploadData.file && (
                    <div className="mt-2 p-2 bg-green-500/10 border border-green-500/30 rounded">
                      <p className="text-xs text-green-400 flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Selected: {uploadData.file.name}</span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={uploadData.imageUrl}
                    onChange={(e) => setUploadData(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://example.com/scoreboard.jpg"
                    className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={uploadData.description}
                  onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tournament Results"
                  className="w-full px-3 py-2 bg-gaming-charcoal border border-gray-600 rounded-lg text-white focus:border-gaming-neon focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6" style={{ zIndex: 2147483647, position: 'relative' }}>
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                style={{ zIndex: 2147483647, position: 'relative' }}
              >
                Cancel
              </button>
              <button
                onClick={handleUploadScoreboard}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-gaming-neon text-black font-bold rounded-lg hover:bg-gaming-neon/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ zIndex: 2147483647, position: 'relative' }}
              >
                {uploading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Uploading...</span>
                  </div>
                ) : 'Upload'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Image Preview Modal Component with Navigation
const ImagePreviewModal = ({ images, currentIndex, onClose, onNavigate }) => {
  const [imageIndex, setImageIndex] = useState(currentIndex);

  useEffect(() => {
    setImageIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [imageIndex, images.length]);

  const handlePrevious = () => {
    const newIndex = imageIndex > 0 ? imageIndex - 1 : images.length - 1;
    setImageIndex(newIndex);
    onNavigate(newIndex);
  };

  const handleNext = () => {
    const newIndex = imageIndex < images.length - 1 ? imageIndex + 1 : 0;
    setImageIndex(newIndex);
    onNavigate(newIndex);
  };

  if (!images || images.length === 0) {
    return null;
  }

  const currentImage = images[imageIndex];

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="relative max-w-4xl max-h-full p-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Image */}
        <div className="flex items-center justify-center">
          <img
            src={currentImage.url}
            alt={`Verification ${imageIndex + 1}`}
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
            onError={(e) => {
              e.target.src = '/placeholder-image.png';
            }}
          />
        </div>

        {/* Navigation Buttons */}
        {images.length > 1 && (
          <>
            {/* Previous Button */}
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Next Button */}
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Image Counter */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
          {imageIndex + 1} / {images.length}
        </div>

        {/* Thumbnail Navigation */}
        {images.length > 1 && (
          <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 flex space-x-2 max-w-full overflow-x-auto">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => {
                  setImageIndex(index);
                  onNavigate(index);
                }}
                className={`w-12 h-12 rounded border-2 overflow-hidden flex-shrink-0 ${
                  index === imageIndex ? 'border-gaming-neon' : 'border-gray-500'
                }`}
              >
                <img
                  src={image.url}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = '/placeholder-image.png';
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AdminBGMIRegistrations;
