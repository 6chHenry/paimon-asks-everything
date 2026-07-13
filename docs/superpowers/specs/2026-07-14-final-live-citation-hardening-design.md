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

## P1 review boundary refinements

Redirect payloads are decoded one layer at a time. After each layer, normalization checks whether the candidate is already an absolute HTTP(S) URL and stops immediately when it is. This preserves encoded reserved query components such as `%26` and `%3D` in a destination like `https://example.com/story?q=a%26b`.

The generic unresolved-engine guard also rejects:

- Google `/webhp` and `/advanced_search`;
- Bing `/images/search` and `/videos/search`;
- localized or nested `*.search.yahoo.com` root, result, and redirect pages.

Valid content destinations remain accepted.

Collaborative-edit shell detection requires a bounded explicit edit relation. Chinese text must relate `协助` or `帮助` to `编辑` and then `条目`, `页面`, or `词条`; English text must relate `assist` or `help` to `edit` and then `entry` or `page`. Merely welcoming readers and saying an article helps them understand content is not a shell. These exact controls remain usable:

- `欢迎阅读本页面的剧情分析，本文将帮助你理解角色的成长。`
- `Welcome to this page. This article will help readers understand the character arc.`

The exact live browser/edit fixture remains rejected. These refinements add no network or model calls.

## Definitive live evidence refinements

### Character-arc candidate balancing

The first search tier retains its three query buckets. For `character_arc` only, each bucket is deduplicated by canonical URL without using the title. Cross-bucket duplicates prefer a mandatory-query occurrence; ties use the shared web-text quality score and then stable provider order.

Within the global 16-candidate assessment budget, the original-question bucket is capped at 4 and each mandatory arc query reserves up to 6. Unused mandatory capacity may be filled from remaining mandatory-query candidates; raw original-question results never exceed 4. The selected canonical URLs are unique before the existing assessment/enrichment/ranking stages. No query or network call changes.

### Short raw dialogue

`looksLikeShortRawDialogue(excerpt)` identifies excerpts that begin with a speaker label and contain at least two labelled turns, supporting ASCII and fullwidth colons. Story evidence rejects this shape using the excerpt alone. Relationship evidence continues to allow it, and narrative prose containing a single quoted line remains usable.

### Site-description shell

`looksLikeSiteDescriptionShell` examines only the opening 220 characters. It requires a site-identity noun, a copular/ownership/operation relation, and either an explicit official-site identity or multiple promotional catalog terms. Chinese and English are supported without platform, company, game, or character names in the detector.

This rejects live-shaped and invented promotional site self-descriptions while retaining substantive community analysis and in-world prose about a resident-operated community. The detector joins the shared unusable-text chain, so all evidence and generation consumers inherit the rejection.

## P1 pre-quota relevance refinement

Character-arc balancing must not allocate its 4/6/6 quota from provider insertion order. The balancing API receives the normalized search plan and user question, then runs every query bucket's complete result array through the existing `dedupeAndRank` relevance and governance pipeline before slicing any quota. Candidates whose shared `webTextQualityScore(title + excerpt)` is negative infinity are removed before canonical cross-bucket selection and therefore never consume a raw or mandatory slot.

After this pre-quota processing, the existing invariants remain unchanged: canonical URL alone deduplicates title variants, mandatory occurrences beat raw occurrences, higher shared text quality breaks same-class collisions, the raw bucket contributes at most four, each mandatory bucket contributes up to six, the global limit is sixteen, and only mandatory leftovers fill unused capacity. No query, fetch, enrichment, assessment, or model call is added.

A regression places six shallow or unusable Wiki candidates before a seventh clean web candidate in each mandatory bucket. For both accepted question phrasings, with distinct raw buckets, the clean decisive arc evidence must survive the six-slot quota while negative-infinity candidates consume no slot. Existing exact-three-query and four-stage streamed-answer coverage remains green.

## P1 mandatory-bucket arc relevance refinement

Finite shallow profile candidates can still occupy all six mandatory slots because ordinary global ranking correctly prefers curated Wiki governance. That global order must remain unchanged. Only inside `character_arc` mandatory buckets, after the existing finite-text filter and `dedupeAndRank` pass, apply a stable pre-quota ordering by character-arc relevance.

The arc score is source-neutral. It rewards non-entity terms from that bucket's mandatory query and generic story-change context: loss or disrupted belonging, joining or leaving a group, manipulation or betrayal, realization or decision, break or separation, growth or change, and self-directed choice. Chinese and English action/turning-point vocabulary are supported. The existing `dedupeAndRank` result supplies the tie order, so governance remains the secondary ordering and ordinary global source ranking is untouched.

For both accepted phrasings, a regression gives a mandatory bucket six finite curated-Wiki shallow profile candidates followed by one finite community/web candidate with decisive loss, betrayal, and self-determination evidence. The decisive candidate must enter the six-slot reservation. Canonical dedupe, 4/6/6 quotas, the total-sixteen cap, exact query strings, and call counts do not change.

## Delivery P1 promotional/listing shell

`looksLikePromotionalListingShell` adds a source-neutral shared hard boundary for promotional availability copy and engagement-stat listings. It rejects either of two high-confidence shapes:

1. an availability phrase such as `7*24小时` or equivalent continuous-availability wording together with promotional language such as more, popular, continuously updated, or available here;
2. at least three distinct engagement metric categories in a compact excerpt: views/play count, bullet comments/danmaku, likes, coins/tips, favorites/bookmarks, shares, or comments, with equivalent generic English labels.

The detector contains no platform, publisher, game, character, or source names. A narrative that legitimately mentions one play, view, like, or comment remains usable. The detector joins `isUnusableWebText`, so shared quality scoring returns negative infinity and search selection, answer evidence, cold fallback, returned external citations, and cited IDs all inherit the rejection.

Tests use the exact delivery-live fixture, an invented-platform equivalent, clean single-metric narrative controls, evidence selection containing shell plus clean story, and generation containing the live-shaped shell. Existing query balancing, arc ranking, site/browser/dialogue rules, and call counts remain unchanged.
