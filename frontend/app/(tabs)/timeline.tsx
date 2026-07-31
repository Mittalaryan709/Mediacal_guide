import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { radius, spacing, useTheme } from "@/src/theme";

const PERIODS = [
  { key: "morning", label: "Morning", icon: "sunny-outline", time: "6 AM – 12 PM" },
  { key: "afternoon", label: "Afternoon", icon: "partly-sunny-outline", time: "12 – 5 PM" },
  { key: "evening", label: "Evening", icon: "cloudy-night-outline", time: "5 – 9 PM" },
  { key: "night", label: "Night", icon: "moon-outline", time: "9 PM – 12 AM" },
] as const;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "night", label: "Night" },
];

export default function Timeline() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api("/medicines/today");
      setData(d);
    } catch (e) {
      console.warn("timeline load failed", e);
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

  const setStatus = async (med: any, status: string) => {
    Haptics.notificationAsync(
      status === "completed" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
    );
    // optimistic update
    setData((prev: any) => {
      const next = { ...prev };
      next[med.period] = prev[med.period].map((m: any) =>
        m.id === med.id ? { ...m, status } : m
      );
      return next;
    });
    try {
      await api(`/medicines/${med.id}/log`, {
        method: "POST",
        body: JSON.stringify({ status, period: med.period }),
      });
    } catch (e) {
      console.warn("log failed", e);
      load();
    }
  };

  const visiblePeriods = PERIODS.filter((p) => filter === "all" || filter === p.key);
  const isEmpty = data && PERIODS.every((p) => (data[p.key] || []).length === 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="timeline-screen">
      {/* Sticky header */}
      <View style={{ paddingTop: insets.top + spacing.md, backgroundColor: colors.surface }}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Medicine Timeline</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }]}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ height: 56, flexGrow: 0 }}
          contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}
        >
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <Pressable
                key={f.key}
                testID={`filter-chip-${f.key}`}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.brandPrimary : colors.surfaceSecondary,
                    borderColor: selected ? colors.brandPrimary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: selected ? "#fff" : colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        {!data ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.brandPrimary} size="large" />
          </View>
        ) : isEmpty ? (
          <View style={styles.empty} testID="timeline-empty">
            <Ionicons name="medkit-outline" size={48} color={colors.brandSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No medicines scheduled</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, textAlign: "center" }}>
              Upload a prescription and your schedule will appear here automatically.
            </Text>
          </View>
        ) : (
          visiblePeriods.map((period) => {
            const meds = data[period.key] || [];
            if (meds.length === 0 && filter === "all") return null;
            return (
              <View key={period.key} style={{ marginBottom: spacing.lg }}>
                <View style={styles.periodHeader}>
                  <View style={[styles.periodIcon, { backgroundColor: colors.brandTertiary }]}>
                    <Ionicons name={period.icon as any} size={16} color={colors.brandPrimary} />
                  </View>
                  <Text style={[styles.periodLabel, { color: colors.onSurface }]}>{period.label}</Text>
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>{period.time}</Text>
                </View>
                <View style={[styles.timelineLine, { borderLeftColor: colors.border }]}>
                  {meds.length === 0 ? (
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, paddingVertical: spacing.sm }}>
                      Nothing scheduled
                    </Text>
                  ) : (
                    meds.map((med: any) => (
                      <MedCard key={`${med.id}-${med.period}`} med={med} colors={colors} onStatus={setStatus} />
                    ))
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function MedCard({ med, colors, onStatus }: any) {
  const done = med.status === "completed";
  const skipped = med.status === "skipped";
  return (
    <View
      testID={`medicine-card-${med.id}-${med.period}`}
      style={[
        styles.medCard,
        {
          backgroundColor: done || skipped ? colors.surfaceTertiary : colors.surfaceSecondary,
          borderColor: colors.border,
          opacity: done || skipped ? 0.75 : 1,
        },
      ]}
    >
      <Pressable
        testID={`medicine-check-${med.id}-${med.period}`}
        onPress={() => onStatus(med, done ? "pending" : "completed")}
        style={[
          styles.checkbox,
          {
            backgroundColor: done ? colors.success : "transparent",
            borderColor: done ? colors.success : skipped ? colors.error : colors.brandPrimary,
          },
        ]}
      >
        {done && <Ionicons name="checkmark" size={16} color="#fff" />}
        {skipped && <Ionicons name="close" size={16} color={colors.error} />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          style={[styles.medName, { color: colors.onSurface, textDecorationLine: done ? "line-through" : "none" }]}
          numberOfLines={1}
        >
          {med.name}
        </Text>
        <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12 }} numberOfLines={1}>
          {[med.dosage, med.how_to_take].filter(Boolean).join(" · ") || med.purpose}
        </Text>
      </View>
      {!done && !skipped && (
        <Pressable
          testID={`medicine-skip-${med.id}-${med.period}`}
          onPress={() => onStatus(med, "skipped")}
          style={[styles.skipBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "600" }}>Skip</Text>
        </Pressable>
      )}
      {(done || skipped) && (
        <Text style={{ color: done ? colors.success : colors.error, fontSize: 11, fontWeight: "700" }}>
          {done ? "Taken" : "Skipped"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", paddingHorizontal: spacing.lg },
  subtitle: { fontSize: 13, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: 60, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  periodHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  periodIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  periodLabel: { fontSize: 15, fontWeight: "700", flex: 1 },
  timelineLine: { borderLeftWidth: 2, marginLeft: 13, paddingLeft: spacing.lg, gap: spacing.sm },
  medCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  medName: { fontSize: 14, fontWeight: "700" },
  skipBtn: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
