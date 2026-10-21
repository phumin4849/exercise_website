/* กราฟ SVG เบาๆ ไม่พึ่งไลบรารี */
(function () {
  let W = 640, H = 220, M = { l: 38, r: 10, t: 10, b: 24 };
  const narrow = () => window.innerWidth < 600;
  // จอแคบใช้ผืนวาดที่เล็กลง ตัวอักษรในกราฟจึงไม่หดจนอ่านไม่ออก
  const dims = () => { if (narrow()) { W = 360; H = 240; M = { l: 34, r: 8, t: 10, b: 26 }; } else { W = 640; H = 220; M = { l: 38, r: 10, t: 10, b: 24 }; } };

  // series: [{name, cls, pts:[{t, v}]}] – เส้นแยกด้วยคลาส (สี+ลายเส้น เพื่อไม่พึ่งสีอย่างเดียว)
  function line(series, o = {}) {
    dims();
    const all = series.flatMap((s) => s.pts);
    if (!all.length) return `<div class="empty-chart">ยังไม่มีข้อมูลให้แสดงกราฟ</div>`;
    const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t), t0 + 1);
    let lo = o.min != null ? o.min : Math.min(...all.map((p) => p.v)), hi = o.max != null ? o.max : Math.max(...all.map((p) => p.v));
    if (hi - lo < 1e-6) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.1; if (o.min == null) lo -= pad; if (o.max == null) hi += pad;
    const x = (t) => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r);
    const y = (v) => H - M.b - ((v - lo) / (hi - lo)) * (H - M.t - M.b);
    let g = "";
    for (let i = 0; i <= 3; i++) {
      const v = lo + ((hi - lo) * i) / 3;
      g += `<line class="grid" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${M.l - 6}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(o.dec ?? 1)}</text>`;
    }
    for (let i = 0; i <= 3; i++) {
      const t = t0 + ((t1 - t0) * i) / 3;
      g += `<text class="tick" x="${x(t)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === 3 ? "end" : "middle"}">${IG.fmtDate(t)}</text>`;
    }
    let bands = "";
    (o.bands || []).forEach((b) => {
      const a = y(Math.min(b.to, hi)), c = y(Math.max(b.from, lo));
      if (c > a) bands += `<rect class="band ${b.cls}" x="${M.l}" y="${a}" width="${W - M.l - M.r}" height="${c - a}"/>`;
    });
    const paths = series.map((s) => {
      const pts = s.pts.slice().sort((a, b) => a.t - b.t);
      const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
      const dots = pts.length <= 40 ? pts.map((p) => `<circle class="dot ${s.cls}" cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="2.6"/>`).join("") : "";
      return `<path class="ln ${s.cls}" d="${d}"/>${dots}`;
    }).join("");
    const legend = series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i class="sw ${s.cls}"></i>${IG.esc(s.name)}</span>`).join("")}</div>` : "";
    return `${legend}<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${IG.esc(o.label || "กราฟ")}">${bands}${g}${paths}</svg>`;
  }

  // แท่งภาระซ้อมรายสัปดาห์
  function bars(items, o = {}) {
    dims();
    if (!items.length) return `<div class="empty-chart">ยังไม่มีข้อมูล</div>`;
    const max = Math.max(...items.map((i) => i.v), 1), bw = (W - M.l - M.r) / items.length;
    let s = "";
    items.forEach((it, i) => {
      const h = (it.v / max) * (H - M.t - M.b - 14), bx = M.l + i * bw + bw * 0.18;
      s += `<rect class="bar ${it.cls || ""}" x="${bx}" y="${H - M.b - h}" width="${bw * 0.64}" height="${h}" rx="3"/>`;
      s += `<text class="tick" x="${bx + bw * 0.32}" y="${H - M.b - h - 5}" text-anchor="middle">${Math.round(it.v)}</text>`;
      s += `<text class="tick" x="${bx + bw * 0.32}" y="${H - 6}" text-anchor="middle">${IG.esc(it.label)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${IG.esc(o.label || "กราฟแท่ง")}"><line class="grid" x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}"/>${s}</svg>`;
  }

  IG.chart = { line, bars, narrow };
})();
