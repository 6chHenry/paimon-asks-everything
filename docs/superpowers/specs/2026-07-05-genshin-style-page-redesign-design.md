# Genshin-Style Page Redesign Design

Date: 2026-07-05
Branch: `refactor-page`

## Goal

Redesign the product surface so it feels more focused, more beautiful, and closer to Genshin Impact's in-game interface language without directly copying official UI assets. The first implementation round will establish a shared shell for the whole site, then deeply redesign the core path around the homepage, Snezhnaya relationship graph, and preheat reading flow.

The current page has two main problems:

- The visual priority is unclear; users do not immediately understand the strongest action.
- The interface has some relevant motifs, but it does not yet feel like a coherent Genshin-style experience.

## Approved Direction

The visual direction is a blend of:

- Main style: close to in-game UI, with a left-side icon menu, parchment surfaces, gold rules, blue-gray panels, framed cards, circular icon language, and subtle symbolic ornaments.
- Local accent style: original adventurer manual motifs for safer, more authored details.
- Snezhnaya accent: selective icy blue, dark archive, and Fatui intelligence atmosphere in graph and dossier areas.

The design should feel inspired by Genshin's menus and version-preheat mood, but it must avoid direct copies of official icons, textures, or UI screenshots.

## Scope

The chosen approach is "global shell plus core-path redesign."

First round:

- Replace the current top-navigation-heavy shell with a global in-game-style left navigation shell.
- Deeply redesign the homepage.
- Visually unify `/preheat`.
- Visually unify the Snezhnaya relationship graph and its entry points.
- Let other pages inherit the new shell and base visual tokens, while leaving deeper page-specific redesign for later.

Later rounds:

- Extend the visual system across Ask Paimon, capability preview, insights, and evaluation surfaces.
- Continue extracting shared UI primitives from repeated patterns.

Out of scope for this first design:

- Backend API changes.
- Retrieval, generation, evaluation, or event-store logic changes.
- Rewriting the Snezhnaya graph business interactions from scratch.
- Introducing official copyrighted UI assets.

## Information Architecture

The homepage becomes a Snezhnaya version intelligence overview.

The first screen uses a balanced split hero:

- A global left-side navigation rail is always visible on desktop.
- The main hero copy introduces the Snezhnaya version-intelligence purpose.
- A relationship-graph preview sits on the hero's right side and acts as the strongest action.

The graph preview itself is the primary entry. The page should not repeat the same "open graph" button in multiple places. Supporting actions can exist, but they should be visually secondary.

Below the hero, the homepage content order is:

1. PV feature using existing Snezhnaya cover assets.
2. Key character dossier using existing avatar assets.
3. Relationship graph summary.
4. Preheat note / intelligence brief.
5. Ask Paimon entry.

Traveler settings are moved into a secondary drawer or compact panel. They remain available, but they should no longer dominate the homepage.

## Global Shell

`AppShell` should become a three-part layout:

- Left navigation rail: global navigation for Home, Preheat, Ask Paimon, Preview, and Insights.
- Top status bar: brand, language switch, current context, and non-official demo note.
- Main content area: page-specific content with consistent spacing and responsive constraints.

Desktop behavior:

- The left rail is persistent.
- Navigation items use circular icon buttons with labels or tooltips.
- The active page is clearly highlighted.

Tablet behavior:

- The rail can compress to an icon-only form.
- Tooltips and accessible labels remain available.

Mobile behavior:

- The navigation should become a bottom navigation or drawer.
- Main content must not be squeezed by a persistent side rail.

The existing language toggle remains global.

## Homepage Components

The homepage should be split into focused components instead of concentrating the whole experience inside `app/page.tsx`.

Proposed component boundaries:

- `HomeHeroIntel`: hero copy, version-intelligence framing, and graph preview entry.
- `HomeVideoFeature`: PV/video cover and external video links.
- `HomeCharacterDossier`: key character dossier cards using existing avatar assets.
- `HomeGraphSummary`: compact relationship summary and entry into the full graph.
- `HomePreheatBrief`: restyled `PreheatNote` flow.
- `HomeAskEntry`: lightweight Ask Paimon entry point.
- `TravelerContextDrawer`: compact settings surface for profile, progress, focus, and storage preference.

The implementation should continue using existing data and providers:

- `data/preheat-topics.ts`
- `data/snezhnaya-graph.ts`
- `components/preferences-provider.tsx`
- Existing domain and i18n helpers

## Preheat And Graph Pages

`/preheat` should inherit the new shell and use the same parchment, framed-panel, icon, and gold-rule language as the homepage. It should feel like opening a deeper intelligence page from the homepage rather than entering a separate product.

`SnezhnayaGraph` should keep its existing interaction model. The first round should focus on visual integration:

- Graph container and toolbar styling.
- Node and relation visual treatment.
- Detail dialog styling.
- Empty, selected, and related-state styling.
- Better alignment with homepage graph preview.

Deep graph behavior changes are not part of this round unless required by the visual integration.

## Interaction Design

The graph preview in the hero is clickable and leads to the full graph experience.

The PV area should use existing image assets and link out rather than embedding a heavy player.

Character dossier cards can link to a graph node or open a lightweight detail state. If that is too risky for the first pass, they can be static cards with a clear graph CTA nearby.

The preheat note keeps its current depth choice and start action, but is visually reframed as an intelligence brief rather than a loose paper note.

The traveler settings drawer preserves existing preference behavior while reducing visual prominence.

## Visual System

The first pass should define shared CSS tokens and reusable classes for:

- Parchment and pale paper surfaces.
- Deep blue-gray shell surfaces.
- Gold line and frame accents.
- Icy Snezhnaya accents.
- Circular icon buttons.
- Framed panels.
- Dossier cards.
- Compact badges and tags.
- Primary and secondary actions.

The palette should avoid becoming a one-note beige, blue, or dark theme. Beige paper, blue-gray shell, gold accents, icy cyan, muted red/coral, and white highlights should work together.

Use `lucide-react` for functional icons where possible, but style them into the in-game-inspired system. Custom decorative symbols should be simple CSS or inline text/shape treatments, not copied game assets.

## Content And Encoding

Several terminal reads showed mojibake in `app/page.tsx` and README output. During implementation, inspect whether this is only terminal encoding or actual file-content corruption.

If homepage or related component copy is corrupted in source files, repair the affected user-facing Chinese and English text as part of the first round. Do not rewrite unrelated README or documentation copy unless it affects the redesigned pages.

## Accessibility And Responsiveness

Requirements:

- All navigation items have accessible labels.
- Keyboard focus states are visible.
- Icon-only controls have tooltips or screen-reader labels.
- Chinese and English strings must not overflow buttons, cards, rails, or badges.
- The hero remains legible on desktop, tablet, and mobile.
- The mobile navigation must not obscure primary content.
- Motion should be subtle and non-essential.

## Verification

Run these checks after implementation:

- `npm run typecheck`
- `npm test`
- `npm run build` if feasible
- Local dev-server visual inspection

Manual checks:

- Desktop homepage: left rail, hero copy, and graph preview are all visible and balanced.
- Mobile homepage: graph entry remains prominent without layout overlap.
- `/preheat`: feels visually connected to the homepage.
- Snezhnaya graph: graph, toolbar, selected state, and detail dialog remain usable.
- Language switch: Chinese and English both render without overflow.
- Existing Ask, Preview, and Insights pages remain reachable through the new shell.

## Risks

`app/globals.css` is already large. Implementation should improve organization around the touched areas, but avoid unrelated full-file churn.

`SnezhnayaGraph` is a complex component. Visual work should not destabilize its interaction logic.

The global shell change touches every route. Start by making the shell backward-compatible with existing page content, then deepen the homepage and core path.

## Open Decisions

No open product decisions remain for the first implementation plan. The chosen direction is:

- Global in-game-style left navigation.
- Homepage as Snezhnaya version intelligence overview.
- Hero graph preview as the strongest action.
- First deep pass on homepage, `/preheat`, and Snezhnaya graph.
- Later expansion to the rest of the visual system.
