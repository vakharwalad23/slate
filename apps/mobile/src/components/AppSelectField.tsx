import type { AppInfo } from '@slate/protocol';
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPicker } from '@/components/AppPicker';
import { Button, Text, TextField } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

// Side-effect-free on select: the caller decides what a picked app does (seed an icon, write a
// field), so the same control serves the button editor and macro steps without one leaking the
// other's behavior.
export function AppSelectField({
  value,
  onChangeText,
  onSelect,
  placeholder = 'app name or bundle id',
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSelect: (app: AppInfo) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={styles.field}>
      <Button title="Choose app" variant="secondary" onPress={() => setShowPicker(true)} />
      <TextField
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        placeholder={placeholder}
      />
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
                onSelect(app);
                setShowPicker(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalBody: { flex: 1 },
});
