
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { CreateCompanyComponent } from './create-company.component';
import { CompanyMembershipService } from '../../../services/company-membership.service';
import { CompanySectorService } from '../../../services/company-sector.service';
import { CompanySizeService } from '../../../services/company-size.service';

describe('CreateCompanyComponent', () => {
    let component: CreateCompanyComponent;
    let fixture: ComponentFixture<CreateCompanyComponent>;

    let dialogRef: jasmine.SpyObj<MatDialogRef<CreateCompanyComponent>>;
    let membershipService: jasmine.SpyObj<CompanyMembershipService>;
    let sectorService: jasmine.SpyObj<CompanySectorService>;
    let sizeService: jasmine.SpyObj<CompanySizeService>;

    beforeEach(async () => {
        dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

        membershipService = jasmine.createSpyObj(
            'CompanyMembershipService',
            ['createCompany']
        );

        sectorService = jasmine.createSpyObj(
            'CompanySectorService',
            ['getAll']
        );

        sizeService = jasmine.createSpyObj(
            'CompanySizeService',
            ['getAll']
        );

        sectorService.getAll.and.returnValue(of([]));
        sizeService.getAll.and.returnValue(of([]));

        await TestBed.configureTestingModule({
            imports: [CreateCompanyComponent],
            providers: [
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: CompanyMembershipService, useValue: membershipService },
                { provide: CompanySectorService, useValue: sectorService },
                { provide: CompanySizeService, useValue: sizeService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(CreateCompanyComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should create a company using only its name', () => {
        const company = {
            id: 15,
            name: 'Empresa Personal',
            sector_id: null,
            size_id: null,
            active: true
        };

        membershipService.createCompany.and.returnValue(of(company));

        component.form.patchValue({
            name: 'Empresa Personal'
        });

        component.save();

        expect(membershipService.createCompany).toHaveBeenCalledOnceWith({
            name: 'Empresa Personal'
        });

        expect(dialogRef.close).toHaveBeenCalledOnceWith(company);
    });

    it('should create a company with sector and size', () => {
        const company = {
            id: 16,
            name: 'Empresa ASG',
            sector_id: 2,
            size_id: 3,
            active: true
        };

        membershipService.createCompany.and.returnValue(of(company));

        component.form.patchValue({
            name: 'Empresa ASG',
            sector_id: 2,
            size_id: 3
        });

        component.save();

        expect(membershipService.createCompany).toHaveBeenCalledOnceWith({
            name: 'Empresa ASG',
            sector_id: 2,
            size_id: 3
        });

        expect(dialogRef.close).toHaveBeenCalledOnceWith(company);
    });

    it('should reject an invalid company name', () => {
        component.form.patchValue({
            name: 'AB'
        });

        component.save();

        expect(component.form.invalid).toBeTrue();
        expect(membershipService.createCompany).not.toHaveBeenCalled();
        expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should display an error without closing the dialog', () => {
        membershipService.createCompany.and.returnValue(
            throwError(() => new Error('Company creation failed'))
        );

        component.form.patchValue({
            name: 'Empresa de Prueba'
        });

        component.save();
        fixture.detectChanges();

        expect(component.errorMessage).toContain(
            'No fue posible crear la empresa'
        );

        expect(component.saving).toBeFalse();
        expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should close the dialog when cancelled', () => {
        component.close();

        expect(dialogRef.close).toHaveBeenCalledOnceWith(null);
    });

    it('should render the company creation form', () => {
        const element: HTMLElement = fixture.nativeElement;

        const nameInput = element.querySelector<HTMLInputElement>(
            'input[formControlName="name"]'
        );

        const sectorSelect = element.querySelector<HTMLSelectElement>(
            'select[formControlName="sector_id"]'
        );

        const sizeSelect = element.querySelector<HTMLSelectElement>(
            'select[formControlName="size_id"]'
        );

        const submitButton = element.querySelector<HTMLButtonElement>(
            'button[type="submit"]'
        );

        expect(nameInput).not.toBeNull();
        expect(sectorSelect).not.toBeNull();
        expect(sizeSelect).not.toBeNull();
        expect(submitButton).not.toBeNull();

        expect(element.textContent).toContain('Crear empresa');
        expect(element.textContent).toContain('Sector (opcional)');
        expect(element.textContent).toContain('Tamaño (opcional)');
    });

});
