import { z } from 'zod';

// Budget Schema
export const Budget = z.object({
  id: z.string(),
  name: z.string(),
  categoryPath: z.array(z.string()),
  amount: z.number(),
  currency: z.string().length(3),
  period: z.enum(['monthly', 'weekly', 'yearly']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  rules: z.array(z.object({
    type: z.enum(['merchant', 'category', 'amount']),
    value: z.string(),
    operator: z.enum(['equals', 'contains', 'starts_with', 'greater_than', 'less_than']),
  })).default([]),
});

// API Response Schema
export const BudgetsResponse = z.object({
  budgets: z.array(Budget),
  total: z.number(),
});

// Type exports
export type TBudget = z.infer<typeof Budget>;
export type TBudgetsResponse = z.infer<typeof BudgetsResponse>;

// Utility types
export type BudgetPeriod = TBudget['period'];
