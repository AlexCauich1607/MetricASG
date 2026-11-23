export interface AuthUserResponse {
    id: number,
    name: string,
    profile_photo: string | null,
    role: string,
    email: string,
    last_login: string
}

export interface RefreshToken{
    token: string,
}
export interface AuthResponse {
    access_token: string
    token_type: string,
    user: AuthUserResponse,
}


export interface ChangePassword{
  id_user: number,
  new_password: string,
  bf_password: string
}

export interface PersonalUserRegister {
    name: string;
    lastname: string;
    position: string;
    email: string;
    phone: string;
    password: string;
}

export interface UserLogin {
    email: string,
    password: string
}

export interface AdminRegister {
  name: string;
  lastname: string;
  email: string;
  password: string;
}