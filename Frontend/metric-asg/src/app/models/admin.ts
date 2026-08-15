import { User } from "./user"

export interface UserSumary {
    total: number,
    completed_evaluation: number,
    pending_evaluation: number
}

export interface ASGSumary {
    global_average: number
}
export interface UserByMonth {
    month: string,
    count: number
}
export interface SumaryLevel {
    id: number,
    name: string,
    color: string,
    user_count: number
}
export interface SumaryAmbit {
    id: number,
    name: string,
    letter: string,
    color: string,
    maturity_levels:SumaryLevel []
}

export interface Sumary{
    users: UserSumary,
    asg: ASGSumary,
    users_by_month: UserByMonth [],
    ambits: SumaryAmbit []
}

export interface AllUsers{
    users: User [],
    admin: User []
}