import { CameraView, useCameraPermissions } from "expo-camera";
import { Text, View, Pressable } from "react-native";
import { useRef } from "react";
export function CameraScanner({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void;
  onClose: () => void;
}) {
  const [permission, request] = useCameraPermissions();
  const used = useRef(false);
  if (!permission?.granted)
    return (
      <View>
        <Text>Permite camera pentru scanarea biletului.</Text>
        <Pressable onPress={() => void request()}>
          <Text>Permite camera</Text>
        </Pressable>
        <Pressable onPress={onClose}>
          <Text>Închide</Text>
        </Pressable>
      </View>
    );
  return (
    <View style={{ height: 340 }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={(e) => {
          if (!used.current) {
            used.current = true;
            onScan(e.data);
          }
        }}
      />
      <Pressable onPress={onClose}>
        <Text>Închide camera</Text>
      </Pressable>
    </View>
  );
}
