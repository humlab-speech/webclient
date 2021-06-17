import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'
import { Observable, Subject } from 'rxjs';
import { Project } from "../models/Project";
import { ApiResponse } from "../models/ApiResponse";
import { UserService } from './user.service';
import { Config } from '../config';

@Injectable({
  providedIn: 'root'
})

export class ProjectService {

  private getProjectsUrl:string = '/api/v1/user/project';
  private _projectSource = new Subject<Project[]>();
  public projects$ = this._projectSource.asObservable();
  public projects:Project[] = [];
  public projectObs:Observable<Project[]>;

  constructor(private http:HttpClient, private userService:UserService) {
    this.updateProjects();
  }

  updateProjects() {
    return new Promise((resolve, reject) => {
      this._fetchProjects().subscribe(response => {
        if(response.code == 401) {
        }
        this.projects = <Project[]>response.body;
        this._projectSource.next(this.projects);
        resolve(this.projects);
      });
    });
  }

  _fetchProjects():Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.getProjectsUrl);
  }

  getProjects():Project[] {
    return this.projects;
  }

  fetchProjectMembers(projectId) {
    let headers = {
      "PRIVATE-TOKEN": this.userService.getSession().personalAccessToken
    };
    return this.http.get<ApiResponse>('https://gitlab.'+window.location.hostname+'/api/v4/projects/'+projectId+'/users', { "headers": headers });
  }

  async createProject(formValues:object, formContextId:string):Promise<any> {
    window.dispatchEvent(new Event("project-create-in-progress"));

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      form: formValues,
      context: formContextId
    };

    return new Promise((resolve, reject) => {
      this.http.post<ApiResponse>(Config.API_ENDPOINT+'/api/v1/user/project', "data="+JSON.stringify(body), { headers }).subscribe((response:any) => {
        this.updateProjects().then(() => {
          window.dispatchEvent(new Event("project-create-done"));
        });
        resolve(response);
      });
    });
  }

  emuSessionNameIsAvailable(project, sessionName) {
    return this.http.get('/api/v1/availibility/project/'+project.id+'/session/'+sessionName);
  }

  /**
   * Function: addSessions
   * Add sessions to an existing project
   */
  addSessions(projectId:number, formValues:object, formContextId:string):Observable<any> {
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: projectId,
      form: formValues,
      context: formContextId
    };

    return new Observable((observer) => {
      this.http.post<ApiResponse>(Config.API_ENDPOINT+'/api/v1/user/project/add', "data="+JSON.stringify(body), { headers }).subscribe((response:any) => {
        observer.next(response)
        //return response;
      });
    });
  }

  async getSession(projectId) {
    return this.http.get<ApiResponse>('https://'+Config.BASE_DOMAIN+'/api/v1/user/project/'+projectId+'/session').subscribe((response:any) => {
      console.log(response);
      return response;
    });
  }

  deleteProject(project:Project) {
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: project.id
    };

    return new Observable((observer) => {
      this.http.post<ApiResponse>(Config.API_ENDPOINT+'/api/v1/user/project/delete', "data="+JSON.stringify(body), { headers }).subscribe((response) => {
        console.log(response);
        this.updateProjects();
      });
    });
   }
}