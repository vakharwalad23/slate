import type { VoiceEndpoint } from './endpoint';

type EndpointFactory = () => VoiceEndpoint;

// One call at a time (1:1 intercom). All async paths are guarded so a late callback after
// hangup cannot resurrect a closed session.
export class VoiceSession {
  private endpoint: VoiceEndpoint | null = null;
  private iceSubscriber: ((candidate: string | null) => void) | null = null;
  private unsubIce: (() => void) | null = null;
  private readonly makeEndpoint: EndpointFactory;

  constructor(makeEndpoint: EndpointFactory) {
    this.makeEndpoint = makeEndpoint;
  }

  isActive(): boolean {
    return this.endpoint !== null;
  }

  onIce(cb: (candidate: string | null) => void): void {
    this.iceSubscriber = cb;
  }

  async handleOffer(sdp: string): Promise<string> {
    if (this.endpoint) await this.hangup();
    const ep = this.makeEndpoint();
    this.endpoint = ep;
    this.unsubIce = ep.onIce((c) => this.iceSubscriber?.(c));
    await ep.start();
    return ep.acceptOffer(sdp);
  }

  async addIce(candidate: string | null): Promise<void> {
    if (!this.endpoint) return;
    await this.endpoint.addIce(candidate);
  }

  async hangup(): Promise<void> {
    const ep = this.endpoint;
    if (!ep) return;
    this.endpoint = null;
    this.unsubIce?.();
    this.unsubIce = null;
    await ep.stop();
  }
}
