const fs = require('fs');
const path = require('path');

const appJsonPath = path.resolve(__dirname, 'app.json');
const appJson = fs.existsSync(appJsonPath) ? require(appJsonPath) : {};

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const existingPlugins = appJson.expo?.plugins || [];
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || appJson.expo?.extra?.eas?.projectId;
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || appJson.expo?.android?.googleServicesFile;

module.exports = {
  expo: {
    ...(appJson.expo || {}),
    android: {
      ...(appJson.expo?.android || {}),
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    updates: {
      url: "https://u.expo.dev/19b64256-0d23-4d0c-bfaf-e92dd61a77e5"
    },
    runtimeVersion: {
      policy: "appVersion"
    },
    plugins: [
      ...existingPlugins.filter(
        (p) => p !== '@react-native-community/datetimepicker' &&
               (Array.isArray(p) ? p[0] !== '@react-native-community/datetimepicker' : true)
      ),
      '@react-native-community/datetimepicker',
    ],
    extra: {
      ...(appJson.expo?.extra || {}),
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      // Cloudinary
      EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME,
      EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
      // Firebase
      EXPO_PUBLIC_FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      EXPO_PUBLIC_FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      // Google OAuth
      EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    },
  },
};
