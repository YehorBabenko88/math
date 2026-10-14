import {test,expect} from '@playwright/test';
async function canvasSignature(page){
 return page.locator('#equationPlot').evaluate(canvas=>{
  const ctx=canvas.getContext('2d'),{data}=ctx.getImageData(0,0,canvas.width,canvas.height);
  let hash=2166136261;for(let i=0;i<data.length;i+=4){hash=Math.imul(hash^data[i],16777619);hash=Math.imul(hash^data[i+1],16777619);hash=Math.imul(hash^data[i+2],16777619)}
  return hash>>>0;
 });
}
test('canvas changes when equation changes and recovers after syntax error',async({page})=>{
 await page.goto('/');
 await expect(page.locator('#equationStatus')).toContainText('треугольников');
 const sphere=await canvasSignature(page);
 await page.locator('#equationInput').fill('x+z=0');
 await page.locator('#equationSecond').fill('');
 await page.locator('#equationRender').click();
 await expect(page.locator('#equationStatus')).toContainText('треугольников');
 const plane=await canvasSignature(page);expect(plane).not.toBe(sphere);
 await page.locator('#equationInput').fill('window.alert(1)=0');
 await page.locator('#equationRender').click();
 await expect(page.locator('#equationStatus')).toContainText('Ошибка уравнения');
 await page.locator('#equationInput').fill('x^2+y^2+z^2=1');
 await page.locator('#equationRender').click();
 await expect(page.locator('#equationStatus')).toContainText('треугольников');
});
test('camera drag changes rendered pixels and reset restores view',async({page})=>{
 await page.goto('/');
 await page.locator('#equationInput').fill('x+2*y+3*z=0');
 await page.locator('#equationSecond').fill('');
 await page.locator('#equationRender').click();
 await expect(page.locator('#equationStatus')).toContainText('треугольников');
 const original=await canvasSignature(page);
 const canvas=page.locator('#equationPlot'),box=await canvas.boundingBox();expect(box).not.toBeNull();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
 await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.6,{steps:6});await page.mouse.up();
 const moved=await canvasSignature(page);expect(moved).not.toBe(original);
 await page.locator('#cameraReset').click();
 await expect.poll(()=>canvasSignature(page)).toBe(original);
});
