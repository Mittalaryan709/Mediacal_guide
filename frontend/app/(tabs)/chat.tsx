import { Ionicons } from "@expo/vector-icons";
import { fetch as expoFetch } from "expo/fetch";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_URL, api, getToken } from "@/src/api/client";
import { radius, spacing, useTheme } from "@/src/theme";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What is this medicine for?",
  "Explain my last report simply",
  "What food should I avoid?",
  "What do my lab values mean?",
];

export default function Chat() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    api("/chat/history")
      .then((h) => setMessages(h.map((m: any) => ({ id: m.id, role: m.role, content: m.content }))))
      .catch(() => {});
  }, []);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    setInput("");
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: message };
    const aiId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: aiId, role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const token = await getToken();
      const res = await expoFetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) throw new Error("Chat failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const obj = JSON.parse(payload);
            if (obj.content) {
              full += obj.content;
            } else if (obj.error) {
              full = obj.error;
            }
            setMessages((prev) =>
              prev.map((m) => (m.id === aiId ? { ...m, content: full } : m))
            );
          } catch {}
        }
      }
      if (!full) {
        setMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, content: "Sorry, I couldn't respond. Please try again." } : m))
        );
      }
    } catch (e) {
      console.warn("chat error", e);
      setMessages((prev) =>
        prev.map((m) => (m.id === aiId ? { ...m, content: "Message failed to send. Please try again." } : m))
      );
    } finally {
      setStreaming(false);
    }
  };

  const renderItem = ({ item }: { item: Msg }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.brandPrimary, alignSelf: "flex-end", borderBottomRightRadius: 4 }
            : { backgroundColor: colors.surfaceSecondary, alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
        ]}
      >
        <Text style={{ color: isUser ? "#fff" : colors.onSurface, fontSize: 14, lineHeight: 21 }}>
          {item.content || "…"}
        </Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }} testID="chat-screen">
      <View style={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface }}>
        <Text style={[styles.title, { color: colors.onSurface }]}>AI Assistant</Text>
        <View style={[styles.banner, { backgroundColor: colors.brandTertiary }]} testID="chat-disclaimer-banner">
          <Ionicons name="information-circle-outline" size={14} color={colors.onBrandTertiary} />
          <Text style={{ color: colors.onBrandTertiary, fontSize: 11, flex: 1 }}>
            Educational info only — not medical advice. Consult your doctor.
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "translate-with-padding" : "translate-with-padding"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.lg }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={styles.emptyWrap} testID="chat-empty">
              <Ionicons name="sparkles-outline" size={40} color={colors.info} />
              <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>Ask me about your reports</Text>
              <View style={{ gap: spacing.sm, width: "100%", marginTop: spacing.md }}>
                {SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    testID={`suggestion-${s.slice(0, 10)}`}
                    onPress={() => send(s)}
                    style={[styles.suggestion, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.brandPrimary, fontSize: 13, fontWeight: "600" }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
        />
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
              marginBottom: insets.bottom + 60,
            },
          ]}
        >
          <TextInput
            testID="chat-input"
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your medicines or reports…"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={[styles.input, { color: colors.onSurface }]}
            multiline
            onSubmitEditing={() => send()}
          />
          <Pressable
            testID="chat-send-button"
            onPress={() => send()}
            disabled={streaming || !input.trim()}
            style={[
              styles.sendBtn,
              { backgroundColor: streaming || !input.trim() ? colors.surfaceTertiary : colors.brandPrimary },
            ]}
          >
            <Ionicons name="arrow-up" size={18} color={streaming || !input.trim() ? colors.onSurfaceTertiary : "#fff"} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "800" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  bubble: { maxWidth: "85%", borderRadius: radius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  emptyWrap: { alignItems: "center", paddingTop: 40, paddingHorizontal: spacing.md },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: spacing.sm },
  suggestion: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: "center",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
  },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
