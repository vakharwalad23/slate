import { type BrowseHandle, startBrowse } from './zeroconf';

export type RediscoveryHandle = { stop: () => void };

// Browse for a helper by its (stable, per-Mac) Bonjour service name and report its CURRENT address.
// Used by the transport to follow a helper to a new IP after a network change. Returns null (degrade)
// if discovery is unavailable.
export function startRediscovery(
  wantedName: string,
  onMatch: (host: string, port: number) => void,
): RediscoveryHandle | null {
  const handle: BrowseHandle | null = startBrowse(
    (found) => {
      if (found.name.toLowerCase() === wantedName.toLowerCase()) onMatch(found.host, found.port);
    },
    () => {},
  );
  return handle === null ? null : { stop: () => handle.stop() };
}
