import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for(const locale of ['en','es'])test(`password recovery is accessible and invalid links fail closed (${locale})`,async({page})=>{
  await page.goto(`/${locale}/recover-password`);
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveAttribute('type','email');
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
  await page.goto(`/${locale}/reset-password?error=expired`);
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.goto(`/auth/recovery?locale=${locale}&code=invalid-synthetic-code&next=https://evil.invalid`);
  await expect(page).toHaveURL(new RegExp(`/${locale}/reset-password\\?error=expired$`));
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});
