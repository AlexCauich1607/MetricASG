import { Component } from '@angular/core';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationAmbit, EvaluationIndicator, EvaluationStructure } from '../../../models/evaluation_structure';
import { Router } from '@angular/router';
import { SessionService } from '../../../shared/class/temporalStorage';

@Component({
  selector: 'app-evaluation',
  standalone: false,
  templateUrl: './evaluation.component.html',
  styleUrl: './evaluation.component.scss'
})
export class EvaluationComponent {
  structure!: EvaluationStructure;
  loading = true;
  responses: Map<number, number> = new Map();
  completadas: Map<number, number> = new Map();
  fondo = "#6d2828ff"
  userId: number = SessionService.getSessionItem('id') ?? 0;

  ambit = 0;
  question = 0;
  progreso = 0;
  mesActual = '';
  anioActual = '';
  mesFuturo = '';
  anioFuturo = '';


  constructor(private evaluationService: EvaluationService, private router: Router) { }

  ngOnInit(): void {
    this.loadSurvey();
    this.getPeriodo();
  }

  getAmbit(): EvaluationAmbit {
    return this.structure.ambits[this.ambit];
  }
  getQuestion(): EvaluationIndicator {
    return this.structure.ambits[this.ambit].indicators[this.question];
  }
  nextQuestion() {
    if ((this.question + 1) < this.getAmbit().indicators.length) {
      this.question += 1;
    } else {
      if (this.ambit < this.structure.ambits.length - 1) {
        this.ambit += 1;
        this.question = 0;
      }

    }
    this.actualizarProgreso();
  }
  capitalizar(texto: string): string {
    if (!texto) return texto;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  getPeriodo() {
    const hoy = new Date();

    this.mesActual = hoy.toLocaleString('es-ES', { month: 'long' });
    this.mesActual = this.capitalizar(this.mesActual);
    this.anioActual = hoy.toLocaleString('es-ES', { year: 'numeric' });
    const futura = new Date(hoy);
    futura.setMonth(hoy.getMonth() - 5);
    this.mesFuturo = futura.toLocaleString('es-ES', { month: 'long' })
    this.mesFuturo = this.capitalizar(this.mesFuturo);
    this.anioFuturo = futura.toLocaleString('es-ES', { year: 'numeric' });

  }

  beforeQuestion() {
    if ((this.question - 1) >= 0) {
      this.question -= 1;
    } else {
      if (this.ambit > 0) {
        this.ambit -= 1;
        this.question = this.getAmbit().indicators.length - 1;
      }

    }
    this.actualizarProgreso();
  }

  loadSurvey() {
    this.evaluationService.getEvaluation().subscribe({
      next: (res) => {
        this.structure = res;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
  selectAnswer(indicatorId: number, maturityId: number, ambit_id: number) {
    if (this.responses.get(indicatorId)) {
      this.responses.set(indicatorId, maturityId);
    } else {
      this.responses.set(indicatorId, maturityId);
      const valor = this.completadas.get(ambit_id) ?? 0;
      this.completadas.set(ambit_id, valor + 1);
      this.actualizarProgreso();
    }

  }



  getAllQuestionsLeght(): number {
    let cont = 0;
    this.structure.ambits.forEach(a => {
      cont += a.indicators.length;
    })
    return cont;
  }
  actualizarProgreso() {

    let complet = this.completadas.get(this.getAmbit().id) ?? 0;

    let total = this.getAmbit().indicators.length;

    this.progreso = Math.round(complet * (100 / total));
  }
  submit() {
    console.log(this.responses.size)
    console.log(this.responses)
    console.log(this.getAllQuestionsLeght())
    if (this.responses.size == this.getAllQuestionsLeght()) {
      if (confirm("¿Desea enviar esta evaluación?")) {
        const payload = {
          user_id: this.userId,
          responses: Array.from(this.responses.entries()).map(
            ([indicator_id, maturity_level_id]) => ({
              indicator_id,
              maturity_level_id
            })
          )
        };

        this.evaluationService.submitEvaluation(payload).subscribe(() => {
          alert('Evaluación enviada correctamente');
          this.router.navigate(['/user/results']);
        })
      }

    } else {
      alert('Tiene preguntas sin responder');
    }
  }





  hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Eliminar el # si existe
    hex = hex.replace(/^#/, '');

    // Validar formato
    if (!/^[0-9A-F]{3}$|^[0-9A-F]{6}$/i.test(hex)) {
      throw new Error('Formato HEX inválido. Use formato #RGB o #RRGGBB');
    }

    let r: number, g: number, b: number;

    // Si es formato corto (#RGB)
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    }
    // Si es formato largo (#RRGGBB)
    else {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }

    return { r, g, b };
  }
  hexToRgbString(hex: string): string {
    // Remover #
    hex = hex.replace('#', '');

    // Expandir formato corto
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    // Convertir a decimal
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // IMPORTANTE: Retornar como string "r, g, b"
    return `${r}, ${g}, ${b}`;
  }

}
