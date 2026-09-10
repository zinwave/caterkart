// CaterKart for Work — types only. The data and all logic now live in the
// backend (server/src/corporate) and reach the UI via /api/work/*. This file
// stays as the stable type import path for components.
export type {
  Company,
  CostCenter,
  CostCenterWithSpend,
  Employee,
  CompanyRole,
  BudgetPeriod,
  DietaryPref,
} from '../lib/workTypes';
