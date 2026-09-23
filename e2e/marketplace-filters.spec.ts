import {test,expect} from '@playwright/test';
import {createLocalAccount} from './helpers';
for(const locale of ['en','es']) {
 test(`${locale} public filters combine, persist, validate and reset`,async({page})=>{
  await page.goto(`/${locale}/listings`);
  const form=page.locator('.buyer-filters');
  await form.locator('[name=city]').fill('Oregon');
  await form.locator('[name=q]').fill('HVAC');
  await form.locator('summary').click();
  await form.locator('[name=maxPrice]').fill('1,450,000');
  await form.locator('[name=financing]').selectOption('yes');
  await form.locator('button[type=submit]').click();
  await expect(page.locator('.marketplace-card')).toHaveCount(1);
  await expect(page.locator('.marketplace-card')).toContainText('HVAC');
  await page.reload();
  await expect(form.locator('[name=city]')).toHaveValue('Oregon');
  await form.locator('[name=maxPrice]').fill('-1');
  await form.locator('button[type=submit]').click();
  await expect(page.locator('#filter-errors')).toBeVisible();
  await expect(page.locator('.marketplace-card')).toHaveCount(0);
  await form.locator('.filter-reset').click();
  await expect(page.locator('.marketplace-card')).toHaveCount(3);
  await expect(form.locator('[name=q]')).toHaveValue('');
  await form.locator('[name=sort]').selectOption('price-low');
  await form.locator('button[type=submit]').click();
  await expect(page.locator('.marketplace-card').first()).toContainText('Landscape');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await form.locator('[name=q]').focus();
  await page.keyboard.press('Tab');
  await expect(form.locator('[name=city]')).toBeFocused();
 });
}
test('signed-in marketplace uses the same combined filters and reset',async({page},info)=>{
 await createLocalAccount(page,`filters-${info.project.name}`);
 await page.goto('/en/dashboard/marketplace?city=Oregon&maxPrice=1500000&financing=yes');
 await expect(page.locator('.marketplace-card')).toHaveCount(1);
 await expect(page.locator('.marketplace-card')).toContainText('HVAC');
 await page.locator('.buyer-filters .filter-reset').click();
 await expect(page.locator('.marketplace-card')).toHaveCount(3);
 await page.goto('/en/dashboard/opportunities');
 await page.getByLabel('Search location',{exact:true}).fill('Oregon');
 await page.getByLabel('Maximum price',{exact:true}).fill('abc');
 await expect(page.locator('#search-price-error')).toBeVisible();
 await page.getByLabel('Search opportunities',{exact:true}).fill('impossible-word');
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 await expect(page.getByLabel('Search opportunities',{exact:true})).toHaveValue('');
 await expect(page.getByLabel('Search location',{exact:true})).toHaveValue('');
 await expect(page.locator('.opportunity-row').first()).toBeVisible();
});
