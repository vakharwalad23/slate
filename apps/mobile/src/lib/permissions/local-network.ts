import { PermissionsAndroid, Platform } from 'react-native';

type RequestArg = Parameters<typeof PermissionsAndroid.request>[0];

// Android 17 (API 37) gates local sockets + mDNS behind ACCESS_LOCAL_NETWORK; must be granted before
// the first connect, not just discovery. iOS and older Android are a no-op.
export async function ensureLocalNetworkPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (typeof Platform.Version === 'number' && Platform.Version < 37) return true;
  // Requested by string: the constant is newer than the current RN typings.
  const permission = 'android.permission.ACCESS_LOCAL_NETWORK' as RequestArg;
  const result = await PermissionsAndroid.request(permission);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
