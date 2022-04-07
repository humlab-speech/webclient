import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'
import { Observable, Subject } from 'rxjs';
import { Project } from "../models/Project";
import { ApiResponse } from "../models/ApiResponse";
import { UserService } from './user.service';
import { SystemService } from './system.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})

export class ProjectService {

  private getProjectsUrl:string = '/api/v1/user/project';
  public projects:Project[] = [];
  public projectObs:Observable<Project[]>;
  public projects$:Subject<Project[]>;
  public projectsLoaded:boolean = false;

  constructor(private http:HttpClient, private userService:UserService, private systemService:SystemService) {
    this.projects$ = new Subject<Project[]>();
    this.updateProjects();
  }

  fetchProjectSessions(projectId:number, includeBundles:boolean = true):Observable<any> {

    let sessions = [];

    return new Observable<any>(subscriber => {
      let headers = {
        "PRIVATE-TOKEN": this.userService.getSession().personalAccessToken
      };
      let filePath = encodeURIComponent("Data/VISP_emuDB");
      let requestUrl = "https://gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/tree?path="+filePath;
  
      this.http.get<any>(requestUrl, { "headers": headers } ).subscribe(dir => {
        //find all _ses directories - these are sessions
        dir.forEach(dirItem => {
          let regMatch = /(.*)_ses/.exec(dirItem.name);
          if(regMatch != null) {
            sessions.push({
              sessionName: regMatch[1],
              sessionDir: regMatch[0]
            });
          }
        });

        if(includeBundles) {
          let bundleFetchPromises = [];
          sessions.forEach(session => {
            let p = this.fetchSessionBundles(projectId, session.sessionName);
            bundleFetchPromises.push(p);
            p.then(bundles => {
              session.bundles = bundles;
              console.log(bundles)
            })
          });
          
          /*

          let bundleFetchPromises = [];
          sessions.forEach(session => {
            let p = new Promise<void>((resolve, reject) => {
              this.fetchSessionBundles(projectId, session.sessionName).subscribe(bundles => {
                session.bundles = bundles;
                resolve();
              });
            });
            bundleFetchPromises.push(p);
          });
          */

          Promise.all(bundleFetchPromises).then(() => {
            console.log("RETURNING")
            subscriber.next(sessions);
            subscriber.complete();
          });
          
        }
        else {
          subscriber.next(sessions);
          subscriber.complete();
        }

      });
    });
  }

  fetchSessionBundles(projectId:number, sessionName:string) {
    return new Promise<any>((resolve, reject) => {
      let headers = {
        "PRIVATE-TOKEN": this.userService.getSession().personalAccessToken
      };
      let filePath = encodeURIComponent("Data/VISP_emuDB/"+sessionName+"_ses");
      let requestUrl = "https://gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/tree?path="+filePath;

      let bundles = [];

      this.http.get<any>(requestUrl, { "headers": headers } ).subscribe(dir => {
        dir.forEach(dirItem => {
          let regMatch = /(.*)_bndl/.exec(dirItem.name);
          if(regMatch != null) {
            bundles.push({
              bundleName: regMatch[1],
              bundleDir: regMatch[0]
            });
          }
        });
        
        resolve(bundles);
      });
      
    });
  }

  fetchBundleList(project, username = null) {
    let userSession = this.userService.getSession();
    if(username == null) {
      username = userSession.username;
    }
    let headers = {
      "PRIVATE-TOKEN": userSession.personalAccessToken
    };
    let filePath = encodeURIComponent("Data/VISP_emuDB/bundleLists/"+username+"_bundleList.json");
    let requestUrl = "https://gitlab."+window.location.hostname+"/api/v4/projects/"+project.id+"/repository/files/"+filePath+"?ref=master";

    return this.http.get<any>(requestUrl, { "headers": headers });
  }

  loadProject(project) {
    return new Observable<any>(subscriber => {

      subscriber.next({
        status: "loading",
        msg: "Fetching project session"
      });

      let sessionAccessCode = null;

      this.fetchSession(project).subscribe(msg => {
        let msgData = JSON.parse(msg.data);
        if(msgData.type == "cmd-result" && msgData.cmd == "fetchSession") {
          if(msgData.progress == "end") {
            sessionAccessCode = msgData.result;

            subscriber.next({
              status: "loading",
              message: "Scanning EmuDB"
            });

            this.scanEmuDb(sessionAccessCode).subscribe(msg => {
              let cmdResponse = JSON.parse(msg.data);
              let apiResponse = JSON.parse(cmdResponse.result);
              //this.storedEmuDb = apiResponse.body;

              subscriber.next({
                status: "end",
                message: "Done"
              });

              subscriber.complete();
            });
          }
          else {
            subscriber.next({
              status: "loading",
              message: msgData.result
            });
          }
        }
      });
    });
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
            this.projectsLoaded = true;
            sub.next(this.projects);
            this.projects$.next(this.projects);
            sub.complete();
          }
          else {
            console.log("Failed loading projects!", response);
            sub.next(this.projects);
            this.projectsLoaded = false;
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
        this.projects$.next(this.projects);
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
    return this.http.get<any>('https://gitlab.'+window.location.hostname+'/api/v4/projects/'+projectId+'/members', { "headers": headers });
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
    return this.http.get<ApiResponse>('https://'+environment.BASE_DOMAIN+'/api/v1/user/project/'+projectId+'/session').subscribe((response:any) => {
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
      this.http.post<ApiResponse>(environment.API_ENDPOINT+'/api/v1/user/project/delete', "data="+JSON.stringify(body), { headers }).subscribe((response) => {
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

  addProjectMember(projectId, userId) {
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    //This call needs to be done via the WebAPI since it requires admin privileges
    let body = {
      projectId: projectId,
      userId: userId
    }
    return this.http.post<ApiResponse>(environment.API_ENDPOINT+'/api/v1/project/member/add', "data="+JSON.stringify(body), { headers });
  }

  removeProjectMember(projectId, userId) {
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    //This call needs to be done via the WebAPI since it requires admin privileges
    let body = {
      projectId: projectId,
      userId: userId
    }
    return this.http.post<ApiResponse>(environment.API_ENDPOINT+'/api/v1/project/member/del', "data="+JSON.stringify(body), { headers });
  }

  /**
   * This turned out to be a bad way to go since you can't (for some reason) send rapid file-write-requests to gitlab
   * @param projectId 
   * @param username 
   * @param bundleList 
   * @param updateOrCreate 
   * @returns 
   */
  async updateBundleList(projectId, username, bundleList, updateOrCreate = "update") {
    let headers = {
      "PRIVATE-TOKEN": this.userService.getSession().personalAccessToken,
      "Content-Type": "application/json"
    };
    let filePath = "Data/VISP_emuDB/bundleLists/"+username+"_bundleList.json";
    let fileContent = JSON.stringify(bundleList);

    //Check if the bundlelist json file exists, if it doesn't this needs to be a create operation instead of an update operation
    let action = {
      "action": "update",
      "file_path": filePath,
      "content": fileContent
    };
    if(updateOrCreate == "create") {
      action = {
        "action": "create",
        "file_path": filePath,
        "content": fileContent
      }
    }
    
    /*
    let requestUrl = "https://gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/files/="+encodeURIComponent(filePath);
    await new Promise((resolve, reject) => {
      this.http.get<any>(requestUrl, { "headers": headers } ).subscribe(file => {
        console.log(file);
      });
    });
    */
    let data = {
      "branch": "master",
      "commit_message": "system-commit",
      "actions": [action]
    };

    //"data="+JSON.stringify(data)

    return new Promise((resolve, reject) => {
      this.http.post<any>('https://gitlab.'+window.location.hostname+'/api/v4/projects/'+projectId+'/repository/commits', JSON.stringify(data), { "headers": headers }).subscribe(result => {
        console.log(result);
      }, error => {
        console.log(error);
        //There seems to be a rate-limit to these requests, so if it fails just try again until it goes through
        //this.updateBundleList(projectId, username, bundleList);
        setTimeout(() => { //This is so stupid
          this.updateBundleList(projectId, username, bundleList);
        }, 100+Math.random()*1000)
      });
    });
  }

  updateBundleLists(sessionAccessCode:string, projectMembers) {

    let bundleLists = [];
    projectMembers.forEach(member => {
      let bundleList = {
        userId: member.id,
        username: member.username,
        bundles: member.bundleList
      };
      bundleLists.push(bundleList);
      member.bundles.forEach(bundle => {
        bundleList.bundles.push(bundle);
      });
    });

    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((msg:any) => {
        let progressSteps = null; //Total number of progress steps for this op, hopefully the server will supply this in the first message/step
        let progress = "0";
        if(msg.data) {
          let data = JSON.parse(msg.data);
          if(data.type == "cmd-result" && data.cmd == "updateBundleLists") {
            let regExpResult = /([0-9]*)\/([0-9]*)/.exec(data.progress);
            if(regExpResult != null) {
              progress = regExpResult[1];
              progressSteps = regExpResult[2];
            }
            else {
              progress = data.progress;
            }
            
            subscriber.next(msg);
            if(progress == progressSteps || progressSteps == null) {
              subscriber.complete();
            }
            
          }
        }
      });

      this.systemService.ws.send(JSON.stringify({
        type: 'cmd',
        cmd: 'updateBundleLists',
        data: bundleLists,
        sessionAccessCode: sessionAccessCode
      }));
    });

  }

}