/* Locust Shield engine — pure model code shared by the web page and the daily command-line runner. */
(function (root) {
  "use strict";
  const E = {};
  const RAD = Math.PI / 180;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  E.clamp = clamp;

  /* ---------- utilities ---------- */
  E.rng = function (seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  E.gauss = function (r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  E.distKm = function (a, b, c, d) { const x = (d - b) * RAD * Math.cos((a + c) / 2 * RAD), y = (c - a) * RAD; return 6371 * Math.hypot(x, y); };
  function b64bytes(b64) {
    if (typeof atob === "function") { const s = atob(b64), out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  /* int8 base64 -> Float32Array, -128 = missing (NaN) */
  E.i8 = function (b64) {
    const by = b64bytes(b64), out = new Float32Array(by.length);
    for (let i = 0; i < by.length; i++) { const v = by[i] > 127 ? by[i] - 256 : by[i]; out[i] = v === -128 ? NaN : v; }
    return out;
  };
  E.u8 = b64bytes;

  /* ---------- wind grid (2.5° lat/lon, 3-hourly, one or more models) ---------- */
  E.makeGrid = function (o) {
    // o: {t0 (ms), nt, u:[Float32Array per model], v:[...], T:Float32Array, valid:[steps per model], names:[...]}
    const g = { t0: o.t0, nt: o.nt, lat0: 10, lon0: 30, d: 2.5, nlat: 10, nlon: 11, u: o.u, v: o.v, T: o.T, valid: o.valid || o.u.map(() => o.nt), names: o.names || o.u.map((_, i) => "m" + i) };
    g.nm = g.u.length;
    g.hours = (g.nt - 1) * 3;
    const npts = g.nlat * g.nlon;
    for (let m = 0; m < g.nm; m++) { E.fillGaps(g.u[m], npts, g.nt, g.valid[m]); E.fillGaps(g.v[m], npts, g.nt, g.valid[m]); }
    E.fillGaps(g.T, npts, g.nt, g.nt);
    return g;
  };
  /* fill missing time steps (NaN) per grid point by linear interpolation, holding the edges */
  E.fillGaps = function (a, npts, nt, upto) {
    for (let p = 0; p < npts; p++) {
      const o = p * nt; let last = -1;
      for (let k = 0; k < upto; k++) {
        if (!isNaN(a[o + k])) {
          if (last === -1 && k > 0) for (let j = 0; j < k; j++) a[o + j] = a[o + k];
          else if (last >= 0 && k - last > 1) for (let j = last + 1; j < k; j++) a[o + j] = a[o + last] + (a[o + k] - a[o + last]) * (j - last) / (k - last);
          last = k;
        }
      }
      if (last >= 0) for (let j = last + 1; j < upto; j++) a[o + j] = a[o + last];
    }
  };
  /* sample one field array with bilinear space + linear time */
  function samp(g, a, lat, lon, h) {
    const fx = clamp((lon - g.lon0) / g.d, 0, g.nlon - 1.0001), fy = clamp((lat - g.lat0) / g.d, 0, g.nlat - 1.0001);
    const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy;
    const fk = clamp(h / 3, 0, g.nt - 1.0001), k = fk | 0, ak = fk - k, nt = g.nt;
    const p00 = (iy * g.nlon + ix) * nt + k, p01 = p00 + nt, p10 = p00 + g.nlon * nt, p11 = p10 + nt;
    const w00 = (1 - ax) * (1 - ay), w01 = ax * (1 - ay), w10 = (1 - ax) * ay, w11 = ax * ay;
    const v0 = a[p00] * w00 + a[p01] * w01 + a[p10] * w10 + a[p11] * w11;
    if (ak === 0) return v0;
    const v1 = a[p00 + 1] * w00 + a[p01 + 1] * w01 + a[p10 + 1] * w10 + a[p11 + 1] * w11;
    return v0 + (v1 - v0) * ak;
  }
  E.sampleT = (g, lat, lon, h) => samp(g, g.T, lat, lon, h);
  /* wind for model m; falls back to the mean of models that still have data at hour h */
  E.wind = function (g, m, lat, lon, h, out) {
    out = out || { u: 0, v: 0 };
    const step = Math.ceil(h / 3 - 1e-9) + 1; // last time index needed, 1-based
    if (m >= 0 && step <= g.valid[m]) { out.u = samp(g, g.u[m], lat, lon, h); out.v = samp(g, g.v[m], lat, lon, h); return out; }
    let su = 0, sv = 0, n = 0;
    for (let i = 0; i < g.nm; i++) if (step <= g.valid[i]) { su += samp(g, g.u[i], lat, lon, h); sv += samp(g, g.v[i], lat, lon, h); n++; }
    if (!n) { const last = (Math.min(...g.valid) - 1) * 3; return E.wind(g, -1, lat, lon, last, out); }
    out.u = su / n; out.v = sv / n; return out;
  };

  /* ---------- land mask ---------- */
  E.makeLand = function (geo, bb, res) {
    res = res || 0.25;
    const W = Math.round((bb.E - bb.W) / res), H = Math.round((bb.N - bb.S) / res), L = new Uint8Array(W * H);
    const rings = [];
    for (const c of geo) for (const r of c.r) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); }
      rings.push({ r, x0, x1, y0, y1 });
    }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = bb.W + (i + .5) * res, y = bb.S + (j + .5) * res;
      for (const R of rings) {
        if (x < R.x0 || x > R.x1 || y < R.y0 || y > R.y1) continue;
        const r = R.r, n = r.length / 2; let c = false;
        for (let a = 0, b = n - 1; a < n; b = a++) {
          const xa = r[2 * a], ya = r[2 * a + 1], xb = r[2 * b], yb = r[2 * b + 1];
          if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c;
        }
        if (c) { L[j * W + i] = 1; break; }
      }
    }
    return function (lat, lon) {
      const i = Math.floor((lon - bb.W) / res), j = Math.floor((lat - bb.S) / res);
      if (i < 0 || j < 0 || i >= W || j >= H) return true;
      return L[j * W + i] === 1;
    };
  };

  /* ---------- NDVI raster (0.2°, row 0 = north) ---------- */
  E.makeNdvi = function (bytes, meta) {
    const f = function (lat, lon) {
      const i = Math.floor((lon - meta.W) / meta.res), j = Math.floor((meta.S + meta.h * meta.res - lat) / meta.res);
      if (i < 0 || j < 0 || i >= meta.w || j >= meta.h) return 0;
      return bytes[j * meta.w + i] / 250;
    };
    /* mean NDVI within a radius (km) */
    f.around = function (lat, lon, rkm) {
      let s = 0, n = 0; const dl = rkm / 111, dlo = rkm / (111 * Math.cos(lat * RAD));
      for (let y = lat - dl; y <= lat + dl; y += meta.res) for (let x = lon - dlo; x <= lon + dlo; x += meta.res) { s += f(y, x); n++; }
      return n ? s / n : 0;
    };
    f.bytes = bytes; f.meta = meta;
    return f;
  };

  /* ---------- swarm trajectory ensemble ---------- */
  E.DEFAULTS = { nmem: 60, arriveKm: 50, warnKm: 150, attractKm: 30, attractSpeed: 10, green: true, attract: true, flyStart: 8.5, flyEnd: 17.5, seaHours: 30, startSpread: 36, stopAtTarget: true, windScale: 1, thrMin: 16, thrRange: 5, greenMin: 0.25, greenGain: 2, greenMax: 0.5 };
  E.simulate = function (cfg) {
    const o = Object.assign({}, E.DEFAULTS, cfg.opts || {});
    const g = cfg.grid, land = cfg.land, ndvi = cfg.ndvi, tgt = cfg.target, h0 = cfg.h0 || 0;
    const steps = cfg.steps != null ? cfg.steps : g.hours - h0;
    const r = E.rng(cfg.seed || 20261013);
    const models = cfg.models || [...Array(g.nm).keys()];
    const extra = cfg.extraTargets || [];
    const w = { u: 0, v: 0 };
    const res = [];
    for (const src of cfg.sources) {
      const n = src.n || o.nmem;
      const S = { src, tracks: [], arr: [], warn: [], model: [], hits: extra.map(() => []), flown: [] };
      for (let m = 0; m < n; m++) {
        const mi = models[m % models.length];
        const tr = new Float32Array((steps + 1) * 2).fill(NaN);
        let lat = src.lat + E.gauss(r) * (src.spread != null ? src.spread : 0.25), lon = src.lon + E.gauss(r) * (src.spread != null ? src.spread : 0.25);
        const start = (src.start || 0) + Math.floor(r() * o.startSpread), kf = (0.7 + r() * 0.3) * o.windScale, thr = o.thrMin + r() * o.thrRange;
        let nx = 0, ny = 0, seaH = 0, arrived = null, warned = null, dead = false, restUntil = -1, dist = 0;
        const hit = extra.map(() => null);
        for (let s = 0; s <= steps; s++) {
          if (dead) continue;
          tr[2 * s] = lat; tr[2 * s + 1] = lon;
          if ((arrived !== null && o.stopAtTarget) || s < start || s === steps) continue;
          const h = h0 + s;
          const solar = ((h % 24) + lon / 15 + 24) % 24;
          const onLand = land(lat, lon);
          /* evening on green ground: the swarm may stay to feed through the next day */
          if (onLand && o.green && ndvi && solar >= o.flyEnd && solar < o.flyEnd + 1 && h >= restUntil) {
            const nd = ndvi(lat, lon);
            if (nd >= o.greenMin && r() < clamp((nd - o.greenMin) * o.greenGain, 0, o.greenMax)) restUntil = h + 24;
          }
          if (!onLand) { seaH++; if (seaH > o.seaHours) { dead = true; continue; } } else seaH = 0;
          const day = solar >= o.flyStart && solar < o.flyEnd;
          E.wind(g, mi, lat, lon, h, w);
          const T = E.sampleT(g, lat, lon, h);
          const sp = Math.hypot(w.u, w.v);
          const fly = onLand ? (day && T >= thr && sp < 50 && h >= restUntil) : true;
          if (!fly) continue;
          nx = 0.9 * nx + E.gauss(r) * 2.2; ny = 0.9 * ny + E.gauss(r) * 2.2;
          let dx = w.u * kf + nx, dy = w.v * kf + ny;
          if (tgt && o.attract) {
            const d = E.distKm(lat, lon, tgt.lat, tgt.lon);
            if (d < o.attractKm && d > 0.5) {
              const a = o.attractSpeed * (1 - d / o.attractKm);
              dx += a * (tgt.lon - lon) * 111 * Math.cos(lat * RAD) / d; dy += a * (tgt.lat - lat) * 111 / d;
            }
          }
          lat += dy / 111; lon += dx / (111 * Math.cos(lat * RAD));
          dist += Math.hypot(dx, dy);
          if (tgt) {
            const d = E.distKm(lat, lon, tgt.lat, tgt.lon);
            if (warned === null && d <= o.warnKm) warned = s + 1;
            if (arrived === null && d <= o.arriveKm) arrived = s + 1;
          }
          for (let k = 0; k < extra.length; k++) if (hit[k] === null && E.distKm(lat, lon, extra[k].lat, extra[k].lon) <= extra[k].r) hit[k] = s + 1;
          if (lat < -2 || lat > 40 || lon < 18 || lon > 66) dead = true;
        }
        S.tracks.push(tr); S.arr.push(arrived); S.warn.push(warned); S.model.push(mi); S.flown.push(dist);
        for (let k = 0; k < extra.length; k++) S.hits[k].push(hit[k]);
      }
      const a = S.arr.filter(x => x !== null).sort((x, y) => x - y);
      S.frac = a.length / n; S.first = a.length ? a[0] : null; S.median = a.length ? a[Math.floor(a.length / 2)] : null; S.last = a.length ? a[a.length - 1] : null;
      S.p = src.p; S.contrib = src.p * S.frac;
      res.push(S);
    }
    return { list: res, steps, h0, models };
  };
  /* probability that at least one swarm arrives by hour hh, optionally for one model only */
  E.probBy = function (sim, hh, model) {
    let q = 1;
    for (const S of sim.list) {
      let k = 0, n = 0;
      for (let i = 0; i < S.arr.length; i++) { if (model != null && S.model[i] !== model) continue; n++; if (S.arr[i] !== null && S.arr[i] <= hh) k++; }
      if (n) q *= 1 - S.p * k / n;
    }
    return 1 - q;
  };
  E.summarize = function (sim) {
    const days = Math.ceil(sim.steps / 24), cum = [], perModel = sim.models.map(() => []);
    for (let d = 0; d <= days; d++) {
      const hh = Math.min(d * 24, sim.steps);
      cum.push(E.probBy(sim, hh));
      sim.models.forEach((m, i) => perModel[i].push(E.probBy(sim, hh, m)));
    }
    const P = hh => E.probBy(sim, hh);
    /* arrival time spread among members of sources that matter */
    const times = [];
    for (const S of sim.list) if (S.p >= 0.02) S.arr.forEach(a => { if (a !== null) times.push(a); });
    times.sort((a, b) => a - b);
    let etaAny = null, etaAnySrc = null;
    for (const S of sim.list) if (S.first !== null && (etaAny === null || S.first < etaAny)) { etaAny = S.first; etaAnySrc = S; }
    let eta = null, etaSrc = null;
    for (const S of sim.list) if (S.first !== null && S.p >= 0.02 && (eta === null || S.first < eta)) { eta = S.first; etaSrc = S; }
    const q = f => times.length ? times[Math.min(times.length - 1, Math.floor(f * times.length))] : null;
    const modelP = sim.models.map(m => E.probBy(sim, sim.steps, m));
    const modelReach = sim.models.map(m => sim.list.some(S => S.p >= 0.02 && S.arr.some((a, i) => a !== null && S.model[i] === m)));
    return { cum, perModel, P2: P(48), P7: P(168), PH: P(sim.steps), eta, etaSrc, etaAny, etaAnySrc, eta10: q(0.1), eta50: q(0.5), eta90: q(0.9), modelP, modelReach };
  };
  E.LEVELS = ["green", "yellow", "orange", "red"];
  E.level = function (s, ctx) {
    if (s.P2 >= 0.25) return { i: 3, why: "p48" };
    if (s.P7 >= 0.2 || s.P2 >= 0.1) return { i: 2, why: "p7" };
    if (s.PH >= 0.05) return { i: 1, why: "pH" };
    if (ctx && ctx.seasonSoon >= 0.35) return { i: 1, why: "season" };
    return { i: 0, why: "calm" };
  };

  /* ---------- presence probability at a breeding area ---------- */
  E.SEASON = {
    winter: [1, .9, .6, .3, .1, .05, .05, .05, .1, .4, .8, 1],
    summer: [.05, .05, .05, .05, .1, .4, .9, 1, 1, .7, .3, .05],
    spring: [.3, .7, 1, 1, .8, .4, .1, .05, .05, .05, .1, .2],
    horn: [.8, .6, .7, .8, .6, .3, .2, .2, .3, .6, .8, .9]
  };
  E.LEVEL_F = { calm: .03, caution: .15, threat: .5, danger: .9 };
  /* greenness factor: satellite NDVI around the area plus recent rain */
  E.ecoFactor = function (ndviAround, rainPast, rainNext) {
    const fromRain = Math.min(1, (rainPast + 0.5 * rainNext) / 25);
    const fromNdvi = clamp((ndviAround - 0.08) / 0.17, 0, 1);
    return 0.15 + 0.85 * Math.max(fromRain, fromNdvi);
  };

  /* ---------- breeding life-cycle model (pentad steps) ---------- */
  E.POP = { egg: 210, hopper: 400, imm: 300, mult: 16, init: { calm: 1, caution: 4, threat: 40, danger: 300 }, swarmN: 150, groupN: 20 };
  E.popRun = function (P, T, o) {
    // P,T: pentad rain sums (mm) and mean temps (°C); o: {N0, M0}
    let N = o.N0, M = o.M0, coh = null; const out = new Float32Array(P.length);
    for (let i = 0; i < P.length; i++) {
      const p = P[i], t = T[i];
      M = M * Math.exp(-5 / 30) + p;
      const DD = Math.max(0, t - 15) * 5;
      if (!coh && N >= 0.5 && M >= 20 && t >= 18) coh = { st: 0, dd: 0, n: N, s: 1 };
      if (coh) {
        coh.dd += coh.st === 0 ? DD + 10 : DD;
        if (coh.st === 0 && coh.dd >= E.POP.egg) { coh.st = 1; coh.dd = 0; }
        else if (coh.st === 1) { coh.s *= M >= 10 ? 0.97 : 0.8; if (coh.dd >= E.POP.hopper) { coh.st = 2; coh.dd = 0; } }
        else if (coh.st === 2 && coh.dd >= E.POP.imm && M >= 10) { N = Math.min(1e5, Math.max(N, coh.n * E.POP.mult * coh.s)); coh = null; }
      }
      N *= M >= 10 ? 0.985 : 0.93;
      N = Math.max(N, 1);
      out[i] = N;
    }
    return out;
  };
  E.swarmIdx = N => clamp((Math.log10(N) - Math.log10(E.POP.groupN)) / (Math.log10(E.POP.swarmN * 2) - Math.log10(E.POP.groupN)), 0, 1);
  /* probability (fraction of ensemble members) that each source holds swarms, per calendar month */
  E.popOutlook = function (seasP, seasT, t0ms, init, M0) {
    const nm = seasP.length, np = seasP[0].length;
    const months = {}; // key "YYYY-MM" -> counts
    const runs = seasP.map((P, k) => E.popRun(P, seasT[k], { N0: init, M0 }));
    for (let i = 0; i < np; i++) {
      const d = new Date(t0ms + (i * 5 + 2) * 864e5); const key = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
      if (!months[key]) months[key] = { any: new Uint8Array(nm), sum: 0, n: 0, rain: 0 };
      for (let k = 0; k < nm; k++) { const s = E.swarmIdx(runs[k][i]); if (s >= 0.6) months[key].any[k] = 1; months[key].sum += runs[k][i]; months[key].n++; months[key].rain += seasP[k][i] / nm; }
    }
    return Object.keys(months).sort().map(key => { const m = months[key]; return { key, pSwarm: m.any.reduce((a, b) => a + b, 0) / nm, meanN: m.sum / m.n, rain: m.rain }; });
  };

  /* ---------- seasonal risk for the garden: breeding outlook × monthly wind transport ---------- */
  E.transportFor = function (C, i, m) {
    const T = C.TRANSPORT, sm = (row, k) => 0.25 * row[(k + 11) % 12] + 0.5 * row[k] + 0.25 * row[(k + 1) % 12];
    const direct = sm(T[i], m);
    const interior = Math.max(sm(T[9], m), sm(T[10], m), sm(T[11], m));
    const s = C.SOURCES[i].s;
    /* two-stage migration: coastal swarms move inland in Feb–May (FAO spring pattern) */
    const staged = (s === "winter" && m >= 1 && m <= 4) ? 0.5 * interior : ((s === "horn" || s === "summer") && m >= 1 && m <= 4) ? 0.25 * interior : 0;
    return Math.max(direct, staged);
  };
  E.seasonRisk = function (C, seas, rain, lvl) {
    const init = E.POP.init[lvl];
    const per = C.SOURCES.map((s, i) => E.popOutlook(seas.P[i], seas.T[i], seas.t0, init, rain[i].past * 0.5));
    const months = per[0].slice(0, 6).map(o0 => {
      const key = o0.key, m = +key.slice(5) - 1; let q = 1;
      const parts = C.SOURCES.map((s, i) => { const o = per[i].find(x => x.key === key); const p = o ? o.pSwarm : 0, tr = E.transportFor(C, i, m); q *= 1 - p * tr; return { p, tr, rain: o ? o.rain : 0 }; });
      return { key, m, y: +key.slice(0, 4), risk: 1 - q, parts };
    });
    return { months, init, lvl };
  };

  /* ---------- garden twin: hourly feeding model ---------- */
  E.twin = function (cfg) {
    // cfg: {zones:[{id,B,pal}], area, mat, stay, act:{pre,nets,dome,spray,noise}, garden}
    const garden = cfg.garden || 2.5;
    let L = Math.min(cfg.area, garden * 1.3);
    if (cfg.act.pre) L *= 0.5;
    if (cfg.act.noise) L *= 0.95;
    const L0 = L;
    const eatMult = cfg.mat === "imm" ? 1.25 : 1;
    const rem = {}, access = {};
    cfg.zones.forEach(z => { rem[z.id] = z.B; access[z.id] = z.covered ? 0.35 : 1; });
    cfg.zones.forEach(z => { if (z.id === "dome") access[z.id] = cfg.act.dome ? 0.02 : 0.35; });
    if (cfg.act.nets) cfg.zones.forEach(z => { if (z.nets) access[z.id] = 0.15; });
    const series = []; let eaten = 0, killed = 0, nights = 0, eggs = false;
    for (let h = 0; h <= 72; h++) {
      const lh = (16 + h) % 24;
      series.push({ h, L, rem: Object.assign({}, rem), eaten });
      if (h === 72) break;
      if (lh === 0 && h > 0) nights++;
      if (lh === 6 && cfg.act.spray && L > 0) { const k = L * 0.7; killed += k; L -= k; }
      if (lh === 22 && L > 0 && cfg.mat === "mat") eggs = true;
      if (lh === 10 && nights >= cfg.stay) L = 0;
      const feed = (lh >= 7 && lh < 11) || (lh >= 15 && lh < 18);
      if (feed && L > 0) {
        const demand = L * 100 / 7 * eatMult; let ws = 0; const w = {};
        cfg.zones.forEach(z => { w[z.id] = z.pal * access[z.id] * (rem[z.id] / z.B); ws += w[z.id]; });
        if (ws > 0) cfg.zones.forEach(z => { const e = Math.min(rem[z.id], demand * w[z.id] / ws); rem[z.id] -= e; eaten += e; });
        const accessible = cfg.zones.reduce((a, z) => a + rem[z.id] * access[z.id], 0);
        if (accessible < 15) L = 0;
      }
    }
    return { series, killed, eggs, L0, access };
  };
  /* economic loss (SAR) for a twin result */
  E.loss = function (zones, last) {
    let tot = 0; const per = {};
    for (const z of zones) { const f = 1 - last.rem[z.id] / z.B; per[z.id] = f * z.value * z.costF; tot += per[z.id]; }
    return { tot, per };
  };
  /* days until eggs hatch: ~210 degree-days above 15 °C in moist sand (soil ~3 °C warmer than air) */
  E.hatchDays = function (dailyMeanTemp) {
    let dd = 0, d = 0;
    while (dd < 210 && d < 150) { dd += Math.max(0, dailyMeanTemp(d) + 3 - 15); d++; }
    return d;
  };

  /* ---------- spray safety: drift direction and buffer checks ---------- */
  E.sprayCheck = function (wind, zones, sites, o) {
    // wind {u,v} km/h at dawn; positions in metres on the garden plan; o: {maxWind, minWind, buffer, drift}
    const sp = Math.hypot(wind.u, wind.v);
    const okWind = sp <= o.maxWind && sp >= o.minWind;
    const ux = sp ? wind.u / sp : 0, uy = sp ? wind.v / sp : 0; // toward which air moves (east, north)
    return zones.map(z => {
      let worst = "ok", why = null;
      for (const s of sites) {
        const dx = s.x - z.x, dy = s.y - z.y, d = Math.hypot(dx, dy);
        const along = d ? (dx * ux + dy * uy) / d : 0; // >0 : site lies downwind
        if (d < o.buffer) { worst = "no"; why = s; break; }
        if (along > 0.5 && d < o.drift) { worst = worst === "no" ? "no" : "care"; why = why || s; }
      }
      if (!okWind) worst = "no";
      return { id: z.id, status: worst, site: why, windOk: okWind, speed: sp };
    });
  };

  /* ---------- CSV parsing for swarm reports ---------- */
  E.parseCSV = function (text) {
    const rows = []; let i = 0, f = "", row = [], q = false;
    text = text.replace(/^﻿/, "");
    for (; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === "," || c === ";" || c === "\t") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ""));
  };
  E.reportsFromCSV = function (text) {
    const rows = E.parseCSV(text); if (rows.length < 2) return { items: [], error: "empty" };
    const head = rows[0].map(h => h.trim().toLowerCase());
    const find = names => head.findIndex(h => names.includes(h));
    const iLat = find(["lat", "latitude", "y", "point_y", "lat_dd", "خط العرض"]);
    const iLon = find(["lon", "long", "lng", "longitude", "x", "point_x", "lon_dd", "خط الطول"]);
    const iDate = find(["startdate", "date", "obs_date", "finishdate", "التاريخ"]);
    const iType = find(["type", "cat", "category", "locpresent", "النوع"]);
    const iName = find(["locname", "location", "place", "name", "الموقع"]);
    const iArea = find(["area", "area_km2", "swarm_area", "المساحة"]);
    if (iLat < 0 || iLon < 0) return { items: [], error: "nolatlon" };
    const items = [];
    for (const r of rows.slice(1)) {
      const lat = parseFloat(r[iLat]), lon = parseFloat(r[iLon]);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      let t = iDate >= 0 ? Date.parse(r[iDate]) : NaN;
      if (!isFinite(t) && iDate >= 0 && /^\d+$/.test((r[iDate] || "").trim())) t = +r[iDate];
      items.push({ lat, lon, t: isFinite(t) ? t : null, type: iType >= 0 ? r[iType] : "", name: iName >= 0 ? r[iName] : "", area: iArea >= 0 ? parseFloat(r[iArea]) || null : null });
    }
    return { items, error: items.length ? null : "norows" };
  };

  root.LocustEngine = E;
})(typeof window !== "undefined" ? window : globalThis);
