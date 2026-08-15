import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CompanySector } from '../../../models/company_sector';
import { CompanySize } from '../../../models/company_size';

@Component({
  selector: 'app-search-filter',
  standalone: false,
  templateUrl: './search-filter.component.html',
  styleUrl: './search-filter.component.scss'
})
export class SearchFilterComponent {
  all = true;
  all_sizes = true;
  constructor(private dialogRef: MatDialogRef<SearchFilterComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      sectores: CompanySector[],
      sectores_seleccionados: number[],
      sizes: CompanySize[],
      sizes_seleccionados: number[],
    },
  ) {

  }
  ngOnInit(): void {
    if (this.data.sectores_seleccionados.length == 0) {
      this.all = true;
    } else {
      this.all = false
    }

    if (this.data.sizes_seleccionados.length == 0) {
      this.all_sizes = true;
    } else {
      this.all_sizes = false
    }
  }
  save() {
    this.dialogRef.close({
      sectores_seleccionados: this.data.sectores_seleccionados,
      sizes_seleccionados: this.data.sizes_seleccionados 
    });
  }
  close(): void {
    this.dialogRef.close(null);
  }
  isSelected(id: number): boolean {
    if (!this.data.sectores_seleccionados) {
      return false;
    }
    return this.data.sectores_seleccionados.includes(id);
  }
  
  isSelected_size(id: number): boolean {
    if (!this.data.sizes_seleccionados) {
      return false;
    }
    return this.data.sizes_seleccionados.includes(id);
  }

  toggleSector(id: number, event: any) {
    if (event.target.checked) {
      this.all = false
      this.data.sectores_seleccionados.push(id);
    } else {
      this.data.sectores_seleccionados = this.data.sectores_seleccionados.filter(x => x !== id);
      if (this.data.sectores_seleccionados.length == 0) {
        this.all = true
      }
    }
  }
  toggleSectorSize(id: number, event: any) {
    if (event.target.checked) {
      this.all_sizes = false,
      this.data.sizes_seleccionados.push(id);
    } else {
      this.data.sizes_seleccionados = this.data.sizes_seleccionados.filter(x => x !== id);
      if (this.data.sizes_seleccionados.length == 0) {
        this.all_sizes = true
      }
    }
  }
  selectAll() {
    this.all = true;
    this.data.sectores_seleccionados = [];
  }

  selectAllSize() {
    this.all_sizes = true;
    this.data.sizes_seleccionados = [];
  }

  getTitleSectores() {
    if (this.all) {
      return "Todos";
    }
    let result = "";
    this.data.sectores_seleccionados.forEach(s => {
      if (result.length > 0) {
        result += ", "
      }
      result += this.data.sectores.find(sc => sc.id == s)?.name;

    })
    return result;
  }

   getTitleSize() {
    if (this.all_sizes) {
      return "Todos";
    }
    let result = "";
    this.data.sizes_seleccionados.forEach(s => {
      if (result.length > 0) {
        result += ", "
      }
      result += this.data.sizes.find(sc => sc.id == s)?.name;

    })
    return result;
  }

}
