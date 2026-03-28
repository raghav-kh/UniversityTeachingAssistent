"use client";

import { useState } from "react";
import DraftEditor from "@/components/ui/DraftEditor";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCircle } from "lucide-react";

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
      <div className="p-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Student Submission</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Enter details to begin — tracking starts when you open the editor
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Student Name</label>
              <Input
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="Rahul Verma"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1.5 block">Student ID</label>
              <Input
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="CS001"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Select Assignment</label>
            <div className="space-y-2">
              {ASSIGNMENTS.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelected(a)}
                  className={`w-full text-left p-3.5 rounded-lg border text-sm transition-all ${
                    selected.id === a.id
                      ? "border-emerald-500/50 bg-emerald-400/5 text-emerald-400"
                      : "border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600"
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
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-semibold h-11"
          >
            <UserCircle size={16} className="mr-2" />
            Open Editor & Start Tracking
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Assignment Editor</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {studentName} · {studentId}
          </p>
        </div>
        <button
          onClick={() => setStarted(false)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ← Change student
        </button>
      </div>

      <DraftEditor
        assignmentId={selected.id}
        assignmentTitle={selected.title}
        assignmentType={selected.type}
        maxMarks={selected.marks}
        studentId={studentId}
        studentName={studentName}
      />
    </div>
  );
}