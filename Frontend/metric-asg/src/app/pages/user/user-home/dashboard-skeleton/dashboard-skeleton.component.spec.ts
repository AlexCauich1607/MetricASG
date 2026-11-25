import {
    ComponentFixture,
    TestBed
} from '@angular/core/testing';

import { DashboardSkeletonComponent } from
    './dashboard-skeleton.component';

describe('DashboardSkeletonComponent', () => {

    let component: DashboardSkeletonComponent;

    let fixture:
        ComponentFixture<DashboardSkeletonComponent>;

    beforeEach(async () => {

        await TestBed.configureTestingModule({
            imports: [DashboardSkeletonComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(
            DashboardSkeletonComponent
        );

        component = fixture.componentInstance;

    });

    it('should create', () => {

        fixture.detectChanges();

        expect(component).toBeTruthy();

    });

    it('should display the context loading variant', () => {

        component.variant = 'context';

        fixture.detectChanges();

        const element: HTMLElement =
            fixture.nativeElement;

        expect(element.textContent)
            .toContain('Cargando empresas');

        expect(
            element.querySelector(
                '.dashboard-skeleton-context'
            )
        ).not.toBeNull();

        expect(
            element.querySelectorAll(
                '.dashboard-skeleton-card'
            ).length
        ).toBe(0);

    });

    it('should display four result skeleton cards', () => {

        component.variant = 'results';

        fixture.detectChanges();

        const element: HTMLElement =
            fixture.nativeElement;

        expect(element.textContent)
            .toContain('Cargando resultados');

        expect(
            element.querySelectorAll(
                '.dashboard-skeleton-card'
            ).length
        ).toBe(4);

    });

    it('should highlight only one skeleton card', () => {

        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelectorAll(
                '.dashboard-skeleton-card--featured'
            ).length
        ).toBe(1);

    });

    it('should display both insight placeholders', () => {

        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelectorAll(
                '.dashboard-skeleton-panel'
            ).length
        ).toBe(2);

    });

    it('should hide decorative placeholders from assistive technology', () => {

        fixture.detectChanges();

        const element: HTMLElement =
            fixture.nativeElement;

        const grid = element.querySelector(
            '.dashboard-performance__grid'
        );

        const insights = element.querySelector(
            '.dashboard-insights'
        );

        expect(grid?.getAttribute('aria-hidden'))
            .toBe('true');

        expect(insights?.getAttribute('aria-hidden'))
            .toBe('true');

    });

    it('should expose an accessible loading message', () => {

        fixture.detectChanges();

        const loadingState: HTMLElement =
            fixture.nativeElement.querySelector(
                '.asg-state--loading'
            );

        expect(loadingState).not.toBeNull();

        expect(loadingState.getAttribute('role'))
            .toBe('status');

        expect(loadingState.getAttribute('aria-busy'))
            .toBe('true');

    });

    it('should not expose interactive actions while loading', () => {

        fixture.detectChanges();

        expect(
            fixture.nativeElement.querySelectorAll(
                'button, a[href], input'
            ).length
        ).toBe(0);

    });

});