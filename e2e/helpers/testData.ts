import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SeedUser {
  email: string;
  password: string;
  userId: string;
  employeeId: string;
}

export interface SeedData {
  runId: string;
  companyId: string;
  companyName: string;
  manager: SeedUser;
  employee: SeedUser;
}

const currentDir = dirname(fileURLToPath(import.meta.url));

export const AUTH_DIR = join(currentDir, '..', '.auth');
export const SEED_FILE = join(AUTH_DIR, 'seed.json');
export const MANAGER_STATE = join(AUTH_DIR, 'manager.json');
export const EMPLOYEE_STATE = join(AUTH_DIR, 'employee.json');

export function loadSeed(): SeedData {
  return JSON.parse(readFileSync(SEED_FILE, 'utf8')) as SeedData;
}
