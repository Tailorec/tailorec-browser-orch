/**
 * Generate control token use case
 * Worktree A stub - to be implemented
 */

export interface GenerateControlTokenRequest {
  runId: string;
  browserSessionId?: string;
  tenantId?: string;
  userId?: string;
  expiresIn?: number;
}

export interface GenerateControlTokenResponse {
  token: string;
  expiresIn: number;
}

export interface GenerateControlTokenUseCase {
  execute(request: GenerateControlTokenRequest): Promise<GenerateControlTokenResponse>;
}
