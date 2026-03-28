"use client";

import { useEffect, useRef, useState } from "react";
import { uploadDocument, getDocuments, getCourses } from "@/lib/api";
import {
  Upload, FileText, CheckCircle,
  AlertCircle, BookOpen, Layers, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">RAG Engine</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Upload course materials — AI chunks, embeds, and indexes for grounded generation
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">

        {/* ── LEFT: Upload Panel ─────────────────────────────── */}
        <div className="space-y-4">

          {/* Course selector */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-3 block">
              Target Course
            </label>

            {courses.length === 0 ? (
              <div className="text-xs text-zinc-600 space-y-2">
                <p>No courses found. Create one via Docker:</p>
                <code className="block bg-zinc-800 p-2.5 rounded-lg text-zinc-400 text-[10px] leading-relaxed">
                  docker exec -it eduai_postgres psql -U admin -d eduai -c
                  &quot;INSERT INTO courses (name, subject)
                  VALUES (&apos;DSA&apos;, &apos;CS&apos;);&quot;
                </code>
                <Button
                  onClick={loadCourses}
                  variant="outline"
                  className="w-full border-zinc-700 text-zinc-400 text-xs mt-1"
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
                        : "border-zinc-700 bg-zinc-800/30 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-[11px] ml-2 opacity-50">{c.subject}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all select-none ${
              dragOver
                ? "border-emerald-400 bg-emerald-400/5 scale-[1.01]"
                : "border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800/50"
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
                dragOver ? "text-emerald-400" : "text-zinc-500"
              }`}
            />
            <div className="font-semibold text-white mb-1">
              {dragOver ? "Drop to upload" : "Drop PDF here or click to browse"}
            </div>
            <div className="text-xs text-zinc-500">
              Lecture notes, textbooks, slides — PDF only, max 100MB
            </div>
          </div>

          {/* Upload progress */}
          {upload.status === "uploading" && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-zinc-300 font-medium">{upload.phase}</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {upload.pct}%
                </span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${upload.pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-600 mt-2">
                <span>Upload</span>
                <span>Chunk</span>
                <span>Embed</span>
                <span>Index</span>
              </div>
            </div>
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
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-white">Indexed Materials</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                pgvector store · course {selectedCourse}
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">{totalChunks}</div>
              <div className="text-[10px] text-zinc-500">total chunks</div>
            </div>
          </div>

          {/* Document list */}
          <div className="flex-1 min-h-0">
            {docsLoading ? (
              <div className="flex items-center justify-center h-32 text-zinc-600 gap-2">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-sm">Loading...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <BookOpen size={28} className="text-zinc-700 mb-3" />
                <div className="text-zinc-600 text-sm">No documents yet</div>
                <div className="text-zinc-700 text-xs mt-1">
                  Upload a PDF to get started
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30 hover:border-zinc-600 transition-all"
                  >
                    <FileText
                      size={15}
                      className="text-zinc-400 mt-0.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-200 font-medium truncate">
                        {doc.filename}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
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
          <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-2">
            {[
              { label: "Vector Store",   val: "pgvector",  color: "text-cyan-400"    },
              { label: "Embedding Dims", val: "1536",      color: "text-violet-400"  },
              { label: "Similarity",     val: "Cosine",    color: "text-emerald-400" },
              { label: "Index Type",     val: "IVFFlat",   color: "text-orange-400"  },
            ].map(s => (
              <div
                key={s.label}
                className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/20"
              >
                <div className={`text-xs font-semibold ${s.color}`}>{s.val}</div>
                <div className="text-[10px] text-zinc-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}