import {test,expect} from '@playwright/test';
import {createLocalAccount} from './helpers';

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
  await page.goto(`/${locale}/pricing?billing_error=existing_subscription`);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(locale==='es'?'Ya tienes una suscripción':'You already have a subscription');
});

test('billing portal is reachable on desktop and mobile with a narrowly allowed destination',async({page},testInfo)=>{
  await createLocalAccount(page,`billing-portal-${testInfo.project.name}`);
  const response=await page.goto('/en/pricing');
  const policy=response?.headers()['content-security-policy']??'';
  expect(policy).toContain("form-action 'self' https://checkout.stripe.com https://billing.stripe.com");
  expect(policy.split(';').find(d=>d.includes('form-action'))).not.toContain('*');
  // Intercept the POST before the server: no Stripe customer or portal is created.
  await page.route('**/api/stripe/portal',async route=>{
    expect(route.request().method()).toBe('POST');
    expect(route.request().postData()).toBe('locale=en');
    await route.fulfill({status:200,contentType:'text/html',body:'<h1>Synthetic billing portal</h1>'});
  });
  await page.getByRole('button',{name:'Manage billing',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Synthetic billing portal'})).toBeVisible();
  await expect(page).toHaveURL(/\/api\/stripe\/portal$/);
});
