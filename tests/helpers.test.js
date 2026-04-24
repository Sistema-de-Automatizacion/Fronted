import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeUrl, hostOf } from "../app.js";

describe("escapeHtml", () => {
  it("returns an empty string for null and undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("passes plain text through unchanged", () => {
    expect(escapeHtml("Hola Juan Pérez")).toBe("Hola Juan Pérez");
  });

  it("escapes <, >, \" and & to HTML entities", () => {
    expect(escapeHtml('<script>alert("x")</script>'))
        .toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });

  it("escapes ampersands before anything else (no double-escape)", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  it("coerces non-string values to string", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(true)).toBe("true");
  });
});

describe("sanitizeUrl", () => {
  it("trims whitespace", () => {
    expect(sanitizeUrl("   http://localhost:8080   ")).toBe("http://localhost:8080");
  });

  it("strips trailing slashes", () => {
    expect(sanitizeUrl("http://localhost:8080/")).toBe("http://localhost:8080");
    expect(sanitizeUrl("http://localhost:8080///")).toBe("http://localhost:8080");
  });

  it("leaves an already-clean URL untouched", () => {
    expect(sanitizeUrl("https://motos.example.com/api")).toBe("https://motos.example.com/api");
  });
});

describe("hostOf", () => {
  it("extracts the host of a normal URL", () => {
    expect(hostOf("http://localhost:8080/actuator/health")).toBe("localhost:8080");
    expect(hostOf("https://motos.example.com")).toBe("motos.example.com");
  });

  it("falls back to the input when it's not a valid URL", () => {
    expect(hostOf("not-a-url")).toBe("not-a-url");
    expect(hostOf("")).toBe("");
  });
});
