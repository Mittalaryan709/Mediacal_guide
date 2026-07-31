import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { radius, spacing, useTheme } from "@/src/theme";

export default function ReportDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, mode } = useTheme();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [expandedMed, setExpandedMed] = useState<string | null>(null);

  useEffect(() => {
    api(`/reports/${id}`)
      .then(setData)
      .catch((e) => setError(e.message || "Could not load report"));
  }, [id]);

  const confidenceColor = (c: number) =>
    c >= 70 ? colors.success : c >= 40 ? colors.warning : colors.error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="report-detail-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="report-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"))} style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>AI Analysis</Text>
        <Pressable
          testID="report-chat-button"
          onPress={() => router.push("/(tabs)/chat")}
          style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.error }}>{error}</Text>
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }} showsVerticalScrollIndicator={false}>
          {/* Title + confidence */}
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text style={[styles.reportTitle, { color: colors.onSurface }]}>{data.report.title}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.badge, { backgroundColor: colors.brandTertiary }]}>
                <Text style={{ color: colors.onBrandTertiary, fontSize: 11, fontWeight: "700", textTransform: "capitalize" }}>
                  {String(data.report.report_type).replace("_", " ")}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: mode === "dark" ? "#132A1A" : "#F0FDF4" }]} testID="confidence-badge">
                <Ionicons name="shield-checkmark-outline" size={12} color={confidenceColor(data.report.confidence)} />
                <Text style={{ color: confidenceColor(data.report.confidence), fontSize: 11, fontWeight: "700" }}>
                  {data.report.confidence}% confidence
                </Text>
              </View>
            </View>
          </Animated.View>

          <Section delay={100} icon="sparkles-outline" iconColor={colors.info} title="Simple Explanation" colors={colors} testID="section-explanation">
            <Text style={[styles.body, { color: colors.onSurfaceSecondary }]}>
              {data.report.simple_explanation || data.report.summary}
            </Text>
          </Section>

          {!!data.report.condition_explanation && (
            <Section delay={150} icon="book-outline" iconColor={colors.brandSecondary} title="About the Condition" colors={colors} testID="section-condition">
              <Text style={[styles.body, { color: colors.onSurfaceSecondary }]}>{data.report.condition_explanation}</Text>
            </Section>
          )}

          {data.medicines.length > 0 && (
            <Section delay={200} icon="medical-outline" iconColor={colors.brandPrimary} title={`Medicines (${data.medicines.length})`} colors={colors} testID="section-medicines">
              <View style={{ gap: spacing.sm }}>
                {data.medicines.map((m: any) => {
                  const open = expandedMed === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      testID={`medicine-item-${m.id}`}
                      onPress={() => setExpandedMed(open ? null : m.id)}
                      style={[styles.medItem, { backgroundColor: colors.surfaceTertiary }]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 14 }}>{m.name}</Text>
                          <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12 }} numberOfLines={open ? undefined : 1}>
                            {m.purpose}
                          </Text>
                        </View>
                        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.onSurfaceTertiary} />
                      </View>
                      {open && (
                        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                          <MedDetail label="Dosage" value={m.dosage} colors={colors} />
                          <MedDetail label="How to take" value={m.how_to_take} colors={colors} />
                          <MedDetail label="Timing" value={(m.timing || []).join(", ")} colors={colors} />
                          {m.side_effects?.length > 0 && (
                            <MedDetail label="Common side effects" value={m.side_effects.join("; ")} colors={colors} warn />
                          )}
                          {m.precautions?.length > 0 && (
                            <MedDetail label="Precautions" value={m.precautions.join("; ")} colors={colors} warn />
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </Section>
          )}

          {data.report.doctor_instructions?.length > 0 && (
            <Section delay={250} icon="clipboard-outline" iconColor={colors.brandSecondary} title="Doctor Instructions" colors={colors} testID="section-instructions">
              {data.report.doctor_instructions.map((ins: string, i: number) => (
                <BulletRow key={i} text={ins} color={colors.brandSecondary} colors={colors} />
              ))}
            </Section>
          )}

          {data.report.precautions?.length > 0 && (
            <Section delay={300} icon="warning-outline" iconColor={colors.warning} title="Precautions" colors={colors} testID="section-precautions">
              {data.report.precautions.map((p: string, i: number) => (
                <BulletRow key={i} text={p} color={colors.warning} colors={colors} />
              ))}
            </Section>
          )}

          <Pressable
            testID="view-timeline-cta"
            onPress={() => router.push("/(tabs)/timeline")}
            style={[styles.cta, { backgroundColor: colors.brandPrimary }]}
          >
            <Ionicons name="alarm-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>View Medicine Timeline</Text>
          </Pressable>

          <View style={[styles.disclaimer, { backgroundColor: colors.surfaceTertiary }]} testID="report-disclaimer">
            <Ionicons name="information-circle-outline" size={16} color={colors.onSurfaceTertiary} />
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, flex: 1, lineHeight: 16 }}>
              {data.report.disclaimer}
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function Section({ icon, iconColor, title, children, colors, delay, testID }: any) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      testID={testID}
      style={[styles.section, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
    >
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.brandTertiary }]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

function MedDetail({ label, value, colors, warn }: any) {
  if (!value) return null;
  return (
    <View>
      <Text style={{ color: warn ? colors.warning : colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 19 }}>{value}</Text>
    </View>
  );
}

function BulletRow({ text, color, colors }: any) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 7 }} />
      <Text style={{ color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 20, flex: 1 }}>{text}</Text>
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
  headerTitle: { fontSize: 18, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  reportTitle: { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  metaRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 26,
  },
  section: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  sectionIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 22 },
  medItem: { borderRadius: radius.md, padding: spacing.md },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  disclaimer: {
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
});
