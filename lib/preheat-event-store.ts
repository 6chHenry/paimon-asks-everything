import { promises as fs } from "node:fs";
import path from "node:path";
import { historicalPreheatEvents } from "@/data/preheat-events";
import type { PreheatInteractionEvent } from "@/lib/domain";

const dataDir = path.join(process.cwd(), ".data");
const eventFile = path.join(dataDir, "preheat-events.json");

declare global {
  var __paimonPreheatEvents: PreheatInteractionEvent[] | undefined;
}

async function readLocalEvents(): Promise<PreheatInteractionEvent[]> {
  if (globalThis.__paimonPreheatEvents) return globalThis.__paimonPreheatEvents;
  try {
    const raw = await fs.readFile(eventFile, "utf8");
    globalThis.__paimonPreheatEvents = JSON.parse(raw) as PreheatInteractionEvent[];
  } catch {
    globalThis.__paimonPreheatEvents = [];
  }
  return globalThis.__paimonPreheatEvents;
}

async function writeLocalEvents(events: PreheatInteractionEvent[]) {
  globalThis.__paimonPreheatEvents = events;
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(eventFile, JSON.stringify(events, null, 2), "utf8");
  } catch {
    // Process-local storage still supports the live demo on read-only hosts.
  }
}

async function supabaseRequest(method: "GET" | "POST", body?: unknown) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const query = method === "GET" ? "?select=*&order=occurredAt.desc" : "";
  const response = await fetch(
    `${url}/rest/v1/preheat_interaction_events${query}`,
    {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: method === "POST" ? "return=minimal" : "return=representation",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase preheat request failed: ${response.status}`);
  }
  if (method === "GET") {
    return (await response.json()) as PreheatInteractionEvent[];
  }
  return true;
}

export async function listPreheatEvents() {
  const remote = await supabaseRequest("GET");
  const live = Array.isArray(remote) ? remote : await readLocalEvents();
  return [...historicalPreheatEvents, ...live];
}

export async function recordPreheatEvent(event: PreheatInteractionEvent) {
  const remote = await supabaseRequest("POST", event);
  if (!remote) {
    const events = await readLocalEvents();
    await writeLocalEvents([...events, event]);
  }
}
