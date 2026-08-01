# CYWG Spotter

A single-page ATIS decoder for planning planespotting at Winnipeg (CYWG). Paste the
ATIS text you already have on your phone; it tells you which runway is active, **which
spot to drive to**, and what the conditions and restrictions are — with the aerodrome
drawn and the active runway highlighted.

No build step, no dependencies, no accounts, no API keys. One HTML file.

## Use it

Paste a `CYWG ARR ATIS` or `CYWG DEP ATIS` block into the box and hit **Decode**. Odd
line breaks, mid-word wrapping and all-caps are expected — paste it exactly as you
copied it.

METAR, TAF and RSC NOTAM text also work. A single ATIS paste is usually enough: it
already carries the weather, the runway in use, the surface condition report and the
remarks. Adding the TAF is the only thing that tells you anything new — it drives the
"Outlook" section that predicts a runway change later in the day.

Your last paste is remembered in `localStorage`, so reopening the page shows the last
decode without retyping. The observation age is displayed prominently and turns red
past 90 minutes.

## Deploy

Commit and enable GitHub Pages on the repo. That's the whole deployment.

Because the page makes **zero network requests**, it also works straight off the
filesystem and offline — useful at the fence with no signal. Save it to your phone's
home screen and it keeps working.

## Why paste, and not live fetch

This was researched before building, and the constraints are hard:

- **CYWG ATIS text is not machine-fetchable.** NAV CANADA decommissioned phone ATIS in
  March 2025 and moved text ATIS to NC-AeroView, which sits behind a Radware bot-block
  (403 to every automated request). atis.guru lists CYWG but returns "No ATIS
  available". Digital ATIS feeds are US-only.
- **No aviation weather API sends CORS headers.** NAV CANADA CFPS and
  aviationweather.gov both serve data to `curl` but omit `Access-Control-Allow-Origin`,
  and public proxies failed as well (allorigins 500, corsproxy.io 403). A GitHub Pages
  page cannot fetch any of them from the browser.
- **A GitHub Actions cron was considered and rejected.** Scheduled workflows are
  auto-disabled after 60 days of repository inactivity, and commits made by the
  workflow's own `GITHUB_TOKEN` don't reset that clock. On a repo you touch rarely it
  would die silently between sessions.

NC-AeroView blocks bots, not browsers, which is why it works fine in your phone's
browser while every automated probe fails. You are the transport.

## What it decodes

| Input | Extracted |
|---|---|
| D-ATIS | info letter, issue time, weather, approach in use, landing/departing runway, RSC, remarks |
| METAR / SPECI | wind (incl. `VRB`, gusts, variable range), visibility, cloud, temp/dewpoint, altimeter |
| TAF | `FM` / `BECMG` / `TEMPO` / `PROB` wind groups → predicted runway changes |
| RSC NOTAM | per-runway condition codes 0–6, contaminants, CRFI |
| NOTAM | runway closures — these override the wind-based call and grey the runway |

Runway closures beat inference. If a NOTAM closes a runway that the ATIS also names,
the page says so explicitly rather than silently picking one.

## Two things that are easy to get wrong

**Line wrapping is meaningless.** The real feed hard-wraps mid-report at an arbitrary
column, and the width differs between the ARR and DEP versions of the same cycle. All
input is whitespace-normalized before tokenizing. Never write a parser here that
respects line structure.

**These winds are true, not magnetic.** The CYWG D-ATIS embeds the METAR body verbatim
— the sample's `2100Z 11004KT 070V150 15SM CIG BKN100 BKN160 26/12 A3002` is
byte-identical to the METAR `012100Z 11004KT ...` apart from an inserted `CIG`. So no
magnetic-variation correction is applied, and the runway table stores true headings to
match. CYWG's variation is ~5°E, which applies only to *voice* ATIS and tower winds,
which this page never consumes. A test asserts the ATIS and METAR paths produce
identical components so a correction can't creep back in.

Also: the CYWG **DEP ATIS wraps the ARR ATIS verbatim** inside itself. The parser
detects the nested header and produces one report, not two.

## Spotting locations

Keyed by runway **end**, not runway. A spot off end E serves arrivals landing on E and
departures on the reciprocal climbing out over it — so three locations cover six
configurations.

| End | Location | Coords | Serves |
|---|---|---|---|
| 36 | Ness Ave Tim Hortons | 49.885906, -97.244374 | 36 arrivals, 18 departures |
| 31 | St James Memorial Sports Park | 49.8896, -97.2214 | 31 arrivals, 13 departures |
| 18 | Brookside Blvd | 49.923624, -97.229640 | 18 arrivals, 36 departures |
| 13 | *none known* | — | — |

Runway 13 has no known arrival spot; the page says so rather than inventing one, and
points you at St James park for 13 departures instead.

Notes on the coordinates:

- **Ness Ave Tim Hortons** lands within ~15 m of the extended 36 centreline, ~1.1 km
  south of the threshold. Directly under short final.
- **Brookside Blvd** is the midpoint of the usable roadside stretch (49.9307 to
  49.9165) — 187 m south of the 18 threshold and 327 m east, beside the field.
  Geocoding the road by name returns 49.9537, the centroid of the entire way, which is
  4.8 km north and wrong; a test guards against that regressing.

To add or move a spot, edit the `SPOTS` table near the top of the `<script>` block. The
diagram, legend and recommendations all derive from it.

## Sun

The page computes solar azimuth and elevation (NOAA algorithm, no dependency) and tells
you whether you'll be shooting into the sun from the recommended spot. Viewing bearing
is derived from the runway: for arrivals you look back down the approach, for
departures you look up the runway at aircraft coming toward you.

## Tests

```
node test.js
```

49 assertions run against the page's real parsing code, extracted from `index.html` and
executed with DOM stubs — no separate copy to drift out of sync. Fixtures are verbatim
captures from 2026-08-01 (ARR and DEP ATIS "K", two METARs, a TAF and an RSC NOTAM),
with their original wrapping preserved, since the wrapping is the point of several
tests.

## Caveats

- Planning aid only. Not for flight use.
- A split runway config (landing one runway, departing another) is handled and tested,
  but has never been seen in a real CYWG sample — the phrasing is parsed defensively
  and falls back to showing the raw text rather than guessing.
- When no ATIS is pasted, the runway is *inferred* from wind and clearly labelled as
  such, with a "could be either" flag on light or variable winds.
