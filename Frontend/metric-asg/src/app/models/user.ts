export interface User {
  id: number;
  name: string | null;
  lastname: string | null;
  position: string | null; 

  company_name: string;
  company_sector_id: number | null;
  company_size_id: number | null;

  email: string;
  phone: string | null;


  role: string;

  profile_photo: string | null;
  joined: string;
  last_login: string;
  biannual_evaluation: boolean;
  active: boolean;
  next_evaluation: string;
}
