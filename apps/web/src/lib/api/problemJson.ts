import { z } from "zod";

/** RFC 7807-style problem body (subset; matches common API style guides). */
export const ApiProblemSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  status: z.number().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});

export type ApiProblem = z.infer<typeof ApiProblemSchema>;

export function parseApiProblem(body: unknown): ApiProblem | undefined {
  const r = ApiProblemSchema.safeParse(body);
  if (r.success) return r.data;
  if (typeof body === "object" && body !== null && "detail" in body) {
    const d = (body as { detail?: unknown }).detail;
    if (typeof d === "string") {
      return { detail: d, title: "Error", status: undefined };
    }
  }
  return undefined;
}

export function messageFromProblem(problem: ApiProblem | undefined, fallback: string): string {
  if (!problem) return fallback;
  return problem.detail ?? problem.title ?? fallback;
}
