export class UserSession {
    id:number;
    firstName:string;
    lastName:string;
    fullName:string;
    email:string;
    eppn:string;
    username:string;
    loginAllowed:boolean;
    /** System-level role: 'sys_admin' or 'user'. See models/Role.ts. */
    system_role?:string;
    loginCount?: number;
    lastLoginAt?: string;
    previousLoginAt?: string;
    lastLoginDurationSeconds?: number;
}
