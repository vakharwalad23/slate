import type { Command } from '@slate/protocol';
import type { IconRef } from '@/schemas';

type MediaAction = Extract<Command, { kind: 'media' }>['action'];

const MEDIA_ICON: Record<MediaAction, string> = {
  playpause: 'play-pause',
  next: 'skip-next',
  prev: 'skip-previous',
  volume_up: 'volume-high',
  volume_down: 'volume-medium',
  mute: 'volume-off',
};

const MEDIA_LABEL: Record<MediaAction, string> = {
  playpause: 'Play/Pause',
  next: 'Next',
  prev: 'Previous',
  volume_up: 'Vol +',
  volume_down: 'Vol -',
  mute: 'Mute',
};

const MODIFIER_LABEL: Record<string, string> = {
  cmd: 'Cmd',
  shift: 'Shift',
  option: 'Option',
  control: 'Control',
};

// An icon implied by the action, so action-only buttons need no manual icon. undefined => no default
// (app kinds carry their own app icon via the picker; falls back to the lettermark glyph).
export function defaultIcon(action: Command): IconRef | undefined {
  switch (action.kind) {
    case 'media':
      return { kind: 'symbol', name: MEDIA_ICON[action.action] };
    case 'keystroke':
      return { kind: 'symbol', name: 'keyboard' };
    case 'space':
      return { kind: 'symbol', name: action.direction === 'next' ? 'arrow-right' : 'arrow-left' };
    case 'app_switch':
      return { kind: 'symbol', name: 'apps' };
    case 'run_shortcut':
      return { kind: 'symbol', name: 'rocket-launch' };
    default:
      return undefined;
  }
}

export function defaultLabel(action: Command): string | undefined {
  switch (action.kind) {
    case 'media':
      return MEDIA_LABEL[action.action];
    case 'keystroke': {
      const key = action.key.length === 1 ? action.key.toUpperCase() : action.key;
      const parts = [...action.modifiers.map((m) => MODIFIER_LABEL[m] ?? m), key].filter(
        (p) => p !== '',
      );
      return parts.length > 0 ? parts.join(' ') : undefined;
    }
    case 'space':
      return action.direction === 'next' ? 'Space ->' : 'Space <-';
    case 'app_switch':
      return action.direction === 'next' ? 'Next app' : 'Prev app';
    case 'run_shortcut':
      return action.name !== '' ? action.name : undefined;
    default:
      return undefined;
  }
}
