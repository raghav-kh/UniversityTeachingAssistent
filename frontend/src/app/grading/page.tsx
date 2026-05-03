"use client";

import { useState } from "react";
import DraftEditor from "@/components/ui/DraftEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCircle } from "lucide-react";
import { PageShell, PageHeader, SurfaceCard } from "@/components/ui/PagePrimitives";

const ASSIGNMENTS = [
  { id: 1, title: "What is a stack data structure?",  type: "descriptive", marks: 100 },
  { id: 2, title: "Time complexity of binary search?", type: "mcq",         marks: 10  },
];

export default function GradingPage() {
  const [studentName, setStudentName] = useState("");
  const [studentId,   setStudentId]   = useState("");
  const [selected,    setSelected]    = useState(ASSIGNMENTS[0]);
  const [started,     setStarted]     = useState(false);

  // show student info form first
  // once they click Start, mount the DraftEditor (which starts tracking)
  if (!started) {
    return (
      <PageShell className="max-w-2xl">
        <PageHeader
          title="Student Submission"
          subtitle="Enter details to begin; tracking starts when editor opens"
          badge="Tools · Grading"
        />

        <SurfaceCard className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Student Name</label>
              <Input
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="Rahul Verma"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-muted-foreground">Student ID</label>
              <Input
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="CS001"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs text-muted-foreground">Select Assignment</label>
            <div className="space-y-2">
              {ASSIGNMENTS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`w-full text-left p-3.5 rounded-lg border text-sm transition-all ${
                    selected.id === a.id
                      ? "border-emerald-500/50 bg-emerald-400/5 text-emerald-400"
                      : "border-border/70 bg-card/50 text-foreground hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium">{a.title}</div>
                  <div className="text-[11px] mt-0.5 opacity-60">
                    {a.type} · {a.marks} marks
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => setStarted(true)}
            disabled={!studentName.trim() || !studentId.trim()}
            className="h-11 w-full bg-emerald-500 font-semibold text-black hover:bg-emerald-600"
          >
            <UserCircle size={16} className="mr-2" />
            Open Editor & Start Tracking
          </Button>
        </SurfaceCard>
      </PageShell>
    );
  }

  return (
    <PageShell className="max-w-2xl">
      <PageHeader
        title="Assignment Editor"
        subtitle={`${studentName} · ${studentId}`}
        badge="Tools · Grading"
        actions={
          <button
            onClick={() => setStarted(false)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Change student
          </button>
        }
      />

      <DraftEditor
        assignmentId={selected.id}
        assignmentTitle={selected.title}
        assignmentType={selected.type}
        maxMarks={selected.marks}
        studentId={studentId}
        studentName={studentName}
      />
    </PageShell>
  );
}