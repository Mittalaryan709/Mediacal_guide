import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { radius, spacing, useTheme } from "@/src/theme";

type Stage = "pick" | "preview" | "processing" | "error";

export default function Upload() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const [stage, setStage] = useState<Stage>("pick");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [camDenied, setCamDenied] = useState(false);

  const pickImage = async (fromCamera: boolean) => {
    setError("");
    try {
      if (fromCamera) {
        const current = await ImagePicker.getCameraPermissionsAsync();
        if (!current.granted) {
          const req = await ImagePicker.requestCameraPermissionsAsync();
          if (!req.granted) {
            if (!req.canAskAgain) setCamDenied(true);
            setError("Camera permission needed to scan reports.");
            return;
          }
        }
      }
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            base64: true,
            quality: 0.6,
          });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setImageBase64(result.assets[0].base64);
      setImageUri(result.assets[0].uri);
      setStage("preview");
    } catch (e) {
      console.warn("pick failed", e);
      setError("Could not open picker. Please try again.");
    }
  };

  const analyze = async () => {
    if (!imageBase64) return;
    setStage("processing");
    try {
      const res = await api("/reports/analyze", {
        method: "POST",
        body: JSON.stringify({ image_base64: imageBase64 }),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/report/${res.report.id}`);
    } catch (e: any) {
      setError(e?.message || "Analysis failed. Please retake a clearer photo.");
      setStage("error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="upload-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="upload-back-button" onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.title, { color: colors.onSurface }]}>Scan Report</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} showsVerticalScrollIndicator={false}>
        {stage === "pick" && (
          <View style={{ gap: spacing.lg }}>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 14, lineHeight: 21 }}>
              Capture or upload a prescription, lab report or discharge summary.
              AI will read it and explain everything in simple language.
            </Text>
            <Pressable
              testID="camera-capture-button"
              onPress={() => pickImage(true)}
              style={[styles.bigOption, { backgroundColor: colors.brandPrimary }]}
            >
              <Ionicons name="camera-outline" size={32} color="#fff" />
              <Text style={styles.bigOptionTitle}>Camera Capture</Text>
              <Text style={styles.bigOptionSub}>Scan the document directly</Text>
            </Pressable>
            <Pressable
              testID="gallery-pick-button"
              onPress={() => pickImage(false)}
              style={[styles.bigOption, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}
            >
              <Ionicons name="images-outline" size={32} color={colors.brandSecondary} />
              <Text style={[styles.bigOptionTitle, { color: colors.onSurface }]}>Choose from Gallery</Text>
              <Text style={[styles.bigOptionSub, { color: colors.onSurfaceTertiary }]}>PNG or JPEG photos</Text>
            </Pressable>
            {!!error && (
              <View style={[styles.errorBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.error }]}>
                <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{error}</Text>
                {camDenied && (
                  <Pressable testID="open-settings-button" onPress={() => Linking.openSettings()} style={[styles.settingsBtn, { backgroundColor: colors.error }]}>
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Open Settings</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        {(stage === "preview" || stage === "processing" || stage === "error") && imageUri && (
          <View style={{ gap: spacing.lg }}>
            <View style={[styles.previewCard, { borderColor: colors.border }]}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="cover" />
              {stage === "processing" && <ScanOverlay color={colors.brandSecondary} />}
            </View>

            {stage === "preview" && (
              <>
                <Pressable testID="analyze-button" onPress={analyze} style={[styles.cta, { backgroundColor: colors.brandPrimary }]}>
                  <Ionicons name="sparkles-outline" size={18} color="#fff" />
                  <Text style={styles.ctaText}>Analyze with AI</Text>
                </Pressable>
                <Pressable testID="retake-button" onPress={() => setStage("pick")} style={[styles.cta, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={[styles.ctaText, { color: colors.onSurface }]}>Choose different image</Text>
                </Pressable>
              </>
            )}

            {stage === "processing" && (
              <View style={{ alignItems: "center", gap: spacing.sm }} testID="processing-indicator">
                <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 16 }}>
                  AI is reading your document…
                </Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, textAlign: "center" }}>
                  Extracting text, detecting medicines and preparing a simple explanation. Takes ~10-20 seconds.
                </Text>
              </View>
            )}

            {stage === "error" && (
              <>
                <View style={[styles.errorBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.error }]}>
                  <Text style={{ color: colors.error, fontSize: 13, flex: 1 }}>{error}</Text>
                </View>
                <Pressable testID="retry-analyze-button" onPress={analyze} style={[styles.cta, { backgroundColor: colors.brandPrimary }]}>
                  <Text style={styles.ctaText}>Retry Analysis</Text>
                </Pressable>
                <Pressable testID="error-retake-button" onPress={() => setStage("pick")} style={[styles.cta, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={[styles.ctaText, { color: colors.onSurface }]}>Retake photo</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ScanOverlay({ color }: { color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [y]);
  const style = useAnimatedStyle(() => ({
    top: `${y.value * 90}%`,
  }));
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]} />
      <Animated.View style={[styles.scanLine, { backgroundColor: color, shadowColor: color }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontWeight: "800" },
  bigOption: { borderRadius: radius.lg, padding: spacing.xl, alignItems: "center", gap: 6 },
  bigOptionTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  bigOptionSub: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  settingsBtn: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  previewCard: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden", height: 380 },
  previewImage: { width: "100%", height: "100%" },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 3,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  cta: {
    flexDirection: "row",
    height: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  ctaText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
