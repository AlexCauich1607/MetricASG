
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

        await expect(
            page.getByRole('button', {
                name: 'Crear una nueva empresa'
            })
        ).toBeVisible();

        await expect(
            page.locator('#selected-company')
        ).toHaveCount(0);
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

        await page.getByRole('button', {
            name: 'Crear una nueva empresa'
        }).click();

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

        await expect(
            page.locator('#selected-company')
        ).toHaveValue(String(companyId));

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

});
