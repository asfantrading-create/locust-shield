// Locust Shield – daily runner for King Abdullah International Gardens.
// Runs the same model as the web page on live data, writes a report and sends an alert.
// Usage:  node daily-run.mjs            (Node.js 18 or newer)
//         node daily-run.mjs --test     (sends a test alert whatever the level)
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;
for (const f of ["base-data.js", "engine.js", "config.js"]) vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf8"), { filename: f });
const E = globalThis.LocustEngine, C = globalThis.LocustConfig, S = globalThis.SNAP;
const TEST = process.argv.includes("--test");

const cfgPath = fs.existsSync(path.join(dir, "alert-config.json")) ? "alert-config.json" : "alert-config.example.json";
const cfg = JSON.parse(fs.readFileSync(path.join(dir, cfgPath), "utf8"));
const LEVEL_NAMES = ["أخضر – مراقبة روتينية", "أصفر – حذر", "برتقالي – تهديد", "أحمر – خطر"];
const WHY = { p48: "وصول مرجّح خلال 48 ساعة", p7: "وصول محتمل خلال أسبوع", pH: "مسارات واصلة ضمن أفق التنبؤ", season: "موسم الخطر يقترب ونموذج التكاثر يتوقع أسراباً", calm: "لا أسراب مرجّحة والرياح لا تتجه نحو الرياض" };

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
    catch (e) { if (i === 2) throw e; await new Promise(res => setTimeout(res, 5000)); }
  }
}
function decodeForecast(a) {
  const times = a[0].hourly.time, nt = times.length, keys = ["ecmwf_ifs025", "gfs_seamless", "icon_seamless"];
  const n = a.length * nt, U = keys.map(() => new Float32Array(n)), V = keys.map(() => new Float32Array(n)), T = new Float32Array(n), valid = keys.map(() => 0);
  a.forEach((p, pi) => {
    const h = p.hourly;
    for (let k = 0; k < nt; k++) {
      const idx = pi * nt + k; let ts = 0, tn = 0;
      keys.forEach((m, mi) => {
        const s = h["wind_speed_925hPa_" + m][k], d = h["wind_direction_925hPa_" + m][k];
        if (s == null || d == null) { U[mi][idx] = NaN; V[mi][idx] = NaN; }
        else { U[mi][idx] = -s * Math.sin(d * Math.PI / 180); V[mi][idx] = -s * Math.cos(d * Math.PI / 180); valid[mi] = Math.max(valid[mi], k + 1); }
        const t = h["temperature_2m_" + m][k]; if (t != null) { ts += t; tn++; }
      });
      T[idx] = tn ? ts / tn : 20;
    }
  });
  return E.makeGrid({ t0: Date.parse(times[0] + ":00Z"), nt, u: U, v: V, T, valid, names: ["ECMWF", "GFS", "ICON"] });
}
function decodeSeasonal(arr) {
  const P = [], T = [];
  for (const p of arr) {
    const d = p.daily, mem = Object.keys(d).filter(k => k.startsWith("precipitation_sum_member")).map(k => k.slice(18));
    const PP = [], TT = [];
    for (const m of mem) {
      const pr = d["precipitation_sum_" + m], tx = d["temperature_2m_max_" + m], tn = d["temperature_2m_min_" + m];
      let last = 0; for (let i = 0; i < pr.length; i++) if (pr[i] != null && tx[i] != null) last = i + 1;
      const pp = [], tt = [];
      for (let q = 0; q + 5 <= last; q += 5) { let ps = 0, ts = 0; for (let i = q; i < q + 5; i++) { ps += pr[i]; ts += (tx[i] + tn[i]) / 2; } pp.push(ps); tt.push(ts / 5); }
      PP.push(pp); TT.push(tt);
    }
    const n = Math.min(...PP.map(x => x.length)); P.push(PP.map(x => x.slice(0, n))); T.push(TT.map(x => x.slice(0, n)));
  }
  return { t0: Date.parse(arr[0].daily.time[0] + "T00:00Z"), P, T };
}

async function main() {
  const lats = [], lons = [];
  for (const la of C.GRID_LATS) for (const lo of C.GRID_LONS) { lats.push(la); lons.push(lo); }
  const pts = C.SOURCES.concat([C.KAIG]), PL = pts.map(p => p.lat).join(","), PO = pts.map(p => p.lon).join(",");
  console.log("Fetching forecast winds (ECMWF, GFS, ICON)…");
  const grid = decodeForecast(await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lons.join(",")}&hourly=wind_speed_925hPa,wind_direction_925hPa,temperature_2m&models=ecmwf_ifs025,gfs_seamless,icon_seamless&forecast_days=16&temporal_resolution=hourly_3&timezone=GMT&wind_speed_unit=kmh`));
  console.log("Fetching rain at breeding areas…");
  const rj = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${PL}&longitude=${PO}&daily=precipitation_sum&past_days=60&forecast_days=16&timezone=GMT`);
  const today = new Date(grid.t0).toISOString().slice(0, 10);
  const rain = rj.map(p => { const i = p.daily.time.indexOf(today); const ps = p.daily.precipitation_sum.map(x => x || 0); return { past: ps.slice(0, i).reduce((a, b) => a + b, 0), next: ps.slice(i).reduce((a, b) => a + b, 0) }; });
  let seas = null;
  try { console.log("Fetching seasonal forecast (ECMWF SEAS5)…"); seas = decodeSeasonal(await getJSON(`https://seasonal-api.open-meteo.com/v1/seasonal?latitude=${PL}&longitude=${PO}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&forecast_days=210`)); }
  catch (e) { console.log("Seasonal forecast unavailable, using embedded snapshot:", e.message); seas = { t0: Date.parse(S.seas.t0 + "T00:00Z"), P: S.seas.P, T: S.seas.T }; }

  const land = E.makeLand(S.geo, C.BBOX), ndvi = E.makeNdvi(E.u8(S.ndvi.now.b64), S.ndviGrid);
  const h0 = Math.max(0, Math.min(grid.hours - 48, Math.floor((Date.now() - grid.t0) / 3600e3)));
  const month = new Date(grid.t0 + h0 * 3600e3).getUTCMonth();
  /* live FAO Desert Locust observations (CC BY 4.0), last 120 days */
  let obs = [];
  try {
    console.log("Fetching FAO locust observations…");
    const sql = "SELECT lat, lon, start_date, category, country_name, location_name FROM `fao-maps.fao_locusts.vw_locusts_master` WHERE category IN ('SWARM','ADULT','HOPPER','BAND') AND lat BETWEEN 4 AND 34 AND lon BETWEEN 24 AND 60 AND start_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 120 DAY) ORDER BY start_date DESC";
    const r = await fetch("https://api.data.apps.fao.org/api/v2/bigquery?query=" + encodeURIComponent(sql), { signal: AbortSignal.timeout(120000) });
    const rows = E.parseCSV(await r.text()), hd = rows[0] || [], ix = k => hd.indexOf(k), code = { SWARM: "S", BAND: "B", HOPPER: "H", ADULT: "A" };
    obs = rows.slice(1).map(x => ({ lat: +x[ix("lat")], lon: +x[ix("lon")], d: x[ix("start_date")], c: code[x[ix("category")]], n: x[ix("country_name")], l: x[ix("location_name")] })).filter(o => o.c && isFinite(o.lat)).map(o => Object.assign(o, { t: Date.parse(o.d + "T12:00Z") }));
  } catch (e) { console.log("FAO observations unavailable:", e.message); obs = ((S.fao && S.fao.obs) || []).map(o => Object.assign({}, o, { t: Date.parse(o.d + "T12:00Z") })); }
  const tStart = grid.t0 + h0 * 3600e3, recent = (days, cats) => obs.filter(o => cats.includes(o.c) && tStart - o.t <= days * 864e5 && o.t - tStart <= 864e5);
  /* FAO level: configured value, raised automatically by what FAO reported in the last 30 days */
  const order = ["calm", "caution", "threat", "danger"], r30 = recent(30, ["S", "B", "H", "A"]).filter(o => o.lat >= 8 && o.lon >= 30), cnt = c => r30.filter(o => o.c === c).length;
  const sug = cnt("S") >= 10 ? "danger" : (cnt("S") > 0 || cnt("B") >= 5) ? "threat" : (cnt("B") > 0 || cnt("H") >= 5 || cnt("A") >= 30) ? "caution" : "calm";
  const fao = order[Math.max(order.indexOf(cfg.faoLevel || "calm"), order.indexOf(sug))];
  const boost = (s) => recent(45, ["B", "H", "A"]).reduce((b, o) => E.distKm(o.lat, o.lon, s.lat, s.lon) > 300 ? b : Math.max(b, o.c === "B" ? 0.35 : o.c === "H" ? 0.2 : 0.06), 0);
  const sources = C.SOURCES.map((s, i) => ({ lat: s.lat, lon: s.lon, name: s.ar, p: Math.max(boost(s), E.LEVEL_F[fao] * E.SEASON[s.s][month] * E.ecoFactor(ndvi.around(s.lat, s.lon, 60), rain[i].past, rain[i].next)) }));
  const seenSw = new Set(); for (const o of recent(10, ["S"])) { const k = Math.round(o.lat * 2) + ":" + Math.round(o.lon * 2) + ":" + o.d; if (seenSw.has(k) || seenSw.size >= 25) continue; seenSw.add(k); sources.push({ lat: o.lat, lon: o.lon, p: 1, n: 30, spread: 0.1, name: "سرب رصدته الفاو: " + (o.l || o.n) + " (" + o.d + ")" }); }
  /* confirmed reports from a CSV file (FAO Locust Hub export or Weqaa) */
  if (cfg.reportsCsv && fs.existsSync(path.resolve(dir, cfg.reportsCsv))) {
    const t0 = grid.t0 + h0 * 3600e3;
    const rep = E.reportsFromCSV(fs.readFileSync(path.resolve(dir, cfg.reportsCsv), "utf8")).items.filter(r => r.t == null || (t0 - r.t <= 10 * 864e5 && r.t - t0 <= 864e5));
    rep.forEach(r => sources.push({ lat: r.lat, lon: r.lon, p: 1, n: 45, spread: 0.1, name: "بلاغ مؤكد: " + (r.name || r.lat.toFixed(1) + "," + r.lon.toFixed(1)) }));
    console.log(`Confirmed reports in model: ${rep.length}`);
  }
  const sim = E.simulate({ grid, land, ndvi, target: C.KAIG, h0, sources, models: [0, 1, 2], opts: { nmem: 60 } });
  const ts = E.summarize(sim);
  /* evidence-based closeness to swarms (5 days) and hopper bands (30 days), calibrated on FAO data 2004–2026 */
  const nearest = list => list.length ? list.reduce((m, o) => Math.min(m, E.distKm(C.KAIG.lat, C.KAIG.lon, o.lat, o.lon)), Infinity) : null;
  const dS = nearest(recent(5, ["S"])), dB = nearest(recent(30, ["B"])), p7 = E.proxProb(C.PROX, dS, dB);
  const sum = Object.assign({}, ts, E.combine(ts, p7, sim.steps));
  const sr = E.seasonRisk(C, seas, rain, fao);
  const soon = Math.max(...sr.months.slice(1, 3).map(m => m.risk), 0);
  const level = E.level(sum, { seasonSoon: soon });

  /* report */
  const stamp = new Date().toISOString().slice(0, 16).replace(":", "");
  const fmt = x => x < 0.001 ? "< 0.1%" : (x * 100).toFixed(x < 0.1 ? 1 : 0) + "%";
  const top = sim.list.filter(x => x.contrib > 0).sort((a, b) => b.contrib - a.contrib).slice(0, 3);
  const lines = [
    `درع الجراد – حدائق الملك عبدالله العالمية`,
    `المستوى: ${LEVEL_NAMES[level.i]} (${WHY[level.why]})`,
    `احتمال الوصول: 48 ساعة ${fmt(sum.P2)} · 7 أيام ${fmt(sum.P7)} · 16 يوماً ${fmt(sum.PH)}`,
    `منها: القرب من أسراب قائمة ${fmt(p7)}${dS != null ? ` (أقرب سرب على بعد ${Math.round(dS)} كم)` : ""} · مسارات الرياح ${fmt(ts.P7)}`,
    `مشاهدات الفاو خلال 30 يوماً: ${cnt("S")} سرب، ${cnt("B")} شريط نطاط، ${cnt("H")} نطاط، ${cnt("A")} بالغ`,
    sum.eta !== null ? `أقرب وصول مرجّح بعد ${Math.round(sum.eta)} ساعة من «${sum.etaSrc.src.name}» (المدى ${Math.round(sum.eta10)}–${Math.round(sum.eta90)} ساعة)` : `لا وصول مرجّح ضمن أفق التنبؤ`,
    `نماذج الرياح التي ترى خطر وصول: ${sum.modelReach.filter(Boolean).length}/3 (ECMWF ${fmt(sum.modelP[0])}، GFS ${fmt(sum.modelP[1])}، ICON ${fmt(sum.modelP[2])})`,
    `الخطر الموسمي للأشهر القادمة: ${sr.months.map(m => `${m.key} ${Math.round(m.risk * 100)}`).join(" · ")}`,
    top.length ? `أكبر المصادر: ${top.map(x => `${x.src.name} (${fmt(x.contrib)})`).join("، ")}` : "",
    `مستوى الفاو المعتمد: ${fao} · ${new Date().toISOString()}`
  ].filter(Boolean);
  const text = lines.join("\n");
  fs.mkdirSync(path.join(dir, "reports"), { recursive: true });
  const report = { time: new Date().toISOString(), level: level.i, levelName: LEVEL_NAMES[level.i], reason: level.why, P48: sum.P2, P7: sum.P7, P16: sum.PH, proximity7: p7, nearestSwarmKm: dS, faoCounts30: { swarms: cnt("S"), bands: cnt("B"), hoppers: cnt("H"), adults: cnt("A") }, eta: sum.eta, etaRange: [sum.eta10, sum.eta90], models: { ECMWF: sum.modelP[0], GFS: sum.modelP[1], ICON: sum.modelP[2] }, seasonal: sr.months.map(m => ({ month: m.key, risk: m.risk })), fao, text };
  fs.writeFileSync(path.join(dir, "reports", `report-${stamp}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(dir, "reports", "latest.txt"), text + "\n");
  console.log("\n" + text + "\n");

  /* alert */
  const statePath = path.join(dir, "reports", "last-level.json");
  const prev = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")).level : null;
  fs.writeFileSync(statePath, JSON.stringify({ level: level.i, time: report.time }));
  const should = TEST || level.i >= (cfg.minLevel ?? 2) || (cfg.notifyOnChange !== false && prev !== null && prev !== level.i);
  if (should) await sendAlert(text);
  else console.log("No alert needed.");
}
async function sendAlert(text) {
  const tasks = [];
  if (cfg.webhookUrl) tasks.push(fetch(cfg.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) }).then(r => console.log("Webhook:", r.status)));
  if (cfg.telegram && cfg.telegram.botToken && cfg.telegram.chatId) tasks.push(fetch(`https://api.telegram.org/bot${cfg.telegram.botToken}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: cfg.telegram.chatId, text }) }).then(r => console.log("Telegram:", r.status)));
  if (!tasks.length) console.log("Alert due, but no webhookUrl or telegram is set in alert-config.json.");
  await Promise.allSettled(tasks);
}
main().catch(e => { console.error("Run failed:", e.message); process.exitCode = 9; });
