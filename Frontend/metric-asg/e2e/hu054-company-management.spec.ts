
import { test, expect, Page, Route } from '@playwright/test';

type Role =
    | 'COMPANY_ADMIN'
    | 'ASG_MANAGER'
    | 'COLLABORATOR'
    | 'AUDITOR';

interface Membership {
    membership_id: number;
    company_id: number;
    company_name: string;
    role: Role;
    joined_at: string;
}

const companyId = 501;

function membership(role: Role): Membership {
    return {
        membership_id: 1001,
        company_id: companyId,
        company_name: 'Empresa E2E',
        role,
        joined_at: '2026-11-21T10:00:00'
    };
}

async function mockSession(
    page: Page,
    selectedCompanyId: number | null = null
) {
    await page.addInitScript((selectedId) => {
        sessionStorage.setItem(
            'token',
            JSON.stringify('token-e2e-ficticio')
        );
        sessionStorage.setItem('role', JSON.stringify('user'));
        sessionStorage.setItem('user', JSON.stringify('Usuario E2E'));
        sessionStorage.setItem('id', JSON.stringify(9001));

        const key = 'metricasg-selected-company-id';

        if (selectedId === null) {
            sessionStorage.removeItem(key);
        } else {
            sessionStorage.setItem(key, String(selectedId));
        }
    }, selectedCompanyId);
}

async function mockApi(
    page: Page,
    getMemberships: () => Membership[],
    onCreate?: (body: Record<string, unknown>) => void
) {
    await page.route('**/api/**', async (route: Route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.replace(/\/$/, '');

        const respond = async (
            data: unknown,
            status = 200
        ) => route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(data)
        });

        if (
            path === '/api/companies/me/memberships' &&
            request.method() === 'GET'
        ) {
            return respond(getMemberships());
        }

        if (
            path === '/api/companies' &&
            request.method() === 'POST'
        ) {
            const body = request.postDataJSON();
            onCreate?.(body);

            return respond({
                id: companyId,
                name: body.name,
                sector_id: null,
                size_id: null
            }, 201);
        }

        if (
            path === '/api/company-sectors' ||
            path === '/api/company-sizes'
        ) {
            return respond([]);
        }
        if (
            path === '/api/evaluations/results/me' &&
            request.method() === 'GET'
        ) {
            return respond(
                { detail: 'No evaluations found' },
                404
            );
        }

        if (
            path === `/api/companies/${companyId}` &&
            request.method() === 'GET'
        ) {
            return respond({
                id: companyId,
                name: 'Empresa E2E',
                sector_id: null,
                size_id: null
            });
        }

        if (
            path === `/api/companies/${companyId}/members` &&
            request.method() === 'GET'
        ) {
            return respond([]);
        }

        // Evita llamadas a la API real en el entorno E2E.
        return respond([]);
    });
}

test.describe('HU-054 - Gestión empresarial', () => {

    test('usuario sin empresa puede acceder al inicio', async ({ page }) => {
        await mockSession(page);
        await mockApi(page, () => []);

        await page.goto('/user/home');

        await expect(page).toHaveURL(/\/user\/home$/);

        const trigger = page.locator('.company-context__trigger');

        // El selector debe mostrar el estado sin empresa.
        await expect(trigger).toBeVisible();
        await expect(trigger).toContainText('Sin empresa');
        await expect(trigger).toContainText('Configura tu primera empresa');

        // Abrir el selector empresarial.
        await trigger.click();

        // No debe haber opciones de membresías.
        await expect(
            page.locator('.company-context__option')
        ).toHaveCount(0);

        // Debe mostrar el estado vacío.
        await expect(
            page.locator('.company-context__empty')
        ).toContainText('Todavía no perteneces a ninguna empresa.');

        // La acción de creación debe estar disponible.
        const createButton = page.locator('.company-context__create');

        await expect(createButton).toBeVisible();
        await expect(createButton).toBeEnabled();
    });

    test('usuario sin empresa no puede acceder a evaluación', async ({ page }) => {
        await mockSession(page);
        await mockApi(page, () => []);

        await page.goto('/user/evaluation');

        await expect(page).toHaveURL(/\/user\/home$/);
    });

    test('crea empresa sin sector ni tamaño y actualiza selección', async ({ page }) => {
        let currentMemberships: Membership[] = [];
        let capturedPayload: Record<string, unknown> | null = null;

        await mockSession(page);

        await mockApi(
            page,
            () => currentMemberships,
            body => {
                capturedPayload = body;
                currentMemberships = [
                    membership('COMPANY_ADMIN')
                ];
            }
        );

        await page.goto('/user/home');

        // Abrir el selector empresarial.
        await page.locator('.company-context__trigger').click();

        // Crear una empresa desde el desplegable.
        await page.locator('.company-context__create').click();

        await expect(
            page.locator('#company-name')
        ).toBeVisible();


        await page.locator('#company-name').fill('Empresa E2E');

        // Sector y tamaño son opcionales.
        // Verificamos sus valores iniciales sin modificarlos.
        await expect(
            page.locator('#company-sector option:checked')
        ).toHaveText('Sin especificar');

        await expect(
            page.locator('#company-size option:checked')
        ).toHaveText('Sin especificar');


        await page.getByRole('dialog').getByRole('button', {
            name: 'Crear empresa'
        }).click();

        // La nueva empresa debe quedar seleccionada.
        const trigger = page.locator('.company-context__trigger');

        await expect(trigger).toContainText('Empresa E2E');
        await expect(trigger).toContainText('Administrador empresarial');

        // Comprobar la membresía activa.
        await trigger.click();

        const selectedOption = page.locator('.company-context__option.active');

        await expect(selectedOption).toContainText('Empresa E2E');
        await expect(selectedOption).toHaveAttribute('aria-current', 'true');

        expect(capturedPayload).toEqual({
            name: 'Empresa E2E'
        });

        await expect.poll(
            () => page.evaluate(() =>
                sessionStorage.getItem('metricasg-selected-company-id')
            )
        ).toBe(String(companyId));
    });

    test('colaborador no puede acceder a administración de miembros', async ({ page }) => {
        await mockSession(page, companyId);
        await mockApi(page, () => [
            membership('COLLABORATOR')
        ]);

        await page.goto('/user/members');

        await expect(page).toHaveURL(/\/user\/home$/);
    });

    test('administrador con membresía válida puede acceder a miembros', async ({ page }) => {
        await mockSession(page, companyId);
        await mockApi(page, () => [
            membership('COMPANY_ADMIN')
        ]);

        await page.goto('/user/members');

        await expect(page).toHaveURL(/\/user\/members$/);
    });
    test('permite cambiar entre empresas con roles diferentes', async ({ page }) => {
        const memberships: Membership[] = [
            {
                membership_id: 1001,
                company_id: 501,
                company_name: 'Empresa Administradora',
                role: 'COMPANY_ADMIN',
                joined_at: '2026-11-21T10:00:00'
            },
            {
                membership_id: 1002,
                company_id: 502,
                company_name: 'Empresa Colaboradora',
                role: 'COLLABORATOR',
                joined_at: '2026-11-21T11:00:00'
            }
        ];

        await mockSession(page, 501);





        await mockApi(page, () => memberships);

        await page.goto('/user/home');

        await expect(
            page.locator('.company-context__trigger')
        ).toBeVisible({ timeout: 10000 });

        const trigger = page.locator('.company-context__trigger');

        // Verificar el contexto inicial.
        await expect(trigger).toContainText('Empresa Administradora');
        await expect(trigger).toContainText('Administrador empresarial');

        // Abrir el selector y elegir la segunda empresa.
        await trigger.click();

        const options = page.locator('.company-context__option');

        await expect(options).toHaveCount(2);

        await expect(options.nth(1))
            .toContainText('Empresa Colaboradora');

        await expect(options.nth(1))
            .toContainText('Colaborador');

        await options.nth(1).click();

        // Verificar que cambió el contexto activo.
        await expect(trigger).toContainText('Empresa Colaboradora');
        await expect(trigger).toContainText('Colaborador');

        // Verificar que se guardó la selección.
        await expect.poll(
            () => page.evaluate(() =>
                sessionStorage.getItem('metricasg-selected-company-id')
            )
        ).toBe('502');

        // Comprobar que solamente la segunda empresa está activa.
        await trigger.click();

        await expect(options.nth(0))
            .not.toHaveAttribute('aria-current', 'true');

        await expect(options.nth(1))
            .toHaveAttribute('aria-current', 'true');

        // La navegación a Gestión empresarial debe permanecer disponible.
        await expect(
            page.locator('a[routerLink="/user/company-settings"]')
        ).toHaveCount(1);
    });
    test('permite seleccionar empresas mediante teclado y cerrar con Escape', async ({ page }) => {
        const memberships: Membership[] = [
            {
                membership_id: 1001,
                company_id: 501,
                company_name: 'Empresa Administradora',
                role: 'COMPANY_ADMIN',
                joined_at: '2026-11-21T10:00:00'
            },
            {
                membership_id: 1002,
                company_id: 502,
                company_name: 'Empresa Colaboradora',
                role: 'COLLABORATOR',
                joined_at: '2026-11-21T11:00:00'
            }
        ];

        await mockSession(page, 501);
        await mockApi(page, () => memberships);

        await page.goto('/user/home');

        const trigger = page.locator('.company-context__trigger');
        const menu = page.locator('.company-context__menu');
        const options = page.locator('.company-context__option');

        await expect(trigger).toBeVisible();
        await expect(trigger).toContainText('Empresa Administradora');

        // Abrir mediante Enter.
        await trigger.focus();
        await page.keyboard.press('Enter');

        await expect(menu).toBeVisible();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');

        // Navegar a la segunda empresa con el teclado.
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');

        await expect(options.nth(1)).toBeFocused();

        // Seleccionar mediante Enter.
        await page.keyboard.press('Enter');

        await expect(trigger).toContainText('Empresa Colaboradora');
        await expect(trigger).toContainText('Colaborador');

        await expect
            .poll(() =>
                page.evaluate(() =>
                    sessionStorage.getItem('metricasg-selected-company-id')
                )
            )
            .toBe('502');

        // Volver a abrir y cerrar mediante Escape.
        await trigger.focus();
        await page.keyboard.press('Enter');

        await expect(menu).toBeVisible();

        await page.keyboard.press('Escape');

        await expect(menu).toBeHidden();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');

        // Escape no debe cambiar la empresa seleccionada.
        await expect(trigger).toContainText('Empresa Colaboradora');
    });
    test('bloquea el selector empresarial durante una evaluación', async ({ page }) => {
        const memberships: Membership[] = [
            {
                membership_id: 1001,
                company_id: 501,
                company_name: 'Empresa Administradora',
                role: 'COMPANY_ADMIN',
                joined_at: '2026-11-21T10:00:00'
            },
            {
                membership_id: 1002,
                company_id: 502,
                company_name: 'Empresa Colaboradora',
                role: 'COLLABORATOR',
                joined_at: '2026-11-21T11:00:00'
            }
        ];

        await mockSession(page, 501);
        await mockApi(page, () => memberships);

        // Iniciar directamente en la ruta de evaluación.
        await page.goto('/user/evaluation');

        const trigger = page.locator('.company-context__trigger');
        const menu = page.locator('.company-context__menu');

        await expect(page).toHaveURL(/\/user\/evaluation(?:[?#]|$)/);
        await expect(trigger).toBeVisible();
        await expect(trigger).toBeDisabled();

        await expect(trigger).toContainText('Empresa Administradora');

        // El usuario no debe poder abrir el selector mediante teclado.
        await trigger.focus();
        await page.keyboard.press('Enter');

        await expect(menu).toBeHidden();

        // La empresa seleccionada debe permanecer intacta.
        await expect
            .poll(() =>
                page.evaluate(() =>
                    sessionStorage.getItem('metricasg-selected-company-id')
                )
            )
            .toBe('501');

        // Volver al inicio debe habilitar el selector.
        await page.goto('/user/home');

        await expect(trigger).toBeEnabled();

        await trigger.click();
        await expect(menu).toBeVisible();
    });
    test('acepta invitación y sincroniza la empresa asignada', async ({ page }) => {
        const memberships: Membership[] = [];
        let receivedToken: string | null = null;

        await mockSession(page);

        await mockApi(page, () => memberships);

        await page.route(
            '**/api/company-invitations/accept',
            async route => {
                if (route.request().method() !== 'POST') {
                    return route.fallback();
                }

                const body = route.request().postDataJSON() as {
                    token: string;
                };

                receivedToken = body.token;

                memberships.push({
                    membership_id: 1002,
                    company_id: 502,
                    company_name: 'Empresa Invitada',
                    role: 'COLLABORATOR',
                    joined_at: '2026-11-23T10:00:00'
                });

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        message: 'Invitation accepted'
                    })
                });
            }
        );

        await page.route('**/api/companies/502', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 502,
                    name: 'Empresa Invitada',
                    active: true,
                    sector_id: null,
                    size_id: null
                })
            });
        });

        await page.goto('/user/home');

        const tokenInput = page.locator('#invitation-token');
        const submitButton = page
            .getByRole('form', { name: 'Aceptar invitación empresarial' })
            .getByRole('button', { name: 'Aceptar invitación' });

        await expect(tokenInput).toBeVisible();
        await expect(submitButton).toBeDisabled();

        await tokenInput.fill('token-e2e-valido');
        await expect(submitButton).toBeEnabled();

        await submitButton.click();

        await expect
            .poll(() => receivedToken)
            .toBe('token-e2e-valido');

        await expect(
            page.locator('.company-context__trigger')
        ).toContainText('Empresa Invitada');

        await expect
            .poll(() =>
                page.evaluate(() =>
                    sessionStorage.getItem('metricasg-selected-company-id')
                )
            )
            .toBe('502');

        await expect(
            page.locator('.company-context__trigger')
        ).toContainText('Colaborador');
    });
    test('muestra un error al aceptar un token de invitación inválido', async ({ page }) => {
        await mockSession(page);
        await mockApi(page, () => []);

        await page.route('**/api/company-invitations/accept', async route => {
            if (route.request().method() !== 'POST') {
                return route.fallback();
            }

            await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                    detail: 'Invalid invitation token'
                })
            });
        });

        await page.goto('/user/home');

        const form = page.getByRole('form', {
            name: 'Aceptar invitación empresarial'
        });

        const tokenInput = form.locator('#invitation-token');
        const submitButton = form.getByRole('button', {
            name: 'Aceptar invitación'
        });

        await expect(tokenInput).toBeVisible();

        await tokenInput.fill('token-invalido-e2e');
        await submitButton.click();

        await expect(page.locator('#invitation-error')).toContainText(
            'No fue posible aceptar la invitación'
        );

        await expect(tokenInput).toHaveAttribute('aria-invalid', 'true');
        await expect(submitButton).toBeEnabled();

        // La invitación rechazada no debe seleccionar ninguna empresa.
        await expect(
            page.locator('.company-context__trigger')
        ).toContainText('Sin empresa');

        await expect
            .poll(() =>
                page.evaluate(() =>
                    sessionStorage.getItem('metricasg-selected-company-id')
                )
            )
            .toBeNull();
    });
    test('permite reintentar la sincronización tras aceptar una invitación', async ({ page }) => {
        const memberships: Membership[] = [];
        let acceptanceCount = 0;
        let membershipsRequestCount = 0;

        await mockSession(page);

        await mockApi(page, () => {
            membershipsRequestCount++;

            // Primera consulta: usuario sin empresa.
            // Segunda consulta: la invitación fue aceptada,
            // pero todavía no aparece la nueva membresía.
            // Tercera consulta: sincronización exitosa.
            if (membershipsRequestCount >= 3) {
                return [
                    {
                        membership_id: 1002,
                        company_id: 502,
                        company_name: 'Empresa Invitada',
                        role: 'COLLABORATOR',
                        joined_at: '2026-11-23T10:00:00'
                    }
                ];
            }

            return memberships;
        });

        await page.route('**/api/company-invitations/accept', async route => {
            if (route.request().method() !== 'POST') {
                return route.fallback();
            }

            acceptanceCount++;

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'Invitation accepted'
                })
            });
        });

        await page.route('**/api/companies/502', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 502,
                    name: 'Empresa Invitada',
                    active: true,
                    sector_id: null,
                    size_id: null
                })
            });
        });

        await page.goto('/user/home');

        const tokenInput = page.locator('#invitation-token');

        await expect(tokenInput).toBeVisible();

        await tokenInput.fill('token-e2e-valido');

        await page.getByRole('form', {
            name: 'Aceptar invitación empresarial'
        }).getByRole('button', {
            name: 'Aceptar invitación'
        }).click();

        // La invitación se acepta, pero la primera
        // sincronización todavía no devuelve empresas.
        await expect(page.locator('#invitation-error')).toContainText(
            'La invitación fue aceptada, pero no pudimos actualizar tus empresas'
        );

        await expect(
            page.getByRole('button', { name: 'Reintentar sincronización' })
        ).toBeVisible();

        expect(acceptanceCount).toBe(1);

        // Reintentar únicamente la sincronización.
        await page.getByRole('button', {
            name: 'Reintentar sincronización'
        }).click();

        await expect(
            page.locator('.company-context__trigger')
        ).toContainText('Empresa Invitada');

        await expect
            .poll(() =>
                page.evaluate(() =>
                    sessionStorage.getItem('metricasg-selected-company-id')
                )
            )
            .toBe('502');

        // El token no debe enviarse nuevamente.
        expect(acceptanceCount).toBe(1);
    });
    test('conserva los enlaces de navegación empresarial en móvil', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 900 });

        await mockSession(page, 501);
        await mockApi(page, () => [membership('COLLABORATOR')]);

        await page.goto('/user/home');

        const navbarToggler = page.getByRole('button', {
            name: 'Abrir o cerrar menú de navegación'
        });

        await expect(navbarToggler).toBeVisible();
        await navbarToggler.click();

        const navbar = page.locator('#mainNavbar');

        await expect(navbar.getByRole('link', { name: 'Inicio' })).toBeVisible();
        await expect(navbar.getByRole('link', { name: 'Evaluación' })).toBeVisible();
        await expect(navbar.getByRole('link', { name: 'Resultados' })).toBeVisible();
        await expect(navbar.getByRole('link', { name: 'Gestión empresarial' })).toBeVisible();

        await navbar.getByRole('button', { name: 'Más' }).click();

        await expect(navbar.getByRole('link', { name: 'Historial' })).toBeVisible();
        await expect(navbar.getByRole('link', { name: 'Benchmarking' })).toBeVisible();
        await expect(navbar.getByRole('link', { name: 'Retroalimentación' })).toBeVisible();

        // Verificar que también se mantiene el selector empresarial.
        await expect(navbar.locator('.company-context__trigger')).toBeVisible();

        // Cerrar el menú hamburguesa.
        await navbarToggler.click();
        await expect(navbar).not.toHaveClass(/\bshow\b/);
    });

    test('permite recorrer el menú móvil en pantallas de poca altura', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 568 });

        await mockSession(page, 501);
        await mockApi(page, () => [membership('COLLABORATOR')]);

        await page.goto('/user/home');

        const toggler = page.getByRole('button', {
            name: 'Abrir o cerrar menú de navegación'
        });

        const navbar = page.locator('#mainNavbar');

        await toggler.click();
        await expect(navbar).toHaveClass(/\bshow\b/);

        // El menú debe disponer de desplazamiento vertical propio.
        const canScroll = await navbar.evaluate(element =>
            element.scrollHeight > element.clientHeight &&
            getComputedStyle(element).overflowY === 'auto'
        );

        expect(canScroll).toBe(true);

        // Acceder a las opciones situadas al final.
        const profile = navbar.getByRole('button', {
            name: 'Abrir menú de perfil'
        });

        await profile.scrollIntoViewIfNeeded();
        await profile.click();

        await expect(
            navbar.getByRole('button', { name: 'Configuración' })
        ).toBeVisible();

        await expect(
            navbar.getByRole('button', { name: 'Cerrar Sesión' })
        ).toBeVisible();

        // El botón hamburguesa debe seguir disponible.
        await expect(toggler).toBeVisible();

        await toggler.click();
        await expect(navbar).not.toHaveClass(/\bshow\b/);
    });

});
