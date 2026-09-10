import AxeBuilder from "@axe-core/playwright";
import {expect,test} from "@playwright/test";
import {createLocalAccount} from "./helpers";

// Browser presentation coverage. Hosted data writes are tested separately;
// this deliberately does not pretend the isolated local account is Supabase.
for (const locale of ["en","es"]) {
  test(`all eight acquisition stages are readable and accessible (${locale})`,async({page},testInfo)=>{
    await createLocalAccount(page,`journey-${locale}-${testInfo.project.name}`);
    await page.goto(`/${locale}/dashboard/opportunities/precision-heat-air`);
    const start=page.locator('.begin-panel button');
    if(await start.count())await start.click();
    const stages=page.locator('.acquisition-steps button');
    await expect(stages).toHaveCount(8);
    await page.locator('.skip-link').click();
    const dialog=page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button').first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button').last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.skip-link')).toBeFocused();
    for(let stage=0;stage<8;stage++){
      await stages.nth(stage).click();
      await expect(stages.nth(stage)).toHaveAttribute('aria-current','step');
      const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      expect(results.violations.map(v=>v.id+': '+v.nodes.map(n=>n.target.join(' ')).join(',')),`Stage ${stage+1}`).toEqual([]);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),`Stage ${stage+1} overflow`).toBe(false);
      await page.screenshot({path:testInfo.outputPath(`stage-${stage+1}.png`),fullPage:true});
    }
    await expect(page.getByText('Purchase complete',{exact:true})).toHaveCount(0);
    await expect(page.locator('.acquisition-workspace a[href$="/dashboard/workforce/setup"]')).toBeVisible();
    const finish=page.getByRole('button',{name:locale==='es'?'Finalizar revisión de la lista':'Finish checklist review',exact:true});
    await expect(finish).toBeDisabled();
    const finalItems=page.locator('.acquisition-stage .check-card input[type="checkbox"]');
    for(const item of await finalItems.all()) await item.check();
    await page.getByRole('button',{name:locale==='es'?'Revisión terminada':'Review finished',exact:true}).click();
    await expect(finish).toBeEnabled();
    await finish.click();
    await expect(page.getByRole('button',{name:locale==='es'?'Lista revisada':'Checklist reviewed',exact:true})).toBeDisabled();
    await finalItems.first().uncheck();
    await expect(finish).toBeDisabled();
    await expect(page.getByText('Purchase complete',{exact:true})).toHaveCount(0);
  });
}
