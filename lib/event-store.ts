import { promises as fs } from "node:fs";
import path from "node:path";
import { historicalEvents } from "@/data/events";
import type { QuestionEvent } from "@/lib/domain";

const dataDir = path.join(process.cwd(), ".data");
const eventFile = path.join(dataDir, "events.json");

declare global {
  var __paimonEvents: QuestionEvent[] | undefined;
}

async function readLocalEvents(): Promise<QuestionEvent[]> {
  if (globalThis.__paimonEvents) return globalThis.__paimonEvents;
  try {
    const raw = await fs.readFile(eventFile, "utf8");
    globalThis.__paimonEvents = JSON.parse(raw) as QuestionEvent[];
  } catch {
    globalThis.__paimonEvents = [];
  }
  return globalThis.__paimonEvents;
}

async function writeLocalEvents(events: QuestionEvent[]) {
  globalThis.__paimonEvents = events;
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(eventFile, JSON.stringify(events, null, 2), "utf8");
  } catch {
    // Serverless filesystems may be read-only. The process-local store still
    // keeps the live demo coherent for the current instance.
  }
}

async function supabaseRequest(
  method: "GET" | "POST" | "PATCH",
  query = "",
  body?: unknown,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const response = await fetch(`${url}/rest/v1/question_events${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=minimal" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
  if (method === "GET") return (await response.json()) as QuestionEvent[];
  return true;
}

export async function listEvents() {
  const remote = await supabaseRequest("GET", "?select=*&order=occurredAt.desc");
  const live = Array.isArray(remote) ? remote : await readLocalEvents();
  return [...historicalEvents, ...live];
}

export async function recordEvent(event: QuestionEvent) {
  const remote = await supabaseRequest("POST", "", event);
  if (!remote) {
    const events = await readLocalEvents();
    await writeLocalEvents([...events, event]);
  }
}

export async function updateFeedback(eventId: string, helpful: boolean) {
  const remote = await supabaseRequest(
    "PATCH",
    `?id=eq.${encodeURIComponent(eventId)}`,
    { helpfulFeedback: helpful },
  );
  if (!remote) {
    const events = await readLocalEvents();
    await writeLocalEvents(
      events.map((event) =>
        event.id === eventId ? { ...event, helpfulFeedback: helpful } : event,
      ),
    );
  }
}
