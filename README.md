# CYWG Spotter

Single-page ATIS decoder for planespotting at Winnipeg (CYWG). Paste ATIS/METAR/TAF — it tells you the active runway, the best spotting location, conditions, RSC, remarks, and sun angle. One HTML file, zero dependencies, works offline.

**Live:** https://ivagluri.github.io/cywgspot/

---

## Quick start

1. Click **🔄 Fetch live ATIS from atis.guru** — pulls current ARR/DEP ATIS, METAR, TAF via a CORS-enabled proxy (r.jina.ai).
2. Click **Decode**.

**Or** paste any `CYWG ARR ATIS`, `CYWG DEP ATIS`, METAR, or TAF manually and hit **Decode**.

Last paste is saved to `localStorage`. Observation age turns red past 90 min.

---

## What it extracts

| Source | Decoded |
|--------|---------|
| D-ATIS | Info letter, time, weather, approach in use, landing/departing runway, RSC, remarks |
| METAR | Wind (VRB, gusts, variable), vis, clouds, temp/dewpoint, altimeter |
| TAF | FM/BECMG/TEMPO/PROB wind groups → predicted runway changes |
| RSC NOTAM | Per-runway 0–6 codes, contaminants, CRFI |
| NOTAM | Runway closures (override inference, grey the runway) |

Winds are **true** (METAR in D-ATIS is byte-identical to standalone METAR — no mag var correction). True headings in code match.

---

## Spotting locations

Keyed by runway **end** (spot off end E serves arrivals on E, departures on recip):

| End | Location | Serves |
|-----|----------|--------|
| 36 | Ness Ave Tim Hortons | 36 arr · 18 dep |
| 31 | St James Memorial Sports Park | 31 arr · 13 dep |
| 18 | Brookside Blvd (roadside) | 18 arr · 36 dep |
| 13 | *none known* | 13 arr → use St James for 13 dep |

---

## The jina.ai bridge

NAV CANADA NC-AeroView blocks bots (403). atis.guru has the data but no CORS. The page fetches via **https://r.jina.ai/http://atis.guru/atis/CYWG** — a free markdown extractor that sends `Access-Control-Allow-Origin: https://ivagluri.github.io`. Regex extracts the four sections from the returned markdown.

If the proxy ever dies, manual paste still works.

---

## Deploy

Push to GitHub, enable Pages. That's it. Also works as a raw file opened in-browser (except auto-fetch — CORS blocks `file://` origins).

---

## Caveats

- **Planning aid only — not for flight use.**
- Inferred runway (when no ATIS states it) is labelled "inferred from wind" with "could be either" on light/variable winds.
- Split configs (land 31 / dep 36) are parsed defensively; raw text shown if uncertain.
- Runway 13 has no known arrival spot.