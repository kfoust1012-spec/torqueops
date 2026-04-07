import {
  DEFAULT_ESTIMATE_APPROVAL_STATEMENT,
  getCustomerDisplayName
} from "@mobile-mechanic/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

import {
  Badge,
  Button,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Notice,
  Screen,
  ScreenHeader,
  ScreenScrollView,
  SectionCard,
  StickyActionDock,
  StatusBadge
} from "../../../../../src/components/ui";
import { approveAssignedEstimateFromMobile } from "../../../../../src/features/estimates/approval-api";
import { loadAssignedJobEstimate } from "../../../../../src/features/estimates/api";
import {
  SignaturePad,
  type SignaturePadHandle
} from "../../../../../src/features/estimates/components/signature-pad";
import { useSessionContext } from "../../../../../src/providers/session-provider";

type EstimateDetailData = Awaited<ReturnType<typeof loadAssignedJobEstimate>> | null;

export default function ApproveEstimateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : params.jobId?.[0] ?? null;
  const { appContext } = useSessionContext();
  const signaturePadRef = useRef<SignaturePadHandle | null>(null);
  const [detail, setDetail] = useState<EstimateDetailData>(null);
  const [signerName, setSignerName] = useState("");
  const [statement, setStatement] = useState(DEFAULT_ESTIMATE_APPROVAL_STATEMENT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    body: string;
    title?: string;
    tone: "brand" | "danger" | "success" | "warning";
  } | null>(null);

  const loadDetail = useCallback(async () => {
    if (!jobId) {
      setErrorMessage("This approval route is invalid.");
      setIsLoading(false);
      return;
    }

    if (!appContext) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await loadAssignedJobEstimate(appContext.companyId, appContext.userId, jobId);

      if (!result) {
        setErrorMessage("This assigned estimate could not be loaded.");
        setDetail(null);
        return;
      }

      setDetail(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load estimate approval.";
      setErrorMessage(message);
      setDetail(null);

      if (message.toLowerCase().includes("assigned job not found")) {
        router.replace("/jobs");
      }
    } finally {
      setIsLoading(false);
    }
  }, [appContext, jobId, router]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!detail) {
      return;
    }

    setSignerName((current) => current.trim() || getCustomerDisplayName(detail.customer));
  }, [detail]);

  async function handleSubmit() {
    if (!appContext || !jobId || !detail) {
      return;
    }

    if (detail.estimate.status !== "sent") {
      setNotice({
        body: "Only sent estimates can be approved from the field.",
        title: "Approval unavailable",
        tone: "warning"
      });
      return;
    }

    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setNotice({
        body: "Draw the customer signature before submitting approval.",
        title: "Signature required",
        tone: "warning"
      });
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      console.info("[estimate-approve] submit pressed", { jobId });
      const capturedSignature = await signaturePadRef.current.capture();
      console.info("[estimate-approve] signature captured", {
        jobId,
        signatureUri: capturedSignature.uri
      });

      await approveAssignedEstimateFromMobile(appContext.companyId, appContext.userId, jobId, {
        signatureMimeType: capturedSignature.mimeType,
        signatureUri: capturedSignature.uri,
        signedByName: signerName,
        statement
      });

      router.replace(`/jobs/${jobId}/estimate`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The approval signature could not be saved.";
      console.error("[estimate-approve] submit failed", {
        jobId,
        message
      });

      if (message.toLowerCase().includes("assigned job not found")) {
        router.replace("/jobs");
        return;
      }

      setNotice({
        body: message,
        title: "Approval failed",
        tone: "danger"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <LoadingState body="Loading estimate approval details." title="Loading approval" />;
  }

  if (!detail || detail.estimate.status !== "sent") {
    return (
      <Screen>
        <ErrorState
          actions={
            <View style={{ gap: 12 }}>
              <Button onPress={() => void loadDetail()}>Retry</Button>
              <Button
                onPress={() => router.replace(jobId ? `/jobs/${jobId}/estimate` : "/jobs")}
                tone="secondary"
              >
                Back to estimate
              </Button>
            </View>
          }
          body={errorMessage ?? "Only sent estimates can be approved from the field."}
          eyebrow="Estimate approval"
          title="Approval unavailable"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenScrollView
        contentContainerStyle={{
          paddingBottom: 160
        }}
      >
        <ScreenHeader
          actions={
            <Button
              fullWidth={false}
              onPress={() => router.replace(`/jobs/${jobId}/estimate`)}
              tone="secondary"
            >
              Back to estimate
            </Button>
          }
          badges={
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <StatusBadge status={detail.estimate.status} />
              <Badge tone="info">{detail.estimate.estimateNumber}</Badge>
            </View>
          }
          description="Capture the customer signature to approve this estimate from the field."
          eyebrow="Estimate approval"
          title={detail.estimate.title}
        />

        {notice ? <Notice body={notice.body} title={notice.title} tone={notice.tone} /> : null}

        <SectionCard
          description="Record the customer signer name and confirm the approval statement before capturing the signature."
          eyebrow="Signer details"
          title="Approval details"
        >
          <Field label="Customer signer name">
            <Input
              autoCapitalize="words"
              onChangeText={setSignerName}
              placeholder="Customer full name"
              placeholderTextColor="#9ca3af"
              value={signerName}
            />
          </Field>

          <Field label="Approval statement">
            <Input
              multiline
              onChangeText={setStatement}
              placeholder="Approval statement"
              placeholderTextColor="#9ca3af"
              value={statement}
            />
          </Field>
        </SectionCard>

        <SectionCard
          description="Draw the customer signature directly on the device, then submit the approval."
          eyebrow="Signature"
          title="Capture signature"
        >
          <Notice
            body="A signature is required before this estimate can be approved."
            tone="brand"
          />
          <SignaturePad ref={signaturePadRef} disabled={isSubmitting} />
          <Button
            fullWidth={false}
            onPress={() => signaturePadRef.current?.clear()}
            tone="secondary"
          >
            Clear signature
          </Button>
        </SectionCard>

      </ScreenScrollView>

      <StickyActionDock>
        <View style={{ gap: 10 }}>
          <Button onPress={() => router.replace(`/jobs/${jobId}/estimate`)} tone="secondary">
            Back to estimate
          </Button>
          <Button loading={isSubmitting} onPress={() => void handleSubmit()} size="lg">
            Approve estimate
          </Button>
        </View>
      </StickyActionDock>
    </Screen>
  );
}
