/* ==========================================================================
   CoffeeLab — diário de barista
   JavaScript puro, sem dependências. Conversa com server.py via /api.
   ========================================================================== */
"use strict";

/* ------------------------------------------------------------------ API */
const api = {
  async req(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || "Erro " + res.status);
    return data;
  },
  get: (u) => api.req("GET", u),
  post: (u, b) => api.req("POST", u, b || {}),
  put: (u, b) => api.req("PUT", u, b || {}),
  del: (u) => api.req("DELETE", u),
};

/* --------------------------------------------------------------- estado */
const S = { coffees: [], bags: [], brews: [], equipment: [], settings: {}, ready: false };

async function loadState() {
  const d = await api.get("/api/state");
  Object.assign(S, d, { ready: true });
}

async function refresh() {
  await loadState();
  render();
}

/* ------------------------------------------------------------ constantes */
const METHODS = [
  { id: "espresso", name: "Espresso", kind: "espresso" },
  { id: "v60", name: "V60", kind: "pour" },
  { id: "kalita", name: "Kalita", kind: "pour" },
  { id: "chemex", name: "Chemex", kind: "pour" },
  { id: "melitta", name: "Melitta", kind: "pour" },
  { id: "prensa", name: "Prensa", kind: "immersion" },
  { id: "moka", name: "Moka", kind: "moka" },
  { id: "aeropress", name: "AeroPress", kind: "immersion" },
  { id: "clever", name: "Clever", kind: "immersion" },
  { id: "coldbrew", name: "Cold Brew", kind: "cold" },
  { id: "outro", name: "Outro", kind: "pour" },
];
const METHOD = Object.fromEntries(METHODS.map((m) => [m.id, m]));

const DEFAULT_RATIO = { espresso: 2, v60: 16, kalita: 16, chemex: 16, melitta: 15, prensa: 15, moka: 9, aeropress: 14, clever: 15, coldbrew: 8, outro: 15 };

const ROASTS = ["Clara", "Média-clara", "Média", "Média-escura", "Escura"];
const ROAST_COLORS = ["#c99463", "#a26a3c", "#7a4a26", "#4f2e17", "#2a170c"];

const BAG_COLORS = ["#1b1714", "#efe6d8", "#a86b3c", "#6b3f20", "#c9b79c", "#3a4a3b", "#2f3e52", "#8a2f2a", "#d9a55a"];
const LABEL_COLORS = ["#efe6d8", "#1b1714", "#a86b3c", "#f6f1ea", "#c88f5a"];
const SHAPES = [
  { id: "pouch", name: "Stand-up" },
  { id: "box", name: "Fundo reto" },
  { id: "kraft", name: "Kraft" },
  { id: "tin", name: "Lata" },
];

const FLAVORS = ["Chocolate", "Caramelo", "Nozes", "Mel", "Frutado", "Frutas vermelhas", "Cítrico", "Floral", "Especiarias", "Baunilha", "Doce", "Encorpado", "Sedoso", "Equilibrado", "Ácido demais", "Amargo", "Aguado", "Adstringente", "Queimado", "Terroso"];
const SENSORY = [["acidez", "Acidez"], ["docura", "Doçura"], ["corpo", "Corpo"], ["amargor", "Amargor"]];
const PROCESSES = ["Natural", "Lavado", "Cereja descascado", "Honey", "Fermentado", "Anaeróbico", "Outro"];

const POUR_STAGES = [
  { t: 0, label: "Bloom", pct: 0.15 },
  { t: 45, label: "1º despejo", pct: 0.5 },
  { t: 80, label: "2º despejo", pct: 0.75 },
  { t: 110, label: "Despejo final", pct: 1 },
  { t: 150, label: "Drenando…", pct: 1 },
  { t: 195, label: "Pronto", pct: 1 },
];

/* ---------------------------------------------------------------- ícones */
const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  pantry: '<path d="M7 3h10l1 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7z"/><path d="M6 7h12M10 11h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  bag: '<path d="M6 7h12l-1 14H7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  // métodos
  m_espresso: '<path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2M4 21h14M9 3v3M12 3v3"/>',
  m_pour: '<path d="M4 6h16l-6 8h-4z"/><path d="M10 14v3h4v-3M7 21h10"/>',
  m_immersion: '<rect x="6" y="6" width="11" height="15" rx="1.5"/><path d="M11.5 2v10M8 2h7M17 9h2v7h-2"/>',
  m_moka: '<path d="M7 3h10l-2 7H9z"/><path d="M9 10 7 21h10l-2-11M17 5h2l-1 4"/>',
  m_cold: '<path d="M7 3h10v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M7 9h10M10 13l2 2 2-2"/>',
};
const ic = (name, cls) => `<svg viewBox="0 0 24 24" class="${cls || ""}" aria-hidden="true">${I[name] || ""}</svg>`;
const methodIcon = (id) => ic("m_" + ((METHOD[id] || METHOD.outro).kind));

/* ----------------------------------------------------------- utilitários */
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : d; };
const round = (v, p = 1) => Math.round(v * 10 ** p) / 10 ** p;
const fmtN = (v, p = 1) => (v == null || !isFinite(v) ? "—" : round(v, p).toLocaleString("pt-BR", { maximumFractionDigits: p }));
const fmtG = (v) => (v >= 1000 ? fmtN(v / 1000, 2) + " kg" : fmtN(v, v < 10 ? 1 : 0) + " g");
const fmtMoney = (v) => (v == null || !isFinite(v) ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const fmtTime = (s) => { s = Math.max(0, Math.round(num(s))); const m = Math.floor(s / 60); return m + ":" + String(s % 60).padStart(2, "0"); };
const parseTime = (t) => { if (t == null || t === "") return null; const str = String(t).trim(); if (str.includes(":")) { const [m, s] = str.split(":"); return num(m) * 60 + num(s); } return num(str); };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const dayKey = (iso) => new Date(iso).toLocaleDateString("sv-SE");
const DAY = 86400000;

function fmtDate(iso, opts) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", opts || { day: "2-digit", month: "short" });
}
function fmtDayLabel(iso) {
  const d = new Date(iso), today = new Date();
  const diff = Math.round((new Date(dayKey(today)) - new Date(dayKey(d))) / DAY);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return d.toLocaleDateString("pt-BR", { weekday: "long" });
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}
function fmtClock(iso) { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
function toLocalInput(iso) { const d = iso ? new Date(iso) : new Date(); const off = d.getTimezoneOffset(); return new Date(d - off * 60000).toISOString().slice(0, 16); }
function daysSince(dateStr) { if (!dateStr) return null; return Math.floor((Date.now() - new Date(dateStr + (dateStr.length <= 10 ? "T12:00:00" : "")).getTime()) / DAY); }

function ratingWord(r) {
  if (r == null) return "";
  if (r >= 9.5) return "Inesquecível";
  if (r >= 8.5) return "Excelente";
  if (r >= 7.5) return "Muito bom";
  if (r >= 6.5) return "Bom";
  if (r >= 5) return "Ok";
  if (r >= 3) return "Fraco";
  return "Pra esquecer";
}

function toast(msg, bad) {
  const t = document.createElement("div");
  t.className = "toast" + (bad ? " bad" : "");
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.style.transition = "opacity .3s"; t.style.opacity = "0"; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

async function safe(fn) {
  try { return await fn(); } catch (e) { console.error(e); toast(e.message || "Algo deu errado", true); }
}

/* -------------------------------------------------------- consultas */
const coffeeById = (id) => S.coffees.find((c) => c.id === id);
const bagsOf = (cid) => S.bags.filter((b) => b.coffee_id === cid).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
const aliveBags = (cid) => bagsOf(cid).filter((b) => b.status !== "finished" && num(b.remaining_g) > 0);
const brewsOf = (cid) => S.brews.filter((b) => b.coffee_id === cid);
const equipById = (id) => S.equipment.find((e) => e.id === id);
const grinders = () => S.equipment.filter((e) => e.type === "grinder");
const sortedBrews = () => [...S.brews].sort((a, b) => (brewTime(b) > brewTime(a) ? 1 : -1));
const brewTime = (b) => b.brewed_at || b.created_at;

function stock(cid) {
  const bags = aliveBags(cid);
  const remaining = bags.reduce((s, b) => s + num(b.remaining_g), 0);
  const open = bags.find((b) => b.status === "open") || bags[0];
  const ratio = open ? clamp(num(open.remaining_g) / Math.max(1, num(open.size_g)), 0, 1) : 0;
  return { bags, remaining, open, ratio, count: bags.length };
}

function bagPricePerGram(bag, coffee) {
  const price = num(bag && bag.price, NaN);
  if (isFinite(price) && price > 0 && num(bag.size_g) > 0) return price / num(bag.size_g);
  const cp = num(coffee && coffee.price, NaN);
  const cs = num(coffee && coffee.default_bag_g, NaN);
  if (isFinite(cp) && isFinite(cs) && cs > 0) return cp / cs;
  return null;
}
function brewCost(brew) {
  const coffee = coffeeById(brew.coffee_id);
  let total = 0, any = false;
  (brew.consumed || []).forEach((c) => {
    const bag = S.bags.find((b) => b.id === c.bag_id);
    const ppg = bagPricePerGram(bag, coffee);
    if (ppg != null) { total += ppg * num(c.g); any = true; }
  });
  return any ? total : null;
}

/* ---------------------------------------------- avatar do saco de café */
function shade(hex, amt) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
  return "#" + [f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("");
}
function isLight(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}
let svgUid = 0;

/**
 * Desenha o saquinho. ratio = 0..1 do quanto ainda tem. Ele esmaece e a
 * janelinha mostra o nível dos grãos.
 */
function bagSVG(av, opts) {
  av = Object.assign({ shape: "pouch", color: "#1b1714", label: "#efe6d8", roast: 3, initials: "" }, av || {});
  opts = Object.assign({ ratio: 1, count: 1, fade: true }, opts || {});
  const u = "b" + ++svgUid;
  const ratio = clamp(opts.ratio, 0, 1);
  const body = av.color, dark = shade(body, -0.35), light = shade(body, 0.18);
  const bean = ROAST_COLORS[clamp((av.roast | 0) - 1, 0, 4)];
  const ink = isLight(av.label) ? "#1b1714" : "#f3ede4";
  const opacity = opts.fade ? 0.28 + 0.72 * Math.pow(ratio, 0.8) : 1;
  const ini = esc((av.initials || "").slice(0, 3).toUpperCase());

  let shapeEl, label, win, extra = "";
  if (av.shape === "tin") {
    shapeEl = `<rect x="18" y="26" width="84" height="116" rx="10" fill="url(#g${u})"/><rect x="14" y="16" width="92" height="16" rx="6" fill="${dark}"/><rect x="14" y="16" width="92" height="5" rx="2.5" fill="${light}" opacity=".5"/>`;
    label = { x: 26, y: 52, w: 68, h: 70 };
  } else if (av.shape === "box") {
    shapeEl = `<path d="M22 30 L98 30 L102 142 L18 142 Z" fill="url(#g${u})"/><path d="M22 30 L32 14 L88 14 L98 30 Z" fill="${dark}"/><path d="M32 14h56" stroke="${light}" stroke-width="2" opacity=".6"/><path d="M60 30 L60 142" stroke="${dark}" stroke-width="0.8" opacity=".35"/>`;
    label = { x: 30, y: 52, w: 60, h: 72 };
  } else if (av.shape === "kraft") {
    shapeEl = `<path d="M20 34 Q20 26 26 26 L94 26 Q100 26 100 34 L104 136 Q104 144 96 144 L24 144 Q16 144 16 136 Z" fill="url(#g${u})"/><path d="M24 12 h72 v18 h-72z" fill="${dark}"/><path d="M24 18 h72 M24 24 h72" stroke="${light}" stroke-width="1.2" opacity=".35"/><rect x="40" y="8" width="40" height="7" rx="3.5" fill="${shade(body, -0.5)}"/>`;
    label = { x: 30, y: 56, w: 60, h: 64 };
  } else {
    shapeEl = `<path d="M24 20 Q24 14 30 14 L90 14 Q96 14 96 20 L100 132 Q102 144 88 144 L32 144 Q18 144 20 132 Z" fill="url(#g${u})"/><path d="M24 26 h72" stroke="${dark}" stroke-width="1.5" opacity=".7"/><circle cx="60" cy="38" r="5" fill="${dark}" opacity=".8"/><circle cx="60" cy="38" r="2" fill="${light}" opacity=".6"/>`;
    label = { x: 32, y: 52, w: 56, h: 70 };
    extra = `<path d="M30 140 Q60 128 90 140" stroke="${dark}" stroke-width="1" fill="none" opacity=".5"/>`;
  }
  const L = label;
  const winH = 20, winY = L.y + L.h - winH - 8, winX = L.x + 8, winW = L.w - 16;
  const fillH = winH * ratio;
  win = `
    <rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="4" fill="${shade(av.label, -0.12)}" opacity=".9"/>
    <clipPath id="c${u}"><rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="4"/></clipPath>
    <g clip-path="url(#c${u})">
      <rect x="${winX}" y="${winY + winH - fillH}" width="${winW}" height="${fillH}" fill="${bean}"/>
      ${ratio > 0 ? beans(winX, winY + winH - fillH, winW, fillH, bean) : ""}
    </g>
    <rect x="${winX}" y="${winY}" width="${winW}" height="${winH}" rx="4" fill="none" stroke="${shade(av.label, -0.3)}" stroke-width=".8"/>`;

  const badge = opts.count > 1
    ? `<g transform="translate(92 22)"><circle r="13" fill="#efe6d8"/><text text-anchor="middle" dy="4.5" font-size="12" font-weight="700" fill="#1b1714" font-family="-apple-system,sans-serif">×${opts.count}</text></g>` : "";

  return `<span class="bag-av"><svg viewBox="0 0 120 152" role="img" aria-label="saco de café">
    <defs><linearGradient id="g${u}" x1="0" x2="1"><stop offset="0" stop-color="${light}"/><stop offset=".55" stop-color="${body}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
    <g opacity="${opacity.toFixed(2)}">
      ${shapeEl}${extra}
      <rect x="${L.x}" y="${L.y}" width="${L.w}" height="${L.h}" rx="5" fill="${av.label}"/>
      <text x="60" y="${L.y + 24}" text-anchor="middle" font-size="${ini.length > 2 ? 15 : 18}" font-weight="700" letter-spacing="1" fill="${ink}" font-family="ui-serif,'New York',Georgia,serif">${ini || "☕"}</text>
      <rect x="${L.x + 14}" y="${L.y + 32}" width="${L.w - 28}" height="2" rx="1" fill="${ink}" opacity=".35"/>
      ${roastDots(L, ink, av.roast)}
      ${win}
      <path d="M${L.x + 3} ${L.y + 2} v${L.h - 4}" stroke="#fff" stroke-width="3" opacity=".08" stroke-linecap="round"/>
    </g>
    ${badge}
  </svg></span>`;
}
function roastDots(L, ink, roast) {
  let s = "";
  for (let i = 0; i < 5; i++) {
    const cx = 60 - 16 + i * 8;
    s += `<circle cx="${cx}" cy="${L.y + 42}" r="2.3" fill="${ink}" opacity="${i < roast ? 0.85 : 0.18}"/>`;
  }
  return s;
}
function beans(x, y, w, h, color) {
  let s = ""; const c = shade(color, -0.35);
  for (let i = 0; i < 9; i++) {
    const bx = x + 4 + ((i * 37) % (w - 6)), by = y + 3 + ((i * 13) % Math.max(3, h - 3));
    if (by > y + h) continue;
    s += `<ellipse cx="${bx}" cy="${by}" rx="2.4" ry="1.6" fill="${c}" transform="rotate(${(i * 47) % 180} ${bx} ${by})"/>`;
  }
  return s;
}
function coffeeAvatar(c, size) {
  const st = stock(c.id);
  return bagSVG(c.avatar, { ratio: st.count ? st.ratio : 0, count: st.count });
}
function initialsOf(name) {
  return (name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/* ------------------------------------------------------------- modal */
function openModal(html, opts) {
  opts = opts || {};
  const root = $("#modalRoot");
  root.innerHTML = `<div class="modal ${opts.wide ? "wide" : ""} ${opts.cls || ""}" role="dialog" aria-modal="true">${html}</div>`;
  root.hidden = false;
  const close = () => { root.hidden = true; root.innerHTML = ""; document.removeEventListener("keydown", onKey); opts.onClose && opts.onClose(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  root.onclick = (e) => { if (e.target === root) close(); };
  $$("[data-close]", root).forEach((b) => (b.onclick = close));
  return { el: root.firstElementChild, close };
}
function confirmBox(title, text, okLabel, danger) {
  return new Promise((resolve) => {
    const m = openModal(`
      <div class="modal-head"><div><h2 class="h2">${esc(title)}</h2>${text ? `<p class="muted" style="margin:8px 0 0">${esc(text)}</p>` : ""}</div></div>
      <div class="modal-foot"><button class="btn ghost" data-no>Cancelar</button><button class="btn ${danger ? "danger" : "primary"}" data-yes>${esc(okLabel || "Confirmar")}</button></div>`,
      { onClose: () => resolve(false) });
    $("[data-no]", m.el).onclick = () => { m.close(); };
    $("[data-yes]", m.el).onclick = () => { resolve(true); $("#modalRoot").hidden = true; $("#modalRoot").innerHTML = ""; };
  });
}
function lightbox(src) {
  openModal(`<img src="${esc(src)}" alt="">`, { cls: "lightbox" });
  const m = $("#modalRoot .modal");
  m.style.background = "transparent"; m.style.border = "0"; m.style.padding = "0"; m.style.width = "auto"; m.style.boxShadow = "none";
}

/* ------------------------------------------------------- fotos */
function compressImage(file, max = 1400, q = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL("image/jpeg", q));
    };
    img.onerror = () => reject(new Error("Não consegui ler essa imagem"));
    img.src = url;
  });
}
async function uploadFiles(files) {
  const urls = [];
  for (const f of files) {
    const data = await compressImage(f);
    const r = await api.post("/api/photos", { data });
    urls.push(r.url);
  }
  return urls;
}

/* ===================================================================
   TIMER
   =================================================================== */
const Timer = {
  start: null, elapsed: 0, running: false, laps: [], mode: "free", target: null, waterTarget: null,
  raf: null, listeners: new Set(), lastStage: -1, audio: null,
  now() { return this.running ? this.elapsed + (performance.now() - this.start) / 1000 : this.elapsed; },
  toggle() { this.running ? this.pause() : this.play(); },
  play() { if (this.running) return; this.start = performance.now(); this.running = true; this.beep(660, 0.05); this.loop(); this.emit(); },
  pause() { if (!this.running) return; this.elapsed = this.now(); this.running = false; cancelAnimationFrame(this.raf); this.emit(); },
  reset() { this.pause(); this.elapsed = 0; this.laps = []; this.lastStage = -1; this.emit(); },
  lap() { if (this.now() > 0) { this.laps.push(this.now()); this.emit(); } },
  loop() {
    const tick = () => {
      if (!this.running) return;
      this.checkStages();
      this.emit();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  },
  checkStages() {
    const t = this.now();
    if (this.mode === "pour") {
      const i = POUR_STAGES.reduce((acc, s, idx) => (t >= s.t ? idx : acc), 0);
      if (i !== this.lastStage) { if (this.lastStage !== -1) this.beep(880, 0.12); this.lastStage = i; }
    } else if (this.target && t >= this.target && this.lastStage < 1) {
      this.lastStage = 1; this.beep(880, 0.25); setTimeout(() => this.beep(880, 0.25), 300);
    }
  },
  beep(freq, dur) {
    try {
      this.audio = this.audio || new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.audio, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq; o.type = "sine";
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (_) {}
    if (navigator.vibrate) navigator.vibrate(30);
  },
  setMode(mode, target) { this.mode = mode; this.target = target || null; this.lastStage = -1; this.emit(); },
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach((fn) => fn(this)); },
};
function fmtTimer(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), d = Math.floor((t * 10) % 10);
  return { main: `${m}:${String(s).padStart(2, "0")}`, dec: `.${d}` };
}
Timer.on(() => {
  const el = $("#navTimerTime");
  if (el) el.textContent = Timer.now() > 0 ? fmtTimer(Timer.now()).main : "";
});

function timerPresetFromMethod(methodId) {
  const k = (METHOD[methodId] || {}).kind;
  if (k === "espresso") return { mode: "espresso", target: 28 };
  if (k === "pour") return { mode: "pour", target: 195 };
  if (methodId === "prensa") return { mode: "immersion", target: 240 };
  if (methodId === "aeropress") return { mode: "immersion", target: 120 };
  if (methodId === "clever") return { mode: "immersion", target: 180 };
  return { mode: "free", target: null };
}

function openTimer(opts) {
  opts = opts || {};
  if (opts.mode) Timer.setMode(opts.mode, opts.target);
  if (opts.water) Timer.waterTarget = opts.water;
  const root = $("#timerRoot");
  root.hidden = false;
  const presets = [
    ["free", "Livre", null], ["espresso", "Espresso", 28], ["pour", "Coado guiado", 195], ["immersion", "Prensa 4:00", 240], ["immersion", "AeroPress 2:00", 120],
  ];
  root.innerHTML = `
    <div class="timer-top">
      <span class="eyebrow">Timer</span>
      <button class="close-x" data-x aria-label="Fechar">${ic("x")}</button>
    </div>
    <div class="timer-ring">
      <svg viewBox="0 0 200 200"><circle class="bg" cx="100" cy="100" r="92" fill="none" stroke-width="5"/>
      <circle class="zone" cx="100" cy="100" r="92" fill="none" stroke-width="5" id="tZone" stroke-dasharray="0 999"/>
      <circle class="fg" cx="100" cy="100" r="92" fill="none" stroke-width="5" id="tArc" stroke-dasharray="578" stroke-dashoffset="578"/></svg>
      <div style="text-align:center">
        <div class="timer-clock" id="tClock">0:00<small>.0</small></div>
        <div class="timer-stage" id="tStage"></div>
      </div>
    </div>
    <div class="timer-controls">
      <button class="round-btn" id="tReset">Zerar</button>
      <button class="round-btn go" id="tGo">Iniciar</button>
      <button class="round-btn" id="tLap">Etapa</button>
    </div>
    ${opts.onUse ? `<button class="btn cream" id="tUse" style="margin-top:22px">Usar este tempo no registro</button>` : ""}
    <div class="timer-presets">${presets.map(([m, l, t]) => `<button class="chip ${Timer.mode === m && Timer.target === t ? "on" : ""}" data-m="${m}" data-t="${t || ""}">${l}</button>`).join("")}</div>
    <div class="timer-laps lap-list" id="tLaps"></div>`;
  const C = 2 * Math.PI * 92;
  const draw = () => {
    const t = Timer.now(), f = fmtTimer(t);
    $("#tClock").innerHTML = `${f.main}<small>${f.dec}</small>`;
    const go = $("#tGo"); go.textContent = Timer.running ? "Pausar" : t > 0 ? "Continuar" : "Iniciar"; go.classList.toggle("stop", Timer.running);
    const span = Timer.target || 60;
    const prog = Timer.target ? clamp(t / span, 0, 1) : (t % 60) / 60;
    $("#tArc").setAttribute("stroke-dashoffset", C * (1 - prog));
    // zona ideal do espresso (25–32s)
    if (Timer.mode === "espresso") {
      const a = 25 / span, b = 32 / span;
      $("#tZone").setAttribute("stroke-dasharray", `0 ${C * a} ${C * (b - a)} ${C}`);
    } else $("#tZone").setAttribute("stroke-dasharray", `0 ${C}`);
    let stage = "";
    if (Timer.mode === "pour") {
      const i = POUR_STAGES.reduce((acc, s, idx) => (t >= s.t ? idx : acc), 0);
      const s = POUR_STAGES[i], n = POUR_STAGES[i + 1];
      const w = Timer.waterTarget ? ` · até ${Math.round(Timer.waterTarget * s.pct)} g` : "";
      stage = `<div class="now">${s.label}${s.t < 150 ? w : ""}</div>${n ? `<div class="next">próximo: ${n.label} em ${fmtTime(n.t - t)}</div>` : ""}`;
    } else if (Timer.mode === "espresso") {
      stage = `<div class="now">${t < 25 ? "Extraindo…" : t <= 32 ? "Ponto ideal" : "Passou do ponto"}</div><div class="next">alvo 25–32 s</div>`;
    } else if (Timer.target) {
      const left = Timer.target - t;
      stage = `<div class="now">${left > 0 ? "Faltam " + fmtTime(left) : "Pronto! ☕"}</div>`;
    }
    $("#tStage").innerHTML = stage;
    $("#tLaps").innerHTML = Timer.laps.map((l, i) => `<div><span>Etapa ${i + 1}</span><span>${fmtTimer(l).main}${fmtTimer(l).dec}</span></div>`).reverse().join("");
  };
  const off = Timer.on(draw); draw();
  const close = () => { off(); root.hidden = true; root.innerHTML = ""; document.removeEventListener("keydown", onKey); };
  const onKey = (e) => {
    if (e.key === "Escape") close();
    if (e.code === "Space" && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); Timer.toggle(); }
  };
  document.addEventListener("keydown", onKey);
  $("[data-x]", root).onclick = close;
  $("#tGo").onclick = () => Timer.toggle();
  $("#tReset").onclick = () => Timer.reset();
  $("#tLap").onclick = () => Timer.lap();
  $$("[data-m]", root).forEach((b) => (b.onclick = () => {
    Timer.reset(); Timer.setMode(b.dataset.m, num(b.dataset.t) || null);
    $$("[data-m]", root).forEach((x) => x.classList.toggle("on", x === b));
  }));
  if (opts.onUse) $("#tUse").onclick = () => { Timer.pause(); opts.onUse(Timer.now(), Timer.laps.slice()); close(); };
}

/* ===================================================================
   ROTEADOR
   =================================================================== */
const NAV = [
  { href: "#/inicio", icon: "home", label: "Início" },
  { href: "#/despensa", icon: "pantry", label: "Despensa" },
  { href: "#/preparar", icon: "plus", label: "Novo café", cta: true },
  { href: "#/historico", icon: "history", label: "Histórico" },
  { href: "#/painel", icon: "chart", label: "Painel" },
  { href: "#/ajustes", icon: "gear", label: "Ajustes" },
];

function renderNav(route) {
  const active = (h) => route.startsWith(h.slice(1)) || (h === "#/despensa" && route.startsWith("/cafe"));
  $("#nav").innerHTML = NAV.map((n) => `<a href="${n.href}" class="${active(n.href) ? "active" : ""} ${n.cta ? "cta" : ""}">${ic(n.icon)}<span>${n.label}</span></a>`).join("");
  const tab = NAV.filter((n) => n.href !== "#/ajustes");
  $("#tabbar").innerHTML = tab.map((n) => `<a href="${n.href}" class="${active(n.href) ? "active" : ""} ${n.cta ? "cta" : ""}">${ic(n.icon)}<span>${n.label}</span></a>`).join("");
}

let currentCleanup = null;
function render() {
  if (!S.ready) return;
  const hash = location.hash || "#/inicio";
  const route = hash.slice(1);
  const [path, query] = route.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query || "");
  renderNav(path);
  if (currentCleanup) { currentCleanup(); currentCleanup = null; }
  const view = $("#view");
  const r = parts[0] || "inicio";
  let out;
  if (r === "inicio") out = viewHome();
  else if (r === "despensa") out = viewPantry();
  else if (r === "cafe" && parts[1] === "novo") out = viewCoffeeEditor(null);
  else if (r === "cafe" && parts[2] === "editar") out = viewCoffeeEditor(parts[1]);
  else if (r === "cafe") out = viewCoffee(parts[1]);
  else if (r === "preparar") out = viewBrewForm(null, params);
  else if (r === "preparo" && parts[2] === "editar") out = viewBrewForm(parts[1], params);
  else if (r === "preparo") out = viewBrew(parts[1]);
  else if (r === "historico") out = viewHistory(params);
  else if (r === "painel") out = viewDashboard();
  else if (r === "ajustes") out = viewSettings();
  else out = viewHome();
  view.innerHTML = out.html;
  if (out.mount) currentCleanup = out.mount(view) || null;
  $$("[data-action=open-timer]").forEach((b) => (b.onclick = () => openTimer()));
  $$("[data-lightbox]", view).forEach((img) => (img.onclick = () => lightbox(img.dataset.lightbox)));
}
window.addEventListener("hashchange", () => { render(); window.scrollTo({ top: 0 }); });

function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

/* ===================================================================
   INÍCIO
   =================================================================== */
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function viewHome() {
  const name = S.settings.name ? ", " + esc(S.settings.name) : "";
  const brews = sortedBrews();
  const today = brews.filter((b) => dayKey(brewTime(b)) === dayKey(new Date()));
  const week = brews.filter((b) => Date.now() - new Date(brewTime(b)) < 7 * DAY);
  const last30 = brews.filter((b) => Date.now() - new Date(brewTime(b)) < 30 * DAY && b.rating != null);
  const active = S.coffees.filter((c) => !c.archived && stock(c.id).count > 0);
  const low = active.filter((c) => { const st = stock(c.id); const dose = avg(brewsOf(c.id).map((b) => num(b.dose_g)).filter(Boolean)) || 18; return st.remaining < dose * 2.5; });
  const heroBags = active.slice(0, 3);

  const html = `<div class="page">
    <section class="hero">
      <a href="#/ajustes" class="btn icon sm ghost mobile-only" style="position:absolute;top:14px;right:14px" aria-label="Ajustes">${ic("gear")}</a>
      <div>
        <div class="eyebrow">${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 class="title">${greeting()}${name}.<br><em>Que café vai ser?</em></h1>
        <p class="subtitle">${today.length ? `Você já fez ${today.length} ${today.length === 1 ? "café" : "cafés"} hoje.` : brews.length ? "Ainda nenhum café hoje." : "Comece cadastrando o grão que você tem em casa."}</p>
        <div class="actions">
          ${S.coffees.length ? `<a class="btn primary lg" href="#/preparar">${ic("plus")}Registrar um café</a>` : `<a class="btn primary lg" href="#/cafe/novo">${ic("plus")}Cadastrar meu primeiro café</a>`}
          <button class="btn lg" data-action="open-timer">${ic("timer")}Timer</button>
          ${brews.length ? `<button class="btn lg ghost" id="repeatLast">${ic("repeat")}Repetir o último</button>` : ""}
        </div>
      </div>
      <div class="hero-bags">${heroBags.map((c) => coffeeAvatar(c)).join("") || bagSVG({ color: "#a86b3c", label: "#efe6d8", initials: "CL" }, { fade: false })}</div>
    </section>

    <section class="section grid g4">
      <div class="card stat"><span class="v num">${week.length}</span><span class="k">cafés nos últimos 7 dias</span></div>
      <div class="card stat"><span class="v num">${fmtN(avg(last30.map((b) => num(b.rating))))}<small>/10</small></span><span class="k">nota média (30 dias)</span></div>
      <div class="card stat"><span class="v num">${fmtG(week.reduce((s, b) => s + num(b.dose_g), 0))}</span><span class="k">de café na semana</span></div>
      <div class="card stat"><span class="v num">${active.length}</span><span class="k">cafés na despensa</span></div>
    </section>

    ${low.length ? `<section class="section"><div class="notice row">${ic("bag")}<span><b style="color:var(--warn)">Acabando:</b> ${low.map((c) => esc(c.name) + " (" + fmtG(stock(c.id).remaining) + ")").join(", ")}</span></div></section>` : ""}

    <section class="section">
      <div class="section-head"><h2 class="h2">Na despensa</h2><a href="#/despensa">Ver tudo</a></div>
      ${active.length ? `<div class="mini-bags">${active.map((c) => `<a class="mini-bag" href="#/preparar?cafe=${c.id}" title="Fazer café com ${esc(c.name)}">${coffeeAvatar(c)}<span>${esc(c.name)}</span></a>`).join("")}
        <a class="mini-bag" href="#/cafe/novo"><span class="bag-av" style="width:66px"><svg viewBox="0 0 120 152"><path d="M24 20 Q24 14 30 14 L90 14 Q96 14 96 20 L100 132 Q102 144 88 144 L32 144 Q18 144 20 132 Z" fill="none" stroke="#6f675d" stroke-dasharray="5 5" stroke-width="2"/><path d="M60 64v30M45 79h30" stroke="#a69c90" stroke-width="3" stroke-linecap="round"/></svg></span><span>Adicionar</span></a></div>`
        : `<div class="card empty-state">${bagSVG({ color: "#2a2420", label: "#3a322b" }, { ratio: 0 })}<h3 class="h3">Despensa vazia</h3><p>Cadastre um café com quantos gramas tem no saco. Cada preparo desconta sozinho.</p><a class="btn primary" href="#/cafe/novo" style="margin-top:8px">Cadastrar café</a></div>`}
    </section>

    <section class="section">
      <div class="section-head"><h2 class="h2">Últimos preparos</h2>${brews.length ? `<a href="#/historico">Histórico</a>` : ""}</div>
      ${brews.length ? `<div class="card">${brewList(brews.slice(0, 5))}</div>` : `<div class="card empty-state"><p>Seus cafés vão aparecer aqui, com nota, receita e foto.</p></div>`}
    </section>
  </div>`;
  return {
    html,
    mount(v) {
      const rl = $("#repeatLast", v);
      if (rl) rl.onclick = () => go(`#/preparar?repetir=${brews[0].id}`);
    },
  };
}

function brewList(list) {
  return `<div class="brew-list">${list.map((b) => {
    const c = coffeeById(b.coffee_id), m = METHOD[b.method] || METHOD.outro;
    const bits = [num(b.dose_g) ? fmtN(b.dose_g) + " g" : null, b.time_s ? fmtTime(b.time_s) : null, b.grind ? b.grind + " cliques" : null].filter(Boolean).join(" · ");
    return `<a class="brew-item" href="#/preparo/${b.id}">
      <span class="brew-icon">${methodIcon(b.method)}</span>
      <span><div class="t">${esc(m.name)} · ${esc(c ? c.name : "Café removido")}</div><div class="s">${fmtDayLabel(brewTime(b))}, ${fmtClock(brewTime(b))}${bits ? " · " + bits : ""}</div></span>
      <span class="score">${b.rating != null ? fmtN(b.rating) : "—"}</span>
    </a>`;
  }).join("")}</div>`;
}

/* ===================================================================
   DESPENSA
   =================================================================== */
let pantryFilter = "ativos";
function viewPantry() {
  const list = S.coffees.filter((c) => {
    const has = stock(c.id).count > 0;
    return pantryFilter === "ativos" ? has && !c.archived : pantryFilter === "acabados" ? !has || c.archived : true;
  }).sort((a, b) => stock(b.id).remaining - stock(a.id).remaining);
  const html = `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Seus grãos</div><h1 class="title">Despensa</h1></div>
      <div class="row wrap">
        <div class="seg" id="pf">${["ativos", "acabados", "todos"].map((f) => `<button class="${pantryFilter === f ? "on" : ""}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div>
        <a class="btn primary" href="#/cafe/novo">${ic("plus")}Novo café</a>
      </div>
    </div>
    ${list.length ? `<div class="pantry">${list.map((c) => {
      const st = stock(c.id), b = brewsOf(c.id), r = avg(b.filter((x) => x.rating != null).map((x) => num(x.rating)));
      const d = daysSince(c.roast_date);
      return `<a class="card link coffee-card ${st.count ? "" : "empty"}" href="#/cafe/${c.id}">
        ${r != null ? `<span class="corner badge leather">${fmtN(r)}</span>` : ""}
        ${coffeeAvatar(c)}
        <span class="name">${esc(c.name)}</span>
        <span class="meta">${esc([c.roaster, c.origin].filter(Boolean).join(" · ") || ROASTS[(c.avatar?.roast || 3) - 1])}</span>
        <span class="grams">${st.count ? `${fmtG(st.remaining)} restantes${st.count > 1 ? ` · ${st.count} sacos` : ""}` : "Acabou"}</span>
        ${d != null && st.count ? `<span class="tiny faint" style="margin-top:4px">${d} dias de torra</span>` : ""}
      </a>`;
    }).join("")}</div>`
      : `<div class="card empty-state">${bagSVG({ color: "#2a2420", label: "#3a322b" }, { ratio: 0 })}<h3 class="h3">${pantryFilter === "acabados" ? "Nenhum café acabado ainda" : "Nada por aqui"}</h3><p>Cadastre seu café com o tamanho do saco. Se tiver 2 sacos iguais, coloca os dois que ele vai usando em ordem.</p>${pantryFilter !== "acabados" ? `<a class="btn primary" href="#/cafe/novo" style="margin-top:8px">Cadastrar café</a>` : ""}</div>`}
  </div>`;
  return { html, mount(v) { $$("#pf button", v).forEach((b) => (b.onclick = () => { pantryFilter = b.dataset.f; render(); })); } };
}

/* ---------------------------------------------------------- detalhe café */
function viewCoffee(id) {
  const c = coffeeById(id);
  if (!c) return { html: `<div class="page"><div class="card empty-state"><p>Café não encontrado.</p><a class="btn" href="#/despensa">Voltar</a></div></div>` };
  const st = stock(c.id), bags = bagsOf(c.id), brews = brewsOf(c.id).sort((a, b) => (brewTime(b) > brewTime(a) ? 1 : -1));
  const rated = brews.filter((b) => b.rating != null);
  const best = [...rated].sort((a, b) => num(b.rating) - num(a.rating))[0];
  const used = brews.reduce((s, b) => s + num(b.dose_g), 0);
  const d = daysSince(c.roast_date);
  const photos = [c.photo, ...brews.flatMap((b) => b.photos || [])].filter(Boolean).slice(0, 12);
  const flavorCount = {};
  brews.forEach((b) => (b.flavors || []).forEach((f) => (flavorCount[f] = (flavorCount[f] || 0) + 1)));
  const topFlavors = Object.entries(flavorCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const html = `<div class="page">
    <a class="btn ghost sm" href="#/despensa" style="margin-left:-10px">${ic("back")}Despensa</a>
    <div class="editor" style="margin-top:14px">
      <div class="editor-preview">
        ${coffeeAvatar(c)}
        <div><h1 class="h2" style="font-size:24px">${esc(c.name)}</h1><p class="muted small" style="margin:6px 0 0">${esc([c.roaster, c.origin].filter(Boolean).join(" · "))}</p></div>
        <div class="row wrap" style="justify-content:center">
          <span class="badge">${ROASTS[(c.avatar?.roast || 3) - 1]}</span>
          ${c.process ? `<span class="badge">${esc(c.process)}</span>` : ""}
          ${d != null ? `<span class="badge ${d <= 30 ? "good" : d <= 60 ? "warn" : "bad"}">${d} dias de torra</span>` : ""}
        </div>
        <div class="stack" style="width:100%">
          <a class="btn primary block" href="#/preparar?cafe=${c.id}">${ic("plus")}Fazer um café com ele</a>
          <div class="row"><a class="btn block sm" href="#/cafe/${c.id}/editar">${ic("edit")}Editar</a><button class="btn sm icon danger" id="delCoffee" title="Apagar">${ic("trash")}</button></div>
        </div>
      </div>

      <div class="stack" style="gap:14px">
        <div class="grid g3">
          <div class="card stat"><span class="v num">${fmtG(st.remaining)}</span><span class="k">restantes</span></div>
          <div class="card stat"><span class="v num">${brews.length}</span><span class="k">preparos · ${fmtG(used)}</span></div>
          <div class="card stat"><span class="v num">${fmtN(avg(rated.map((b) => num(b.rating))))}<small>/10</small></span><span class="k">nota média</span></div>
        </div>

        <div class="card">
          <div class="section-head" style="margin-bottom:4px"><h2 class="h3">Sacos</h2><button class="btn sm" id="addBag">${ic("plus")}Adicionar saco</button></div>
          ${bags.length ? bags.map((b, i) => {
            const r = clamp(num(b.remaining_g) / Math.max(1, num(b.size_g)), 0, 1);
            const status = b.status === "finished" ? `<span class="badge">Acabou ${fmtDate(b.finished_at)}</span>` : b.status === "open" ? `<span class="badge leather">Aberto</span>` : `<span class="badge">Lacrado</span>`;
            return `<div class="bag-line">
              <div style="width:34px">${bagSVG(c.avatar, { ratio: r })}</div>
              <div class="stack" style="gap:7px">
                <div class="row between"><span class="small"><b>Saco ${i + 1}</b> · ${fmtG(num(b.remaining_g))} de ${fmtG(num(b.size_g))} ${b.price ? "· " + fmtMoney(num(b.price)) : ""}</span>${status}</div>
                <div class="progress"><i style="width:${r * 100}%"></i></div>
                ${b.final_rating != null ? `<span class="tiny muted">Avaliação final: <b style="color:var(--text)">${fmtN(b.final_rating)}/10</b>${b.review ? " — " + esc(b.review) : ""}</span>` : ""}
              </div>
              <div class="row" style="gap:4px">
                ${b.status === "finished" ? `<button class="btn sm ghost" data-review="${b.id}">Avaliar</button>` : `<button class="btn sm ghost" data-adjust="${b.id}">Ajustar</button>`}
              </div>
            </div>`;
          }).join("") : `<p class="muted small">Nenhum saco cadastrado.</p>`}
        </div>

        ${best ? `<div class="suggest"><div class="row between"><h3 class="h3">${ic("spark", "")} Sua melhor receita</h3><span class="score">${fmtN(best.rating)}</span></div>
          <p class="small muted" style="margin:8px 0 12px">${recipeLine(best)}</p>
          <a class="btn sm" href="#/preparar?repetir=${best.id}">${ic("repeat")}Repetir essa receita</a></div>` : ""}

        ${(c.notes || topFlavors.length || c.tasting) ? `<div class="card stack">
          ${c.tasting ? `<div><span class="label">Notas da torrefação</span><p style="margin:6px 0 0">${esc(c.tasting)}</p></div>` : ""}
          ${topFlavors.length ? `<div><span class="label">O que você mais sentiu</span><div class="tag-cloud" style="margin-top:8px">${topFlavors.map(([f, n]) => `<span class="badge">${esc(f)} <span class="faint">${n}</span></span>`).join("")}</div></div>` : ""}
          ${c.notes ? `<div><span class="label">Anotações</span><p style="margin:6px 0 0;white-space:pre-wrap">${esc(c.notes)}</p></div>` : ""}
        </div>` : ""}

        ${photos.length ? `<div class="card"><h2 class="h3" style="margin-bottom:12px">Fotos</h2><div class="gallery">${photos.map((p) => `<img src="${esc(p)}" data-lightbox="${esc(p)}" alt="" loading="lazy">`).join("")}</div></div>` : ""}

        <div class="card"><h2 class="h3" style="margin-bottom:6px">Preparos com esse café</h2>${brews.length ? brewList(brews) : `<p class="muted small">Nenhum ainda.</p>`}</div>
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(v) {
      $("#delCoffee", v).onclick = async () => {
        if (await confirmBox("Apagar " + c.name + "?", "Os sacos dele somem. Os preparos ficam no histórico.", "Apagar", true))
          safe(async () => { await api.del("/api/coffees/" + c.id); await loadState(); toast("Café apagado"); go("#/despensa"); });
      };
      $("#addBag", v).onclick = () => addBagModal(c);
      $$("[data-adjust]", v).forEach((b) => (b.onclick = () => adjustBagModal(S.bags.find((x) => x.id === b.dataset.adjust))));
      $$("[data-review]", v).forEach((b) => (b.onclick = () => bagReviewModal(S.bags.find((x) => x.id === b.dataset.review))));
    },
  };
}

function recipeLine(b) {
  const m = METHOD[b.method] || METHOD.outro;
  const g = equipById(b.grinder_id);
  const parts = [m.name, num(b.dose_g) ? fmtN(b.dose_g) + " g" : null,
    m.kind === "espresso" ? (num(b.yield_g) ? "→ " + fmtN(b.yield_g) + " g" : null) : num(b.water_g) ? fmtN(b.water_g) + " g de água" : null,
    b.grind ? `${b.grind} ${g && g.unit ? g.unit : "cliques"}${g ? " no " + g.name : ""}` : null,
    b.temp_c ? fmtN(b.temp_c, 0) + " °C" : null, b.time_s ? fmtTime(b.time_s) : null];
  return esc(parts.filter(Boolean).join(" · "));
}

function addBagModal(c) {
  const m = openModal(`
    <div class="modal-head"><div><div class="eyebrow">${esc(c.name)}</div><h2 class="h2" style="margin-top:4px">Novo saco</h2></div><button class="close-x" data-close>${ic("x")}</button></div>
    <div class="form-grid">
      <div class="field"><label>Tamanho</label><div class="input-unit"><input class="input" id="bs" type="number" inputmode="decimal" value="${c.default_bag_g || 250}"><span class="unit">g</span></div></div>
      <div class="field"><label>Preço <span class="faint">(opcional)</span></label><div class="input-unit"><input class="input" id="bp" type="number" inputmode="decimal" step="0.01" value="${c.price || ""}"><span class="unit">R$</span></div></div>
    </div>
    <p class="small muted" style="margin:14px 0 0">Se já tiver um saco aberto, esse entra lacrado e abre sozinho quando o atual acabar.</p>
    <div class="modal-foot"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Adicionar</button></div>`);
  $("#ok", m.el).onclick = () => safe(async () => {
    await api.post(`/api/coffees/${c.id}/bags`, { size_g: num($("#bs", m.el).value), price: $("#bp", m.el).value ? num($("#bp", m.el).value) : null });
    m.close(); toast("Saco adicionado"); refresh();
  });
}

function adjustBagModal(bag) {
  const m = openModal(`
    <div class="modal-head"><div><h2 class="h2">Ajustar saco</h2><p class="muted small" style="margin:6px 0 0">Pesou o saco e deu diferente? Corrige aqui.</p></div><button class="close-x" data-close>${ic("x")}</button></div>
    <div class="form-grid">
      <div class="field"><label>Restante</label><div class="input-unit"><input class="input" id="br" type="number" inputmode="decimal" value="${fmtN(num(bag.remaining_g), 1).replace(",", ".")}"><span class="unit">g</span></div></div>
      <div class="field"><label>Tamanho total</label><div class="input-unit"><input class="input" id="bs" type="number" inputmode="decimal" value="${num(bag.size_g)}"><span class="unit">g</span></div></div>
      <div class="field full"><label>Preço</label><div class="input-unit"><input class="input" id="bp" type="number" step="0.01" value="${bag.price || ""}"><span class="unit">R$</span></div></div>
    </div>
    <div class="modal-foot"><button class="btn ghost danger" id="del">Apagar saco</button><span class="spacer"></span><button class="btn primary" id="ok">Salvar</button></div>`);
  $("#ok", m.el).onclick = () => safe(async () => {
    const rem = num($("#br", m.el).value);
    await api.put("/api/bags/" + bag.id, { remaining_g: rem, size_g: num($("#bs", m.el).value), price: $("#bp", m.el).value ? num($("#bp", m.el).value) : null });
    m.close(); await loadState();
    if (rem <= 0) bagReviewModal(S.bags.find((b) => b.id === bag.id)); else render();
  });
  $("#del", m.el).onclick = async () => {
    m.close();
    if (await confirmBox("Apagar esse saco?", null, "Apagar", true)) safe(async () => { await api.del("/api/bags/" + bag.id); refresh(); });
  };
}

/* ------------------------------------------ avaliação do saco que acabou */
function bagReviewModal(bag) {
  if (!bag) return;
  const c = coffeeById(bag.coffee_id);
  const brews = S.brews.filter((b) => (b.consumed || []).some((x) => x.bag_id === bag.id));
  const rated = brews.filter((b) => b.rating != null);
  const best = [...rated].sort((a, b) => num(b.rating) - num(a.rating))[0];
  const avgR = avg(rated.map((b) => num(b.rating)));
  const methods = {};
  brews.forEach((b) => (methods[b.method] = (methods[b.method] || 0) + 1));
  const fav = Object.entries(methods).sort((a, b) => b[1] - a[1])[0];
  const ppg = bagPricePerGram(bag, c);
  const avgDose = avg(brews.map((b) => num(b.dose_g)).filter(Boolean));
  const days = bag.opened_at && bag.finished_at ? Math.max(1, Math.round((new Date(bag.finished_at) - new Date(bag.opened_at)) / DAY)) : null;
  let rating = bag.final_rating != null ? num(bag.final_rating) : avgR != null ? round(avgR * 2) / 2 : 7;
  let again = bag.buy_again;

  const m = openModal(`
    <div class="modal-head">
      <div class="row" style="gap:16px"><div style="width:56px">${bagSVG(c?.avatar, { ratio: 0, fade: false })}</div>
      <div><div class="eyebrow">Saco finalizado</div><h2 class="h2" style="margin-top:4px">${esc(c ? c.name : "Café")}</h2></div></div>
      <button class="close-x" data-close>${ic("x")}</button>
    </div>
    <div class="kv">
      <div><span>Cafés feitos</span><b>${brews.length}</b></div>
      <div><span>Nota média</span><b>${fmtN(avgR)}</b></div>
      <div><span>Dose média</span><b>${avgDose ? fmtN(avgDose) + " g" : "—"}</b></div>
      <div><span>Durou</span><b>${days ? days + (days === 1 ? " dia" : " dias") : "—"}</b></div>
      <div><span>Método favorito</span><b>${fav ? esc((METHOD[fav[0]] || METHOD.outro).name) : "—"}</b></div>
      <div><span>Custo por xícara</span><b>${ppg && avgDose ? fmtMoney(ppg * avgDose) : "—"}</b></div>
    </div>
    ${best ? `<div class="suggest" style="margin-top:20px"><span class="label">Melhor xícara (${fmtN(best.rating)})</span><p class="small" style="margin:6px 0 0">${recipeLine(best)}</p></div>` : ""}
    <hr class="divider">
    <div class="field"><span class="label">Sua nota final pro grão</span>
      <div class="rating-big"><span class="v" id="rv">${fmtN(rating)}</span><span class="of">/10</span><span class="rating-word" id="rw" style="margin-left:8px">${ratingWord(rating)}</span></div>
      <input type="range" class="range" id="rr" min="0" max="10" step="0.5" value="${rating}">
    </div>
    <div class="field" style="margin-top:16px"><span class="label">Compraria de novo?</span>
      <div class="chips" id="again"><button class="chip ${again === true ? "on" : ""}" data-v="1">Sim, com certeza</button><button class="chip ${again === "maybe" ? "on" : ""}" data-v="maybe">Talvez</button><button class="chip ${again === false ? "on" : ""}" data-v="0">Não</button></div>
    </div>
    <div class="field" style="margin-top:16px"><label>Resumo do grão</label><textarea class="textarea" id="rt" placeholder="Como foi esse café do começo ao fim?">${esc(bag.review || "")}</textarea></div>
    <div class="modal-foot"><button class="btn ghost" data-close>Depois</button><button class="btn primary" id="ok">Salvar avaliação</button></div>`);
  const rr = $("#rr", m.el);
  const upd = () => { rating = num(rr.value); $("#rv", m.el).textContent = fmtN(rating); $("#rw", m.el).textContent = ratingWord(rating); rr.style.setProperty("--p", rating * 10 + "%"); };
  rr.oninput = upd; upd();
  $$("#again .chip", m.el).forEach((b) => (b.onclick = () => {
    again = b.dataset.v === "1" ? true : b.dataset.v === "0" ? false : "maybe";
    $$("#again .chip", m.el).forEach((x) => x.classList.toggle("on", x === b));
  }));
  $("#ok", m.el).onclick = () => safe(async () => {
    await api.put("/api/bags/" + bag.id, { final_rating: rating, review: $("#rt", m.el).value, buy_again: again });
    m.close(); toast("Avaliação salva"); refresh();
  });
}

/* ---------------------------------------------------------- editor café */
function viewCoffeeEditor(id) {
  const existing = id ? coffeeById(id) : null;
  const c = existing ? JSON.parse(JSON.stringify(existing)) : {
    name: "", roaster: "", origin: "", region: "", farm: "", variety: "", process: "", altitude: "", roast_date: "", price: "", default_bag_g: 250, tasting: "", notes: "", photo: null,
    avatar: { shape: "pouch", color: BAG_COLORS[0], label: LABEL_COLORS[0], roast: 3, initials: "" },
  };
  c.avatar = Object.assign({ shape: "pouch", color: BAG_COLORS[0], label: LABEL_COLORS[0], roast: 3, initials: "" }, c.avatar || {});
  let newBags = existing ? [] : [{ size_g: 250, price: "" }];
  let autoInitials = !c.avatar.initials;

  const swatches = (list, key) => `<div class="swatches" data-key="${key}">${list.map((col) => `<button class="swatch ${c.avatar[key] === col ? "on" : ""}" style="background:${col}" data-col="${col}" aria-label="${col}"></button>`).join("")}<label class="swatch swatch-custom ${list.includes(c.avatar[key]) ? "" : "on"}" title="Escolher cor"><input type="color" value="${c.avatar[key]}" data-custom="${key}"></label></div>`;
  const inp = (k, label, ph, type, unit, extra) => `<div class="field ${extra || ""}"><label>${label}</label>${unit ? `<div class="input-unit">` : ""}<input class="input" data-k="${k}" type="${type || "text"}" ${type === "number" ? 'inputmode="decimal" step="any"' : ""} placeholder="${ph || ""}" value="${esc(c[k] == null ? "" : c[k])}">${unit ? `<span class="unit">${unit}</span></div>` : ""}</div>`;

  const html = `<div class="page">
    <a class="btn ghost sm" href="${existing ? "#/cafe/" + id : "#/despensa"}" style="margin-left:-10px">${ic("back")}${existing ? esc(existing.name) : "Despensa"}</a>
    <div class="page-head" style="margin-top:10px"><div><div class="eyebrow">${existing ? "Editar" : "Novo grão"}</div><h1 class="title">${existing ? "Editar café" : "Cadastrar <em>café</em>"}</h1></div></div>

    <div class="editor">
      <div class="editor-preview">
        <div id="prev"></div>
        <div><div class="h3" id="prevName">${esc(c.name) || "Seu café"}</div><div class="small muted" id="prevSub" style="margin-top:4px"></div></div>
        <div class="stack" style="width:100%;gap:16px;text-align:left">
          <div class="field"><span class="label">Formato</span><div class="shape-pick" id="shapes">${SHAPES.map((s) => `<button data-shape="${s.id}" class="${c.avatar.shape === s.id ? "on" : ""}">${bagSVG(Object.assign({}, c.avatar, { shape: s.id }), { fade: false })}${s.name}</button>`).join("")}</div></div>
          <div class="field"><span class="label">Cor do saco</span>${swatches(BAG_COLORS, "color")}</div>
          <div class="field"><span class="label">Cor do rótulo</span>${swatches(LABEL_COLORS, "label")}</div>
          <div class="field"><span class="label">Torra · <span id="roastName">${ROASTS[c.avatar.roast - 1]}</span></span>
            <input type="range" class="range" id="roast" min="1" max="5" step="1" value="${c.avatar.roast}">
            <div class="roast-scale"><span>Clara</span><span>Escura</span></div></div>
          <div class="field"><label>Sigla no rótulo</label><input class="input" id="ini" maxlength="3" placeholder="Ex.: MOG" value="${esc(c.avatar.initials)}"></div>
        </div>
      </div>

      <div class="stack" style="gap:14px">
        <div class="card form-card">
          <h2 class="h3">Sobre o café</h2>
          <div class="form-grid">
            ${inp("name", "Nome *", "Ex.: Mogiana Doce", "text", null, "full")}
            ${inp("roaster", "Torrefação", "Ex.: Café Orfeu")}
            ${inp("origin", "Origem", "Ex.: Brasil")}
            ${inp("region", "Região / Fazenda", "Ex.: Sul de Minas")}
            ${inp("variety", "Variedade", "Ex.: Bourbon Amarelo")}
            <div class="field"><label>Processo</label><select class="select" data-k="process"><option value="">—</option>${PROCESSES.map((p) => `<option ${c.process === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
            ${inp("altitude", "Altitude", "1.200", "text", "m")}
            ${inp("roast_date", "Data da torra", "", "date")}
            ${inp("price", "Preço do saco", "0,00", "number", "R$")}
            ${inp("default_bag_g", "Tamanho padrão do saco", "250", "number", "g")}
            <div class="field full"><label>Notas sensoriais da torrefação</label><input class="input" data-k="tasting" placeholder="Ex.: chocolate ao leite, caramelo, laranja" value="${esc(c.tasting || "")}"></div>
            <div class="field full"><label>Anotações</label><textarea class="textarea" data-k="notes" placeholder="Onde comprou, primeira impressão…">${esc(c.notes || "")}</textarea></div>
          </div>
        </div>

        ${existing ? "" : `<div class="card form-card">
          <div class="row between"><div><h2 class="h3">Sacos</h2><p class="small muted" style="margin:4px 0 0">Tem mais de um saco igual? Adiciona todos. O primeiro já fica aberto.</p></div><button class="btn sm" id="addRow">${ic("plus")}Saco</button></div>
          <div class="bag-rows" id="bagRows"></div>
        </div>`}

        <div class="card form-card">
          <h2 class="h3">Foto do saco <span class="faint small" style="font-weight:400">(opcional)</span></h2>
          <div class="photos" id="cPhoto"></div>
        </div>

        <div class="row" style="justify-content:flex-end"><a class="btn ghost" href="${existing ? "#/cafe/" + id : "#/despensa"}">Cancelar</a><button class="btn primary lg" id="save">${existing ? "Salvar" : "Cadastrar café"}</button></div>
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(v) {
      const drawPrev = () => {
        $("#prev", v).innerHTML = bagSVG(c.avatar, { fade: false });
        $("#prevName", v).textContent = c.name || "Seu café";
        $("#prevSub", v).textContent = [c.roaster, ROASTS[c.avatar.roast - 1]].filter(Boolean).join(" · ");
        $$("#shapes button", v).forEach((b) => { b.querySelector(".bag-av").outerHTML = bagSVG(Object.assign({}, c.avatar, { shape: b.dataset.shape }), { fade: false }); });
        const r = $("#roast", v); r.style.setProperty("--p", ((c.avatar.roast - 1) / 4) * 100 + "%");
      };
      drawPrev();
      $$("[data-k]", v).forEach((el) => (el.oninput = () => {
        c[el.dataset.k] = el.value;
        if (el.dataset.k === "name" && autoInitials) { c.avatar.initials = initialsOf(el.value); $("#ini", v).value = c.avatar.initials; }
        if (el.dataset.k === "name" || el.dataset.k === "roaster") drawPrev();
      }));
      $("#ini", v).oninput = (e) => { autoInitials = !e.target.value; c.avatar.initials = e.target.value; drawPrev(); };
      $$("#shapes button", v).forEach((b) => (b.onclick = () => { c.avatar.shape = b.dataset.shape; $$("#shapes button", v).forEach((x) => x.classList.toggle("on", x === b)); drawPrev(); }));
      $$(".swatches", v).forEach((wrap) => {
        const key = wrap.dataset.key;
        $$("[data-col]", wrap).forEach((s) => (s.onclick = () => { c.avatar[key] = s.dataset.col; $$(".swatch", wrap).forEach((x) => x.classList.toggle("on", x === s)); drawPrev(); }));
        $("[data-custom]", wrap).oninput = (e) => { c.avatar[key] = e.target.value; $$(".swatch", wrap).forEach((x) => x.classList.toggle("on", x.classList.contains("swatch-custom"))); drawPrev(); };
      });
      $("#roast", v).oninput = (e) => { c.avatar.roast = num(e.target.value); $("#roastName", v).textContent = ROASTS[c.avatar.roast - 1]; drawPrev(); };

      const drawRows = () => {
        const box = $("#bagRows", v); if (!box) return;
        box.innerHTML = newBags.map((b, i) => `<div class="bag-row">
          <div class="field"><label>Saco ${i + 1}</label><div class="input-unit"><input class="input" type="number" inputmode="decimal" data-bs="${i}" value="${b.size_g}"><span class="unit">g</span></div></div>
          <div class="field"><label>Já usado?</label><div class="input-unit"><input class="input" type="number" inputmode="decimal" data-bu="${i}" placeholder="0" value="${b.used || ""}"><span class="unit">g</span></div></div>
          <div class="field opt"><label>Preço</label><div class="input-unit"><input class="input" type="number" step="0.01" data-bp="${i}" placeholder="${c.price || ""}" value="${b.price || ""}"><span class="unit">R$</span></div></div>
          <button class="btn icon" data-brm="${i}" ${newBags.length === 1 ? "disabled" : ""} title="Remover">${ic("x")}</button>
        </div>`).join("");
        $$("[data-bs]", box).forEach((el) => (el.oninput = () => (newBags[el.dataset.bs].size_g = num(el.value))));
        $$("[data-bu]", box).forEach((el) => (el.oninput = () => (newBags[el.dataset.bu].used = num(el.value))));
        $$("[data-bp]", box).forEach((el) => (el.oninput = () => (newBags[el.dataset.bp].price = el.value)));
        $$("[data-brm]", box).forEach((el) => (el.onclick = () => { newBags.splice(num(el.dataset.brm), 1); drawRows(); }));
      };
      drawRows();
      const addRow = $("#addRow", v);
      if (addRow) addRow.onclick = () => { newBags.push({ size_g: num(c.default_bag_g, 250), price: "" }); drawRows(); };

      const drawPhoto = () => {
        $("#cPhoto", v).innerHTML = (c.photo ? `<div class="photo"><img src="${esc(c.photo)}" alt=""><button data-rm>×</button></div>` : "") +
          `<label class="photo-add">${ic("camera")}<input type="file" accept="image/*"></label>`;
        const rm = $("[data-rm]", v); if (rm) rm.onclick = () => { c.photo = null; drawPhoto(); };
        $("#cPhoto input", v).onchange = (e) => safe(async () => { const [u] = await uploadFiles([...e.target.files].slice(0, 1)); c.photo = u; drawPhoto(); });
      };
      drawPhoto();

      $("#save", v).onclick = () => safe(async () => {
        if (!c.name.trim()) { $("[data-k=name]", v).focus(); throw new Error("Dá um nome pro café"); }
        if (!c.avatar.initials) c.avatar.initials = initialsOf(c.name);
        const body = Object.assign({}, c, { price: c.price === "" ? null : num(c.price), default_bag_g: num(c.default_bag_g, 250) });
        if (existing) {
          await api.put("/api/coffees/" + id, body);
          await loadState(); toast("Café atualizado"); go("#/cafe/" + id);
        } else {
          body.bags = newBags.filter((b) => num(b.size_g) > 0).map((b) => ({ size_g: num(b.size_g), remaining_g: Math.max(0, num(b.size_g) - num(b.used)), price: b.price === "" || b.price == null ? body.price : num(b.price) }));
          const r = await api.post("/api/coffees", body);
          await loadState(); toast("Café cadastrado ☕"); go("#/cafe/" + r.id);
        }
      });
    },
  };
}

/* ===================================================================
   REGISTRAR PREPARO
   =================================================================== */
function viewBrewForm(editId, params) {
  const editing = editId ? S.brews.find((b) => b.id === editId) : null;
  const repeatFrom = params.get("repetir") ? S.brews.find((b) => b.id === params.get("repetir")) : null;
  const available = S.coffees.filter((c) => stock(c.id).count > 0 && !c.archived);
  const lastBrew = sortedBrews()[0];

  const base = editing || repeatFrom;
  const f = base ? JSON.parse(JSON.stringify(base)) : {};
  if (!editing) { delete f.id; delete f.consumed; f.rating = null; f.notes = ""; f.photos = []; f.flavors = []; f.sensory = {}; f.time_s = repeatFrom ? repeatFrom.time_s : null; }
  f.coffee_id = f.coffee_id || params.get("cafe") || (lastBrew && stock(lastBrew.coffee_id).count ? lastBrew.coffee_id : available[0] && available[0].id) || "";
  f.method = f.method || params.get("metodo") || (lastBrew && lastBrew.method) || "v60";
  f.photos = f.photos || []; f.flavors = f.flavors || []; f.sensory = f.sensory || {};
  f.brewed_at = editing ? brewTime(editing) : null;
  if (!base) applyDefaults(f, true);
  if (f.rating == null) f.rating = 7;
  let ratingTouched = !!editing;

  if (!available.length && !editing) {
    return { html: `<div class="page narrow"><div class="card empty-state">${bagSVG({ color: "#2a2420", label: "#3a322b" }, { ratio: 0 })}<h2 class="h2">Sem café na despensa</h2><p>Cadastra um grão primeiro, com o tamanho do saco. Aí cada preparo desconta os gramas sozinho.</p><a class="btn primary" href="#/cafe/novo" style="margin-top:8px">Cadastrar café</a></div></div>` };
  }

  const pickList = editing && !available.find((c) => c.id === editing.coffee_id) && coffeeById(editing.coffee_id) ? [coffeeById(editing.coffee_id), ...available] : available;

  const html = `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">${editing ? "Editar preparo" : repeatFrom ? "Repetindo receita" : "Novo preparo"}</div><h1 class="title">${editing ? "Ajustar <em>registro</em>" : "Hora do <em>café</em>"}</h1></div>
      ${!editing && lastBrew && !repeatFrom ? `<button class="btn" id="repeatBtn">${ic("repeat")}Repetir o último</button>` : ""}
    </div>

    <div class="brew-layout">
      <div>
        <div class="card form-card">
          <div class="row"><span class="step-n">1</span><h2 class="h3">Qual café?</h2></div>
          <div class="coffee-picker" id="picker">${pickList.map((c) => { const st = stock(c.id); return `<button class="coffee-pick ${f.coffee_id === c.id ? "on" : ""}" data-c="${c.id}">${coffeeAvatar(c)}<span>${esc(c.name)}</span><small>${fmtG(st.remaining)}</small></button>`; }).join("")}</div>
        </div>

        <div class="card form-card">
          <div class="row"><span class="step-n">2</span><h2 class="h3">Método</h2></div>
          <div class="methods" id="methods">${METHODS.map((m) => `<button class="method ${f.method === m.id ? "on" : ""}" data-m="${m.id}">${methodIcon(m.id)}${m.name}</button>`).join("")}</div>
        </div>

        <div class="card form-card">
          <div class="row between"><div class="row"><span class="step-n">3</span><h2 class="h3">Receita</h2></div><span class="ratio-pill" id="ratio"></span></div>
          <div id="recipe"></div>
        </div>

        <div class="card form-card">
          <div class="row"><span class="step-n">4</span><h2 class="h3">Como ficou?</h2></div>
          <div class="field">
            <div class="row between" style="align-items:flex-end"><div class="rating-big"><span class="v" id="rv"></span><span class="of">/10</span></div><span class="rating-word" id="rw"></span></div>
            <input type="range" class="range" id="rating" min="0" max="10" step="0.5" value="${f.rating}">
          </div>
          <div class="field"><span class="label">O que você sentiu</span><div class="chips" id="flavors">${FLAVORS.map((fl) => `<button class="chip ${f.flavors.includes(fl) ? "on" : ""}" data-fl="${esc(fl)}">${esc(fl)}</button>`).join("")}</div></div>
          <details class="more" ${Object.keys(f.sensory).length ? "open" : ""}><summary>Perfil sensorial</summary>
            <div class="stack">${SENSORY.map(([k, l]) => `<div class="sensory"><span class="muted">${l}</span><input type="range" class="range" min="0" max="5" step="1" data-sen="${k}" value="${f.sensory[k] || 0}"><b class="num" data-senv="${k}">${f.sensory[k] || "—"}</b></div>`).join("")}</div>
          </details>
          <div class="field"><label>Anotações</label><textarea class="textarea" id="notes" placeholder="Doce, mas um pouco aguado. Próxima: moer mais fino…">${esc(f.notes || "")}</textarea></div>
          <div class="field"><span class="label">Fotos</span><div class="photos" id="photos"></div></div>
          ${editing ? `<div class="field"><label>Data e hora</label><input class="input" type="datetime-local" id="when" value="${toLocalInput(brewTime(editing))}"></div>` : ""}
        </div>
      </div>

      <div class="brew-side">
        <div class="card mini-timer">
          <div class="row between"><span class="label">Timer</span><button class="btn ghost sm" id="bigTimer">Tela cheia</button></div>
          <div class="clock" id="mClock">0:00</div>
          <div class="small muted" id="mStage" style="min-height:18px"></div>
          <div class="row"><button class="btn primary block" id="mGo">Iniciar</button><button class="btn icon" id="mLap" title="Marcar etapa">${ic("spark")}</button><button class="btn icon" id="mReset" title="Zerar">${ic("repeat")}</button></div>
          <div class="lap-list" id="mLaps"></div>
        </div>
        <div id="suggestBox"></div>
        <div class="card stack" id="summary"></div>
        <button class="btn primary lg block" id="saveBrew">${editing ? "Salvar alterações" : "Registrar café"}</button>
        ${editing ? `<button class="btn ghost danger block" id="delBrew">${ic("trash")}Apagar registro</button>` : ""}
      </div>
    </div>
  </div>`;

  return {
    html,
    mount(v) {
      const recipeBox = $("#recipe", v);

      const field = (k, label, unit, opts) => {
        opts = opts || {};
        const val = f[k] == null || f[k] === "" ? "" : f[k];
        if (opts.stepper) return `<div class="field"><label>${label}</label><div class="stepper"><button data-dec="${k}" data-step="${opts.step || 1}">−</button><input data-f="${k}" type="text" inputmode="decimal" value="${esc(val)}" placeholder="${opts.ph || ""}"><button data-inc="${k}" data-step="${opts.step || 1}">+</button></div>${unit ? `<span class="tiny faint">${unit}</span>` : ""}</div>`;
        return `<div class="field ${opts.cls || ""}"><label>${label}</label><div class="input-unit"><input class="input" data-f="${k}" type="text" inputmode="${opts.text ? "text" : "decimal"}" value="${esc(val)}" placeholder="${opts.ph || ""}">${unit ? `<span class="unit">${unit}</span>` : ""}</div></div>`;
      };

      const drawRecipe = () => {
        const m = METHOD[f.method] || METHOD.outro;
        const gs = grinders();
        const g = equipById(f.grinder_id);
        const isEsp = m.kind === "espresso", isCold = m.kind === "cold";
        recipeBox.innerHTML = `
          <div class="form-grid c3">
            ${field("dose_g", "Dose de café", "gramas", { stepper: true, step: 0.5, ph: "18" })}
            ${isEsp ? field("yield_g", "Bebida na xícara", "gramas", { stepper: true, step: 1, ph: "36" }) : field("water_g", "Água", "gramas / ml", { stepper: true, step: 10, ph: "250" })}
            ${isCold ? field("steep_h", "Infusão", "horas", { stepper: true, step: 1, ph: "16" }) : field("temp_c", "Temperatura", "°C", { stepper: true, step: 1, ph: "93" })}
          </div>
          <div class="form-grid c3" style="margin-top:14px">
            <div class="field"><label>Moedor</label><select class="select" id="grinder"><option value="">${gs.length ? "—" : "Cadastre em Ajustes"}</option>${gs.map((x) => `<option value="${x.id}" ${f.grinder_id === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
            ${field("grind", "Moagem", g && g.unit ? g.unit : "cliques", { stepper: true, step: 1, ph: "20" })}
            <div class="field"><label>Tempo de extração</label><div class="input-unit"><input class="input" data-f="time_txt" type="text" inputmode="numeric" placeholder="${isEsp ? "0:28" : "3:00"}" value="${f.time_s ? fmtTime(f.time_s) : ""}"><span class="unit">min</span></div></div>
          </div>
          <details class="more" style="margin-top:16px" ${f.bloom_s || f.water_type || f.filter || f.brewer_id ? "open" : ""}><summary>Mais detalhes</summary>
            <div class="form-grid c3">
              <div class="field"><label>Cafeteira / equipamento</label><select class="select" id="brewer"><option value="">—</option>${S.equipment.filter((e) => e.type !== "grinder").map((x) => `<option value="${x.id}" ${f.brewer_id === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>
              ${isEsp ? field("pressure", "Pressão", "bar", { ph: "9" }) : field("bloom_s", "Bloom", "seg", { ph: "40" })}
              ${field("water_type", "Água usada", "", { text: true, ph: "Filtrada" })}
              ${!isEsp ? field("filter", "Filtro", "", { text: true, ph: "Papel" }) : ""}
              ${field("milk", "Leite / adicionais", "", { text: true, ph: "—" })}
            </div>
          </details>`;
        bindRecipe();
        drawSummary();
      };

      const bindRecipe = () => {
        $$("[data-f]", recipeBox).forEach((el) => (el.oninput = () => {
          const k = el.dataset.f;
          if (k === "time_txt") f.time_s = parseTime(el.value);
          else f[k] = el.value;
          if (k === "dose_g") autoWater();
          drawSummary();
        }));
        const step = (k, d) => {
          const el = $(`[data-f="${k}"]`, recipeBox);
          const cur = num(el.value, num(el.placeholder, 0));
          const nv = round(Math.max(0, cur + d), 1);
          el.value = String(nv).replace(".", ","); f[k] = nv;
          if (k === "dose_g") autoWater();
          drawSummary();
        };
        $$("[data-inc]", recipeBox).forEach((b) => (b.onclick = () => step(b.dataset.inc, num(b.dataset.step))));
        $$("[data-dec]", recipeBox).forEach((b) => (b.onclick = () => step(b.dataset.dec, -num(b.dataset.step))));
        $("#grinder", recipeBox).onchange = (e) => { f.grinder_id = e.target.value; const last = lastWith((b) => b.grinder_id === f.grinder_id && b.coffee_id === f.coffee_id); if (last && !f.grind) f.grind = last.grind; drawRecipe(); };
        const br = $("#brewer", recipeBox); if (br) br.onchange = (e) => (f.brewer_id = e.target.value);
      };

      // ajusta a água pela proporção ao mudar a dose
      let waterTouched = !!base;
      const autoWater = () => {
        const m = METHOD[f.method] || METHOD.outro;
        const key = m.kind === "espresso" ? "yield_g" : "water_g";
        if (waterTouched && f[key]) return;
        const ratio = (S.settings.ratios || {})[f.method] || DEFAULT_RATIO[f.method] || 15;
        if (num(f.dose_g)) {
          f[key] = round(num(f.dose_g) * ratio, 0);
          const el = $(`[data-f="${key}"]`, recipeBox); if (el) el.value = f[key];
        }
      };
      recipeBox.addEventListener("input", (e) => { if (e.target.dataset.f === "water_g" || e.target.dataset.f === "yield_g") waterTouched = true; });
      recipeBox.addEventListener("click", (e) => { const k = e.target.dataset.inc || e.target.dataset.dec; if (k === "water_g" || k === "yield_g") waterTouched = true; });

      const drawSummary = () => {
        const m = METHOD[f.method] || METHOD.outro;
        const c = coffeeById(f.coffee_id);
        const st = c ? stock(c.id) : null;
        const dose = num(f.dose_g);
        const out = m.kind === "espresso" ? num(f.yield_g) : num(f.water_g);
        $("#ratio", v).innerHTML = dose && out ? `1 : <b>${fmtN(out / dose)}</b>` : "proporção";
        const after = st ? st.remaining - dose : 0;
        const ppg = st && st.open ? bagPricePerGram(st.open, c) : null;
        $("#summary", v).innerHTML = c ? `
          <div class="row"><div style="width:44px">${bagSVG(c.avatar, { ratio: st && st.open ? clamp((num(st.open.remaining_g) - (editing ? 0 : dose)) / Math.max(1, num(st.open.size_g)), 0, 1) : 0, count: st ? st.count : 1 })}</div>
          <div><div class="h3">${esc(c.name)}</div><div class="small muted">${esc(m.name)}${dose ? " · " + fmtN(dose) + " g" : ""}</div></div></div>
          ${!editing && st ? `<div class="small muted">Depois desse café: <b style="color:var(--text)">${fmtG(Math.max(0, after))}</b> no estoque${after < 0 ? ` <span class="badge bad">faltam ${fmtG(-after)}</span>` : ""}</div>
          ${st.open && dose >= num(st.open.remaining_g) && num(st.open.remaining_g) > 0 ? `<div class="badge warn">Esse saco vai acabar${st.count > 1 ? " e o próximo abre" : ""}</div>` : ""}` : ""}
          ${ppg && dose ? `<div class="small muted">Custo dessa xícara: <b style="color:var(--text)">${fmtMoney(ppg * dose)}</b></div>` : ""}` : `<span class="muted small">Escolha um café.</span>`;
      };

      const drawSuggest = () => {
        const best = S.brews.filter((b) => b.coffee_id === f.coffee_id && b.method === f.method && b.rating != null && b.id !== editId).sort((a, b) => num(b.rating) - num(a.rating))[0];
        const box = $("#suggestBox", v);
        if (!best || editing) { box.innerHTML = ""; return; }
        box.innerHTML = `<div class="suggest"><div class="row between"><span class="h3">Sua melhor com esse grão</span><span class="score">${fmtN(best.rating)}</span></div><p class="small muted" style="margin:8px 0 12px">${recipeLine(best)}</p><button class="btn sm" id="useBest">Usar essa receita</button></div>`;
        $("#useBest", box).onclick = () => { copyRecipe(best); waterTouched = true; drawRecipe(); toast("Receita carregada"); };
      };

      const lastWith = (pred) => sortedBrews().find(pred);
      const copyRecipe = (src) => ["dose_g", "water_g", "yield_g", "temp_c", "grind", "grinder_id", "brewer_id", "bloom_s", "pressure", "water_type", "filter", "steep_h", "milk"].forEach((k) => (f[k] = src[k]));

      // Ao trocar café/método: puxa a última receita desse par automaticamente
      const onPairChange = () => {
        if (editing) return;
        const last = lastWith((b) => b.coffee_id === f.coffee_id && b.method === f.method) || lastWith((b) => b.method === f.method);
        if (last) { copyRecipe(last); waterTouched = true; } else { applyDefaults(f); waterTouched = false; }
        drawRecipe(); drawSuggest(); syncTimerMode();
      };

      $$("#picker [data-c]", v).forEach((b) => (b.onclick = () => { f.coffee_id = b.dataset.c; $$("#picker [data-c]", v).forEach((x) => x.classList.toggle("on", x === b)); onPairChange(); }));
      $$("#methods [data-m]", v).forEach((b) => (b.onclick = () => { f.method = b.dataset.m; $$("#methods [data-m]", v).forEach((x) => x.classList.toggle("on", x === b)); onPairChange(); }));

      // nota
      const rr = $("#rating", v);
      const updRating = () => { f.rating = num(rr.value); $("#rv", v).textContent = fmtN(f.rating); $("#rw", v).textContent = ratingWord(f.rating); rr.style.setProperty("--p", f.rating * 10 + "%"); };
      rr.oninput = () => { ratingTouched = true; updRating(); };
      updRating();
      $$("#flavors [data-fl]", v).forEach((b) => (b.onclick = () => {
        const fl = b.dataset.fl; const i = f.flavors.indexOf(fl);
        i >= 0 ? f.flavors.splice(i, 1) : f.flavors.push(fl); b.classList.toggle("on", i < 0);
      }));
      $$("[data-sen]", v).forEach((el) => {
        const upd = () => { el.style.setProperty("--p", (num(el.value) / 5) * 100 + "%"); $(`[data-senv="${el.dataset.sen}"]`, v).textContent = num(el.value) || "—"; };
        el.oninput = () => { f.sensory[el.dataset.sen] = num(el.value); upd(); }; upd();
      });

      // fotos
      const drawPhotos = () => {
        const box = $("#photos", v);
        box.innerHTML = f.photos.map((p, i) => `<div class="photo"><img src="${esc(p)}" alt=""><button data-rp="${i}">×</button></div>`).join("") +
          `<label class="photo-add">${ic("camera")}<input type="file" accept="image/*" multiple></label>`;
        $$("[data-rp]", box).forEach((b) => (b.onclick = () => { f.photos.splice(num(b.dataset.rp), 1); drawPhotos(); }));
        $("input", box).onchange = (e) => safe(async () => { const urls = await uploadFiles([...e.target.files]); f.photos.push(...urls); drawPhotos(); });
      };
      drawPhotos();

      // timer embutido
      const syncTimerMode = () => {
        if (Timer.running || Timer.now() > 0) return;
        const p = timerPresetFromMethod(f.method); Timer.setMode(p.mode, p.target);
      };
      syncTimerMode();
      const drawMini = () => {
        const t = Timer.now(), fm = fmtTimer(t);
        $("#mClock", v).textContent = fm.main + (t > 0 && t < 60 ? fm.dec : "");
        $("#mClock", v).classList.toggle("running", Timer.running);
        $("#mGo", v).textContent = Timer.running ? "Pausar" : t > 0 ? "Continuar" : "Iniciar";
        let st = "";
        if (Timer.mode === "pour") { const i = POUR_STAGES.reduce((a, s, idx) => (t >= s.t ? idx : a), 0); const wt = num(f.water_g); st = POUR_STAGES[i].label + (wt && POUR_STAGES[i].t < 150 ? ` · até ${Math.round(wt * POUR_STAGES[i].pct)} g` : ""); }
        else if (Timer.mode === "espresso") st = t === 0 ? "alvo 25–32 s" : t < 25 ? "extraindo…" : t <= 32 ? "no ponto" : "passou do ponto";
        else if (Timer.target) st = Timer.target - t > 0 ? "faltam " + fmtTime(Timer.target - t) : "pronto!";
        $("#mStage", v).textContent = st;
        $("#mLaps", v).innerHTML = Timer.laps.map((l, i) => `<div><span>Etapa ${i + 1}</span><span>${fmtTimer(l).main}</span></div>`).join("");
        if (!Timer.running && t > 0 && !f._timerApplied) { f.time_s = round(t, 0); const el = $('[data-f="time_txt"]', v); if (el) el.value = fmtTime(f.time_s); f._timerApplied = true; }
        if (Timer.running) f._timerApplied = false;
      };
      const off = Timer.on(drawMini); drawMini();
      $("#mGo", v).onclick = () => { Timer.waterTarget = num(f.water_g) || null; Timer.toggle(); };
      $("#mLap", v).onclick = () => Timer.lap();
      $("#mReset", v).onclick = () => { Timer.reset(); syncTimerMode(); };
      $("#bigTimer", v).onclick = () => openTimer({ water: num(f.water_g) || null, onUse: (t, laps) => { f.time_s = round(t, 0); f.laps = laps; const el = $('[data-f="time_txt"]', v); if (el) el.value = fmtTime(f.time_s); } });

      const rb = $("#repeatBtn", v); if (rb) rb.onclick = () => go(`#/preparar?repetir=${lastBrew.id}`);

      drawRecipe(); drawSuggest();

      $("#saveBrew", v).onclick = () => safe(async () => {
        if (!f.coffee_id) throw new Error("Escolha um café");
        if (!num(f.dose_g)) { const el = $('[data-f="dose_g"]', v); el && el.focus(); throw new Error("Coloca a dose de café (g)"); }
        const body = {};
        ["coffee_id", "method", "grinder_id", "brewer_id", "water_type", "filter", "milk"].forEach((k) => (body[k] = f[k] || null));
        ["dose_g", "water_g", "yield_g", "temp_c", "bloom_s", "pressure", "steep_h"].forEach((k) => (body[k] = f[k] === "" || f[k] == null ? null : num(f[k], null)));
        body.grind = f.grind === "" || f.grind == null ? null : String(f.grind).replace(".", ",");
        body.time_s = f.time_s ? round(num(f.time_s), 0) : null;
        body.rating = f.rating; body.flavors = f.flavors; body.sensory = f.sensory;
        body.notes = $("#notes", v).value; body.photos = f.photos;
        if (Timer.laps.length && !editing) body.laps = Timer.laps.map((l) => round(l, 1));
        let res;
        if (editing) {
          const when = $("#when", v);
          if (when && when.value) body.brewed_at = new Date(when.value).toISOString();
          res = await api.put("/api/brews/" + editing.id, body);
        } else {
          body.brewed_at = new Date().toISOString();
          res = await api.post("/api/brews", body);
          Timer.reset();
        }
        await loadState();
        toast(editing ? "Registro atualizado" : "Café registrado ☕");
        go("#/preparo/" + res.brew.id);
        if (res.short_g > 0) toast(`Faltaram ${fmtG(res.short_g)} no estoque`, true);
        if (res.finished_bags && res.finished_bags.length) setTimeout(() => bagReviewModal(S.bags.find((b) => b.id === res.finished_bags[0])), 500);
      });

      const del = $("#delBrew", v);
      if (del) del.onclick = async () => {
        if (await confirmBox("Apagar esse registro?", "Os gramas voltam pro saco.", "Apagar", true))
          safe(async () => { await api.del("/api/brews/" + editing.id); await loadState(); toast("Registro apagado"); go("#/historico"); });
      };

      return () => off();
    },
  };
}

function applyDefaults(f, initial) {
  const k = (METHOD[f.method] || METHOD.outro).kind;
  const ratio = (S.settings.ratios || {})[f.method] || DEFAULT_RATIO[f.method] || 15;
  const dose = { espresso: 18, pour: 15, immersion: 15, moka: 15, cold: 60 }[k] || 15;
  f.dose_g = dose;
  f.water_g = k === "espresso" ? null : round(dose * ratio, 0);
  f.yield_g = k === "espresso" ? round(dose * ratio, 0) : null;
  f.temp_c = k === "espresso" ? 93 : k === "cold" ? null : k === "moka" ? 70 : 93;
  f.steep_h = k === "cold" ? 16 : null;
  f.grind = null;
  if (!f.grinder_id && grinders()[0]) f.grinder_id = grinders()[0].id;
}

/* ---------------------------------------------------------- detalhe preparo */
function viewBrew(id) {
  const b = S.brews.find((x) => x.id === id);
  if (!b) return { html: `<div class="page"><div class="card empty-state"><p>Registro não encontrado.</p><a class="btn" href="#/historico">Histórico</a></div></div>` };
  const c = coffeeById(b.coffee_id), m = METHOD[b.method] || METHOD.outro, g = equipById(b.grinder_id), br = equipById(b.brewer_id);
  const isEsp = m.kind === "espresso";
  const out = isEsp ? num(b.yield_g) : num(b.water_g);
  const cost = brewCost(b);
  const kv = [
    ["Dose", num(b.dose_g) ? fmtN(b.dose_g) + " g" : null],
    [isEsp ? "Bebida" : "Água", out ? fmtN(out) + " g" : null],
    ["Proporção", num(b.dose_g) && out ? "1:" + fmtN(out / num(b.dose_g)) : null],
    ["Moagem", b.grind ? `${b.grind} ${g && g.unit ? g.unit : "cliques"}` : null],
    ["Moedor", g ? g.name : null],
    ["Tempo", b.time_s ? fmtTime(b.time_s) : null],
    ["Temperatura", b.temp_c ? fmtN(b.temp_c, 0) + " °C" : null],
    ["Bloom", b.bloom_s ? b.bloom_s + " s" : null],
    ["Pressão", b.pressure ? b.pressure + " bar" : null],
    ["Infusão", b.steep_h ? b.steep_h + " h" : null],
    ["Equipamento", br ? br.name : null],
    ["Água", b.water_type || null],
    ["Filtro", b.filter || null],
    ["Adicionais", b.milk || null],
    ["Custo", cost != null ? fmtMoney(cost) : null],
  ].filter((x) => x[1]);
  const html = `<div class="page narrow">
    <a class="btn ghost sm" href="#/historico" style="margin-left:-10px">${ic("back")}Histórico</a>
    <div class="page-head" style="margin-top:10px;align-items:center">
      <div class="row" style="gap:18px">
        <span class="brew-icon" style="width:58px;height:58px;border-radius:18px">${methodIcon(b.method)}</span>
        <div><div class="eyebrow">${fmtDayLabel(brewTime(b))} · ${fmtClock(brewTime(b))}</div><h1 class="title" style="font-size:32px">${esc(m.name)}</h1>
        ${c ? `<a class="muted" href="#/cafe/${c.id}">${esc(c.name)}${c.roaster ? " · " + esc(c.roaster) : ""}</a>` : `<span class="muted">Café removido</span>`}</div>
      </div>
      <div style="text-align:right"><div class="rating-big" style="justify-content:flex-end"><span class="v">${b.rating != null ? fmtN(b.rating) : "—"}</span><span class="of">/10</span></div><div class="rating-word">${ratingWord(b.rating)}</div></div>
    </div>
    <div class="card pad-lg"><div class="kv">${kv.map(([k, val]) => `<div><span>${k}</span><b>${esc(val)}</b></div>`).join("")}</div></div>
    ${(b.flavors && b.flavors.length) || (b.sensory && Object.values(b.sensory).some(Boolean)) ? `<div class="card" style="margin-top:14px">
      ${b.flavors && b.flavors.length ? `<span class="label">Sabores</span><div class="tag-cloud" style="margin-top:8px">${b.flavors.map((f) => `<span class="badge leather">${esc(f)}</span>`).join("")}</div>` : ""}
      ${b.sensory && Object.values(b.sensory).some(Boolean) ? `<div class="stack" style="margin-top:16px">${SENSORY.map(([k, l]) => `<div class="hbar" style="grid-template-columns:80px 1fr 24px"><span class="muted">${l}</span><span class="track"><i style="width:${(num(b.sensory[k]) / 5) * 100}%"></i></span><b>${b.sensory[k] || "—"}</b></div>`).join("")}</div>` : ""}
    </div>` : ""}
    ${b.notes ? `<div class="card" style="margin-top:14px"><span class="label">Anotações</span><p style="margin:8px 0 0;white-space:pre-wrap">${esc(b.notes)}</p></div>` : ""}
    ${b.laps && b.laps.length ? `<div class="card" style="margin-top:14px"><span class="label">Etapas marcadas</span><div class="lap-list" style="margin-top:8px;max-height:none">${b.laps.map((l, i) => `<div><span>Etapa ${i + 1}</span><span>${fmtTime(l)}</span></div>`).join("")}</div></div>` : ""}
    ${b.photos && b.photos.length ? `<div class="card" style="margin-top:14px"><div class="gallery">${b.photos.map((p) => `<img src="${esc(p)}" data-lightbox="${esc(p)}" alt="">`).join("")}</div></div>` : ""}
    <div class="row wrap" style="margin-top:20px">
      <a class="btn primary" href="#/preparar?repetir=${b.id}">${ic("repeat")}Repetir receita</a>
      <a class="btn" href="#/preparo/${b.id}/editar">${ic("edit")}Editar</a>
    </div>
  </div>`;
  return { html };
}

/* ===================================================================
   HISTÓRICO
   =================================================================== */
const histF = { q: "", method: "", coffee: "", min: "" };
function viewHistory() {
  const html = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">${S.brews.length} registros</div><h1 class="title">Histórico</h1></div>
      <a class="btn" href="/api/export" download>${ic("download")}Exportar</a></div>
    <div class="card" style="padding:14px;margin-bottom:18px">
      <div class="form-grid c4">
        <input class="input" id="hq" placeholder="Buscar nas anotações…" value="${esc(histF.q)}">
        <select class="select" id="hm"><option value="">Todos os métodos</option>${METHODS.map((m) => `<option value="${m.id}" ${histF.method === m.id ? "selected" : ""}>${m.name}</option>`).join("")}</select>
        <select class="select" id="hc"><option value="">Todos os cafés</option>${S.coffees.map((c) => `<option value="${c.id}" ${histF.coffee === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <select class="select" id="hr"><option value="">Qualquer nota</option>${[9, 8, 7, 5].map((n) => `<option value="${n}" ${String(histF.min) === String(n) ? "selected" : ""}>Nota ≥ ${n}</option>`).join("")}</select>
      </div>
    </div>
    <div id="hList"></div>
  </div>`;
  return {
    html,
    mount(v) {
      const draw = () => {
        const q = histF.q.toLowerCase();
        const list = sortedBrews().filter((b) => {
          if (histF.method && b.method !== histF.method) return false;
          if (histF.coffee && b.coffee_id !== histF.coffee) return false;
          if (histF.min && !(num(b.rating, -1) >= num(histF.min))) return false;
          if (q) { const c = coffeeById(b.coffee_id); const hay = [b.notes, (b.flavors || []).join(" "), c && c.name, (METHOD[b.method] || {}).name].join(" ").toLowerCase(); if (!hay.includes(q)) return false; }
          return true;
        });
        if (!list.length) { $("#hList", v).innerHTML = `<div class="card empty-state"><p>${S.brews.length ? "Nada com esses filtros." : "Nenhum café registrado ainda."}</p>${S.brews.length ? "" : `<a class="btn primary" href="#/preparar">Registrar o primeiro</a>`}</div>`; return; }
        const groups = {};
        list.forEach((b) => { const k = dayKey(brewTime(b)); (groups[k] = groups[k] || []).push(b); });
        $("#hList", v).innerHTML = `<div class="card">${Object.entries(groups).map(([, items]) => `<div class="day-label">${fmtDayLabel(brewTime(items[0]))}</div>${brewList(items)}`).join("")}</div>`;
      };
      $("#hq", v).oninput = (e) => { histF.q = e.target.value; draw(); };
      $("#hm", v).onchange = (e) => { histF.method = e.target.value; draw(); };
      $("#hc", v).onchange = (e) => { histF.coffee = e.target.value; draw(); };
      $("#hr", v).onchange = (e) => { histF.min = e.target.value; draw(); };
      draw();
    },
  };
}

/* ===================================================================
   PAINEL (dashboard)
   =================================================================== */
let dashRange = 90;
function viewDashboard() {
  const all = sortedBrews().reverse(); // antigo → novo
  const since = dashRange ? Date.now() - dashRange * DAY : 0;
  const list = all.filter((b) => new Date(brewTime(b)) >= since);
  const prev = dashRange ? all.filter((b) => { const t = new Date(brewTime(b)); return t < since && t >= since - dashRange * DAY; }) : [];
  const rated = list.filter((b) => b.rating != null);
  const avgR = avg(rated.map((b) => num(b.rating)));
  const prevAvg = avg(prev.filter((b) => b.rating != null).map((b) => num(b.rating)));
  const grams = list.reduce((s, b) => s + num(b.dose_g), 0);
  const costs = list.map(brewCost).filter((x) => x != null);
  const happy = rated.length ? rated.filter((b) => num(b.rating) >= 8).length / rated.length : null;
  const esp = list.filter((b) => b.method === "espresso" && b.time_s);
  const pour = list.filter((b) => (METHOD[b.method] || {}).kind === "pour" && b.time_s);

  // tendência: compara metade antiga vs nova
  let trend = null;
  if (rated.length >= 4) { const h = Math.floor(rated.length / 2); trend = avg(rated.slice(h).map((b) => num(b.rating))) - avg(rated.slice(0, h).map((b) => num(b.rating))); }

  const delta = (d) => d == null || !isFinite(d) ? "" : `<span class="delta ${d > 0.05 ? "up" : d < -0.05 ? "down" : "flat"}">${d > 0 ? "+" : ""}${fmtN(d)}</span>`;

  const byMethod = {};
  rated.forEach((b) => ((byMethod[b.method] = byMethod[b.method] || []).push(num(b.rating))));
  const methodRows = Object.entries(byMethod).map(([k, a]) => [k, avg(a), a.length]).sort((a, b) => b[1] - a[1]);

  const byCoffee = {};
  rated.forEach((b) => ((byCoffee[b.coffee_id] = byCoffee[b.coffee_id] || []).push(num(b.rating))));
  const coffeeRows = Object.entries(byCoffee).map(([k, a]) => [k, avg(a), a.length]).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const flavorCount = {};
  list.forEach((b) => (b.flavors || []).forEach((f) => (flavorCount[f] = (flavorCount[f] || 0) + 1)));
  const flavors = Object.entries(flavorCount).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const finishedBags = S.bags.filter((b) => b.final_rating != null).sort((a, b) => num(b.final_rating) - num(a.final_rating));

  const html = `<div class="page">
    <div class="page-head"><div><div class="eyebrow">Seu progresso</div><h1 class="title">Painel</h1></div>
      <div class="seg" id="dr">${[[30, "30 dias"], [90, "90 dias"], [365, "1 ano"], [0, "Tudo"]].map(([d, l]) => `<button class="${dashRange === d ? "on" : ""}" data-d="${d}">${l}</button>`).join("")}</div></div>

    ${!list.length ? `<div class="card empty-state"><p>Registra alguns cafés que o painel ganha vida: evolução das notas, consumo, custo por xícara e o que você mais curte.</p><a class="btn primary" href="#/preparar" style="margin-top:8px">Registrar café</a></div>` : `
    <div class="grid g4">
      <div class="card stat"><span class="v num">${list.length}</span><span class="k">cafés feitos</span></div>
      <div class="card stat"><div class="row" style="gap:8px"><span class="v num">${fmtN(avgR)}</span>${delta(avgR != null && prevAvg != null ? avgR - prevAvg : null)}</div><span class="k">nota média${prevAvg != null ? " · vs período anterior" : ""}</span></div>
      <div class="card stat"><span class="v num">${happy != null ? Math.round(happy * 100) + "%" : "—"}</span><span class="k">cafés com nota ≥ 8</span></div>
      <div class="card stat"><span class="v num">${fmtG(grams)}</span><span class="k">de café moído</span></div>
      <div class="card stat"><span class="v num">${costs.length ? fmtMoney(avg(costs)) : "—"}</span><span class="k">custo médio por xícara</span></div>
      <div class="card stat"><span class="v num">${costs.length ? fmtMoney(costs.reduce((a, b) => a + b, 0)) : "—"}</span><span class="k">gasto em café no período</span></div>
      <div class="card stat"><span class="v num">${esp.length ? fmtN(avg(esp.map((b) => num(b.time_s))), 0) + "s" : "—"}</span><span class="k">extração média espresso</span></div>
      <div class="card stat"><span class="v num">${pour.length ? fmtTime(avg(pour.map((b) => num(b.time_s)))) : "—"}</span><span class="k">tempo médio coado</span></div>
    </div>

    <div class="card chart-card section" style="margin-top:14px">
      <div class="row between wrap"><div><h2 class="h3">Evolução da nota</h2><p class="small muted" style="margin:4px 0 0">${trend == null ? "Cada ponto é um café." : trend > 0.2 ? "Seu café está <b style='color:var(--good)'>melhorando</b> 📈" : trend < -0.2 ? "As notas <b style='color:var(--bad)'>caíram</b> um pouco. Hora de ajustar a receita?" : "Suas notas estão <b>estáveis</b>."}</p></div>
      <div class="legend"><span><i style="background:var(--leather-2)"></i>média móvel</span><span><i style="background:var(--faint);border-radius:50%"></i>cada café</span></div></div>
      <div id="cTrend"></div>
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card chart-card"><h2 class="h3">Distribuição das notas</h2><div id="cDist"></div></div>
      <div class="card chart-card"><h2 class="h3">Consumo por semana</h2><div id="cWeek"></div></div>
    </div>

    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h2 class="h3" style="margin-bottom:12px">Nota por método</h2>${methodRows.map(([k, a, n]) => `<div class="hbar"><span>${esc((METHOD[k] || METHOD.outro).name)} <span class="faint tiny">${n}</span></span><span class="track"><i style="width:${a * 10}%"></i></span><b>${fmtN(a)}</b></div>`).join("") || `<p class="muted small">—</p>`}</div>
      <div class="card"><h2 class="h3" style="margin-bottom:12px">Melhores cafés</h2>${coffeeRows.map(([k, a, n]) => { const c = coffeeById(k); return `<div class="hbar"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c ? c.name : "—")} <span class="faint tiny">${n}</span></span><span class="track"><i style="width:${a * 10}%"></i></span><b>${fmtN(a)}</b></div>`; }).join("") || `<p class="muted small">—</p>`}</div>
    </div>

    ${flavors.length ? `<div class="card" style="margin-top:14px"><h2 class="h3" style="margin-bottom:12px">Sabores que mais aparecem</h2><div class="tag-cloud">${flavors.map(([f, n]) => `<span class="chip" style="height:32px;cursor:default">${esc(f)} <span class="faint">${n}</span></span>`).join("")}</div></div>` : ""}

    ${finishedBags.length ? `<div class="card" style="margin-top:14px"><h2 class="h3" style="margin-bottom:6px">Ranking dos sacos finalizados</h2><ul class="list-plain">${finishedBags.map((b) => { const c = coffeeById(b.coffee_id); return `<li><div style="width:30px">${bagSVG(c?.avatar, { ratio: 0, fade: false })}</div><div style="flex:1"><div class="h3">${esc(c ? c.name : "—")}</div><div class="tiny muted">${b.finished_at ? "acabou " + fmtDate(b.finished_at, { day: "numeric", month: "short", year: "numeric" }) : ""}${b.buy_again === true ? " · compraria de novo" : b.buy_again === false ? " · não compraria" : ""}</div></div><span class="score">${fmtN(b.final_rating)}</span></li>`; }).join("")}</ul></div>` : ""}
    `}
  </div>`;

  return {
    html,
    mount(v) {
      $$("#dr button", v).forEach((b) => (b.onclick = () => { dashRange = num(b.dataset.d); render(); }));
      if (!list.length) return;
      $("#cTrend", v).innerHTML = trendChart(rated);
      $("#cDist", v).innerHTML = distChart(rated);
      $("#cWeek", v).innerHTML = weekChart(list);
      bindTips(v);
    },
  };
}

/* charts em SVG puro */
function trendChart(rated) {
  const W = 800, H = 220, P = { l: 30, r: 14, t: 14, b: 26 };
  if (!rated.length) return `<p class="muted small">Sem notas ainda.</p>`;
  const xs = rated.map((b) => new Date(brewTime(b)).getTime());
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const X = (t) => P.l + (x1 === x0 ? (W - P.l - P.r) / 2 : ((t - x0) / (x1 - x0)) * (W - P.l - P.r));
  const Y = (r) => P.t + (1 - r / 10) * (H - P.t - P.b);
  const win = Math.max(3, Math.round(rated.length / 8));
  const ma = rated.map((_, i) => avg(rated.slice(Math.max(0, i - win + 1), i + 1).map((b) => num(b.rating))));
  const path = ma.map((r, i) => `${i ? "L" : "M"}${X(xs[i]).toFixed(1)} ${Y(r).toFixed(1)}`).join(" ");
  const area = path + ` L${X(xs[xs.length - 1]).toFixed(1)} ${Y(0)} L${X(xs[0]).toFixed(1)} ${Y(0)} Z`;
  const grid = [0, 2.5, 5, 7.5, 10].map((r) => `<line class="grid-line" x1="${P.l}" x2="${W - P.r}" y1="${Y(r)}" y2="${Y(r)}"/><text x="${P.l - 8}" y="${Y(r) + 4}" text-anchor="end">${r}</text>`).join("");
  const ticks = 5, xt = [];
  for (let i = 0; i < ticks; i++) { const t = x0 + ((x1 - x0) * i) / (ticks - 1); xt.push(`<text x="${X(t)}" y="${H - 6}" text-anchor="middle">${new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")}</text>`); }
  const dots = rated.map((b, i) => `<circle cx="${X(xs[i]).toFixed(1)}" cy="${Y(num(b.rating)).toFixed(1)}" r="3.5" fill="var(--faint)" opacity=".75" data-tip="${esc(fmtDate(brewTime(b)) + " · " + ((METHOD[b.method] || {}).name || "") + " · " + fmtN(b.rating))}" style="cursor:pointer"/>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c88f5a" stop-opacity=".28"/><stop offset="1" stop-color="#c88f5a" stop-opacity="0"/></linearGradient></defs>
    ${grid}${rated.length > 1 ? `<path d="${area}" fill="url(#tg)"/>` : ""}${dots}<path d="${path}" fill="none" stroke="var(--leather-2)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${xt.join("")}</svg>`;
}
function distChart(rated) {
  const W = 400, H = 180, P = { l: 6, r: 6, t: 18, b: 24 };
  const buckets = Array.from({ length: 11 }, () => 0);
  rated.forEach((b) => buckets[clamp(Math.round(num(b.rating)), 0, 10)]++);
  const max = Math.max(1, ...buckets);
  const bw = (W - P.l - P.r) / 11;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${buckets.map((n, i) => {
    const h = (n / max) * (H - P.t - P.b), x = P.l + i * bw + 4, y = H - P.b - h;
    const col = i >= 8 ? "var(--leather-2)" : i >= 6 ? "var(--leather)" : "var(--leather-deep)";
    return `<rect x="${x}" y="${y}" width="${bw - 8}" height="${Math.max(h, n ? 2 : 0)}" rx="4" fill="${col}" data-tip="Nota ${i}: ${n} ${n === 1 ? "café" : "cafés"}"/>${n ? `<text class="val" x="${x + (bw - 8) / 2}" y="${y - 5}" text-anchor="middle">${n}</text>` : ""}<text x="${x + (bw - 8) / 2}" y="${H - 6}" text-anchor="middle">${i}</text>`;
  }).join("")}<line class="axis" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}"/></svg>`;
}
function weekChart(list) {
  const W = 400, H = 180, P = { l: 6, r: 6, t: 18, b: 24 };
  const weeks = 10, now = new Date(); now.setHours(0, 0, 0, 0);
  const start = new Date(now - ((now.getDay() + 6) % 7) * DAY); // segunda
  const data = Array.from({ length: weeks }, (_, i) => { const s = new Date(start - (weeks - 1 - i) * 7 * DAY); return { s, g: 0, n: 0 }; });
  list.forEach((b) => { const t = new Date(brewTime(b)); const i = weeks - 1 - Math.floor((start - new Date(t.getFullYear(), t.getMonth(), t.getDate()) + 6 * DAY) / (7 * DAY)); if (i >= 0 && i < weeks) { data[i].g += num(b.dose_g); data[i].n++; } });
  const max = Math.max(1, ...data.map((d) => d.g));
  const bw = (W - P.l - P.r) / weeks;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${data.map((d, i) => {
    const h = (d.g / max) * (H - P.t - P.b), x = P.l + i * bw + 5, y = H - P.b - h;
    return `<rect x="${x}" y="${y}" width="${bw - 10}" height="${Math.max(h, d.g ? 2 : 0)}" rx="4" fill="${i === weeks - 1 ? "var(--cream)" : "var(--leather)"}" data-tip="Semana de ${d.s.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}: ${fmtG(d.g)} · ${d.n} cafés"/>${i % 2 === 1 || i === weeks - 1 ? `<text x="${x + (bw - 10) / 2}" y="${H - 6}" text-anchor="middle">${d.s.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</text>` : ""}`;
  }).join("")}<line class="axis" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}"/></svg>`;
}
function bindTips(root) {
  let tip = null;
  $$("[data-tip]", root).forEach((el) => {
    el.addEventListener("mouseenter", () => { tip = document.createElement("div"); tip.className = "tip"; tip.textContent = el.dataset.tip; document.body.appendChild(tip); });
    el.addEventListener("mousemove", (e) => { if (tip) { tip.style.left = e.clientX + "px"; tip.style.top = e.clientY + "px"; } });
    el.addEventListener("mouseleave", () => { tip && tip.remove(); tip = null; });
  });
}

/* ===================================================================
   AJUSTES
   =================================================================== */
function viewSettings() {
  const eq = S.equipment;
  const types = { grinder: "Moedor", brewer: "Cafeteira", other: "Outro" };
  const ratios = Object.assign({}, DEFAULT_RATIO, S.settings.ratios || {});
  const html = `<div class="page narrow">
    <div class="page-head"><div><div class="eyebrow">Configurações</div><h1 class="title">Ajustes</h1></div></div>

    <div class="card form-card">
      <h2 class="h3">Você</h2>
      <div class="field"><label>Seu nome (aparece na saudação)</label><input class="input" id="sName" value="${esc(S.settings.name || "")}" placeholder="Gabriel"></div>
    </div>

    <div class="card form-card">
      <div class="row between"><div><h2 class="h3">Equipamentos</h2><p class="small muted" style="margin:4px 0 0">Os cliques de cada moedor ficam ligados a ele.</p></div><button class="btn sm" id="addEq">${ic("plus")}Adicionar</button></div>
      ${eq.length ? `<ul class="list-plain">${eq.map((e) => `<li><span class="brew-icon" style="width:38px;height:38px;border-radius:11px">${e.type === "grinder" ? ic("spark") : methodIcon("v60")}</span><div style="flex:1"><div class="h3">${esc(e.name)}</div><div class="tiny muted">${types[e.type] || "Outro"}${e.kind ? " · " + esc(e.kind) : ""}${e.unit && e.type === "grinder" ? " · mede em " + esc(e.unit) : ""}</div></div><button class="btn sm ghost" data-eq="${e.id}">${ic("edit")}</button></li>`).join("")}</ul>` : `<p class="muted small">Nenhum equipamento.</p>`}
    </div>

    <div class="card form-card">
      <h2 class="h3">Proporções padrão</h2>
      <p class="small muted" style="margin:-8px 0 0">Quando você digita a dose, a água é calculada por aqui (1 : X).</p>
      <div class="form-grid c4">${METHODS.map((m) => `<div class="field"><label>${m.name}</label><div class="input-unit"><input class="input" data-ratio="${m.id}" type="number" step="0.5" inputmode="decimal" value="${ratios[m.id]}"><span class="unit">1:</span></div></div>`).join("")}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn primary sm" id="saveSettings">Salvar</button></div>
    </div>

    <div class="card form-card">
      <h2 class="h3">Seus dados</h2>
      <p class="small muted" style="margin:-8px 0 0">Tudo fica salvo no seu Mac, na pasta <span class="kbd">coffeelab/data</span>. Um backup do banco é feito automaticamente toda vez que o app abre (os últimos 30 ficam guardados em <span class="kbd">data/backups</span>).</p>
      <div class="row wrap">
        <a class="btn" href="/api/export" download>${ic("download")}Baixar backup (.json)</a>
        <label class="btn">${ic("upload")}Restaurar backup<input type="file" accept="application/json" id="imp" hidden></label>
      </div>
    </div>

    <p class="tiny faint" style="text-align:center;margin-top:30px">CoffeeLab · feito pra quem gosta de café ☕</p>
  </div>`;
  return {
    html,
    mount(v) {
      $("#saveSettings", v).onclick = () => safe(async () => {
        const r = {}; $$("[data-ratio]", v).forEach((el) => (r[el.dataset.ratio] = num(el.value, DEFAULT_RATIO[el.dataset.ratio])));
        await api.put("/api/settings", { name: $("#sName", v).value.trim(), ratios: r });
        await loadState(); toast("Ajustes salvos");
      });
      $("#sName", v).onchange = () => safe(async () => { await api.put("/api/settings", { name: $("#sName", v).value.trim() }); await loadState(); toast("Nome salvo"); });
      $("#addEq", v).onclick = () => equipModal(null);
      $$("[data-eq]", v).forEach((b) => (b.onclick = () => equipModal(equipById(b.dataset.eq))));
      $("#imp", v).onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (!(await confirmBox("Restaurar esse backup?", "Os dados atuais serão substituídos (um backup deles é feito antes).", "Restaurar", true))) return;
        safe(async () => { const data = JSON.parse(await file.text()); await api.post("/api/import", data); toast("Backup restaurado"); refresh(); });
      };
    },
  };
}

function equipModal(e) {
  const d = Object.assign({ type: "grinder", name: "", kind: "manual", unit: "cliques", notes: "" }, e || {});
  const m = openModal(`
    <div class="modal-head"><h2 class="h2">${e ? "Editar" : "Novo"} equipamento</h2><button class="close-x" data-close>${ic("x")}</button></div>
    <div class="stack">
      <div class="field"><span class="label">Tipo</span><div class="seg" id="et">${[["grinder", "Moedor"], ["brewer", "Cafeteira"], ["other", "Outro"]].map(([k, l]) => `<button class="${d.type === k ? "on" : ""}" data-t="${k}">${l}</button>`).join("")}</div></div>
      <div class="field"><label>Nome</label><input class="input" id="en" value="${esc(d.name)}" placeholder="Ex.: Timemore C2, Bodum Chambord"></div>
      <div class="form-grid" id="gOnly">
        <div class="field"><label>Manual ou elétrico</label><select class="select" id="ek"><option value="manual" ${d.kind === "manual" ? "selected" : ""}>Manual</option><option value="elétrico" ${d.kind === "elétrico" ? "selected" : ""}>Elétrico</option></select></div>
        <div class="field"><label>Unidade da moagem</label><select class="select" id="eu">${["cliques", "número", "voltas", "µm"].map((u) => `<option ${d.unit === u ? "selected" : ""}>${u}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label>Observações</label><input class="input" id="eo" value="${esc(d.notes || "")}" placeholder="Ex.: zerado em 0 com tudo fechado"></div>
    </div>
    <div class="modal-foot">${e ? `<button class="btn ghost danger" id="ed">Apagar</button><span class="spacer"></span>` : ""}<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Salvar</button></div>`);
  const sync = () => ($("#gOnly", m.el).style.display = d.type === "grinder" ? "" : "none");
  sync();
  $$("#et button", m.el).forEach((b) => (b.onclick = () => { d.type = b.dataset.t; $$("#et button", m.el).forEach((x) => x.classList.toggle("on", x === b)); sync(); }));
  $("#ok", m.el).onclick = () => safe(async () => {
    const body = { type: d.type, name: $("#en", m.el).value.trim(), notes: $("#eo", m.el).value };
    if (!body.name) throw new Error("Dá um nome");
    if (d.type === "grinder") { body.kind = $("#ek", m.el).value; body.unit = $("#eu", m.el).value; }
    e ? await api.put("/api/equipment/" + e.id, body) : await api.post("/api/equipment", body);
    m.close(); refresh();
  });
  const del = $("#ed", m.el);
  if (del) del.onclick = () => safe(async () => { await api.del("/api/equipment/" + e.id); m.close(); refresh(); });
}

/* ===================================================================
   INÍCIO DO APP
   =================================================================== */
async function seedIfNeeded() {
  if (S.settings.seeded) return;
  if (!S.equipment.length) {
    await api.post("/api/equipment", { type: "grinder", name: "Moedor manual", kind: "manual", unit: "cliques" });
    await api.post("/api/equipment", { type: "grinder", name: "Moedor elétrico", kind: "elétrico", unit: "número" });
    await api.post("/api/equipment", { type: "brewer", name: "Prensa Bodum" });
  }
  await api.put("/api/settings", { seeded: true });
  await loadState();
}

(async function boot() {
  try {
    await loadState();
    await seedIfNeeded();
    render();
  } catch (e) {
    console.error(e);
    $("#view").innerHTML = `<div class="page narrow"><div class="card empty-state"><h2 class="h2">Não consegui falar com o servidor</h2>
      <p>Abre o app pelo <span class="kbd">iniciar.command</span> ou rode <span class="kbd">python3 server.py</span> no Terminal, dentro da pasta coffeelab.</p></div></div>`;
  }
})();
