import { Linking, Pressable, Image, Text, View } from "react-native";

import type { AttachmentGalleryItem } from "../mappers";
import {
  formatAttachmentCategoryLabel,
  formatAttachmentKindLabel,
  formatAttachmentTimestamp,
  isVideoAttachment
} from "../mappers";

type AttachmentCardProps = {
  item: AttachmentGalleryItem;
};

export function AttachmentCard({ item }: AttachmentCardProps) {
  const isVideo = isVideoAttachment(item);

  async function handleOpenVideo() {
    if (!item.signedUrl) {
      return;
    }

    await Linking.openURL(item.signedUrl);
  }

  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: "#ffffff",
        overflow: "hidden"
      }}
    >
      {item.signedUrl && !isVideo ? (
        <Image
          source={{ uri: item.signedUrl }}
          style={{
            width: "100%",
            height: 220,
            backgroundColor: "#e5e7eb"
          }}
        />
      ) : (
        <View
          style={{
            width: "100%",
            height: 220,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#e5e7eb"
          }}
        >
          <Text style={{ color: "#4b5563", fontSize: 16, fontWeight: "600" }}>
            {isVideo ? "Video ready" : "Preview unavailable"}
          </Text>
          {isVideo && item.signedUrl ? (
            <Pressable
              onPress={() => void handleOpenVideo()}
              style={{
                marginTop: 12,
                borderRadius: 999,
                backgroundColor: "#111827",
                paddingHorizontal: 16,
                paddingVertical: 10
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "700" }}>Play video</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={{ padding: 16, gap: 6 }}>
        <View
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            backgroundColor: item.pendingUpload ? "#fef3c7" : "#f3f4f6",
            paddingHorizontal: 10,
            paddingVertical: 6
          }}
        >
          <Text style={{ color: "#374151", fontSize: 12, fontWeight: "700" }}>
            {item.pendingUpload
              ? `${formatAttachmentKindLabel(item)} · ${formatAttachmentCategoryLabel(item.category)} · Queued`
              : `${formatAttachmentKindLabel(item)} · ${formatAttachmentCategoryLabel(item.category)}`}
          </Text>
        </View>

        <Text numberOfLines={1} style={{ color: "#111827", fontSize: 17, fontWeight: "700" }}>
          {item.fileName}
        </Text>
        <Text style={{ color: "#6b7280", fontSize: 14 }}>{formatAttachmentTimestamp(item.createdAt)}</Text>
        {item.caption ? (
          <Text style={{ color: "#374151", fontSize: 15, lineHeight: 21 }}>{item.caption}</Text>
        ) : null}
      </View>
    </View>
  );
}
