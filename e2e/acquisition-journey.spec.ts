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
    const progress = page.getByRole('progressbar', {name: locale === 'es' ? '0% progreso guardado' : '0% saved progress'});
    await expect(progress).toHaveAttribute('value', '0');
    await page.locator('.acquisition-plan-settings summary').click();
    await page.locator('select[name="financing"]').selectOption('cash');
    const detail = page.locator('.acquisition-task-details').first();
    await detail.locator('summary').click();
    await detail.locator('select[name="notApplicable"]').selectOption('yes');
    await detail.getByRole('button').click();
    await expect(detail.getByRole('alert')).toBeVisible();
    await expect(progress).toHaveAttribute('value','0');
    await detail.locator('input[name="assignee"]').fill('Synthetic advisor');
    await detail.locator('input[name="due"]').fill('2026-09-01');
    const expanded = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
    expect(expanded.violations.map(v=>v.id)).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth)).toBe(false);
    expect(await detail.locator('input[name="assignee"]').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.screenshot({path:testInfo.outputPath('expanded-task-details.png'),fullPage:true});
    await detail.locator('summary').click();
    await page.locator('.acquisition-plan-settings summary').click();
    expect(await page.locator('#valuation').evaluate(el => Boolean(el.compareDocumentPosition(document.querySelector('#summary')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
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
      await expect(page.locator('.acquisition-stage > h2')).toBeFocused();
      if(stage > 0) await expect(page.locator('.checklist-sequence-note')).toBeVisible();
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
    // Filling the final stage cannot bypass the seven earlier reviews.
    await expect(finish).toBeDisabled();
    await expect(progress).toHaveAttribute('value', '0');
    await page.locator('.checklist-sequence-note button').click();
    await expect(stages.first()).toHaveAttribute('aria-current', 'step');
    const firstItems=page.locator('.acquisition-stage .check-card input[type="checkbox"]');
    for (const item of await firstItems.all()) await item.check();
    await page.getByRole('button', {name: locale === 'es' ? 'Listo para continuar' : 'Ready for next step', exact: true}).click();
    const next=page.getByRole('button', {name: locale === 'es' ? 'Guardar y continuar' : 'Save and continue', exact: true});
    await expect(next).toBeEnabled();
    await next.click();
    // This presentation environment has no hosted database. A rejected save
    // must remain visibly incomplete rather than pretending persistence worked.
    await expect(page.getByText(locale==='es'?'No se guardó el progreso. Vuelve a intentarlo antes de salir.':'Progress was not saved. Retry before leaving this page.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:locale==='es'?'Lista revisada':'Checklist reviewed',exact:true})).toHaveCount(0);
    await expect(stages.first()).toHaveAttribute('aria-current', 'step');
    await expect(progress).toHaveAttribute('value', '0');
    await firstItems.first().uncheck();
    await expect(next).toBeDisabled();
    await expect(page.getByText('Purchase complete',{exact:true})).toHaveCount(0);
  });
}
