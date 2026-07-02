import { api } from './client';
import type { ApiResponse } from '@portfolioos/shared';

function unwrap<T>(r: ApiResponse<T>): T {
  if (!r.success) throw new Error(r.error);
  return r.data;
}

export interface SalaryIncomeDTO {
  id: string;
  employerName: string;
  monthlyAmount: string;
  payDay: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryIncomeInput {
  employerName: string;
  monthlyAmount: string | number;
  payDay?: number;
  isActive?: boolean;
  notes?: string | null;
}

export const incomeApi = {
  async list(): Promise<SalaryIncomeDTO[]> {
    const { data } = await api.get<ApiResponse<SalaryIncomeDTO[]>>('/api/income');
    return unwrap(data);
  },
  async get(id: string): Promise<SalaryIncomeDTO> {
    const { data } = await api.get<ApiResponse<SalaryIncomeDTO>>(`/api/income/${id}`);
    return unwrap(data);
  },
  async create(input: SalaryIncomeInput): Promise<SalaryIncomeDTO> {
    const { data } = await api.post<ApiResponse<SalaryIncomeDTO>>('/api/income', input);
    return unwrap(data);
  },
  async update(id: string, input: Partial<SalaryIncomeInput>): Promise<SalaryIncomeDTO> {
    const { data } = await api.patch<ApiResponse<SalaryIncomeDTO>>(`/api/income/${id}`, input);
    return unwrap(data);
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/api/income/${id}`);
  },
};
