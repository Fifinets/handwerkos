import type { SupabaseClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { AUTH_DIR, SEED_FILE, type SeedData, type SeedUser } from './testData';

const PASSWORD = 'E2e-Test-Passwort-1!';

async function createUser(
  admin: SupabaseClient,
  opts: {
    email: string;
    firstName: string;
    lastName: string;
    companyId: string;
    role: 'manager' | 'employee';
    position: string;
  },
): Promise<SeedUser> {
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email: opts.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: opts.firstName,
      last_name: opts.lastName,
      company_id: opts.companyId,
      role: opts.role,
    },
  });

  if (userError || !created.user) {
    throw new Error(`auth.createUser ${opts.email}: ${userError?.message}`);
  }

  const userId = created.user.id;

  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId,
    email: opts.email,
    first_name: opts.firstName,
    last_name: opts.lastName,
    company_id: opts.companyId,
  });

  if (profileError) throw new Error(`profiles upsert: ${profileError.message}`);

  const { error: roleError } = await admin
    .from('user_roles')
    .upsert(
      {
        user_id: userId,
        role: opts.role,
      },
      { onConflict: 'user_id,role', ignoreDuplicates: true },
    );

  if (roleError) throw new Error(`user_roles upsert: ${roleError.message}`);

  const { data: employee, error: employeeError } = await admin
    .from('employees')
    .insert({
      user_id: userId,
      company_id: opts.companyId,
      first_name: opts.firstName,
      last_name: opts.lastName,
      email: opts.email,
      position: opts.position,
      status: 'active',
    })
    .select('id')
    .single();

  if (employeeError || !employee) {
    throw new Error(`employees insert: ${employeeError?.message}`);
  }

  return { email: opts.email, password: PASSWORD, userId, employeeId: employee.id };
}

export async function seedTestEnvironment(admin: SupabaseClient): Promise<SeedData> {
  const runId = Date.now().toString();
  const companyName = `E2E Test GmbH ${runId}`;

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: companyName })
    .select('id')
    .single();

  if (companyError || !company) {
    throw new Error(`companies insert: ${companyError?.message}`);
  }

  const { data: plan, error: planError } = await admin
    .from('subscription_plans')
    .upsert(
      {
        stripe_product_id: 'prod_e2e_LOCAL',
        stripe_price_id: 'price_e2e_LOCAL',
        name: 'E2E Enterprise',
        slug: 'e2e_enterprise',
        description: 'Local E2E test plan',
        price_cents: 0,
        trial_days: 14,
        features: [
          'offers',
          'invoices',
          'projects',
          'customers',
          'time_tracking',
          'materials',
          'delivery_notes',
          'employee_management',
          'site_documentation',
        ],
        max_employees: null,
        max_projects: null,
        sort_order: 999,
        is_active: true,
      },
      { onConflict: 'slug' },
    )
    .select('id')
    .single();

  if (planError || !plan) {
    throw new Error(`subscription_plans upsert: ${planError?.message}`);
  }

  const { error: subscriptionError } = await admin.from('subscriptions').insert({
    company_id: company.id,
    plan_id: plan.id,
    status: 'trialing',
    trial_start: new Date().toISOString(),
    trial_end: new Date(Date.now() + 14 * 86400_000).toISOString(),
  });

  if (subscriptionError) {
    throw new Error(`subscriptions insert: ${subscriptionError.message}`);
  }

  const manager = await createUser(admin, {
    email: `e2e-manager-${runId}@test.local`,
    firstName: 'Eva',
    lastName: 'Managerin',
    companyId: company.id,
    role: 'manager',
    position: 'Geschaeftsfuehrung',
  });

  const employee = await createUser(admin, {
    email: `e2e-monteur-${runId}@test.local`,
    firstName: 'Max',
    lastName: 'Monteur',
    companyId: company.id,
    role: 'employee',
    position: 'Monteur',
  });

  const { error: bucketError } = await admin.storage.createBucket('site-documentation', { public: false });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    throw new Error(`createBucket site-documentation: ${bucketError.message}`);
  }

  const seed: SeedData = { runId, companyId: company.id, companyName, manager, employee };
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2));

  return seed;
}
