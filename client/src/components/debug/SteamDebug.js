import React from 'react';
import { useSelector } from 'react-redux';
import { selectAuth } from '../../store/slices/authSlice';

const SteamDebug = () => {
    const { user } = useSelector(selectAuth);

    const testSteamAuth = () => {
        const userId = user?.id || localStorage.getItem('userId');
        const steamAuthUrl = `/api/steam/auth?state=${userId}`;
        
        console.log('🔧 Steam Debug Info:');
        console.log('User ID:', userId);
        console.log('Steam Auth URL:', steamAuthUrl);
        console.log('Full URL:', window.location.origin + steamAuthUrl);
        
        // Test if the endpoint exists
        fetch('/api/steam/status', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        })
        .then(response => {
            console.log('Steam Status Endpoint:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Steam Status Data:', data);
        })
        .catch(error => {
            console.error('Steam Status Error:', error);
        });
        
        // Try the auth endpoint
        window.location.href = steamAuthUrl;
    };

    return (
        <div className="bg-gaming-card rounded-lg border border-gaming-border p-4 m-4">
            <h3 className="text-white font-bold mb-4">🔧 Steam Debug</h3>
            <div className="space-y-2 text-sm text-gray-300 mb-4">
                <div>User ID: {user?.id || localStorage.getItem('userId') || 'Not found'}</div>
                <div>Token: {localStorage.getItem('token') ? 'Present' : 'Missing'}</div>
                <div>Steam Auth URL: /api/steam/auth?state={user?.id || localStorage.getItem('userId')}</div>
            </div>
            <button
                onClick={testSteamAuth}
                className="btn-gaming text-sm"
            >
                Test Steam Auth
            </button>
        </div>
    );
};

export default SteamDebug;