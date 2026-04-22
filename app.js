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

function sanitizeUrl(raw) {
  return raw.trim().replace(/\/+$/, "");
}

function escapeHtml(value) {
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
    // Limpiar tablas
    els.contractsBody.innerHTML = "";
    els.paidTodayBody.innerHTML = "";
    els.historyBody.innerHTML = "";
    els.notificationsBody.innerHTML = "";
    els.contractsState.textContent = "Sesión cerrada.";
    els.paidTodayState.textContent = "Sesión cerrada.";
    els.historyStateLabel.textContent = "";
    els.historyPageInfo.textContent = "";
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
    btn.classList.toggle("border-emerald-600", active);
    btn.classList.toggle("text-emerald-700", active);
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

function hostOf(url) {
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
    renderContracts(Array.isArray(data) ? data : []);
    els.contractsState.textContent = `${data.length} contrato(s) · Actualizado ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    if (err.message !== "Unauthorized") {
      els.contractsState.textContent = `Error al cargar contratos: ${err.message}`;
    }
  }
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
      const abono = c.paymentPayout == null ? null : Number(c.paymentPayout);
      const saldo = abono == null ? cuota : cuota - abono;
      const isPartial = abono != null;
      const caseLabel = isPartial ? "D · Abono parcial" : "C · Sin abono";
      const caseClass = isPartial
        ? "bg-amber-100 text-amber-800 border border-amber-200"
        : "bg-blue-100 text-blue-800 border border-blue-200";
      const stateWeek = c.StateWeek ?? c.stateWeek ?? "";
      return `
        <tr class="border-b hover:bg-gray-50">
          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(c.id)}</td>
          <td class="px-3 py-2">${escapeHtml(c.nameClient)}</td>
          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(c.phoneNumber)}</td>
          <td class="px-3 py-2">${escapeHtml(c.paymentDay)}</td>
          <td class="px-3 py-2 text-right">${money.format(cuota * 1000)}</td>
          <td class="px-3 py-2 text-right">${abono == null ? '<span class="text-gray-400">—</span>' : money.format(abono * 1000)}</td>
          <td class="px-3 py-2 text-right font-semibold">${money.format(saldo * 1000)}</td>
          <td class="px-3 py-2"><span class="inline-block px-2 py-1 rounded text-xs ${caseClass}">${caseLabel}</span><div class="text-xs text-gray-400 mt-1">${escapeHtml(stateWeek)}</div></td>
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
    const res = await apiFetch("/contracts/paid-today");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderPaidToday(Array.isArray(data) ? data : []);
    els.paidTodayState.textContent = `${data.length} pago(s) registrado(s) hoy · Actualizado ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    if (err.message !== "Unauthorized") {
      els.paidTodayState.textContent = `Error al cargar pagos: ${err.message}`;
    }
  }
}

function renderPaidToday(payments) {
  if (payments.length === 0) {
    els.paidTodayBody.innerHTML =
      '<tr><td colspan="5" class="text-center py-6 text-gray-500">Aún no se han registrado pagos el día de hoy.</td></tr>';
    return;
  }
  els.paidTodayBody.innerHTML = payments
    .map((p) => {
      const abono = p.paymentPayout == null ? 0 : Number(p.paymentPayout);
      return `
        <tr class="border-b hover:bg-gray-50">
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

init();
