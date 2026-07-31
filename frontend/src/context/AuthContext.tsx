import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { API_URL, TOKEN_KEY, api } from "@/src/api/client";
import { storage } from "@/src/utils/storage";

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

function extractSessionId(url: string): string | null {
  const hashMatch = url.match(/#session_id=([^&]+)/);
  if (hashMatch) return hashMatch[1];
  const queryMatch = url.match(/[?&]session_id=([^&#]+)/);
  if (queryMatch) return queryMatch[1];
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const processSessionId = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) throw new Error("Session exchange failed");
      const data = await res.json();
      await storage.secureSet(TOKEN_KEY, data.session_token);
      setUser(data.user);
      router.replace("/(tabs)/home");
    } catch (e) {
      console.warn("Auth session error", e);
    }
  }, [router]);

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Web: session_id in URL after redirect
        if (Platform.OS === "web" && typeof window !== "undefined") {
          const sid = extractSessionId(window.location.hash || "") || extractSessionId(window.location.search || "");
          if (sid) {
            window.history.replaceState(null, "", window.location.pathname);
            await processSessionId(sid);
            setLoading(false);
            return;
          }
        }
        // 2. Mobile cold start deep link
        if (Platform.OS !== "web") {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl) {
            const sid = extractSessionId(initialUrl);
            if (sid) {
              await processSessionId(sid);
              setLoading(false);
              return;
            }
          }
        }
        // 3. Existing token
        const token = await storage.secureGet(TOKEN_KEY, null);
        if (token) {
          try {
            const me = await api("/auth/me");
            setUser(me);
          } catch {
            setUser(null);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    init();

    if (Platform.OS !== "web") {
      const sub = Linking.addEventListener("url", ({ url }) => {
        const sid = extractSessionId(url);
        if (sid) processSessionId(sid);
      });
      return () => sub.remove();
    }
  }, [processSessionId]);

  const login = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const sid = extractSessionId(result.url);
      if (sid) await processSessionId(sid);
    }
  }, [processSessionId]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
    router.replace("/");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
