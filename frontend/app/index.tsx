import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { radius, spacing, useTheme } from "@/src/theme";

const FEATURES = [
  { icon: "scan-outline", label: "AI Prescription Scan" },
  { icon: "chatbubbles-outline", label: "Chat with Reports" },
  { icon: "alarm-outline", label: "Medicine Reminders" },
  { icon: "medkit-outline", label: "Emergency Card" },
];

const STATS = [
  { value: "10s", label: "Avg. analysis time" },
  { value: "3+", label: "Report types" },
  { value: "24/7", label: "AI assistant" },
];

export default function Landing() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, mode } = useTheme();

  useEffect(() => {
    if (!loading && user) router.replace("/(tabs)/home");
  }, [loading, user, router]);

  if (loading || user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.surface }]} testID="landing-loading">
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="landing-screen">
      <LinearGradient
        colors={
          mode === "dark"
            ? ["#0B1B3F", "#081226", colors.surface]
            : ["#DBEAFE", "#EFF6FF", colors.surface]
        }
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.xxl, paddingBottom: spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(600)} style={styles.heroWrap}>
          <View style={[styles.logoBadge, { backgroundColor: colors.brandPrimary }]}>
            <Ionicons name="pulse" size={30} color="#fff" />
          </View>
          <Text style={[styles.brand, { color: colors.brandPrimary }]}>MediGuide AI</Text>
          <Text style={[styles.heroTitle, { color: colors.onSurface }]}>
            Understand your{"\n"}medical reports{"\n"}
            <Text style={{ color: colors.brandSecondary }}>in plain language</Text>
          </Text>
          <Text style={[styles.heroSub, { color: colors.onSurfaceTertiary }]}>
            Scan prescriptions & lab reports. Get simple explanations, medicine
            schedules and smart reminders — powered by AI.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.statsRow}>
          {STATS.map((s) => (
            <View
              key={s.label}
              style={[styles.statCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Text style={[styles.statValue, { color: colors.onSurface }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.onSurfaceTertiary }]}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(350).duration(600)} style={styles.featuresWrap}>
          {FEATURES.map((f) => (
            <View
              key={f.label}
              style={[styles.featureChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Ionicons name={f.icon as any} size={16} color={colors.brandSecondary} />
              <Text style={[styles.featureText, { color: colors.onSurfaceSecondary }]}>{f.label}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInUp.delay(500).duration(600)}
        style={[styles.ctaWrap, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        <Pressable
          testID="google-login-button"
          onPress={login}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.brandPrimary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="logo-google" size={20} color="#fff" />
          <Text style={styles.ctaText}>Continue with Google</Text>
        </Pressable>
        <Text style={[styles.disclaimer, { color: colors.onSurfaceTertiary }]}>
          Educational assistant only — not medical advice. Always follow your
          doctor&apos;s guidance.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroWrap: { paddingHorizontal: spacing.xl },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  brand: { fontSize: 14, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: spacing.sm },
  heroTitle: { fontSize: 36, fontWeight: "800", lineHeight: 42, letterSpacing: -0.5 },
  heroSub: { fontSize: 16, lineHeight: 24, marginTop: spacing.lg },
  statsRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, marginTop: spacing.xxl },
  statCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: "flex-start",
  },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  featuresWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  featureChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 36,
  },
  featureText: { fontSize: 13, fontWeight: "600" },
  ctaWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 54,
    borderRadius: radius.lg,
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disclaimer: { fontSize: 11, textAlign: "center", marginTop: spacing.md, lineHeight: 16 },
});
