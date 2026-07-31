import { storage } from "@/src/utils/storage";

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_URL = `${BACKEND_URL}/api`;
export const TOKEN_KEY = "mediguide_session_token";

export async function getToken(): Promise<string | null> {
  const t = await storage.secureGet(TOKEN_KEY, null);
  return typeof t === "string" && t.length > 0 ? t : null;
}

export async function api(path: string, options: RequestInit = {}): Promise<any> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    await storage.secureRemove(TOKEN_KEY);
    throw new ApiError(401, "Session expired");
  }
  if (!res.ok) {
    let detail = "Request failed";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
