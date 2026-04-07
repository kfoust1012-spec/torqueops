import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState
} from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

export type SignaturePadHandle = {
  capture: () => Promise<{
    mimeType: "image/png";
    uri: string;
  }>;
  clear: () => void;
  isEmpty: () => boolean;
};

type SignaturePadProps = {
  disabled?: boolean;
};

type Stroke = string[];

function getPoint(event: GestureResponderEvent) {
  return `${event.nativeEvent.locationX.toFixed(1)},${event.nativeEvent.locationY.toFixed(1)}`;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { disabled = false },
  ref
) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke>([]);
  const viewShotRef = useRef<View | null>(null);

  function replaceLastStroke(nextStroke: Stroke) {
    setStrokes((previous) => {
      if (!previous.length) {
        return [nextStroke];
      }

      const next = [...previous];
      next[next.length - 1] = nextStroke;
      return next;
    });
  }

  function handleGrant(event: GestureResponderEvent) {
    if (disabled) {
      return;
    }

    const point = getPoint(event);
    currentStrokeRef.current = [point];
    setStrokes((previous) => [...previous, [point]]);
  }

  function handleMove(event: GestureResponderEvent, _gestureState: PanResponderGestureState) {
    if (disabled || !currentStrokeRef.current.length) {
      return;
    }

    const nextStroke = [...currentStrokeRef.current, getPoint(event)];
    currentStrokeRef.current = nextStroke;
    replaceLastStroke(nextStroke);
  }

  function handleRelease(event: GestureResponderEvent) {
    if (disabled || !currentStrokeRef.current.length) {
      return;
    }

    if (currentStrokeRef.current.length === 1) {
      const point = getPoint(event);
      const nextStroke = [currentStrokeRef.current[0]!, point];
      currentStrokeRef.current = nextStroke;
      replaceLastStroke(nextStroke);
    }

    currentStrokeRef.current = [];
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponderCapture: () => !disabled,
        onStartShouldSetPanResponder: () => !disabled,
        onStartShouldSetPanResponderCapture: () => !disabled,
        onPanResponderGrant: handleGrant,
        onPanResponderMove: handleMove,
        onPanResponderRelease: handleRelease,
        onPanResponderTerminate: handleRelease
      }),
    [disabled]
  );

  useImperativeHandle(
    ref,
    () => ({
      async capture() {
        if (!strokes.length || !viewShotRef.current) {
          throw new Error("Draw a signature before submitting.");
        }

        const result = await captureRef(viewShotRef, {
          format: "png",
          quality: 1,
          height: 240,
          result: "tmpfile",
          width: 720
        });

        if (!result) {
          throw new Error("Signature capture failed.");
        }

        return {
          mimeType: "image/png",
          uri: result
        };
      },
      clear() {
        currentStrokeRef.current = [];
        setStrokes([]);
      },
      isEmpty() {
        return strokes.length === 0;
      }
    }),
    [strokes]
  );

  return (
    <View style={styles.wrapper}>
      <View ref={viewShotRef} collapsable={false} style={styles.canvas}>
        <Svg height="100%" width="100%">
          {strokes.map((stroke, index) => (
            <Polyline
              key={`${index}-${stroke.length}`}
              fill="none"
              points={stroke.join(" ")}
              stroke="#111827"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={4}
            />
          ))}
        </Svg>
      </View>

      <View pointerEvents={disabled ? "none" : "auto"} style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      <Text style={styles.hint}>
        Sign inside the box using your finger or stylus.
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    gap: 10
  },
  canvas: {
    height: 240,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    overflow: "hidden"
  },
  hint: {
    color: "#6b7280",
    fontSize: 14
  }
});
