
import { test, expect } from '@playwright/test';

test.describe('HU-051 - Sidebar administrativo', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({
            width: 365,
            height: 900
        });

        // Sesión simulada exclusivamente para la prueba.
        await page.addInitScript(() => {
            sessionStorage.setItem(
                'token',
                JSON.stringify('e2e-test-token')
            );

            sessionStorage.setItem(
                'role',
                JSON.stringify('admin')
            );
        });
    });

    test('permite abrir y cerrar el sidebar con teclado', async ({ page }) => {
        await page.goto('/admin/dashboard', {
            waitUntil: 'domcontentloaded'
        });

        await expect(
            page.locator('#admin-sidebar-navigation')
        ).toBeAttached();

        const trigger = page.locator(
            '[aria-controls="admin-sidebar-navigation"]'
        );

        const sidebar = page.locator(
            '#admin-sidebar-navigation'
        );

        const closeButton = sidebar.getByRole('button', {
            name: 'Cerrar menú administrativo'
        });

        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(sidebar).toHaveAttribute('inert', '');

        await trigger.focus();
        await page.keyboard.press('Enter');

        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(sidebar).not.toHaveAttribute('inert');

        await expect(closeButton).toBeFocused();

        await page.keyboard.press('Escape');

        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toBeFocused();
        await expect(sidebar).toHaveAttribute('inert', '');
    });


    test('mantiene el foco dentro del sidebar abierto', async ({ page }) => {
        await page.goto('/admin/dashboard', {
            waitUntil: 'domcontentloaded'
        });

        const trigger = page.locator(
            '[aria-controls="admin-sidebar-navigation"]'
        );

        const sidebar = page.locator(
            '#admin-sidebar-navigation'
        );

        const closeButton = sidebar.getByRole('button', {
            name: 'Cerrar menú administrativo'
        });

        // 1. Verificar que el menú está inicialmente cerrado.
        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        // 2. Abrir el sidebar.
        await trigger.click();

        await expect(sidebar).toHaveClass(/open/);
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');

        // 3. Verificar que el foco se mueve al botón de cierre.
        await expect(closeButton).toBeFocused();

        // 4. Shift + Tab desde el primer control debe ir al último.
        await page.keyboard.press('Shift+Tab');

        const logoutButton = sidebar.getByRole('button', {
            name: /Cerrar Sesión/i
        });

        await expect(logoutButton).toBeFocused();

        // 5. Tab desde el último control debe volver al primero.
        await page.keyboard.press('Tab');

        await expect(closeButton).toBeFocused();

        // 6. Escape debe cerrar el menú y devolver el foco.
        await page.keyboard.press('Escape');

        await expect(sidebar).not.toHaveClass(/open/);
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toBeFocused();

        // 7. El sidebar cerrado no debe permitir navegación por teclado.
        await expect(sidebar).toHaveAttribute('inert', '');
    });


    test('cierra el sidebar mediante el overlay', async ({ page }) => {
        await page.goto('/admin/dashboard', {
            waitUntil: 'domcontentloaded'
        });

        await expect(
            page.locator('#admin-sidebar-navigation')
        ).toBeAttached();

        const trigger = page.locator(
            '[aria-controls="admin-sidebar-navigation"]'
        );

        await trigger.click();

        await expect(trigger).toHaveAttribute('aria-expanded', 'true');

        await page.locator('.sidebar-overlay').click({
            position: { x: 340, y: 200 }
        });

        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
});
