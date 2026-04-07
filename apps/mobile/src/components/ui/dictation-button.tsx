import { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";

import { Button } from "./button";

type SpeechSubscription = {
  remove: () => void;
};

type DictationButtonProps = {
  contextualStrings?: string[] | undefined;
  label?: string | undefined;
  onChangeText: (value: string) => void;
  value: string;
};

type SpeechRecognitionModuleHandle = {
  abort: () => void;
  addListener: (
    eventName: string,
    listener: (event: any) => void
  ) => SpeechSubscription;
  isRecognitionAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (options: Record<string, unknown>) => void;
  stop: () => void;
};

function appendTranscript(baseValue: string, transcript: string) {
  const cleanBase = baseValue.trimEnd();
  const cleanTranscript = transcript.trim();

  if (!cleanTranscript) {
    return cleanBase;
  }

  if (!cleanBase) {
    return cleanTranscript;
  }

  return /[\s\-(/]$/.test(cleanBase) ? `${cleanBase}${cleanTranscript}` : `${cleanBase} ${cleanTranscript}`;
}

export function DictationButton({
  contextualStrings,
  label = "Dictate",
  onChangeText,
  value
}: DictationButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const baseValueRef = useRef(value);
  const speechModuleRef = useRef<SpeechRecognitionModuleHandle | null>(null);
  const subscriptionsRef = useRef<SpeechSubscription[]>([]);

  async function loadSpeechModule() {
    if (speechModuleRef.current) {
      return speechModuleRef.current;
    }

    const module = await import("expo-speech-recognition");
    const speechModule = module.ExpoSpeechRecognitionModule as unknown as SpeechRecognitionModuleHandle;
    speechModuleRef.current = speechModule;
    return speechModule;
  }

  function clearSubscriptions() {
    subscriptionsRef.current.forEach((subscription) => subscription.remove());
    subscriptionsRef.current = [];
  }

  useEffect(() => {
    return () => {
      clearSubscriptions();
      if (isListening) {
        speechModuleRef.current?.abort();
      }
    };
  }, [isListening]);

  async function handlePress() {
    let speechModule: SpeechRecognitionModuleHandle;

    try {
      speechModule = await loadSpeechModule();
    } catch {
      Alert.alert(
        "Dictation unavailable",
        "Speech recognition is not available in this build right now. Use the keyboard instead."
      );
      return;
    }

    if (isListening) {
      speechModule.stop();
      return;
    }

    if (!speechModule.isRecognitionAvailable()) {
      Alert.alert(
        "Dictation unavailable",
        "Speech recognition is not available on this device right now. Enable the system speech service or use the keyboard."
      );
      return;
    }

    clearSubscriptions();
    baseValueRef.current = value;
    setStatusMessage("Listening… speak now.");

    subscriptionsRef.current = [
      speechModule.addListener("result", (event) => {
        const transcript = event.results[0]?.transcript?.trim() ?? "";

        if (!transcript) {
          return;
        }

        onChangeText(appendTranscript(baseValueRef.current, transcript));

        if (event.isFinal) {
          setStatusMessage("Dictation captured.");
        }
      }),
      speechModule.addListener("error", (event) => {
        setIsListening(false);
        setStatusMessage(event.message || "Dictation failed.");
        clearSubscriptions();
      }),
      speechModule.addListener("end", () => {
        setIsListening(false);
        clearSubscriptions();
      }),
      speechModule.addListener("start", () => {
        setIsListening(true);
      })
    ];

    try {
      const permission = await speechModule.requestPermissionsAsync();

      if (!permission.granted) {
        setStatusMessage("Microphone or speech permission was denied.");
        clearSubscriptions();
        return;
      }

      speechModule.start({
        addsPunctuation: true,
        continuous: false,
        interimResults: true,
        iosTaskHint: "dictation",
        lang: "en-US",
        ...(contextualStrings?.length ? { contextualStrings } : {})
      });
    } catch (error) {
      setIsListening(false);
      setStatusMessage(error instanceof Error ? error.message : "Dictation could not start.");
      clearSubscriptions();
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Button fullWidth={false} onPress={() => void handlePress()} tone={isListening ? "danger" : "tertiary"}>
        {isListening ? "Stop dictation" : label}
      </Button>
      {statusMessage ? (
        <Text style={{ color: "#6b7280", fontSize: 13, lineHeight: 18 }}>{statusMessage}</Text>
      ) : null}
    </View>
  );
}
