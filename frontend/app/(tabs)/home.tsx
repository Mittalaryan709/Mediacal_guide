import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { useI18n } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";

const TYPE_ICONS: Record<string, string> = {
  prescription: "document-text-outline",
  lab_report: "flask-outline",
  discharge_summary: "clipboard-outline",
  other: "document-outline",
};

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api("/dashboard");
      setData(d);
    } catch (e) {
      console.warn("dashboard load failed", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("goodMorning");
    if (h < 17) return t("goodAfternoon");
    return t("goodEvening");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="home-screen">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: 120,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.onSurfaceTertiary }]}>{greeting()},</Text>
            <Text style={[styles.userName, { color: colors.onSurface }]} numberOfLines={1}>
              {user?.name?.split(" ")[0] || "there"} 👋
            </Text>
          </View>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} testID="home-avatar" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="person" size={20} color={colors.brandPrimary} />
            </View>
          )}
        </View>

        {!data ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.brandPrimary} size="large" />
          </View>
        ) : (
          <>
            {/* Health Score Card */}
            <Animated.View entering={FadeInDown.duration(500)}>
              <LinearGradient
                colors={["#2563EB", "#14B8A6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.scoreCard}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.scoreLabel}>{t("healthScore")}</Text>
                  <Text style={styles.scoreValue} testID="health-score-value">{data.health_score}</Text>
                  <Text style={styles.scoreSub}>
                    {data.adherence}% {t("adherenceWeek")}
                  </Text>
                </View>
                <View style={styles.scoreRing}>
                  <Ionicons name="heart" size={30} color="#fff" />
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Today's progress */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(500)}
              style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{t("todaysMedicines")}</Text>
                <Pressable testID="see-timeline-button" onPress={() => router.push("/(tabs)/timeline")}>
                  <Text style={{ color: colors.brandPrimary, fontWeight: "600", fontSize: 13 }}>{t("viewAll")}</Text>
                </Pressable>
              </View>
              {data.today_total_doses === 0 ? (
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>
                  {t("noMedsScheduled")}
                </Text>
              ) : (
                <View style={styles.doseRow}>
                  <DoseStat label={t("done")} value={data.today_completed} color={colors.success} colors={colors} />
                  <DoseStat label={t("pending")} value={data.today_pending} color={colors.warning} colors={colors} />
                  <DoseStat label={t("skipped")} value={data.today_skipped} color={colors.error} colors={colors} />
                </View>
              )}
            </Animated.View>

            {/* Quick actions */}
            <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.actionsRow}>
              <QuickAction
                testID="quick-upload-button"
                icon="scan-outline"
                label={t("scanReport")}
                bg={colors.brandPrimary}
                onPress={() => router.push("/upload")}
              />
              <QuickAction
                testID="quick-chat-button"
                icon="chatbubbles-outline"
                label={t("askAI")}
                bg={colors.info}
                onPress={() => router.push("/(tabs)/chat")}
              />
              <QuickAction
                testID="quick-analytics-button"
                icon="stats-chart-outline"
                label={t("analytics")}
                bg={colors.brandSecondary}
                onPress={() => router.push("/analytics")}
              />
              <QuickAction
                testID="quick-emergency-button"
                icon="medkit-outline"
                label={t("emergency")}
                bg={colors.error}
                onPress={() => router.push("/emergency")}
              />
            </Animated.View>

            {/* Recent reports */}
            <Animated.View entering={FadeInDown.delay(300).duration(500)}>
              <View style={[styles.cardHeader, { marginTop: spacing.xl, marginBottom: spacing.md }]}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{t("recentReports")}</Text>
                <Pressable testID="see-history-button" onPress={() => router.push("/(tabs)/history")}>
                  <Text style={{ color: colors.brandPrimary, fontWeight: "600", fontSize: 13 }}>{t("seeAll")}</Text>
                </Pressable>
              </View>
              {data.recent_reports.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Ionicons name="cloud-upload-outline" size={36} color={colors.brandPrimary} />
                  <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>{t("uploadFirst")}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, textAlign: "center" }}>
                    {t("uploadFirstSub")}
                  </Text>
                  <Pressable
                    testID="empty-upload-button"
                    onPress={() => router.push("/upload")}
                    style={[styles.emptyCta, { backgroundColor: colors.brandPrimary }]}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{t("uploadReport")}</Text>
                  </Pressable>
                </View>
              ) : (
                data.recent_reports.map((r: any) => (
                  <Pressable
                    key={r.id}
                    testID={`report-card-${r.id}`}
                    onPress={() => router.push(`/report/${r.id}`)}
                    style={[styles.reportRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  >
                    <View style={[styles.reportIcon, { backgroundColor: colors.brandTertiary }]}>
                      <Ionicons name={(TYPE_ICONS[r.report_type] || "document-outline") as any} size={20} color={colors.brandPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reportTitle, { color: colors.onSurface }]} numberOfLines={1}>{r.title}</Text>
                      <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12 }} numberOfLines={1}>
                        {r.summary}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
                  </Pressable>
                ))
              )}
            </Animated.View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DoseStat({ label, value, color, colors }: any) {
  return (
    <View style={[styles.doseStat, { backgroundColor: colors.surfaceTertiary }]}>
      <Text style={{ fontSize: 22, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.onSurfaceTertiary }}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, bg, onPress, testID }: any) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name={icon} size={22} color="#fff" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xl },
  greeting: { fontSize: 14 },
  userName: { fontSize: 24, fontWeight: "800" },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  scoreCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  scoreLabel: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  scoreValue: { color: "#fff", fontSize: 44, fontWeight: "800", lineHeight: 50 },
  scoreSub: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
  scoreRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.lg },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  doseRow: { flexDirection: "row", gap: spacing.md },
  doseStat: { flex: 1, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  action: {
    flexBasis: "47%",
    flexGrow: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: "center",
    gap: 6,
  },
  actionLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
  emptyCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyCta: {
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  reportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  reportIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  reportTitle: { fontSize: 14, fontWeight: "600" },
});
