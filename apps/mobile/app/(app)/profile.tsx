import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View
} from "react-native";

import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Notice,
  Screen,
  ScreenHeader,
  ScreenScrollView,
  SectionCard
} from "../../src/components/ui";
import {
  loadTechnicianProfilePhotoUrl,
  pickCameraProfilePhoto,
  pickLibraryProfilePhoto,
  removeTechnicianProfilePhoto,
  saveTechnicianPublicProfile,
  uploadTechnicianProfilePhoto
} from "../../src/features/profile/api";
import { useSessionContext } from "../../src/providers/session-provider";
import { mobileTheme } from "../../src/theme";

type AccountFactProps = {
  label: string;
  value: string;
};

function getPreviewName(fullName: string, fallbackEmail: string | null | undefined) {
  return fullName.trim() || fallbackEmail?.split("@")[0] || "Your name here";
}

function getPreviewInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "MM";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function AccountFact({ label, value }: AccountFactProps) {
  return (
    <View
      style={{
        backgroundColor: mobileTheme.colors.surface.base,
        borderRadius: mobileTheme.radius.lg,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border.subtle,
        flex: 1,
        gap: mobileTheme.spacing[1],
        minWidth: 132,
        padding: mobileTheme.spacing[3]
      }}
    >
      <Text
        style={{
          color: mobileTheme.colors.text.muted,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase"
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: mobileTheme.colors.text.strong,
          fontFamily: mobileTheme.typography.family.body,
          fontSize: 14,
          fontWeight: "600",
          lineHeight: 18
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { appContext, isRefreshingContext, refreshAppContext, session, signOutUser } = useSessionContext();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [certificationsText, setCertificationsText] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [meetYourMechanicEnabled, setMeetYourMechanicEnabled] = useState(false);

  useEffect(() => {
    if (!appContext?.profile) {
      return;
    }

    setFullName(appContext.profile.full_name ?? "");
    setPhone(appContext.profile.phone ?? "");
    setBio(appContext.profile.technician_bio ?? "");
    setCertificationsText((appContext.profile.technician_certifications ?? []).join(", "));
    setYearsExperience(
      appContext.profile.years_experience !== null && appContext.profile.years_experience !== undefined
        ? String(appContext.profile.years_experience)
        : ""
    );
    setMeetYourMechanicEnabled(appContext.profile.meet_your_mechanic_enabled ?? false);
  }, [appContext?.profile]);

  useEffect(() => {
    let isMounted = true;

    async function run() {
      if (!appContext?.profile) {
        setProfilePhotoUrl(null);
        return;
      }

      try {
        const nextUrl = await loadTechnicianProfilePhotoUrl(appContext.profile);

        if (isMounted) {
          setProfilePhotoUrl(nextUrl);
        }
      } catch {
        if (isMounted) {
          setProfilePhotoUrl(null);
        }
      }
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, [appContext?.profile]);

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOutUser();
    setIsSigningOut(false);
  }

  async function handleSaveProfile() {
    if (!appContext) {
      return;
    }

    const normalizedYearsExperience = yearsExperience.trim();
    const certifications = certificationsText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (normalizedYearsExperience && Number.isNaN(Number(normalizedYearsExperience))) {
      Alert.alert("Profile invalid", "Years of experience must be a number.");
      return;
    }

    setIsSaving(true);

    try {
      await saveTechnicianPublicProfile(appContext.userId, {
        fullName: fullName.trim() || null,
        phone: phone.trim() || null,
        technicianBio: bio.trim() || null,
        technicianCertifications: certifications,
        yearsExperience: normalizedYearsExperience ? Number(normalizedYearsExperience) : null,
        meetYourMechanicEnabled
      });

      await refreshAppContext();
      Alert.alert("Profile saved", "Your Meet Your Mechanic profile is up to date.");
    } catch (error) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "The profile could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePhotoSelection(source: "camera" | "library") {
    if (!appContext?.profile) {
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const asset =
        source === "camera" ? await pickCameraProfilePhoto() : await pickLibraryProfilePhoto();

      if (!asset) {
        return;
      }

      await uploadTechnicianProfilePhoto(appContext.userId, appContext.profile, asset);
      const nextContext = await refreshAppContext();
      setProfilePhotoUrl(await loadTechnicianProfilePhotoUrl(nextContext?.profile ?? null));
    } catch (error) {
      Alert.alert(
        "Photo update failed",
        error instanceof Error ? error.message : "The profile photo could not be updated."
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    if (!appContext?.profile) {
      return;
    }

    setIsUploadingPhoto(true);

    try {
      await removeTechnicianProfilePhoto(appContext.userId, appContext.profile);
      await refreshAppContext();
      setProfilePhotoUrl(null);
    } catch (error) {
      Alert.alert(
        "Photo removal failed",
        error instanceof Error ? error.message : "The profile photo could not be removed."
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  const previewName = getPreviewName(fullName, session?.user.email);
  const previewInitials = getPreviewInitials(previewName);
  const previewBadges: string[] = [
    yearsExperience.trim() ? `${yearsExperience.trim()} years experience` : null,
    ...certificationsText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 2)
  ].filter((value): value is string => Boolean(value));

  return (
    <Screen>
      <ScreenScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshingContext} onRefresh={() => void refreshAppContext()} />
        }
      >
        <ScreenHeader
          compact
          badges={
            <Badge tone={meetYourMechanicEnabled ? "success" : "neutral"}>
              {meetYourMechanicEnabled ? "Public card on" : "Public card off"}
            </Badge>
          }
          description="Control the customer-facing mechanic card."
          eyebrow="Technician profile"
          title="Mechanic profile"
        />

        <SectionCard
          eyebrow="Account"
          surface="flat"
          title="Technician account"
        >
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: mobileTheme.spacing[3]
            }}
          >
            <AccountFact label="Email" value={session?.user.email ?? "Unknown user"} />
            <AccountFact label="Company" value={appContext?.company.name ?? "No company"} />
            <AccountFact
              label="Role"
              value={appContext?.membership.role ? `${appContext.membership.role}` : "Unknown"}
            />
            <AccountFact label="Phone" value={appContext?.profile.phone ?? "Not provided"} />
          </View>
        </SectionCard>

        <SectionCard
          eyebrow="Preview"
          surface="flat"
          title="Public card preview"
        >
          <Card
            style={{
              backgroundColor: mobileTheme.colors.surface.inverse,
              borderColor: "transparent",
              gap: mobileTheme.spacing[4]
            }}
            tone="raised"
          >
            {profilePhotoUrl ? (
              <Image
                source={{ uri: profilePhotoUrl }}
                style={{
                  width: "100%",
                  height: 220,
                  borderRadius: mobileTheme.radius.xl,
                  backgroundColor: "#d4dde7"
                }}
              />
            ) : (
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255, 253, 248, 0.06)",
                  borderRadius: mobileTheme.radius.xl,
                  borderWidth: 1,
                  borderColor: "rgba(255, 253, 248, 0.12)",
                  height: 220,
                  justifyContent: "center",
                  padding: mobileTheme.spacing[4],
                  overflow: "hidden"
                }}
              >
                {isUploadingPhoto ? (
                  <ActivityIndicator color={mobileTheme.colors.text.inverse} size="large" />
                ) : (
                  <View style={{ alignItems: "center", gap: mobileTheme.spacing[3] }}>
                    <View
                      style={{
                        alignItems: "center",
                        justifyContent: "center",
                        width: 84,
                        height: 84,
                        borderRadius: 42,
                        backgroundColor: "rgba(255, 253, 248, 0.12)",
                        borderWidth: 1,
                        borderColor: "rgba(255, 253, 248, 0.16)"
                      }}
                    >
                      <Text
                        style={{
                          color: mobileTheme.colors.text.inverse,
                          fontFamily: mobileTheme.typography.family.display,
                          fontSize: 28,
                          fontWeight: "700",
                          lineHeight: 30
                        }}
                      >
                        {previewInitials}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: mobileTheme.colors.text.inverse,
                        fontFamily: mobileTheme.typography.family.display,
                        fontSize: 21,
                        fontWeight: "700",
                        lineHeight: 23
                      }}
                    >
                      Add a profile photo
                    </Text>
                    <Text
                      style={{
                        color: "#d9e5f2",
                        fontFamily: mobileTheme.typography.family.body,
                        fontSize: 14,
                        lineHeight: 20,
                        textAlign: "center"
                      }}
                    >
                      A clear headshot helps customers trust the visit before you arrive.
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ gap: mobileTheme.spacing[2] }}>
              <Text
                style={{
                  color: "#cfdded",
                  fontFamily: mobileTheme.typography.family.body,
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 1,
                  textTransform: "uppercase"
                }}
              >
                Customer preview
              </Text>
              <Text
                style={{
                  color: mobileTheme.colors.text.inverse,
                  fontFamily: mobileTheme.typography.family.display,
                  fontSize: 26,
                  fontWeight: "700",
                  lineHeight: 28
                }}
              >
                {previewName}
              </Text>
              <Text
                style={{
                  color: "#d9e5f2",
                  fontFamily: mobileTheme.typography.family.body,
                  fontSize: 14,
                  lineHeight: 20
                }}
              >
                {bio.trim()
                  ? bio.trim()
                  : "Add a short intro about what you work on and what customers should expect."}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
                {previewBadges.length
                  ? previewBadges.map((value) => (
                      <Badge key={value} tone={value.includes("years experience") ? "info" : "neutral"}>
                        {value}
                      </Badge>
                    ))
                  : (
                    <Badge tone="neutral">Add certifications or experience</Badge>
                  )}
              </View>
            </View>
          </Card>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: mobileTheme.spacing[2] }}>
            <Button
              fullWidth={false}
              loading={isUploadingPhoto}
              onPress={() => void handlePhotoSelection("camera")}
              size="sm"
            >
              Take photo
            </Button>
            <Button
              fullWidth={false}
              loading={isUploadingPhoto}
              onPress={() => void handlePhotoSelection("library")}
              tone="secondary"
              size="sm"
            >
              Choose photo
            </Button>
            {appContext?.profile.profile_photo_path ? (
              <Button
                fullWidth={false}
                loading={isUploadingPhoto}
                onPress={() => void handleRemovePhoto()}
                tone="tertiary"
                size="sm"
              >
                Remove photo
              </Button>
            ) : null}
          </View>
        </SectionCard>

        <SectionCard
          eyebrow="Customer-facing details"
          surface="flat"
          title="Card details"
        >
          <Notice
            body="Edit only what customers see before arrival. Keep it short, credible, and easy to scan."
            tone="brand"
          />

          <Field label="Full name">
            <Input
              onChangeText={setFullName}
              placeholder="Name shown to customers"
              value={fullName}
            />
          </Field>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: mobileTheme.spacing[3]
            }}
          >
            <View style={{ flex: 1, minWidth: 148 }}>
              <Field label="Phone">
                <Input
                  keyboardType="phone-pad"
                  onChangeText={setPhone}
                  placeholder="Optional"
                  value={phone}
                />
              </Field>
            </View>

            <View style={{ flex: 1, minWidth: 148 }}>
              <Field label="Years of experience">
                <Input
                  keyboardType="number-pad"
                  onChangeText={setYearsExperience}
                  placeholder="Optional"
                  value={yearsExperience}
                />
              </Field>
            </View>
          </View>

          <Field label="Certifications">
            <Input
              onChangeText={setCertificationsText}
              placeholder="ASE Master, Hybrid, Diesel"
              value={certificationsText}
            />
          </Field>

          <Field hint="What you work on and what the visit should feel like." label="Bio">
            <Input
              multiline
              numberOfLines={5}
              onChangeText={setBio}
              placeholder="Short customer-facing intro"
              value={bio}
            />
          </Field>

          <Pressable
            onPress={() => setMeetYourMechanicEnabled((value) => !value)}
            style={{
              backgroundColor: meetYourMechanicEnabled
                ? mobileTheme.status.success.background
                : mobileTheme.colors.surface.subtle,
              borderRadius: mobileTheme.radius.xl,
              borderWidth: 1,
              borderColor: meetYourMechanicEnabled
                ? mobileTheme.status.success.border
                : mobileTheme.colors.border.base,
              gap: mobileTheme.spacing[2],
              padding: mobileTheme.spacing[4]
            }}
          >
            <Text
              style={{
                color: mobileTheme.colors.text.strong,
                fontFamily: mobileTheme.typography.family.display,
                fontSize: 18,
                fontWeight: "700",
                lineHeight: 20
              }}
            >
              {meetYourMechanicEnabled ? "Sharing is enabled" : "Sharing is paused"}
            </Text>
            <Text
              style={{
                color: mobileTheme.colors.text.muted,
                fontFamily: mobileTheme.typography.family.body,
                fontSize: 14,
                lineHeight: 20
              }}
            >
              Toggle whether customers can see this card before the visit.
            </Text>
          </Pressable>

          <Button loading={isSaving} onPress={() => void handleSaveProfile()}>
            {isSaving ? "Saving profile" : "Save public card"}
          </Button>
        </SectionCard>

        <SectionCard
          eyebrow="Session"
          surface="flat"
          title="Secure the device"
        >
          <Notice
            body="Sign out when you are done for the day or handing the device to someone else."
            title="Technician session"
            tone="info"
          />
          <Button loading={isSigningOut} onPress={handleSignOut} tone="secondary">
            {isSigningOut ? "Signing out" : "Sign out"}
          </Button>
        </SectionCard>
      </ScreenScrollView>
    </Screen>
  );
}
