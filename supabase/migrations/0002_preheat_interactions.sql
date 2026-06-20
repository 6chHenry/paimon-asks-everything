create table if not exists public.preheat_interaction_events (
  "id" text primary key,
  "occurredAt" timestamptz not null,
  "language" text not null check ("language" in ('zh-CN', 'en')),
  "playerProfile" text not null,
  "topicId" text not null,
  "interactionKind" text not null check (
    "interactionKind" in (
      'depth_selected',
      'timeline_node_opened',
      'relation_node_opened'
    )
  ),
  "targetId" text not null,
  "depth" text check ("depth" is null or "depth" in ('guided', 'research')),
  "sourceKind" text not null check (
    "sourceKind" in ('historical_sample', 'live_increment')
  )
);

create index if not exists preheat_events_occurred_at_idx
  on public.preheat_interaction_events ("occurredAt" desc);
create index if not exists preheat_events_topic_idx
  on public.preheat_interaction_events ("topicId");
create index if not exists preheat_events_target_idx
  on public.preheat_interaction_events ("targetId");

alter table public.preheat_interaction_events enable row level security;

-- Raw events remain server-only through the service role.
