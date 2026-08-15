export interface AuthUserResponse {
    id: number,
    name: string,
    company_name: string,
    profile_photo: string,
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

export interface UserRegister {
    name: string,
    lastname: string,
    position: string,
    company_name: string,
    company_sector_id: number,
    company_size_id: number,
    email: string,
    phone: string,
    password: string,
}

export interface UserLogin {
    email: string,
    password: string
}


