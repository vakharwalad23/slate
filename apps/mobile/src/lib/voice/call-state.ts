export type CallStatus = 'idle' | 'offering' | 'connecting' | 'in_call' | 'ended';
export type EndReason = 'remote_hangup' | 'socket_drop' | 'ice_failed' | 'user_hangup';

export type CallState = {
  status: CallStatus;
  callId: string | null;
  endReason: EndReason | null;
};

export const initialCallState: CallState = { status: 'idle', callId: null, endReason: null };

export type CallEvent =
  | { type: 'user_start'; callId: string }
  | { type: 'answered'; callId?: string }
  | { type: 'ice_connected'; callId?: string }
  | { type: 'remote_hangup'; callId?: string }
  | { type: 'user_hangup' }
  | { type: 'socket_drop' }
  | { type: 'ice_failed' }
  | { type: 'reset' };

const ACTIVE: readonly CallStatus[] = ['offering', 'connecting', 'in_call'];

// callId-scoped: an event tagged with a callId that does not match the live call is a stale
// frame from a previous socket/call and is dropped (mirrors the transport generation guard).
// user_start is exempt: its callId names the call being created, not one to validate against.
function isStale(state: CallState, event: CallEvent): boolean {
  if (event.type === 'user_start') return false;
  return 'callId' in event && event.callId !== undefined && event.callId !== state.callId;
}

function end(state: CallState, reason: EndReason): CallState {
  return { status: 'ended', callId: state.callId, endReason: reason };
}

export function voiceReducer(state: CallState, event: CallEvent): CallState {
  if (isStale(state, event)) return state;
  switch (event.type) {
    case 'user_start':
      return state.status === 'idle'
        ? { status: 'offering', callId: event.callId, endReason: null }
        : state;
    case 'answered':
      return state.status === 'offering' ? { ...state, status: 'connecting' } : state;
    case 'ice_connected':
      return state.status === 'connecting' ? { ...state, status: 'in_call' } : state;
    case 'remote_hangup':
      return ACTIVE.includes(state.status) ? end(state, 'remote_hangup') : state;
    case 'user_hangup':
      return ACTIVE.includes(state.status) ? end(state, 'user_hangup') : state;
    case 'socket_drop':
      return ACTIVE.includes(state.status) ? end(state, 'socket_drop') : state;
    case 'ice_failed':
      return ACTIVE.includes(state.status) ? end(state, 'ice_failed') : state;
    case 'reset':
      return initialCallState;
  }
}
