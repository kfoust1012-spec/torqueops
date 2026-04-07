import { useState } from "react";
import { View } from "react-native";

import { Button, DictationButton, Field, Input } from "../../../components/ui";
import { mechanicActionPhrases, mergeDictationContext } from "../../voice/dictation-context";

type JobNoteComposerProps = {
  isSubmitting: boolean;
  onSubmit: (body: string) => Promise<void>;
};

export function JobNoteComposer({ isSubmitting, onSubmit }: JobNoteComposerProps) {
  const [body, setBody] = useState("");

  async function handleSubmit() {
    const trimmed = body.trim();

    if (!trimmed) {
      return;
    }

    await onSubmit(trimmed);
    setBody("");
  }

  return (
    <View style={{ gap: 8 }}>
      <Field label="Add note">
        <Input
          multiline
          onChangeText={setBody}
          placeholder="Add a technician note for the office team."
          placeholderTextColor="#9ca3af"
          style={{ minHeight: 88 }}
          value={body}
        />
      </Field>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <DictationButton
          contextualStrings={mergeDictationContext(mechanicActionPhrases)}
          label="Dictate note"
          onChangeText={setBody}
          value={body}
        />
        <Button
          disabled={body.trim().length === 0}
          fullWidth={false}
          loading={isSubmitting}
          tone="secondary"
          onPress={() => void handleSubmit()}
        >
          Add note
        </Button>
      </View>
    </View>
  );
}
