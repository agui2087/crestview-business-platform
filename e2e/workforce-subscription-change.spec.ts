import {test, expect} from '@playwright/test';
import {createLocalAccount} from './helpers';
import AxeBuilder from '@axe-core/playwright';

for (const locale of ['en', 'es']) test(`${locale} existing Workforce subscriber can review seat changes`, async ({page}, info) => {
  await createLocalAccount(page, `seats-${locale}-${info.project.name}`);
  await page.goto(`/${locale}/pricing`);
  const panel = page.locator('#workforce-manage');
  await panel.locator('summary').focus();
  await page.keyboard.press('Enter');
  const button = panel.getByRole('button');
  await expect(button).toBeVisible();
  await expect(panel).toContainText(locale === 'es' ? 'no elimina registros' : 'never deletes records');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).include('#workforce-manage').analyze()).violations).toEqual([]);
  await page.route('**/api/stripe/portal', async route => {
    const data = new URLSearchParams(route.request().postData() ?? '');
    expect(data.get('intent')).toBe('workforce_seats');
    expect(data.get('locale')).toBe(locale);
    expect(data.has('customer')).toBe(false);
    expect(data.has('subscription')).toBe(false);
    await route.fulfill({status: 200, contentType: 'text/html', body: '<h1>Synthetic portal handoff</h1>'});
  });
  await button.click();
  await expect(page.getByRole('heading', {name: 'Synthetic portal handoff'})).toBeVisible();
});
