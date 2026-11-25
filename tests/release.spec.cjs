const { test, expect } = require('@playwright/test');

test('roeitraining, weekdoel en verwijdering blijven bewaard', async ({ page }) => {
  await page.goto('http://localhost:4173');
  await expect(page.getByText('Opgeslagen op dit apparaat', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Training toevoegen' }).click();
  await page.getByLabel('Afstand in kilometers', { exact: true }).fill('7,5');
  await page.getByLabel('Wat heb je gedaan?', { exact: true }).fill('Rustig geroeid met drie versnellingen.');
  await page.getByLabel('Duur in minuten', { exact: true }).fill('45');
  await page.getByRole('button', { name: 'Training bewaren' }).click();
  await expect(page.getByText('Totaal: 7,5 km', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Doel aanpassen' }).click();
  await page.getByLabel('Aantal trainingen per week', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Weekdoel bewaren' }).click();
  await expect(page.getByText('Opgeslagen op dit apparaat', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('3 trainingen per week', { exact: true })).toBeVisible();
  await expect(page.getByText('Totaal: 7,5 km', { exact: true })).toBeVisible();
  await expect(page.getByText('Rustig geroeid met drie versnellingen.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'release-preview.png', fullPage: true });
  await page.getByRole('button', { name: 'Verwijder Roeien', exact: true }).click();
  await expect(page.getByText('Opgeslagen op dit apparaat', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Totaal: 0 km', { exact: true })).toBeVisible();
});
