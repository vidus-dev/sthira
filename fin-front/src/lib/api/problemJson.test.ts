import { describe, expect, it } from "vitest";
import { messageFromProblem, parseApiProblem } from "./problemJson";

describe("parseApiProblem", () => {
  it("parses RFC7807-shaped JSON", () => {
    const p = parseApiProblem({
      type: "https://example.com/probs/out-of-credit",
      title: "Out of credit",
      detail: "You ran out of money.",
      status: 403,
    });
    expect(p?.status).toBe(403);
    expect(messageFromProblem(p, "fallback")).toBe("You ran out of money.");
  });

  it("parses legacy FastAPI { detail: string }", () => {
    const p = parseApiProblem({ detail: "Invalid input" });
    expect(p?.detail).toBe("Invalid input");
    expect(messageFromProblem(p, "fallback")).toBe("Invalid input");
  });

  it("returns undefined for invalid shapes", () => {
    expect(parseApiProblem({ status: "nope" })).toBeUndefined();
  });
});
