import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, Subject } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { Project } from "../models/Project";
import { ApiResponse } from "../models/ApiResponse";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {

  private getProjectsUrl:string = '/api/v1/user/project';
  private _projectSource = new Subject<Project[]>();
  public projects$ = this._projectSource.asObservable();
  public projects:Project[] = [];
  public projectObs:Observable<Project[]>;

  constructor(private http:HttpClient) {
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

  /*
  fetchProjects():Observable<Project[]> {
    console.log("fetchProjects");
    this.projectObs = new Observable((observer) => {
      let obs = this._fetchProjects();
      obs.subscribe((fetchedProjects) => {
        this.projects = fetchedProjects;
        observer.next(fetchedProjects);
        observer.complete();
      }, (error) => {
        console.log(error);
      });
    });

    return this.projectObs;
  }
  */

  createProject(name:string, genEmuDb:boolean) {
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      name: name,
      genEmuDb: genEmuDb
    };

    return new Observable((observer) => {
      this.http.post<ApiResponse>('https://localtest.me/api/v1/user/project', "data="+JSON.stringify(body), { headers }).subscribe((response) => {
        console.log(response);
        this.updateProjects();
        /*
        observer.next(response);

        this.projectObs.subscribe((projects:Project[]) => {
          this.projects = projects;
        });
        */

      });
    });

    /*
    .pipe(mergeMap((data:any) => {
      console.log(data);
      return data;
    }));
    */
  }

  deleteProject(project:Project) {
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: project.id
    };

    return new Observable((observer) => {
      this.http.post<ApiResponse>('https://localtest.me/api/v1/user/project/delete', "data="+JSON.stringify(body), { headers }).subscribe((response) => {
        console.log(response);
        this.updateProjects();
      });
    });
   }
}