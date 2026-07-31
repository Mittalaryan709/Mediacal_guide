import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { radius, spacing, useTheme } from "@/src/theme";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "prescription", label: "Prescriptions" },
  { key: "lab_report", label: "Lab Reports" },
  { key: "discharge_summary", label: "Discharge" },
  { key: "other", label: "Other" },
];

const TYPE_ICONS: Record<string, string> = {
  prescription: "document-text-outline",
  lab_report: "flask-outline",
  discharge_summary: "clipboard-outline",
  other: "document-outline",
};

export default function History() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const [reports, setReports] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (q?: string, f?: string) => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("search", q);
      if (f && f !== "all") params.set("report_type", f);
      const r = await api(`/reports?${params.toString()}`);
      setReports(r);
    } catch (e) {
      console.warn("history load failed", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search, filter);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  const onSearch = (text: string) => {
    setSearch(text);
    load(text, filter);
  };

  const onFilter = (key: string) => {
    setFilter(key);
    load(search, key);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="history-screen">
      <View style={{ paddingTop: insets.top + spacing.md, backgroundColor: colors.surface }}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Medical History</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="history-search-input"
            value={search}
            onChangeText={onSearch}
            placeholder="Search reports, medicines, symptoms…"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={[styles.searchInput, { color: colors.onSurface }]}
          />
        </View>
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
                testID={`history-filter-${f.key}`}
                onPress={() => onFilter(f.key)}
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

      {!reports ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load(search, filter);
                setRefreshing(false);
              }}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty} testID="history-empty">
              <Ionicons name="folder-open-outline" size={44} color={colors.brandSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No reports found</Text>
              <Pressable
                testID="history-upload-button"
                onPress={() => router.push("/upload")}
                style={[styles.uploadBtn, { backgroundColor: colors.brandPrimary }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Upload a report</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              testID={`history-report-${item.id}`}
              onPress={() => router.push(`/report/${item.id}`)}
              style={[styles.row, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name={(TYPE_ICONS[item.report_type] || "document-outline") as any} size={20} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.onSurface }]} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12 }} numberOfLines={2}>{item.summary}</Text>
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 }}>
                  {new Date(item.created_at).toLocaleDateString()} · Confidence {item.confidence}%
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", paddingHorizontal: spacing.lg },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 14 },
  chip: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  uploadBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  rowIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "700" },
});
