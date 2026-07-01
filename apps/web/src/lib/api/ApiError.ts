import type { ApiProblem } from "./problemJson";
import { messageFromProblem, parseApiProblem } from "./problemJson";

export class ApiError extends Error {
  readonly problem?: ApiProblem;

  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
    public readonly requestId?: string,
    problem?: ApiProblem
  ) {
    super(message);
    this.name = "ApiError";
    this.problem = problem;
  }

  static fromResponse(
    res: Response,
    parsedBody: unknown,
    requestId?: string
  ): ApiError {
    const problem = parseApiProblem(parsedBody);
    const base = res.statusText || "Request failed";
    const message = messageFromProblem(problem, base);
    return new ApiError(res.status, message, parsedBody, requestId, problem);
  }

  static timeout(requestId?: string): ApiError {
    return new ApiError(
      0,
      "Request timed out",
      undefined,
      requestId,
      undefined
    );
  }

  static aborted(requestId?: string): ApiError {
    return new ApiError(
      0,
      "Request was cancelled",
      undefined,
      requestId,
      undefined
    );
  }
}
