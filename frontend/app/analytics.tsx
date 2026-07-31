import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { useI18n } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";

type VitalTab = "bp" | "sugar" | "weight";

export default function Analytics() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width, 500) - spacing.lg * 2 - spacing.lg * 2 - 30;

  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<VitalTab>("bp");
  const [form, setForm] = useState({ systolic: "", diastolic: "", value: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const d = await api("/analytics");
      setData(d);
    } catch (e) {
      console.warn("analytics load failed", e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveVital = async () => {
    setSaving(true);
    try {
      const body =
        tab === "bp"
          ? { vital_type: "bp", systolic: parseFloat(form.systolic), diastolic: parseFloat(form.diastolic) }
          : { vital_type: tab, value: parseFloat(form.value) };
      if (
        (tab === "bp" && (isNaN(body.systolic as number) || isNaN(body.diastolic as number))) ||
        (tab !== "bp" && isNaN(body.value as number))
      ) {
        setToast("Enter valid numbers");
        setTimeout(() => setToast(""), 2000);
        setSaving(false);
        return;
      }
      await api("/vitals", { method: "POST", body: JSON.stringify(body) });
      setForm({ systolic: "", diastolic: "", value: "" });
      setToast(t("readingSaved"));
      setTimeout(() => setToast(""), 2000);
      await load();
    } catch (e: any) {
      setToast(e?.message || "Save failed");
      setTimeout(() => setToast(""), 2500);
    } finally {
      setSaving(false);
    }
  };

  const lineData = (items: any[], key: string) =>
    (items || []).map((v: any) => ({
      value: v[key] ?? 0,
      label: new Date(v.recorded_at).getDate().toString(),
    }));

  const vitalSeries = data ? { bp: data.bp, sugar: data.sugar, weight: data.weight }[tab] : [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="analytics-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          testID="analytics-back-button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"))}
          style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>{t("healthAnalytics")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {!data ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          bottomOffset={24}
        >
          {/* Adherence */}
          <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="adherence-chart-card">
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>{t("adherence7d")}</Text>
              <Text style={{ color: colors.success, fontWeight: "800", fontSize: 15 }}>
                {data.adherence_overall}%
              </Text>
            </View>
            <BarChart
              data={data.adherence_7d.map((d: any) => ({ value: d.pct, label: d.label }))}
              width={chartWidth}
              height={140}
              maxValue={100}
              barWidth={20}
              spacing={16}
              barBorderRadius={5}
              frontColor={colors.brandSecondary}
              yAxisTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
              yAxisThickness={0}
              xAxisThickness={0}
              noOfSections={4}
              rulesColor={colors.divider}
              disableScroll
            />
          </View>

          {/* Vitals */}
          <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="vitals-chart-card">
            <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
              {(["bp", "sugar", "weight"] as VitalTab[]).map((k) => {
                const selected = tab === k;
                const label = k === "bp" ? t("bloodPressure") : k === "sugar" ? t("sugar") : t("weight");
                return (
                  <Pressable
                    key={k}
                    testID={`vital-tab-${k}`}
                    onPress={() => setTab(k)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.brandPrimary : colors.surfaceTertiary,
                        borderColor: selected ? colors.brandPrimary : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? "#fff" : colors.onSurfaceSecondary, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {vitalSeries && vitalSeries.length > 0 ? (
              tab === "bp" ? (
                <LineChart
                  data={lineData(vitalSeries, "systolic")}
                  data2={lineData(vitalSeries, "diastolic")}
                  width={chartWidth}
                  height={150}
                  color1={colors.error}
                  color2={colors.brandPrimary}
                  dataPointsColor1={colors.error}
                  dataPointsColor2={colors.brandPrimary}
                  thickness={2}
                  curved
                  yAxisTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
                  yAxisThickness={0}
                  xAxisThickness={0}
                  noOfSections={4}
                  rulesColor={colors.divider}
                  disableScroll
                />
              ) : (
                <LineChart
                  data={lineData(vitalSeries, "value")}
                  width={chartWidth}
                  height={150}
                  color1={tab === "sugar" ? colors.warning : colors.info}
                  dataPointsColor1={tab === "sugar" ? colors.warning : colors.info}
                  thickness={2}
                  curved
                  areaChart
                  startFillColor={tab === "sugar" ? colors.warning : colors.info}
                  startOpacity={0.25}
                  endOpacity={0}
                  yAxisTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
                  yAxisThickness={0}
                  xAxisThickness={0}
                  noOfSections={4}
                  rulesColor={colors.divider}
                  disableScroll
                />
              )
            ) : (
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, paddingVertical: spacing.lg }} testID="vitals-empty">
                {t("noVitals")}
              </Text>
            )}

            {/* Add reading */}
            <View style={{ marginTop: spacing.lg }}>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700", marginBottom: spacing.sm }}>
                {t("addReading")}
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {tab === "bp" ? (
                  <>
                    <TextInput
                      testID="input-systolic"
                      value={form.systolic}
                      onChangeText={(v) => setForm({ ...form, systolic: v })}
                      placeholder={t("systolic")}
                      placeholderTextColor={colors.onSurfaceTertiary}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: colors.surfaceTertiary, color: colors.onSurface }]}
                    />
                    <TextInput
                      testID="input-diastolic"
                      value={form.diastolic}
                      onChangeText={(v) => setForm({ ...form, diastolic: v })}
                      placeholder={t("diastolic")}
                      placeholderTextColor={colors.onSurfaceTertiary}
                      keyboardType="numeric"
                      style={[styles.input, { backgroundColor: colors.surfaceTertiary, color: colors.onSurface }]}
                    />
                  </>
                ) : (
                  <TextInput
                    testID="input-vital-value"
                    value={form.value}
                    onChangeText={(v) => setForm({ ...form, value: v })}
                    placeholder={tab === "sugar" ? t("sugarValue") : t("weightValue")}
                    placeholderTextColor={colors.onSurfaceTertiary}
                    keyboardType="numeric"
                    style={[styles.input, { backgroundColor: colors.surfaceTertiary, color: colors.onSurface }]}
                  />
                )}
                <Pressable
                  testID="save-vital-button"
                  onPress={saveVital}
                  disabled={saving}
                  style={[styles.saveBtn, { backgroundColor: colors.brandPrimary, opacity: saving ? 0.7 : 1 }]}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{t("save")}</Text>}
                </Pressable>
              </View>
            </View>
          </View>

          {/* Monthly uploads */}
          <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} testID="uploads-chart-card">
            <Text style={[styles.cardTitle, { color: colors.onSurface, marginBottom: spacing.md }]}>{t("monthlyUploads")}</Text>
            <BarChart
              data={data.monthly_uploads.map((m: any) => ({ value: m.count, label: m.label }))}
              width={chartWidth}
              height={130}
              barWidth={22}
              spacing={18}
              barBorderRadius={5}
              frontColor={colors.info}
              yAxisTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
              yAxisThickness={0}
              xAxisThickness={0}
              noOfSections={3}
              rulesColor={colors.divider}
              disableScroll
            />
          </View>
        </KeyboardAwareScrollView>
      )}

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, bottom: insets.bottom + 24 }]} testID="analytics-toast">
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "600" }}>{toast}</Text>
        </View>
      )}
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
  card: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.lg, overflow: "hidden" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  chip: {
    flex: 1,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 13,
  },
  saveBtn: {
    height: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    height: 44,
  },
});
