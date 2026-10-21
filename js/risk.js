/* โมเดลประเมินความเสี่ยง – สูตรคะแนนแบบถ่วงน้ำหนักที่เปิดดูได้ทุกค่า
   ไม่ใช่โมเดลที่ผ่านการวิจัย/ตรวจสอบทางคลินิก: ใช้เป็นจุดตั้งต้น แล้วปรับ CFG และ W ให้ตรงกับข้อมูลจริงของโครงการ
   (เมื่อมีข้อมูลบาดเจ็บจริงจากมหาวิทยาลัย ควรแทนที่ด้วยโมเดลที่ฝึกจากข้อมูลนั้น) */
(function () {
  const { clamp, mean, DAY } = IG;

  // [ต่ำสุดที่เริ่มนับ, สูงสุดที่ถือว่าเต็ม] – แรงกระแทกหน่วย g (เซนเซอร์ที่หน้าแข้ง/เท้า) อัตราเพิ่มหน่วย g/วินาที
  const CFG = {
    peak: [4, 12], rate: [150, 600], asym: [8, 30], roll: [8, 25], acwr: [1.0, 1.7], trend: [0.05, 0.35],
    painFloor: [[6, 60], [4, 40]], // ปวด ≥6 → คะแนนไม่ต่ำกว่า 60, ปวด ≥4 → ไม่ต่ำกว่า 40
    levels: [20, 40, 60], // ต่ำ <20 · เฝ้าระวัง <40 · สูง <60 · สูงมาก ≥60
  };
  // น้ำหนักแต่ละปัจจัยต่อตำแหน่ง (รวมกันได้ 1)
  const W = {
    ankle:    { peak: .15, rate: .10, asym: .15, acwr: .15, pain: .20, hist: .15, roll: .10 },
    knee:     { peak: .15, rate: .25, asym: .15, acwr: .15, pain: .20, hist: .10 },
    achilles: { peak: .10, rate: .20, asym: .10, acwr: .25, pain: .25, hist: .10 },
    patellar: { peak: .25, rate: .15, asym: .10, acwr: .20, pain: .20, hist: .10 },
  };
  const norm = (v, [lo, hi]) => clamp((v - lo) / (hi - lo));
  const levelOf = (s) => (s < CFG.levels[0] ? 0 : s < CFG.levels[1] ? 1 : s < CFG.levels[2] ? 2 : 3);

  function winMean(ss, side, key, from, to) {
    const xs = ss.filter((s) => s.t >= from && s.t < to && s[side] && s[side][key] > 0);
    if (!xs.length) return null;
    const wt = xs.reduce((a, s) => a + (s[side].steps || 1), 0);
    return xs.reduce((a, s) => a + s[side][key] * (s[side].steps || 1), 0) / wt;
  }

  function analyze(athlete, sessions, checkins, now = Date.now()) {
    const load = (s) => s.rpe * s.durationMin;
    const acute = sessions.filter((s) => s.t > now - 7 * DAY).reduce((a, s) => a + load(s), 0);
    const chronic = sessions.filter((s) => s.t > now - 28 * DAY).reduce((a, s) => a + load(s), 0) / 4;
    const acwr = chronic > 0 && sessions.filter((s) => s.t < now - 7 * DAY).length >= 3 ? acute / chronic : null;

    const rec = {}, base = {}, hasData = sessions.some((s) => s.t > now - 14 * DAY);
    ["L", "R"].forEach((sd) => {
      rec[sd] = { peak: winMean(sessions, sd, "peak", now - 14 * DAY, now + 1), rate: winMean(sessions, sd, "rate", now - 14 * DAY, now + 1), roll: winMean(sessions, sd, "roll", now - 14 * DAY, now + 1) };
      base[sd] = winMean(sessions, sd, "peak", now - 42 * DAY, now - 14 * DAY);
    });
    const pL = rec.L.peak, pR = rec.R.peak;
    const asym = pL && pR ? (Math.abs(pL - pR) / ((pL + pR) / 2)) * 100 : null;
    const heavier = pL && pR ? (pL >= pR ? "L" : "R") : null;

    const lastCk = checkins.filter((c) => c.t > now - 7 * DAY).slice(-1)[0];
    const bySite = [];
    IG.SITES.forEach((site) => IG.SIDES.forEach((sdo) => {
      const sd = sdo.key, w = W[site.key];
      const peak = rec[sd].peak, rate = rec[sd].rate;
      const trend = peak && base[sd] ? peak / base[sd] - 1 : null;
      const pain = lastCk ? lastCk.pain[site.key + "_" + sd] || 0 : null;
      const hist = !!(athlete && athlete.history && athlete.history[site.key]);
      const f = {
        peak: peak ? Math.max(norm(peak, CFG.peak), trend != null ? norm(trend, CFG.trend) * 0.8 : 0) : 0,
        rate: rate ? norm(rate, CFG.rate) : 0,
        asym: asym != null ? norm(asym, CFG.asym) * (sd === heavier ? 1 : 0.5) : 0,
        acwr: acwr != null ? norm(acwr, CFG.acwr) : 0,
        pain: pain != null ? pain / 10 : 0,
        hist: hist ? 1 : 0,
        roll: rec[sd].roll ? norm(rec[sd].roll, CFG.roll) : 0,
      };
      let score = 100 * Object.keys(w).reduce((a, k) => a + w[k] * f[k], 0);
      if (pain != null) for (const [p, floor] of CFG.painFloor) if (pain >= p) { score = Math.max(score, floor); break; }
      score = Math.round(Math.min(100, score));
      const val = {
        peak: peak ? `${peak.toFixed(1)} g${trend != null && trend > CFG.trend[0] ? ` (สูงกว่าปกติของคุณ ${Math.round(trend * 100)}%)` : ""}` : "ยังไม่มีข้อมูล",
        rate: rate ? `${Math.round(rate)} g/วินาที` : "ยังไม่มีข้อมูล",
        asym: asym != null ? `ต่างกัน ${asym.toFixed(0)}%` : "ยังไม่มีข้อมูล",
        acwr: acwr != null ? `${acwr.toFixed(2)} เท่าของปกติ` : "ข้อมูลยังไม่พอ",
        pain: pain != null ? `${pain}/10` : "ยังไม่ได้บันทึกอาการ",
        hist: hist ? "เคยบาดเจ็บ" : "ไม่เคย",
        roll: rec[sd].roll ? `เอียง ${rec[sd].roll.toFixed(0)}°` : "ไม่มีไจโร",
      };
      const label = { peak: "แรงกระแทกสูงสุดเฉลี่ย", rate: "อัตราเพิ่มแรงกระแทก", asym: "ความต่างซ้าย-ขวา", acwr: "ภาระซ้อมสัปดาห์นี้เทียบปกติ", pain: "ระดับปวดที่รายงาน", hist: "ประวัติบาดเจ็บ", roll: "ช่วงเอียงของเท้าตอนลงเท้า" };
      const drivers = Object.keys(w).filter((k) => w[k] > 0).map((k) => ({ key: k, label: label[k], text: val[k], f: f[k], contrib: Math.round(100 * w[k] * f[k]) })).sort((a, b) => b.contrib - a.contrib);
      bySite.push({ site: site.key, side: sd, score, level: levelOf(score), drivers, pain });
    }));
    const worst = bySite.reduce((a, b) => (b.score > a.score ? b : a), bySite[0]);
    return { acwr, acute, chronic, asym, heavier, peakL: pL, peakR: pR, hasData, bySite, worst, lastCheckin: lastCk || null };
  }

  const ADVICE = {
    acwr: "ภาระซ้อมพุ่งเร็วกว่าที่ร่างกายคุ้นเคย ลดปริมาณซ้อมลงราว 20–30% สัปดาห์นี้ แล้วค่อยเพิ่มไม่เกิน 10% ต่อสัปดาห์",
    asym: "แรงลงเท้าสองข้างไม่เท่ากัน ฝึกความแข็งแรงขาข้างที่รับน้อยกว่า และให้โค้ชดูท่าลงเท้า",
    peak: "แรงกระแทกสูง ลองซ้อมบนพื้นที่นุ่มลง และตรวจสภาพรองเท้า (รองเท้าวิ่งมักเสื่อมที่ราว 600–800 กม.)",
    rate: "แรงเพิ่มขึ้นเร็วในช่วงลงเท้า ฝึกลงเท้าให้นุ่มขึ้น เพิ่มจังหวะก้าวให้ถี่ขึ้นเล็กน้อย",
    pain: "มีอาการปวดที่รายงาน ลดความหนักของการซ้อมบริเวณนี้ ถ้าปวดต่อเนื่องเกิน 3 วันหรือปวดตอนพัก ควรพบนักกายภาพบำบัดหรือแพทย์เวชศาสตร์การกีฬา",
    roll: "เท้าเอียงเข้า-ออกมากตอนลงเท้า ฝึกความมั่นคงข้อเท้า (ทรงตัวขาเดียว ยางยืดรอบข้อเท้า) และตรวจรองเท้าว่ารองรับพอดีไหม",
    hist: "เคยบาดเจ็บบริเวณนี้มาก่อน ควรวอร์มอัปและฝึกความมั่นคงของข้อให้ครบก่อนซ้อมทุกครั้ง",
  };
  const SITE_TIP = {
    ankle: "ฝึกการทรงตัวขาเดียวและความแข็งแรงข้อเท้าด้านข้าง",
    knee: "เสริมความแข็งแรงต้นขาด้านหน้า-หลังและสะโพก เพื่อลดแรงที่เข่า",
    achilles: "ฝึกยกส้นเท้าแบบลงช้า (eccentric calf raise) ตามที่นักกายภาพแนะนำ",
    patellar: "ลดการกระโดดและลงน้ำหนักซ้ำๆ ชั่วคราว และเสริมต้นขาด้านหน้า",
  };
  function advice(item) {
    const out = item.drivers.filter((d) => d.contrib >= 5).slice(0, 3).map((d) => ADVICE[d.key]);
    if (item.level >= 1) out.push(SITE_TIP[item.site]);
    if (!out.length) out.push("ยังไม่พบสัญญาณเสี่ยงเด่น ซ้อมต่อได้ตามแผนและบันทึกอาการสม่ำเสมอ");
    return out;
  }

  IG.risk = { analyze, advice, CFG, W, levelOf };
})();
