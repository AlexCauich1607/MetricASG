
import { CompanyRole } from './company_membership';

export type CompanyInvitationStatus =
    | 'PENDING'
    | 'ACCEPTED'
    | 'REVOKED'
    | 'EXPIRED';

export interface CompanyInvitationCreate {
    company_id: number;
    email: string;
    role: CompanyRole;
}

export interface CompanyInvitation {
    id: number;
    company_id: number;
    invited_by_user_id: number;
    email: string;
    role: CompanyRole;
    status: CompanyInvitationStatus;
    created_at: string;
    expires_at: string;
    accepted_at: string | null;
    last_resent_at: string | null;
}

export interface CompanyInvitationAccept {
    token: string;
}
