import { expect, type Page, test as setup } from '@playwright/test';
import { EMPLOYEE_STATE, loadSeed, MANAGER_STATE } from './helpers/testData';

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Jetzt anmelden' }).click();
  await page.waitForURL('**/manager2', { timeout: 20_000 });
}

setup('login manager', async ({ page }) => {
  const seed = loadSeed();
  await login(page, seed.manager.email, seed.manager.password);
  await page.context().storageState({ path: MANAGER_STATE });
});

setup('login employee', async ({ page }) => {
  const seed = loadSeed();
  await login(page, seed.employee.email, seed.employee.password);
  await page.goto('/employee');
  await expect(page.getByText('Wird geladen...').first()).toBeHidden({ timeout: 15_000 });
  await page.context().storageState({ path: EMPLOYEE_STATE });
});
