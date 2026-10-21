/* ตัวสลับหน้า + เมนู */
const NAV = {
  athlete: [["home", "ภาพรวม", "home"], ["record", "วัด", "pulse"], ["checkin", "อาการ", "clipboard"], ["history", "ประวัติ", "history"], ["connect", "เชื่อมต่อ", "link"]],
  coach: [["team", "ทีม", "users"], ["home", "รายบุคคล", "home"], ["history", "ประวัติ", "history"], ["connect", "เชื่อมต่อ", "link"]],
};

function current() {
  const r = (location.hash.replace(/^#\/?/, "") || "").split("?")[0];
  if (r === "refs") return "refs";
  if (!IG.state.profile) return "onboarding";
  const ok = NAV[IG.role()].map((n) => n[0]);
  if (ok.includes(r)) return r;
  return IG.role() === "coach" ? "team" : "home";
}
function go(r) {
  if (location.hash === "#/" + r) render(); else location.hash = "#/" + r;
}
function render() {
  IG.live.unmount();
  const route = current(), view = IG.views[route](), el = IG.$("#view");
  el.innerHTML = view.html;
  if (view.mount) view.mount(el);
  const nav = IG.state.profile ? NAV[IG.role()] : [];
  const item = (n, cls) => `<a class="${cls}" href="#/${n[0]}" ${n[0] === route ? 'aria-current="page"' : ""}>${IG.icon(n[2])}<span>${n[1]}</span></a>`;
  IG.$("#nav").innerHTML = nav.map((n) => item(n, "nav-i")).join("");
  IG.$("#tabbar").innerHTML = nav.map((n) => item(n, "tab-i")).join("");
  IG.$("#roleBox").innerHTML = IG.roleBox("side") + `<a class="ref-link" href="#/refs">แหล่งอ้างอิง</a>`;
  document.body.dataset.route = route;
  document.title = "InjuryGuard – " + (route === "refs" ? "แหล่งอ้างอิง" : (nav.find((n) => n[0] === route) || [0, "เริ่มต้น"])[1]);
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); IG.$("#view").focus({ preventScroll: true }); });

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-role]"); if (!b || !IG.state.profile) return;
  IG.state.profile.role = b.dataset.role;
  if (b.dataset.role === "coach" && !IG.state.profile.viewId) IG.state.profile.viewId = IG.state.profile.athleteId || (IG.state.athletes[0] || {}).id;
  IG.save(); IG.ui.sel = null; location.hash = "#/" + (b.dataset.role === "coach" ? "team" : "home"); render();
});
document.addEventListener("change", (e) => {
  if (!e.target.classList.contains("athSel")) return;
  IG.state.profile.viewId = e.target.value; IG.ui.sel = null; IG.save(); render();
});

// เปลี่ยนขนาดจอข้ามเกณฑ์จอแคบ/กว้าง (หมุนจอ ย่อหน้าต่าง) ให้วาดกราฟใหม่ แต่ไม่รบกวนหน้าวัดที่กำลังทำงาน
let narrow = IG.chart.narrow(), rt;
window.addEventListener("resize", () => {
  clearTimeout(rt);
  rt = setTimeout(() => { const n = IG.chart.narrow(); if (n !== narrow) { narrow = n; if (current() !== "record") render(); } }, 200);
});

render();
IG.db.autoSync();
