export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: "admin" | "teacher" | "student";
}

const getBasePath = () => {
  if (typeof window !== "undefined" && window.location.pathname.startsWith('/UniversityTeachingAssistent')) {
    return '/UniversityTeachingAssistent';
  }
  return '';
};

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
    if (typeof window !== "undefined") {
      window.location.href = `${getBasePath()}/login`;
    } else {
      return { id: 0, name: "SSR", username: "ssr", role: allowedRoles?.[0] || "student" } as AuthUser;
    }
    throw new Error("Not authenticated");
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (typeof window !== "undefined") {
      window.location.href = `${getBasePath()}/login`;
    } else {
      return user; // Just pass through on SSR
    }
    throw new Error("Forbidden");
  }
  return user;
}