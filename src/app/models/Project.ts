export class Project {
    id?:number;
    name:string;
    path?:string;
    path_with_namespace?:string;
    created_at?:string;
    web_url?:string;
    last_activity_at?:string;
    empty_repo?:boolean;
    archived?:boolean;
    visibility?:string;
    wiki_enabled?: boolean;
    sessions?:any;
    liveAppSessions?:any;
    members?:any;
    membersInfo?:any;
    /** This user's role in this project ('project_admin' | 'researcher'), from the backend. */
    userProjectRole?:string;
    /** What this user may do in this project, as resolved by the backend. */
    userProjectPermissions?:{
        createInviteCodes?:boolean;
        manageProjectMembers?:boolean;
        editProjectFiles?:boolean;
    };
    spokenLanguage?:string;
    recordingDevice?:string;
    description?:string;
    financers?:string;
    ethicsReviewDnr?:string;
    qualityControlMethods?:string[];
}
