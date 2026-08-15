import { Component } from '@angular/core';
import { CompanySector } from '../../../models/company_sector';
import { CompanySectorService } from '../../../services/company-sector.service';
import { CompanySize } from '../../../models/company_size';
import { SectorFormComponent } from '../../modals/sector-form/sector-form.component';
import { MatDialog } from '@angular/material/dialog';
import { CompanySizeService } from '../../../services/company-size.service';
import { SizeFormComponent } from '../../modals/size-form/size-form.component';

@Component({
  selector: 'app-company',
  standalone: false,
  templateUrl: './company.component.html',
  styleUrl: './company.component.scss'
})
export class CompanyComponent {
  sectores: CompanySector [] | null = null;
  sizes: CompanySize [] | null = null

  constructor(private sectorService: CompanySectorService,private sizeService: CompanySizeService, private dialog: MatDialog){

  }
  
  ngOnInit(): void {
    this.loadSectores();
    this.loadSizes();
  }

  loadSectores(){
    this.sectorService.getAll().subscribe({
      next: (data)=>{
        this.sectores = data;
      }, 
      error: (err)=>{
        console.log(err);
      }
    })
  }

  loadSizes(){
    this.sizeService.getAll().subscribe({
      next: (data)=>{
        this.sizes = data;
      }, 
      error: (err)=>{
        console.log(err);
      }
    })
  }


  searchSector(id: number): CompanySector{
    let sector: CompanySector = {
      id: 0,
      name: "",
    }
    this.sectores?.forEach(s=>{
      if(s.id==id){
        sector = s;
      }
    })
    return sector;
  }
  searchSize(id: number): CompanySize{
    let size: CompanySize = {
      id: 0,
      name: "",
    }
    this.sizes?.forEach(s=>{
      if(s.id==id){
        size = s;
      }
    })
    return size;
  }
  openSectorEditModal(id: number){
    const dialogRef = this.dialog.open(SectorFormComponent, {
          data: {
            width: '400px',
            sector: this.searchSector(id),
          }
        });
    
        dialogRef.afterClosed().subscribe((result?: CompanySector) => {

          this.loadSectores();
    
        });
  }
  openSectorCreateModal(){
     const dialogRef = this.dialog.open(SectorFormComponent, {
          data: {
            width: '400px',
          }
        });
    
        dialogRef.afterClosed().subscribe((result?: CompanySector) => {
        

          this.loadSectores();
    
        });
  }


  openSizeEditModal(id: number){
    const dialogRef = this.dialog.open(SizeFormComponent, {
          data: {
            width: '400px',
            size: this.searchSize(id),
          }
        });
    
        dialogRef.afterClosed().subscribe((result?: CompanySize) => {

          this.loadSizes();
    
        });
  }
  openSizeCreateModal(){
     const dialogRef = this.dialog.open(SizeFormComponent, {
          data: {
            width: '400px',
          }
        });
    
        dialogRef.afterClosed().subscribe((result?: CompanySize) => {
        

          this.loadSizes();
    
        });
  }

}
