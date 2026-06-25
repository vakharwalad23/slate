import Zeroconf from 'react-native-zeroconf';

export type Found = { name: string; host: string; port: number };
export type BrowseHandle = { stop: () => void };

// react-native-zeroconf is a legacy native module; if it is missing or fails under New Arch we return
// null and the caller degrades to manual entry. Discovery must never block connecting.
export function startBrowse(
  onFound: (found: Found) => void,
  onError: () => void,
): BrowseHandle | null {
  let zeroconf: Zeroconf;
  try {
    zeroconf = new Zeroconf();
  } catch {
    return null;
  }
  zeroconf.on('resolved', (service) => {
    const host = service.host ?? service.addresses?.[0];
    if (host !== undefined && service.port !== undefined) {
      onFound({ name: service.name, host, port: service.port });
    }
  });
  zeroconf.on('error', () => onError());
  try {
    zeroconf.scan('slate', 'tcp', 'local.');
  } catch {
    onError();
    return null;
  }
  return {
    stop: () => {
      zeroconf.stop();
      zeroconf.removeDeviceListeners();
    },
  };
}
