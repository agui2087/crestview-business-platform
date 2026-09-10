import { expect,test } from '@playwright/test';
import { createLocalAccount } from './helpers';

test('Workforce CSV preview checks the file before enabling import',async({page},testInfo)=>{
  await createLocalAccount(page,`workforce-import-${testInfo.project.name}`);
  await page.goto('/en/dashboard/workforce');
  const button=page.getByRole('button',{name:'Confirm import'});
  await expect(button).toBeDisabled();
  const upload=page.getByLabel('CSV file');
  await upload.setInputFiles({name:'employees.csv',mimeType:'text/csv',buffer:Buffer.from('full_name,department,preferred_locale\n"Doe, Jane",Operations,es')});
  await expect(page.getByRole('status')).toContainText('1 profiles ready to add');
  await expect(page.getByRole('status')).toContainText('Doe, Jane');
  await expect(button).toBeEnabled();
  await upload.setInputFiles({name:'broken.csv',mimeType:'text/csv',buffer:Buffer.from('full_name\n"Unclosed')});
  await expect(page.getByRole('alert').filter({hasText:'Cannot import'})).toBeVisible();
  await expect(button).toBeDisabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
