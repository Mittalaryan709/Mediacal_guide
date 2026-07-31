import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform, View } from "react-native";

import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { colors, mode } = useTheme();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (!user) return null;

  const tabBarBackground =
    Platform.OS === "ios"
      ? () => (
          <BlurView
            tint={mode === "dark" ? "dark" : "light"}
            intensity={80}
            style={{ flex: 1, backgroundColor: mode === "dark" ? "rgba(8,10,10,0.75)" : "rgba(255,255,255,0.75)" }}
          />
        )
      : () => <View style={{ flex: 1, backgroundColor: colors.surfaceSecondary }} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarBackground,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: "Medicines",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "alarm" : "alarm-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "AI Chat",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "folder" : "folder-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
