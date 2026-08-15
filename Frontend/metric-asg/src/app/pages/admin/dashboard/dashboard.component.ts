import { Component } from '@angular/core';
import { SessionService } from '../../../shared/class/temporalStorage';
import { AdminService } from '../../../services/admin.service';
import { Sumary } from '../../../models/admin';


export interface AmbitChart {
  name: string,
  color: string,
  letter: string,
  data: string[],
  scores: number[],
  colors: string[]
}

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  name = SessionService.getSessionItem('user');
  summary: Sumary | null = null;
  stats = [
    { label: 'Usuarios Registrados', value: 0, color: '#00245dff', icon: 'person' },
    { label: 'Diagnósticos Completados', value: 0, color: '#5D9732', icon: 'task_alt' },
    { label: 'Diagnósticos Pendientes', value: 0, color: '#97324dff', icon: 'schedule' },
    { label: 'Promedio Global ASG', value: 0, color: '#5774aaff', icon: 'equalizer' }
  ];
  blueColor= "#00245D";
  loadingChart = false;

  usersData ={
    name: 'Usuarios Registrados',
    data: [] as string [],
    colors: [] as string [],
    value: [] as number []
  }

  data: Map<number, AmbitChart> = new Map();
  constructor(private adminService: AdminService) {

  }
  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.adminService.getSummary().subscribe({
      next: (data) => {
        this.summary = data;
        let user_info = this.summary.users;
        this.stats[0].value = user_info.total;
        this.stats[1].value = user_info.completed_evaluation;
        this.stats[2].value = user_info.pending_evaluation;
        this.stats[3].value = Number.parseInt(this.summary.asg.global_average.toFixed(1));
        this.summary.users_by_month.forEach(u => {
          this.usersData.data.push(u.month);
          this.usersData.value.push(u.count);
          this.usersData.colors.push(this.blueColor); 
          
        });
        this.summary.ambits.forEach(a=>{
          let ambito = this.data.get(a.id);
          if(!ambito){
            let newAmbito: AmbitChart ={
              name: a.name,
              color: a.color,
              letter: a.letter,
              colors: [],
              data: [],
              scores: [],
            }
            this.data.set(a.id, newAmbito);
            ambito = this.data.get(a.id);
          }
          if(ambito){
            a.maturity_levels.forEach(m =>{
              ambito.data.push(m.name);
              ambito.colors.push(m.color);
              ambito.scores.push(m.user_count);
            })
          }
        });
        this.loadingChart=true;
      },
      error: (err) => {

      }
    })
  }
}
