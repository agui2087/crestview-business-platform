import {test,expect} from '@playwright/test';
for(const locale of ['en','es'])test(`${locale} exact employee count updates price and submitted quantity`,async({page})=>{
  await page.goto(`/${locale}/pricing`);
  const count=page.locator('#workforce-quantity');
  for(const [seats,total] of [['4','$8.00'],['5','$10.00'],['11','$22.00']]){
    await count.fill(seats);await expect(page.locator('#workforce-total')).toContainText(total);
  }
  await page.route('**/api/stripe/checkout',async route=>{
    const body=new URLSearchParams(route.request().postData()??'');
    expect(body.get('quantity')).toBe('11');expect(body.get('product_code')).toBe('workforce');
    await route.fulfill({status:200,contentType:'text/html',body:'<h1>Test quantity accepted</h1>'});
  });
  await page.getByRole('button',{name:locale==='es'?'Elegir Workforce':'Choose Workforce',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Test quantity accepted'})).toBeVisible();
});
