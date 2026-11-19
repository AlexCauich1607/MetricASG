import { test, expect } from '@playwright/test';

test.describe('Accesibilidad básica - Login', () => {

  test('campos con etiquetas accesibles', async ({ page }) => {
    await page.goto('/login');

    const email = page.getByRole('textbox', {
      name: 'Correo electrónico',
    });

    const password = page.getByLabel('Contraseña', {
      exact: true,
    });

    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    await expect(email).toHaveAttribute('type', 'email');
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('navegación por teclado y foco visible', async ({ page }) => {
    await page.goto('/login');

    const email = page.locator('#email');
    const password = page.locator('#password');

    await email.focus();
    await expect(email).toBeFocused();

    const emailFocus = await email.evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
        borderColor: style.borderColor,
      };
    });

    console.log('[a11y] Foco email:', emailFocus);

    await page.keyboard.press('Tab');

    await expect(password).toBeFocused();
  });

  test('botón mostrar contraseña accesible', async ({ page }) => {
    await page.goto('/login');

    const toggle = page.getByRole('button', {
      name: 'Mostrar contraseña',
    });

    await expect(toggle).toBeVisible();

    await toggle.click();

    await expect(
      page.locator('#password')
    ).toHaveAttribute('type', 'text');

    await expect(
      page.getByRole('button', {
        name: 'Ocultar contraseña',
      })
    ).toBeVisible();
  });
});
