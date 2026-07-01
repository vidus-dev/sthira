import { afterEach, describe, expect, it } from "vitest";

import { getCsrfToken, getExtraHeadersForApi, setCsrfToken } from "./csrfStore";

afterEach(() => {
  setCsrfToken(null);
});

describe("csrfStore", () => {
  it("starts empty", () => {
    expect(getCsrfToken()).toBeNull();
    expect(getExtraHeadersForApi()).toEqual({});
  });

  it("stores and returns a token", () => {
    setCsrfToken("tok-123");
    expect(getCsrfToken()).toBe("tok-123");
    expect(getExtraHeadersForApi()).toEqual({ "X-CSRF-Token": "tok-123" });
  });

  it("treats an empty string as cleared", () => {
    setCsrfToken("tok-123");
    setCsrfToken("");
    expect(getCsrfToken()).toBeNull();
    expect(getExtraHeadersForApi()).toEqual({});
  });

  it("clears with null", () => {
    setCsrfToken("tok-123");
    setCsrfToken(null);
    expect(getCsrfToken()).toBeNull();
  });
});
