import type { Request, Response, NextFunction, Express } from "express";

export type BrowserRequest = Request;
export type BrowserResponse = Response;
export type BrowserNext = NextFunction;

export type BrowserRouteRegistrar = Express;
