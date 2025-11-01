// High-quality tournament banner images
export const tournamentBanners = {
  bgmi: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1556438064-2d7646166914?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1200&h=400&fit=crop&crop=center'
  ],
  cs2: [
    'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop&crop=center'
  ],
  valorant: [
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1200&h=400&fit=crop&crop=center'
  ],
  freefire: [
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1556438064-2d7646166914?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop&crop=center',
    'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1200&h=400&fit=crop&crop=center'
  ]
};

// Get random banner for a game type
export const getRandomBanner = (gameType) => {
  const banners = tournamentBanners[gameType?.toLowerCase()] || tournamentBanners.bgmi;
  return banners[Math.floor(Math.random() * banners.length)];
};

// Get specific banner by index
export const getBanner = (gameType, index = 0) => {
  const banners = tournamentBanners[gameType?.toLowerCase()] || tournamentBanners.bgmi;
  return banners[index % banners.length];
};

// Gaming hero backgrounds
export const heroBackgrounds = [
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&h=1080&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=1920&h=1080&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1920&h=1080&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=1920&h=1080&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1920&h=1080&fit=crop&crop=center'
];

// Get random hero background
export const getRandomHeroBackground = () => {
  return heroBackgrounds[Math.floor(Math.random() * heroBackgrounds.length)];
};