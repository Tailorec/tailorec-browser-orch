/**
 * API Route Types
 * 
 * Type definitions for API routes.
 */

import type { Request, Response, NextFunction } from 'express';

/**
 * Extended request with profile context
 */
export interface ProfileRequest extends Request {
  profileName?: string;
  targetId?: string;
}

/**
 * Route handler with profile context
 */
export type ProfileHandler = (
  req: ProfileRequest,
  res: Response,
  next: NextFunction,
) => Promise<void>;

/**
 * Route registration function
 */
export type RouteRegistrar = (router: any) => void;
