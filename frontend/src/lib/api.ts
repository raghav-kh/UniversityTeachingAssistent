import axios from "axios";

// ── Constants ──────────────────────────────────────────────────────
export const SUPABASE_URL = "https://snldgdkhfuomjrjbpcer.supabase.co";
export const VERCEL_API_URL = "https://try4-psi.vercel.app";

/** Set in CI / Vercel / GitHub Actions when the API is hosted separately (e.g. Vercel Python backend). */
export function getApiBaseURL(): string {
  const u = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (u) {
    const cleanUrl = u.replace(/\/$/, "");
    return cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`;
  }
  // Default to the Vercel backend
  return VERCEL_API_URL;
}

function shouldUseGithubPagesDemoMock(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.location.hostname.includes("github.io")) return false;
  return true; // Enable demo mock on GitHub Pages (Vercel backend may reject demo credentials)
}

const api = axios.create({
  baseURL: getApiBaseURL(),
  headers: { "Content-Type": "application/json" },
});

// Mock interceptor for GitHub Pages portfolio showcasing without a backend
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (shouldUseGithubPagesDemoMock()) {
      const url = error.config.url || "";
      console.log("Mocking API response for:", url);

      if (url.includes("/grading/stats")) {
        return Promise.resolve({
          data: {
            total_grades: 124,
            tier1_count: 80,
            tier2_count: 44,
            tier1_pct: 65,
            tier2_pct: 35,
            flagged_count: 8,
            flagged_pct: 6,
            avg_confidence: 92,
            confidence_distribution: { high: 85, medium: 35, low: 4 },
            model_usage: [{ model_used: "gpt-4", count: 44 }],
            reviewed_by_prof: 12,
            cost_estimate: {
              tier2_spent_inr: 500,
              saved_by_tier1_inr: 1200,
              total_if_all_t2_inr: 1700,
            },
          },
        });
      }
      if (url.includes("/students/status")) {
        return Promise.resolve({
          data: [
            {
              student_id: "S101",
              student_name: "Alice Johnson",
              total_submissions: 5,
              avg_score: 85,
              high_risk_count: 0,
              reviewed_count: 2,
            },
            {
              student_id: "S102",
              student_name: "Bob Smith",
              total_submissions: 3,
              avg_score: 45,
              high_risk_count: 2,
              reviewed_count: 1,
            },
          ],
        });
      }
      if (url.includes("/grading/review-queue") || url.includes("/grading/review")) {
        return Promise.resolve({
          data: {
            queue: [
              {
                queue_id: 1,
                student_id: "S102",
                student_name: "Bob Smith",
                assignment_title: "CS101 Midterm",
                score: 45,
                max_score: 100,
                reason: "Flagged by integrity module",
              },
            ],
          },
        });
      }
      if (url.includes("/grading/student/")) {
        return Promise.resolve({
          data: {
            grades: [
              {
                submission_id: 1,
                assignment_title: "Week 1 Quiz",
                score: 90,
                max_score: 100,
                feedback: "Great work!",
                flagged: false,
                graded_at: new Date().toISOString(),
              },
            ],
          },
        });
      }
      if (url.includes("/integrity/reports")) {
        return Promise.resolve({
          data: {
            reports: [
              {
                student_id: "S102",
                risk_score: 85,
                risk_level: "high",
                flags: [{ type: "paste", detail: "large text block pasted" }],
              },
            ],
          },
        });
      }

      // Do not auto-resolve auth endpoints
      if (url.includes("/auth/login")) {
        return Promise.reject(error);
      }

      // Fallback empty data for lists, true for actions
      if (error.config.method === "get") return Promise.resolve({ data: [] });
      return Promise.resolve({ data: { success: true } });
    }
    return Promise.reject(error);
  }
);

export async function loginUser(username: string, password: string) {
  try {
    const res = await api.post("/auth/login", { username, password });
    return res.data;
  } catch (error) {
    // Fallback for GitHub Pages demo where backend is unavailable
    if (shouldUseGithubPagesDemoMock()) {
      if (username === "admin" && password === "admin123")
        return { id: 1, name: "Admin User", username: "admin", role: "admin" };
      if (username === "teacher1" && password === "teach123")
        return { id: 2, name: "Teacher One", username: "teacher1", role: "teacher" };
      if (username === "student1" && password === "student123")
        return { id: 3, name: "Student One", username: "student1", role: "student" };
      throw new Error("Invalid demo credentials");
    }
    throw error;
  }
}

// ── Types ──────────────────────────────────────────────────────────

export interface GradingResult {
  submission_id: number;
  grade_id: number;
  score: number;
  max_score: number;
  percentage: number;
  confidence: number;
  tier_used: number;
  model_used: string;
  feedback: string;
  matched_concepts: string[];
  missing_concepts: string[];
  flagged: boolean;
  flag_reason: string | null;
  escalated: boolean;
}

export interface IntegrityReport {
  risk_score: number;
  risk_level: "low" | "medium" | "high";
  flags: { type: string; detail: string; severity: string }[];
  session_stats: {
    total_time_secs: number;
    paste_count: number;
    keystroke_count: number;
    focus_loss_count: number;
    revision_count: number;
  };
  viva_triggered: boolean;
  viva_id: number | null;
  viva_questions: { question: string; difficulty: string; targets: string }[];
}

export interface ReviewQueueItem {
  queue_id: number;
  priority: string;
  reason: string;
  student_name: string;
  student_id: string;
  answer_text: string;
  assignment_title: string;
  assignment_type: string;
  score: number;
  max_score: number;
  confidence: number;
  feedback: string;
  model_used: string;
  grade_id: number;
}

// ── Grading ────────────────────────────────────────────────────────

export const submitAnswer = async (payload: {
  assignment_id: number;
  student_name: string;
  student_id: string;
  answer_text: string;
}): Promise<GradingResult> => {
  const res = await api.post("/grading/submit", payload);
  return res.data;
};

export const getReviewQueue = async (): Promise<ReviewQueueItem[]> => {
  const res = await api.get("/grading/review-queue");
  return res.data.queue;
};

export const resolveReview = async (
  queue_id: number,
  action: "approve" | "override",
  new_score?: number,
  professor_feedback?: string
) => {
  const res = await api.patch(`/grading/review/${queue_id}`, {
    action,
    new_score,
    professor_feedback,
  });
  return res.data;
};

export const getStudentGrades = async (student_id: string) => {
  const res = await api.get(`/grading/student/${student_id}`);
  return res.data;
};

// ── Integrity ──────────────────────────────────────────────────────

export const logEvents = async (payload: {
  student_id: string;
  assignment_id: number;
  session_id: string;
  events: any[];
}) => {
  const res = await api.post("/integrity/events", payload);
  return res.data;
};

export const analyzeIntegrity = async (payload: {
  student_id: string;
  assignment_id: number;
  submission_id: number;
  session_id: string;
  answer_text: string;
}): Promise<IntegrityReport> => {
  const res = await api.post("/integrity/analyze", payload);
  return res.data;
};

export const getIntegrityReports = async () => {
  const res = await api.get("/integrity/reports");
  return res.data.reports;
};

// ── RAG ───────────────────────────────────────────────────────────

export const queryRAG = async (payload: {
  question: string;
  course_id: number;
  top_k?: number;
  provider?: string;
  fast_mode?: boolean;
}) => {
  const res = await api.post("/rag/query", payload);
  return res.data;
};

export const getDocuments = async (course_id: number) => {
  const res = await api.get(`/rag/documents/${course_id}`);
  return res.data.documents;
};

// ── RAG Upload ─────────────────────────────────────────────────────

export const uploadDocument = async (
  file: File,
  course_id: number,
  onProgress?: (phase: string, pct: number) => void
): Promise<{ document_id: number; chunks_created: number; filename: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("course_id", String(course_id));

  onProgress?.("Uploading", 10);

  const res = await axios.post(`${getApiBaseURL()}/rag/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (evt.total) {
        const pct = Math.round((evt.loaded / evt.total) * 40) + 10;
        onProgress?.("Uploading", pct);
      }
    },
  });

  onProgress?.("Chunking", 60);
  await new Promise((r) => setTimeout(r, 400));
  onProgress?.("Embedding", 80);
  await new Promise((r) => setTimeout(r, 400));
  onProgress?.("Indexing", 95);
  await new Promise((r) => setTimeout(r, 300));
  onProgress?.("Done", 100);

  return res.data;
};

export const getCourses = async (): Promise<
  { id: number; name: string; subject: string; created_at: string }[]
> => {
  const res = await api.get("/rag/courses");
  return res.data.courses;
};

// ── Knowledge Graph ────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  bloom: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export const getGraph = async (): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> => {
  const res = await api.get("/graph/topics");
  return res.data;
};

export const seedGraph = async () => {
  const res = await api.post("/graph/seed");
  return res.data;
};

export const getPrerequisites = async (topic_id: string) => {
  const res = await api.get(`/graph/prerequisites/${topic_id}`);
  return res.data;
};

// ── Router Stats ───────────────────────────────────────────────────

export interface RouterStats {
  total_grades: number;
  tier1_count: number;
  tier2_count: number;
  tier1_pct: number;
  tier2_pct: number;
  flagged_count: number;
  flagged_pct: number;
  avg_confidence: number;
  confidence_distribution: { high: number; medium: number; low: number };
  model_usage: { model_used: string; count: number }[];
  reviewed_by_prof: number;
  cost_estimate: {
    tier2_spent_inr: number;
    saved_by_tier1_inr: number;
    total_if_all_t2_inr: number;
  };
}

export const getRouterStats = async (): Promise<RouterStats> => {
  const res = await api.get("/grading/stats");
  return res.data;
};

// ── Auth ───────────────────────────────────────────────────────────

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

const getBasePath = () => {
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/UniversityTeachingAssistent")
  ) {
    return "/UniversityTeachingAssistent";
  }
  return "";
};

export function requireAuth(
  allowedRoles?: Array<"admin" | "teacher" | "student">
): AuthUser {
  const user = getUser();
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = `${getBasePath()}/login`;
    } else {
      return {
        id: 0,
        name: "SSR",
        username: "ssr",
        role: allowedRoles?.[0] || "student",
      } as AuthUser;
    }
    throw new Error("Not authenticated");
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (typeof window !== "undefined") {
      window.location.href = `${getBasePath()}/login`;
    } else {
      return user;
    }
    throw new Error("Forbidden");
  }
  return user;
}

// ── Viva ───────────────────────────────────────────────────────────

export async function submitVivaResponse(data: {
  viva_id: number;
  question_index: number;
  response: string;
  original_answer?: string;
}) {
  const res = await api.post(`/integrity/viva/${data.viva_id}/respond`, {
    question_index: data.question_index,
    response_text: data.response,
    original_answer: data.original_answer ?? "",
  });
  return res.data;
}

// ── Admin / Users ──────────────────────────────────────────────────
// NOTE: Previously these used bare `axios` (no base URL) — fixed to use `api`

export async function createUser(data: {
  name: string;
  username: string;
  password: string;
  role: string;
}) {
  const res = await api.post("/auth/users", data);
  return res.data;
}

export async function listUsers() {
  const res = await api.get("/auth/users");
  return res.data;
}

// ── Courses & Assignments ──────────────────────────────────────────
// NOTE: Previously these used bare `axios` (no base URL) — fixed to use `api`

export async function createCourse(name: string, subject: string) {
  const res = await api.post("/courses", { name, subject });
  return res.data;
}

export async function createAssignment(data: {
  course_id: number;
  title: string;
  description: string;
  type: string;
  rubric: string;
  max_marks: number;
}) {
  const res = await api.post("/assignments", data);
  return res.data;
}

export async function getAssignments(course_id?: number) {
  const res = await api.get("/assignments", {
    params: course_id ? { course_id } : undefined,
  });
  return res.data;
}

export async function getStudentsStatus() {
  const res = await api.get("/students/status");
  return res.data;
}

// ── Scan Submit ────────────────────────────────────────────────────

export async function submitScan(formData: FormData) {
  const res = await axios.post(`${getApiBaseURL()}/grading/submit-scan`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export default api;