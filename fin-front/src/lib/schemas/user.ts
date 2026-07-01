import { z } from 'zod';

// User Preferences Schema
export const UserPreferences = z.object({
  baseCurrency: z.string().length(3).default('INR'),
  dateFormat: z.string().default('DD/MM/YYYY'),
  numberFormat: z.string().default('en-IN'),
  hideBalances: z.boolean().default(false),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  notifications: z.object({
    budgetAlerts: z.boolean().default(true),
    transactionAlerts: z.boolean().default(true),
    weeklyReports: z.boolean().default(false),
  }),
});

// Category hierarchy
export const CATEGORIES = {
  'Food & Dining': ['Restaurants', 'Delivery', 'Groceries', 'Coffee'],
  'Transportation': ['Gas', 'Public Transport', 'Rideshare', 'Parking'],
  'Shopping': ['Clothing', 'Electronics', 'Home & Garden', 'General'],
  'Entertainment': ['Movies', 'Games', 'Streaming', 'Events'],
  'Bills & Utilities': ['Electricity', 'Water', 'Internet', 'Phone'],
  'Healthcare': ['Doctor', 'Pharmacy', 'Insurance', 'Fitness'],
  'Education': ['Tuition', 'Books', 'Courses', 'Supplies'],
  'Travel': ['Flights', 'Hotels', 'Transportation', 'Activities'],
  'Income': ['Salary', 'Freelance', 'Investment', 'Gift'],
  'Others': ['Miscellaneous', 'Transfer', 'Refund'],
} as const;

// Type exports
export type TUserPreferences = z.infer<typeof UserPreferences>;
export type CategoryKey = keyof typeof CATEGORIES;
export type SubCategory = typeof CATEGORIES[CategoryKey][number];
