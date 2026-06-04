import type { Request, Response, NextFunction, RequestHandler } from 'express';

export function asyncHandler<
  TReq extends Request = Request,
  TRes extends Response = Response,
>(fn: (req: TReq, res: TRes, next: NextFunction) => unknown | Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req as TReq, res as TRes, next)).catch(next);
  };
}

export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
