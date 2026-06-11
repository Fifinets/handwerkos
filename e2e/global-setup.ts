import { createAdminClient } from './helpers/localSupabase';
import { seedTestEnvironment } from './helpers/seed';

export default async function globalSetup() {
  const admin = createAdminClient();
  const seed = await seedTestEnvironment(admin);
  console.log(`[e2e] Seeded company "${seed.companyName}" (${seed.companyId})`);
  console.log(`[e2e] Manager: ${seed.manager.email} / Mitarbeiter: ${seed.employee.email}`);
}
