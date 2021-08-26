import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'
import { Observable, Subject } from 'rxjs';
import { Project } from "../models/Project";
import { ApiResponse } from "../models/ApiResponse";
import { UserService } from './user.service';
import { SystemService } from './system.service';
import { Config } from '../config';

@Injectable({
  providedIn: 'root'
})

export class ProjectService {

  private getProjectsUrl:string = '/api/v1/user/project';
  private _projectSource = new Subject<Project[]>();
  public projects:Project[] = [];
  public projectObs:Observable<Project[]>;
  public projects$:Subject<Project[]>;
  public projectsLoaded:boolean = false;

  constructor(private http:HttpClient, private userService:UserService, private systemService:SystemService) {
    this.updateProjects();
  }

  fetchProjects(forceNewFetch:boolean = false) {
    return new Observable(sub => {
      if(this.projectsLoaded && !forceNewFetch) {
        sub.next(this.projects);
        sub.complete();
      }
      else {
        this.http.get<ApiResponse>(this.getProjectsUrl).subscribe(response => {
          if(response.code == 200) {
            this.projects = <Project[]>response.body;
            sub.next(this.projects);
            sub.complete();
          }
          else {
            console.log("Failed loading projects!", response);
            sub.next(this.projects);
            sub.complete();
          }
        });
      }
    });
  }

  updateProjects() {
    return new Promise((resolve, reject) => {
      this._fetchProjects().subscribe(response => {
        if(response.code == 401) {
        }
        this.projects = <Project[]>response.body;
        this.projectsLoaded = true;
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


  /**
   * fetchSession
   * 
   * @param project 
   */
  fetchSession(project = null, context = null) {
    let body = {
      user: this.userService.getSession(),
      project: project,
      context: context
    };

    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((msg:any) => {
        let data = JSON.parse(msg.data);
        if(data.cmd == "fetchSession") {
          subscriber.next(msg);
        }
      });

      this.systemService.ws.send(JSON.stringify({
        type: 'cmd',
        cmd: 'fetchSession',
        data: JSON.stringify(body)
      }));
    });
  }

  shutdownSession(sessionAccessCode) {
    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((msg:any) => {
        let data = JSON.parse(msg.data);
        if(data.type == "cmd-result" && data.cmd == "shutdownSession") {
          subscriber.next(msg);
          if(data.progress == "end") {
            subscriber.complete();
          }
        }
      });

      this.systemService.ws.send(JSON.stringify({
        type: 'cmd',
        cmd: 'shutdownSession',
        sessionAccessCode: sessionAccessCode
      }));
    });
  }

  createProject(formValues:object, formContextId:string):Observable<any> {
    window.dispatchEvent(new Event("project-create-in-progress"));

    let body = {
      form: formValues,
      context: formContextId
    };

    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((data:any) => {
        console.log(data);
        subscriber.next(data);
      });

      this.systemService.ws.send(JSON.stringify({
        type: 'cmd',
        cmd: 'createProject',
        data: body
      }));
    });
  }

  /**
   * Function: addSessions
   * Add sessions to an existing project
   */
  addSessions(projectId:number, formValues:object, formContextId:string, sessionAccessCode:string):Observable<any> {
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: projectId,
      form: formValues,
      context: formContextId,
      sessionAccessCode: sessionAccessCode
    };

    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((msg:any) => {
        console.log(msg);
        let data = JSON.parse(msg.data);
        if(data.type == "cmd-result" && data.cmd == "addSessions") {
          subscriber.next(msg);
          if(data.progress == "end") {
            subscriber.complete();
          }
        }
      });

      this.systemService.ws.send(JSON.stringify({
        type: 'cmd',
        cmd: 'addSessions',
        data: body
      }));
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

   scanEmuDb(sessionAccessCode:string) {
    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((msg:any) => {
        if(msg.data) {
          let data = JSON.parse(msg.data);
          if(data.type == "cmd-result" && data.cmd == "scanEmuDb") {
            subscriber.next(msg);
            subscriber.complete();
          }
        }
      });

      this.systemService.ws.send(JSON.stringify({
        type: 'cmd',
        cmd: 'scanEmudb',
        sessionAccessCode: sessionAccessCode
      }));
    });
  }

}