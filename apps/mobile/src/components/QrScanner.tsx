import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

export function QrScanner({
  visible,
  onClose,
  onScan,
}: {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    scannedRef.current = false;
    if (permission !== null && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.bg,
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            paddingLeft: insets.left + spacing.lg,
            paddingRight: insets.right + spacing.lg,
          },
        ]}
      >
        <View style={styles.header}>
          <Text variant="heading">Scan the QR</Text>
          <Button title="Close" variant="ghost" onPress={onClose} />
        </View>
        {permission?.granted ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (scannedRef.current) return;
                scannedRef.current = true;
                onScan(data);
              }}
            />
          </View>
        ) : (
          <View style={styles.message}>
            <Text tone="secondary" style={styles.center}>
              {permission?.canAskAgain === false
                ? 'Camera access is off. Turn it on in Settings, or type the code instead.'
                : 'Camera access is needed to scan the pairing QR.'}
            </Text>
            {permission?.canAskAgain !== false ? (
              <Button title="Allow camera" onPress={() => void requestPermission()} />
            ) : null}
          </View>
        )}
        <Text variant="caption" tone="secondary" style={styles.center}>
          Point at the QR shown on your Mac.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraWrap: { flex: 1, borderRadius: radii.lg, overflow: 'hidden' },
  message: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  center: { textAlign: 'center' },
});
