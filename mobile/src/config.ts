import { Platform } from 'react-native';

// Override with EXPO_PUBLIC_API_URL (needed for a physical phone: use your computer's LAN IP).
// 10.0.2.2 is how the Android emulator reaches the host machine's localhost.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');
