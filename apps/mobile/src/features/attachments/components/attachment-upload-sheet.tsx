import type { AttachmentCategory } from "@mobile-mechanic/types";
import { Pressable, Text, TextInput, View } from "react-native";

const categories: AttachmentCategory[] = ["general", "before", "after", "issue"];

type AttachmentUploadSheetProps = {
  caption: string;
  isUploading: boolean;
  onCameraPress: () => void;
  onCameraVideoPress: () => void;
  onCaptionChange: (value: string) => void;
  onCategoryChange: (value: AttachmentCategory) => void;
  onLibraryPress: () => void;
  selectedCategory: AttachmentCategory;
};

export function AttachmentUploadSheet({
  caption,
  isUploading,
  onCameraPress,
  onCameraVideoPress,
  onCaptionChange,
  onCategoryChange,
  onLibraryPress,
  selectedCategory
}: AttachmentUploadSheetProps) {
  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: "#ffffff",
        padding: 20,
        gap: 16
      }}
    >
      <View style={{ gap: 6 }}>
        <Text style={{ color: "#111827", fontSize: 22, fontWeight: "700" }}>Capture evidence</Text>
        <Text style={{ color: "#4b5563", fontSize: 15, lineHeight: 22 }}>
          Start with the camera, keep the category selected, and use short video when a photo cannot explain the issue.
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {categories.map((category) => {
          const isSelected = category === selectedCategory;

          return (
            <Pressable
              key={category}
              onPress={() => onCategoryChange(category)}
              style={{
                minHeight: 46,
                borderRadius: 999,
                backgroundColor: isSelected ? "#111827" : "#f3f4f6",
                paddingHorizontal: 16,
                justifyContent: "center"
              }}
            >
              <Text
                style={{
                  color: isSelected ? "#ffffff" : "#111827",
                  fontSize: 15,
                  fontWeight: "700"
                }}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        onChangeText={onCaptionChange}
        placeholder="Caption (optional)"
        placeholderTextColor="#9ca3af"
        style={{
          minHeight: 54,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#d1d5db",
          paddingHorizontal: 16,
          color: "#111827",
          fontSize: 16
        }}
        value={caption}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <Pressable
          disabled={isUploading}
          onPress={onCameraPress}
          style={{
            flex: 1,
            minWidth: 150,
            minHeight: 58,
            borderRadius: 18,
            backgroundColor: "#111827",
            alignItems: "center",
            justifyContent: "center",
            opacity: isUploading ? 0.6 : 1
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
            {isUploading ? "Uploading..." : "Take photo"}
          </Text>
        </Pressable>

        <Pressable
          disabled={isUploading}
          onPress={onCameraVideoPress}
          style={{
            flex: 1,
            minWidth: 150,
            minHeight: 58,
            borderRadius: 18,
            backgroundColor: "#92400e",
            alignItems: "center",
            justifyContent: "center",
            opacity: isUploading ? 0.6 : 1
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
            {isUploading ? "Uploading..." : "Record video"}
          </Text>
        </Pressable>

        <Pressable
          disabled={isUploading}
          onPress={onLibraryPress}
          style={{
            flex: 1,
            minWidth: 150,
            minHeight: 58,
            borderRadius: 18,
            backgroundColor: "#8b5e34",
            alignItems: "center",
            justifyContent: "center",
            opacity: isUploading ? 0.6 : 1
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
            {isUploading ? "Uploading..." : "Choose media"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
