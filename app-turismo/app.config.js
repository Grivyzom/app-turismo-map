require('dotenv').config();

module.exports = {
  expo: {
    name: 'app-turismo',
    slug: 'app-turismo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'app-turismo',
    ios: {
      supportsTablet: true,
      config: {
        googleMapsApiKey:
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY ||
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
          process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      package: 'com.grivy.appturismo',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey:
            process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY ||
            process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
            process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Permite a app-turismo usar tu ubicación para mostrarla en el mapa.',
          locationAlwaysPermission: 'Permite a app-turismo usar tu ubicación en segundo plano.',
          locationWhenInUsePermission:
            'Permite a app-turismo usar tu ubicación mientras la app está abierta.',
        },
      ],
    ],
  },
};
