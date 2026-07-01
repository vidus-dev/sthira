import { z } from 'zod';

// Account Schema
export const Account = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['checking', 'credit_card', 'loan', 'brokerage', 'wallet']),
  currency: z.string().length(3),
  balance: z.number(),
  isActive: z.boolean().default(true),
  lastUpdated: z.string().datetime(),
});

// API Response Schema
export const AccountsResponse = z.object({
  accounts: z.array(Account),
  total: z.number(),
});

// Type exports
export type TAccount = z.infer<typeof Account>;
export type TAccountsResponse = z.infer<typeof AccountsResponse>;

// Utility types
export type AccountType = TAccount['type'];
