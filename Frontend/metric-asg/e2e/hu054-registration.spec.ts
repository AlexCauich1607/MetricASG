
import { test, expect } from '@playwright/test';

test.describe('HU-054 - Registro personal independiente', () => {

  test('permite registrarse sin asociar una empresa', async ({ page }) => {
    let capturedPayload: Record<string, unknown> | null = null;

    await page.route('**/api/auth/register', async route => {
      capturedPayload = route.request().postDataJSON();

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 9999,
          name: 'Usuario',
          lastname: 'Prueba',
          position: 'Analista',
          email: 'hu054-e2e@example.test',
          phone: '+5212345678910',
          company_name: null,
          role: 'user'
        })
      });
    });

    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.goto('/sing-up');

    await page.locator('#name').fill('Usuario');
    await page.locator('#lastname').fill('Prueba');
    await page.locator('#position').fill('Analista');

    await page.getByRole('button', {
      name: /Siguiente/i
    }).click();

    await page.locator('#email').fill('hu054-e2e@example.test');
    await page.locator('#phone').fill('+5212345678910');
    await page.locator('#password').fill('Password123!');
    await page.locator('#r_password').fill('Password123!');

    await page.getByRole('button', {
      name: 'Registrarse'
    }).click();

    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);

    expect(capturedPayload).not.toBeNull();

    expect(capturedPayload).toEqual({
      name: 'Usuario',
      lastname: 'Prueba',
      position: 'Analista',
      email: 'hu054-e2e@example.test',
      phone: '+5212345678910',
      password: 'Password123!'
    });

    expect(capturedPayload).not.toHaveProperty('company_name');
    expect(capturedPayload).not.toHaveProperty('company_id');
    expect(capturedPayload).not.toHaveProperty('sector_id');
    expect(capturedPayload).not.toHaveProperty('size_id');
  });

});
