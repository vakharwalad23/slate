import type { BaseCommand, Command } from '@slate/protocol';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, PressableScale, Text, TextField } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

// ponytail: a self-contained step builder rather than reusing the main button editor - its app picker
// also seeds the button icon, which must not happen for a macro step. Steps take a typed app/bundle id.
type Step = Extract<Command, { kind: 'macro' }>['steps'][number];
type Kind = BaseCommand['kind'];
type MediaAction = Extract<BaseCommand, { kind: 'media' }>['action'];
type KeyModifier = Extract<BaseCommand, { kind: 'keystroke' }>['modifiers'][number];

const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'launch_app', label: 'Launch' },
  { kind: 'activate_app', label: 'Activate' },
  { kind: 'quit_app', label: 'Quit' },
  { kind: 'run_shortcut', label: 'Shortcut' },
  { kind: 'run_applescript', label: 'AppleScript' },
  { kind: 'run_shell', label: 'Shell' },
  { kind: 'media', label: 'Media' },
  { kind: 'keystroke', label: 'Key' },
  { kind: 'space', label: 'Space' },
  { kind: 'app_switch', label: 'Switch app' },
];
const MEDIA_ACTIONS: MediaAction[] = [
  'playpause',
  'next',
  'prev',
  'volume_up',
  'volume_down',
  'mute',
];
const MODIFIERS: KeyModifier[] = ['cmd', 'shift', 'option', 'control'];

function defaultCommand(kind: Kind): BaseCommand {
  switch (kind) {
    case 'launch_app':
      return { kind, app: '' };
    case 'activate_app':
      return { kind, bundleId: '' };
    case 'quit_app':
      return { kind, bundleId: '' };
    case 'run_shortcut':
      return { kind, name: '' };
    case 'run_applescript':
      return { kind, script: '' };
    case 'run_shell':
      return { kind, script: '' };
    case 'media':
      return { kind, action: 'playpause' };
    case 'keystroke':
      return { kind, key: '', modifiers: [] };
    case 'space':
      return { kind, direction: 'next' };
    case 'app_switch':
      return { kind, direction: 'next' };
  }
}

function CommandFields({
  command,
  onChange,
}: {
  command: BaseCommand;
  onChange: (c: BaseCommand) => void;
}) {
  switch (command.kind) {
    case 'launch_app':
      return (
        <TextField
          value={command.app}
          onChangeText={(app) => onChange({ kind: 'launch_app', app })}
          autoCapitalize="none"
          placeholder="app name or bundle id"
        />
      );
    case 'activate_app':
    case 'quit_app': {
      const kind = command.kind;
      return (
        <TextField
          value={command.bundleId}
          onChangeText={(bundleId) => onChange({ kind, bundleId })}
          autoCapitalize="none"
          placeholder="bundle id"
        />
      );
    }
    case 'run_shortcut':
      return (
        <TextField
          value={command.name}
          onChangeText={(name) => onChange({ kind: 'run_shortcut', name })}
          placeholder="Shortcut name"
        />
      );
    case 'run_applescript':
    case 'run_shell': {
      const kind = command.kind;
      return (
        <TextField
          value={command.script}
          onChangeText={(script) => onChange({ kind, script })}
          placeholder="script"
          multiline
          style={styles.multiline}
        />
      );
    }
    case 'media':
      return (
        <View style={styles.row}>
          {MEDIA_ACTIONS.map((a) => (
            <Chip
              key={a}
              label={a}
              selected={command.action === a}
              onPress={() => onChange({ kind: 'media', action: a })}
            />
          ))}
        </View>
      );
    case 'keystroke': {
      const modifiers = command.modifiers;
      return (
        <View style={styles.field}>
          <View style={styles.row}>
            {MODIFIERS.map((m) => (
              <Chip
                key={m}
                label={m}
                selected={modifiers.includes(m)}
                onPress={() =>
                  onChange({
                    kind: 'keystroke',
                    key: command.key,
                    modifiers: modifiers.includes(m)
                      ? modifiers.filter((x) => x !== m)
                      : [...modifiers, m],
                  })
                }
              />
            ))}
          </View>
          <TextField
            value={command.key}
            onChangeText={(key) => onChange({ kind: 'keystroke', key, modifiers })}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="key e.g. c, left, f5"
          />
        </View>
      );
    }
    case 'space':
    case 'app_switch': {
      const kind = command.kind;
      return (
        <View style={styles.row}>
          <Chip
            label="Next"
            selected={command.direction === 'next'}
            onPress={() => onChange({ kind, direction: 'next' })}
          />
          <Chip
            label="Previous"
            selected={command.direction === 'prev'}
            onPress={() => onChange({ kind, direction: 'prev' })}
          />
        </View>
      );
    }
  }
}

export function MacroEditor({
  steps,
  onChange,
}: {
  steps: Step[];
  onChange: (steps: Step[]) => void;
}) {
  const { colors } = useTheme();
  const replace = (i: number, step: Step) =>
    onChange(steps.map((s, idx) => (idx === i ? step : s)));
  const move = (i: number, to: number) => {
    if (to < 0 || to >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(i, 1);
    if (item === undefined) return;
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <View style={styles.field}>
      {steps.map((step, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional and freely reordered/edited
        <View key={i} style={[styles.step, { borderColor: colors.border }]}>
          <View style={styles.stepHead}>
            <Text variant="label" tone="secondary">
              Step {i + 1}
            </Text>
            <View style={styles.stepHeadRight}>
              <PressableScale haptics={false} onPress={() => move(i, i - 1)}>
                <Text tone="secondary">^</Text>
              </PressableScale>
              <PressableScale haptics={false} onPress={() => move(i, i + 1)}>
                <Text tone="secondary">v</Text>
              </PressableScale>
              <PressableScale
                haptics={false}
                onPress={() => onChange(steps.filter((_, idx) => idx !== i))}
              >
                <Text tone="danger">x</Text>
              </PressableScale>
            </View>
          </View>
          <View style={styles.row}>
            {KINDS.map((k) => (
              <Chip
                key={k.kind}
                label={k.label}
                selected={step.command.kind === k.kind}
                onPress={() => replace(i, { ...step, command: defaultCommand(k.kind) })}
              />
            ))}
          </View>
          <CommandFields
            command={step.command}
            onChange={(command) => replace(i, { ...step, command })}
          />
          <TextField
            value={step.delayMs === undefined ? '' : String(step.delayMs)}
            onChangeText={(t) => {
              const n = Number(t);
              replace(i, {
                command: step.command,
                ...(t.trim() !== '' && Number.isFinite(n) && n >= 0
                  ? { delayMs: Math.floor(n) }
                  : {}),
              });
            }}
            keyboardType="number-pad"
            placeholder="delay before (ms)"
          />
        </View>
      ))}
      <Button
        title="Add step"
        variant="secondary"
        onPress={() => onChange([...steps, { command: defaultCommand('keystroke') }])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  step: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  stepHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepHeadRight: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
});
