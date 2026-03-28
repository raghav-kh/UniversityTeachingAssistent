export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: "admin" | "teacher" | "student";
}

const KEY = "eduai_user";

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem(KEY);
}

export function requireAuth(
  allowedRoles?: Array<"admin" | "teacher" | "student">
): AuthUser {
  const user = getUser();
  if (!user) {
    window.location.href = "/login";
    throw new Error("Not authenticated");
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    window.location.href = "/login";
    throw new Error("Forbidden");
  }
  return user;
}