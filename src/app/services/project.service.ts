import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'
import { forkJoin, Observable, Subject } from 'rxjs';
import { Project } from "../models/Project";
import { ApiResponse } from "../models/ApiResponse";
import { UserService } from './user.service';
import { SystemService } from './system.service';
import { environment } from 'src/environments/environment';
import Cookies from 'js-cookie';
import { NotifierService } from 'angular-notifier';
import { nanoid } from 'nanoid';
import {
  FormGroup,
  FormControl,
  FormArray,
} from '@angular/forms';

@Injectable({
  providedIn: 'root'
})

export class ProjectService {

  private getProjectsUrl:string = '/api/v1/user/project';
  public projects:Project[] = [];
  public projectObs:Observable<Project[]>;
  public projects$:Subject<Project[]>;
  public projectsLoaded:boolean = false;
  public loadingStatus$:Subject<string>;

  constructor(private http:HttpClient, private userService:UserService, private systemService:SystemService, private notifierService:NotifierService) {
    this.projects$ = new Subject<Project[]>();
    this.loadingStatus$ = new Subject<string>();
    this.updateProjects();
  }

  /*
  fetchGitlabToken() {
    let requestUrl = window.location.protocol+"//"+window.location.hostname+"/api/v1/gitlabtoken";
      let bundles = [];
      let headers = {
        "PRIVATE-TOKEN": this.userService.getSession().personalAccessToken
      };

      
      //fetch("https://visp.local/api/v1/gitlabtoken").then(data => data.json().then(json => console.log(json)));
      

      return this.http.get<any>(requestUrl, { "headers": headers } ).subscribe(gitlabToken => {
        return gitlabToken;
      });
  }
  */


  fetchDbConfig(projectId:number) {
    let headers = {
      "PRIVATE-TOKEN": this.userService.getSession().personalAccessToken
    };

    let filePath = encodeURIComponent("Data/VISP_emuDB/VISP_DBconfig.json");
    let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/files/"+filePath+"?ref=master";

    return this.http.get<any>(requestUrl, { "headers": headers } );
  }

  fetchSprData(projectId:number) {
    //fetch speech recorder db data via the session-manager
    return this.systemService.sendCommandToBackend({ cmd: "fetchSprData", projectId: projectId }).then((data) => {
      console.log(data);
    });
  }

  fetchSprSession(sprSessionId) {
    return new Observable<any>(subscriber => {

      let data = { 
        cmd: "fetchSprSession",
        data: {
          sprSessionId: sprSessionId
        }
      };

      this.systemService.sendCommandToBackend(data).then((data) => {
        subscriber.next(data);
        subscriber.complete();
      });
    });
  }

  fetchSprScriptBySessionId(sprSessionId) {

    //Warning: if this is called for several sprSessionIds in a row, it will return the latest since the responses gets mixed up

    return new Observable<any>(subscriber => {
      let data = { 
        cmd: "fetchSprScriptBySessionId",
        data: {
          sprSessionId: sprSessionId
        }
      };

      this.systemService.sendCommandToBackend(data).then((data) => {
        subscriber.next(data);
        subscriber.complete();
      });
    });
  }

  fetchEmuDbInProject(projectId:number, includeBundles:boolean = true, includeSprData:boolean = true) {
    let project = {
      dbConfig: null,
      sessions: null
    };
    
    const totalRequests = 2;
    let requestsComplete = 0;

    return new Observable<any>(subscriber => {

      forkJoin({
        dbConfig: this.fetchDbConfig(projectId),
        sessions: this.fetchSessions(projectId, includeBundles),
        spr: this.fetchSprData(projectId)
      }).subscribe({ 
        next: (data:any) => {
          if(data.dbConfig.encoding == "base64") {
            project.dbConfig = JSON.parse(atob(data.dbConfig.content));
          }
          else {
            project.dbConfig = JSON.parse(data.dbConfig.content);
          }
  
          project.sessions = data.sessions;
          subscriber.next(project);
          subscriber.complete();
        },
        error: err => {
          this.notifierService.notify("warning", "This project doesn't seem to have been intialized as an EMU-DB project.")
        }
      });
    });

    

    
    /*
    return new Observable<any>(subscriber => {
      this.fetchDbConfig(projectId).subscribe({
        next: data => {
          if(data.encoding == "base64") {
            project.dbConfig = JSON.parse(atob(data.content));
          }
          else {
            project.dbConfig = JSON.parse(data.content);
          }

          requestsComplete++;
          if(requestsComplete == totalRequests) {
            subscriber.next(project);
          }
        },
        error: err => {
          this.notifierService.notify("warning", "This project doesn't seem to have been intialized as an EMU-DB project.")
        }
      });
  
      this.fetchSessions(projectId, includeBundles).subscribe({
        next: data => {
          project.sessions = data;
          requestsComplete++;
          if(requestsComplete == totalRequests) {
            subscriber.next(project);
            subscriber.complete();
          }
        }
      });
    });
    */
  }

  fetchSessions(projectId:number, includeBundles:boolean = true) {
    let headers = {
      "PRIVATE-TOKEN": this.userService.getSession().personalAccessToken
    };
    let filePath = encodeURIComponent("Data/VISP_emuDB");
    let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/tree?path="+filePath;

    let sessions = [];

    return new Observable<any>(subscriber => {
      this.http.get<any>(requestUrl, { "headers": headers } ).subscribe({
        next: (dir) => {
          //find all _ses directories - these are sessions
          dir.forEach(dirItem => {
            let regMatch = /(.*)_ses/.exec(dirItem.name);
            if(regMatch != null) {
              let session = {
                sessionName: regMatch[1],
                sessionDir: regMatch[0],
                meta: null
              };
              sessions.push(session);

              //Fetch: Speaker_1.meta_json
              filePath = encodeURIComponent("Data/VISP_emuDB/"+session.sessionDir+"/"+session.sessionName+".meta_json");
              let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/files/"+filePath+"?ref=master";
              this.http.get<any>(requestUrl, { "headers": headers } ).subscribe({
                next: sessionMeta => {
                  if(sessionMeta.encoding == "base64") {
                    session.meta = JSON.parse(atob(sessionMeta.content));
                  }
                  else {
                    session.meta = JSON.parse(sessionMeta.content);
                  }
                },
                error: err => {
                  if(err.status == 404) {
                    //No session metadata
                    session.meta = null;
                  }
                  else {
                    this.notifierService.notify("error", "There was an error fetching session metadata from GitLab: "+err.error.message);
                  }
                }
              });

            }
          });
  
          if(includeBundles) {
            let bundleFetchPromises = [];
            sessions.forEach(session => {
              /*
              filePath = encodeURIComponent("Data/VISP_emuDB/"+session.sessionDir);
              requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/tree?path="+filePath;;
              this.http.get<any>(requestUrl, { "headers": headers } ).subscribe({
                next: bundleDirs => {
                  console.log(bundleDirs);
                }
              });
              */
  
              let p = this.fetchSessionBundles(projectId, session.sessionName);
              bundleFetchPromises.push(p);
              p.then(bundles => {
                session.bundles = bundles;
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
              subscriber.next(sessions);
              subscriber.complete();
            });
            
          }
          else {
            subscriber.next(sessions);
            subscriber.complete();
          }
        },
        error: (error) => {
          subscriber.next(null);
          subscriber.complete();
        }
      });
    });

    
  }

  

  fetchProjectSessions(projectId:number, includeBundles:boolean = true):Observable<any> {

    let sessions = [];

    return new Observable<any>(subscriber => {
      let headers = {
        "PRIVATE-TOKEN": this.userService.getSession().personalAccessToken
      };
      let filePath = encodeURIComponent("Data/VISP_emuDB");
      let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/tree?path="+filePath;
  
      let observer = {
        next: (dir) => {
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
              subscriber.next(sessions);
              subscriber.complete();
            });
            
          }
          else {
            subscriber.next(sessions);
            subscriber.complete();
          }
        },
        error: (error) => {
          subscriber.next(null);
          subscriber.complete();
        }
      }

      this.http.get<any>(requestUrl, { "headers": headers } ).subscribe(observer);
    });
  }

  fetchSessionBundles(projectId:number, sessionName:string) {
    return new Promise<any>((resolve, reject) => {
      let headers = {
        "PRIVATE-TOKEN": this.userService.getSession().personalAccessToken
      };
      let filePath = encodeURIComponent("Data/VISP_emuDB/"+sessionName+"_ses");
      let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/tree?path="+filePath;

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
    let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+project.id+"/repository/files/"+filePath+"?ref=master";

    return this.http.get<any>(requestUrl, { "headers": headers });
  }

  async fetchProject(projectId:number) {
    return new Promise((resolve, reject) => {
      let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+projectId;
      let headers = {
        'PRIVATE-TOKEN': this.userService.getSession().personalAccessToken
      }
      this.http.get<any>(requestUrl, { headers }).subscribe(response => {
        resolve(response);
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
    return this.http.get<any>(window.location.protocol+'//gitlab.'+window.location.hostname+'/api/v4/projects/'+projectId+'/members', { "headers": headers });
  }


  /**
   * fetchSession
   * 
   * @param project 
   */
  fetchSession(project = null, context = null, options = []) {
    let body = {
      user: this.userService.getSession(),
      project: project,
      options: options,
      context: context
    };

    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((data:any) => {
        if(data.cmd == "fetchSession") {
          subscriber.next(data);
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
      this.systemService.wsSubject.subscribe((data:any) => {
        if(data.type == "cmd-result" && data.cmd == "shutdownSession") {
          subscriber.next(data);
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

  createProjectOLD(formValues:object, formContextId:string):Observable<any> {
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

  async readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
    
      reader.onload = (event) => {
        const base64AudioData = event.target.result;
        resolve(base64AudioData);
      };

      reader.readAsDataURL(file);
    });
  }

  async pushSessions(projectId:number, sessions) {
    console.log(projectId, sessions);

    //let repoEntries = await this.gitlabGetRepoTree(projectId);
    //console.log(repoEntries);


    let commitActions = [];
    let commitData = {
      "branch": "master",
      "commit_message": "updated sessions from visp interface",
      "author_name": "VISP System",
      "actions": commitActions
    }

    let readFilePromises = [];

    //TODO: see if there's any session in the repo that no longer exists in this form array, if so it should be deleted from the repo

    for(let key in sessions.controls) {
      let sessionName = sessions.controls[key].controls.name.value;
      if(sessions.controls[key].controls.new.value && sessions.controls[key].controls.dataSource.value == "record") {
        console.log(sessions.controls[key].controls.recordingLink.value);

        
      }
      
      /* not implementing 'delete' atm since it requires manually doing a per-file recursive delete
      if(sessions.controls[key].controls.deleted.value) {
        let action = "delete";
        commitActions.push({
          "action": action,
          "file_path": "Data/VISP_emuDB/"+sessionName+"_ses",
        });
      }
      */


      if(!sessions.controls[key].controls.deleted.value) {
        //if not marked for deletion, handle any newly added files
        sessions.controls[key].controls.files.value.forEach(file => {
          if(file instanceof File) { //if instance of File, then it is a new file that needs to be committed
            let p = this.readFileAsDataURL(file);
            readFilePromises.push(p);
    
            p.then(base64AudioData => {
              let b64 = <string>base64AudioData;
              b64 = b64.substring(b64.indexOf("base64,")+7); //Remove prefix/meta data
    
              let action = "create";
              let fileBaseName = file.name.substring(0, file.name.indexOf("."));
              commitActions.push({
                "action": action,
                "file_path": "Data/VISP_emuDB/"+sessions.controls[key].controls.name.value+"_ses/"+fileBaseName+"_bndl/"+file.name,
                "content": b64,
                "encoding": "base64"
              });
            });
          }
        });

        //TODO: check if any files have been removed from the session, and if so, delete them from the repo as well

      }

    }
    

    await Promise.all(readFilePromises);
    console.log(commitData);

    
    //Perform committing/uploading of audio files to gitlab
    
    this.gitlabCommit(projectId, commitData).subscribe({
      next: result => {
        console.log(result);
        this.notifierService.notify("info", "Saved sessions.");
      },
      error: err => {
        console.error(err);
        this.notifierService.notify("error", "There was an error saving your sessions to GitLab.");
      }
    });
    
    //TODO: After committing new audio files, we still need to generate the emu metadata files .f0 and .fms and _annot.json
    //but we need an emuDB-container for that
    
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
      this.systemService.wsSubject.subscribe((data:any) => {
        console.log(data);
        if(data.type == "cmd-result" && data.cmd == "addSessions") {
          subscriber.next(data);
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
    return this.http.get<ApiResponse>(window.location.protocol+'//'+environment.BASE_DOMAIN+'/api/v1/user/project/'+projectId+'/session').subscribe((response:any) => {
      console.log(response);
      return response;
    });
  }

  deleteProject(project:Project) {
    let gitlabToken = Cookies.get("GitlabToken");
    if(typeof gitlabToken == "undefined") {
      gitlabToken = this.userService.getSession().personalAccessToken;
      Cookies.set("GitlabToken", gitlabToken, { domain: window.location.hostname, secure: true, sameSite: 'None' });
    }

    let requestUrl = "https://gitlab."+window.location.hostname+"/api/v4/projects/"+project.id;
    
    let headers = {
      'Content-Type': 'application/json',
      'PRIVATE-TOKEN': gitlabToken
    };
    
    return this.http.delete<ApiResponse>(requestUrl, { headers });
    /*
    let headers = {
      'Content-Type': 'application/json'
    };
    let body = {
      projectId: project.id
    };

    return this.http.post<ApiResponse>("https://"+window.location.hostname+"/api/v1/user/project/delete", "data="+JSON.stringify(body), { headers }).subscribe((response) => {
      console.log(response);
      this.updateProjects();
    });
    */
   }

   scanEmuDb(sessionAccessCode:string) {
    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((data:any) => {
        if(data) {
          if(data.type == "cmd-result" && data.cmd == "scanEmuDb") {
            subscriber.next(data);
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
    let gitlabToken = Cookies.get("GitlabToken");
    if(typeof gitlabToken == "undefined") {
      gitlabToken = this.userService.getSession().personalAccessToken;
      Cookies.set("GitlabToken", gitlabToken, { domain: window.location.hostname, secure: true, sameSite: 'None' });
    }

    let requestUrl = "https://gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/members";
    
    let headers = {
      'Content-Type': 'application/json',
      'PRIVATE-TOKEN': gitlabToken
    };

    let body = {
      user_id: userId,
      access_level: 30
    }

    return this.http.post<ApiResponse>(requestUrl, body, { headers });
  }

  removeProjectMember(projectId, userId) {
    let gitlabToken = Cookies.get("GitlabToken");
    if(typeof gitlabToken == "undefined") {
      gitlabToken = this.userService.getSession().personalAccessToken;
      Cookies.set("GitlabToken", gitlabToken, { domain: window.location.hostname, secure: true, sameSite: 'None' });
    }
    let headers = {
      'Content-Type': 'application/json',
      'PRIVATE-TOKEN': gitlabToken
    };

    let requestUrl = "https://gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/members/"+userId;

    return this.http.delete<ApiResponse>(requestUrl, { headers });
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
    let fileContent = JSON.stringify(bundleList, null, 2);

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
    
    let data = {
      "branch": "master",
      "commit_message": "system-commit",
      "actions": [action]
    };

    //"data="+JSON.stringify(data)

    return new Promise((resolve, reject) => {
      this.http.post<any>(window.location.protocol+'//gitlab.'+window.location.hostname+'/api/v4/projects/'+projectId+'/repository/commits', JSON.stringify(data), { "headers": headers }).subscribe(result => {
        console.log(result);
        resolve(result);
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

  async gitlabGetRepoTree(projectId, page = 1, tree = []) {
    let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/tree?recursive=true&page="+page+"&per_page=100";
    let headers = {
      'PRIVATE-TOKEN': this.userService.getSession().personalAccessToken
    }

    let repoTree = [];

    let filesList = await new Promise((resolve, reject) => {
      this.http.get(requestUrl, { headers, observe: 'response' }).subscribe({
        next: async data => {
          tree = tree.concat(data.body);
          if(parseInt(data.headers.get('x-page')) < parseInt(data.headers.get('x-total-pages'))) {
            //do the next request
            let nextPage = parseInt(data.headers.get('x-page')) + 1;
            let d = await this.gitlabGetRepoTree(projectId, nextPage, tree);
            resolve(d);
          }
          else {
            resolve(tree);
          }
        },
      });

    });

    /*
    let f = filesList as Array<any>;
    f.forEach(file => {
      let pathParts = file.path.split("/");
      if(pathParts[0] == "Data" && pathParts[1] == "VISP_emuDB") {
        if(file.name.lastIndexOf("_ses") == file.name.length - 4) {
          //This seems to be a session
          let sessionName = file.name.substring(0, file.name.lastIndexOf("_ses"));

        }

      }
    });
    */
    return filesList;
  }

  async gitlabCreateProject(projectName, createStandardDirectoryStrructure = true) {
    return new Promise((resolve, reject) => {
      let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects";
    
      let headers = {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': this.userService.getSession().personalAccessToken
      }

      let data = {
        "name": projectName,
        "description": "VISP project",
      }

      this.http.post(requestUrl, data, { headers }).subscribe((project:any) => {
        //Create standard directory structure
        let commitActions = [];
        let commitData = {
          "branch": "master",
          "commit_message": "created project from visp interface",
          "author_name": "VISP System",
          "actions": commitActions
        }

        let mainReadmeContent = `
# Project directory structure
This is your default project directory structure.

## Applications
This directory is for storing applications or executable code needed to produce the results of your project.

## Data
This directory is for storing your research data.

## Documents
This directory is for storing documents relating to your project, such as your data management plan.

## Results
This directory is for publishing your results, the final output, of your project.
        `;

        commitActions.push({
          "action": "create",
          "file_path": "README.md",
          "content": mainReadmeContent,
        });

        commitActions.push({
          "action": "create",
          "file_path": "Applications/README.md",
          "content": `## Applications
This directory is for storing applications or executable code needed to produce the results of your project.`,
        });

        commitActions.push({
          "action": "create",
          "file_path": "Data/README.md",
          "content": `## Data
This directory is for storing your research data.`,
        });

        commitActions.push({
          "action": "create",
          "file_path": "Documents/README.md",
          "content": `## Documents
This directory is for storing documents relating to your project, such as your data management plan.`,
        });

        commitActions.push({
          "action": "create",
          "file_path": "Results/README.md",
          "content": `## Results
This directory is for publishing your results, the final output, of your project.`,
        });



        if(createStandardDirectoryStrructure) {
          this.gitlabCommit(project.id, commitData).subscribe((result) => {
            resolve(project.id);
          });
        }
        else {
          resolve(project.id);
        }
        
      });
    });
  }

  gitlabCommit(projectId, gitlabCommitData) {
    console.log(projectId, gitlabCommitData);
    let requestUrl = window.location.protocol+"//gitlab."+window.location.hostname+"/api/v4/projects/"+projectId+"/repository/commits";
    let data = gitlabCommitData;
    
    let headers = {
      'Content-Type': 'application/json',
      'PRIVATE-TOKEN': this.userService.getSession().personalAccessToken
    }
    return this.http.post(requestUrl, data, { headers });
  }

  updateBundleLists(sessionAccessCode:string, bundleLists) {

    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((data:any) => {
        let progressSteps = null; //Total number of progress steps for this op, hopefully the server will supply this in the first message/step
        let progress = "0";
        if(data) {
          if(data.type == "cmd-result" && data.cmd == "updateBundleLists") {
            let regExpResult = /([0-9]*)\/([0-9]*)/.exec(data.progress);
            if(regExpResult != null) {
              progress = regExpResult[1];
              progressSteps = regExpResult[2];
            }
            else {
              progress = data.progress;
            }
            
            subscriber.next(data);
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

  updateBundleListsOLD(sessionAccessCode:string, projectMembers) {

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
      this.systemService.wsSubject.subscribe((data:any) => {
        let progressSteps = null; //Total number of progress steps for this op, hopefully the server will supply this in the first message/step
        let progress = "0";
        if(data) {
          if(data.type == "cmd-result" && data.cmd == "updateBundleLists") {
            let regExpResult = /([0-9]*)\/([0-9]*)/.exec(data.progress);
            if(regExpResult != null) {
              progress = regExpResult[1];
              progressSteps = regExpResult[2];
            }
            else {
              progress = data.progress;
            }
            
            subscriber.next(data);
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

  setLoadingStatus(status) {
    this.loadingStatus$.next(status);
  }

  async saveProject(form) {
    this.setLoadingStatus("Saving project");

    //These are the main steps:

    //1. Create default directory structure
    //Create the project if it doesn't already exist (this will also create the directory structure)
    let projectId = null;
    let newProject = false;
    if(typeof form.controls.project != "undefined" && parseInt(form.controls.project.value.id)) {
      projectId = form.controls.project.value.id;
    }
    else {
      this.setLoadingStatus("Creating gitlab project");
      projectId = await this.gitlabCreateProject(form.controls.projectName.value);
      newProject = true;
    }


    //2. Commit/push any documents
    //Save the docs - if there is no docs component in the form, this will just return silently, so it's fine
    this.setLoadingStatus("Saving project documents");
    await this.saveProjectDocuments(projectId, form);

    //3. Create Emu-db
    this.setLoadingStatus("Creating a container for EmuDB generation");
    let sessionAccessCode:string = <string>await this.systemService.fetchOperationsSession(projectId);
    console.log("Got a container with code", sessionAccessCode);
    let env = [{
      'key': 'PROJECT_PATH',
      'value': '/home/rstudio/project'
    }];


    let cmdResult:any = "";

    if(newProject) {
      console.log("Executing emudb-create");
      this.setLoadingStatus("Executing emudb-create")
      cmdResult = await this.systemService.runCommandInOperationsSession(sessionAccessCode, "emudb-create", env);
      let containerAgentOutput = JSON.parse(cmdResult.result);
      if(containerAgentOutput.code != 200 || containerAgentOutput.body.stdout.indexOf("createEmuDb.R done") == -1) {
        this.notifierService.notify("error", "Error creating EmuDb");
      }
      else {
        //this.notifierService.notify("info", "Created EmuDb");
      }
    }
    
    //4. Import audio files (which also creates the sessions)
    let sprSessions = [];
    let sessionEnvVarMetadata = [];
    let formSessions = form.controls.emuDb.controls.sessions as FormArray;
    formSessions.controls.forEach(formGroup => {
      let f = formGroup as FormGroup;
      sessionEnvVarMetadata.push({
        sessionId: f.controls.sessionId.value,
        name: this.getFormattedSessionName(f.controls.name.value),
        speakerGender: f.controls.speakerGender.value,
        speakerAge: parseInt(f.controls.speakerAge.value),
        files: []
      });

      sprSessions.push({
        sessionId: f.controls.sessionId.value,
        sessionName: this.getFormattedSessionName(f.controls.name.value),
        projectId: projectId,
        sessionScript: f.controls.sessionScript.value
      });
    });

    env.push({
      'key': 'EMUDB_SESSIONS',
      'value': btoa(JSON.stringify(sessionEnvVarMetadata))
    });

    env.push({
      'key': 'UPLOAD_PATH', //this is needed so that the container-agent knows where to import the session files from
      'value': '/unimported_audio/'+form.controls.emuDb.controls.formContextId.value
    });

    this.setLoadingStatus("Importing audio files");
    cmdResult = await this.systemService.runCommandInOperationsSession(sessionAccessCode, "emudb-create-sessions", env);
    console.log(cmdResult);

    //Create spr-project
    this.setLoadingStatus("Creating project in Spr");
    await this.systemService.sendCommandToBackend({
      cmd: "createSprProject",
      project: {
        name: projectId,
      }
    });

    //Create spr-sessions in the mongodb
    this.setLoadingStatus("Setting up recording sessions");
    await this.systemService.sendCommandToBackend({
      cmd: "createSprSessions",
      sessions: sprSessions
    });

    //5. Set up annotation levels, annotation links,
    //cmd: emudb-create-annotlevels
    //env-vars: PROJECT_PATH, ANNOT_LEVEL_DEF_NAME, ANNOT_LEVEL_DEF_TYPE
    this.setLoadingStatus("Creating annotation levels");
    for(let key in form.controls.emuDb.controls.annotLevels.controls) {
      let annotLevelControl = form.controls.emuDb.controls.annotLevels.controls[key];
      env = [{
        'key': 'PROJECT_PATH',
        'value': '/home/rstudio/project'
      }];
      env.push({
        'key': 'ANNOT_LEVEL_DEF_NAME',
        'value': annotLevelControl.value.name
      });
      env.push({
        'key': 'ANNOT_LEVEL_DEF_TYPE',
        'value': annotLevelControl.value.type
      });
      cmdResult = await this.systemService.runCommandInOperationsSession(sessionAccessCode, "emudb-create-annotlevels", env);
      console.log(cmdResult);
    }
    
    
    //Annot level links
    this.setLoadingStatus("Creating annotation level links");
    for(let key in form.controls.emuDb.controls.annotLevelLinks.value) {
      let level = form.controls.emuDb.controls.annotLevelLinks.value[key];

      env = [{
        'key': 'PROJECT_PATH',
        'value': '/home/rstudio/project'
      },
      {
        'key': 'ANNOT_LEVEL_LINK_SUPER',
        'value': level.superLevel
      },
      {
        'key': 'ANNOT_LEVEL_LINK_SUB',
        'value': level.subLevel
      },
      {
        'key': 'ANNOT_LEVEL_LINK_DEF_TYPE',
        'value': level.type
      }];

      await this.systemService.runCommandInOperationsSession(sessionAccessCode, "emudb-create-annotlevellinks", env);
    }

    //6. Add default emu-db perspectives
    this.setLoadingStatus("Adding default perspectives");
    env = [{
      'key': 'PROJECT_PATH',
      'value': '/home/rstudio/project'
    }];
    cmdResult = await this.systemService.runCommandInOperationsSession(sessionAccessCode, "emudb-add-default-perspectives", env);
    console.log(cmdResult);

    //7. Set level canvases order
    env = [{
      'key': 'PROJECT_PATH',
      'value': '/home/rstudio/project'
    },
    {
      'key': 'ANNOT_LEVELS',
      'value': btoa(JSON.stringify(form.controls.emuDb.controls.annotLevels.value))
    }];
    this.setLoadingStatus("Setting level canvases order");
    cmdResult = await this.systemService.runCommandInOperationsSession(sessionAccessCode, "emudb-setlevelcanvasesorder", env);
    console.log(cmdResult);

    //8. Add track definitions
    env = [{
      'key': 'PROJECT_PATH',
      'value': '/home/rstudio/project'
    }];
    this.setLoadingStatus("Adding track definitions");
    cmdResult = await this.systemService.runCommandInOperationsSession(sessionAccessCode, "emudb-track-definitions", env);
    console.log(cmdResult);

    //9. Set signal canvases order
    env = [{
      'key': 'PROJECT_PATH',
      'value': '/home/rstudio/project'
    }];
    this.setLoadingStatus("Setting signal canvases order")
    cmdResult = await this.systemService.runCommandInOperationsSession(sessionAccessCode, "emudb-setsignalcanvasesorder", env);
    console.log(cmdResult);

    //Commit all of the above
    this.setLoadingStatus("Committing changes to gitlab");
    cmdResult = <any>await this.systemService.commitOperationsSessionProjectToGitlab(sessionAccessCode);
    console.log(cmdResult);

    //10. Create bundleLists - important to do this AFTER all container-operations are done since we will otherwise create git conflicts
    this.setLoadingStatus("Creating bundle lists");
    let user = this.userService.getSession();
    let bundleList = [];

    //set project owner bundleList to contain all the bundles in every session
    formSessions.controls.forEach(formGroup => {
      let f = formGroup as FormGroup;
      f.controls.files.value.forEach(file => {
        bundleList.push({
          "bundleId": nanoid(),
          "session": f.controls.name.value,
          "name": file.name,
          "comment": "",
          finishedEditing: false
        });
      })
    });
    if(newProject) {
      console.log("Creating bundlelist");
      await this.updateBundleList(projectId, user.username, bundleList, "create");
    }
    else {
      console.log("Updating bundlelist");
      await this.updateBundleList(projectId, user.username, bundleList, "update");
    }

    //Check if any sessions needs to be deleted
    if(!newProject) {
      this.setLoadingStatus("Deleting sessions");
      for(let key in formSessions.controls) {
        let formGroup = formSessions.controls[key] as FormGroup;
        if(formGroup.controls.deleted.value) {
          //this session should be deleted
          let sessionName = formGroup.controls.name.value;
          console.log("Deleting session: "+sessionName);
          await this.deleteEmuSessionFromGitlab(projectId, formGroup);
        }
      }
    }

    this.systemService.shutdownOperationsSession(sessionAccessCode);

    this.setLoadingStatus("Done");
  }

  async deleteEmuSessionFromGitlab(projectId, sessionFormGroup:any) {
    let sessionName = sessionFormGroup.controls.name.value;

    let commitActions = [];
    let commitData = {
      "branch": "master",
      "commit_message": "saved sessions from visp interface",
      "author_name": "VISP System",
      "actions": commitActions
    }

    commitActions.push({
      "action": "delete",
      "file_path": "Data/VISP_emuDB/"+sessionName+"_ses/"+sessionName+".meta_json",
    });

    sessionFormGroup.controls.files.value.forEach(file => {
      let fileBaseName = file.name;
      commitActions.push({
        "action": "delete",
        "file_path": "Data/VISP_emuDB/"+sessionName+"_ses/"+fileBaseName+"_bndl/"+fileBaseName+".wav",
      });
      commitActions.push({
        "action": "delete",
        "file_path": "Data/VISP_emuDB/"+sessionName+"_ses/"+fileBaseName+"_bndl/"+fileBaseName+".f0",
      });
      commitActions.push({
        "action": "delete",
        "file_path": "Data/VISP_emuDB/"+sessionName+"_ses/"+fileBaseName+"_bndl/"+fileBaseName+".fms",
      });
      commitActions.push({
        "action": "delete",
        "file_path": "Data/VISP_emuDB/"+sessionName+"_ses/"+fileBaseName+"_bndl/"+fileBaseName+"_annot.json",
      });
    });

    return await new Promise((resolve, reject) => {
      this.gitlabCommit(projectId, commitData).subscribe({
        next: result => {
          this.notifierService.notify("info", "Deleted session "+sessionName+".");
          resolve(result);
        },
        error: err => {
          this.notifierService.notify("error", "There was an error deleting the EMU-DB session "+sessionName+" from GitLab.");
          console.error(err);
          reject();
        }
      });
    });
  }

  getFormattedSessionName(sessionName) {
    return sessionName.replace(/ /g, "_");
  }

  getSessionMetaFileCommitAction(sessionFormGroup) {
    let sessionName = sessionFormGroup.controls.name.value;
    let sessionNameFormatted = this.getFormattedSessionName(sessionName);

    const commitActions = [];
    //prepare to commit the session metadata file (<sessionNameFormatted>.meta_json)
    //which should (at least) contain "Gender" and "Age"
    let action = "create";
    if(!sessionFormGroup.controls.new.value) {
      //If this is an existing session we perform an update, otherwise we create the file
      action = "update";
    }
    //note that this action will also create the session dir, since dirs are automatically created based on the existence of files in git
    

    let sessionMetadata = {
      Gender: sessionFormGroup.controls.speakerGender.value,
      Age: parseInt(sessionFormGroup.controls.speakerAge.value)
    };
    
    console.log(sessionMetadata);

    commitActions.push({
      "action": action,
      "file_path": "Data/VISP_emuDB/"+sessionNameFormatted+"_ses/"+sessionNameFormatted+".meta_json",
      "content": JSON.stringify(sessionMetadata, null, 2),
      "encoding": "text"
    });

    return commitActions;
  }

  getFileExtension(fileName) {
    return fileName.substring(fileName.lastIndexOf("."));
  }

  getFileBaseName(fileName) {
    return fileName.substring(0, fileName.indexOf("."));
  }

  getDeleteFileCommitAction(path) {
    return {
      "action": "delete",
      "file_path": path,
    };
  }

  async uploadIntoContainer(sessionAccessCode, projectId, sessionName, file:File) {
    let b64:string = <string>await this.readFileAsDataURL(file);
    b64 = b64.substring(b64.indexOf("base64,")+7); //Remove prefix/meta data

    let messageToBackend = {
      appSession: sessionAccessCode,
      cmd: "uploadFile",
      data: {
        projectId: projectId,
        sessionName: sessionName,
        fileName: file.name,
        file: b64
      }
    };
    await new Promise((resolve, reject) => {
      this.systemService.sendMessageToBackend(JSON.stringify(messageToBackend), {
        next: (data) => {
          console.log(data);
          resolve(data);
        }
      });
    });
  }

  async saveProjectDocuments(projectId, form) {
    //Save any uploaded documents
    let commitActions = [];
      let commitData = {
        "branch": "master",
        "commit_message": "saved project from visp interface",
        "author_name": "VISP System",
        "actions": commitActions
      }

      let buildCommitActionsPromises = [];

      if(typeof form.controls.docFiles == "undefined") {
        //if this form doesn't have the docFiles component, just abort
        return;
      }

      let docFiles = form.controls.docFiles.value;
      docFiles.forEach(file => {
        if(file instanceof File) {
          let p = this.readFileAsDataURL(file);
          buildCommitActionsPromises.push(p);
          p.then(base64AudioData => {
            let b64 = <string>base64AudioData;

            b64 = b64.substring(b64.indexOf("base64,")+7); //Remove prefix/meta data

            let action = "create";
            //let fileBaseName = file.name.substring(0, file.name.indexOf("."));
            commitActions.push({
              "action": action,
              "file_path": "Documents/"+file.name,
              "content": b64,
              "encoding": "base64"
            });
          });
        }
      });

      await Promise.all(buildCommitActionsPromises);

      /*
      commitActions.push({
        "action": action,
        "file_path": "Data/VISP_emuDB/"+sessions.controls[key].controls.name.value+"_ses/"+fileBaseName+"_bndl/"+file.name,
        "content": b64,
        "encoding": "base64"
      });
      */

      return new Promise((resolve, reject) => {
        this.gitlabCommit(projectId, commitData).subscribe({
          next: res => {
            console.log(res);
            console.log("Saved project documents");
            //this.notifierService.notify("info", "Saved project documents");
            resolve(res);
          },
          error: err => {
            console.error(err);
            this.notifierService.notify("error", "Failed saving project documents");
            reject();
          }
        });
      });
      
  }

  fetchSprScripts(userId:number = null) {
    return new Observable((observer) => {
      let messageToBackend = {
        cmd: "fetchSprScripts",
        data: {
          userId: userId
        }
      };
      this.systemService.sendCommandToBackend(messageToBackend).then((res) => {
        observer.next(res);
        observer.complete();
      });
      
    });
  }

  saveSprScripts(ownerId:number, scripts:any) {
    return new Observable((observer) => {

      //make call to backend
      let messageToBackend = {
        cmd: "saveSprScripts",
        data: {
          ownerId: ownerId,
          scripts: scripts
        }
      };
      this.systemService.sendCommandToBackend(messageToBackend).then((res) => {
        observer.next("Saved spr scripts");
        observer.complete();
      });
      
    });
    
  }

  deleteSprScript(scriptId) {
    return new Observable((observer) => {
      //make call to backend
      let messageToBackend = {
        cmd: "deleteSprScript",
        data: {
          scriptId: scriptId
        }
      };
      this.systemService.sendCommandToBackend(messageToBackend).then((res) => {
        observer.next(res);
        observer.complete();
      });
    });
  }

}