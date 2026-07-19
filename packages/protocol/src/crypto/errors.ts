export type SecureChannelErrorCode =
  | 'aead_open_failed'
  | 'bad_public_key'
  | 'bad_key'
  | 'nonce_overflow'
  | 'bad_handshake'
  | 'bad_frame';

// Any throw of this from the record/handshake layer is a hard failure: the caller closes the socket.
export class SecureChannelError extends Error {
  readonly code: SecureChannelErrorCode;
  constructor(code: SecureChannelErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'SecureChannelError';
    this.code = code;
  }
}
