import type { AttachmentCategory } from "@mobile-mechanic/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  loadAssignedJobAttachmentGallery,
  pickCameraImage,
  pickCameraVideo,
  pickMediaLibraryImage,
  uploadAssignedJobAttachment
} from "../../../../src/features/attachments/api";
import { AttachmentCard } from "../../../../src/features/attachments/components/attachment-card";
import { AttachmentUploadSheet } from "../../../../src/features/attachments/components/attachment-upload-sheet";
import type { AttachmentGalleryItem } from "../../../../src/features/attachments/mappers";
import type { MobileAppContext } from "../../../../src/lib/app-context";
import { useSessionContext } from "../../../../src/providers/session-provider";

export default function JobPhotosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : params.jobId?.[0] ?? null;
  const { appContext, refreshAppContext } = useSessionContext();
  const [attachments, setAttachments] = useState<AttachmentGalleryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<AttachmentCategory>("general");
  const [caption, setCaption] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadGallery = useCallback(async (context: MobileAppContext | null = appContext) => {
    if (!context || !jobId) {
      return;
    }

    const result = await loadAssignedJobAttachmentGallery(context.companyId, context.userId, jobId);
    setAttachments(result);
  }, [appContext, jobId]);

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (!jobId) {
        setErrorMessage("This stop photo route is invalid.");
        setIsLoading(false);
        return;
      }

      if (!appContext) {
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const result = await loadAssignedJobAttachmentGallery(
          appContext.companyId,
          appContext.userId,
          jobId
        );

        if (!isMounted) {
          return;
        }

        setAttachments(result);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Failed to load stop photos.";
        setErrorMessage(message);

        if (message.toLowerCase().includes("assigned job not found")) {
          router.replace("/jobs");
          return;
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, [appContext, jobId, router]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      const nextContext = await refreshAppContext();
      await loadGallery(nextContext);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to refresh stop photos.";
      setErrorMessage(message);

      if (message.toLowerCase().includes("assigned job not found")) {
        router.replace("/jobs");
        return;
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleUpload(type: "camera-photo" | "camera-video" | "library") {
    if (!appContext || !jobId) {
      return;
    }

    setIsUploading(true);
    setNotice(null);

    try {
      const asset =
        type === "camera-photo"
          ? await pickCameraImage()
          : type === "camera-video"
            ? await pickCameraVideo()
            : await pickMediaLibraryImage();

      if (!asset) {
        return;
      }

      const result = await uploadAssignedJobAttachment(appContext.companyId, appContext.userId, jobId, {
        asset,
        caption,
        category: selectedCategory
      });

      setCaption("");
      await loadGallery();
      setNotice(
        result.queued
          ? `This ${asset.mimeType.startsWith("video/") ? "video" : "photo"} is stored on the device and will upload automatically when the connection is back.`
          : `The ${asset.mimeType.startsWith("video/") ? "video" : "photo"} is now in the stop gallery.`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The evidence could not be uploaded.";

      if (message.toLowerCase().includes("assigned job not found")) {
        router.replace("/jobs");
        return;
      }

      Alert.alert(
        "Upload failed",
        message
      );
    } finally {
      setIsUploading(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f4ef"
        }}
      >
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f4ef" }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              alignSelf: "flex-start",
              borderRadius: 14,
              backgroundColor: "#e5e7eb",
              paddingHorizontal: 14,
              paddingVertical: 10
            }}
          >
            <Text style={{ color: "#111827", fontSize: 15, fontWeight: "700" }}>Back to stop</Text>
          </Pressable>

          <Text style={{ color: "#8b5e34", fontSize: 12, fontWeight: "700", letterSpacing: 1.1 }}>
            STOP EVIDENCE
          </Text>
          <Text style={{ color: "#111827", fontSize: 32, fontWeight: "700" }}>Attachment gallery</Text>
          <Text style={{ color: "#4b5563", fontSize: 16, lineHeight: 22 }}>
            Capture field photos and short videos or upload from the device library. Pull to refresh after changes.
          </Text>
        </View>

        <AttachmentUploadSheet
          caption={caption}
          isUploading={isUploading}
          onCameraPress={() => void handleUpload("camera-photo")}
          onCameraVideoPress={() => void handleUpload("camera-video")}
          onCaptionChange={setCaption}
          onCategoryChange={setSelectedCategory}
          onLibraryPress={() => void handleUpload("library")}
          selectedCategory={selectedCategory}
        />

        {errorMessage ? (
          <View style={{ borderRadius: 18, backgroundColor: "#fef2f2", padding: 16 }}>
            <Text style={{ color: "#b91c1c", fontSize: 15 }}>{errorMessage}</Text>
          </View>
        ) : null}
        {notice ? (
          <View style={{ borderRadius: 18, backgroundColor: "#fef3c7", padding: 16 }}>
            <Text style={{ color: "#92400e", fontSize: 15 }}>{notice}</Text>
          </View>
        ) : null}
        {attachments.some((attachment) => attachment.pendingUpload) ? (
          <View style={{ borderRadius: 18, backgroundColor: "#fef3c7", padding: 16 }}>
            <Text style={{ color: "#92400e", fontSize: 15 }}>
              {attachments.filter((attachment) => attachment.pendingUpload).length} attachment
              {attachments.filter((attachment) => attachment.pendingUpload).length === 1 ? "" : "s"} are queued on this device and will upload automatically when the app reconnects.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 14 }}>
          {attachments.length ? (
            attachments.map((attachment) => (
              <AttachmentCard key={attachment.id} item={attachment} />
            ))
          ) : (
            <View
              style={{
                borderRadius: 22,
                backgroundColor: "#ffffff",
                padding: 22,
                gap: 10
              }}
            >
              <Text style={{ color: "#111827", fontSize: 22, fontWeight: "700" }}>No evidence yet</Text>
              <Text style={{ color: "#4b5563", fontSize: 15, lineHeight: 22 }}>
                Use the camera or media buttons above to add the first stop attachment.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
