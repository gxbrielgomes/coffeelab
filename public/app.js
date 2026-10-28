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
  { id: "prensa", name: "Prensa", kind: "immersion" },
  { id: "moka", name: "Moka", kind: "moka" },
  { id: "clever", name: "Clever", kind: "immersion" },
  { id: "coldbrew", name: "Cold Brew", kind: "cold" },
  { id: "outro", name: "Outro", kind: "pour" },
];
const METHOD = Object.fromEntries(METHODS.map((m) => [m.id, m]));

const DEFAULT_RATIO = { espresso: 2, v60: 16, kalita: 16, chemex: 16, melitta: 15, prensa: 15, moka: 9, aeropress: 14, clever: 15, coldbrew: 8, outro: 15 };

const ROASTS = ["Clara", "Média-clara", "Média", "Média-escura", "Escura"];
const ROAST_COLORS = ["#c99463", "#a26a3c", "#7a4a26", "#4f2e17", "#2a170c"];

const BAG_COLORS = ["#8b5a32", "#a86b3c", "#6b3f20", "#d63a2b", "#f0811f", "#e9b44c", "#3f7a68", "#2d5d7b", "#8e2219"];
const LABEL_COLORS = ["#f3e6c8", "#14100d", "#d63a2b", "#e9b44c", "#f0811f"];
const SHAPES = [
  { id: "pouch", name: "Stand-up" },
  { id: "box", name: "Fundo reto" },
  { id: "kraft", name: "Kraft" },
  { id: "tin", name: "Lata" },
];

const FLAVORS = ["Chocolate", "Caramelo", "Nozes", "Mel", "Frutado", "Frutas vermelhas", "Cítrico", "Floral", "Especiarias", "Baunilha", "Doce", "Encorpado", "Sedoso", "Equilibrado", "Ácido demais", "Amargo", "Aguado", "Adstringente", "Queimado", "Terroso"];
const SENSORY = [["acidez", "Acidez"], ["docura", "Doçura"], ["corpo", "Corpo"], ["amargor", "Amargor"]];
// posição do ponteiro do manômetro, como num relógio (12h = centro)
const PRESSURE_ZONES = [
  ["10h", "10h", "bem baixo"], ["11h", "11h", ""], ["12h", "12h", "centro"], ["13h", "13h", ""],
  ["14h", "14h", ""], ["14h30", "14h30", ""], ["15h", "15h", ""], ["16h", "16h", "alto"], ["fim", "No fim", "engasgou"],
];
const PRESSURE_LABEL = Object.assign({ baixo: "Abaixo da faixa", ideal: "Na faixa ideal", alto: "Acima da faixa", limite: "No limite" },
  Object.fromEntries(PRESSURE_ZONES.map(([k, l]) => [k, l === "No fim" ? l : "Ponteiro às " + l])));
// ponteiro em "horas" (12 = centro). Escala de 8h até 16h; vermelho de 15h pra frente.
const GAUGE_MIN = 8, GAUGE_MAX = 16, GAUGE_RED = 15;
function fmtHour(h) { if (h == null) return "—"; const H = Math.floor(h), m = Math.round((h - H) * 60); return H + "h" + (m ? String(m).padStart(2, "0") : ""); }
function oldZoneToHour(z) { return { baixo: 10.5, ideal: 12, alto: 13.5, limite: 15.5, fim: 16 }[z] ?? (/^(\d+)h(\d*)$/.test(z || "") ? +RegExp.$1 + (+RegExp.$2 || 0) / 60 : null); }
function brewGauge(b) { return b.pressure_h != null ? num(b.pressure_h) : b.pressure_zone ? oldZoneToHour(b.pressure_zone) : null; }
function gaugeSVG(h, opts) {
  opts = opts || {};
  const cx = 150, cy = 150, R = 118;
  const pt = (hour, r) => { const a = ((hour - 12) * 30 - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const arc = (h1, h2, r) => { const [x1, y1] = pt(h1, r), [x2, y2] = pt(h2, r); const large = (h2 - h1) * 30 > 180 ? 1 : 0; return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
  let ticks = "";
  for (let t = GAUGE_MIN; t <= GAUGE_MAX + 1e-9; t += 0.5) {
    const major = Math.abs(t - Math.round(t)) < 1e-9, [x1, y1] = pt(t, R - (major ? 14 : 7)), [x2, y2] = pt(t, R);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${t >= GAUGE_RED ? "#d63a2b" : "#a69c90"}" stroke-width="${major ? 2.4 : 1.2}" opacity="${major ? 0.9 : 0.45}"/>`;
  }
  const val = h == null ? null : clamp(h, GAUGE_MIN, GAUGE_MAX);
  const [nx, ny] = pt(val == null ? 12 : val, R - 14);
  const hint = opts.mini ? "" : `<text x="${cx}" y="${cy + 104}" text-anchor="middle" font-size="13" fill="#8a7a60" font-family="-apple-system,sans-serif">${val == null ? "arraste até onde o ponteiro chegou" : val >= GAUGE_RED ? "chegou no vermelho" : ""}</text>`;
  return `<svg viewBox="${opts.mini ? "10 20 280 250" : "0 0 300 262"}" class="gauge" style="width:100%;max-width:${opts.mini ? 120 : 340}px;${opts.mini ? "" : "touch-action:none;cursor:grab;"}user-select:none">
    <path d="${arc(GAUGE_MIN, GAUGE_MAX, R + 8)}" stroke="rgba(255,255,255,.07)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="${arc(GAUGE_RED, GAUGE_MAX, R + 8)}" stroke="#d63a2b" stroke-width="10" fill="none" stroke-linecap="round" opacity=".85"/>
    ${val != null ? `<path d="${arc(GAUGE_MIN, val, R + 8)}" stroke="${val >= GAUGE_RED ? "#d63a2b" : "#f0811f"}" stroke-width="10" fill="none" stroke-linecap="round"/>` : ""}
    ${ticks}
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${val == null ? "#6f675d" : "#f3e6c8"}" stroke-width="${opts.mini ? 7 : 4}" stroke-linecap="round" ${val == null ? 'stroke-dasharray="4 6"' : ""}/>
    <circle cx="${cx}" cy="${cy}" r="${opts.mini ? 16 : 11}" fill="#1d1914" stroke="#f3e6c8" stroke-width="2.5"/>
    ${hint}
  </svg>`;
}

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
// quebra o nome do café em até 4 linhas que caibam na etiqueta
function wrapName(name) {
  const words = String(name || "").toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], size: 10 };
  for (const [max, size] of [[6, 11], [8, 9], [10, 7.5], [13, 6]]) {
    const lines = []; let cur = "";
    words.forEach((w) => {
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= max) cur += " " + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length <= 4 && lines.every((l) => l.length <= max + 1)) return { lines, size };
  }
  return { lines: words.slice(0, 4).map((w) => w.slice(0, 14)), size: 6.5 };
}

function bagSVG(av, opts) {
  av = Object.assign({ color: "#8b5a32", label: "#f3e6c8", roast: 3, initials: "" }, av || {});
  opts = Object.assign({ ratio: 1, count: 1, fade: true }, opts || {});
  const u = "b" + ++svgUid, seed = (svgUid * 7) % 97;
  const ratio = clamp(opts.ratio, 0, 1);
  const O = "#0d0a08";
  const body = av.color, empty = shade(body, -0.55), fold = shade(body, -0.3), hi = shade(body, 0.35), lo = shade(body, -0.35);
  const nameLines = wrapName(opts.name || av.initials || "");
  const ink = isLight(av.label) ? O : "#f3e6c8";
  const top = 40, bot = 140, fillY = bot - (bot - top) * ratio;
  const bodyPath = "M26 38 C40 37 80 39 94 38 C95 70 96 104 97 134 C97 140 93 141 90 140 C70 141 50 139 30 140 C25 141 23 139 23 134 C24 104 25 70 26 38 Z";
  let dots = "";
  for (let k = 0; k < 5; k++) dots += `<circle cx="${48 + k * 6}" cy="116" r="2.1" fill="${k < av.roast ? "#f3e6c8" : "none"}" stroke="${O}" stroke-width="1.4"/>`;
  const badge = opts.count > 1
    ? `<g transform="translate(100 22) rotate(8)" filter="url(#r${u})"><circle r="12" fill="#d63a2b" stroke="${O}" stroke-width="3"/><text text-anchor="middle" dy="4.3" font-size="11.5" font-weight="800" fill="#f3e6c8" font-family="-apple-system,sans-serif">×${opts.count}</text></g>` : "";
  return `<span class="bag-av"><svg viewBox="0 0 120 152" role="img" aria-label="saco de café">
    <defs>
      <filter id="r${u}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="2.6"/></filter>
      <pattern id="h${u}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><path d="M0 1.5 h3.5 M2 4.5 h3" stroke="${hi}" stroke-width="1.1" stroke-linecap="round" opacity=".55"/></pattern>
      <pattern id="d${u}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><path d="M0 2 h4" stroke="${lo}" stroke-width="1.2" stroke-linecap="round" opacity=".6"/></pattern>
      <clipPath id="c${u}"><path d="${bodyPath}"/></clipPath>
    </defs>
    <g filter="url(#r${u})" stroke-linejoin="round" stroke-linecap="round">
      <path d="${bodyPath}" fill="${empty}"/>
      <g clip-path="url(#c${u})">
        <rect x="0" y="${fillY.toFixed(1)}" width="120" height="${(152 - fillY).toFixed(1)}" fill="${body}"/>
        <rect x="0" y="${fillY.toFixed(1)}" width="120" height="${(152 - fillY).toFixed(1)}" fill="url(#h${u})"/>
        <rect x="74" y="0" width="40" height="152" fill="url(#d${u})"/>
        ${ratio > 0 && ratio < 1 ? `<path d="M18 ${fillY.toFixed(1)} C40 ${(fillY - 2).toFixed(1)} 80 ${(fillY + 2).toFixed(1)} 102 ${fillY.toFixed(1)}" stroke="${O}" stroke-width="2.2" fill="none"/>` : ""}
        <path d="M31 50 C29 80 29 110 31 130" stroke="#fff6e2" stroke-width="3" opacity=".55" fill="none"/>
      </g>
      <path d="M38 42 C37 74 38 106 38 136 M82 42 C83 74 82 106 82 136" stroke="${O}" stroke-width="1.6" opacity=".55" fill="none"/>
      <path d="${bodyPath}" fill="none" stroke="${O}" stroke-width="3.8"/>
      <!-- dobra do topo + arame -->
      <path d="M28 16 C45 15 75 17 92 16 L94 38 C75 39 45 37 26 38 Z" fill="${fold}" stroke="${O}" stroke-width="3.6"/>
      <path d="M34 20 l3 14 M46 19 l2 15 M60 19 l1 15 M74 19 l-1 15 M86 20 l-2 14" stroke="${O}" stroke-width="1.2" opacity=".45"/>
      <path d="M17 29 C40 27 80 31 103 28" stroke="${O}" stroke-width="8" fill="none"/>
      <path d="M18 29 C40 27 80 31 102 28" stroke="#f3e6c8" stroke-width="4" fill="none"/>
      <!-- etiqueta -->
      <g transform="rotate(-4 60 82)">
        <path d="M33 58 C48 57 72 59 87 58 C88 73 87 89 87 104 C72 105 48 103 33 104 C32 89 33 73 33 58 Z" fill="${av.label}" stroke="${O}" stroke-width="3"/>
        <path d="M37 62 l8 -2 M77 100 l7 -1" stroke="${O}" stroke-width="1" opacity=".35"/>
        <text text-anchor="middle" font-size="${nameLines.size}" fill="${ink}" font-family="'Bowlby One','Futura Condensed ExtraBold',Impact,'Arial Black',sans-serif" letter-spacing=".2">${nameLines.lines.map((l, k) => `<tspan x="60" y="${(81 - (nameLines.lines.length - 1) * nameLines.size * 0.55 + k * nameLines.size * 1.1 + nameLines.size * 0.35).toFixed(1)}"${l.length * nameLines.size * 0.74 > 46 ? ' textLength="46" lengthAdjust="spacingAndGlyphs"' : ""}>${esc(l)}</tspan>`).join("") || `<tspan x="60" y="86">☕</tspan>`}</text>
      </g>
      ${dots}
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
  return bagSVG(c.avatar, { name: c.name,  ratio: st.count ? st.ratio : 0, count: st.count });
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

// metas de água por etapa do coado guiado (bloom = ~2,5x a dose)
function pourTargets(water, dose) {
  if (!water) return null;
  dose = dose || water / 16;
  const bloom = Math.round(Math.min(dose * 2.5, water * 0.25));
  return [bloom, Math.round(water * 0.5), Math.round(water * 0.75), Math.round(water), Math.round(water), Math.round(water)];
}
// xícara desejada (ml) + proporção → dose e água (o pó segura ~2 g de água por g de café)
function pourPlanFromCup(ml, ratio) {
  ml = num(ml); ratio = num(ratio, 16);
  if (!ml || ratio <= 2.5) return null;
  const dose = round(ml / (ratio - 2), 1);
  return { ml, ratio, dose, water: Math.round(dose * ratio) };
}

function openTimer(opts) {
  opts = opts || {};
  if (opts.mode) Timer.setMode(opts.mode, opts.target);
  if (opts.water) Timer.waterTarget = opts.water;
  if (opts.dose) Timer.doseTarget = opts.dose;
  const defRatio = (S.settings.ratios || {}).v60 || DEFAULT_RATIO.v60;
  let plan = opts.water && opts.dose ? { ml: Math.round(opts.water - 2 * opts.dose), ratio: round(opts.water / opts.dose, 1), dose: opts.dose, water: opts.water }
    : pourPlanFromCup(S.settings.pour_ml || 250, defRatio);
  if (plan && !opts.water) { Timer.waterTarget = plan.water; Timer.doseTarget = plan.dose; }
  const root = $("#timerRoot");
  root.hidden = false;
  const presets = [
    ["free", "Livre", null], ["espresso", "Espresso", 28], ["pour", "Coado guiado", 195], ["immersion", "Prensa 4:00", 240],
  ];
  root.innerHTML = `
    <div class="timer-top">
      <span class="eyebrow ribbon">Timer</span>
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
    <div class="timer-laps lap-list" id="tLaps"></div>
    <aside class="pour-panel" id="pourPanel"></aside>`;
  const drawPanel = () => {
    const pp = $("#pourPanel"); if (!pp) return;
    pp.hidden = Timer.mode !== "pour";
    if (pp.hidden) return;
    const tg = plan ? pourTargets(plan.water, plan.dose) : null;
    const t = Timer.now(), cur = POUR_STAGES.reduce((acc, s, idx) => (t >= s.t ? idx : acc), 0);
    if (!pp.dataset.built) {
      pp.dataset.built = "1";
      pp.innerHTML = `<div class="eyebrow ribbon">Quanto você quer passar?</div>
        <div class="form-grid" style="margin-top:12px">
          <div class="field"><label>Na xícara</label><div class="input-unit"><input class="input" id="pMl" type="number" inputmode="numeric" value="${plan ? plan.ml : ""}"><span class="unit">ml</span></div></div>
          <div class="field"><label>Proporção</label><div class="input-unit"><input class="input" id="pRatio" type="number" step="0.5" inputmode="decimal" value="${plan ? plan.ratio : defRatio}"><span class="unit">1:</span></div></div>
        </div>
        <div class="pour-result" id="pRes"></div>
        <div class="pour-steps" id="pSteps"></div>`;
      const upd = () => {
        plan = pourPlanFromCup($("#pMl").value, $("#pRatio").value);
        Timer.waterTarget = plan ? plan.water : null; Timer.doseTarget = plan ? plan.dose : null;
        drawPanel(); Timer.emit();
        clearTimeout(drawPanel._t); drawPanel._t = setTimeout(() => plan && api.put("/api/settings", { pour_ml: plan.ml }).then(() => (S.settings.pour_ml = plan.ml)).catch(() => {}), 800);
      };
      $("#pMl").oninput = upd; $("#pRatio").oninput = upd;
    }
    $("#pRes").innerHTML = plan ? `<div><span>Moa</span><b>${fmtN(plan.dose)} g</b></div><div><span>Água total</span><b>${plan.water} g</b></div>` : `<p class="small muted">Digite quantos ml você quer.</p>`;
    $("#pSteps").innerHTML = tg ? POUR_STAGES.slice(0, 4).map((s, i) => `<div class="${i === cur ? "on" : i < cur ? "done" : ""}"><span>${fmtTime(s.t)}</span><span>${s.label}</span><b>até ${tg[i]} g</b></div>`).join("") + `<div class="${cur >= 4 ? "on" : ""}"><span>${fmtTime(POUR_STAGES[4].t)}</span><span>Drenar</span><b>~${fmtTime(POUR_STAGES[5].t)}</b></div>` : "";
  };
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
      const tg = pourTargets(Timer.waterTarget, Timer.doseTarget);
      const w = tg ? ` · até ${tg[i]} g` : "";
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
  let lastStageShown = -2;
  const drawAll = () => { draw(); const t = Timer.now(), cur = POUR_STAGES.reduce((a, s, idx) => (t >= s.t ? idx : a), 0); if (cur !== lastStageShown || !Timer.running) { lastStageShown = cur; drawPanel(); } };
  const off = Timer.on(drawAll); drawAll();
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
  if (opts.onUse) $("#tUse").onclick = () => { Timer.pause(); opts.onUse(Timer.now(), Timer.laps.slice(), Timer.mode === "pour" ? plan : null); close(); };
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
   TREINADOR — dicas pro próximo café com base no seu histórico
   Lê: anotações, sabores marcados, tempo, manômetro, moagem e notas.
   =================================================================== */
const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const SIGNALS = {
  under: /(acid[oa]\b|acidez (alta|demais|forte|agressiva)|muito acid|azed|aguad|ralo|sem corpo|salgad|rapid|correu|sub.?extra|faltou corpo|fino demais nao)/,
  over: /(amarg|queimad|adstring|amarrad|\bseco\b|demor|\blent[oa]\b|engasg|pingand|travou|sobre.?extra)/,
  channel: /(esguich|canal|channel|jato|espirr|desigual|buraco|furo|vazou pelo lado)/,
  wdt: /(wdt|grumo|empelot|torr[aã]o de cafe|aglomer)/,
  tamp: /(tamp|compact|socad)/,
  level: /(nivel|desnivel|torto|inclinad)/,
  strong: /(forte demais|muito forte|intenso demais|pesad|concentrad)/,
  weak: /(fraco|aguad|ralo|sem graca|sem sabor)/,
  hot: /(quente demais|muito quente|queimou)/,
};
const FLAVOR_SIGNALS = { "Ácido demais": "under", "Aguado": "under", "Amargo": "over", "Adstringente": "over", "Queimado": "over" };

function brewSignals(b) {
  const t = norm(b.notes), sig = {};
  Object.entries(SIGNALS).forEach(([k, re]) => { if (re.test(t)) sig[k] = true; });
  (b.flavors || []).forEach((f) => { if (FLAVOR_SIGNALS[f]) sig[FLAVOR_SIGNALS[f]] = true; });
  const m = METHOD[b.method] || {};
  if (m.kind === "espresso" && b.time_s) { if (b.time_s < 22) sig.under = sig.fastShot = true; if (b.time_s > 35) sig.over = sig.slowShot = true; }
  const gz = brewGauge(b);
  if (m.kind === "espresso" && gz != null && gz >= GAUGE_RED + 0.5) sig.over = sig.highGauge = true;
  // "mais fino"/"mais grosso" escrito pelo próprio usuário
  if (/(meio|um pouco|pouquinho|levemente|ligeiramente|leve(mente)?|quase|de leve)\s+(acid|azed|amarg|aguad|fraco|forte|seco|adstring)/.test(t)) sig.mild = true;
  if (/mais fin|moer fin|afinar/.test(t)) sig.wantFiner = true;
  if (/mais gross|moer gross|engross|abrir (a )?moagem/.test(t)) sig.wantCoarser = true;
  return sig;
}

function nextNote(b) {
  const raw = String(b.notes || ""), t = norm(raw);
  const i = t.search(/(proxim[ao]|da proxima|na proxima|tentar|testar|vou tentar)/);
  if (i < 0) return null;
  return raw.slice(i, i + 140).trim();
}

function grindLabel(g, val) { return `${String(val).replace(".", ",")} ${g && g.unit ? g.unit : "cliques"}`; }

/**
 * Gera dicas pro par café+método (ou o mais provável se não passar nada).
 * Retorna { coffee, method, grinder, grind (sugestão), tips: [{title, text, why}] }
 */
function coachFor(coffeeId, methodId) {
  const all = sortedBrews();
  if (!all.length) return null;
  if (!coffeeId || !methodId) {
    const lastAvail = all.find((b) => stock(b.coffee_id).count > 0) || all[0];
    coffeeId = coffeeId || lastAvail.coffee_id; methodId = methodId || lastAvail.method;
  }
  const m = METHOD[methodId] || METHOD.outro, isEsp = m.kind === "espresso";
  let pool = all.filter((b) => b.coffee_id === coffeeId && b.method === methodId);
  const sameCoffee = pool.length > 0;
  if (!pool.length) pool = all.filter((b) => b.method === methodId);
  if (!pool.length) return null;
  const recent = pool.slice(0, 8);
  const last = recent[0];
  const g = equipById(last.grinder_id);
  const tips = [];
  const out = { coffee: coffeeById(coffeeId), method: m, grinder: g, grind: null, sameCoffee, tips };

  // contagem dos sinais nos últimos preparos (peso maior pros mais recentes e pros mal avaliados)
  const score = {}; const seen = {};
  recent.forEach((b, i) => {
    const sg = brewSignals(b);
    const w = (i < 3 ? 1.5 : 1) * (b.rating != null && num(b.rating) < 7 ? 1.4 : 1) * (sg.mild ? 0.5 : 1);
    Object.keys(sg).forEach((k) => { score[k] = (score[k] || 0) + w; seen[k] = (seen[k] || 0) + 1; });
  });
  const lastSig = brewSignals(last);

  // 0) lembrete do que você mesmo anotou pra próxima
  const nn = nextNote(last);
  if (nn) tips.push({ kind: "note", title: "Você deixou um recado pra hoje", text: `“${nn}”`, why: `anotado no seu último ${m.name.toLowerCase()} (${fmtDayLabel(brewTime(last)).toLowerCase()})` });

  // 1) moagem: pondera o que você já testou antes de sugerir mexer
  if (g && last.grind != null && last.grind !== "") {
    const sameG = pool.filter((b) => b.grinder_id === g.id && b.grind != null && b.grind !== "");
    const groups = {};
    sameG.forEach((b) => { const k = num(b.grind); (groups[k] = groups[k] || []).push(b); });
    const stats = Object.entries(groups).map(([k, bs]) => {
      const rated = bs.filter((b) => b.rating != null);
      const sig = bs.map(brewSignals);
      return { v: num(k), n: bs.length, avg: avg(rated.map((b) => num(b.rating))), under: sig.filter((x) => x.under).length, over: sig.filter((x) => x.over).length };
    });
    const cur = num(last.grind);
    const curS = stats.find((x) => x.v === cur);
    const best = stats.filter((x) => x.avg != null && x.n >= 1).sort((a, b) => b.avg - a.avg || b.n - a.n)[0];
    const overW = (score.over || 0) + (lastSig.wantCoarser ? 3 : 0);
    const underW = (score.under || 0) + (lastSig.wantFiner ? 3 : 0);
    const unit = g.unit || "cliques";

    // ajustes sem mexer na moagem: escolhe UMA alavanca principal pelo que os dados mostram
    const yieldG = num(last.yield_g), doseG = num(last.dose_g), temp = num(last.temp_c), waterG = num(last.water_g), tS = num(last.time_s);
    const lever = (problem) => {
      const opts = [];
      if (isEsp) {
        if (problem === "under") {
          if (tS && tS < 22) opts.push({ t: "Compacta com mais firmeza e capricha no WDT", d: `O shot correu rápido (${fmtTime(tS)}): mexe bem com o WDT, nivela e aperta o tamper até o café parar de ceder.` });
          if (yieldG) opts.push({ t: `Passa menos água: ~${fmtN(yieldG - 4)} g na xícara`, d: `Corta o shot um pouco antes (era ${fmtN(yieldG)} g). Menos água = menos ácido aguado.` });
          if (doseG) opts.push({ t: `Sobe a dose pra ${fmtN(doseG + 0.5)} g`, d: "Mais café na cesta segura o fluxo e dá mais corpo." });
          if (temp) opts.push({ t: `Água mais quente: ${fmtN(temp + 1, 0)} °C`, d: "Um grau a mais já extrai mais doçura." });
        } else {
          if (tS && tS > 34) opts.push({ t: `Baixa a dose pra ${fmtN((doseG || 18) - 0.5)} g`, d: `O shot demorou (${fmtTime(tS)}): menos café na cesta deixa a água passar melhor.` });
          if (yieldG) opts.push({ t: `Passa mais água: ~${fmtN(yieldG + 4)} g na xícara`, d: `Deixa sair um pouco mais (era ${fmtN(yieldG)} g) pra diluir o amargor.` });
          opts.push({ t: "Tamper com menos força (e sempre reto)", d: "Compacta firme, mas sem socar nem bater na cesta depois." });
          if (temp) opts.push({ t: `Água menos quente: ${fmtN(temp - 1, 0)} °C`, d: "Um grau a menos segura o amargor." });
        }
      } else {
        if (problem === "under") {
          if (waterG && doseG) opts.push({ t: `Usa menos água: ~${Math.round(waterG - doseG)} g`, d: `Proporção um pouco mais curta (era 1:${fmtN(waterG / doseG)}).` });
          if (temp) opts.push({ t: `Água mais quente: ${fmtN(temp + 2, 0)} °C`, d: "Extrai mais doçura sem mudar a moagem." });
          opts.push({ t: "Mais tempo de contato", d: "Despeja mais devagar ou deixa a infusão 20–30 s a mais." });
        } else {
          if (waterG && doseG) opts.push({ t: `Usa mais água: ~${Math.round(waterG + doseG)} g`, d: `Proporção um pouco mais longa (era 1:${fmtN(waterG / doseG)}).` });
          if (temp) opts.push({ t: `Água menos quente: ${fmtN(temp - 2, 0)} °C`, d: "Segura o amargor." });
          opts.push({ t: "Menos agitação / tempo", d: "Mexe menos e encurta um pouco o tempo total." });
        }
      }
      const [main, ...rest] = opts;
      return main ? { title: main.t, text: main.d + (rest.length ? ` Se não resolver: ${rest.slice(0, 2).map((o) => o.t.charAt(0).toLowerCase() + o.t.slice(1)).join(" ou ")}.` : "") + " Muda uma coisa por vez." } : null;
    };
    const fine = (problem) => (lever(problem) || {}).text || "";

    // pode ir pra moagem vizinha? Não se ela já deu o problema contrário ou nota pior.
    const neighbor = (step) => {
      const v = cur + step, n = stats.find((x) => x.v === v);
      const opposite = step < 0 ? "over" : "under";
      const blocked = v <= 0 || (n && ((n[opposite] > 0 && n[opposite] * 2 >= n.n) || (n.avg != null && curS && curS.avg != null && n.avg < curS.avg - 0.3)));
      return { v, n, blocked };
    };

    let target = null;
    const decide = (problem) => {
      const step = problem === "over" ? +1 : -1;
      const w = problem === "over" ? overW : underW;
      const word = problem === "over" ? "amargo/lento" : "ácido/aguado";
      const dirWord = problem === "over" ? "mais grosso" : "mais fino";
      const nb = neighbor(step);
      const bestThatWay = best && (step > 0 ? best.v > cur : best.v < cur) && (!curS || curS.avg == null || best.avg > curS.avg) ? best : null;
      if (bestThatWay) {
        target = bestThatWay.v;
        tips.push({ kind: "grind", title: `Volte pra ${grindLabel(g, target)}`, text: `Com ${target} suas notas foram melhores (média ${fmtN(bestThatWay.avg)}).`, why: `com ${cur} ficou ${word} · ${bestThatWay.n} ${bestThatWay.n === 1 ? "café" : "cafés"} com ${target}` });
      } else if (nb.blocked) {
        const why = nb.n ? `com ${nb.v} ${unit} você já achou ${problem === "over" ? "ácido/aguado" : "amargo/lento"} — ${cur} parece seu ponto, falta o ajuste fino` : `${dirWord} que ${cur} não dá`;
        const lv = lever(problem);
        tips.push({ kind: "fine", title: lv ? lv.title : `Fica no ${cur} e ajusta o resto`, text: (lv ? `Mantém ${cur} ${unit}. ` + lv.text : ""), why });
      } else if (w >= 2.2) {
        target = nb.v;
        const why = [`com ${grindLabel(g, cur)} ficou ${word}${seen[problem] > 1 ? ` em ${seen[problem]} cafés` : ""}`];
        if (problem === "over" && lastSig.slowShot) why.push(`o último shot levou ${fmtTime(last.time_s)}`);
        if (problem === "under" && lastSig.fastShot) why.push(`o último shot saiu em ${fmtTime(last.time_s)}`);
        if (problem === "over" && lastSig.highGauge) why.push("o ponteiro chegou no vermelho");
        tips.push({ kind: "grind", title: `Testa 1 ${unit === "cliques" ? "clique" : "ponto"} ${dirWord}: ${grindLabel(g, target)}`, text: `Se passar do ponto pro outro lado, volta pro ${cur} e ajusta dose/água.`, why: why.join(" · ") });
      } else {
        const lv = lever(problem);
        tips.push({ kind: "fine", title: lv ? lv.title : "Ajuste fino", text: (lv ? `Mantém ${cur} ${unit}. ` + lv.text : ""), why: `foi só um pouco ${problem === "over" ? "amargo" : "ácido"} — ainda não vale mudar os ${unit}` });
      }
    };

    if (overW > underW && overW >= 0.7) decide("over");
    else if (underW > overW && underW >= 0.7) decide("under");
    else if (best && curS && best.v !== cur && curS.avg != null && best.avg - curS.avg >= 0.75) {
      target = best.v;
      tips.push({ kind: "grind", title: `Volte pra ${grindLabel(g, best.v)}`, text: `Seus cafés com ${best.v} tiveram nota média ${fmtN(best.avg)}, contra ${fmtN(curS.avg)} com ${cur}.`, why: `${best.n} ${best.n === 1 ? "café" : "cafés"} com ${best.v} · ${curS.n} com ${cur}` });
    }
    if (target != null && target > 0) out.grind = target;
  }

  // 2) preparo da cama (espresso): WDT / nivelar / tamper
  if (isEsp) {
    if ((score.channel || 0) >= 1) tips.push({ kind: "puck", title: "Capriche no WDT e nivele a cama", text: "Mexe bem o café com o WDT (até sumir os grumos), dá umas batidinhas pra assentar e nivela antes de compactar. Esguicho e canal quase sempre vêm de cama desigual.", why: `você anotou esguicho/canal em ${seen.channel} ${seen.channel === 1 ? "café" : "cafés"}` });
    else if ((score.wdt || 0) >= 1) tips.push({ kind: "puck", title: "Mais WDT", text: "Passa o WDT por mais tempo, com movimentos circulares até o fundo da cesta.", why: `grumos/WDT apareceram nas suas anotações ${seen.wdt}x` });
    if ((score.level || 0) >= 1) tips.push({ kind: "puck", title: "Nivele melhor antes do tamper", text: "Confere se o tamper desce reto: cama torta faz a água passar pelo lado mais baixo.", why: `desnível apareceu ${seen.level}x nas anotações` });
    if ((score.tamp || 0) >= 1 && (score.under || 0) >= (score.over || 0) && !tips.some((t) => /tamper/i.test(t.title))) tips.push({ kind: "puck", title: "Aperte o tamper com mais firmeza", text: "Compacta até o café parar de ceder, sempre com a mesma força, e reto.", why: "você comentou sobre a compactação e o café saiu do lado fraco" });
  }

  // 3) proporção / água (coados e imersão)
  if (!isEsp && m.kind !== "cold") {
    const dose = num(last.dose_g), water = num(last.water_g);
    const ratio = dose && water ? water / dose : null;
    if ((score.weak || 0) >= 1.4 && ratio) tips.push({ kind: "ratio", title: `Proporção menor: 1:${fmtN(Math.max(12, ratio - 1))}`, text: `Mais café ou menos água. Ex.: ${fmtN(dose + 1)} g de café pra ${fmtN(water)} g de água.`, why: `ficou fraco/aguado ${seen.weak}x · última foi 1:${fmtN(ratio)}` });
    else if ((score.strong || 0) >= 1.4 && ratio) tips.push({ kind: "ratio", title: `Proporção maior: 1:${fmtN(ratio + 1)}`, text: `Um pouco mais de água: ${fmtN(Math.round(dose * (ratio + 1)))} g pra ${fmtN(dose)} g de café.`, why: `ficou forte demais ${seen.strong}x · última foi 1:${fmtN(ratio)}` });
    if ((score.over || 0) >= 2 && num(last.temp_c) >= 94) tips.push({ kind: "temp", title: `Baixe a água pra ${num(last.temp_c) - 2} °C`, text: "Água um pouco menos quente segura o amargor.", why: `amargor recorrente com ${fmtN(last.temp_c, 0)} °C` });
    if ((score.under || 0) >= 2 && last.temp_c && num(last.temp_c) <= 92) tips.push({ kind: "temp", title: `Suba a água pra ${num(last.temp_c) + 2} °C`, text: "Mais temperatura extrai mais doçura e corpo.", why: `ácido/aguado recorrente com ${fmtN(last.temp_c, 0)} °C` });
  } else if (isEsp && (score.strong || 0) >= 1.4 && last.yield_g) {
    tips.push({ kind: "ratio", title: `Tire um pouco mais de bebida: ${fmtN(num(last.yield_g) + 4)} g`, text: "Ratio mais longo deixa o espresso menos intenso.", why: `“forte demais” apareceu ${seen.strong}x` });
  }

  // 4) tá bom? mantém!
  const good = recent.slice(0, 3).filter((b) => num(b.rating, 0) >= 8);
  if (!tips.filter((t) => t.kind !== "note").length && good.length >= 2) {
    tips.push({ kind: "keep", title: "Tá mandando bem, mantém a receita", text: recipeLine(good[0]), why: `${good.length} dos seus últimos 3 ficaram com nota ≥ 8` });
  }
  return out;
}

function coachCard(c, opts) {
  opts = opts || {};
  if (!c || !c.tips.length) return "";
  const href = `#/preparar?cafe=${c.coffee ? c.coffee.id : ""}&metodo=${c.method.id}${c.grind != null ? "&moagem=" + encodeURIComponent(c.grind) : ""}`;
  return `<div class="card coach">
    <div class="row between" style="align-items:flex-start;gap:16px">
      <div class="row" style="gap:14px;align-items:center"><img class="coach-av" src="avatar-v2.png" alt=""><div><div class="ribbon">Ajuste sugerido</div>
      <div class="h3" style="margin-top:8px">${esc(c.method.name)}${c.coffee ? " com " + esc(c.coffee.name) : ""}</div></div></div>
      ${opts.cta !== false ? `<a class="btn primary sm" href="${href}">Usar essa receita</a>` : ""}
    </div>
    <div class="coach-tips">${c.tips.slice(0, opts.max || 4).map((t) => `<div class="coach-tip"><b>${esc(t.title)}</b><span>${esc(t.text)}</span>${t.why ? `<small>por quê: ${esc(t.why)}</small>` : ""}</div>`).join("")}</div>
  </div>`;
}

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
  const coach = coachFor();
  const mainTip = coach && (coach.tips.find((t) => t.kind === "grind" || t.kind === "fine") || coach.tips[0]);

  const html = `<div class="page">
    <section class="hero">
      <span class="star s1">✦</span><span class="star s2">✦</span><span class="star s3">✦</span>
      <a href="#/ajustes" class="btn icon sm ghost mobile-only" style="position:absolute;top:14px;right:14px" aria-label="Ajustes">${ic("gear")}</a>
      <div>
        <div class="eyebrow ribbon">${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 class="title">${greeting()}${name}.</h1>
        ${mainTip ? `<p class="subtitle" style="color:var(--text)">Pro próximo ${esc(coach.method.name.toLowerCase())}: <b style="color:var(--leather-2)">${esc(mainTip.title.charAt(0).toLowerCase() + mainTip.title.slice(1))}</b>.</p>` : ""}
        <p class="subtitle">${today.length ? `Você já fez ${today.length} ${today.length === 1 ? "café" : "cafés"} hoje.` : brews.length ? "Ainda nenhum café hoje." : "Comece cadastrando o grão que você tem em casa."}</p>
        <div class="actions">
          ${S.coffees.length ? `<a class="btn primary lg" href="#/preparar">${ic("plus")}Registrar café</a>` : `<a class="btn primary lg" href="#/cafe/novo">${ic("plus")}Cadastrar meu primeiro café</a>`}
          <button class="btn lg" data-action="open-timer">${ic("timer")}Timer</button>
          ${brews.length ? `<button class="btn lg ghost" id="repeatLast">${ic("repeat")}Repetir o último</button>` : ""}
        </div>
      </div>
      <div class="hero-logo"><img src="logo-v2.png" alt="CoffeeLab"></div>
    </section>

    ${coach && coach.tips.length ? `<section class="section">${coachCard(coach)}</section>` : ""}

    <section class="section grid g4">
      <div class="card stat flash"><span class="no">Nº 01</span><span class="v num">${week.length}</span><span class="k">cafés nos últimos 7 dias</span></div>
      <div class="card stat flash"><span class="no">Nº 02</span><span class="v num">${fmtN(avg(last30.map((b) => num(b.rating))))}<small>/10</small></span><span class="k">nota média (30 dias)</span></div>
      <div class="card stat flash"><span class="no">Nº 03</span><span class="v num">${fmtG(week.reduce((s, b) => s + num(b.dose_g), 0))}</span><span class="k">de café na semana</span></div>
      <div class="card stat flash"><span class="no">Nº 04</span><span class="v num">${active.length}</span><span class="k">cafés na despensa</span></div>
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

function stamp(r, size) {
  if (r == null) return "";
  const v = num(r), cls = v >= 8 ? "top" : v >= 6 ? "ok" : "low";
  const word = v >= 9 ? "OBRA-PRIMA" : v >= 8 ? "APROVADO" : v >= 6.5 ? "NA MÉDIA" : v >= 5 ? "AJUSTAR" : "REPROVADO";
  return `<span class="stamp ${cls} ${size || ""}"><small>${word}</small><b>${fmtN(v)}</b></span>`;
}
function scoreDot(r) {
  if (r == null) return `<span class="score-dot none">—</span>`;
  const v = num(r); return `<span class="score-dot ${v >= 8 ? "top" : v >= 6 ? "ok" : "low"}">${fmtN(v)}</span>`;
}

function brewList(list) {
  return `<div class="brew-list">${list.map((b) => {
    const c = coffeeById(b.coffee_id), m = METHOD[b.method] || METHOD.outro;
    const bits = [num(b.dose_g) ? fmtN(b.dose_g) + " g" : null, b.time_s ? fmtTime(b.time_s) : null, b.grind ? b.grind + " cliques" : null].filter(Boolean).join(" · ");
    return `<a class="brew-item" href="#/preparo/${b.id}">
      <span class="brew-icon">${methodIcon(b.method)}</span>
      <span><div class="t">${esc(m.name)} · ${esc(c ? c.name : "Café removido")}</div><div class="s">${fmtDayLabel(brewTime(b))}, ${fmtClock(brewTime(b))}${bits ? " · " + bits : ""}</div></span>
      ${scoreDot(b.rating)}
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
      <div><div class="eyebrow ribbon">Seus grãos</div><h1 class="title">Despensa</h1></div>
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
          <div class="card stat flash"><span class="no">Nº 05</span><span class="v num">${fmtG(st.remaining)}</span><span class="k">restantes</span></div>
          <div class="card stat flash"><span class="no">Nº 06</span><span class="v num">${brews.length}</span><span class="k">preparos · ${fmtG(used)}</span></div>
          <div class="card stat flash"><span class="no">Nº 07</span><span class="v num">${fmtN(avg(rated.map((b) => num(b.rating))))}<small>/10</small></span><span class="k">nota média</span></div>
        </div>

        <div class="card">
          <div class="section-head" style="margin-bottom:4px"><h2 class="h3">Sacos</h2><button class="btn sm" id="addBag">${ic("plus")}Adicionar saco</button></div>
          ${bags.length ? bags.map((b, i) => {
            const r = clamp(num(b.remaining_g) / Math.max(1, num(b.size_g)), 0, 1);
            const status = b.status === "finished" ? `<span class="badge">Acabou ${fmtDate(b.finished_at)}</span>` : b.status === "open" ? `<span class="badge leather">Aberto</span>` : `<span class="badge">Lacrado</span>`;
            return `<div class="bag-line">
              <div style="width:34px">${bagSVG(c.avatar, { name: c.name,  ratio: r })}</div>
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
    <div class="modal-head"><div><div class="eyebrow ribbon">${esc(c.name)}</div><h2 class="h2" style="margin-top:4px">Novo saco</h2></div><button class="close-x" data-close>${ic("x")}</button></div>
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
      <div class="row" style="gap:16px"><div style="width:56px">${bagSVG(c?.avatar, { name: c && c.name,  ratio: 0, fade: false })}</div>
      <div><div class="eyebrow ribbon">Saco finalizado</div><h2 class="h2" style="margin-top:4px">${esc(c ? c.name : "Café")}</h2></div></div>
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
    <div class="page-head" style="margin-top:10px"><div><div class="eyebrow ribbon">${existing ? "Editar" : "Novo café"}</div><h1 class="title">${existing ? "Editar café" : "Novo café"}</h1></div></div>

    <div class="editor">
      <div class="editor-preview">
        <div id="prev"></div>
        <div><div class="h3" id="prevName">${esc(c.name) || "Seu café"}</div><div class="small muted" id="prevSub" style="margin-top:4px"></div></div>
        <div class="stack" style="width:100%;gap:16px;text-align:left">
          <div class="field"><span class="label">Cor do café no saco</span>${swatches(BAG_COLORS, "color")}</div>
          <div class="field"><span class="label">Cor da etiqueta</span>${swatches(LABEL_COLORS, "label")}</div>
          <div class="field"><span class="label">Torra · <span id="roastName">${ROASTS[c.avatar.roast - 1]}</span></span>
            <input type="range" class="range" id="roast" min="1" max="5" step="1" value="${c.avatar.roast}">
            <div class="roast-scale"><span>Clara</span><span>Escura</span></div></div>
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
            <div class="field"><label>Processo</label><select class="select" id="procSel"><option value="">—</option>${PROCESSES.filter((p) => p !== "Outro").map((p) => `<option ${c.process === p ? "selected" : ""}>${p}</option>`).join("")}<option value="__outro" ${c.process && !PROCESSES.includes(c.process) || c.process === "Outro" ? "selected" : ""}>Outro…</option></select>
              <input class="input" id="procOther" placeholder="Escreva o processo (ex.: Maceração carbônica)" value="${esc(c.process && !PROCESSES.includes(c.process) ? c.process : "")}" style="${c.process && !PROCESSES.includes(c.process) || c.process === "Outro" ? "" : "display:none"}"></div>
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
        $("#prev", v).innerHTML = bagSVG(c.avatar, { name: c.name,  fade: false });
        $("#prevName", v).textContent = c.name || "Seu café";
        $("#prevSub", v).textContent = [c.roaster, ROASTS[c.avatar.roast - 1]].filter(Boolean).join(" · ");
        $$("#shapes button", v).forEach((b) => { b.querySelector(".bag-av").outerHTML = bagSVG(Object.assign({}, c.avatar, { shape: b.dataset.shape }), { fade: false }); });
        const r = $("#roast", v); r.style.setProperty("--p", ((c.avatar.roast - 1) / 4) * 100 + "%");
      };
      drawPrev();
      $$("[data-k]", v).forEach((el) => (el.oninput = () => {
        c[el.dataset.k] = el.value;
        if (el.dataset.k === "name") c.avatar.initials = initialsOf(el.value);
        if (el.dataset.k === "name" || el.dataset.k === "roaster") drawPrev();
      }));
      const procSel = $("#procSel", v), procOther = $("#procOther", v);
      procSel.onchange = () => {
        const other = procSel.value === "__outro";
        procOther.style.display = other ? "" : "none";
        c.process = other ? procOther.value.trim() : procSel.value;
        if (other) procOther.focus();
      };
      procOther.oninput = () => (c.process = procOther.value.trim());
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
          await loadState(); toast("Café cadastrado"); go("#/cafe/" + r.id);
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
  if (f.pressure_h == null && f.pressure_zone) f.pressure_h = oldZoneToHour(f.pressure_zone);
  f.equipment_ids = Array.isArray(f.equipment_ids) ? f.equipment_ids.slice() : f.brewer_id ? [f.brewer_id] : [];
  f.brewed_at = editing ? brewTime(editing) : null;
  if (!base) {
    applyDefaults(f, true);
    const pl = sortedBrews().find((b) => b.coffee_id === f.coffee_id && b.method === f.method);
    if (pl) ["dose_g", "water_g", "yield_g", "temp_c", "grind", "grinder_id", "bloom_s", "water_type", "filter", "steep_h", "milk"].forEach((k) => (f[k] = pl[k]));
  }
  if (params.get("moagem") && !editing) f.grind = params.get("moagem");
  if (f.rating == null) f.rating = 7;
  let ratingTouched = !!editing;

  if (!available.length && !editing) {
    return { html: `<div class="page narrow"><div class="card empty-state">${bagSVG({ color: "#2a2420", label: "#3a322b" }, { ratio: 0 })}<h2 class="h2">Sem café na despensa</h2><p>Cadastra um grão primeiro, com o tamanho do saco. Aí cada preparo desconta os gramas sozinho.</p><a class="btn primary" href="#/cafe/novo" style="margin-top:8px">Cadastrar café</a></div></div>` };
  }

  const pickList = editing && !available.find((c) => c.id === editing.coffee_id) && coffeeById(editing.coffee_id) ? [coffeeById(editing.coffee_id), ...available] : available;

  const html = `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow ribbon">${editing ? "Editar preparo" : repeatFrom ? "Repetindo receita" : "Novo preparo"}</div><h1 class="title">${editing ? "Editar preparo" : "Novo preparo"}</h1></div>
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
        <div id="coachBox"></div>
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
          ${isEsp ? `<div class="field" style="margin-top:16px"><div class="row between"><span class="label">Manômetro · até onde o ponteiro chegou</span><button class="btn ghost sm" id="gClear" type="button">Limpar</button></div>
            <div id="gauge" style="display:flex;justify-content:center">${gaugeSVG(f.pressure_h)}</div></div>` : ""}
          <details class="more" style="margin-top:16px" ${f.bloom_s || f.water_type || f.filter || (f.equipment_ids && f.equipment_ids.length) ? "open" : ""}><summary>Mais detalhes</summary>
            <div class="form-grid c3">
              <div class="field full"><span class="label">Equipamentos usados <span class="faint">(toque em quantos quiser)</span></span>
                <div class="chips" id="eqs">${S.equipment.filter((e) => e.type !== "grinder").map((x) => `<button class="chip ${f.equipment_ids.includes(x.id) ? "on" : ""}" data-eq="${x.id}">${esc(x.name)}</button>`).join("") || `<span class="small muted">Cadastre em Ajustes → Equipamentos</span>`}</div></div>
              ${isEsp ? "" : field("bloom_s", "Bloom", "seg", { ph: "40" })}
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
        $("#grinder", recipeBox).onchange = (e) => { f.grinder_id = e.target.value; const last = lastWith((b) => b.grinder_id === f.grinder_id && b.coffee_id === f.coffee_id && b.method === f.method); f.grind = last && last.grind ? last.grind : defaultGrind(f); drawRecipe(); };
        const gBox = $("#gauge", recipeBox);
        if (gBox) {
          const setFromEvent = (e) => {
            const svg = gBox.querySelector("svg"), r = svg.getBoundingClientRect();
            const x = (e.clientX - r.left) * (300 / r.width) - 150, y = (e.clientY - r.top) * (262 / r.height) - 150;
            let deg = Math.atan2(x, -y) * 180 / Math.PI; // 0 = 12h
            if (y > 40 && Math.abs(deg) > 120) deg = deg > 0 ? 120 : -120;
            const h = clamp(Math.round((12 + deg / 30) * 4) / 4, GAUGE_MIN, GAUGE_MAX);
            if (h !== f.pressure_h) { f.pressure_h = h; gBox.innerHTML = gaugeSVG(h); }
          };
          let drag = false;
          gBox.onpointerdown = (e) => { drag = true; gBox.setPointerCapture(e.pointerId); setFromEvent(e); };
          gBox.onpointermove = (e) => { if (drag) setFromEvent(e); };
          gBox.onpointerup = gBox.onpointercancel = () => (drag = false);
          $("#gClear", recipeBox).onclick = () => { f.pressure_h = null; gBox.innerHTML = gaugeSVG(null); };
        }
        $$("[data-eq]", recipeBox).forEach((b) => (b.onclick = () => {
          const id = b.dataset.eq, i = f.equipment_ids.indexOf(id);
          i >= 0 ? f.equipment_ids.splice(i, 1) : f.equipment_ids.push(id);
          b.classList.toggle("on", i < 0);
        }));
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
          <div class="row"><div style="width:44px">${bagSVG(c.avatar, { name: c.name,  ratio: st && st.open ? clamp((num(st.open.remaining_g) - (editing ? 0 : dose)) / Math.max(1, num(st.open.size_g)), 0, 1) : 0, count: st ? st.count : 1 })}</div>
          <div><div class="h3">${esc(c.name)}</div><div class="small muted">${esc(m.name)}${dose ? " · " + fmtN(dose) + " g" : ""}</div></div></div>
          ${!editing && st ? `<div class="small muted">Depois desse café: <b style="color:var(--text)">${fmtG(Math.max(0, after))}</b> no estoque${after < 0 ? ` <span class="badge bad">faltam ${fmtG(-after)}</span>` : ""}</div>
          ${st.open && dose >= num(st.open.remaining_g) && num(st.open.remaining_g) > 0 ? `<div class="badge warn">Esse saco vai acabar${st.count > 1 ? " e o próximo abre" : ""}</div>` : ""}` : ""}
          ${ppg && dose ? `<div class="small muted">Custo dessa xícara: <b style="color:var(--text)">${fmtMoney(ppg * dose)}</b></div>` : ""}` : `<span class="muted small">Escolha um café.</span>`;
      };

      const drawCoach = () => {
        const box = $("#coachBox", v); if (!box) return;
        box.innerHTML = editing ? "" : coachCard(coachFor(f.coffee_id, f.method), { cta: false, max: 3 });
        const c = coachFor(f.coffee_id, f.method);
        if (c && c.grind != null && !editing) {
          box.insertAdjacentHTML("beforeend", `<button class="btn sm block" id="useCoach" style="margin-top:10px">Usar ${esc(String(c.grind))} na moagem</button>`);
          $("#useCoach", box).onclick = () => { f.grind = c.grind; if (c.grinder) f.grinder_id = c.grinder.id; drawRecipe(); toast("Moagem ajustada"); };
        }
      };
      const drawSuggest = () => {
        drawCoach();
        const best = S.brews.filter((b) => b.coffee_id === f.coffee_id && b.method === f.method && b.rating != null && b.id !== editId).sort((a, b) => num(b.rating) - num(a.rating))[0];
        const box = $("#suggestBox", v);
        if (!best || editing) { box.innerHTML = ""; return; }
        box.innerHTML = `<div class="suggest"><div class="row between"><span class="h3">Sua melhor com esse grão</span><span class="score">${fmtN(best.rating)}</span></div><p class="small muted" style="margin:8px 0 12px">${recipeLine(best)}</p><button class="btn sm" id="useBest">Usar essa receita</button></div>`;
        $("#useBest", box).onclick = () => { copyRecipe(best); waterTouched = true; drawRecipe(); toast("Receita carregada"); };
      };

      const lastWith = (pred) => sortedBrews().find(pred);
      const copyRecipe = (src) => { ["dose_g", "water_g", "yield_g", "temp_c", "grind", "grinder_id", "bloom_s", "pressure", "pressure_h", "water_type", "filter", "steep_h", "milk"].forEach((k) => (f[k] = src[k])); f.equipment_ids = brewEquip(src).map((e) => e.id); };

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
        if (Timer.mode === "pour") { const i = POUR_STAGES.reduce((a, s, idx) => (t >= s.t ? idx : a), 0); const tg = pourTargets(num(f.water_g), num(f.dose_g)); st = POUR_STAGES[i].label + (tg && POUR_STAGES[i].t < 150 ? ` · até ${tg[i]} g` : ""); }
        else if (Timer.mode === "espresso") st = t === 0 ? "alvo 25–32 s" : t < 25 ? "extraindo…" : t <= 32 ? "no ponto" : "passou do ponto";
        else if (Timer.target) st = Timer.target - t > 0 ? "faltam " + fmtTime(Timer.target - t) : "pronto!";
        $("#mStage", v).textContent = st;
        $("#mLaps", v).innerHTML = Timer.laps.map((l, i) => `<div><span>Etapa ${i + 1}</span><span>${fmtTimer(l).main}</span></div>`).join("");
        if (!Timer.running && t > 0 && !f._timerApplied) { f.time_s = round(t, 0); const el = $('[data-f="time_txt"]', v); if (el) el.value = fmtTime(f.time_s); f._timerApplied = true; }
        if (Timer.running) f._timerApplied = false;
      };
      const off = Timer.on(drawMini); drawMini();
      $("#mGo", v).onclick = () => { Timer.waterTarget = num(f.water_g) || null; Timer.doseTarget = num(f.dose_g) || null; Timer.toggle(); };
      $("#mLap", v).onclick = () => Timer.lap();
      $("#mReset", v).onclick = () => { Timer.reset(); syncTimerMode(); };
      $("#bigTimer", v).onclick = () => openTimer({ water: (METHOD[f.method] || {}).kind === "espresso" ? null : num(f.water_g) || null, dose: num(f.dose_g) || null, onUse: (t, laps, plan) => {
        f.time_s = round(t, 0); f.laps = laps;
        if (plan && (METHOD[f.method] || {}).kind !== "espresso") { f.dose_g = plan.dose; f.water_g = plan.water; waterTouched = true; drawRecipe(); }
        const el = $('[data-f="time_txt"]', v); if (el) el.value = fmtTime(f.time_s); } });

      const rb = $("#repeatBtn", v); if (rb) rb.onclick = () => go(`#/preparar?repetir=${lastBrew.id}`);

      drawRecipe(); drawSuggest();

      $("#saveBrew", v).onclick = () => safe(async () => {
        if (!f.coffee_id) throw new Error("Escolha um café");
        if (!num(f.dose_g)) { const el = $('[data-f="dose_g"]', v); el && el.focus(); throw new Error("Coloca a dose de café (g)"); }
        const body = {};
        ["coffee_id", "method", "grinder_id", "brewer_id", "water_type", "filter", "milk"].forEach((k) => (body[k] = f[k] || null));
        body.pressure_h = f.pressure_h == null ? null : f.pressure_h; body.pressure_zone = null;
        ["dose_g", "water_g", "yield_g", "temp_c", "bloom_s", "pressure", "steep_h"].forEach((k) => (body[k] = f[k] === "" || f[k] == null ? null : num(f[k], null)));
        body.grind = f.grind === "" || f.grind == null ? null : String(f.grind).replace(".", ",");
        body.time_s = f.time_s ? round(num(f.time_s), 0) : null;
        body.rating = f.rating; body.flavors = f.flavors; body.sensory = f.sensory;
        body.equipment_ids = f.equipment_ids.slice(); body.brewer_id = null;
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
        toast(editing ? "Registro atualizado" : "Café registrado");
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

// moagem padrão do moedor (ex.: Chestnut = 7 no espresso, Bodum = 1)
function defaultGrind(f) {
  const g = equipById(f.grinder_id);
  if (!g) return null;
  const esp = (METHOD[f.method] || {}).kind === "espresso";
  const v = esp ? g.default_grind_espresso : g.default_grind;
  return v === "" || v == null ? null : v;
}

function brewEquip(b) {
  const ids = Array.isArray(b.equipment_ids) ? b.equipment_ids : b.brewer_id ? [b.brewer_id] : [];
  return ids.map(equipById).filter(Boolean);
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
  if (!f.grinder_id && grinders()[0]) f.grinder_id = grinders()[0].id;
  f.grind = defaultGrind(f);
}

/* ---------------------------------------------------------- detalhe preparo */
function viewBrew(id) {
  const b = S.brews.find((x) => x.id === id);
  if (!b) return { html: `<div class="page"><div class="card empty-state"><p>Registro não encontrado.</p><a class="btn" href="#/historico">Histórico</a></div></div>` };
  const c = coffeeById(b.coffee_id), m = METHOD[b.method] || METHOD.outro, g = equipById(b.grinder_id), eqs = brewEquip(b);
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
    [eqs.length > 1 ? "Equipamentos" : "Equipamento", eqs.length ? eqs.map((e) => e.name).join(", ") : null],
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
        <div><div class="eyebrow ribbon">${fmtDayLabel(brewTime(b))} · ${fmtClock(brewTime(b))}</div><h1 class="title" style="font-size:32px">${esc(m.name)}</h1>
        ${c ? `<a class="muted" href="#/cafe/${c.id}">${esc(c.name)}${c.roaster ? " · " + esc(c.roaster) : ""}</a>` : `<span class="muted">Café removido</span>`}</div>
      </div>
      <div style="text-align:center">${stamp(b.rating, "lg")}<div class="rating-word" style="margin-top:6px">${ratingWord(b.rating)}</div></div>
    </div>
    <div class="card pad-lg"><div class="kv">${brewGauge(b) != null ? `<div><span>Manômetro</span><div style="margin-top:2px">${gaugeSVG(brewGauge(b), { mini: true })}</div></div>` : ""}${kv.map(([k, val]) => `<div><span>${k}</span><b>${esc(val)}</b></div>`).join("")}</div></div>
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
    <div class="page-head"><div><div class="eyebrow ribbon">${S.brews.length} registros</div><h1 class="title">Histórico</h1></div>
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

  const order = PRESSURE_ZONES.map((z) => z[0]);
  const byPz = {};
  rated.filter((b) => b.method === "espresso" && brewGauge(b) != null).forEach((b) => { const k = Math.round(brewGauge(b) * 2) / 2; (byPz[k] = byPz[k] || []).push(num(b.rating)); });
  const pzRows = Object.entries(byPz).map(([k, a]) => [num(k), avg(a), a.length]).sort((a, b) => a[0] - b[0]);
  const pzTop = pzRows.filter((r) => r[2] >= 2).sort((a, b) => b[1] - a[1])[0];
  const pzBest = pzTop ? fmtHour(pzTop[0]) : null;

  const finishedBags = S.bags.filter((b) => b.final_rating != null).sort((a, b) => num(b.final_rating) - num(a.final_rating));

  const html = `<div class="page">
    <div class="page-head"><div><div class="eyebrow ribbon">Seu progresso</div><h1 class="title">Painel</h1></div>
      <div class="seg" id="dr">${[[30, "30 dias"], [90, "90 dias"], [365, "1 ano"], [0, "Tudo"]].map(([d, l]) => `<button class="${dashRange === d ? "on" : ""}" data-d="${d}">${l}</button>`).join("")}</div></div>

    ${!list.length ? `<div class="card empty-state"><p>Registra alguns cafés que o painel ganha vida: evolução das notas, consumo, custo por xícara e o que você mais curte.</p><a class="btn primary" href="#/preparar" style="margin-top:8px">Registrar café</a></div>` : `
    <div class="grid g4">
      <div class="card stat flash"><span class="no">Nº 08</span><span class="v num">${list.length}</span><span class="k">cafés feitos</span></div>
      <div class="card stat flash"><span class="no">Nº 01</span><div class="row" style="gap:8px"><span class="v num">${fmtN(avgR)}</span>${delta(avgR != null && prevAvg != null ? avgR - prevAvg : null)}</div><span class="k">nota média${prevAvg != null ? " · vs período anterior" : ""}</span></div>
      <div class="card stat flash"><span class="no">Nº 02</span><span class="v num">${happy != null ? Math.round(happy * 100) + "%" : "—"}</span><span class="k">cafés com nota ≥ 8</span></div>
      <div class="card stat flash"><span class="no">Nº 03</span><span class="v num">${fmtG(grams)}</span><span class="k">de café moído</span></div>
      <div class="card stat flash"><span class="no">Nº 04</span><span class="v num">${costs.length ? fmtMoney(avg(costs)) : "—"}</span><span class="k">custo médio por xícara</span></div>
      <div class="card stat flash"><span class="no">Nº 05</span><span class="v num">${costs.length ? fmtMoney(costs.reduce((a, b) => a + b, 0)) : "—"}</span><span class="k">gasto em café no período</span></div>
      <div class="card stat flash"><span class="no">Nº 06</span><span class="v num">${esp.length ? fmtN(avg(esp.map((b) => num(b.time_s))), 0) + "s" : "—"}</span><span class="k">extração média espresso</span></div>
      <div class="card stat flash"><span class="no">Nº 07</span><span class="v num">${pour.length ? fmtTime(avg(pour.map((b) => num(b.time_s)))) : "—"}</span><span class="k">tempo médio coado</span></div>
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

    ${pzRows.length ? `<div class="card" style="margin-top:14px"><h2 class="h3" style="margin-bottom:4px">Espresso · nota por posição do manômetro</h2><p class="small muted" style="margin:0 0 12px">Onde o ponteiro estava nos seus melhores espressos${pzBest ? `` : ""}.</p>${pzRows.map(([k, a, n]) => `<div class="hbar"><span class="row" style="gap:8px"><span style="width:54px">${gaugeSVG(k, { mini: true })}</span><span class="faint tiny">${n}</span></span><span class="track"><i style="width:${a * 10}%"></i></span><b>${fmtN(a)}</b></div>`).join("")}</div>` : ""}

    ${flavors.length ? `<div class="card" style="margin-top:14px"><h2 class="h3" style="margin-bottom:12px">Sabores que mais aparecem</h2><div class="tag-cloud">${flavors.map(([f, n]) => `<span class="chip" style="height:32px;cursor:default">${esc(f)} <span class="faint">${n}</span></span>`).join("")}</div></div>` : ""}

    ${finishedBags.length ? `<div class="card" style="margin-top:14px"><h2 class="h3" style="margin-bottom:6px">Ranking dos sacos finalizados</h2><ul class="list-plain">${finishedBags.map((b) => { const c = coffeeById(b.coffee_id); return `<li><div style="width:30px">${bagSVG(c?.avatar, { name: c && c.name,  ratio: 0, fade: false })}</div><div style="flex:1"><div class="h3">${esc(c ? c.name : "—")}</div><div class="tiny muted">${b.finished_at ? "acabou " + fmtDate(b.finished_at, { day: "numeric", month: "short", year: "numeric" }) : ""}${b.buy_again === true ? " · compraria de novo" : b.buy_again === false ? " · não compraria" : ""}</div></div><span class="score">${fmtN(b.final_rating)}</span></li>`; }).join("")}</ul></div>` : ""}
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
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0811f" stop-opacity=".28"/><stop offset="1" stop-color="#f0811f" stop-opacity="0"/></linearGradient></defs>
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
    <div class="page-head"><div><div class="eyebrow ribbon">Configurações</div><h1 class="title">Ajustes</h1></div></div>

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
      <h2 class="h3">Abrir no celular</h2>
      <p class="small muted" style="margin:-8px 0 0">Com o celular no <b>mesmo Wi-Fi</b> do Mac e o Coffee Lab aberto, digite no Safari do iPhone:</p>
      <div id="lanUrls" class="stack" style="gap:8px"><span class="small muted">Buscando endereço…</span></div>
      <p class="tiny faint" style="margin:0">Dica: no iPhone, toque em Compartilhar → <b>Adicionar à Tela de Início</b> pra ele virar um app com o ícone do buldogue.</p>
    </div>

    <div class="card form-card">
      <h2 class="h3">Seus dados</h2>
      <p class="small muted" style="margin:-8px 0 0">Tudo fica salvo no seu Mac, na pasta <span class="kbd">coffeelab/data</span>. Um backup do banco é feito automaticamente toda vez que o app abre (os últimos 30 ficam guardados em <span class="kbd">data/backups</span>).</p>
      <div class="notice" id="cloudStatus">Verificando backup no iCloud…</div>
      <div class="row wrap">
        <button class="btn primary" id="cloudNow">Fazer backup no iCloud agora</button>
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
      const showCloud = (st) => {
        const el = $("#cloudStatus", v); if (!el) return;
        if (!st.has_icloud) { el.innerHTML = `<b style="color:var(--warn)">iCloud Drive não encontrado.</b> Ative em Ajustes do Sistema → seu nome → iCloud → iCloud Drive. Enquanto isso, os backups ficam só no Mac.`; return; }
        el.innerHTML = st.error ? `<b style="color:var(--bad)">Último backup no iCloud falhou:</b> ${esc(st.error)}`
          : `☁️ Backup no iCloud ${st.last_cloud ? `feito às <b style="color:var(--text)">${fmtClock(st.last_cloud)}</b> (${fmtDayLabel(st.last_cloud).toLowerCase()})` : "ainda não feito"}. Pasta: <span class="kbd">iCloud Drive/CoffeeLab Backups</span>. Ele salva ao abrir, a cada 10 min se algo mudou e ao fechar.`;
      };
      api.get("/api/backup").then(showCloud).catch(() => {});
      api.get("/api/info").then((r) => {
        const box = $("#lanUrls", v); if (!box) return;
        box.innerHTML = (r.lan || []).length ? r.lan.map((u) => `<div class="row between notice"><span class="kbd" style="font-size:14px">${esc(u)}</span><button class="btn sm" data-copy="${esc(u)}">Copiar</button></div>`).join("") : `<span class="small muted">Não achei o endereço da rede. Confere se o Mac está no Wi-Fi.</span>`;
        $$("[data-copy]", box).forEach((b) => (b.onclick = () => { try { navigator.clipboard.writeText(b.dataset.copy); toast("Copiado"); } catch (_) {} }));
      }).catch(() => {});
      $("#cloudNow", v).onclick = () => safe(async () => { const r = await api.post("/api/backup"); showCloud(Object.assign({ has_icloud: true }, r)); toast(r.ok ? "Backup no iCloud feito ☁️" : "Não consegui fazer o backup", !r.ok); });
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
        <div class="field"><label>Moagem padrão no espresso</label><input class="input" id="edE" inputmode="decimal" value="${esc(d.default_grind_espresso == null ? "" : d.default_grind_espresso)}" placeholder="Ex.: 7"></div>
        <div class="field"><label>Moagem padrão (outros métodos)</label><input class="input" id="edO" inputmode="decimal" value="${esc(d.default_grind == null ? "" : d.default_grind)}" placeholder="—"></div>
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
    if (d.type === "grinder") { body.kind = $("#ek", m.el).value; body.unit = $("#eu", m.el).value; body.default_grind_espresso = $("#edE", m.el).value.trim() || null; body.default_grind = $("#edO", m.el).value.trim() || null; }
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
