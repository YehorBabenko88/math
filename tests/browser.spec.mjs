import {test,expect} from '@playwright/test';
test('loads mathematical laboratory and draws implicit surfaces',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.locator('#sceneList')).not.toBeEmpty();
 await expect(page.locator('#bookScene option')).toHaveCount(4);
 await expect(page.locator('#equationStatus')).toContainText('треугольников');
 await page.locator('#equationInput').fill('x^2+y^2+z^2=1');
 await page.locator('#equationSecond').fill('z=0');
 await page.getByRole('button',{name:'Построить'}).click();
 await expect(page.locator('#equationStatus')).toContainText('приближённых точек пересечения');
 expect(errors).toEqual([]);
});
test('invalid expressions report errors without executing code',async({page})=>{
 await page.goto('/');
 await page.locator('#equationInput').fill('window.alert(1)=0');
 await page.getByRole('button',{name:'Построить'}).click();
 await expect(page.locator('#equationStatus')).toContainText('Ошибка уравнения');
});
test('camera, opacity, intersection and animation controls respond',async({page})=>{
 await page.goto('/');
 await page.locator('#surfaceOpacity').fill('0.25');
 await page.locator('#showIntersections').uncheck();
 await page.locator('#equationPlot').hover();
 await page.mouse.down();await page.mouse.move(400,250,{steps:5});await page.mouse.up();
 await page.getByRole('button',{name:'Сброс камеры'}).click();
 await page.getByRole('button',{name:'Воспроизвести'}).click();
 await expect(page.getByRole('button',{name:'Пауза'})).toBeVisible();
 await page.getByRole('button',{name:'Пауза'}).click();
 await expect(page.getByRole('button',{name:'Воспроизвести'})).toBeVisible();
});

test('3D Build button rebuilds after invalid equation and clears stale canvas',async({page})=>{
 await page.goto('/');
 const first=page.locator('#equationInput'),second=page.locator('#equationSecond'),status=page.locator('#equationStatus');
 await first.fill('x^2+y^2+z^2=1');await second.fill('z=0');
 await page.locator('#equationQuality').selectOption('12');
 await page.locator('#equationRender').click();
 await expect(status).toContainText('Построено за');
 await first.fill('x²+y²+z²=1');
 await page.locator('#equationRender').click();
 await expect(status).toContainText('Предыдущее построение очищено');
 await first.fill('x^2+y^2+z^2=1');
 await page.locator('#equationQuality').selectOption('28');
 await page.locator('#equationRender').click();
 await expect(status).toContainText('Построено за');
});
