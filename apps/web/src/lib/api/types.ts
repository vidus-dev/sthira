/**
 * Convenience aliases over the auto-generated OpenAPI types.
 *
 * `schema.d.ts` is generated from the backend's OpenAPI document
 * (`npm run gen:api-types`) and is the single source of truth for the API
 * contract — never edit it by hand. Import domain types from here so the web
 * app stays in lockstep with the server and no longer hand-duplicates shapes.
 */
import type { components } from "./schema";

export type Schemas = components["schemas"];

// Accounts
export type AccountRead = Schemas["AccountRead"];
export type AccountCreate = Schemas["AccountCreate"];
export type AccountUpdate = Schemas["AccountUpdate"];

// Transactions
export type TransactionRead = Schemas["TransactionRead"];
export type TransactionCreate = Schemas["TransactionCreate"];
export type TransactionUpdate = Schemas["TransactionUpdate"];

// Budgets
export type BudgetRead = Schemas["BudgetRead"];
export type BudgetCreate = Schemas["BudgetCreate"];
export type BudgetUpdate = Schemas["BudgetUpdate"];

// Goals
export type FinancialGoalRead = Schemas["FinancialGoalRead"];
export type FinancialGoalCreate = Schemas["FinancialGoalCreate"];
export type FinancialGoalUpdate = Schemas["FinancialGoalUpdate"];
export type FinancialGoalPlan = Schemas["FinancialGoalPlan"];

// Auth
export type LoginBody = Schemas["LoginBody"];
export type RegisterBody = Schemas["RegisterBody"];
export type SessionResponse = Schemas["SessionResponse"];
export type UserPublic = Schemas["UserPublic"];
