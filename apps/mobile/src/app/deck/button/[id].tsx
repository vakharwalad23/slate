import type { Capabilities, Command } from '@slate/protocol';
import * as Crypto from 'expo-crypto';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { AppPicker } from '@/components/AppPicker';
import type { DeckButton, IconRef } from '@/schemas';
import { useStore } from '@/stores/store';

type Kind = Command['kind'];

const KINDS: { kind: Kind; label: string; needs: keyof Capabilities | null }[] = [
  { kind: 'launch_app', label: 'Launch app', needs: 'launchApps' },
  { kind: 'activate_app', label: 'Activate app', needs: 'launchApps' },
  { kind: 'run_shortcut', label: 'Run Shortcut', needs: 'runShortcuts' },
  { kind: 'run_applescript', label: 'AppleScript', needs: null },
  { kind: 'run_shell', label: 'Shell', needs: 'runShell' },
];

export default function ButtonEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const { capabilities, pageId, columns, existing, addButton, editButton, deleteButton } = useStore(
    useShallow((s) => {
      const deck = s.decks.find((d) => d.id === s.currentDeckId) ?? s.decks[0];
      const page = deck?.pages.find((p) => p.id === s.currentPageId) ?? deck?.pages[0];
      return {
        capabilities: s.helper?.capabilities,
        pageId: page?.id ?? null,
        columns: page?.columns ?? 4,
        existing: page?.buttons.find((b) => b.id === id),
        addButton: s.addButton,
        editButton: s.editButton,
        deleteButton: s.deleteButton,
      };
    }),
  );
  const buttonCount = useStore((s) => {
    const deck = s.decks.find((d) => d.id === s.currentDeckId) ?? s.decks[0];
    const page = deck?.pages.find((p) => p.id === s.currentPageId) ?? deck?.pages[0];
    return page?.buttons.length ?? 0;
  });

  const initialAction = existing?.action;
  const [kind, setKind] = useState<Kind>(initialAction?.kind ?? 'launch_app');
  const [appField, setAppField] = useState(
    initialAction?.kind === 'launch_app'
      ? initialAction.app
      : initialAction?.kind === 'activate_app'
        ? initialAction.bundleId
        : '',
  );
  const [shortcutName, setShortcutName] = useState(
    initialAction?.kind === 'run_shortcut' ? initialAction.name : '',
  );
  const [script, setScript] = useState(
    initialAction?.kind === 'run_applescript' || initialAction?.kind === 'run_shell'
      ? initialAction.script
      : '',
  );
  const [label, setLabel] = useState(existing?.label ?? '');
  const [emoji, setEmoji] = useState(existing?.icon.kind === 'emoji' ? existing.icon.value : '');
  const [iconBundleId, setIconBundleId] = useState<string | null>(
    existing?.icon.kind === 'appIcon' ? existing.icon.bundleId : null,
  );
  const [showPicker, setShowPicker] = useState(false);

  const availableKinds = KINDS.filter((k) => k.needs === null || capabilities?.[k.needs] === true);
  const isAppKind = kind === 'launch_app' || kind === 'activate_app';

  function buildAction(): Command {
    switch (kind) {
      case 'launch_app':
        return { kind: 'launch_app', app: appField.trim() };
      case 'activate_app':
        return { kind: 'activate_app', bundleId: appField.trim() };
      case 'run_shortcut':
        return { kind: 'run_shortcut', name: shortcutName.trim() };
      case 'run_applescript':
        return { kind: 'run_applescript', script };
      case 'run_shell':
        return { kind: 'run_shell', script };
    }
  }

  function buildIcon(): IconRef {
    if (iconBundleId !== null) return { kind: 'appIcon', bundleId: iconBundleId };
    if (emoji.trim() !== '') return { kind: 'emoji', value: emoji.trim() };
    return { kind: 'glyph', name: label.trim() === '' ? 'app' : label.trim() };
  }

  function save() {
    if (pageId === null) return;
    const trimmedLabel = label.trim();
    const base = {
      icon: buildIcon(),
      action: buildAction(),
      ...(trimmedLabel !== '' && { label: trimmedLabel }),
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: isNew ? 'New button' : 'Edit button' }} />

      <Text style={styles.section}>Action</Text>
      <View style={styles.kinds}>
        {availableKinds.map((k) => (
          <Pressable
            key={k.kind}
            style={[styles.kind, kind === k.kind ? styles.kindActive : null]}
            onPress={() => setKind(k.kind)}
          >
            <Text style={kind === k.kind ? styles.kindTextActive : styles.kindText}>{k.label}</Text>
          </Pressable>
        ))}
      </View>

      {isAppKind ? (
        <View style={styles.field}>
          <Button
            title={showPicker ? 'Hide app list' : 'Choose app'}
            onPress={() => setShowPicker((v) => !v)}
          />
          {showPicker ? (
            <View style={styles.picker}>
              <AppPicker
                onSelect={(app) => {
                  setAppField(app.bundleId);
                  setIconBundleId(app.bundleId);
                  if (label.trim() === '') setLabel(app.name);
                  setShowPicker(false);
                }}
              />
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            value={appField}
            onChangeText={setAppField}
            autoCapitalize="none"
            placeholder="app name or bundle id"
          />
        </View>
      ) : null}

      {kind === 'run_shortcut' ? (
        <TextInput
          style={styles.input}
          value={shortcutName}
          onChangeText={setShortcutName}
          placeholder="Shortcut name"
        />
      ) : null}

      {kind === 'run_applescript' || kind === 'run_shell' ? (
        <TextInput
          style={[styles.input, styles.multiline]}
          value={script}
          onChangeText={setScript}
          placeholder="script"
          multiline
        />
      ) : null}

      <Text style={styles.section}>Label</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder="optional label"
      />

      <Text style={styles.section}>Icon</Text>
      <Text style={styles.hint}>
        {iconBundleId !== null
          ? 'Using the app icon. Clear the app field to use an emoji.'
          : 'Type an emoji, or pick an app for its icon.'}
      </Text>
      <TextInput
        style={styles.input}
        value={emoji}
        onChangeText={(text) => {
          setEmoji(text);
          if (text.trim() !== '') setIconBundleId(null);
        }}
        placeholder="emoji"
      />

      <View style={styles.actions}>
        <Button title="Save" onPress={save} />
        {isNew ? null : <Button title="Delete" color="#c62828" onPress={remove} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  section: { fontSize: 13, fontWeight: '600', marginTop: 8, opacity: 0.7 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  kindActive: { backgroundColor: '#0a84ff', borderColor: '#0a84ff' },
  kindText: { fontSize: 13 },
  kindTextActive: { fontSize: 13, color: '#fff' },
  field: { gap: 8 },
  picker: { height: 280 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, fontSize: 16 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 12, opacity: 0.5 },
  actions: { marginTop: 16, gap: 12 },
});
