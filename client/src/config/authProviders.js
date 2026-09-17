import { SiGoogle, SiFacebook, SiSteam, SiXbox, SiRiotgames } from 'react-icons/si';

// Single source of truth for which identity providers the UI knows about -
// backs both the login/register buttons and the connected-accounts page.
// Keep in sync with server/config/providers.config.js's PROVIDERS enum.
export const AUTH_PROVIDERS = [
  { id: 'google', label: 'Google', icon: SiGoogle, brandColor: '#4285F4' },
  { id: 'facebook', label: 'Facebook', icon: SiFacebook, brandColor: '#1877F2' },
  { id: 'steam', label: 'Steam', icon: SiSteam, brandColor: '#66C0F4' },
  { id: 'xbox', label: 'Xbox', icon: SiXbox, brandColor: '#107C10' },
  { id: 'riot', label: 'Riot', icon: SiRiotgames, brandColor: '#D13639', showInLogin: false }
];

export const getProviderConfig = (id) => AUTH_PROVIDERS.find((provider) => provider.id === id);

export default AUTH_PROVIDERS;
