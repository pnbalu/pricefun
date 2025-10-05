import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'pricefun',
  slug: 'pricefun',
  scheme: 'pricefun',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  extra: {
    eas: {
      projectId: 'local-dev',
    },
  },
};

export default config;


