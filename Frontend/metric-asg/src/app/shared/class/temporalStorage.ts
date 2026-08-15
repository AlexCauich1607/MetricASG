import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class SessionService {

    setSessionItem(key: string, value: any): void {
        sessionStorage.setItem(key, JSON.stringify(value));
    }


    static setSessionItem(key: string, value: any): void {
        sessionStorage.setItem(key, JSON.stringify(value));
    }

    getSessionItem(key: string): any {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }

    static getSessionItem(key: string): any {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }

    removeSessionItem(key: string): void {
        sessionStorage.removeItem(key);
    }

    static removeSessionItem(key: string): void {
        sessionStorage.removeItem(key);
    }
    static logout(){
        this.removeSessionItem('user');
        this.removeSessionItem('role');
        this.removeSessionItem('token');
        this.removeSessionItem('first-time');
        this.removeSessionItem('company');
        this.removeSessionItem('id');
        this.removeSessionItem('photo');
    }
}