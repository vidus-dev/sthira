import { z } from 'zod';

// Investment/Mutual Fund Schema
export const Investment = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['mutual_fund', 'etf', 'stock', 'bond', 'crypto']),
  symbol: z.string().optional(),
  category: z.string(),
  invested: z.number(),
  currentValue: z.number(),
  units: z.number(),
  nav: z.number(), // Net Asset Value
  returns: z.number(), // Percentage returns
  riskLevel: z.enum(['low', 'medium', 'high']),
  lastUpdated: z.string().datetime(),
});

// Portfolio Schema
export const Portfolio = z.object({
  id: z.string(),
  name: z.string(),
  investments: z.array(Investment),
  totalInvested: z.number(),
  totalCurrentValue: z.number(),
  totalReturns: z.number(),
  lastUpdated: z.string().datetime(),
});

// API Response Schemas
export const InvestmentsResponse = z.object({
  investments: z.array(Investment),
  total: z.number(),
});

export const PortfoliosResponse = z.object({
  portfolios: z.array(Portfolio),
  total: z.number(),
});

// Type exports
export type TInvestment = z.infer<typeof Investment>;
export type TPortfolio = z.infer<typeof Portfolio>;
export type TInvestmentsResponse = z.infer<typeof InvestmentsResponse>;
export type TPortfoliosResponse = z.infer<typeof PortfoliosResponse>;

// Utility types
export type InvestmentType = TInvestment['type'];
export type RiskLevel = TInvestment['riskLevel'];
