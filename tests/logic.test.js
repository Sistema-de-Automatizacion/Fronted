import { describe, it, expect } from "vitest";
import {
  buildPaidMap,
  getEffectiveContracts,
  DEBT_NOTIFICATION_THRESHOLD,
  paginate,
  CLIENT_PAGE_SIZE,
} from "../app.js";

// Helpers para armar payloads realistas sin repetir campos.
function contract(overrides = {}) {
  return {
    id: "1001",
    nameClient: "Juan",
    phoneNumber: "3000000000",
    paymentContract: 220_000,
    paymentDay: "Martes",
    paymentPayout: null,
    StateWeek: "",
    date: "2026-04-24 10:00:00",
    accumulatedDebt: 220_000,
    debt: 0,
    message: "...",
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    id: "1001",
    nameClient: "Juan",
    phoneNumber: "3000000000",
    paymentContract: 220_000,
    paymentDay: "22/04/2026",
    paymentPayout: 220_000,
    StateWeek: null,
    date: "2026-04-24 10:00:00",
    accumulatedDebt: 0,
    debt: 0,
    message: "...",
    ...overrides,
  };
}

describe("DEBT_NOTIFICATION_THRESHOLD", () => {
  it("is $100.000 COP by default", () => {
    expect(DEBT_NOTIFICATION_THRESHOLD).toBe(100_000);
  });
});

describe("buildPaidMap", () => {
  it("returns an empty map when there are no payments", () => {
    const map = buildPaidMap([]);
    expect(map.size).toBe(0);
  });

  it("stores a single payment keyed by contract id", () => {
    const map = buildPaidMap([payment({ id: "1001", paymentPayout: 150_000 })]);
    expect(map.get("1001")).toBe(150_000);
  });

  it("sums multiple payments for the same contract", () => {
    const map = buildPaidMap([
      payment({ id: "1001", paymentPayout: 100_000 }),
      payment({ id: "1001", paymentPayout: 50_000 }),
      payment({ id: "2002", paymentPayout: 220_000 }),
    ]);
    expect(map.get("1001")).toBe(150_000);
    expect(map.get("2002")).toBe(220_000);
  });

  it("treats null/undefined paymentPayout as 0", () => {
    const map = buildPaidMap([
      payment({ id: "1001", paymentPayout: null }),
      payment({ id: "1001", paymentPayout: undefined }),
    ]);
    expect(map.get("1001")).toBe(0);
  });
});

describe("getEffectiveContracts — regla 1: cliente sin pago", () => {
  it("incluye un contrato que no pagó nada esta semana", () => {
    const contracts = [contract({ id: "A" })];
    const paidMap = new Map();
    expect(getEffectiveContracts(contracts, paidMap)).toHaveLength(1);
  });
});

describe("getEffectiveContracts — regla 2: cliente pagó TODA la deuda", () => {
  it("excluye el contrato cuando pago == deuda acumulada", () => {
    const contracts = [contract({ id: "A", accumulatedDebt: 220_000, paymentContract: 220_000 })];
    const paidMap = new Map([["A", 220_000]]);
    expect(getEffectiveContracts(contracts, paidMap)).toHaveLength(0);
  });

  it("excluye el contrato cuando pago > deuda acumulada", () => {
    const contracts = [contract({ id: "A", accumulatedDebt: 200_000, paymentContract: 200_000 })];
    const paidMap = new Map([["A", 250_000]]);
    expect(getEffectiveContracts(contracts, paidMap)).toHaveLength(0);
  });
});

describe("getEffectiveContracts — regla 3: umbral $100k", () => {
  it("excluye cuando pagó la cuota y queda mora < umbral ($15k)", () => {
    // 3492: cuota 235.000, mora previa 15.000, pagó 235.000.
    const contracts = [contract({
      id: "3492", accumulatedDebt: 250_000, paymentContract: 235_000, debt: 15_000,
    })];
    const paidMap = new Map([["3492", 235_000]]);
    expect(getEffectiveContracts(contracts, paidMap)).toHaveLength(0);
  });

  it("excluye cuando pagó la cuota y queda mora justo bajo el umbral ($99.999)", () => {
    const contracts = [contract({
      id: "A", accumulatedDebt: 319_999, paymentContract: 220_000,
    })];
    const paidMap = new Map([["A", 220_000]]);
    expect(getEffectiveContracts(contracts, paidMap)).toHaveLength(0);
  });

  it("incluye cuando pagó la cuota pero la mora residual es ≥ umbral ($150k)", () => {
    const contracts = [contract({
      id: "A", accumulatedDebt: 370_000, paymentContract: 220_000,
    })];
    const paidMap = new Map([["A", 220_000]]);
    // 370k - 220k = 150k, NO está bajo el umbral → se mantiene.
    expect(getEffectiveContracts(contracts, paidMap)).toHaveLength(1);
  });

  it("incluye cuando pagó menos que la cuota (pago parcial), aunque realDebt sea chico", () => {
    // pagó menos que cuota → NO aplica la regla del umbral; se notifica igual.
    const contracts = [contract({
      id: "A", accumulatedDebt: 100_000, paymentContract: 220_000,
    })];
    const paidMap = new Map([["A", 50_000]]); // pago parcial, < cuota
    expect(getEffectiveContracts(contracts, paidMap)).toHaveLength(1);
  });

  it("respeta un umbral personalizado", () => {
    const contracts = [contract({
      id: "A", accumulatedDebt: 250_000, paymentContract: 220_000,
    })];
    const paidMap = new Map([["A", 220_000]]); // queda 30k de mora
    // Con umbral 100k, se filtra.
    expect(getEffectiveContracts(contracts, paidMap, 100_000)).toHaveLength(0);
    // Con umbral 20k, NO se filtra (30k > 20k).
    expect(getEffectiveContracts(contracts, paidMap, 20_000)).toHaveLength(1);
  });
});

describe("getEffectiveContracts — combinaciones reales observadas", () => {
  it("caso BD real: mix de sin pago, pago completo y pago con mora residual", () => {
    const contracts = [
      contract({ id: "edwin",    accumulatedDebt: 208_800, paymentContract: 208_000, debt: 800 }),
      contract({ id: "pagoTodo", accumulatedDebt: 205_000, paymentContract: 205_000, debt: 0 }),
      contract({ id: "conMora",  accumulatedDebt: 295_000, paymentContract: 220_000, debt: 75_000 }),
      contract({ id: "sinPago",  accumulatedDebt: 220_000, paymentContract: 220_000, debt: 0 }),
    ];
    const paidMap = new Map([
      ["edwin",    208_000], // pagó cuota, queda $800 de mora (< umbral) → OUT
      ["pagoTodo", 205_000], // pagó todo                                  → OUT
      ["conMora",  220_000], // pagó cuota, queda $75k (< umbral)          → OUT
      // "sinPago" no pagó                                                 → IN
    ]);

    const effective = getEffectiveContracts(contracts, paidMap);
    expect(effective).toHaveLength(1);
    expect(effective[0].id).toBe("sinPago");
  });
});

describe("CLIENT_PAGE_SIZE", () => {
  it("es 10 por defecto", () => {
    expect(CLIENT_PAGE_SIZE).toBe(10);
  });
});

describe("paginate", () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

  it("devuelve un slice vacío y total 0 cuando no hay items", () => {
    const r = paginate([], 0);
    expect(r.slice).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.totalPages).toBe(0);
    expect(r.from).toBe(0);
    expect(r.to).toBe(0);
    expect(r.page).toBe(0);
  });

  it("usa CLIENT_PAGE_SIZE (10) por defecto", () => {
    const r = paginate(mk(25), 0);
    expect(r.slice).toHaveLength(10);
    expect(r.totalPages).toBe(3);
    expect(r.from).toBe(1);
    expect(r.to).toBe(10);
  });

  it("respeta el size personalizado", () => {
    const r = paginate(mk(25), 0, 5);
    expect(r.slice).toHaveLength(5);
    expect(r.totalPages).toBe(5);
  });

  it("calcula from/to en una página intermedia", () => {
    const r = paginate(mk(25), 1, 10); // página 2 (index 1)
    expect(r.slice.map((x) => x.id)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(r.from).toBe(11);
    expect(r.to).toBe(20);
    expect(r.page).toBe(1);
  });

  it("la última página devuelve solo los items restantes", () => {
    const r = paginate(mk(25), 2, 10);
    expect(r.slice).toHaveLength(5);
    expect(r.from).toBe(21);
    expect(r.to).toBe(25);
  });

  it("limita una página fuera de rango (alta) a la última válida", () => {
    const r = paginate(mk(25), 99, 10);
    expect(r.page).toBe(2);
    expect(r.slice).toHaveLength(5);
  });

  it("limita una página negativa a 0", () => {
    const r = paginate(mk(25), -3, 10);
    expect(r.page).toBe(0);
    expect(r.from).toBe(1);
  });

  it("redondea hacia arriba el total de páginas (904 / 10 = 91)", () => {
    const r = paginate(mk(904), 0);
    expect(r.totalPages).toBe(91);
    expect(r.slice).toHaveLength(10);
  });
});
