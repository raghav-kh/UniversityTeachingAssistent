"use client";

import { useEffect, useRef, useState } from "react";
import { uploadDocument, getDocuments, getCourses } from "@/lib/api";
import {
  Upload, FileText, CheckCircle,
  AlertCircle, BookOpen, Layers, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

interface Document {
  id: number;
  filename: string;
  chunk_count: number;
  created_at: string;
}

interface Course {
  id: number;
  name: string;
  subject: string;
}

interface UploadState {
  phase: string;
  pct: number;
  status: "idle" | "uploading" | "done" | "error";
  result?: { chunks_created: number; filename: string };
  error?: string;
}

export default function RAGPage() {
  const [courses, setCourses]           = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number>(1);
  const [documents, setDocuments]       = useState<Document[]>([]);
  const [dragOver, setDragOver]         = useState(false);
  const [docsLoading, setDocsLoading]   = useState(false);
  const [upload, setUpload]             = useState<UploadState>({
    phase: "", pct: 0, status: "idle"
  });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) loadDocuments();
  }, [selectedCourse]);

  async function loadCourses() {
    try {
      const data = await getCourses();
      setCourses(data);
      if (data.length > 0) setSelectedCourse(data[0].id);
    } catch (e) {
      console.error("Failed to load courses:", e);
    }
  }

  async function loadDocuments() {
    setDocsLoading(true);
    try {
      const data = await getDocuments(selectedCourse);
      setDocuments(data);
    } catch (e) {
      console.error("Failed to load documents:", e);
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUpload({
        phase: "", pct: 0, status: "error",
        error: "Only PDF files are supported right now"
      });
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setUpload({
        phase: "", pct: 0, status: "error",
        error: "File too large — maximum size is 100MB"
      });
      return;
    }

    setUpload({ phase: "Starting...", pct: 5, status: "uploading" });

    try {
      const result = await uploadDocument(
        file,
        selectedCourse,
        (phase, pct) => setUpload(u => ({ ...u, phase, pct }))
      );

      setUpload({
        phase: "Done",
        pct: 100,
        status: "done",
        result: {
          chunks_created: result.chunks_created,
          filename: result.filename
        }
      });

      // refresh document list to show new file
      await loadDocuments();

      // auto-reset upload UI after 4 seconds
      setTimeout(() => {
        setUpload({ phase: "", pct: 0, status: "idle" });
      }, 4000);

    } catch (e: any) {
      setUpload({
        phase: "", pct: 0, status: "error",
        error: e?.response?.data?.detail ?? "Upload failed — check backend logs"
      });
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count ?? 0), 0);

  return (
    <PageShell className="max-w-5xl">

      {/* Header */}
      <PageHeader
        title="RAG Engine"
        subtitle="Upload course materials for grounded generation"
        badge="Teacher · RAG"
      />

      <div className="grid grid-cols-2 gap-6">

        {/* ── LEFT: Upload Panel ─────────────────────────────── */}
        <div className="space-y-4">

          {/* Course selector */}
          <SurfaceCard className="p-5">
            <label className="mb-3 block text-xs uppercase tracking-wider text-muted-foreground">
              Target Course
            </label>

            {courses.length === 0 ? (
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>No courses found. Create one via Docker:</p>
                <code className="block rounded-lg bg-muted p-2.5 text-[10px] leading-relaxed text-muted-foreground">
                  docker exec -it eduai_postgres psql -U admin -d eduai -c
                  &quot;INSERT INTO courses (name, subject)
                  VALUES (&apos;DSA&apos;, &apos;CS&apos;);&quot;
                </code>
                <Button
                  onClick={loadCourses}
                  variant="outline"
                  className="mt-1 w-full text-xs"
                >
                  <RefreshCw size={12} className="mr-2" /> Retry
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {courses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCourse(c.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                      selectedCourse === c.id
                        ? "border-emerald-500/50 bg-emerald-400/5 text-emerald-400"
                        : "border-border/70 bg-card text-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[11px] ml-2 opacity-50">{c.subject}</span>
                  </button>
                ))}
              </div>
            )}
          </SurfaceCard>

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all select-none ${
              dragOver
                ? "border-emerald-400 bg-emerald-400/5 scale-[1.01]"
                : "border-border/70 bg-card hover:border-primary/40"
            }`}
          >
            <input
              ref={fileInput}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
                e.target.value = ""; // reset so same file can be re-uploaded
              }}
            />
            <Upload
              size={32}
              className={`mx-auto mb-3 transition-colors ${
                dragOver ? "text-emerald-400" : "text-muted-foreground"
              }`}
            />
            <div className="mb-1 font-semibold text-foreground">
              {dragOver ? "Drop to upload" : "Drop PDF here or click to browse"}
            </div>
            <div className="text-xs text-muted-foreground">
              Lecture notes, textbooks, slides — PDF only, max 100MB
            </div>
          </div>

          {/* Upload progress */}
          {upload.status === "uploading" && (
            <SurfaceCard className="p-5">
              <div className="flex justify-between text-sm mb-3">
                <span className="font-medium text-foreground">{upload.phase}</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {upload.pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${upload.pct}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>Upload</span>
                <span>Chunk</span>
                <span>Embed</span>
                <span>Index</span>
              </div>
            </SurfaceCard>
          )}

          {/* Success state */}
          {upload.status === "done" && upload.result && (
            <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-emerald-400">
                  {upload.result.filename} processed successfully
                </div>
                <div className="text-xs text-emerald-400/70 mt-1">
                  {upload.result.chunks_created} chunks created and stored in pgvector
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {upload.status === "error" && (
            <div className="bg-red-400/10 border border-red-400/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-red-400">Upload failed</div>
                <div className="text-xs text-red-400/70 mt-1">{upload.error}</div>
                <button
                  onClick={() => setUpload({ phase: "", pct: 0, status: "idle" })}
                  className="text-xs text-red-400 underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Indexed Documents ───────────────────────── */}
        <SurfaceCard className="flex flex-col p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-foreground">Indexed Materials</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                pgvector store · course {selectedCourse}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">{totalChunks}</div>
              <div className="text-[10px] text-muted-foreground">total chunks</div>
            </div>
          </div>

          {/* Document list */}
          <div className="flex-1 min-h-0">
            {docsLoading ? (
              <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <BookOpen size={28} className="mb-3 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">No documents yet</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Upload a PDF to get started
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 p-3 transition-all hover:border-primary/40"
                  >
                    <FileText
                      size={15}
                      className="mt-0.5 shrink-0 text-muted-foreground"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {doc.filename}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {doc.chunk_count ?? 0} chunks ·{" "}
                        {new Date(doc.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      <Layers size={8} /> Active
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DB info footer */}
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-4">
            {[
              { label: "Vector Store",   val: "pgvector",  color: "text-cyan-400"    },
              { label: "Embedding Dims", val: "1536",      color: "text-violet-400"  },
              { label: "Similarity",     val: "Cosine",    color: "text-emerald-400" },
              { label: "Index Type",     val: "IVFFlat",   color: "text-orange-400"  },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-lg border border-border/60 bg-muted/40 p-2.5"
              >
                <div className={`text-xs font-semibold ${s.color}`}>{s.val}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>

      </div>
    </PageShell>
  );
}