import axios from "axios";



const api = axios.create({
  baseURL: "",   // empty = same origin (localhost:3000, proxied to 8000)
  headers: { "Content-Type": "application/json" },
});

export async function loginUser(username: string, password: string) {
  const res = await axios.post("/auth/login", { username, password });
  return res.data;
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

export const logEvents = async (events: object[]) => {
  const res = await api.post("/integrity/events", { events });
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
  fast_mode?: boolean;   // add this
}) => {
  const res = await api.post("/rag/query", payload);
  return res.data;
};

export const getDocuments = async (course_id: number) => {
  const res = await api.get(`/rag/documents/${course_id}`);
  return res.data.documents;
};

export default api;

// ── RAG Upload ─────────────────────────────────────────────────────

export const uploadDocument = async (
  file: File,
  course_id: number,
  onProgress?: (phase: string, pct: number) => void
): Promise<{ document_id: number; chunks_created: number; filename: string }> => {

  const formData = new FormData();
  formData.append("file", file);
  formData.append("course_id", String(course_id));

  // simulate progress phases while upload + processing happens
  // real progress would need SSE or websockets — this is good enough for demo
  onProgress?.("Uploading", 10);

  const res = await axios.post("/rag/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (evt) => {
      if (evt.total) {
        const pct = Math.round((evt.loaded / evt.total) * 40) + 10;
        onProgress?.("Uploading", pct);
      }
    },
  });

  onProgress?.("Chunking", 60);
  await new Promise(r => setTimeout(r, 400));
  onProgress?.("Embedding", 80);
  await new Promise(r => setTimeout(r, 400));
  onProgress?.("Indexing", 95);
  await new Promise(r => setTimeout(r, 300));
  onProgress?.("Done", 100);

  return res.data;
};

export const getCourses = async (): Promise < { id: number; name: string; subject: string }[] >  => {
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
  cost_estimate: {                    // was missing the ? before
    tier2_spent_inr: number;
    saved_by_tier1_inr: number;
    total_if_all_t2_inr: number;
  };
}

export const getRouterStats = async (): Promise<RouterStats> => {
  const res = await api.get("/grading/stats");
  return res.data;
};
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

// Submit a single viva response for a given question index
export async function submitVivaResponse(data: {
  viva_id: number;
  question_index: number;
  response: string;
}) {
  const res = await axios.post(`/integrity/viva/${data.viva_id}/respond`, {
    question_index: data.question_index,
    response: data.response,
  });
  return res.data;
}

export async function createUser(data: {
  name: string; username: string; password: string; role: string;
}) {
  const res = await axios.post("/auth/users", data);
  return res.data;
}

export async function listUsers() {
  const res = await axios.get("/auth/users");
  return res.data;
}

export async function createCourse(name: string, subject: string) {
  const res = await axios.post("/courses", { name, subject });
  return res.data;
}

export async function createAssignment(data: {
  course_id: number; title: string; description: string;
  type: string; rubric: string; max_marks: number;
}) {
  const res = await axios.post("/assignments", data);
  return res.data;
}

export async function getAssignments(course_id?: number) {
  const res = await axios.get("/assignments", {
    params: course_id ? { course_id } : undefined,
  });
  return res.data;
}

export async function getStudentsStatus() {
  const res = await axios.get("/students/status");
  return res.data;
}

export async function submitScan(formData: FormData) {
  const res = await axios.post("/grading/submit-scan", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}