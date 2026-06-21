// Minimal ambient surface for the bits we use; the package ships no types (v0.14.0).
declare module 'react-native-zeroconf' {
  export type ZeroconfService = {
    name: string;
    host?: string;
    port?: number;
    addresses?: string[];
  };

  export default class Zeroconf {
    scan(type?: string, protocol?: string, domain?: string): void;
    stop(): void;
    removeDeviceListeners(): void;
    on(event: 'resolved', listener: (service: ZeroconfService) => void): void;
    on(event: 'error', listener: (error: unknown) => void): void;
  }
}
