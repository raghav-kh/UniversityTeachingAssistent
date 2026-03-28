import { useRef, useCallback } from "react";
import { logEvents } from "@/lib/api";
import { v4 as uuidv4 } from "uuid";

// each event we track
interface EditorEvent {
  student_id: string;
  assignment_id: number;
  session_id: string;
  event_type: "keystroke" | "paste" | "focus_loss" | "delete" | "idle";
  event_data: Record<string, unknown>;
  timestamp: string;
}

export function useIntegrityTracker(student_id: string, assignment_id: number) {
  // session ID generated once per hook mount = one per editor open
  const sessionId   = useRef<string>(uuidv4());
  const eventBuffer = useRef<EditorEvent[]>([]);
  const lastActivity = useRef<number>(Date.now());
  const idleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── push one event into buffer ─────────────────────────────────
  const pushEvent = useCallback((
    type: EditorEvent["event_type"],
    data: Record<string, unknown> = {}
  ) => {
    eventBuffer.current.push({
      student_id,
      assignment_id,
      session_id: sessionId.current,
      event_type: type,
      event_data: data,
      timestamp: new Date().toISOString(),
    });
    lastActivity.current = Date.now();
  }, [student_id, assignment_id]);

  // ── flush buffer to backend ────────────────────────────────────
  const flush = useCallback(async () => {
    if (eventBuffer.current.length === 0) return;
    const toSend = [...eventBuffer.current];
    eventBuffer.current = [];   // clear immediately before await
    try {
      await logEvents(toSend);
    } catch (e) {
      // put events back if send failed — don't lose data
      eventBuffer.current = [...toSend, ...eventBuffer.current];
    }
  }, []);

  // ── start tracking (called when editor mounts) ─────────────────
  const startTracking = useCallback(() => {
    // batch flush every 5 seconds
    batchTimer.current = setInterval(flush, 5000);

    // idle detection — if no activity for 10s, log idle event
    idleTimer.current = setInterval(() => {
      const secondsSinceActivity = (Date.now() - lastActivity.current) / 1000;
      if (secondsSinceActivity > 10) {
        pushEvent("idle", { duration_secs: Math.round(secondsSinceActivity) });
        lastActivity.current = Date.now(); // reset so we don't spam
      }
    }, 10000);
  }, [flush, pushEvent]);

  // ── stop tracking (called when editor unmounts) ────────────────
  const stopTracking = useCallback(async () => {
    if (batchTimer.current) clearInterval(batchTimer.current);
    if (idleTimer.current)  clearInterval(idleTimer.current);
    await flush(); // final flush on unmount
  }, [flush]);

  // ── event handlers — attach these to the textarea ─────────────

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      pushEvent("delete", { key: e.key });
    } else if (e.key.length === 1) {
      // single printable character
      pushEvent("keystroke", { key: e.key });
    }
  }, [pushEvent]);

  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text");
    pushEvent("paste", {
      char_count: text.length,
      word_count: text.trim().split(/\s+/).length,
      // first 50 chars as preview — useful for debugging
      preview: text.substring(0, 50),
    });
  }, [pushEvent]);

  const onFocus = useCallback(() => {
    // focus regained — means it was previously lost
    const timeLost = Date.now() - lastActivity.current;
    if (timeLost > 2000) {  // only log if away for > 2 seconds
      pushEvent("focus_loss", { duration_ms: timeLost });
    }
  }, [pushEvent]);

  const onBlur = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  return {
    sessionId: sessionId.current,
    startTracking,
    stopTracking,
    flush,
    handlers: { onKeyDown, onPaste, onFocus, onBlur },
  };
}