
export enum CompanyRole {
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  ASG_MANAGER = 'ASG_MANAGER',
  COLLABORATOR = 'COLLABORATOR',
  AUDITOR = 'AUDITOR',
}

export enum CompanyMembershipStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface CompanyMember {
  membership_id: number;
  user_id: number;
  name: string | null;
  lastname: string | null;
  email: string;
  position: string | null;
  role: CompanyRole;
  status: CompanyMembershipStatus;
  joined_at: string;
}

export interface UserCompanyMembership {
  membership_id: number;
  company_id: number;
  company_name: string;
  role: CompanyRole;
  joined_at: string;
}
