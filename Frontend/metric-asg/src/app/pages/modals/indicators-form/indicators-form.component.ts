import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { IndicatorService } from '../../../services/indicator.service';
import { Indicator } from '../../../models/indicator';
import { MaturityLevelService } from '../../../services/maturity-level.service';
import { MaturityLevel } from '../../../models/maturity_level';
import { IndicatorAnswer } from '../../../models/indicator_answer';
import { IndicatorAnswerService } from '../../../services/indicator-answer.service';

export interface Respuestas {
  level_name: string,
  id_level: number,
  text: string,
}

@Component({
  selector: 'app-indicators-form',
  standalone: false,
  templateUrl: './indicators-form.component.html',
  styleUrl: './indicators-form.component.scss'
})
export class IndicatorsFormComponent {
  form: FormGroup;
  saving = false;
  form_send = false;
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<IndicatorsFormComponent>,
    private indicatorService: IndicatorService,
    private levelService: MaturityLevelService,
    private indicatorAService: IndicatorAnswerService,
    @Inject(MAT_DIALOG_DATA) public data: { id: number; indicator?: Indicator }
  ) {
    this.form = this.fb.group({
      question: [data.indicator?.question || '', Validators.required],
      ambit_id: data.id,
    });
  }

  loading = false;
  touched: boolean[] = [];
  niveles: MaturityLevel[] = [];
  preguntas: Respuestas[] = []
  preguntasA: IndicatorAnswer[] = []
  text = "";

  ngOnInit(): void {
    if (this.data.indicator) {
      this.loadNivelesEdit();
    } else {
      this.loadNiveles();
    }

  }
  touch(int: number) {
    this.touched[int] = true;
  }
  loadNiveles(): void {
    this.loading = true;
    this.text = this.getValue("question")?.value;
    this.levelService.getAll({ orderBy: 'value', orderDir: 'asc' }).subscribe({
      next: (data) => {
        this.niveles = data;
        this.niveles.forEach(n => {
          let newNivel = {
            level_name: n.name,
            id_level: n.id! | 0,
            text: "",
          }
          this.preguntas.push(newNivel);
          this.touched.push(false);
        });
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  loadNivelesEdit(): void {
    this.loading = true;
    this.text = this.getValue("question")?.value;
    const filtros = {
      indicator_id: this.data.indicator?.id,
    }



    this.indicatorAService.getAll({ filters: filtros }).subscribe({
      next: (value) => {
        this.preguntasA = value;
        this.levelService.getAll({ orderBy: 'value', orderDir: 'asc' }).subscribe({
          next: (data) => {
            this.niveles = data;
            this.niveles.forEach(n => {
              let newNivel = {
                level_name: n.name,
                id_level: n.id! | 0,
                text: this.getTextA(n.id!),
              }
              this.preguntas.push(newNivel);
            });
            this.loading = false;
          },
          error: (err) => {
            console.error(err);
            this.loading = false;
          }
        });
      },
    })
  }

  getText(id: number): string {
    const pregunta = this.preguntas.find(u => u.id_level === id);
    return pregunta ? pregunta?.text : "";
  }
  getTextA(id: number): string {
    const pregunta = this.preguntasA.find(u => u.maturity_level_id === id);
    return pregunta ? pregunta?.text : "";
  }


  save(): void {
    this.form_send = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.data.indicator) {
      this.update();
    } else {
      this.create();
    }
  }
  getValue(name: string) {
    return this.form.get(name);
  }
  create() {
    this.saving = true;

    const payload: Indicator = {
      ...this.form.value
    };
    this.indicatorService.create(payload).subscribe({
      next: (created) => {
        const filtros = { indicator_id: created.id };
        this.indicatorAService.getAll({ filters: filtros }).subscribe({
          next: (list) => {
            list.forEach(p => {
              this.indicatorAService.update(p.id, { text: this.getText(p.maturity_level_id) }).subscribe({
                next: (data) => {
                },
                error: (err) => {
                  console.error(err);
                  this.loading = false;
                }
              });
            });
            this.dialogRef.close(created);
          },
          error: (err) => {
            console.error(err);
            this.saving = false;
          }
        });

        this.dialogRef.close(created);
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
      }
    });
  }

  update() {
    this.saving = true;

    const payload: Indicator = {
      ...this.form.value
    };

    console.log(this.text)
    console.log(this.getValue("question")?.value);
    if (this.text != this.getValue("question")?.value) {
      console.log(this.data.indicator?.id);
      this.indicatorService.update(this.data.indicator?.id ?? 0, { question:  this.getValue("question")?.value}).subscribe({
        next:(data)=>{
          console.log("The change success")
        },
        error: (err)=>{
          console.log(err)
        }
      });
    }

    const filtros = { indicator_id: this.data.indicator!.id };
    this.indicatorAService.getAll({ filters: filtros }).subscribe({
      next: (list) => {
        list.forEach(p => {
          this.indicatorAService.update(p.id, { text: this.getText(p.maturity_level_id) }).subscribe({
            next: (data) => {
            },
            error: (err) => {
              console.error(err);
              this.loading = false;
            }
          });
        });
        this.dialogRef.close();
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
      }
    });

    this.preguntas.forEach(p => {

    });
    this.dialogRef.close();

  }
  delete() {
    if (confirm('¿Desea eliminar este indicador?')) {
      this.indicatorService.delete(this.data.indicator ? this.data.indicator.id : 0).subscribe({
        next: (data) => {
          this.dialogRef.close();
        }, error: (err) => {
          console.error(err);
        }
      })
    }

  }

  close(): void {
    this.dialogRef.close(null);
  }

}
