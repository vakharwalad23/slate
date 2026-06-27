import type { Capabilities, Command } from '@slate/protocol';
import * as Crypto from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { AppPicker } from '@/components/AppPicker';
import { DeckButtonCell } from '@/components/DeckButtonCell';
import { Button, Chip, ICON_CHOICES, Icon, PressableScale, Text, TextField } from '@/components/ui';
import type { DeckButton, IconRef } from '@/schemas';
import { useStore } from '@/stores/store';
import { radii, spacing, useTheme } from '@/theme';

type Kind = Command['kind'];
type MediaAction = Extract<Command, { kind: 'media' }>['action'];
type IconSource = 'app' | 'emoji' | 'symbol';

const KINDS: { kind: Kind; label: string; needs: keyof Capabilities | null }[] = [
  { kind: 'launch_app', label: 'Launch app', needs: 'launchApps' },
  { kind: 'activate_app', label: 'Activate app', needs: 'launchApps' },
  { kind: 'quit_app', label: 'Quit app', needs: 'launchApps' },
  { kind: 'run_shortcut', label: 'Run Shortcut', needs: 'runShortcuts' },
  { kind: 'run_applescript', label: 'AppleScript', needs: null },
  { kind: 'run_shell', label: 'Shell', needs: 'runShell' },
  { kind: 'media', label: 'Media', needs: null },
];

const MEDIA_ACTIONS: { value: MediaAction; label: string }[] = [
  { value: 'playpause', label: 'Play/Pause' },
  { value: 'next', label: 'Next' },
  { value: 'prev', label: 'Previous' },
  { value: 'volume_up', label: 'Vol +' },
  { value: 'volume_down', label: 'Vol -' },
  { value: 'mute', label: 'Mute' },
];

const SWATCHES = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

export default function ButtonEditor() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const {
    capabilities,
    pageId,
    columns,
    existing,
    buttonCount,
    addButton,
    editButton,
    deleteButton,
  } = useStore(
    useShallow((s) => {
      const deck = s.decks.find((d) => d.id === s.currentDeckId) ?? s.decks[0];
      const page = deck?.pages.find((p) => p.id === s.currentPageId) ?? deck?.pages[0];
      return {
        capabilities: s.helper?.capabilities,
        pageId: page?.id ?? null,
        columns: page?.columns ?? 4,
        existing: page?.buttons.find((b) => b.id === id),
        buttonCount: page?.buttons.length ?? 0,
        addButton: s.addButton,
        editButton: s.editButton,
        deleteButton: s.deleteButton,
      };
    }),
  );

  const initialAction = existing?.action;
  const [kind, setKind] = useState<Kind>(initialAction?.kind ?? 'launch_app');
  const [appField, setAppField] = useState(
    initialAction?.kind === 'launch_app'
      ? initialAction.app
      : initialAction?.kind === 'activate_app' || initialAction?.kind === 'quit_app'
        ? initialAction.bundleId
        : '',
  );
  const [shortcutName, setShortcutName] = useState(
    initialAction?.kind === 'run_shortcut' ? initialAction.name : '',
  );
  const [shortcutInput, setShortcutInput] = useState(
    initialAction?.kind === 'run_shortcut' ? (initialAction.input ?? '') : '',
  );
  const [mediaAction, setMediaAction] = useState<MediaAction>(
    initialAction?.kind === 'media' ? initialAction.action : 'playpause',
  );
  const [script, setScript] = useState(
    initialAction?.kind === 'run_applescript' || initialAction?.kind === 'run_shell'
      ? initialAction.script
      : '',
  );
  const [label, setLabel] = useState(existing?.label ?? '');

  const initialSource: IconSource =
    existing?.icon.kind === 'emoji' ? 'emoji' : existing?.icon.kind === 'symbol' ? 'symbol' : 'app';
  const [iconSource, setIconSource] = useState<IconSource>(initialSource);
  const [emoji, setEmoji] = useState(existing?.icon.kind === 'emoji' ? existing.icon.value : '');
  const [iconBundleId, setIconBundleId] = useState<string | null>(
    existing?.icon.kind === 'appIcon' ? existing.icon.bundleId : null,
  );
  const [symbolName, setSymbolName] = useState(
    existing?.icon.kind === 'symbol' ? existing.icon.name : '',
  );
  const [color, setColor] = useState<string | undefined>(existing?.color);
  const [showPicker, setShowPicker] = useState(false);
  const [iconQuery, setIconQuery] = useState('');

  const availableKinds = KINDS.filter((k) => k.needs === null || capabilities?.[k.needs] === true);
  const isAppKind = kind === 'launch_app' || kind === 'activate_app' || kind === 'quit_app';

  function buildAction(): Command {
    switch (kind) {
      case 'launch_app':
        return { kind: 'launch_app', app: appField.trim() };
      case 'activate_app':
        return { kind: 'activate_app', bundleId: appField.trim() };
      case 'quit_app':
        return { kind: 'quit_app', bundleId: appField.trim() };
      case 'run_shortcut': {
        const name = shortcutName.trim();
        const input = shortcutInput.trim();
        return input !== ''
          ? { kind: 'run_shortcut', name, input }
          : { kind: 'run_shortcut', name };
      }
      case 'run_applescript':
        return { kind: 'run_applescript', script };
      case 'run_shell':
        return { kind: 'run_shell', script };
      case 'media':
        return { kind: 'media', action: mediaAction };
    }
  }

  function buildIcon(): IconRef {
    if (iconSource === 'app' && iconBundleId !== null)
      return { kind: 'appIcon', bundleId: iconBundleId };
    if (iconSource === 'emoji' && emoji.trim() !== '')
      return { kind: 'emoji', value: emoji.trim() };
    if (iconSource === 'symbol' && symbolName !== '') return { kind: 'symbol', name: symbolName };
    return { kind: 'glyph', name: label.trim() === '' ? 'app' : label.trim() };
  }

  const previewButton: DeckButton = {
    id: 'preview',
    position: { row: 0, col: 0 },
    icon: buildIcon(),
    action: { kind: 'launch_app', app: '' },
    ...(label.trim() !== '' && { label: label.trim() }),
    ...(color !== undefined && { color }),
  };

  function save() {
    if (pageId === null) return;
    const trimmedLabel = label.trim();
    const base = {
      icon: buildIcon(),
      action: buildAction(),
      ...(trimmedLabel !== '' && { label: trimmedLabel }),
      ...(color !== undefined && { color }),
    };
    if (isNew) {
      const n = buttonCount;
      const button: DeckButton = {
        id: Crypto.randomUUID(),
        position: { row: Math.floor(n / columns), col: n % columns },
        ...base,
      };
      addButton(pageId, button);
    } else {
      editButton(pageId, id, base);
    }
    router.back();
  }

  function remove() {
    if (pageId !== null && !isNew) deleteButton(pageId, id);
    router.back();
  }

  const iconMatches = ICON_CHOICES.filter((name) => name.includes(iconQuery.trim().toLowerCase()));

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: isNew ? 'New button' : 'Edit button' }} />

        <View style={styles.previewWrap}>
          <DeckButtonCell
            button={previewButton}
            size={96}
            onPress={() => {}}
            onLongPress={() => {}}
          />
        </View>

        <Text variant="label" tone="secondary">
          Action
        </Text>
        <View style={styles.row}>
          {availableKinds.map((k) => (
            <Chip
              key={k.kind}
              label={k.label}
              selected={kind === k.kind}
              onPress={() => setKind(k.kind)}
            />
          ))}
        </View>

        {isAppKind ? (
          <View style={styles.field}>
            <Button title="Choose app" variant="secondary" onPress={() => setShowPicker(true)} />
            <TextField
              value={appField}
              onChangeText={setAppField}
              autoCapitalize="none"
              placeholder="app name or bundle id"
            />
          </View>
        ) : null}

        {kind === 'run_shortcut' ? (
          <>
            <TextField
              value={shortcutName}
              onChangeText={setShortcutName}
              placeholder="Shortcut name"
            />
            <TextField
              value={shortcutInput}
              onChangeText={setShortcutInput}
              placeholder="Input (optional, piped to the Shortcut)"
            />
          </>
        ) : null}

        {kind === 'run_applescript' || kind === 'run_shell' ? (
          <TextField
            style={styles.multiline}
            value={script}
            onChangeText={setScript}
            placeholder="script"
            multiline
          />
        ) : null}

        {kind === 'media' ? (
          <View style={styles.row}>
            {MEDIA_ACTIONS.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                selected={mediaAction === m.value}
                onPress={() => setMediaAction(m.value)}
              />
            ))}
          </View>
        ) : null}

        <Text variant="label" tone="secondary">
          Label
        </Text>
        <TextField value={label} onChangeText={setLabel} placeholder="optional label" />

        <Text variant="label" tone="secondary">
          Icon
        </Text>
        <View style={styles.row}>
          <Chip label="App" selected={iconSource === 'app'} onPress={() => setIconSource('app')} />
          <Chip
            label="Emoji"
            selected={iconSource === 'emoji'}
            onPress={() => setIconSource('emoji')}
          />
          <Chip
            label="Glyph"
            selected={iconSource === 'symbol'}
            onPress={() => setIconSource('symbol')}
          />
        </View>

        {iconSource === 'app' ? (
          <Text variant="caption" tone="secondary">
            Pick an app above to use its icon.
          </Text>
        ) : null}
        {iconSource === 'emoji' ? (
          <TextField value={emoji} onChangeText={setEmoji} placeholder="emoji" />
        ) : null}
        {iconSource === 'symbol' ? (
          <>
            <TextField
              value={iconQuery}
              onChangeText={setIconQuery}
              placeholder="Search icons"
              autoCapitalize="none"
            />
            <View style={styles.iconGrid}>
              {iconMatches.map((name) => (
                <PressableScale
                  key={name}
                  haptics={false}
                  onPress={() => setSymbolName(name)}
                  style={[
                    styles.iconChoice,
                    {
                      borderColor: symbolName === name ? colors.accent : colors.border,
                      backgroundColor: symbolName === name ? colors.accentSoft : colors.surface,
                    },
                  ]}
                >
                  <Icon
                    name={name}
                    size={26}
                    color={symbolName === name ? colors.accent : colors.textPrimary}
                  />
                </PressableScale>
              ))}
            </View>
          </>
        ) : null}

        <Text variant="label" tone="secondary">
          Color
        </Text>
        <View style={styles.row}>
          <PressableScale
            haptics={false}
            onPress={() => setColor(undefined)}
            style={[
              styles.swatchNone,
              { borderColor: color === undefined ? colors.accent : colors.border },
            ]}
          >
            <Text variant="caption" tone="secondary">
              None
            </Text>
          </PressableScale>
          {SWATCHES.map((c) => (
            <PressableScale
              key={c}
              haptics={false}
              onPress={() => setColor(c)}
              style={[
                styles.swatch,
                {
                  backgroundColor: c,
                  borderColor: color === c ? colors.textPrimary : 'transparent',
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <Button title="Save" variant="primary" onPress={save} />
          {isNew ? null : <Button title="Delete" variant="danger" onPress={remove} />}
        </View>
      </ScrollView>

      <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
        <View
          style={[
            styles.modal,
            {
              backgroundColor: colors.bg,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom,
              paddingLeft: insets.left + spacing.lg,
              paddingRight: insets.right + spacing.lg,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text variant="heading">Choose app</Text>
            <Button title="Close" variant="ghost" onPress={() => setShowPicker(false)} />
          </View>
          <View style={styles.modalBody}>
            <AppPicker
              onSelect={(app) => {
                setAppField(app.bundleId);
                setIconBundleId(app.bundleId);
                setIconSource('app');
                if (label.trim() === '') setLabel(app.name);
                setShowPicker(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md },
  previewWrap: { alignItems: 'center', paddingVertical: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  field: { gap: spacing.sm },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalBody: { flex: 1 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconChoice: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchNone: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  actions: { marginTop: spacing.lg, gap: spacing.md },
});
