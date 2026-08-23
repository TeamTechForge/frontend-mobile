import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Resolves the backend API base URL.
 *
 * Priority order:
 * 1. Explicit env override (EXPO_PUBLIC_API_URL)
 * 2. Dynamic Expo dev-server hostUri (automatically gets your PC's active IP from Metro)
 * 3. Hardcoded fallback IP
 */

const FALLBACK_IP = ' 10.234.157.94';
const BACKEND_PORT = 5000;

function getMetroHost(): string | null {
  const c = Constants as any;
  const raw =
    c.expoConfig?.hostUri ||
    c.expoGoConfig?.debuggerHost ||
    c.manifest2?.extra?.expoGo?.debuggerHost ||
    c.manifest?.debuggerHost ||
    c.developerManifest?.hostUri ||
    c.experienceUrl;

  if (typeof raw === 'string' && raw.trim().length > 0) {
    const clean = raw.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0];
    const host = clean.split(':')[0];
    if (host && !host.includes('localhost') && host !== '127.0.0.1') {
      const isTunnel = /\.(exp|expo)\.direct$|ngrok|\.ngrok-free\.app/i.test(host);
      if (!isTunnel) return host;
    }
  }
  return null;
}

function resolveBaseUrl(): string {
  // 1. Explicit environment override. PayHere checkout credentials are tied to
  // the hosted integration domain, so a configured URL must not be replaced by
  // Metro's local IP during development.
  const envUrl =
    process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    console.log('[Config] Using EXPO_PUBLIC_API_URL:', envUrl);
    return envUrl.replace(/\/$/, '');
  }

  // 2. Without an explicit override, dynamically match the Metro host so
  // physical devices can reach a locally running backend.
  if (__DEV__) {
    const metroHost = getMetroHost();
    if (metroHost) {
      console.log(`[Config] Auto-detected active Metro host IP: ${metroHost}`);
      return `http://${metroHost}:${BACKEND_PORT}`;
    }
  }

  // 3. Platform-specific emulator detection
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${BACKEND_PORT}`;
    }
    if (Platform.OS === 'ios' || Platform.OS === 'web') {
      return `http://localhost:${BACKEND_PORT}`;
    }
  }

  // 4. Fallback IP
  console.warn(`[Config] Using fallback IP: ${FALLBACK_IP}`);
  return `http://${FALLBACK_IP}:${BACKEND_PORT}`;
}

export const BASE_URL = resolveBaseUrl();
export const API_URL = `${BASE_URL}/api`;

console.log('[Config] Final BASE_URL:', BASE_URL);
console.log('[Config] Final API_URL:', API_URL);

export default { BASE_URL, API_URL };
