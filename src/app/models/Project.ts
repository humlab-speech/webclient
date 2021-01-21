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
    owner?:object;
    wiki_enabled?: boolean;
    sessions?:any;
}