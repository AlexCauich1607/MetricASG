import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { SharedModule } from '../../../shared/shared.module';

import { MaturityLevelsComponent } from './maturity-levels.component';

describe('MaturityLevelsComponent', () => {
  let component: MaturityLevelsComponent;
  let fixture: ComponentFixture<MaturityLevelsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MaturityLevelsComponent],
      providers: [
        provideHttpClient(withXhr())
      ],
      imports: [
        SharedModule,
        ReactiveFormsModule,
        MatDialogModule
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(MaturityLevelsComponent);
    component = fixture.componentInstance;

    component.nivel = {
      id: 1,
      name: 'Básico',
      value: 1,
      min_score: 0,
      max_score: 33,
      is_removable: true,
      color: '#ce4040'
    };

    component.niveles = [
      component.nivel
    ];

    component.edit_name = component.nivel.name;
    component.edit_color = component.nivel.color;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});