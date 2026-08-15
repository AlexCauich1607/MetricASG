import { Component, Input } from '@angular/core';
import { User } from '../../../../models/user';
import { CompanySectorService } from '../../../../services/company-sector.service';
import { CompanySector } from '../../../../models/company_sector';
import { CompanySize } from '../../../../models/company_size';
import { CompanySizeService } from '../../../../services/company-size.service';
import { UserService } from '../../../../services/user.service';

@Component({
  selector: 'app-company-settings',
  standalone: false,
  templateUrl: './company-settings.component.html',
  styleUrl: './company-settings.component.scss'
})
export class CompanySettingsComponent {
  @Input() user: User | null = null;
  sectores: CompanySector[] | null = null;
  sectorSeleccionado: CompanySector | null = null;
  sizes: CompanySize[] | null = null;
  sizeSeleccionado: CompanySize | null = null;
  constructor(private sectoresService: CompanySectorService, private sizeService: CompanySizeService, private userService: UserService) {
  }
  ngOnInit(): void {
    this.loadSectores();
    this.loadSizes();
  }
  loadSectores() {
    this.sectoresService.getAll().subscribe({
      next: (value) => {
        this.sectores = value;
        this.selecionarSector();
        this.selecionarSize();
      },
      error: (err) => {
        console.log(err);
      }
    })
  }
  loadSizes() {
    this.sizeService.getAll().subscribe({
      next: (value) => {
        this.sizes = value;
        this.selecionarSize();
      },
      error: (err) => {
        console.log(err);
      }
    })
  }
  selecionarSector() {
    this.sectores?.forEach(s => {
      if (this.user?.company_sector_id == s.id) {
        this.sectorSeleccionado = s;
      }
    })
  }

  selecionarSize() {
    this.sizes?.forEach(s => {
      if (this.user?.company_size_id == s.id) {
        this.sizeSeleccionado = s;
      }
    })
  }
  update() {
    if(this.user!.company_name!.length<3){
      return
    }
    const payload = {
      company_name: this.user?.company_name,
      company_size_id:this.sizeSeleccionado?.id,
      company_sector_id: this.sectorSeleccionado?.id,
    }
    const id = this.user?.id ?? 0;
    this.userService.update(id, payload).subscribe({
      next: (value) => {
        alert("Usuario actualizado con exito")
      },
      error: (err) => {
        alert("Error al actualizar el usuario")
      }
    })
  }

}
