import { z } from 'zod';

// Transaction Schema
export const Transaction = z.object({
  id: z.string(),
  postedAt: z.string().datetime(), // ISO
  amount: z.number(),
  currency: z.string().length(3),
  direction: z.enum(['debit', 'credit']),
  merchant: z.string().nullable(),
  categoryPath: z.array(z.string()), // ["Food & Dining","Delivery"]
  accountId: z.string(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

// API Response Schema
export const TransactionsResponse = z.object({
  transactions: z.array(Transaction),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

// CSV Import Schema
export const CSVTransaction = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  category: z.string().optional(),
  account: z.string().optional(),
  type: z.enum(['income', 'expense']).optional(),
});

// Type exports
export type TTransaction = z.infer<typeof Transaction>;
export type TTransactionsResponse = z.infer<typeof TransactionsResponse>;
export type TCSVTransaction = z.infer<typeof CSVTransaction>;

// Utility types
export type TransactionDirection = TTransaction['direction'];
export type Currency = TTransaction['currency'];
