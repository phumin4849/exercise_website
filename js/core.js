/* InjuryGuard – แกนกลาง: ตัวช่วย, สถานะ, การเก็บข้อมูลในเครื่อง */
(function () {
  const IG = (window.IG = {});

  IG.$ = (s, r = document) => r.querySelector(s);
  IG.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  IG.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  IG.uid = () => Math.random().toString(36).slice(2, 10);
  IG.DAY = 864e5;
  IG.clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  IG.mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

  // localStorage อาจใช้ไม่ได้ (โหมดส่วนตัว) จึงสำรองไว้ในหน่วยความจำ
  const mem = {};
  IG.store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return k in mem ? mem[k] : d;
      }
    },
    set(k, v) {
      mem[k] = v;
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    },
    del(k) {
      delete mem[k];
      try { localStorage.removeItem(k); } catch (e) {}
    },
  };

  IG.fmtDate = (t) => new Date(t).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  IG.fmtDateTime = (t) => new Date(t).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  let toastTimer;
  IG.toast = (msg) => {
    const el = IG.$("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  };

  /* ตำแหน่งที่ประเมิน */
  IG.SITES = [
    { key: "ankle", name: "ข้อเท้า" },
    { key: "knee", name: "หัวเข่า" },
    { key: "achilles", name: "เอ็นร้อยหวาย" },
    { key: "patellar", name: "เอ็นสะบ้า" },
  ];
  IG.SIDES = [{ key: "L", name: "ซ้าย" }, { key: "R", name: "ขวา" }];
  IG.siteName = (s) => IG.SITES.find((x) => x.key === s).name;
  IG.sideName = (s) => (s === "L" ? "ซ้าย" : "ขวา");
  IG.LEVELS = ["ต่ำ", "เฝ้าระวัง", "สูง", "สูงมาก"];

  /* สถานะแอป
     athletes: {id, code, age, weightKg, heightCm, sport, history:{ankle,knee,achilles,patellar}, demo}
     sessions: {id, athleteId, t, activity, durationMin, rpe, L:{peak,rate,steps}, R:{...}, source, demo, synced}
     checkins: {id, athleteId, t, pain:{ankle_L,...}, sleep, fatigue, demo, synced}            */
  IG.state = {
    profile: IG.store.get("ig.profile", null),
    athletes: IG.store.get("ig.athletes", []),
    sessions: IG.store.get("ig.sessions", []),
    checkins: IG.store.get("ig.checkins", []),
  };
  IG.save = () => {
    IG.store.set("ig.profile", IG.state.profile);
    IG.store.set("ig.athletes", IG.state.athletes);
    IG.store.set("ig.sessions", IG.state.sessions);
    IG.store.set("ig.checkins", IG.state.checkins);
  };

  IG.role = () => (IG.state.profile ? IG.state.profile.role : "athlete");
  IG.curAthlete = () => {
    const p = IG.state.profile;
    if (!p) return null;
    const id = IG.role() === "coach" ? p.viewId || p.athleteId : p.athleteId;
    return IG.state.athletes.find((a) => a.id === id) || IG.state.athletes[0] || null;
  };
  IG.sessionsOf = (id) => IG.state.sessions.filter((s) => s.athleteId === id).sort((a, b) => a.t - b.t);
  IG.checkinsOf = (id) => IG.state.checkins.filter((c) => c.athleteId === id).sort((a, b) => a.t - b.t);

  IG.download = (name, text, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  IG.icons = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
    pulse: '<path d="M2 12h4l2.5-6 4 12 3-9 1.5 3H22"/>',
    clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4M12 8v4l3 2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.2 2.3 3.5 5.2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    alert: '<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4M12 17v.5"/>',
  };
  IG.icon = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${IG.icons[n] || ""}</svg>`;
})();
