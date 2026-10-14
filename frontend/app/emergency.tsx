import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api/client";
import { radius, spacing, useTheme } from "@/src/theme";

export default function Emergency() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const [card, setCard] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ blood_group: "", allergies: "", conditions: "", contact_name: "", contact_phone: "", notes: "" });
  const [toast, setToast] = useState("");

  useEffect(() => {
    api("/emergency")
      .then((c) => {
        setCard(c);
        setForm({
          blood_group: c.blood_group || "",
          allergies: (c.allergies || []).join(", "),
          conditions: (c.conditions || []).join(", "),
          contact_name: c.emergency_contacts?.[0]?.name || "",
          contact_phone: c.emergency_contacts?.[0]?.phone || "",
          notes: c.notes || "",
        });
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        blood_group: form.blood_group.trim(),
        allergies: form.allergies.split(",").map((s) => s.trim()).filter(Boolean),
        conditions: form.conditions.split(",").map((s) => s.trim()).filter(Boolean),
        emergency_contacts: form.contact_name || form.contact_phone
          ? [{ name: form.contact_name.trim(), phone: form.contact_phone.trim() }]
          : [],
        notes: form.notes.trim(),
      };
      await api("/emergency", { method: "PUT", body: JSON.stringify(payload) });
      const fresh = await api("/emergency");
      setCard(fresh);
      setEditing(false);
      setToast("Emergency card saved");
      setTimeout(() => setToast(""), 2500);
    } catch {
      setToast("Save failed, try again");
      setTimeout(() => setToast(""), 2500);
    } finally {
      setSaving(false);
    }
  };

  const qrPayload = card
    ? JSON.stringify({
        name: card.name,
        blood_group: card.blood_group,
        allergies: card.allergies,
        conditions: card.conditions,
        contacts: card.emergency_contacts,
        medicines: (card.current_medicines || []).map((m: any) => m.name),
      })
    : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="emergency-screen">
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable testID="emergency-back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"))} style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={20} color={colors.onSurface} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Emergency Card</Text>
        <Pressable
          testID="emergency-edit-button"
          onPress={() => setEditing(!editing)}
          style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
        >
          <Ionicons name={editing ? "close" : "create-outline"} size={18} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {!card ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.error} />
        </View>
      ) : (
        <KeyboardAwareScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
          showsVerticalScrollIndicator={false}
          bottomOffset={24}
        >
          {!editing ? (
            <>
              <LinearGradient colors={["#DC2626", "#991B1B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.walletCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardLabel}>MEDICAL ID</Text>
                    <Text style={styles.cardName} numberOfLines={1}>{card.name || "Your Name"}</Text>
                  </View>
                  <Ionicons name="medkit" size={26} color="rgba(255,255,255,0.9)" />
                </View>
                <View style={styles.cardRow}>
                  <View>
                    <Text style={styles.cardLabel}>BLOOD GROUP</Text>
                    <Text style={styles.bloodGroup} testID="blood-group-value">{card.blood_group || "—"}</Text>
                  </View>
                  <View style={styles.qrBox}>
                    {qrPayload ? <QRCode value={qrPayload.slice(0, 1200)} size={92} backgroundColor="#fff" /> : null}
                  </View>
                </View>
              </LinearGradient>

              <InfoBlock title="Allergies" icon="alert-circle-outline" colors={colors} testID="allergies-block">
                {card.allergies?.length ? (
                  <View style={styles.tagWrap}>
                    {card.allergies.map((a: string) => (
                      <View key={a} style={[styles.tag, { backgroundColor: colors.surfaceTertiary }]}>
                        <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>{a}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>None recorded</Text>
                )}
              </InfoBlock>

              <InfoBlock title="Medical Conditions" icon="fitness-outline" colors={colors} testID="conditions-block">
                {card.conditions?.length ? (
                  card.conditions.map((c: string) => (
                    <Text key={c} style={{ color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 20 }}>• {c}</Text>
                  ))
                ) : (
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>None recorded</Text>
                )}
              </InfoBlock>

              <InfoBlock title="Current Medicines" icon="medical-outline" colors={colors} testID="medicines-block">
                {card.current_medicines?.length ? (
                  card.current_medicines.map((m: any, i: number) => (
                    <Text key={i} style={{ color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 20 }}>
                      • {m.name}{m.dosage ? ` (${m.dosage})` : ""}
                    </Text>
                  ))
                ) : (
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>No active medicines</Text>
                )}
              </InfoBlock>

              <InfoBlock title="Emergency Contacts" icon="call-outline" colors={colors} testID="contacts-block">
                {card.emergency_contacts?.length ? (
                  card.emergency_contacts.map((c: any, i: number) => (
                    <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "600" }}>{c.name}</Text>
                      <Text style={{ color: colors.brandPrimary, fontSize: 14, fontWeight: "700" }}>{c.phone}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>No contacts added</Text>
                )}
              </InfoBlock>

              {(!card.blood_group && !card.allergies?.length) && (
                <Pressable testID="fill-details-button" onPress={() => setEditing(true)} style={[styles.cta, { backgroundColor: colors.error }]}>
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Fill out Emergency Details</Text>
                </Pressable>
              )}
            </>
          ) : (
            <View style={{ gap: spacing.md }}>
              <Field label="Blood Group (e.g. O+)" value={form.blood_group} onChange={(v: string) => setForm({ ...form, blood_group: v })} colors={colors} testID="input-blood-group" />
              <Field label="Allergies (comma separated)" value={form.allergies} onChange={(v: string) => setForm({ ...form, allergies: v })} colors={colors} testID="input-allergies" />
              <Field label="Medical conditions (comma separated)" value={form.conditions} onChange={(v: string) => setForm({ ...form, conditions: v })} colors={colors} testID="input-conditions" />
              <Field label="Emergency contact name" value={form.contact_name} onChange={(v: string) => setForm({ ...form, contact_name: v })} colors={colors} testID="input-contact-name" />
              <Field label="Emergency contact phone" value={form.contact_phone} onChange={(v: string) => setForm({ ...form, contact_phone: v })} colors={colors} keyboardType="phone-pad" testID="input-contact-phone" />
              <Field label="Notes" value={form.notes} onChange={(v: string) => setForm({ ...form, notes: v })} colors={colors} multiline testID="input-notes" />
              <Pressable testID="save-emergency-button" onPress={save} disabled={saving} style={[styles.cta, { backgroundColor: colors.brandPrimary, opacity: saving ? 0.7 : 1 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Save Emergency Card</Text>}
              </Pressable>
            </View>
          )}
        </KeyboardAwareScrollView>
      )}

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, bottom: insets.bottom + 24 }]} testID="emergency-toast">
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "600" }}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function InfoBlock({ title, icon, children, colors, testID }: any) {
  return (
    <View testID={testID} style={[styles.block, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
        <Ionicons name={icon} size={16} color={colors.error} />
        <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "700" }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, onChange, colors, multiline, keyboardType, testID }: any) {
  return (
    <View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholderTextColor={colors.onSurfaceTertiary}
        style={{
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: multiline ? spacing.md : 0,
          height: multiline ? 80 : 46,
          color: colors.onSurface,
          fontSize: 14,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
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
  walletCard: { borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
  cardLabel: { color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  cardName: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.xl },
  bloodGroup: { color: "#fff", fontSize: 40, fontWeight: "800" },
  qrBox: { backgroundColor: "#fff", padding: 6, borderRadius: radius.sm },
  block: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: { borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  cta: { height: 52, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
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

