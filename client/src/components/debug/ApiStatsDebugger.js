import React, { useState, useEffect } from 'react';
import apiCallTracker from '../../utils/apiCallTracker';

const ApiStatsDebugger = () => {
  const [stats, setStats] = useState({});
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStats(apiCallTracker.getStats());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="API Stats"
      >
        📊
      </button>

      {/* Stats Panel */}
      {isVisible && (
        <div className="fixed bottom-16 right-4 z-50 bg-black/90 text-white p-4 rounded-lg shadow-xl border border-gray-600 min-w-[200px]">
          <h3 className="text-sm font-bold mb-2">API Call Stats</h3>
          <div className="space-y-1 text-xs">
            <div>Calls/min: {stats.callsInLastMinute}/{stats.maxCalls}</div>
            <div>Status: {stats.canMakeCall ? '✅ OK' : '⚠️ Limited'}</div>
            <div className="mt-2">
              <div className="bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all ${
                    stats.canMakeCall ? 'bg-green-500' : 'bg-red-500'
                  }`}
                  style={{ 
                    width: `${Math.min((stats.callsInLastMinute / stats.maxCalls) * 100, 100)}%` 
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ApiStatsDebugger;