import {test,expect} from '@playwright/test';
test('scientific benchmark displays baseline and torus comparisons',async({page})=>{await page.goto('/');await page.locator('#benchmarkRun').click();await expect(page.locator('#benchmarkStatus')).toContainText('persistence: RMSE',{timeout:15000});await expect(page.locator('#benchmarkStatus')).toContainText('torusSurface: RMSE')});
