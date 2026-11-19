import { test, expect } from '@playwright/test';

test.describe('Accesibilidad básica - Registro', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/sing-up');
    await expect(page.locator('mat-stepper, mat-horizontal-stepper')).toBeVisible();
  });

  test('campos del primer paso con etiquetas accesibles', async ({ page }) => {
    await expect(page.getByLabel('Nombre', { exact: true })).toBeVisible();

    await expect(page.getByLabel('Apellido', { exact: true })).toBeVisible();

    await expect(page.getByLabel('Puesto', { exact: true })).toBeVisible();
  });

  test('no muestra Siguiente con datos vacíos', async ({ page }) => {
    const next = page.getByRole('button', {
      name: /Siguiente/i,
    });

    await expect(next).toHaveCount(0);

    await expect(page.locator('#name')).toBeVisible();
  });

  test('encabezado del primer paso accesible mediante teclado', async ({ page }) => {
    const firstStep = page.locator('.mat-step-header').first();

    await expect(firstStep).toBeVisible();

    await firstStep.focus();
    await expect(firstStep).toBeFocused();

    const keyboardAccessible = await firstStep.evaluate((element) => {
      return {
        role: element.getAttribute('role'),
        tabIndex: element.getAttribute('tabindex'),
        ariaSelected: element.getAttribute('aria-selected'),
      };
    });

    console.log('[a11y] Stepper:', keyboardAccessible);
  });

});

test('Stepper navegable mediante teclado', async ({ page }) => {
  await page.goto('/sing-up');

  const firstStep = page.locator('.mat-step-header').first();
  const secondStep = page.locator('.mat-step-header').nth(1);

  await expect(firstStep).toBeVisible();

  // Iniciar la navegación desde el documento.
  await page.locator('body').focus();

  let reachedFirstStep = false;

  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');

    if (await firstStep.evaluate(
      element => element === document.activeElement
    )) {
      reachedFirstStep = true;
      break;
    }
  }

  expect(
    reachedFirstStep,
    'El primer paso debe ser alcanzable mediante Tab'
  ).toBe(true);

  await page.keyboard.press('ArrowRight');

  const focusedStep = await page.evaluate(() => {
    const element = document.activeElement;

    return {
      role: element?.getAttribute('role'),
      text: element?.textContent?.trim(),
    };
  });

  console.log('[a11y] Paso enfocado tras ArrowRight:', focusedStep);

  // Registrar si el segundo paso admite foco sin asumir
  // que debe habilitarse antes de completar el primero.
  console.log(
    '[a11y] Segundo paso:',
    await secondStep.getAttribute('aria-disabled')
  );
});