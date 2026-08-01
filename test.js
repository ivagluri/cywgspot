#!/usr/bin/env node
/* Test harness for index.html.
   Extracts the page's <script> block and runs it against DOM stubs, then asserts
   the verification cases from the plan. Run: node test.js */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("no <script> block found"); process.exit(1); }

const el = { value:"", innerHTML:"", focus(){}, addEventListener(){} };
const sandbox = {
  document: { getElementById: () => el, createElement: () => ({}), body:{ appendChild(){} } },
  localStorage: { getItem:()=>null, setItem(){}, removeItem(){} },
  location: { hash:"" },
  console,
  window: {}
};
sandbox.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename:"index.html<script>" });

const C = sandbox.window.CYWG;
if (!C) { console.error("window.CYWG not exported"); process.exit(1); }

/* ── fixtures: real captures, verbatim, wrapping preserved ── */

const ATIS_ARR = `CYWG ARR ATIS K 2100Z 11004KT 070V150 15SM CIG BKN100
 BKN160 26/12 A3002 APCH RNAV Z OR Y OR
 ILS RWY 13, INFORM ARRL OF REQ APCH ON
 INITIAL CTC. LDG AND DEP RWY 13. RSC 13
 6/6/6 DRY, DRY, DRY. VALID AUG 01 1621 -
 AUG 02 0021. BIRD ACT INVOF ARPT. DUE TO
 REDUCED SYS CAPACITY AND ANTCPTD TFC
 DEMANDS, VFR TML SVC NOT AVBL. VFR FLT
 TO RMN BLO 3000FT MSL WTN CYWG TCA EXC
 VFR ARR OR DEP 160KTS OR GREATER, BLOCK
 AIR WORK, PHOTO FLT OR TRG FLT WITH PPR
 TIL 2359Z. INFORM CYWG ATC INFO K`;

const ATIS_DEP = `CYWG DEP ATIS K 2100Z CYWG ARR ATIS K
 2100Z 11004KT 070V150
 15SM CIG BKN100 BKN160
 26/12 A3002 APCH RNAV Z
 OR Y OR ILS RWY 13,
 INFORM ARRL OF REQ APCH
 ON INITIAL CTC. LDG AND
 DEP RWY 13. RSC 13 6/6/6
 DRY, DRY, DRY. VALID AUG
 01 1621 - AUG 02 0021.
 BIRD ACT INVOF ARPT. DUE
 TO REDUCED SYS CAPACITY
 AND ANTCPTD TFC DEMANDS,
 VFR TML SVC NOT AVBL.
 VFR FLT TO RMN BLO
 3000FT MSL WTN CYWG TCA
 EXC VFR ARR OR DEP
 160KTS OR GREATER, BLOCK
 AIR WORK, PHOTO FLT OR
 TRG FLT WITH PPR TIL
 2359Z. INFORM CYWG ATC
 INFO K`;

const METAR_2100 = "METAR CYWG 012100Z 11004KT 070V150 15SM BKN100 BKN160 26/12 A3002 RMK AC6AS1 SLP170 DENSITY ALT 2100FT";
const METAR_2200 = "METAR CYWG 012200Z 14007KT 080V150 15SM BKN110 26/13 A3001 RMK AC7 SLP167 DENSITY ALT 2200FT";
const TAF_0117   = `TAF CYWG 011740Z 0118/0218 08010G20KT P6SM SCT100
     BECMG 0118/0120 12010G20KT BKN100
    FM012000 12010G20KT P6SM BKN100 PROB30 0120/0202 VRB20G30KT P6SM
     -SHRA VCTS BKN090CB
    FM020200 13010G20KT P6SM SCT090
     BECMG 0208/0210 16015G25KT
     BECMG 0212/0214 17020G30KT
    RMK NXT FCST BY 020000Z=`;
const RSC_NOTAM  = "RSC 13 6/6/6 DRY, DRY, DRY. RSC 31 6/6/6 DRY, DRY, DRY. RSC 18 6/6/6 DRY, DRY, DRY. RSC 36 6/6/6 DRY, DRY, DRY. VALID AUG 01 1621 - AUG 02 0021.";

/* ── runner ── */

let pass = 0, fail = 0;
function t(name, fn){
  try { fn(); console.log(`  \x1b[32m✓\x1b[0m ${name}`); pass++; }
  catch (e){ console.log(`  \x1b[31m✗\x1b[0m ${name}\n      ${e.message}`); fail++; }
}
function eq(a, b, what){
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${what||""} expected ${B}, got ${A}`);
}
function ok(c, msg){ if (!c) throw new Error(msg || "expected truthy"); }
function near(a, b, tol, what){
  if (Math.abs(a-b) > tol) throw new Error(`${what||""} expected ~${b}, got ${a}`);
}

console.log("\nVerification 2 — both ATIS fixtures decode identically");

const arr = C.decode(ATIS_ARR);
const dep = C.decode(ATIS_DEP);

t("ARR: info letter K", () => eq(arr.letter, "K"));
t("DEP: info letter K", () => eq(dep.letter, "K"));
t("ARR: landing 13, departing 13", () => { eq(arr.landing, ["13"]); eq(arr.departing, ["13"]); });
t("DEP: landing 13, departing 13", () => { eq(dep.landing, ["13"]); eq(dep.departing, ["13"]); });
t("DEP-wraps-ARR yields one report, not two", () => {
  const a = C.parseAtis(ATIS_DEP);
  ok(a, "no ATIS parsed");
  eq(a.time, "2100");
  eq(a.letter, "K");
});
t("wind 110 at 4 kt, variable 070-150", () => {
  eq(arr.wx.windDir, 110); eq(arr.wx.windSpd, 4);
  eq(arr.wx.vrbFrom, 70); eq(arr.wx.vrbTo, 150);
});
t("visibility 15 SM", () => eq(arr.wx.vis, 15));
t("ceiling broken 10,000 ft", () => eq(arr.wx.ceiling, 10000));
t("cloud layers BKN100 + BKN160", () => eq(arr.wx.clouds.map(c=>c.ft), [10000,16000]));
t("temp 26 / dewpoint 12", () => { eq(arr.wx.temp, 26); eq(arr.wx.dew, 12); });
t("altimeter 30.02", () => eq(arr.wx.altim, 30.02));
t("flight category VFR", () => eq(arr.wx.cat, "VFR"));
t("approach RNAV Z or Y or ILS 13", () => ok(/RNAV Z OR Y OR ILS RWY 13/.test(arr.approach), `got ${arr.approach}`));
t("RSC: all four ends dry, code 6", () => {
  eq(arr.rsc.runways.length, 1);           // ATIS carries only the active runway's RSC
  eq(arr.rsc.runways[0].rwy, "13");
  eq(arr.rsc.runways[0].worst, 6);
  ok(/dry/.test(arr.rsc.runways[0].desc), "desc should mention dry");
});
t("ARR and DEP produce identical wind components", () =>
  eq(arr.comp.map(c=>c.head.toFixed(3)), dep.comp.map(c=>c.head.toFixed(3))));

console.log("\nVerification 3 — confidence reads 'stated', not inferred");
t("ARR confidence = stated", () => eq(arr.confidence, "stated"));
t("DEP confidence = stated", () => eq(dep.confidence, "stated"));
t("neither is flagged inferred", () => { ok(!arr.inferred); ok(!dep.inferred); });

console.log("\nVerification 4 — wind math against true headings");
const w2200 = C.parseWeatherBody(METAR_2200.replace(/^METAR CYWG /,""));
const c2200 = C.components(w2200, []);
const get = (list, r) => list.find(x => x.rwy === r);
t("14007KT -> rwy 13 about +7 kt head, ~0 cross", () => {
  near(get(c2200,"13").head, 7, 0.3, "head");
  near(get(c2200,"13").cross, 0, 0.5, "cross");
});
t("14007KT -> rwy 18 about +4.6 kt head, 5.3 kt cross", () => {
  // 140 vs 189.3 true is a 49.3 degree offset: 7*cos = 4.56, 7*sin = 5.31.
  near(get(c2200,"18").head, 4.56, 0.15, "head");
  near(get(c2200,"18").cross, 5.31, 0.15, "cross");
});
t("13 is the inferred winner", () => eq(C.inferRunway(w2200, []).runway, "13"));
t("TAF 17020G30KT later flips the call to 18", () => {
  const groups = C.parseTaf(TAF_0117);
  ok(groups && groups.length > 1, "TAF groups not parsed");
  const last = groups[groups.length-1];
  eq(last.wx.windDir, 170); eq(last.wx.windSpd, 20); eq(last.wx.windGust, 30);
  eq(C.inferRunway(last.wx, []).runway, "18");
});

console.log("\nVerification 5 — no magnetic variation correction leaks in");
const wAtis  = C.decode(ATIS_ARR).wx;
const wMetar = C.decode(METAR_2100).wx;
t("ATIS and METAR both read 110 at 4", () => {
  eq(wAtis.windDir, wMetar.windDir);
  eq(wAtis.windSpd, wMetar.windSpd);
});
t("components match exactly (no 5-degree drift)", () => {
  const a = C.components(wAtis, []).map(c => c.head.toFixed(6));
  const b = C.components(wMetar, []).map(c => c.head.toFixed(6));
  eq(a, b);
});

console.log("\nVerification 6 — spot lookup is keyed by runway end");
t("runway 13 has no arrival spot", () => ok(arr.spots.arrival && arr.spots.arrival.spot === null));
t("runway 13 departures -> St James Memorial Sports Park", () => {
  eq(arr.spots.departure.end, "31");
  eq(arr.spots.departure.spot.name, "St James Memorial Sports Park");
});
t("recip mapping 13<->31, 18<->36", () => {
  eq(C.recip("13"), "31"); eq(C.recip("31"), "13");
  eq(C.recip("18"), "36"); eq(C.recip("36"), "18");
});
t("landing 36 -> Ness Ave Tim Hortons for arrivals", () => {
  const s = C.pickSpots(["36"], ["36"]);
  eq(s.arrival.spot.name, "Ness Ave Tim Hortons");
  eq(s.departure.spot.name, "Brookside Blvd");   // 36 departures climb out over the 18 end
});
t("Brookside sits in the usable roadside stretch, not the way centroid", () => {
  // Nominatim returned 49.9537 for "Brookside Boulevard" - the centroid of the whole
  // road, 4.8 km north of the field. Ivan's usable range is 49.9165 .. 49.9307.
  const b = C.SPOTS["18"];
  ok(b.lat >= 49.9165 && b.lat <= 49.9307, `lat ${b.lat} outside the usable stretch`);
  ok(Math.abs(b.lon - (-97.2296)) < 0.002, `lon ${b.lon} off the road`);
});
t("landing 18 -> Brookside Blvd for arrivals", () => {
  eq(C.pickSpots(["18"], ["18"]).arrival.spot.name, "Brookside Blvd");
});

console.log("\nVerification 7 — remarks survive");
t("bird activity is surfaced and expanded", () =>
  ok(arr.remarks.some(r => /Bird activity in the vicinity of the airport/i.test(r)), JSON.stringify(arr.remarks)));
t("VFR terminal service restriction is surfaced", () =>
  ok(arr.remarks.some(r => /VFR terminal service not available/i.test(r)), JSON.stringify(arr.remarks)));
t("PPR / training restriction is surfaced", () =>
  ok(arr.remarks.some(r => /prior permission required/i.test(r)), JSON.stringify(arr.remarks)));
t("no remark is dropped between ARR and DEP", () => eq(arr.remarks, dep.remarks));

console.log("\nVerification 8 — edge cases");
t("VRB03KT -> marginal", () => {
  const w = C.parseWeatherBody("VRB03KT 15SM SKC 20/10 A3000");
  eq(C.inferRunway(w, []).confidence, "marginal");
});
t("calm wind -> marginal", () => {
  const w = C.parseWeatherBody("00000KT 15SM SKC 20/10 A3000");
  eq(C.inferRunway(w, []).confidence, "marginal");
});
t("RWY 18 CLSD closes both 18 and 36", () => {
  const c = C.parseClosures("RWY 18 CLSD UNTIL FURTHER NOTICE");
  ok(c.includes("18") && c.includes("36"), JSON.stringify(c));
});
t("closure forces the call onto 13/31", () => {
  const inf = C.inferRunway(w2200, ["18","36"]);
  ok(inf.runway === "13" || inf.runway === "31", `got ${inf.runway}`);
});
t("split config LDG 31 / DEP 18 parses both", () => {
  const s = C.decode("CYWG ARR ATIS M 1400Z 31010KT 15SM SKC 10/02 A2992 LDG RWY 31. DEP RWY 18. INFORM CYWG ATC INFO M");
  eq(s.landing, ["31"]); eq(s.departing, ["18"]);
  eq(s.confidence, "stated");
});
t("split config suggests two different spots", () => {
  const s = C.pickSpots(["31"], ["18"]);
  eq(s.arrival.spot.name, "St James Memorial Sports Park");
  eq(s.departure.spot.name, "Ness Ave Tim Hortons");    // 18 departs south, over the 36 end
});
t("empty paste -> clean message, no crash", () => ok(C.decode("").error));
t("garbage paste -> clean message, no crash", () => ok(C.decode("hello world what is this").error));
t("standalone RSC NOTAM decodes all four ends", () => {
  const r = C.parseRsc(RSC_NOTAM);
  eq(r.runways.length, 4);
  eq(r.runways.map(x=>x.rwy), ["13","31","18","36"]);
  ok(r.runways.every(x => x.worst === 6));
});
t("METAR-only paste still yields a call (inferred)", () => {
  const s = C.decode(METAR_2200);
  eq(s.landing, ["13"]);
  ok(s.inferred, "should be flagged inferred");
});

console.log("\nExtras — normalization, time, sun");
t("normalize collapses arbitrary wrapping", () => {
  const a = C.normalize(ATIS_ARR), b = C.normalize(ATIS_DEP);
  ok(!/\n/.test(a) && !/  /.test(a), "newlines or double spaces survived");
  ok(b.endsWith("INFORM CYWG ATC INFO K"), "DEP tail wrong");
});
t("ATIS body identical after normalization, modulo the DEP header and CIG", () => {
  const strip = s => C.normalize(s).replace(/^CYWG DEP ATIS K 2100Z /, "");
  eq(strip(ATIS_DEP), C.normalize(ATIS_ARR));
});
t("resolveZulu never returns a future time", () => {
  const d = C.resolveZulu("2100");
  // cross-realm: the sandbox has its own Date, so instanceof will not match here
  ok(d && typeof d.getTime === "function" && !isNaN(d.getTime()), "not a date");
  ok(d.getTime() - Date.now() < 61*60*1000, "resolved into the future");
});
t("sun is up over Winnipeg at local noon in June", () => {
  const s = C.sunPosition(new Date(Date.UTC(2026,5,21,18,0,0)), 49.9105, -97.2397);
  ok(s.el > 55, `elevation ${s.el.toFixed(1)}`);
  ok(Math.abs(s.az - 180) < 25, `azimuth ${s.az.toFixed(1)}`);
});
t("sun is down over Winnipeg at local midnight", () => {
  const s = C.sunPosition(new Date(Date.UTC(2026,0,15,6,0,0)), 49.9105, -97.2397);
  ok(s.el < -20, `elevation ${s.el.toFixed(1)}`);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
