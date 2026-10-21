/* ข้อมูลตัวอย่าง (สมมติทั้งหมด) – ใช้ดูหน้าจอก่อนมีเซนเซอร์จริง ทุกรายการติดป้าย demo:true และจะไม่ถูกส่งไปฐานข้อมูล */
(function () {
  const rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // scenario: drift = แรงกระแทกเพิ่ม/เดือน, spike = ภาระซ้อมเพิ่มช่วง 10 วันล่าสุด, asym = ขา R แรงกว่า L (สัดส่วน), pain = ปวดล่าสุด
  const CAST = [
    { sport: "วิ่ง", age: 27, w: 64, h: 172, peak: 6.2, drift: 0.28, spike: 1.35, asym: 0.1, hist: { knee: true }, pain: { knee_R: 5, patellar_R: 3 } },
    { sport: "ฟุตบอล", age: 21, w: 71, h: 178, peak: 7.4, drift: 0, spike: 1.0, asym: 0.04, hist: {}, pain: {} },
    { sport: "บาสเกตบอล", age: 24, w: 82, h: 190, peak: 8.1, drift: 0.05, spike: 1.6, asym: 0.07, hist: { ankle: true }, pain: { ankle_L: 3 } },
    { sport: "วิ่ง", age: 36, w: 68, h: 169, peak: 6.8, drift: 0.12, spike: 1.1, asym: 0.05, hist: { achilles: true }, pain: { achilles_L: 6 } },
    { sport: "วอลเลย์บอล", age: 20, w: 58, h: 175, peak: 7.7, drift: 0, spike: 1.0, asym: 0.2, hist: { patellar: true }, pain: {} },
    { sport: "ฟุตบอล", age: 23, w: 69, h: 174, peak: 7.0, drift: 0.02, spike: 1.0, asym: 0.03, hist: {}, pain: {} },
    { sport: "วิ่ง", age: 31, w: 60, h: 165, peak: 5.9, drift: 0, spike: 1.15, asym: 0.06, hist: {}, pain: { ankle_R: 2 } },
    { sport: "บาสเกตบอล", age: 19, w: 77, h: 185, peak: 8.4, drift: 0.2, spike: 1.25, asym: 0.12, hist: { knee: true, ankle: true }, pain: {} },
  ];
  const ACT = { วิ่ง: ["วิ่งเบา", "วิ่งเร็ว", "วิ่งทางไกล"], ฟุตบอล: ["ซ้อมทีม", "ฝึกสปรินต์", "แมตช์ซ้อม"], บาสเกตบอล: ["ซ้อมกระโดด", "ซ้อมทีม", "ฝึกเปลี่ยนทิศ"], วอลเลย์บอล: ["ซ้อมกระโดด", "ซ้อมทีม", "ฝึกรับ-ตบ"] };

  IG.seedDemo = function () {
    const now = Date.now(), R = rng(7);
    const athletes = [], sessions = [], checkins = [];
    CAST.forEach((c, i) => {
      const id = "demo" + (i + 1);
      athletes.push({
        id, code: "A" + String(i + 1).padStart(2, "0"), age: c.age, weightKg: c.w, heightCm: c.h, sport: c.sport,
        history: { ankle: !!c.hist.ankle, knee: !!c.hist.knee, achilles: !!c.hist.achilles, patellar: !!c.hist.patellar }, demo: true,
      });
      for (let d = 41; d >= 0; d--) {
        if (R() < 0.34) continue; // วันพัก
        const recent = d < 10, prog = (41 - d) / 41;
        const dur = Math.round((40 + R() * 30) * (recent ? c.spike : 1));
        const rpe = Math.min(9, Math.round((5 + R() * 2.5) * (recent ? Math.min(c.spike, 1.25) : 1)));
        const base = c.peak * (1 + c.drift * prog);
        const pk = (extra) => +(base * (1 + extra) * (0.94 + R() * 0.12)).toFixed(2);
        const mk = (extra) => {
          const peak = pk(extra), steps = Math.round(dur * (80 + R() * 6));
          return { peak, rate: Math.round(peak * (42 + R() * 8)), steps, contact: Math.round(235 + R() * 30 + (c.hist.achilles ? 15 : 0)), roll: +(11 + (c.hist.ankle ? 6 : 0) + extra * 25 + R() * 3).toFixed(1), force: +(2.1 + R() * 0.3 + extra).toFixed(2) };
        };
        const L = mk(0), Rr = mk(c.asym), hrAvg = Math.round(138 + rpe * 3 + (R() - 0.5) * 8);
        const extras = { stepsTotal: L.steps + Rr.steps, cadence: Math.round(166 + R() * 8), fatigue: +(0.02 + R() * 0.05 + (recent ? 0.03 : 0)).toFixed(3), hr: { avg: hrAvg, max: hrAvg + 18 + Math.round(R() * 8) } };
        sessions.push({
          id: IG.uid(), athleteId: id, t: now - d * IG.DAY - R() * 3e6, activity: ACT[c.sport][Math.floor(R() * 3)],
          durationMin: dur, rpe, L, R: Rr, ...extras, ...(i === 0 && d < 3 ? { lab: { mvic: { L: { pre: 295, post: 276 }, R: { pre: 308, post: 262 } }, lactate: { pre: 1.0, post: 6.4 } } } : {}), source: "demo", demo: true, synced: false,
        });
      }
      for (let d = 13; d >= 0; d -= 2) {
        const pain = {};
        IG.SITES.forEach((s) => IG.SIDES.forEach((sd) => {
          const k = s.key + "_" + sd.key, target = c.pain[k] || 0;
          pain[k] = target ? Math.max(0, Math.round(target * (1 - d / 22) + (R() - 0.5))) : 0;
        }));
        checkins.push({ id: IG.uid(), athleteId: id, t: now - d * IG.DAY, pain, sleep: 6 + Math.round(R() * 2), fatigue: 3 + Math.round(R() * 4), demo: true, synced: false });
      }
    });
    IG.state.athletes = athletes.concat(IG.state.athletes.filter((a) => !a.demo));
    IG.state.sessions = sessions.concat(IG.state.sessions.filter((s) => !s.demo));
    IG.state.checkins = checkins.concat(IG.state.checkins.filter((s) => !s.demo));
    IG.state.profile = IG.state.profile || { role: "athlete", athleteId: "demo1", viewId: "demo1", consent: true, demo: true };
    IG.save();
  };
})();
