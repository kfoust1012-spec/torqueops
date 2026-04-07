import type { ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type BottomSheetProps = {
  actions?: ReactNode | undefined;
  children: ReactNode;
  description?: string | undefined;
  onClose: () => void;
  title: string;
  visible: boolean;
};

export function BottomSheet({
  actions,
  children,
  description,
  onClose,
  title,
  visible
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(17, 24, 39, 0.45)"
        }}
      >
        <Pressable
          onPress={onClose}
          style={{
            flex: 1
          }}
        />
        <View
          style={{
            maxHeight: "86%",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: "#ffffff",
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: Math.max(insets.bottom, 16) + 16,
            gap: 16
          }}
        >
          <View style={{ gap: 10 }}>
            <View
              style={{
                alignSelf: "center",
                width: 48,
                height: 5,
                borderRadius: 999,
                backgroundColor: "#d1d5db"
              }}
            />
            <View style={{ gap: 6 }}>
              <Text style={{ color: "#111827", fontSize: 22, fontWeight: "700" }}>{title}</Text>
              {description ? (
                <Text style={{ color: "#4b5563", fontSize: 15, lineHeight: 22 }}>{description}</Text>
              ) : null}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ gap: 14, paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {actions ? (
            <View
              style={{
                gap: 10,
                paddingTop: 6,
                borderTopWidth: 1,
                borderTopColor: "#e5e7eb"
              }}
            >
              {actions}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
