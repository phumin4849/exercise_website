/* วัดสด – รับค่าจากเซนเซอร์ (หรือโหมดจำลอง) ตรวจจับการลงเท้าแต่ละก้าว แล้วสรุปเป็นเซสชัน
   รูปแบบข้อมูลต่อบรรทัด (side = L หรือ R, ไม่ใส่ก็ได้):
     [side,]ax,ay,az                       ความเร่ง (g)
     [side,]ax,ay,az,gx,gy,gz              + ไจโร (องศา/วินาที)
     [side,]ax,ay,az,gx,gy,gz,fsr          + แรงกดฝ่าเท้า (ค่า ADC ดิบ 0–4095)
     HR,bpm                                อัตราการเต้นหัวใจ (ถ้าต่อ MAX30102 ที่บอร์ด)
   หรือ JSON {"side":"L","ax":..,"ay":..,"az":..,"gx":..,"gy":..,"gz":..,"fsr":..} และ {"hr":72}
   หัวใจจากสายรัดอกเชื่อมตรงเข้าเบราว์เซอร์ผ่าน Web Bluetooth ได้ ไม่ต้องผ่านบอร์ด */
(function () {
  const G = 9.80665, START = 2.5, END = 1.5, REFRACT = 200; // เกณฑ์เริ่ม/จบการกระแทก (g) และช่วงพัก (ms)
  const S = { running: false, src: null, stop: null, t0: 0, unit: "g", defSide: "L", ui: null, raf: 0, hrStop: null, calTimer: 0, bw: IG.store.get("ig.cal", {}), calib: null };

  function reset() {
    const side = () => ({ on: false, peak: 0, tPeak: 0, tStart: 0, last: -1e9 });
    S.impacts = { L: [], R: [] };
    S.contacts = { L: [], R: [] };
    S.det = { L: side(), R: side() };
    S.cd = { L: { on: false, max: 0, t0: 0, peak: 0 }, R: { on: false, max: 0, t0: 0, peak: 0 } };
    S.roll = { L: { ang: 0, t: 0, buf: [] }, R: { ang: 0, t: 0, buf: [] } };
    S.pend = { L: [], R: [] };
    S.trace = [];
    S.hr = [];
    S.t0 = performance.now();
  }

  const romOf = (buf, a, b) => {
    const xs = buf.filter((p) => p.t >= a && p.t <= b).map((p) => p.a);
    return xs.length >= 5 ? Math.max(...xs) - Math.min(...xs) : null;
  };

  function feed(side, ax, ay, az, t, x = {}) {
    const k = S.unit === "ms2" ? 1 / G : 1;
    const m = Math.sqrt(ax * ax + ay * ay + az * az) * k;
    S.trace.push({ t, m });
    while (S.trace.length && t - S.trace[0].t > 6000) S.trace.shift();
    const d = S.det[side];
    if (!d) return;

    // ช่วงเอียงของเท้า (roll): ผสมไจโรกับมุมจากความเร่ง ใช้ "ช่วงที่แกว่ง" รอบการลงเท้า จึงไม่ขึ้นกับทิศการติดตั้งและไม่สะสมค่าคลาด
    if (x.gx != null && isFinite(x.gx)) {
      const r = S.roll[side], acc = (Math.atan2(ay, az) * 180) / Math.PI, dt = r.t ? Math.min((t - r.t) / 1000, 0.1) : 0;
      r.ang = r.t ? 0.98 * (r.ang + x.gx * dt) + 0.02 * acc : acc; r.t = t;
      r.buf.push({ t, a: r.ang });
      while (r.buf.length && t - r.buf[0].t > 600) r.buf.shift();
      const q = S.pend[side];
      while (q.length && t >= q[0].at) { const p = q.shift(); p.imp.rom = romOf(r.buf, p.from, p.at); }
    }

    // เวลาสัมผัสพื้นและแรงกดจาก FSR: เกณฑ์ปรับตามค่าสูงสุดล่าสุด
    if (x.fsr != null && isFinite(x.fsr)) {
      if (S.calib && S.calib.side === side) S.calib.vals.push(x.fsr);
      const c = S.cd[side]; c.max = Math.max(c.max * 0.9995, x.fsr);
      if (!c.on) { if (c.max > 150 && x.fsr > 0.3 * c.max) { c.on = true; c.t0 = t; c.peak = x.fsr; } }
      else {
        if (x.fsr > c.peak) c.peak = x.fsr;
        if (x.fsr < 0.2 * c.max) { c.on = false; const dur = t - c.t0; if (dur >= 80 && dur <= 700) S.contacts[side].push({ t, dur, peak: c.peak }); }
      }
    }

    if (!d.on) {
      if (m >= START && t - d.last > REFRACT) { d.on = true; d.peak = m; d.tPeak = t; d.tStart = t; }
    } else {
      if (m > d.peak) { d.peak = m; d.tPeak = t; }
      if (m <= END || t - d.tStart > 150) {
        d.on = false; d.last = t;
        const rise = Math.max(d.tPeak - d.tStart, 5); // ms จากจุดตัด 2.5 g ถึงยอด ความละเอียดขึ้นกับอัตราสุ่มตัวอย่าง
        const imp = { t, peak: d.peak, rate: ((d.peak - START) / rise) * 1000, rom: null };
        S.impacts[side].push(imp);
        if (x.gx != null) S.pend[side].push({ imp, from: d.tStart - 50, at: d.tStart + 150 });
      }
    }
  }

  function pushHr(bpm) { if (bpm >= 30 && bpm <= 230) S.hr.push({ t: performance.now(), bpm }); }

  function parseLine(l) {
    l = l.trim(); if (!l) return;
    const now = performance.now();
    try {
      if (l[0] === "{") {
        const o = JSON.parse(l);
        if (o.ax == null) return o.hr != null && pushHr(+o.hr);
        return feed(o.side === "R" ? "R" : o.side === "L" ? "L" : S.defSide, +o.ax, +o.ay, +o.az, now, { gx: o.gx, fsr: o.fsr });
      }
      const p = l.split(/[,\s;]+/);
      if (/^HR$/i.test(p[0])) return pushHr(+p[1]);
      let side = S.defSide;
      if (/^[LR]$/i.test(p[0])) side = p.shift().toUpperCase();
      const n = p.map(Number);
      if (!n.every(isFinite) || n.length < 3) return;
      feed(side, n[0], n[1], n[2], now, n.length >= 6 ? { gx: n[3], fsr: n.length >= 7 ? n[6] : undefined } : {});
    } catch (e) {}
  }

  /* โหมดจำลอง: จำลองเซนเซอร์ 2 ชุด (ซ้าย/ขวา) ~170 ก้าว/นาที ขวาแรงกว่าและเอียงมากกว่าซ้าย แรงค่อยๆ เพิ่มตามความล้า และหัวใจเพิ่มขึ้น */
  function startSim() {
    const t0 = performance.now(), off = { L: 0, R: 353 }, base = { L: 6.4, R: 7.2 }, roll = { L: 180, R: 215 }, cyc = { L: -1, R: -1 }, amp = { L: 6.4, R: 7.2 };
    let lastHr = 0;
    const id = setInterval(() => {
      const now = performance.now();
      for (let i = 0; i < 4; i++) { // 4 ตัวอย่างต่อ 20 ms ~ 200 Hz
        const t = now - (3 - i) * 5;
        ["L", "R"].forEach((sd) => {
          const u = t - t0 - off[sd], ph = ((u % 706) + 706) % 706, c = Math.floor(u / 706);
          if (c !== cyc[sd]) { cyc[sd] = c; amp[sd] = base[sd] * (1 + 0.0005 * ((t - t0) / 1000)) * (0.9 + Math.random() * 0.2); }
          let m = 1 + (Math.random() - 0.5) * 0.15;
          if (ph < 15) m += (amp[sd] - 1) * (ph / 15); else if (ph < 80) m += (amp[sd] - 1) * Math.exp(-(ph - 15) / 18);
          const stance = ph < 240;
          feed(sd, 0.1, 0.1, m, t, { gx: stance ? roll[sd] * Math.sin((2 * Math.PI * ph) / 240) : 0, fsr: stance ? 2800 * Math.sin((Math.PI * ph) / 240) * (0.95 + Math.random() * 0.1) : 0 });
        });
      }
      if (now - lastHr >= 1000) { lastHr = now; const el = (now - t0) / 1000; pushHr(Math.round(112 + 42 * (1 - Math.exp(-el / 70)) + (Math.random() - 0.5) * 4)); }
    }, 20);
    return async () => clearInterval(id);
  }

  async function startSerial(baud) {
    if (!("serial" in navigator)) throw new Error("เบราว์เซอร์นี้ไม่รองรับ Web Serial (ใช้ Chrome หรือ Edge บนคอมพิวเตอร์ ผ่าน localhost หรือ https)");
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: baud });
    const reader = port.readable.pipeThrough(new TextDecoderStream()).getReader();
    (async () => { let buf = ""; for (;;) { const { value, done } = await reader.read(); if (done) break; buf += value; const ls = buf.split("\n"); buf = ls.pop(); ls.forEach(parseLine); } })().catch(() => {});
    return async () => { try { await reader.cancel(); } catch (e) {} try { await port.close(); } catch (e) {} };
  }
  function startWs(url) {
    return new Promise((res, rej) => {
      const ws = new WebSocket(url);
      ws.onopen = () => res(async () => ws.close());
      ws.onerror = () => rej(new Error("เชื่อมต่อ WebSocket ไม่ได้ ตรวจที่อยู่และให้อุปกรณ์อยู่ในเครือข่ายเดียวกัน"));
      ws.onmessage = (e) => String(e.data).split("\n").forEach(parseLine);
      ws.onclose = () => S.running && stop(true);
    });
  }

  /* หัวใจจากสายรัดอก/นาฬิกาที่ส่ง Heart Rate Service มาตรฐานของ Bluetooth (Chrome/Edge บนคอมพิวเตอร์และ Android) */
  async function connectHr() {
    if (!navigator.bluetooth) throw new Error("เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth (ใช้ Chrome/Edge บนคอมพิวเตอร์หรือ Android; iPhone ใช้ไม่ได้)");
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
    const srv = await dev.gatt.connect();
    const ch = await (await srv.getPrimaryService("heart_rate")).getCharacteristic("heart_rate_measurement");
    await ch.startNotifications();
    ch.addEventListener("characteristicvaluechanged", (e) => { const v = e.target.value; pushHr(v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1)); });
    S.hrStop = () => { try { dev.gatt.disconnect(); } catch (e) {} S.hrStop = null; };
    return dev.name || "สายรัดอก";
  }

  /* ปรับเทียบแรงกด: ยืนนิ่งบนเท้าข้างที่ติดเซนเซอร์ 3 วินาที ค่าที่ได้ = 1 เท่าน้ำหนักตัว (FSR ไม่เป็นเส้นตรง ใช้เทียบเชิงสัมพัทธ์เท่านั้น) */
  function calibrate(side, done) {
    S.calib = { side, vals: [] };
    clearTimeout(S.calTimer);
    S.calTimer = setTimeout(() => {
      const v = S.calib.vals; S.calib = null;
      const mean = IG.mean(v);
      if (v.length > 50 && mean > 100) { S.bw[side] = mean; IG.store.set("ig.cal", S.bw); done(true, mean); } else done(false, 0);
    }, 3000);
  }

  const avg = (a, k) => (a.length ? IG.mean(a.map((x) => x[k])) : 0);
  const stepsEst = () => { const l = S.impacts.L.length, r = S.impacts.R.length; return l && r ? l + r : 2 * Math.max(l, r); }; // เซนเซอร์ข้างเดียว: นับข้างเดียวแล้วคูณสอง

  function summary(minutes) {
    const mk = (sd) => {
      const im = S.impacts[sd], ct = S.contacts[sd], roms = im.filter((i) => i.rom != null);
      const o = { peak: +avg(im, "peak").toFixed(2), rate: Math.round(avg(im, "rate")), steps: im.length };
      if (ct.length >= 5) o.contact = Math.round(avg(ct, "dur"));
      if (roms.length >= 5) o.roll = +avg(roms, "rom").toFixed(1);
      if (ct.length >= 5 && S.bw[sd]) o.force = +(avg(ct, "peak") / S.bw[sd]).toFixed(2);
      return o;
    };
    const all = [...S.impacts.L, ...S.impacts.R].sort((a, b) => a.t - b.t), n = all.length, th = Math.floor(n / 3);
    const fatigue = n >= 30 ? +(avg(all.slice(-th), "peak") / avg(all.slice(0, th), "peak") - 1).toFixed(3) : null;
    const hr = S.hr.length >= 3 ? { avg: Math.round(avg(S.hr, "bpm")), max: Math.max(...S.hr.map((h) => h.bpm)) } : null;
    const steps = stepsEst();
    return { L: mk("L"), R: mk("R"), stepsTotal: steps, cadence: minutes > 0.1 ? Math.round(steps / minutes) : null, fatigue, hr };
  }

  /* ---------- หน้าจอ ---------- */
  function draw() {
    const u = S.ui; if (!u || !u.canvas.isConnected) return;
    const c = u.canvas, x = c.getContext("2d"), w = (c.width = c.clientWidth * devicePixelRatio), h = (c.height = c.clientHeight * devicePixelRatio);
    const css = getComputedStyle(document.documentElement);
    x.clearRect(0, 0, w, h);
    const maxG = 16, now = performance.now(), y = (m) => h - (Math.min(m, maxG) / maxG) * (h - 8) - 4;
    x.strokeStyle = css.getPropertyValue("--line"); x.lineWidth = 1; x.font = `${11 * devicePixelRatio}px sans-serif`; x.fillStyle = css.getPropertyValue("--ink-3");
    [4, 8, 12].forEach((g) => { x.beginPath(); x.moveTo(0, y(g)); x.lineTo(w, y(g)); x.stroke(); x.fillText(g + " g", 4, y(g) - 3); });
    x.strokeStyle = css.getPropertyValue("--primary"); x.lineWidth = 2 * devicePixelRatio; x.beginPath();
    S.trace.forEach((p, i) => { const px = w - ((now - p.t) / 6000) * w, py = y(p.m); i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.stroke();
    const el = (now - S.t0) / 1000, L = S.impacts.L, R = S.impacts.R, set = (k, v) => (u.out[k].textContent = v);
    set("time", `${String(Math.floor(el / 60)).padStart(2, "0")}:${String(Math.floor(el % 60)).padStart(2, "0")}`);
    const st = stepsEst(); set("steps", st);
    set("cad", el >= 8 && st ? Math.round(st / (el / 60)) : "–");
    const lastHr = S.hr.slice(-1)[0];
    if (lastHr && now - lastHr.t < 6000) { const pct = Math.round((lastHr.bpm / u.hrMax) * 100); set("hr", `${lastHr.bpm} (${pct}%)`); } else set("hr", "–");
    const ct = [...S.contacts.L, ...S.contacts.R]; set("contact", ct.length >= 3 ? Math.round(avg(ct.slice(-40), "dur")) + " ms" : "–");
    set("pL", L.length ? avg(L, "peak").toFixed(1) : "–");
    set("pR", R.length ? avg(R, "peak").toFixed(1) : "–");
    const last = [...L, ...R].sort((a, b) => b.t - a.t)[0];
    set("last", last ? last.peak.toFixed(1) + " g" : "–");
    if (L.length && R.length) { const a = (Math.abs(avg(L, "peak") - avg(R, "peak")) / ((avg(L, "peak") + avg(R, "peak")) / 2)) * 100; set("asym", a.toFixed(0) + "%"); } else set("asym", L.length || R.length ? "ต้องมีเซนเซอร์ 2 ข้าง" : "–");
    S.raf = requestAnimationFrame(draw);
  }

  async function begin() {
    const u = S.ui, q = (s) => u.root.querySelector(s), src = q("#lvSrc").value;
    S.unit = q("#lvUnit").value; S.defSide = q("#lvSide").value;
    reset(); // สายรัดอกที่เชื่อมไว้ก่อนกดเริ่มจะส่งค่าเข้าเซสชันใหม่ต่อเนื่อง
    u.status("กำลังเชื่อมต่อ…");
    try {
      S.stop = src === "sim" ? startSim() : src === "serial" ? await startSerial(+q("#lvBaud").value) : await startWs(q("#lvWs").value);
      S.running = true; S.src = src; u.setRunning(true);
      u.status(src === "sim" ? "โหมดจำลอง – ข้อมูลสมมติ ไม่ใช่การวัดจริง" : "กำลังวัด");
      cancelAnimationFrame(S.raf); draw();
    } catch (e) { u.status("เชื่อมต่อไม่สำเร็จ: " + e.message, true); }
  }
  async function stop(lost) {
    if (!S.running) return;
    S.running = false; try { await S.stop(); } catch (e) {}
    S.stop = null;
    const min = (performance.now() - S.t0) / 60000;
    S.ui && (S.ui.setRunning(false), S.ui.status(lost === true ? "การเชื่อมต่อหลุด – ข้อมูลที่วัดได้ยังอยู่ บันทึกเซสชันได้" : "หยุดวัดแล้ว"));
    S.ui && S.ui.showSave(summary(min), min);
  }

  function unmount() {
    cancelAnimationFrame(S.raf); clearTimeout(S.calTimer); S.calib = null;
    if (S.running) { S.running = false; S.stop && S.stop().catch(() => {}); }
    S.hrStop && S.hrStop(); S.ui = null;
  }

  IG.live = { S, begin, stop, unmount, summary, connectHr, calibrate, bind(ui) { S.ui = ui; reset(); } };
})();
