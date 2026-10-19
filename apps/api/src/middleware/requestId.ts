import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { traceIdFor } from "@repo/logger";

export const REQUEST_ID_HEADER = "x-request-id";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      traceId: string;
    }
  }
}

export function requestId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const inbound = req.header(REQUEST_ID_HEADER);
    const id = inbound && inbound.length <= 200 ? inbound : randomUUID();
    req.requestId = id;
    req.traceId = traceIdFor(id);
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  };
}
