export type {
  DataService,
  PaginatedResult,
  ClaimResult,
  CompleteResult,
} from './data-service'
export { createMockDataService } from './mock-data-service'

// Factory — swap this import to use a real Supabase service later
export { createMockDataService as getDataService } from './mock-data-service'
