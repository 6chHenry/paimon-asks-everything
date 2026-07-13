# Final Live Citation Hardening Design

## Scope

Close the two citation-cleanliness failures observed in the final real-provider character-arc run without adding network/model calls or source-, title-, or character-specific rules.

## Browser/edit shell rejection

`lib/web-text-quality.ts` will expose a generic high-confidence browser/edit-shell detector. It rejects text when either of these signal combinations is present:

1. JavaScript is required or disabled, together with browser settings or browser configuration instructions.
2. A welcome/read instruction appears together with assist/edit language and an entry/page/object reference.

The detector feeds `isUnusableWebText`; therefore hard scoring returns negative infinity and all existing evidence/generation consumers inherit the rejection. A concise content snippet without both sides of either combination remains usable.

## Search-result URL boundary

A dependency-safe shared utility will normalize raw search-result URLs and expose `isUnresolvedSearchResultUrl`.

Normalization has one successful output shape: an absolute HTTP(S) target URL. It decodes valid Yahoo `RU` and DuckDuckGo `uddg` redirects. It returns no target for malformed encodings, unsupported schemes, search-engine roots/results/interstitials, or unresolved redirect hosts. It never infers a URL from a title.

`makeWebCitation` normalizes before classification. Page enrichment validates the response final URL again. If enrichment changes the host, source name, source kind, credibility, fact status, and assessment are rebuilt atomically from the final URL. An unresolved enriched destination yields no citation. `selectAnswerEvidence` repeats the unresolved-URL check as defense in depth.

## Data flow and failure behavior

```text
raw result href
  -> normalize/validate destination
  -> make citation and classify destination
  -> optional existing page fetch
  -> validate response final URL
  -> atomically recompute provenance when destination changes
  -> evidence selection validates URL and text once more
  -> generation receives only usable citations
```

Invalid input is dropped rather than repaired from surrounding text. Existing fetch concurrency and call counts do not change.

## TDD coverage

- Exact live browser/edit-shell excerpt: navigation-heavy, unusable, and negative-infinity score; evidence selection rejects it.
- Clean content snippet remains accepted.
- Yahoo root result carrying a Miyoushe-shaped title/snippet is dropped.
- Valid Yahoo `RU` decodes to its target and source classification agrees with that target.
- Malformed Yahoo and DuckDuckGo redirects are dropped.
- A mocked cross-host response redirect recomputes all provenance fields from the final URL.
- End-to-end cold generation containing both live failures returns neither external citations nor cited IDs.

Focused tests, full tests, typecheck, build, diff checks, and the existing port-3000 ownership check complete the verification.
