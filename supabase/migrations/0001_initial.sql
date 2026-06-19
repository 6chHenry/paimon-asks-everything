create table if not exists public.question_events (
  "id" text primary key,
  "occurredAt" timestamptz not null,
  "language" text not null check ("language" in ('zh-CN', 'en')),
  "playerProfile" text not null,
  "questionCategory" text not null,
  "confusionTopic" text not null,
  "spoilerGateTriggered" boolean not null default false,
  "usedExternalSearch" boolean not null default false,
  "responseStatus" text not null,
  "helpfulFeedback" boolean,
  "sourceKind" text not null check ("sourceKind" in ('historical_sample', 'live_increment')),
  "questionText" text,
  "textConsent" boolean not null default false,
  constraint question_text_requires_consent
    check ("questionText" is null or "textConsent" = true)
);

create index if not exists question_events_occurred_at_idx
  on public.question_events ("occurredAt" desc);
create index if not exists question_events_topic_idx
  on public.question_events ("confusionTopic");

alter table public.question_events enable row level security;

-- The application uses the server-only service role. No anonymous client
-- policies are created, so raw event rows are never exposed to the browser.
