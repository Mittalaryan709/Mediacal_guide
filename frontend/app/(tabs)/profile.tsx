import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { LANGS, useI18n } from "@/src/i18n";
import { radius, spacing, useTheme } from "@/src/theme";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors, mode, toggle } = useTheme();
  const { t, lang, setLang } = useI18n();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="profile-screen">
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingHorizontal: spacing.lg,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.onSurface }]}>{t("profile")}</Text>

        <View style={[styles.userCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="person" size={26} color={colors.brandPrimary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{user?.name}</Text>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>{t("preferences")}</Text>
        <View style={[styles.group, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <View style={styles.rowItem}>
            <View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name={mode === "dark" ? "moon" : "sunny"} size={18} color={colors.brandPrimary} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.onSurface }]}>{t("darkMode")}</Text>
            <Switch
              testID="theme-toggle"
              value={mode === "dark"}
              onValueChange={toggle}
              trackColor={{ true: colors.brandPrimary, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <View style={[styles.rowItem, { alignItems: "flex-start" }]}>
            <View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="language" size={18} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.onSurface, marginBottom: spacing.sm }]}>{t("language")}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                {LANGS.map((l) => {
                  const selected = lang === l.code;
                  return (
                    <Pressable
                      key={l.code}
                      testID={`language-option-${l.code}`}
                      onPress={() => setLang(l.code)}
                      style={{
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderColor: selected ? colors.brandPrimary : colors.border,
                        backgroundColor: selected ? colors.brandPrimary : colors.surfaceTertiary,
                        paddingHorizontal: spacing.md,
                        height: 34,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: selected ? "#fff" : colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" }}>
                        {l.native}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>{t("health")}</Text>
        <View style={[styles.group, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Row
            testID="profile-analytics-link"
            icon="stats-chart-outline"
            iconColor={colors.info}
            iconBg={mode === "dark" ? "#241A3A" : "#EDE9FE"}
            label={t("healthAnalytics")}
            colors={colors}
            onPress={() => router.push("/analytics")}
          />
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <Row
            testID="profile-emergency-link"
            icon="medkit-outline"
            iconColor={colors.error}
            iconBg={mode === "dark" ? "#3A1518" : "#FEE2E2"}
            label={t("emergencyCard")}
            colors={colors}
            onPress={() => router.push("/emergency")}
          />
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <Row
            testID="profile-upload-link"
            icon="scan-outline"
            iconColor={colors.brandPrimary}
            iconBg={colors.brandTertiary}
            label={t("uploadNew")}
            colors={colors}
            onPress={() => router.push("/upload")}
          />
        </View>

        <Text style={[styles.section, { color: colors.onSurfaceTertiary }]}>{t("about")}</Text>
        <View style={[styles.group, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, padding: spacing.lg }]}>
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, lineHeight: 18 }}>
            {t("aboutText")}
          </Text>
        </View>

        <Pressable
          testID="logout-button"
          onPress={logout}
          style={({ pressed }) => [
            styles.logout,
            { borderColor: colors.error, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={{ color: colors.error, fontWeight: "700", fontSize: 15 }}>{t("signOut")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({ icon, iconColor, iconBg, label, onPress, colors, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.rowItem}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.onSurface }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800", marginBottom: spacing.lg },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  name: { fontSize: 17, fontWeight: "700" },
  section: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.sm },
  group: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  rowItem: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600" },
  divider: { height: 1, marginLeft: 62 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    height: 50,
    marginTop: spacing.xl,
  },
});
