/* แผนที่ขา – มองจากด้านหน้า (ซ้ายของนักกีฬาอยู่ด้านขวาของภาพ) จุดสีบอกระดับความเสี่ยงของแต่ละตำแหน่ง */
(function () {
  const legPath = (cx) =>
    `M${cx - 36},0 C${cx - 38},60 ${cx - 30},110 ${cx - 28},140 C${cx - 34},190 ${cx - 34},230 ${cx - 24},300 C${cx - 20},330 ${cx - 18},345 ${cx - 18},360 L${cx - 26},392 C${cx - 40},404 ${cx - 44},416 ${cx - 36},424 L${cx + 34},424 C${cx + 40},410 ${cx + 30},396 ${cx + 20},388 L${cx + 17},360 C${cx + 17},345 ${cx + 20},330 ${cx + 24},300 C${cx + 34},230 ${cx + 34},190 ${cx + 28},140 C${cx + 30},110 ${cx + 38},60 ${cx + 36},0 Z`;
  const POS = { patellar: 168, knee: 134, achilles: 322, ankle: 362 };
  const CX = { R: 92, L: 228 };

  function render(analysis, sel) {
    const byKey = {};
    analysis.bySite.forEach((b) => (byKey[b.site + "_" + b.side] = b));
    let dots = "";
    IG.SIDES.forEach((sd) => IG.SITES.forEach((st) => {
      const b = byKey[st.key + "_" + sd.key], cx = CX[sd.key] + (st.key === "achilles" ? (sd.key === "L" ? 6 : -6) : 0), cy = POS[st.key];
      const on = sel === st.key + "_" + sd.key;
      dots += `<g class="hot lv${b.level}${on ? " on" : ""}" data-pick="${st.key}_${sd.key}" role="button" tabindex="0" aria-label="${st.name}${sd.name} ความเสี่ยง${IG.LEVELS[b.level]} ${b.score} คะแนน" aria-pressed="${on}">
        <circle class="hit" cx="${cx}" cy="${cy}" r="22"/>${b.level >= 2 ? `<circle class="halo" cx="${cx}" cy="${cy}" r="14"/>` : ""}
        <circle class="core" cx="${cx}" cy="${cy}" r="${on ? 13 : 10}"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle">${b.score}</text></g>`;
    }));
    return `<svg class="body" viewBox="0 0 320 440" role="group" aria-label="แผนที่ความเสี่ยงของขาซ้ายและขวา">
      <path class="leg" d="${legPath(CX.R)}"/><path class="leg" d="${legPath(CX.L)}"/>
      <text class="side-t" x="${CX.R}" y="438" text-anchor="middle">ขวา</text><text class="side-t" x="${CX.L}" y="438" text-anchor="middle">ซ้าย</text>
      ${dots}</svg>`;
  }
  IG.bodymap = { render };
})();
