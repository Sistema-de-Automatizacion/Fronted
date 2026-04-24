"use strict";

const STORAGE_KEY = "motos:backendUrl";
const API_KEY_STORAGE = "motos:apiKey";
const DEFAULT_URL = "https://motos-del-caribe-exfsh8ekghg9bba5.mexicocentral-01.azurewebsites.net";

const els = {
  backendUrl: document.getElementById("backendUrl"),
  saveBackend: document.getElementById("saveBackend"),
  resetBackend: document.getElementById("resetBackend"),
  checkHealth: document.getElementById("checkHealth"),
  backendStatus: document.getElementById("backendStatus"),
  headerDot: document.getElementById("headerDot"),
  headerText: document.getElementById("headerText"),
  refreshContracts: document.getElementById("refreshContracts"),
  contractsState: document.getElementById("contractsState"),
  contractsBody: document.getElementById("contractsBody"),
  refreshPaidToday: document.getElementById("refreshPaidToday"),
  paidTodayState: document.getElementById("paidTodayState"),
  paidTodayBody: document.getElementById("paidTodayBody"),
  contractId: document.getElementById("contractId"),
  searchNotifications: document.getElementById("searchNotifications"),
  notificationsState: document.getElementById("notificationsState"),
  notificationsBody: document.getElementById("notificationsBody"),
  refreshHistory: document.getElementById("refreshHistory"),
  historyTabs: document.querySelectorAll(".history-tab"),
  historyStateLabel: document.getElementById("historyState"),
  historyBody: document.getElementById("historyBody"),
  historyHead: document.getElementById("historyHead"),
  historyPageSize: document.getElementById("historyPageSize"),
  historyPrev: document.getElementById("historyPrev"),
  historyNext: document.getElementById("historyNext"),
  historyPageInfo: document.getElementById("historyPageInfo"),
  loginOverlay: document.getElementById("loginOverlay"),
  loginForm: document.getElementById("loginForm"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  loginError: document.getElementById("loginError"),
  logoutBtn: document.getElementById("logoutBtn"),
};

const historyState = {
  tab: "sent", // "sent" | "errors"
  page: 0,
  size: 20,
  totalPages: 0,
  totalElements: 0,
};

const contractsState = {
  raw: [],            // último response sin filtrar
  filter: "all",      // "all" | "mora" | "reminder"
};

const paidTodayState = {
  raw: [],
};

// Umbral (COP): si el cliente ya pagó la cuota semanal y su deuda residual
// es menor a este monto, no lo incluimos en la lista de notificaciones.
export const DEBT_NOTIFICATION_THRESHOLD = 100000;

const money = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function getBackendUrl() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_URL;
}

function setBackendUrl(url) {
  localStorage.setItem(STORAGE_KEY, url);
}

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || "";
}

function setApiKey(key) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE);
}

function showLogin(errorMessage) {
  els.loginOverlay.classList.remove("hidden");
  els.loginOverlay.classList.add("flex");
  els.logoutBtn.classList.add("hidden");
  els.apiKeyInput.value = "";
  if (errorMessage) {
    els.loginError.textContent = errorMessage;
    els.loginError.classList.remove("hidden");
  } else {
    els.loginError.classList.add("hidden");
  }
  setTimeout(() => els.apiKeyInput.focus(), 50);
}

function hideLogin() {
  els.loginOverlay.classList.add("hidden");
  els.loginOverlay.classList.remove("flex");
  els.logoutBtn.classList.remove("hidden");
}

async function apiFetch(path, options = {}) {
  const base = getBackendUrl();
  const key = getApiKey();
  const headers = new Headers(options.headers || {});
  if (key) headers.set("X-API-Key", key);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${base}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearApiKey();
    showLogin("API key inválida o expirada. Ingresa una nueva.");
    throw new Error("Unauthorized");
  }
  return res;
}

export function sanitizeUrl(raw) {
  return raw.trim().replace(/\/+$/, "");
}

export function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setHeaderStatus(state, text) {
  const colors = {
    ok: "bg-emerald-300",
    loading: "bg-amber-300",
    error: "bg-red-400",
  };
  els.headerDot.className = `w-2 h-2 rounded-full ${colors[state] || colors.loading}`;
  els.headerText.textContent = text;
}

function init() {
  const saved = getBackendUrl();
  els.backendUrl.value = saved;
  els.backendStatus.textContent = `Backend activo: ${saved}`;

  els.saveBackend.addEventListener("click", () => {
    const url = sanitizeUrl(els.backendUrl.value);
    if (!url) {
      els.backendStatus.textContent = "URL vacía. No se guardó nada.";
      return;
    }
    setBackendUrl(url);
    els.backendUrl.value = url;
    els.backendStatus.textContent = `Backend activo: ${url}`;
    checkHealth();
    fetchContracts();
    fetchPaidToday();
    fetchHistory();
  });

  els.resetBackend.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    els.backendUrl.value = DEFAULT_URL;
    els.backendStatus.textContent = `Backend activo: ${DEFAULT_URL} (por defecto)`;
    checkHealth();
    fetchContracts();
    fetchPaidToday();
    fetchHistory();
  });

  els.checkHealth.addEventListener("click", checkHealth);
  els.refreshContracts.addEventListener("click", fetchContracts);
  els.refreshPaidToday.addEventListener("click", fetchPaidToday);

  document.querySelectorAll(".contracts-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      contractsState.filter = btn.dataset.filter;
      applyContractsFilter();
    });
  });
  els.searchNotifications.addEventListener("click", () => {
    const id = els.contractId.value.trim();
    if (id) fetchNotifications(id);
  });
  els.contractId.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const id = els.contractId.value.trim();
      if (id) fetchNotifications(id);
    }
  });

  // History section
  els.refreshHistory.addEventListener("click", () => {
    historyState.page = 0;
    fetchHistory();
  });
  els.historyTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (historyState.tab === tab) return;
      historyState.tab = tab;
      historyState.page = 0;
      updateTabUI();
      fetchHistory();
    });
  });
  els.historyPageSize.addEventListener("change", () => {
    historyState.size = Number(els.historyPageSize.value);
    historyState.page = 0;
    fetchHistory();
  });
  els.historyPrev.addEventListener("click", () => {
    if (historyState.page > 0) {
      historyState.page -= 1;
      fetchHistory();
    }
  });
  els.historyNext.addEventListener("click", () => {
    if (historyState.page + 1 < historyState.totalPages) {
      historyState.page += 1;
      fetchHistory();
    }
  });

  // Login form
  els.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const key = els.apiKeyInput.value.trim();
    if (!key) return;
    setApiKey(key);
    hideLogin();
    checkHealth();
    fetchContracts();
    fetchPaidToday();
    fetchHistory();
  });

  // Logout
  els.logoutBtn.addEventListener("click", () => {
    clearApiKey();
    contractsState.raw = [];
    contractsState.filter = "all";
    paidTodayState.raw = [];
    // Limpiar tablas
    els.contractsBody.innerHTML = "";
    els.paidTodayBody.innerHTML = "";
    els.historyBody.innerHTML = "";
    els.notificationsBody.innerHTML = "";
    els.contractsState.textContent = "Sesión cerrada.";
    els.paidTodayState.textContent = "Sesión cerrada.";
    els.historyStateLabel.textContent = "";
    els.historyPageInfo.textContent = "";
    updateKpis();
    setHeaderStatus("loading", "Sin sesión");
    showLogin();
  });

  updateTabUI();

  // Si no hay API key, pedirla antes de cargar nada
  if (!getApiKey()) {
    showLogin();
    setHeaderStatus("loading", "Ingresa la API key");
    return;
  }

  els.logoutBtn.classList.remove("hidden");

  // Carga inicial automatica
  checkHealth();
  fetchContracts();
  fetchPaidToday();
  fetchHistory();
}

function updateTabUI() {
  els.historyTabs.forEach((btn) => {
    const active = btn.dataset.tab === historyState.tab;
    btn.classList.toggle("border-sky-700", active);
    btn.classList.toggle("text-sky-800", active);
    btn.classList.toggle("border-transparent", !active);
    btn.classList.toggle("text-gray-500", !active);
  });
  // Show/hide the error column
  const errorCells = document.querySelectorAll(".history-errors-only");
  errorCells.forEach((c) => {
    c.classList.toggle("hidden", historyState.tab !== "errors");
  });
}

async function checkHealth() {
  const base = getBackendUrl();
  const url = `${base}/actuator/health`;
  els.backendStatus.textContent = `Consultando ${url}...`;
  setHeaderStatus("loading", "Verificando backend...");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const ok = (data.status || "").toUpperCase() === "UP";
    els.backendStatus.textContent = `Health: ${data.status || "unknown"} (${url})`;
    setHeaderStatus(ok ? "ok" : "error", ok ? `Backend OK · ${hostOf(base)}` : `Backend ${data.status}`);
  } catch (err) {
    els.backendStatus.textContent = `Error: ${err.message}. Revisa CORS o que el backend esté arriba.`;
    setHeaderStatus("error", "Backend no disponible");
  }
}

export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

async function fetchContracts() {
  if (!getApiKey()) return;
  els.contractsState.textContent = "Cargando...";
  els.contractsBody.innerHTML = "";
  try {
    const res = await apiFetch("/contracts/next-to-pay");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    contractsState.raw = Array.isArray(data) ? data : [];
    applyContractsFilter();
  } catch (err) {
    if (err.message !== "Unauthorized") {
      els.contractsState.textContent = `Error al cargar contratos: ${err.message}`;
    }
  }
}

export function buildPaidMap(payments = paidTodayState.raw) {
  const map = new Map();
  for (const p of payments) {
    const prev = map.get(p.id) || 0;
    map.set(p.id, prev + Number(p.paymentPayout ?? 0));
  }
  return map;
}

// Aplica las reglas de dedup: un contrato NO se notifica si
//   1) ya pagó toda la deuda esta semana (realDebt <= 0), o
//   2) pagó al menos la cuota semanal y la mora residual < umbral (100k COP).
export function getEffectiveContracts(
  contracts = contractsState.raw,
  paidMap = buildPaidMap(),
  threshold = DEBT_NOTIFICATION_THRESHOLD,
) {
  return contracts.filter((c) => {
    const paid = paidMap.get(c.id) || 0;
    if (paid === 0) return true;
    const cuota = Number(c.paymentContract ?? 0);
    const accumDebt = Number(c.accumulatedDebt ?? 0);
    const realDebt = accumDebt - paid;
    if (realDebt <= 0) return false;
    if (paid >= cuota && realDebt < threshold) return false;
    return true;
  });
}

function applyContractsFilter() {
  const all = getEffectiveContracts();
  const moraCount = all.filter((c) => Number(c.debt ?? 0) > 0).length;
  const reminderCount = all.length - moraCount;

  document.querySelectorAll(".contracts-filter").forEach((btn) => {
    const f = btn.dataset.filter;
    const count = f === "all" ? all.length : f === "mora" ? moraCount : reminderCount;
    const countEl = btn.querySelector(".filter-count");
    if (countEl) countEl.textContent = count;
    const active = f === contractsState.filter;
    btn.classList.toggle("bg-slate-900", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("hover:bg-slate-800", active);
    btn.classList.toggle("bg-slate-100", !active);
    btn.classList.toggle("text-slate-700", !active);
    btn.classList.toggle("hover:bg-slate-200", !active);
  });

  const filtered =
    contractsState.filter === "mora"
      ? all.filter((c) => Number(c.debt ?? 0) > 0)
      : contractsState.filter === "reminder"
      ? all.filter((c) => Number(c.debt ?? 0) === 0)
      : all;

  renderContracts(filtered);

  const stamp = new Date().toLocaleTimeString();
  const label =
    contractsState.filter === "all"
      ? `${all.length} contrato(s)`
      : `${filtered.length} de ${all.length} contrato(s) (${contractsState.filter === "mora" ? "mora" : "recordatorio"})`;
  els.contractsState.textContent = `${label} · Actualizado ${stamp}`;

  updateKpis();
}

function updateKpis() {
  const contracts = getEffectiveContracts();
  const total = contracts.length;
  const moraCount = contracts.filter((c) => Number(c.debt ?? 0) > 0).length;
  const reminderCount = total - moraCount;
  const cartera = contracts.reduce((sum, c) => sum + Number(c.accumulatedDebt ?? 0), 0);
  const moraAmount = contracts.reduce((sum, c) => sum + Number(c.debt ?? 0), 0);

  const paid = paidTodayState.raw;
  const paidCount = paid.length;
  const paidAmount = paid.reduce((sum, p) => sum + Number(p.paymentPayout ?? 0), 0);

  const kpiTotal = document.getElementById("kpiTotal");
  const kpiTotalSub = document.getElementById("kpiTotalSub");
  const kpiMora = document.getElementById("kpiMora");
  const kpiMoraSub = document.getElementById("kpiMoraSub");
  const kpiCartera = document.getElementById("kpiCartera");
  const kpiCarteraSub = document.getElementById("kpiCarteraSub");
  const kpiPaid = document.getElementById("kpiPaid");
  const kpiPaidSub = document.getElementById("kpiPaidSub");

  if (kpiTotal) kpiTotal.textContent = total.toLocaleString("es-CO");
  if (kpiTotalSub) kpiTotalSub.textContent = `${moraCount} mora · ${reminderCount} recordatorio`;

  if (kpiMora) kpiMora.textContent = money.format(moraAmount);
  if (kpiMoraSub) kpiMoraSub.textContent = `${moraCount} contrato(s) con deuda previa`;

  if (kpiCartera) kpiCartera.textContent = money.format(cartera);
  if (kpiCarteraSub) kpiCarteraSub.textContent = `${total} contrato(s) con deuda`;

  if (kpiPaid) kpiPaid.textContent = money.format(paidAmount);
  if (kpiPaidSub) kpiPaidSub.textContent = paidCount === 0 ? "Aún no hay pagos esta semana" : `${paidCount} pago(s) esta semana`;
}

function renderContracts(contracts) {
  if (contracts.length === 0) {
    els.contractsBody.innerHTML =
      '<tr><td colspan="9" class="text-center py-6 text-gray-500">Sin contratos que notificar en este momento.</td></tr>';
    return;
  }

  els.contractsBody.innerHTML = contracts
    .map((c) => {
      const cuota = Number(c.paymentContract ?? 0);
      const moraArrastrada = Number(c.debt ?? 0);
      const totalDue = Number(c.accumulatedDebt ?? 0);
      const hasDebt = moraArrastrada > 0;
      const caseLabel = hasDebt ? "Mora · Cuota vencida" : "Recordatorio · Sin abono";
      const caseClass = hasDebt
        ? "bg-red-100 text-red-800 border border-red-200"
        : "bg-blue-100 text-blue-800 border border-blue-200";
      return `
        <tr class="border-b hover:bg-gray-50">
          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(c.id)}</td>
          <td class="px-3 py-2">${escapeHtml(c.nameClient)}</td>
          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(c.phoneNumber)}</td>
          <td class="px-3 py-2">${escapeHtml(c.paymentDay)}</td>
          <td class="px-3 py-2 text-right">${money.format(cuota)}</td>
          <td class="px-3 py-2 text-right">${moraArrastrada === 0 ? '<span class="text-gray-400">—</span>' : money.format(moraArrastrada)}</td>
          <td class="px-3 py-2 text-right font-semibold">${money.format(totalDue)}</td>
          <td class="px-3 py-2"><span class="inline-block px-2 py-1 rounded text-xs ${caseClass}">${caseLabel}</span></td>
          <td class="px-3 py-2 text-sm text-gray-700">${escapeHtml(c.message)}</td>
        </tr>
      `;
    })
    .join("");
}

async function fetchPaidToday() {
  if (!getApiKey()) return;
  els.paidTodayState.textContent = "Cargando...";
  els.paidTodayBody.innerHTML = "";
  try {
    const res = await apiFetch("/contracts/paid-this-week");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    paidTodayState.raw = Array.isArray(data) ? data : [];
    renderPaidToday(paidTodayState.raw);
    els.paidTodayState.textContent = `${paidTodayState.raw.length} pago(s) esta semana · Actualizado ${new Date().toLocaleTimeString()}`;
    // Re-aplicar filtro para que la dedup y los KPIs reflejen los pagos recién cargados.
    applyContractsFilter();
  } catch (err) {
    if (err.message !== "Unauthorized") {
      els.paidTodayState.textContent = `Error al cargar pagos: ${err.message}`;
    }
  }
}

function renderPaidToday(payments) {
  if (payments.length === 0) {
    els.paidTodayBody.innerHTML =
      '<tr><td colspan="6" class="text-center py-6 text-gray-500">Aún no hay pagos registrados en esta semana.</td></tr>';
    return;
  }
  els.paidTodayBody.innerHTML = payments
    .map((p) => {
      const abono = p.paymentPayout == null ? 0 : Number(p.paymentPayout);
      const fechaPago = p.paymentDay || "—";
      return `
        <tr class="border-b hover:bg-gray-50">
          <td class="px-3 py-2 whitespace-nowrap">${escapeHtml(fechaPago)}</td>
          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(p.id)}</td>
          <td class="px-3 py-2">${escapeHtml(p.nameClient)}</td>
          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(p.phoneNumber)}</td>
          <td class="px-3 py-2 text-right font-semibold">${money.format(abono)}</td>
          <td class="px-3 py-2 text-sm text-gray-700 whitespace-pre-line">${escapeHtml(p.message)}</td>
        </tr>
      `;
    })
    .join("");
}

async function fetchHistory() {
  if (!getApiKey()) return;
  const endpoint = historyState.tab === "errors" ? "/notifications/errors/all" : "/notifications/all";
  const path = `${endpoint}?page=${historyState.page}&size=${historyState.size}`;
  els.historyStateLabel.textContent = "Cargando...";
  els.historyBody.innerHTML = "";
  els.historyPrev.disabled = true;
  els.historyNext.disabled = true;
  try {
    const res = await apiFetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    historyState.totalPages = data.totalPages || 0;
    historyState.totalElements = data.totalElements || 0;
    renderHistory(data.content || []);
    const from = data.totalElements === 0 ? 0 : historyState.page * historyState.size + 1;
    const to = Math.min((historyState.page + 1) * historyState.size, data.totalElements);
    els.historyStateLabel.textContent = `${data.totalElements} registro(s) totales · ${historyState.tab === "errors" ? "Errores" : "Enviadas"}`;
    els.historyPageInfo.textContent = `Mostrando ${from}-${to} de ${data.totalElements} · Página ${historyState.page + 1} de ${Math.max(1, historyState.totalPages)}`;
    els.historyPrev.disabled = historyState.page === 0;
    els.historyNext.disabled = historyState.page + 1 >= historyState.totalPages;
  } catch (err) {
    if (err.message !== "Unauthorized") {
      els.historyStateLabel.textContent = `Error al cargar historial: ${err.message}`;
      els.historyPageInfo.textContent = "";
    }
  }
}

function renderHistory(rows) {
  if (rows.length === 0) {
    const colspan = historyState.tab === "errors" ? 6 : 5;
    els.historyBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center py-6 text-gray-500">Sin registros en esta página.</td></tr>`;
    return;
  }
  const showError = historyState.tab === "errors";
  els.historyBody.innerHTML = rows
    .map(
      (n) => `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(n.idNotification ?? n.id ?? "")}</td>
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(n.numContract)}</td>
        <td class="px-3 py-2">${escapeHtml(n.nameClient)}</td>
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(n.phoneNumber)}</td>
        <td class="px-3 py-2">${escapeHtml(n.dayRemember)}</td>
        ${showError ? `<td class="px-3 py-2 text-red-700">${escapeHtml(n.errorMessage)}</td>` : ""}
      </tr>
    `
    )
    .join("");
}

async function fetchNotifications(id) {
  if (!getApiKey()) return;
  els.notificationsState.textContent = "Cargando...";
  els.notificationsBody.innerHTML = "";
  try {
    const res = await apiFetch(`/get/notifications?id=${encodeURIComponent(id)}`);
    if (!res.ok) {
      if (res.status === 400) throw new Error("ID inválido (solo dígitos)");
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    renderNotifications(Array.isArray(data) ? data : []);
    els.notificationsState.textContent = `${data.length} notificación(es) para el contrato ${id}`;
  } catch (err) {
    if (err.message !== "Unauthorized") {
      els.notificationsState.textContent = `Error: ${err.message}`;
    }
  }
}

function renderNotifications(list) {
  if (list.length === 0) {
    els.notificationsBody.innerHTML =
      '<tr><td colspan="5" class="text-center py-6 text-gray-500">Sin notificaciones registradas para este contrato.</td></tr>';
    return;
  }
  els.notificationsBody.innerHTML = list
    .map(
      (n) => `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(n.idNotification ?? n.id ?? "")}</td>
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(n.numContract)}</td>
        <td class="px-3 py-2">${escapeHtml(n.nameClient)}</td>
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(n.phoneNumber)}</td>
        <td class="px-3 py-2">${escapeHtml(n.dayRemember)}</td>
      </tr>
    `
    )
    .join("");
}

// Guard: sólo arrancar cuando estamos realmente en el dashboard.
// Permite importar este módulo desde Vitest sin disparar init() contra un DOM vacío.
if (typeof document !== "undefined" && document.getElementById("loginForm")) {
  init();
}
