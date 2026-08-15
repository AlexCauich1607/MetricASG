import { Component } from '@angular/core';
import { MaturityLevel } from '../../../models/maturity_level';
import { MaturityLevelService } from '../../../services/maturity-level.service';
import { MatDialog } from '@angular/material/dialog';
import { MaturityLevelFormComponent } from '../../modals/maturity-level-form/maturity-level-form.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-maturity-levels',
  standalone: false,
  templateUrl: './maturity-levels.component.html',
  styleUrl: './maturity-levels.component.scss'
})
export class MaturityLevelsComponent {
  form: FormGroup;
  niveles: MaturityLevel[] = [
  ];
  loading = false;

  constructor(private levelService: MaturityLevelService, private dialog: MatDialog, private fb: FormBuilder) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      value: [0, [Validators.required, Validators.minLength(1)]],
      color: ['#000000', Validators.required],
      min_score: [0, [Validators.required, Validators.minLength(1)]],
      max_score: [0, [Validators.required, Validators.minLength(1)]]
    })
  }

  nivel: MaturityLevel | null = null;

  edit_color: string = "";
  edit_name: string = "";

  ngOnInit(): void {
    this.loadNiveles();
  }

  loadNiveles(): void {
    this.loading = true;

    this.levelService.getAll({ orderBy: 'value', orderDir: 'asc' }).subscribe({
      next: (data) => {
        this.niveles = data;
        if (!this.nivel) {
          this.nivel = this.niveles[0];
         this.reset();
          this.edit_name = this.nivel.name;
          this.edit_color = this.nivel.color;
        } else {
          this.selectLevel(this.nivel.id ? this.nivel.id : 0);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  getValue(name: string) {
    return this.form.get(name);
  }
  setValue(name: string, value: any) {
    this.getValue(name)?.setValue(value);
  }

  reset() {
    this.setValue("name", this.nivel?.name);
    this.setValue("color", this.nivel?.color);
    this.setValue("value", this.nivel?.value);
    this.setValue("min_score", this.nivel?.min_score);
    this.setValue("max_score", this.nivel?.max_score);
  }
  getLevelById(id: number): MaturityLevel {
    const level = this.niveles.find(l => l.id === id);
    if (!level) {
      throw new Error('Nivel no encontrado');
    }
    return level;
  }

  selectLevel(id: number) {
    this.nivel = this.getLevelById(id);
    this.reset();
  }

  updateLevel() {
    const payload = {
      ...this.form.value
    };
    const id = this.nivel?.id ?? 0;
    this.levelService.update(id, payload).subscribe({
      next: (data) => {
        this.loadNiveles();
        alert("Nivel: " + this.getValue("name") + " actualizado con exito")
        this.loading = false;
      },
      error: (err) => {
        alert("Error al actualizar: " + this.getValue("name"))
        console.error(err);
        this.loading = false;
      }
    });


  }


  deleteLevel() {
    if (confirm("¿Seguro que desea eliminar este Nivel de Madurez?")) {


      if (this.nivel) {
        const { id, ...document } = this.nivel;
        this.levelService.delete(id!).subscribe({
          next: (data) => {
            this.loadNiveles();
            this.selectLevel(this.niveles[0].id!);
            alert("Nivel: " + document.name + " eliminado con exito");
            this.loading = false;
          },
          error: (err) => {
            alert("Error al eliminar: " + document.name)
            console.error(err);
            this.loading = false;
          }
        });
      }
    }

  }

  openCreateModal(): void {
    const dialogRef = this.dialog.open(MaturityLevelFormComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe((created?: MaturityLevel) => {
      if (!created) return;
      this.niveles.push(created);
    });

  }

}
