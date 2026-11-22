
export interface User {
  id: number;
  name: string | null;
  lastname: string | null;
  position: string | null;

  email: string;
  phone: string | null;

  role: string;
  profile_photo: string | null;

  joined: string | null;
  last_login: string | null;
  active: boolean;
}
