/* ชั้นเชื่อมฐานข้อมูลมหาวิทยาลัย – ยังไม่เชื่อมต่อ ข้อมูลเก็บในเครื่องและรอส่ง
   เมื่อได้ที่อยู่เซิร์ฟเวอร์/คีย์ ให้กรอกในหน้า "เชื่อมต่อ" ได้เลย หากรูปแบบ API ของมหาวิทยาลัยต่างจากนี้ ให้แก้เฉพาะ buildPayload และ endpoint ในไฟล์นี้
   รูปแบบที่ใช้อยู่ดูใน docs/DATABASE.md */
(function () {
  const KEY = "ig.db";
  const DEFAULT = { baseUrl: "", token: "", autoSync: false, lastSync: null, lastError: null };

  const cfg = () => ({ ...DEFAULT, ...IG.store.get(KEY, {}) });
  const setCfg = (patch) => IG.store.set(KEY, { ...cfg(), ...patch });
  const configured = () => /^https?:\/\//.test(cfg().baseUrl);

  // ข้อมูลตัวอย่างไม่ถูกส่งออก
  const pendingSessions = () => IG.state.sessions.filter((s) => !s.synced && !s.demo);
  const pendingCheckins = () => IG.state.checkins.filter((c) => !c.synced && !c.demo);
  const pendingCount = () => pendingSessions().length + pendingCheckins().length;

  // ส่งเฉพาะรหัสนักกีฬา (นามแฝง) ไม่ส่งชื่อ-นามสกุล
  function buildPayload() {
    const ss = pendingSessions(), cs = pendingCheckins();
    const ids = new Set([...ss, ...cs].map((x) => x.athleteId));
    return {
      schema: "injuryguard/1",
      sentAt: new Date().toISOString(),
      athletes: IG.state.athletes.filter((a) => ids.has(a.id)).map((a) => ({ code: a.code, age: a.age, weightKg: a.weightKg, heightCm: a.heightCm, sport: a.sport, history: a.history })),
      sessions: ss.map((s) => ({ id: s.id, athlete: codeOf(s.athleteId), t: new Date(s.t).toISOString(), activity: s.activity, durationMin: s.durationMin, rpe: s.rpe, left: s.L, right: s.R, stepsTotal: s.stepsTotal, cadence: s.cadence, fatigueIdx: s.fatigue, hr: s.hr, lab: s.lab, source: s.source })),
      checkins: cs.map((c) => ({ id: c.id, athlete: codeOf(c.athleteId), t: new Date(c.t).toISOString(), pain: c.pain, sleepHours: c.sleep, fatigue: c.fatigue })),
    };
  }
  const codeOf = (id) => (IG.state.athletes.find((a) => a.id === id) || {}).code;

  const headers = () => ({ "Content-Type": "application/json", ...(cfg().token ? { Authorization: "Bearer " + cfg().token } : {}) });
  const url = (p) => cfg().baseUrl.replace(/\/+$/, "") + p;

  async function test() {
    if (!configured()) throw new Error("ยังไม่ได้กรอกที่อยู่เซิร์ฟเวอร์ (ต้องขึ้นต้นด้วย http:// หรือ https://)");
    const r = await fetch(url("/health"), { headers: headers() });
    if (!r.ok) throw new Error("เซิร์ฟเวอร์ตอบกลับ " + r.status);
    return true;
  }

  async function sync() {
    if (!configured()) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูล");
    if (!pendingCount()) return 0;
    const payload = buildPayload();
    try {
      const r = await fetch(url("/api/v1/ingest"), { method: "POST", headers: headers(), body: JSON.stringify(payload) });
      if (!r.ok) throw new Error("เซิร์ฟเวอร์ตอบกลับ " + r.status);
      const sent = new Set([...payload.sessions.map((s) => s.id), ...payload.checkins.map((c) => c.id)]);
      IG.state.sessions.forEach((s) => sent.has(s.id) && (s.synced = true));
      IG.state.checkins.forEach((c) => sent.has(c.id) && (c.synced = true));
      IG.save();
      setCfg({ lastSync: Date.now(), lastError: null });
      return sent.size;
    } catch (e) {
      setCfg({ lastError: e.message });
      throw e;
    }
  }

  const autoSync = () => { if (configured() && cfg().autoSync && pendingCount()) sync().catch(() => {}); };

  IG.db = { cfg, setCfg, configured, pendingCount, pendingSessions, pendingCheckins, buildPayload, test, sync, autoSync };
})();
