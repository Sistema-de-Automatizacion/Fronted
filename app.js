"use strict";

const STORAGE_KEY = "motos:backendUrl";
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
    fetchHistory();
  });

  els.resetBackend.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    els.backendUrl.value = DEFAULT_URL;
    els.backendStatus.textContent = `Backend activo: ${DEFAULT_URL} (por defecto)`;
    checkHealth();
    fetchContracts();
    fetchHistory();
  });

  els.checkHealth.addEventListener("click", checkHealth);
  els.refreshContracts.addEventListener("click", fetchContracts);
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

  updateTabUI();

  // Carga inicial automatica
  checkHealth();
  fetchContracts();
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
  const url = `${getBackendUrl()}/contracts/next-to-pay`;
  els.contractsState.textContent = "Cargando...";
  els.contractsBody.innerHTML = "";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderContracts(Array.isArray(data) ? data : []);
    els.contractsState.textContent = `${data.length} contrato(s) · Actualizado ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    els.contractsState.textContent = `Error al cargar contratos: ${err.message}`;
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

async function fetchHistory() {
  const endpoint = historyState.tab === "errors" ? "/notifications/errors/all" : "/notifications/all";
  const url = `${getBackendUrl()}${endpoint}?page=${historyState.page}&size=${historyState.size}`;
  els.historyStateLabel.textContent = "Cargando...";
  els.historyBody.innerHTML = "";
  els.historyPrev.disabled = true;
  els.historyNext.disabled = true;
  try {
    const res = await fetch(url);
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
    els.historyStateLabel.textContent = `Error al cargar historial: ${err.message}`;
    els.historyPageInfo.textContent = "";
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
  const url = `${getBackendUrl()}/get/notifications?id=${encodeURIComponent(id)}`;
  els.notificationsState.textContent = "Cargando...";
  els.notificationsBody.innerHTML = "";
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 400) throw new Error("ID inválido (solo dígitos)");
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    renderNotifications(Array.isArray(data) ? data : []);
    els.notificationsState.textContent = `${data.length} notificación(es) para el contrato ${id}`;
  } catch (err) {
    els.notificationsState.textContent = `Error: ${err.message}`;
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
