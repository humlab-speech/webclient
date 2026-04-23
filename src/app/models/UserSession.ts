export class UserSession {
    id:number;
    firstName:string;
    lastName:string;
    fullName:string;
    email:string;
    eppn:string;
    username:string;
    privileges:any;
    loginCount?: number;
    lastLoginAt?: string;
    previousLoginAt?: string;
    lastLoginDurationSeconds?: number;
}
