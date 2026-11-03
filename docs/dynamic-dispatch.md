# Dynamic dispatch v0.5A — boundaries and provenance

## Source and route scope

Airport identity/coordinates were checked against official AWC airport JSON whose records identify their source as FAA. A reduced historical response is retained in `tests/fixtures/dispatch-airports-faa-2026-11.json`; it is a regression fixture, not runtime network data.

https://aviationweather.gov/api/data/airport?ids=PALB,PADY,PAKH,PAOO,PORI,PADQ,PAHO,PAEN&format=json

| New route airport | Name | Latitude | Longitude |
| --- | --- | --- | --- |
| PADQ | Kodiak | 57.7498 | -152.4939 |
| PALB | Larsen Bay | 57.5351 | -153.9767 |
| PAKH | Akhiok | 56.9387 | -154.1826 |
| PAHO | Homer | 59.6455 | -151.4766 |
| PAEN | Kenai | 60.5733 | -151.2448 |

Only PADQ–PALB, PADQ–PAKH, PADQ–PAHO, PADQ–PAEN and PAHO–PAEN are generated (in either direction). This intentionally limited network provides island cargo and mainland connections without assuming an unverified runway, service or approach. Distances use the haversine formula with Earth radius 3440.065 NM and are rounded; they are not routed flight-plan distances or aircraft-performance calculations.

The legacy v0.4 `PADY = Old Harbor` association is wrong: the official record is **Kongiganak**, at 59.9616, -162.8806. No such pairing is used in new assignments. Old records and accepted jobs are preserved exactly, with an explicit warning for the known mislabel. The former Old Harbor, Ouzinkie and Port Lions routes are not newly generated until their identity/route data is separately curated. Legacy aircraft locations outside the five-airport network retain their raw saved identifiers and show no new work. The app does not silently move an aircraft or rewrite a pin to repair old geographic data. No user-approved reposition/location repair feature is included in this release.

## Separation of responsibilities

- `generator.ts` is a pure state transform. It has no storage, browser clock, provider fetching, report submission or financial transaction code. It selects curated templates and customers, validates loads, and returns persisted contract instances.
- `game.ts` owns acceptance, legacy migration, report submission and coordinated storage. Accepted contracts are copied snapshots, not lookups into a changing generator library. A final report pays that snapshot once; flight and assignment IDs both prevent duplicate generated payment. Drafts have no payment/movement/time effect.
- `missions.ts` keeps old definitions so existing saves and old logbook entries remain readable. They are not the selectable board for new companies. Compatibility tests construct pre-v0.5 accepted-save shapes rather than reintroducing selectable fixed contracts.
- The original single-document save, IndexedDB/Web Locks coordination, revision/snapshot checks and JSON backup remain in use. The seed/counter, all boards, repetition memory and active snapshot save in the same document as cash, reports and logbook.
- Real NOAA/FAA retrieval remains separate. Their real-world timestamps do not drive dispatch refresh. EFB/Flight Operations resolve the stored active assignment rather than looking up fixed IDs. Server imports/Node 24 packaging remain unchanged.

## Constraints and limitations

The generator is deterministic per saved seed, event sequence, location and operational slot; new-company seed creation itself is cryptographically random. Assignment serials are never reused. Cancellations retire instances, and a completed instance cannot be accepted or paid again. Offers and accepted work are snapshots; refreshing expired slots changes the available set, not an existing card's amount or text.

There are 21 storylines, 24 fictional brokerage/customer names, seven categories and grouped payload families. Only the last six reported assignments are excluded globally. This avoids immediate round-trip repetition, not all repetition forever. Unexpired cards are retained when arrival events top up a board, except when they conflict with newly recorded recent work. It is possible to have no offered return; advance operational time to another slot to look again. No real-time expiry, manual infinite-reroll button, dynamic demand economy or route-performance certification is implemented.

The loading budget, four-passenger cap and fuel allowance are deliberately conservative documented **planning assumptions**. They are not a substitute for actual Caravan payload/range/performance data. No hazardous cargo, medical-patient transport, installed equipment, ground handling, cold storage, runway suitability or navigation procedure is implied by a story or route. Payouts are fictional bounded game prices; generation never credits them.

`createDispatcherContext` is a detached/frozen data interface only. v0.5B conversational AI, API calls, dispatch negotiation and financial mutations through dialogue are not implemented.
