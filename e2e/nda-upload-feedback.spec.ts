import {expect,test} from '@playwright/test';
import {createLocalAccount} from './helpers';

test('NDA upload is explicit and selected filename is visible',async({page},info)=>{
  await createLocalAccount(page,`nda-feedback-${info.project.name}`);
  for(const locale of ['en','es']){
    await page.goto(`/${locale}/dashboard/listings?new=1`);
    const picker=page.locator('.nda-file-picker').first();
    await expect(picker.getByRole('button',{name:locale==='es'?'Subir NDA PDF':'Upload NDA PDF',exact:true})).toBeVisible();
    await picker.locator('input[type=file]').setInputFiles('e2e/fixtures/synthetic.pdf');
    await expect(picker.getByRole('status')).toContainText('synthetic.pdf');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    await page.goto(`/${locale}/dashboard/listings?error=nda_exists`);
    await expect(page.getByRole('status')).toContainText(locale==='es'?'ya tiene un NDA guardado':'already has a saved NDA');
    await expect(page.getByText('We could not save that listing.',{exact:false})).toHaveCount(0);
    await page.goto(`/${locale}/dashboard/listings?error=nda_lookup`);
    await expect(page.getByText(locale==='es'?'No pudimos comprobar el NDA existente.':'We could not check the existing NDA.',{exact:false})).toBeVisible();
  }
});
