import { Component } from '@angular/core';
import { Ambit } from '../../../models/ambit';
import { MaturityLevel } from '../../../models/maturity_level';
import { AmbitService } from '../../../services/ambit.service';
import { MatDialog } from '@angular/material/dialog';
import { AmbitFormComponent } from '../../modals/ambit-form/ambit-form.component';
import { FeedbackAmbit } from '../../../models/feedback_ambit';
import { MaturityLevelService } from '../../../services/maturity-level.service';
import { Indicator } from '../../../models/indicator';
import { IndicatorService } from '../../../services/indicator.service';
import { IndicatorsFormComponent } from '../../modals/indicators-form/indicators-form.component';
import { FeedbacksFormComponent } from '../../modals/feedbacks-form/feedbacks-form.component';

@Component({
  selector: 'app-ambits',
  standalone: false,
  templateUrl: './ambits.component.html',
  styleUrl: './ambits.component.scss'
})
export class AmbitsComponent {

  ambitos: Ambit[] = [];
  ambito: Ambit | null = null;
  loading = false;

  constructor(private ambitService: AmbitService, private niveleService: MaturityLevelService, private indicatorService: IndicatorService, private dialog: MatDialog,) { }
  ngOnInit(): void {
    this.loadAmbits();
  }
  indicadores: Indicator[] = [];

  niveles: MaturityLevel[] = [];

  feedbacks: FeedbackAmbit[] = [];

  loadAmbits(): void {
    this.loading = true;

    this.ambitService.getAll({ orderBy: 'id', orderDir: 'asc' }).subscribe({
      next: (data) => {
        this.ambitos = data;
        if(this.ambito ==null){
           this.ambito = this.ambitos[0];
        }
       
        this.loadIndicators();
        this.loadFeedbacks();
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  loadFeedbacks(): void {
    const filtros = { ambit_id: this.ambito?.id };
    this.niveleService.getAll({ orderBy: 'id', orderDir: 'asc', filters: filtros }).subscribe({
      next: (data) => {
        this.niveles = data;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  loadIndicators(): void {
    const filtros = { ambit_id: this.ambito?.id };
    this.indicatorService.getAll({ orderBy: 'id', orderDir: 'asc', filters: filtros }).subscribe({
      next: (data) => {
        this.indicadores = data;
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  selectedAmbit(id: number) {
    this.ambito = this.getAmbitById(id);
    this.loadIndicators();
  }

  deleteAmbit(id: number) {
    if (confirm('¿Estás seguro de eliminar este ámbito?')) {
      this.ambitService.delete(id).subscribe({
        next: (data) => {
          this.loadAmbits();
          this.selectedAmbit(this.ambitos[0].id)
          alert("Ámbito eliminado con exito")
          this.loading = false;
        },
        error: (err) => {
          alert("Error al eliminar Ámbito")
          console.error(err);
          this.loading = false;
        }
      });
    }


  }
  getAmbitById(id: number): Ambit {
    const ambit = this.ambitos.find(l => l.id === id);
    if (!ambit) {
      throw new Error('Nivel no encontrado');
    }
    return ambit;
  }

  getIndicatorById(id: number): Indicator {
    const indicator = this.indicadores.find(l => l.id === id);
    if (!indicator) {
      throw new Error('Indicador no encontrado');
    }
    return indicator;
  }

  openCreateModal(): void {
    const dialogRef = this.dialog.open(AmbitFormComponent, {
      width: '400px'
    });


    dialogRef.afterClosed().subscribe((result?: Ambit) => {
      if (!result) return;
      this.ambitService.create(result).subscribe(result => {
        this.loadAmbits();
      });
    });

  }

  openUpdateAmbitModal(id: number): void {
    let ambitEdit = this.getAmbitById(id);
    const dialogRef = this.dialog.open(AmbitFormComponent, {
      data: ambitEdit,
      width: '400px'
    });


    dialogRef.afterClosed().subscribe((result?: Ambit) => {
      if (!result) return;
      this.ambitService.update(id, result).subscribe({
        next: (data) => {
          this.loadAmbits();
          alert("Ámbito: " + data.name + " actualizado con exito")
          this.loading = false;
        },
        error: (err) => {
          alert("Error al actualizar: " + result.name)
          console.error(err);
          this.loading = false;
        }
      });
    });

  }

  openIndicatorCreateModal(): void {
    const dialogRef = this.dialog.open(IndicatorsFormComponent, {
      data: {
        width: '400px',
        id: this.ambito ? this.ambito.id : 0,

      }
    });

    dialogRef.afterClosed().subscribe((result?: Indicator) => {
      if (!result) return;

      this.loadAmbits();

    });
  }

   openIndicatorEditModal(id: number): void {
    let ind = this.getIndicatorById(id);
    const dialogRef = this.dialog.open(IndicatorsFormComponent, {
      data: {
        width: '400px',
        id: this.ambito ? this.ambito.id : 0,
        indicator: ind,
      }
    });

    dialogRef.afterClosed().subscribe((result?: Indicator) => {
      
      this.loadAmbits();

    });
  }

  openFeedbackEditModal(id: number, name: string): void {

    const dialogRef = this.dialog.open(FeedbacksFormComponent, {
      data: {
        id: this.ambito?.id,
        nivel: id,
        name: name,
      }
    });

    dialogRef.afterClosed().subscribe((result?: Indicator) => {
      
      this.loadAmbits();

    });
  }
}
