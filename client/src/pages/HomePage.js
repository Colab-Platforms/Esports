// HomePage Router - Selects which landing page template to display
// Configure REACT_APP_LANDING_PAGE in .env to switch between templates:
// - 'complete' (default) - Full-featured landing with all sections
// - 'marketing' - Premium grid layout
// - 'slider' - Tournament slider page

import React from 'react';
import CompleteLandingPage from './CompleteLandingPage';
import MarketingLandingPage from './MarketingLandingPage';
import SliderLandingPage from './SliderLandingPage';

const HomePage = () => {
  // Get landing page type from environment variable
  // Default to 'complete' for full-featured experience
  const landingPageType = process.env.REACT_APP_LANDING_PAGE || 'complete';

  // Return the selected landing page component
  if (landingPageType === 'slider') {
    return <SliderLandingPage />;
  }

  if (landingPageType === 'marketing') {
    return <MarketingLandingPage />;
  }

  // Default to complete landing page (all sections)
  return <CompleteLandingPage />;
};

export default HomePage;
