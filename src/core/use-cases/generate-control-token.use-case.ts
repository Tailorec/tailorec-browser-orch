/**
 * Generate control token use case
 */
import { createControlToken } from '../../shared/utils/control-token.js';

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

export class DefaultGenerateControlTokenUseCase implements GenerateControlTokenUseCase {
  async execute(request: GenerateControlTokenRequest): Promise<GenerateControlTokenResponse> {
    if (!request.runId?.trim()) {
      throw new Error('runId is required');
    }

    const result = createControlToken({
      runId: request.runId,
      browserSessionId: request.browserSessionId,
      tenantId: request.tenantId,
      userId: request.userId,
      expiresInSec: request.expiresIn,
    });

    return {
      token: result.token,
      expiresIn: result.expiresIn,
    };
  }
}
