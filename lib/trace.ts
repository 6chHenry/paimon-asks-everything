export type TraceStage =
  | "classify"
  | "spoiler"
  | "retrieval"
  | "search"
  | "tool"
  | "generate"
  | "final";

export type TraceStatus = "pending" | "running" | "complete" | "skipped" | "error";

export interface TraceEvent {
  id: string;
  at: string;
  stage: TraceStage;
  status: TraceStatus;
  message: string;
  detail?: string;
  sourceKind?: string;
  url?: string;
}
export type TraceEmitter = (event: TraceEvent) => void | Promise<void>;

export function makeTraceEvent(
  event: Omit<TraceEvent, "id" | "at">,
): TraceEvent {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    ...event,
  };
}

export function formatTraceSse(eventName: string, payload: unknown) {
  return `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function emitTrace(
  emitter: TraceEmitter | undefined,
  event: Omit<TraceEvent, "id" | "at">,
) {
  if (!emitter) return;
  await emitter(makeTraceEvent(event));
}

