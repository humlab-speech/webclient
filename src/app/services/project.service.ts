import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, Subject } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
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
    this._fetchProjects().subscribe(response => {
      this.projects = <Project[]>response.body;
      this._projectSource.next(this.projects);
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

  createProject(formValues:object, createProjectContextId:string) {
    window.dispatchEvent(new Event("project-create-in-progress"));

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      form: formValues,
      context: createProjectContextId
    };

    console.log("Posting project");
    this.http.post<ApiResponse>(Config.API_ENDPOINT+'/api/v1/user/project', "data="+JSON.stringify(body), { headers }).subscribe((response:any) => {
      console.log(response);
      this.updateProjects();
      console.log(JSON.parse(response.body));
      window.dispatchEvent(new Event("project-create-done"));
    });
    console.log("Project posted");
  }
  /*
  createProject(name:string, genEmuDb:boolean, createProjectContextId:string, annotStruct:object) {
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      name: name,
      genEmuDb: genEmuDb,
      context: createProjectContextId,
      annotStruct: annotStruct
    };

    return new Observable((observer) => {
      this.http.post<ApiResponse>(Config.API_ENDPOINT+'/api/v1/user/project', "data="+JSON.stringify(body), { headers }).subscribe((response:any) => {
        //console.log(response);
        this.updateProjects();
        observer.next(response);

        console.log(JSON.parse(response.body));

      });
    });
  }
  */

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