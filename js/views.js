/* หน้าจอทั้งหมด – แต่ละหน้าคืน {html, mount(root)} */
(function () {
  const { esc, $, icon } = IG;
  IG.ui = { sel: null };

  const pct = (pre, post) => (pre && post ? Math.round(((post - pre) / pre) * 100) : null);
  const labLine = (s) => {
    const l = s.lab; if (!l) return "";
    const parts = [];
    ["L", "R"].forEach((sd) => { const m = l.mvic && l.mvic[sd]; if (m && m.pre && m.post) parts.push(`แรงบีบขา${IG.sideName(sd)} ${pct(m.pre, m.post)}% (${m.pre}→${m.post} N)`); });
    if (l.lactate && (l.lactate.pre || l.lactate.post)) parts.push(`แลคเตต ${l.lactate.pre ?? "–"}→${l.lactate.post ?? "–"} mmol/L`);
    return parts.length ? `<p class="lab-line">${parts.join(" · ")}<br><span class="sub">งาน <a href="#/refs">[1]</a> พบแรงบีบขาขวาลดราว 15% หลังวิ่ง 5 กม. ความหนักสูง ใช้เป็นบริบท ไม่ใช่เกณฑ์ปกติ</span></p>` : "";
  };
  const fatigueCard = (a, ss) => {
    const last = ss[ss.length - 1]; if (!last) return "";
    const hrmax = 208 - 0.7 * a.age, lab = last.lab || {}, mv = (sd) => lab.mvic && lab.mvic[sd] ? pct(lab.mvic[sd].pre, lab.mvic[sd].post) : null, mL = mv("L"), mR = mv("R");
    const sg = (x) => (x >= 0 ? "+" : "") + x;
    const rows = [
      ["การรับรู้ความเหนื่อย (Borg CR10)", `${last.rpe}/10`, true],
      ["หัวใจ", last.hr ? `เฉลี่ย ${last.hr.avg} · สูงสุด ${last.hr.max} (${Math.round((last.hr.avg / hrmax) * 100)}% ของสูงสุดโดยประมาณ)` : "ไม่มีข้อมูล ต้องใช้สายรัดอก", !!last.hr],
      ["แรงกระแทกปลายเทียบต้นเซสชัน (ดัชนีทดลอง)", last.fatigue != null ? `${sg(+(last.fatigue * 100).toFixed(0))}%` : "ไม่มีข้อมูล ต้องวัดเซสชันที่ยาวพอ", last.fatigue != null],
      ["แรงบีบ quadriceps (MVIC)", mL != null || mR != null ? `ซ้าย ${mL != null ? sg(mL) + "%" : "–"} · ขวา ${mR != null ? sg(mR) + "%" : "–"}` : "ไม่มีข้อมูล ต้องใช้ dynamometer", mL != null || mR != null],
      ["แลคเตตหลังซ้อม", lab.lactate && lab.lactate.post ? `${lab.lactate.post} mmol/L` : "ไม่มีข้อมูล ต้องใช้เครื่องวัดแลคเตต", !!(lab.lactate && lab.lactate.post)],
    ];
    return `<section class="card fat"><h2>ความล้าหลังซ้อมล่าสุด</h2><p class="sub">${IG.fmtDateTime(last.t)} · ${esc(last.activity)}</p>
      <ul class="fat-list">${rows.map(([k, v, ok]) => `<li class="${ok ? "" : "off"}"><span class="mk ${ok ? "on" : ""}" aria-hidden="true"></span><div><b>${k}</b><span>${v}</span></div></li>`).join("")}</ul>
      <p class="hint">ผู้เขียนงาน <a href="#/refs">[1]</a> แนะนำให้ประเมินความล้าหลายมิติรวมกัน ในงานนั้นหลังวิ่ง 5 กม. ความหนักสูง หัวใจเฉลี่ย 165 bpm, Borg CR10 เฉลี่ย 8.3, แรงบีบขาขวาลดราว 15% (บริบท ไม่ใช่เกณฑ์ปกติ)</p></section>`;
  };

  const chip = (l) => `<span class="chip lv${l}">${IG.LEVELS[l]}</span>`;
  const head = (title, sub, actions = "") => `<header class="head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div><div class="head-r">${actions}${IG.roleBox("mini")}</div></header>`;
  const empty = (title, text, btn) => `<div class="card empty"><h2>${title}</h2><p>${text}</p>${btn || ""}</div>`;

  IG.roleBox = (cls = "") => {
    const p = IG.state.profile; if (!p) return "";
    const coach = IG.role() === "coach";
    const sel = coach && IG.state.athletes.length
      ? `<label class="sr" for="athSel${cls}">เลือกนักกีฬา</label><select id="athSel${cls}" class="athSel">${IG.state.athletes.map((a) => `<option value="${a.id}"${(p.viewId || p.athleteId) === a.id ? " selected" : ""}>${esc(a.code)} · ${esc(a.sport)}</option>`).join("")}</select>` : "";
    return `<div class="rolebox ${cls}"><div class="seg" role="group" aria-label="บทบาท"><button data-role="athlete" aria-pressed="${!coach}">นักกีฬา</button><button data-role="coach" aria-pressed="${coach}">โค้ช/นักวิจัย</button></div>${sel}${p.demo ? `<span class="demo-tag">ข้อมูลตัวอย่าง</span>` : ""}</div>`;
  };

  /* ---------- เริ่มใช้งาน ---------- */
  function onboarding() {
    const html = `<div class="onb">
      <div class="onb-hero">
        <h1>เห็นความเสี่ยงบาดเจ็บ<br>ก่อนมันจะเกิดขึ้น</h1>
        <p>วัดแรงกระแทกตอนเท้าลงพื้น รวมกับภาระการซ้อมและอาการปวด เพื่อบอกว่าข้อเท้า หัวเข่า และเส้นเอ็นข้างไหนควรระวัง</p>
        <button class="btn ghost" id="demoBtn">ลองดูด้วยข้อมูลตัวอย่าง</button>
      </div>
      <form class="card form" id="onbForm">
        <h2>สร้างโปรไฟล์</h2>
        <fieldset class="roles"><legend class="sr">บทบาท</legend>
          <label class="pick"><input type="radio" name="role" value="athlete" checked><span>นักกีฬา</span></label>
          <label class="pick"><input type="radio" name="role" value="coach"><span>โค้ช/นักวิจัย</span></label>
        </fieldset>
        <div id="athFields">${athleteFields()}</div>
        <label class="check"><input type="checkbox" id="consent"><span>ฉันยินยอมให้เก็บข้อมูลการวัดและอาการของฉัน ข้อมูลอยู่ในเครื่องนี้ และจะถูกส่งไปฐานข้อมูลของมหาวิทยาลัยโดยใช้รหัสแทนชื่อ เมื่อมีการเชื่อมต่อ ผลที่ได้เป็นการคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัยทางการแพทย์</span></label>
        <p class="err" id="onbErr" hidden></p>
        <button class="btn primary" type="submit">เริ่มใช้งาน</button>
      </form></div>`;
    return {
      html,
      mount(r) {
        $("#demoBtn", r).onclick = () => { IG.state.profile = null; IG.seedDemo(); go("home"); };
        r.querySelectorAll("[name=role]").forEach((x) => (x.onchange = () => ($("#athFields", r).hidden = x.value === "coach")));
        $("#onbForm", r).onsubmit = (e) => {
          e.preventDefault();
          const role = r.querySelector("[name=role]:checked").value, err = $("#onbErr", r);
          const fail = (m) => { err.textContent = m; err.hidden = false; };
          if (!$("#consent", r).checked) return fail("ต้องยินยอมก่อนจึงเริ่มใช้งานได้");
          const prof = { role, consent: true, demo: false };
          if (role === "athlete") {
            const a = readAthlete(r); if (a.error) return fail(a.error);
            IG.state.athletes.push(a); prof.athleteId = prof.viewId = a.id;
          }
          IG.state.profile = prof; IG.save(); go(role === "coach" ? "team" : "home");
        };
      },
    };
  }
  function athleteFields() {
    return `<label for="fCode">รหัสนักกีฬา</label><input id="fCode" placeholder="เช่น RUN-014 (ใช้รหัสแทนชื่อจริง)" maxlength="20" autocomplete="off">
      <div class="three"><div><label for="fAge">อายุ (ปี)</label><input id="fAge" type="number" inputmode="numeric" min="10" max="80"></div>
      <div><label for="fW">น้ำหนัก (กก.)</label><input id="fW" type="number" inputmode="decimal" min="25" max="200"></div>
      <div><label for="fH">ส่วนสูง (ซม.)</label><input id="fH" type="number" inputmode="decimal" min="120" max="230"></div></div>
      <label for="fSport">กีฬาหลัก</label><input id="fSport" placeholder="เช่น วิ่ง ฟุตบอล" maxlength="30">
      <fieldset class="hist"><legend>เคยบาดเจ็บบริเวณไหนบ้าง</legend>${IG.SITES.map((s) => `<label class="check inline"><input type="checkbox" data-hist="${s.key}"><span>${s.name}</span></label>`).join("")}</fieldset>`;
  }
  function readAthlete(r) {
    const v = (id) => $("#" + id, r).value.trim(), n = (id) => +v(id);
    if (!v("fCode")) return { error: "กรอกรหัสนักกีฬา" };
    if (!(n("fAge") >= 10 && n("fAge") <= 80)) return { error: "อายุต้องอยู่ระหว่าง 10–80 ปี" };
    if (!(n("fW") >= 25 && n("fW") <= 200)) return { error: "น้ำหนักต้องอยู่ระหว่าง 25–200 กก." };
    if (!(n("fH") >= 120 && n("fH") <= 230)) return { error: "ส่วนสูงต้องอยู่ระหว่าง 120–230 ซม." };
    if (IG.state.athletes.some((a) => a.code === v("fCode"))) return { error: "รหัสนี้ถูกใช้แล้ว" };
    const history = {}; r.querySelectorAll("[data-hist]").forEach((c) => (history[c.dataset.hist] = c.checked));
    return { id: IG.uid(), code: v("fCode"), age: n("fAge"), weightKg: n("fW"), heightCm: n("fH"), sport: v("fSport") || "ทั่วไป", history, demo: false };
  }

  /* ---------- ภาพรวม ---------- */
  function home() {
    const a = IG.curAthlete();
    if (!a) return { html: head("ภาพรวม", "") + empty("ยังไม่มีนักกีฬา", "เพิ่มนักกีฬาในหน้าทีมก่อน", `<a class="btn primary" href="#/team">ไปหน้าทีม</a>`) };
    const ss = IG.sessionsOf(a.id), cs = IG.checkinsOf(a.id), an = IG.risk.analyze(a, ss, cs);
    const key = IG.ui.sel && an.bySite.some((b) => b.site + "_" + b.side === IG.ui.sel) ? IG.ui.sel : an.worst.site + "_" + an.worst.side;
    const cur = an.bySite.find((b) => b.site + "_" + b.side === key);
    const w = an.worst;
    const headline = !an.hasData ? "ยังไม่มีเซสชันใน 14 วันล่าสุด"
      : w.level === 0 ? "ตอนนี้ยังไม่พบสัญญาณเสี่ยงเด่น"
      : `ควรระวัง${IG.siteName(w.site)}${IG.sideName(w.side)}`;
    const acwrTxt = an.acwr == null ? "ข้อมูลยังไม่พอ (ต้องมีเซสชันอย่างน้อย 4 สัปดาห์)" : an.acwr < 0.8 ? "ต่ำกว่าปกติ" : an.acwr <= 1.3 ? "อยู่ในช่วงพอดี" : an.acwr <= 1.5 ? "เริ่มสูง" : "สูงเกินไป";
    const acwrLv = an.acwr == null ? "" : an.acwr > 1.5 ? "lv3" : an.acwr > 1.3 ? "lv2" : an.acwr < 0.8 ? "lv1" : "lv0";
    const asymLv = an.asym == null ? "" : an.asym > 20 ? "lv3" : an.asym > 12 ? "lv2" : an.asym > 8 ? "lv1" : "lv0";
    const now = Date.now(), weeks = [];
    for (let i = 5; i >= 0; i--) {
      const v = ss.filter((s) => s.t > now - (i + 1) * 7 * IG.DAY && s.t <= now - i * 7 * IG.DAY).reduce((x, s) => x + s.rpe * s.durationMin, 0);
      weeks.push({ v, label: i === 0 ? (IG.chart.narrow() ? "นี้" : "สัปดาห์นี้") : IG.chart.narrow() ? ((d) => `${d.getDate()}/${d.getMonth() + 1}`)(new Date(now - (i + 1) * 7 * IG.DAY + IG.DAY)) : IG.fmtDate(now - (i + 1) * 7 * IG.DAY + IG.DAY), cls: i === 0 ? "now" : "" });
    }
    const pts = (sd) => ss.filter((s) => s.t > now - 42 * IG.DAY && s[sd].peak > 0).map((s) => ({ t: s.t, v: s[sd].peak }));
    const maxC = Math.max(...cur.drivers.map((d) => d.contrib), 1);
    const wk = ss.filter((s) => s.t > now - 7 * IG.DAY), steps7 = wk.reduce((x, s) => x + (s.stepsTotal || 0), 0), cadW = wk.filter((s) => s.cadence).map((s) => s.cadence);
    const hrW = wk.filter((s) => s.hr), hrAvg = Math.round(IG.mean(hrW.map((s) => s.hr.avg))), hrMax = hrW.length ? Math.max(...hrW.map((s) => s.hr.max)) : 0, hrPct = Math.round((hrAvg / (208 - 0.7 * a.age)) * 100);
    const fatW = wk.filter((s) => s.fatigue != null), fat = IG.mean(fatW.map((s) => s.fatigue)), fatLv = !fatW.length ? "" : fat > 0.1 ? "lv2" : fat > 0.05 ? "lv1" : "lv0";
    const site = IG.siteName(w.site) + IG.sideName(w.side);
    const today = !an.hasData ? ["บันทึกเซสชันเพื่อให้ระบบแนะนำ", "ต้องมีเซสชันอย่างน้อย 1 ครั้งใน 14 วันล่าสุด"]
      : w.level >= 3 ? ["พักหรือซ้อมเบามาก เช่น เดิน ว่ายน้ำ ปั่นจักรยานเบา", `คะแนน${site}สูงมาก ลดภาระบริเวณนั้นและปรึกษานักกายภาพบำบัดหรือแพทย์เวชศาสตร์การกีฬา`]
      : w.level === 2 ? ["ลดความหนักลงราว 30% และเลี่ยงการกระโดดหรือเปลี่ยนทิศแรงๆ", `ระวัง${site} ถ้ารู้สึกปวดระหว่างซ้อมให้หยุดทันที`]
      : w.level === 1 ? ["ซ้อมตามแผนได้ แต่วอร์มอัปให้นานขึ้น", `เฝ้าดูอาการ${site}`] : ["ซ้อมตามแผนได้", "ยังไม่พบสัญญาณเสี่ยงเด่น"];
    if (an.acwr != null && an.acwr > 1.5) today[1] += " · ภาระซ้อมสัปดาห์นี้พุ่งสูงกว่าที่ร่างกายคุ้นเคย";

    const html = `${head(`${esc(a.code)} <small>${esc(a.sport)}</small>`, headline, `<a class="btn primary" href="#/record">${icon("pulse")}เริ่มวัดเซสชัน</a>`)}
    ${an.lastCheckin ? "" : `<div class="note">ยังไม่ได้บันทึกอาการใน 7 วันล่าสุด คะแนนจะแม่นขึ้นเมื่อมีข้อมูลอาการ <a href="#/checkin">บันทึกอาการ</a></div>`}
    <section class="card today lv${an.hasData ? w.level : 0}"><h2>วันนี้ควรซ้อมแค่ไหน</h2><p class="today-t">${today[0]}</p><p class="sub">${esc(today[1])}</p></section>
    <div class="grid2">
      <section class="card map-card"><h2>แผนที่ความเสี่ยง</h2><p class="sub">แตะจุดเพื่อดูรายละเอียด · มองจากด้านหน้า</p>
        <div class="map-wrap" id="mapWrap">${IG.bodymap.render(an, key)}</div>
        <ul class="legend-lv">${IG.LEVELS.map((l, i) => `<li><i class="dotlv lv${i}"></i>${l}</li>`).join("")}</ul>
        <p class="hint">เอ็นร้อยหวายอยู่ด้านหลังข้อเท้า วาดไว้บนภาพด้านหน้าเพื่อให้ดูครบ</p>
      </section>
      <section class="card detail" aria-live="polite">
        <div class="d-top"><div><h2>${IG.siteName(cur.site)}${IG.sideName(cur.side)}</h2>${chip(cur.level)}</div><div class="score lv${cur.level}"><b>${cur.score}</b><span>/100</span></div></div>
        <h3>ปัจจัยที่ส่งผลต่อคะแนน</h3>
        <ul class="drivers">${cur.drivers.map((d) => `<li class="${d.contrib ? "" : "off"}"><div class="d-row"><span>${d.label}</span><span class="d-val">${d.text}</span></div><div class="bar-t"><div class="bar-f lv${cur.level}" style="width:${Math.max(d.contrib ? 6 : 0, (d.contrib / maxC) * 100)}%"></div></div></li>`).join("")}</ul>
        <h3>ควรทำอะไร</h3>
        <ul class="todo">${IG.risk.advice(cur).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <p class="hint">เป็นการคัดกรองเบื้องต้นจากสูตรที่ปรับได้ ไม่ใช่การวินิจฉัย ถ้าปวดมากหรือบวม ควรพบแพทย์</p>
      </section>
    </div>
    <div class="stats">
      <div class="card stat"><h3>ภาระซ้อมสัปดาห์นี้เทียบปกติ</h3><div class="big ${acwrLv}">${an.acwr == null ? "–" : an.acwr.toFixed(2) + "×"}</div><p>${acwrTxt}</p></div>
      <div class="card stat"><h3>ซ้าย-ขวาต่างกัน</h3><div class="big ${asymLv}">${an.asym == null ? "–" : an.asym.toFixed(0) + "%"}</div><p>${an.asym == null ? "ต้องมีเซนเซอร์ทั้ง 2 ข้าง" : `ข้าง${IG.sideName(an.heavier)}รับแรงมากกว่า · ซ้าย ${an.peakL.toFixed(1)} g · ขวา ${an.peakR.toFixed(1)} g`}</p></div>
      <div class="card stat"><h3>ก้าวใน 7 วัน</h3><div class="big">${steps7 ? steps7.toLocaleString("th-TH") : "–"}</div><p>${cadW.length ? `จังหวะเฉลี่ย ${Math.round(IG.mean(cadW))} ก้าว/นาที` : "ยังไม่มีข้อมูลจังหวะก้าว"}</p></div>
      <div class="card stat"><h3>หัวใจเฉลี่ยตอนซ้อม</h3><div class="big">${hrW.length ? hrAvg : "–"}</div><p>${hrW.length ? `สูงสุด ${hrMax} · เฉลี่ย ${hrPct}% ของหัวใจสูงสุดโดยประมาณ` : `ยังไม่มีข้อมูลหัวใจ <a href="#/connect">ดูวิธีเพิ่ม</a>`}</p></div>
      <div class="card stat"><h3>แรงท้ายเซสชันเทียบต้นเซสชัน</h3><div class="big ${fatLv}">${fatW.length ? (fat >= 0 ? "+" : "") + (fat * 100).toFixed(0) + "%" : "–"}</div><p>${fatW.length ? "ดัชนีทดลอง ยิ่งเพิ่มมาก แปลว่าลงเท้าแรงขึ้นช่วงท้าย" : "ต้องวัดเซสชันที่ยาวพอ (30+ ก้าว)"}</p></div>
    </div>
    ${fatigueCard(a, ss)}
    <div class="grid2">
      <section class="card"><h2>ภาระการซ้อมรายสัปดาห์</h2><p class="sub">ความหนัก (RPE) × เวลาซ้อม (นาที) · ป้ายคือวันเริ่มสัปดาห์</p>${IG.chart.bars(weeks, { label: "ภาระการซ้อมรายสัปดาห์" })}</section>
      <section class="card"><h2>แรงกระแทกสูงสุดต่อเซสชัน</h2><p class="sub">6 สัปดาห์ล่าสุด หน่วย g</p>${IG.chart.line([{ name: "ซ้าย", cls: "s1", pts: pts("L") }, { name: "ขวา", cls: "s2", pts: pts("R") }], { label: "แรงกระแทกสูงสุดซ้ายและขวา", dec: 1 })}<p class="hint">${an.peakL && an.peakR ? `เฉลี่ย 14 วันล่าสุด: ซ้าย ${an.peakL.toFixed(1)} g · ขวา ${an.peakR.toFixed(1)} g` : "ยังไม่มีเซสชันใน 14 วันล่าสุด"}</p></section>
    </div>`;
    return {
      html,
      mount(r) {
        const pick = (k) => { IG.ui.sel = k; render(); };
        r.querySelectorAll("[data-pick]").forEach((g) => {
          g.onclick = () => pick(g.dataset.pick);
          g.onkeydown = (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(g.dataset.pick));
        });
      },
    };
  }

  /* ---------- วัดสด ---------- */
  function record() {
    const a = IG.curAthlete();
    if (!a) return { html: head("วัดเซสชัน", "") + empty("ยังไม่มีนักกีฬา", "เพิ่มนักกีฬาในหน้าทีมก่อน", `<a class="btn primary" href="#/team">ไปหน้าทีม</a>`) };
    const html = `${head("วัดเซสชัน", `บันทึกให้ ${esc(a.code)}`)}
    <div class="grid2">
      <section class="card form" id="lvSetup">
        <h2>เชื่อมต่อเซนเซอร์</h2>
        <label for="lvSrc">แหล่งข้อมูล</label>
        <select id="lvSrc"><option value="sim">โหมดจำลอง (ข้อมูลสมมติ)</option><option value="serial">สาย USB / Serial (Chrome, Edge)</option><option value="ws">WebSocket (ESP32 ผ่าน Wi-Fi)</option></select>
        <div id="lvSerial" hidden><label for="lvBaud">Baud rate</label><select id="lvBaud"><option>921600</option><option>115200</option><option>57600</option><option>9600</option></select></div>
        <div id="lvWsBox" hidden><label for="lvWs">ที่อยู่ WebSocket</label><input id="lvWs" value="ws://192.168.4.1:81"></div>
        <div class="two"><div><label for="lvUnit">หน่วยค่าความเร่ง</label><select id="lvUnit"><option value="g">g</option><option value="ms2">m/s²</option></select></div>
        <div><label for="lvSide">ข้างที่ติดเซนเซอร์</label><select id="lvSide"><option value="L">ซ้าย</option><option value="R">ขวา</option></select></div></div>
        <p class="hint">ข้อมูลต่อบรรทัด: <code>L,ax,ay,az,gx,gy,gz,fsr</code> (ไม่ใส่ L/R ก็ได้ จะใช้ข้างที่เลือก) แกน z คือแนวดิ่ง</p>
        <div class="row"><button class="btn primary" id="lvStart">เริ่มวัด</button><button class="btn" id="lvStop" disabled>หยุดวัด</button></div>
        <div class="row"><button class="btn" id="hrBtn" type="button">เชื่อมต่อสายรัดอกวัดหัวใจ</button><button class="btn" id="calBtn" type="button" disabled>ปรับเทียบแรงกด</button></div>
        <p class="hint" id="calTxt"></p>
        <p class="status" id="lvStatus" role="status">ยังไม่ได้เริ่ม</p>
      </section>
      <section class="card live">
        <h2>สัญญาณสด</h2><p class="sub">ความเร่งรวม 6 วินาทีล่าสุด</p>
        <canvas id="lvCanvas" aria-label="กราฟสัญญาณความเร่งสด" role="img"></canvas>
        <dl class="kpis">
          <div><dt>เวลา</dt><dd id="o-time">00:00</dd></div><div><dt>จำนวนก้าว</dt><dd id="o-steps">0</dd></div><div><dt>จังหวะก้าว (ก้าว/นาที)</dt><dd id="o-cad">–</dd></div>
          <div><dt>หัวใจ bpm (% สูงสุด)</dt><dd id="o-hr">–</dd></div><div><dt>เวลาสัมผัสพื้น</dt><dd id="o-contact">–</dd></div><div><dt>ก้าวล่าสุด</dt><dd id="o-last">–</dd></div>
          <div><dt>แรงสูงสุดเฉลี่ย ซ้าย</dt><dd id="o-pL">–</dd></div><div><dt>แรงสูงสุดเฉลี่ย ขวา</dt><dd id="o-pR">–</dd></div><div><dt>ซ้าย-ขวาต่างกัน</dt><dd id="o-asym">–</dd></div>
        </dl>
      </section>
    </div>
    <section class="card form" id="lvSave" hidden>
      <h2>บันทึกเซสชัน</h2><p class="sub" id="lvSum"></p>
      <div class="three loose"><div><label for="svAct">กิจกรรม</label><input id="svAct" value="${esc(a.sport)}" maxlength="30"></div>
      <div><label for="svDur">เวลา (นาที)</label><input id="svDur" type="number" min="1" max="300"></div>
      <div><label for="svRpe">ความรู้สึกเหนื่อย (Borg CR10) <output id="svRpeO">6</output>/10</label><input id="svRpe" type="range" min="1" max="10" value="6"></div></div>
      <p class="hint">1 เบามาก · 3 ปานกลาง · 5 หนัก · 7 หนักมาก · 10 หนักสุดขีด · มาตราเดียวกับงานวิจัย <a href="#/refs">[1]</a></p>
      <div class="two"><div><label for="svHrA">หัวใจเฉลี่ย (ครั้ง/นาที) ไม่ต้องกรอกถ้าไม่มี</label><input id="svHrA" type="number" min="30" max="230"></div><div><label for="svHrM">หัวใจสูงสุด</label><input id="svHrM" type="number" min="30" max="230"></div></div>
      <details class="lab"><summary>ข้อมูลห้องปฏิบัติการ (ไม่บังคับ)</summary>
        <p class="hint">ถ้ามีเครื่องวัดแรงบีบ (dynamometer) และเครื่องวัดแลคเตต วัดแรงบีบสูงสุดของ quadriceps ที่ 5 นาทีหลังซ้อม ท่าเดิมทุกครั้ง (วิธีเดียวกับงาน <a href="#/refs">[1]</a>) แล้วกรอกแยกซ้าย-ขวา</p>
        <div class="lab-grid">
          <div><label for="svMLa">แรงบีบซ้าย ก่อน (N)</label><input id="svMLa" type="number" min="0" inputmode="decimal"></div><div><label for="svMLb">แรงบีบซ้าย หลัง (N)</label><input id="svMLb" type="number" min="0" inputmode="decimal"></div>
          <div><label for="svMRa">แรงบีบขวา ก่อน (N)</label><input id="svMRa" type="number" min="0" inputmode="decimal"></div><div><label for="svMRb">แรงบีบขวา หลัง (N)</label><input id="svMRb" type="number" min="0" inputmode="decimal"></div>
          <div><label for="svLa">แลคเตต ก่อน (mmol/L)</label><input id="svLa" type="number" min="0" step="0.1" inputmode="decimal"></div><div><label for="svLb">แลคเตต หลัง (mmol/L)</label><input id="svLb" type="number" min="0" step="0.1" inputmode="decimal"></div>
        </div></details>
      <div class="row"><button class="btn primary" id="svOk">บันทึกเซสชัน</button><button class="btn ghost" id="svNo">ทิ้ง</button></div>
    </section>`;
    return {
      html,
      mount(r) {
        const q = (s) => $(s, r), out = {};
        ["time", "steps", "cad", "hr", "contact", "last", "pL", "pR", "asym"].forEach((k) => (out[k] = q("#o-" + k)));
        const status = (t, bad) => { const s = q("#lvStatus"); s.textContent = t; s.classList.toggle("bad", !!bad); };
        let lastSum = null;
        const updCal = () => { const c = IG.live.S.bw; q("#calTxt").textContent = c.L || c.R ? `ปรับเทียบแรงกดแล้ว: ${[c.L ? "ซ้าย" : "", c.R ? "ขวา" : ""].filter(Boolean).join(" ")}` : "ยังไม่ได้ปรับเทียบแรงกด จะแสดงแรงเป็นเท่าน้ำหนักตัวไม่ได้ (เวลาสัมผัสพื้นยังใช้ได้)"; };
        updCal();
        IG.live.bind({
          root: r, canvas: q("#lvCanvas"), out, status, hrMax: 208 - 0.7 * a.age,
          setRunning(on) { q("#lvStart").disabled = on; q("#lvStop").disabled = !on; q("#calBtn").disabled = !on; q("#lvSetup").classList.toggle("busy", on); },
          showSave(sum, min) {
            lastSum = sum;
            if (sum.L.steps + sum.R.steps < 5) { status("วัดได้น้อยกว่า 5 ก้าว จึงไม่มีข้อมูลพอให้บันทึก ตรวจการเชื่อมต่อและทิศแกนเซนเซอร์", true); return; }
            q("#lvSave").hidden = false; q("#svDur").value = Math.max(1, Math.round(min));
            q("#svHrA").value = sum.hr ? sum.hr.avg : ""; q("#svHrM").value = sum.hr ? sum.hr.max : "";
            const one = !(sum.L.steps && sum.R.steps);
            q("#lvSum").textContent = [`ก้าวรวม ${sum.stepsTotal}${one ? " (ประมาณจากเท้าข้างเดียว)" : ""}`, sum.cadence ? `จังหวะ ${sum.cadence} ก้าว/นาที` : "",
              sum.L.steps ? `ซ้าย แรงสูงสุดเฉลี่ย ${sum.L.peak} g` : "", sum.R.steps ? `ขวา แรงสูงสุดเฉลี่ย ${sum.R.peak} g` : "",
              sum.fatigue != null ? `แรงปลายเซสชันเทียบต้น ${sum.fatigue >= 0 ? "+" : ""}${(sum.fatigue * 100).toFixed(0)}%` : ""].filter(Boolean).join(" · ");
            q("#lvSave").scrollIntoView({ behavior: "smooth", block: "nearest" });
          },
        });
        const sync = () => { const s = q("#lvSrc").value; q("#lvSerial").hidden = s !== "serial"; q("#lvWsBox").hidden = s !== "ws"; };
        q("#lvSrc").onchange = sync; sync();
        q("#lvStart").onclick = () => { q("#lvSave").hidden = true; IG.live.begin(); };
        q("#lvStop").onclick = () => IG.live.stop();
        q("#svRpe").oninput = (e) => (q("#svRpeO").textContent = e.target.value);
        q("#hrBtn").onclick = () => IG.live.connectHr().then((n) => { status(`เชื่อมต่อ ${n} แล้ว ค่าหัวใจจะเริ่มบันทึกเมื่อกดเริ่มวัด`); q("#hrBtn").textContent = `หัวใจ: ${n}`; }).catch((e) => status(e.message === "User cancelled the requestDevice() chooser." ? "ยกเลิกการเลือกอุปกรณ์" : e.message, true));
        q("#calBtn").onclick = () => { status("ยืนนิ่งบนเท้าข้างที่ติดเซนเซอร์ 3 วินาที…"); IG.live.calibrate(q("#lvSide").value, (ok) => { status(ok ? "ปรับเทียบแรงกดแล้ว" : "ปรับเทียบไม่สำเร็จ: ไม่พบสัญญาณ FSR", !ok); updCal(); }); };
        q("#svNo").onclick = () => (q("#lvSave").hidden = true);
        q("#svOk").onclick = () => {
          const sim = IG.live.S.src === "sim", ha = +q("#svHrA").value, hm = +q("#svHrM").value;
          const num = (id) => { const v = +q(id).value; return v > 0 ? v : null; }, lab = {}, mv = {};
          [["L", "#svML"], ["R", "#svMR"]].forEach(([sd, id]) => { const pre = num(id + "a"), post = num(id + "b"); if (pre || post) mv[sd] = { ...(pre ? { pre } : {}), ...(post ? { post } : {}) }; });
          if (Object.keys(mv).length) lab.mvic = mv;
          const la = num("#svLa"), lb = num("#svLb"); if (la || lb) lab.lactate = { ...(la ? { pre: la } : {}), ...(lb ? { post: lb } : {}) };
          IG.state.sessions.push({ id: IG.uid(), athleteId: a.id, t: Date.now(), activity: q("#svAct").value.trim() || a.sport, durationMin: Math.max(1, +q("#svDur").value || 1), rpe: +q("#svRpe").value, L: lastSum.L, R: lastSum.R, stepsTotal: lastSum.stepsTotal, cadence: lastSum.cadence, fatigue: lastSum.fatigue, hr: ha >= 30 ? { avg: ha, max: hm >= ha ? hm : ha } : null, lab: Object.keys(lab).length ? lab : undefined, source: sim ? "sim" : "sensor", demo: sim || !!a.demo, synced: false });
          IG.save(); IG.db.autoSync();
          IG.toast(sim ? "บันทึกแล้ว (ข้อมูลจำลอง จะไม่ถูกส่งไปฐานข้อมูล)" : "บันทึกเซสชันแล้ว"); go("home");
        };
      },
    };
  }

  /* ---------- บันทึกอาการ ---------- */
  function checkin() {
    const a = IG.curAthlete();
    if (!a) return { html: head("บันทึกอาการ", "") + empty("ยังไม่มีนักกีฬา", "เพิ่มนักกีฬาในหน้าทีมก่อน", `<a class="btn primary" href="#/team">ไปหน้าทีม</a>`) };
    const html = `${head("บันทึกอาการ", `ให้คะแนนความปวดวันนี้ของ ${esc(a.code)} · 0 = ไม่ปวด · 10 = ปวดมากที่สุด`)}
    <form class="card form" id="ckForm">
      <div class="pain-grid"><span></span><b>ซ้าย</b><b>ขวา</b>
      ${IG.SITES.map((s) => `<span class="pn">${s.name}</span>${IG.SIDES.map((sd) => `<div class="pr"><label class="sr" for="p_${s.key}_${sd.key}">${s.name}${sd.name}</label><input type="range" min="0" max="10" value="0" id="p_${s.key}_${sd.key}" data-out="o_${s.key}_${sd.key}"><output id="o_${s.key}_${sd.key}">0</output></div>`).join("")}`).join("")}
      </div>
      <div class="two"><div><label for="ckSleep">นอนเมื่อคืน (ชั่วโมง)</label><input id="ckSleep" type="number" min="0" max="16" step="0.5" value="7"></div>
      <div><label for="ckFat">ความล้าโดยรวม <output id="ckFatO">3</output>/10</label><input id="ckFat" type="range" min="0" max="10" value="3"></div></div>
      <button class="btn primary" type="submit">บันทึกอาการ</button>
    </form>`;
    return {
      html,
      mount(r) {
        r.querySelectorAll("input[type=range][data-out]").forEach((i) => (i.oninput = () => {
          const o = $("#" + i.dataset.out, r); o.textContent = i.value; i.classList.toggle("hi", +i.value >= 4);
        }));
        $("#ckFat", r).oninput = (e) => ($("#ckFatO", r).textContent = e.target.value);
        $("#ckForm", r).onsubmit = (e) => {
          e.preventDefault();
          const pain = {}; IG.SITES.forEach((s) => IG.SIDES.forEach((sd) => (pain[s.key + "_" + sd.key] = +$("#p_" + s.key + "_" + sd.key, r).value)));
          IG.state.checkins.push({ id: IG.uid(), athleteId: a.id, t: Date.now(), pain, sleep: +$("#ckSleep", r).value, fatigue: +$("#ckFat", r).value, demo: !!a.demo, synced: false });
          IG.save(); IG.db.autoSync(); IG.toast("บันทึกอาการแล้ว"); go("home");
        };
      },
    };
  }

  /* ---------- ประวัติ ---------- */
  function history() {
    const a = IG.curAthlete();
    if (!a) return { html: head("ประวัติ", "") + empty("ยังไม่มีนักกีฬา", "เพิ่มนักกีฬาในหน้าทีมก่อน", `<a class="btn primary" href="#/team">ไปหน้าทีม</a>`) };
    const ss = IG.sessionsOf(a.id).reverse();
    const tag = (s) => (s.demo ? `<span class="tag">ตัวอย่าง</span>` : s.synced ? `<span class="tag ok">ส่งแล้ว</span>` : `<span class="tag wait">รอส่ง</span>`);
    const html = `${head("ประวัติ", `${ss.length} เซสชันของ ${esc(a.code)}`, `<button class="btn" id="csv">ส่งออก CSV</button>`)}
    ${ss.length ? `<div class="list">${ss.map((s) => `<article class="card sess"><div class="s-top"><div><h3>${esc(s.activity)}</h3><p class="sub">${IG.fmtDateTime(s.t)} · ${s.durationMin} นาที · เหนื่อย ${s.rpe}/10</p></div>${tag(s)}</div>
      <dl class="kpis small">${[["แรงสูงสุดเฉลี่ย ซ้าย", s.L.peak && s.L.peak + " g"], ["แรงสูงสุดเฉลี่ย ขวา", s.R.peak && s.R.peak + " g"], ["ก้าวรวม", s.stepsTotal || s.L.steps + s.R.steps], ["จังหวะก้าว", s.cadence && s.cadence + "/นาที"],
        ["สัมผัสพื้น ซ้าย/ขวา", s.L.contact || s.R.contact ? `${s.L.contact || "–"}/${s.R.contact || "–"} ms` : ""], ["เท้าเอียง ซ้าย/ขวา", s.L.roll || s.R.roll ? `${s.L.roll || "–"}/${s.R.roll || "–"}°` : ""],
        ["หัวใจเฉลี่ย/สูงสุด", s.hr && `${s.hr.avg}/${s.hr.max}`], ["แรงปลาย vs ต้น", s.fatigue != null && (s.fatigue >= 0 ? "+" : "") + (s.fatigue * 100).toFixed(0) + "%"]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v || "–"}</dd></div>`).join("")}</dl>
      ${labLine(s)}
      <button class="link danger" data-del="${s.id}">ลบเซสชันนี้</button></article>`).join("")}</div>`
      : empty("ยังไม่มีเซสชัน", "เริ่มวัดเซสชันแรกเพื่อดูประวัติและแนวโน้ม", `<a class="btn primary" href="#/record">เริ่มวัดเซสชัน</a>`)}`;
    return {
      html,
      mount(r) {
        const b = $("#csv", r); if (b) b.onclick = () => IG.download(`sessions-${a.code}.csv`, sessionsCsv(IG.sessionsOf(a.id)), "text/csv");
        r.querySelectorAll("[data-del]").forEach((x) => (x.onclick = () => {
          if (!confirm("ลบเซสชันนี้? ทำย้อนกลับไม่ได้")) return;
          IG.state.sessions = IG.state.sessions.filter((s) => s.id !== x.dataset.del); IG.save(); render();
        }));
      },
    };
  }
  function sessionsCsv(ss) {
    const code = (id) => (IG.state.athletes.find((a) => a.id === id) || {}).code;
    const rows = [["athlete", "time", "activity", "duration_min", "rpe", "steps_total", "cadence", "hr_avg", "hr_max", "fatigue_idx", "L_peak_g", "L_rate_gps", "L_steps", "L_contact_ms", "L_roll_deg", "L_force_bw", "R_peak_g", "R_rate_gps", "R_steps", "R_contact_ms", "R_roll_deg", "R_force_bw", "lab_mvic_L_pre", "lab_mvic_L_post", "lab_mvic_R_pre", "lab_mvic_R_post", "lactate_pre", "lactate_post", "source"]];
    ss.forEach((s) => rows.push([code(s.athleteId), new Date(s.t).toISOString(), s.activity, s.durationMin, s.rpe, s.stepsTotal ?? "", s.cadence ?? "", s.hr ? s.hr.avg : "", s.hr ? s.hr.max : "", s.fatigue ?? "", s.L.peak, s.L.rate, s.L.steps, s.L.contact ?? "", s.L.roll ?? "", s.L.force ?? "", s.R.peak, s.R.rate, s.R.steps, s.R.contact ?? "", s.R.roll ?? "", s.R.force ?? "", ...[["mvic", "L", "pre"], ["mvic", "L", "post"], ["mvic", "R", "pre"], ["mvic", "R", "post"]].map(([k, sd, w]) => (s.lab && s.lab[k] && s.lab[k][sd] && s.lab[k][sd][w]) ?? ""), (s.lab && s.lab.lactate && s.lab.lactate.pre) ?? "", (s.lab && s.lab.lactate && s.lab.lactate.post) ?? "", s.source]));
    return "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  }

  /* ---------- ทีม (โค้ช/นักวิจัย) ---------- */
  function team() {
    const rows = IG.state.athletes.map((a) => { const an = IG.risk.analyze(a, IG.sessionsOf(a.id), IG.checkinsOf(a.id)); return { a, an }; }).sort((x, y) => y.an.worst.score - x.an.worst.score);
    const html = `${head("ทีม", `${rows.length} คน เรียงจากความเสี่ยงสูงสุด`, `<button class="btn" id="tcsv">ส่งออก CSV</button>`)}
    ${rows.length ? `<div class="card tbl-wrap"><table class="tbl"><thead><tr><th>นักกีฬา</th><th>ตำแหน่งที่เสี่ยงสุด</th><th>ภาระซ้อม</th><th>ซ้าย-ขวาต่าง</th><th>เซสชันล่าสุด</th><th></th></tr></thead><tbody>
      ${rows.map(({ a, an }) => { const w = an.worst, last = IG.sessionsOf(a.id).slice(-1)[0];
        return `<tr><td data-l="นักกีฬา"><b>${esc(a.code)}</b><br><span class="sub">${esc(a.sport)} · ${a.age} ปี</span></td>
        <td data-l="เสี่ยงสุด">${an.hasData || an.lastCheckin ? `${IG.siteName(w.site)}${IG.sideName(w.side)} ${chip(w.level)} <span class="sub">${w.score}</span>` : `<span class="sub">ยังไม่มีข้อมูล</span>`}</td>
        <td data-l="ภาระซ้อม">${an.acwr == null ? "–" : an.acwr.toFixed(2) + "×"}</td><td data-l="ซ้าย-ขวาต่าง">${an.asym == null ? "–" : an.asym.toFixed(0) + "%"}</td>
        <td data-l="ล่าสุด">${last ? IG.fmtDate(last.t) : "–"}</td><td><button class="btn small" data-view="${a.id}">ดูรายบุคคล</button></td></tr>`; }).join("")}
      </tbody></table></div>` : empty("ยังไม่มีนักกีฬาในทีม", "เพิ่มนักกีฬาด้านล่าง หรือรอเชื่อมต่อฐานข้อมูลเพื่อดึงรายชื่อ")}
    <details class="card add"><summary>เพิ่มนักกีฬา</summary><form class="form" id="addForm">${athleteFields()}<p class="err" id="addErr" hidden></p><button class="btn primary" type="submit">เพิ่มนักกีฬา</button></form></details>`;
    return {
      html,
      mount(r) {
        r.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { IG.state.profile.viewId = b.dataset.view; IG.ui.sel = null; IG.save(); go("home"); }));
        $("#tcsv", r).onclick = () => IG.download("team-summary.csv", teamCsv(rows), "text/csv");
        $("#addForm", r).onsubmit = (e) => {
          e.preventDefault(); const x = readAthlete($("#addForm", r)), err = $("#addErr", r);
          if (x.error) { err.textContent = x.error; err.hidden = false; return; }
          IG.state.athletes.push(x); if (!IG.state.profile.athleteId) IG.state.profile.athleteId = IG.state.profile.viewId = x.id;
          IG.save(); IG.toast("เพิ่มนักกีฬาแล้ว"); render();
        };
      },
    };
  }
  function teamCsv(rows) {
    const out = [["athlete", "sport", "age", "worst_site", "worst_side", "worst_score", "acwr", "asym_pct"]];
    rows.forEach(({ a, an }) => out.push([a.code, a.sport, a.age, an.worst.site, an.worst.side, an.worst.score, an.acwr == null ? "" : an.acwr.toFixed(2), an.asym == null ? "" : an.asym.toFixed(1)]));
    return "﻿" + out.map((r) => r.join(",")).join("\n");
  }

  const SENSOR_CAPS = [
    { ok: 1, t: "แรงกระแทกต่อก้าว อัตราเพิ่มแรง จำนวนก้าว จังหวะก้าว", d: "วัดได้จาก MPU-6050 ที่มีอยู่ ข้อควรระวัง: ติดที่รองเท้าอาจเกินช่วงวัด ±16 g ของตัวเซนเซอร์ ถ้าค่าชนเพดานบ่อย ให้ย้ายไปติดที่หน้าแข้ง" },
    { ok: 1, t: "เวลาสัมผัสพื้นและแรงกดฝ่าเท้า (เชิงเปรียบเทียบ)", d: "วัดได้จาก FSR ปรับเทียบด้วยการยืนนิ่ง 3 วินาทีในหน้า \"วัด\" FSR 1 ตัววัดได้เฉพาะจุดที่แปะ และคลาดเคลื่อนสูง ใช้เทียบกับตัวเองข้ามวันได้ แต่ไม่ใช่ค่านิวตันที่แม่นยำ" },
    { ok: 1, t: "ช่วงเอียงของเท้าตอนลงเท้า (ตัวแทนความเสี่ยงข้อเท้าพลิก)", d: "ประมาณจากไจโรของ MPU-6050 ต้องใช้เฟิร์มแวร์เวอร์ชันใหม่ที่ส่ง gx,gy,gz เป็นค่าคร่าวๆ ไม่ใช่มุมข้อเท้าจริง" },
    { ok: 0, t: "ความต่างซ้าย-ขวา", d: "ต้องมีชุดที่ 2 (ESP32 + MPU-6050 + FSR) ใส่อีกข้าง ตอนนี้วัดได้ข้างเดียวต่อครั้ง ถ้าวัดสลับข้างคนละวัน เทียบกันไม่ได้เพราะความเร็วและพื้นต่างกัน" },
    { ok: 0, t: "อัตราการเต้นหัวใจ", d: "ต้องเพิ่มสายรัดอกแบบ Bluetooth ที่ส่ง Heart Rate มาตรฐาน (เช่น Polar H10) เชื่อมกับแอปตรงๆ ผ่านปุ่ม \"เชื่อมต่อสายรัดอก\" ไม่ต้องแก้บอร์ด ทางเลือกรอง: MAX30102 ต่อ I2C กับ ESP32 แต่ตอนวิ่งแม่นน้อยกว่ามาก" },
    { ok: 0, t: "แรงกระแทกที่หน้าแข้ง (ค่ามาตรฐานในงานวิจัยการวิ่ง)", d: "เพิ่ม MPU-6050 อีกตัวที่หน้าแข้ง ใช้ I2C บัสเดียวกันได้ โดยต่อขา AD0 เข้า 3.3V ให้ที่อยู่เป็น 0x69" },
    { ok: 0, t: "มุมงอของเข่าและข้อเท้าจริง", d: "ต้องมี IMU ที่ต้นขา หน้าแข้ง และเท้า (3 ตัว) แล้วคำนวณมุมระหว่างท่อน ตัวที่ 3 ต้องมีตัวแยกบัส I2C (เช่น TCA9548A) เพราะ MPU-6050 ตั้งที่อยู่ได้แค่ 2 ค่า" },
    { ok: 0, t: "ลักษณะการลงเท้า (ส้น/กลาง/ปลาย) และสมดุลด้านใน-นอก", d: "เพิ่ม FSR อีก 2–3 จุด (ส้นเท้า หัวแม่เท้า ขอบนอก) ใช้ขา ADC เพิ่มบน ESP32 พร้อมตัวต้านทาน 10 kΩ ต่อจุด" },
    { ok: 0, t: "วัดตอนวิ่งจริงแบบไร้สาย", d: "ต้องเพิ่มแบตเตอรี่ LiPo กับโมดูลชาร์จ และเฟิร์มแวร์ที่ส่งผ่าน Wi-Fi หรือ Bluetooth แทนสาย USB ตอนนี้ใช้ได้กับลู่วิ่งหรือห้องแล็บที่มีคอมพิวเตอร์วางใกล้" },
    { ok: -1, t: "สภาพเส้นเอ็น (ร้อยหวาย เอ็นสะบ้า) โดยตรง", d: "ไม่มีเซนเซอร์สวมใส่ตัวไหนวัดสภาพเส้นเอ็นได้ ต้องใช้อัลตราซาวด์ แอปจึงประเมินทางอ้อมจากภาระซ้อม แรงกระแทก และอาการปวด" },
  ];

  /* ---------- เชื่อมต่อฐานข้อมูล ---------- */
  function connect() {
    const c = IG.db.cfg(), ok = IG.db.configured(), n = IG.db.pendingCount();
    const badge = { 1: ["ok", "วัดได้ตอนนี้"], 0: ["need", "ต้องเพิ่มอุปกรณ์"], "-1": ["no", "วัดตรงๆ ไม่ได้"] };
    const html = `${head("เชื่อมต่อ", "ดูว่าเซนเซอร์วัดอะไรได้ และส่งข้อมูลไปฐานข้อมูลมหาวิทยาลัย")}
    <section class="card caps"><h2>ชุดเซนเซอร์ของคุณ</h2><p class="sub">ESP32 · FSR 1 ตัว · MPU-6050 1 ตัว (พร้อมตัวต้านทาน 10 kΩ บรีดบอร์ด สายจัมเปอร์ สาย USB)</p>
      <ul class="cap-list">${SENSOR_CAPS.map((c) => `<li><span class="cap-b ${badge[c.ok][0]}">${badge[c.ok][1]}</span><div><b>${c.t}</b><p>${c.d}</p></div></li>`).join("")}</ul>
      <p class="hint">ลำดับที่แนะนำให้เพิ่ม: 1) สายรัดอกวัดหัวใจ (ไม่ต้องแก้บอร์ด) 2) ชุดเซนเซอร์ชุดที่ 2 เพื่อเทียบซ้าย-ขวา 3) MPU-6050 ที่หน้าแข้ง 4) แบตเตอรี่สำหรับวิ่งจริง รายละเอียดการต่อสายอยู่ใน docs/HARDWARE.md</p></section>
    <div class="grid2">
      <section class="card status-card ${ok ? "ok" : "off"}">
        <h2>${ok ? "ตั้งค่าเซิร์ฟเวอร์แล้ว" : "ยังไม่ได้เชื่อมต่อฐานข้อมูล"}</h2>
        <p>${ok ? `ปลายทาง: ${esc(c.baseUrl)}` : "ข้อมูลทั้งหมดเก็บอยู่ในเครื่องนี้ และจะถูกส่งเมื่อกรอกที่อยู่เซิร์ฟเวอร์ด้านล่าง"}</p>
        <div class="big">${n}</div><p>รายการรอส่ง <span class="sub">(ไม่นับข้อมูลตัวอย่างและโหมดจำลอง)</span></p>
        ${c.lastSync ? `<p class="sub">ส่งล่าสุด ${IG.fmtDateTime(c.lastSync)}</p>` : ""}${c.lastError ? `<p class="err">ส่งไม่สำเร็จ: ${esc(c.lastError)}</p>` : ""}
        <div class="row"><button class="btn primary" id="dbSync" ${ok && n ? "" : "disabled"}>ส่งข้อมูลที่รอส่ง</button></div>
      </section>
      <form class="card form" id="dbForm">
        <h2>ที่อยู่เซิร์ฟเวอร์</h2>
        <label for="dbUrl">Base URL ของ API</label><input id="dbUrl" type="url" placeholder="https://… (ได้จากผู้ดูแลฐานข้อมูล)" value="${esc(c.baseUrl)}">
        <label for="dbTok">โทเคน/คีย์เข้าถึง</label><input id="dbTok" type="password" autocomplete="off" value="${esc(c.token)}">
        <label class="check"><input type="checkbox" id="dbAuto" ${c.autoSync ? "checked" : ""}><span>ส่งอัตโนมัติหลังบันทึกเซสชัน</span></label>
        <p class="hint">โทเคนจะเก็บในเบราว์เซอร์นี้ ใช้เฉพาะเครื่องที่ไว้ใจได้ ระบบจริงควรให้เซิร์ฟเวอร์ออกโทเคนหลังล็อกอิน</p>
        <div class="row"><button class="btn primary" type="submit">บันทึกการตั้งค่า</button><button class="btn" type="button" id="dbTest">ทดสอบการเชื่อมต่อ</button></div>
        <p class="status" id="dbMsg" role="status"></p>
      </form>
    </div>
    <div class="grid2">
      <section class="card"><h2>ข้อมูลที่จะถูกส่ง</h2><ul class="todo"><li>รหัสนักกีฬา อายุ น้ำหนัก ส่วนสูง กีฬา ประวัติบาดเจ็บ</li><li>สรุปเซสชัน: แรงกระแทกสูงสุด อัตราเพิ่มแรง จำนวนก้าว ซ้าย-ขวา เวลา ความหนัก</li><li>คะแนนปวดแต่ละตำแหน่ง การนอน ความล้า</li></ul><p class="hint">ไม่ส่งชื่อจริง และไม่ส่งสัญญาณดิบ ถ้าโครงการต้องการสัญญาณดิบ ต้องเพิ่มช่องทางส่งแยกและขอความยินยอมเพิ่ม</p></section>
      <section class="card"><h2>สำรองข้อมูลเอง</h2><p class="sub">ระหว่างรอเชื่อมต่อ ส่งออกไฟล์ไปให้ผู้ดูแลโครงการได้</p><div class="row"><button class="btn" id="dbJson">ส่งออก JSON</button><button class="btn" id="dbCsv">ส่งออก CSV</button></div>
        <hr><h3>ล้างข้อมูลในเครื่อง</h3><p class="sub">ลบโปรไฟล์ เซสชัน และอาการทั้งหมดในเบราว์เซอร์นี้</p><button class="btn danger" id="dbWipe">ลบข้อมูลทั้งหมดในเครื่อง</button></section>
    </div>`;
    return {
      html,
      mount(r) {
        const msg = (t, bad) => { const m = $("#dbMsg", r); m.textContent = t; m.classList.toggle("bad", !!bad); };
        const saveCfg = () => IG.db.setCfg({ baseUrl: $("#dbUrl", r).value.trim(), token: $("#dbTok", r).value, autoSync: $("#dbAuto", r).checked });
        $("#dbForm", r).onsubmit = (e) => { e.preventDefault(); saveCfg(); IG.toast("บันทึกการตั้งค่าแล้ว"); render(); };
        $("#dbTest", r).onclick = async () => { saveCfg(); msg("กำลังทดสอบ…"); try { await IG.db.test(); msg("เชื่อมต่อได้ เซิร์ฟเวอร์ตอบกลับปกติ"); } catch (e) { msg("เชื่อมต่อไม่ได้: " + e.message, true); } };
        $("#dbSync", r).onclick = async (e) => { e.target.disabled = true; try { const k = await IG.db.sync(); IG.toast(`ส่งแล้ว ${k} รายการ`); } catch (er) { IG.toast("ส่งไม่สำเร็จ: " + er.message); } render(); };
        $("#dbJson", r).onclick = () => IG.download("injuryguard-export.json", JSON.stringify({ athletes: IG.state.athletes.filter((a) => !a.demo), sessions: IG.state.sessions.filter((s) => !s.demo), checkins: IG.state.checkins.filter((c) => !c.demo) }, null, 1), "application/json");
        $("#dbCsv", r).onclick = () => IG.download("sessions.csv", sessionsCsv(IG.state.sessions.filter((s) => !s.demo)), "text/csv");
        $("#dbWipe", r).onclick = () => { if (confirm("ลบข้อมูลทั้งหมดในเครื่องนี้? ทำย้อนกลับไม่ได้")) { ["profile", "athletes", "sessions", "checkins"].forEach((k) => IG.store.del("ig." + k)); IG.state = { profile: null, athletes: [], sessions: [], checkins: [] }; IG.ui.sel = null; go("home"); } };
      },
    };
  }

  function refs() {
    const html = `${head("แหล่งอ้างอิง", "งานวิจัยและสูตรที่แอปนี้ใช้ พร้อมสิ่งที่ยังไม่มีหลักฐานรองรับ", `<a class="btn" href="#/home">กลับ</a>`)}
    <article class="card ref"><span class="tag ok">ตีพิมพ์แล้ว · ผ่าน peer review</span>
      <h2>[1] Indicators of Neuromuscular, Metabolic and Perceptual Fatigue Following a 5 km Run</h2>
      <p class="sub">Findrik K, Šušnjara P, Kuna D. <i>Sports (Basel)</i> 2026;14(7):262 · doi:10.3390/sports14070262 · PMCID PMC13418486</p>
      <p><a href="https://doi.org/10.3390/sports14070262" target="_blank" rel="noopener noreferrer">เปิดบทความ</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC13418486/" target="_blank" rel="noopener noreferrer">ฉบับเต็มบน PMC</a></p>
      <h3>งานนี้ทำอะไร</h3>
      <p>นักวิ่งชายสันทนาการ 21 คน (อายุเฉลี่ย 35 ปี) วิ่ง 5 กม. ความหนักสูงกลางแจ้ง แล้ววัดก่อน-หลังวิ่ง เวลาเฉลี่ย 20:05 นาที หัวใจเฉลี่ย 165 ± 16 bpm สูงสุด 180 ± 16 bpm ความรู้สึกเหนื่อย (Borg CR10) 8.3 ± 1.2</p>
      <div class="tbl-wrap in"><table class="tbl plain"><thead><tr><th>ตัวแปร</th><th>ก่อนวิ่ง</th><th>หลังวิ่ง</th><th>p</th></tr></thead><tbody>
        <tr><td data-l="ตัวแปร">แลคเตตในเลือด (mmol/L)</td><td data-l="ก่อน">0.8 ± 0.4</td><td data-l="หลัง">6.9 ± 1.4</td><td data-l="p">&lt; 0.001</td></tr>
        <tr><td data-l="ตัวแปร">แรงบีบสูงสุด quadriceps ขวา (MVIC, N)</td><td data-l="ก่อน">305 ± 99</td><td data-l="หลัง">259 ± 88</td><td data-l="p">0.002</td></tr>
        <tr><td data-l="ตัวแปร">แรงบีบสูงสุด quadriceps ซ้าย (MVIC, N)</td><td data-l="ก่อน">265 ± 97</td><td data-l="หลัง">241 ± 87</td><td data-l="p">0.103 (ไม่มีนัยสำคัญ)</td></tr>
        <tr><td data-l="ตัวแปร">ความหนากล้ามเนื้อ rectus femoris (mm)</td><td data-l="ก่อน">17.7 ± 2.9</td><td data-l="หลัง">17.8 ± 2.9</td><td data-l="p">0.562</td></tr></tbody></table></div>
      <h3>แอปนำมาใช้อย่างไร</h3>
      <ul class="todo"><li>ความรู้สึกเหนื่อยใช้มาตรา Borg CR10 (0–10) เหมือนงานนี้</li><li>บันทึกหัวใจ (งานนี้ใช้สายรัดอก Polar H10 ซึ่งแอปเชื่อมได้) คู่กับความรู้สึกเหนื่อย</li><li>ช่องข้อมูลห้องปฏิบัติการแบบไม่บังคับ: แรงบีบ MVIC และแลคเตต ก่อน-หลัง และกรอกแยกซ้าย-ขวา เพราะงานนี้พบผลเฉพาะขาขวา</li><li>การ์ด "ความล้าหลังซ้อมล่าสุด" รวมหลายมิติเข้าด้วยกัน ตามข้อเสนอของผู้เขียน</li><li>ตัวเลขจากงานนี้แสดงเป็น "บริบท" เท่านั้น ไม่ใช้เป็นเกณฑ์ปกติหรือเกณฑ์ตัดสิน</li></ul>
      <h3>สิ่งที่งานนี้ไม่ได้บอก</h3>
      <ul class="todo"><li>ไม่ได้ศึกษาการบาดเจ็บของข้อเท้า หัวเข่า หรือเส้นเอ็น และไม่ได้วัดแรงกระแทกหรือชีวกลศาสตร์การวิ่ง จึง<b>ไม่ใช่หลักฐานว่าคะแนนความเสี่ยงของแอปทำนายการบาดเจ็บได้</b></li><li>ดัชนีแรงท้ายเซสชันเทียบต้นเซสชันจากเซนเซอร์ เป็นแนวคิดทดลองของแอป ไม่ได้มาจากงานนี้</li><li>กลุ่มตัวอย่างเล็ก (21 คน) เป็นชายสันทนาการ และวัดครั้งเดียว ไม่ติดตาม 24–48 ชั่วโมง ใช้กับนักวิ่งหญิง นักกีฬาระดับสูง หรือกีฬาอื่นไม่ได้โดยตรง</li><li>แรงบีบขวาลดอย่างมีนัยสำคัญ แต่ซ้ายไม่ ผู้เขียนระบุว่าความถนัดขาเป็นการรายงานเอง จึงยืนยันความไม่สมมาตรไม่ได้</li></ul>
      <p class="hint">ตัวเลขในตารางเทียบกับหน้า PMC เมื่อ 20 ต.ค. 2026 แล้วตรงกัน ถ้าจะอ้างอิงในงานวิชาการ ให้ตรวจกับต้นฉบับอีกครั้ง Preprint ของงานเดียวกัน (Preprints.org 202605.1555) ถูกแทนที่ด้วยฉบับตีพิมพ์นี้แล้ว จึงไม่ใช้เป็นแหล่งอ้างอิง</p>
    </article>
    <article class="card ref"><h2>สูตรทั่วไปที่ใช้ ยังไม่มีไฟล์อ้างอิงในโครงการ</h2>
      <ul class="todo"><li>หัวใจสูงสุดโดยประมาณ = 208 − 0.7 × อายุ (สูตรของ Tanaka และคณะ 2001) ในงาน [1] หัวใจสูงสุดเฉลี่ย 180 ใกล้กับค่าจากสูตรที่อายุ 35 ปี (ประมาณ 183) เป็นข้อสังเกตของเรา ไม่ใช่การพิสูจน์สูตร</li><li>ภาระซ้อม = ความรู้สึกเหนื่อย × นาที และอัตราส่วนภาระ 7 วันต่อ 28 วัน แนวคิดทั่วไปในวิทยาศาสตร์การกีฬา ช่วงเกณฑ์ในแอป (พอดี 0.8–1.3, สูงเกินไป &gt; 1.5) เป็นค่าตั้งต้นที่ปรับได้</li><li>เกณฑ์แรงกระแทก อัตราเพิ่มแรง ความต่างซ้าย-ขวา ช่วงเอียงของเท้า และน้ำหนักแต่ละปัจจัยในคะแนนความเสี่ยง ตั้งเองใน js/risk.js ยังไม่ผ่านการตรวจสอบกับข้อมูลบาดเจ็บจริง</li></ul>
      <p class="hint">ถ้าจะใช้ในงานวิจัย ควรเพิ่มไฟล์สรุปแหล่งอ้างอิงของแต่ละข้อลงโฟลเดอร์ แล้วอัปเดตหน้านี้</p></article>`;
    return { html };
  }

  IG.views = { refs, onboarding, home, record, checkin, history, team, connect };
})();
