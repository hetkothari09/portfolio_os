import { api } from './client';
import type { ApiResponse } from '@portfolioos/shared';

export interface HealthSubScore {
  score: number;
  insight: string;
  action: string;
}

export interface HealthScoreResult {
  overallScore: number;
  grade: string;
  subScores: {
    emergencyFund: HealthSubScore;
    investmentRate: HealthSubScore;
    debtBurden: HealthSubScore;
    diversification: HealthSubScore;
    insurance: HealthSubScore;
    goalProgress: HealthSubScore;
  };
  computedAt: string;
}

function unwrap<T>(data: ApiResponse<T>): T {
  if (!data.success) throw new Error(data.error);
  return data.data;
}

export const intelligenceApi = {
  async healthScore(force = false): Promise<HealthScoreResult> {
    const { data } = await api.get<ApiResponse<HealthScoreResult>>('/api/intelligence/health-score', {
      params: force ? { force: 'true' } : undefined,
    });
    return unwrap(data);
  },
};
