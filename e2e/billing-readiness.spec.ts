import {test,expect} from '@playwright/test';

for(const locale of ['en','es'])test(`${locale} pricing separates available subscriptions from undelivered products`,async({page})=>{
  await page.goto(`/${locale}/pricing?checkout=success`);
  const unavailable=page.getByRole('button',{name:locale==='es'?'Aún no disponible':'Not yet available',exact:true});
  await expect(unavailable).toHaveCount(3);
  for(const button of await unavailable.all())await expect(button).toBeDisabled();
  for(const code of ['single_listing','enhanced_visibility','highest_visibility'])
    await expect(page.locator(`form input[name="product_code"][value="${code}"]`)).toHaveCount(0);
  await expect(page.locator('form input[value="broker_plan"]')).toHaveCount(1);
  await expect(page.getByText(locale==='es'?'Regresaste de la página de pago':'You returned from checkout',{exact:true})).toBeVisible();
  await expect(page.getByText('Payment received',{exact:true})).toHaveCount(0);
});
