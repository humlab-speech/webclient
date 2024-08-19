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
import { WebSocketMessage } from '../models/WebSocketMessage';

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
    //this.fetchProjects();
  }

  fetchMembers(projectId) {
    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((data:any) => {
        if(data.type == "cmd-result" && data.cmd == "fetchMembers") {
          subscriber.next(data);
          if(data.progress == "end") {
            subscriber.complete();
          }
        }
      });

      this.systemService.ws.send(JSON.stringify({
        type: 'cmd',
        cmd: 'fetchMembers',
        projectId: projectId
      }));
    });
  }

  fetchSprData(projectId:number) {
    //fetch speech recorder db data via the session-manager
    return this.systemService.sendCommandToBackend({ cmd: "fetchSprData", projectId: projectId }).then((wsMsg:WebSocketMessage) => {
      console.log(wsMsg);
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

      this.systemService.sendCommandToBackend(data).then((wsMsg:WebSocketMessage) => {
        subscriber.next(wsMsg);
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

      this.systemService.sendCommandToBackend(data).then((wsMsg:WebSocketMessage) => {
        subscriber.next(wsMsg);
        subscriber.complete();
      });
    });
  }

  fetchProjects(forceNewFetch:boolean = false) {
    
    return new Observable(sub => {
      if(this.projectsLoaded && !forceNewFetch) {
        console.log("Projects already loaded");
        sub.next(this.projects);
        sub.complete();
      }
      else {
        let requestId = nanoid();
        //create a websocket request
        /*
        this.systemService.wsSubject.subscribe((data:any) => {
          if(data.type == "cmd-result" && data.cmd == "fetchProjects") {
            if(data.requestId == requestId && data.progress == "end") {
              this.projects = <Project[]>data.result;

              this.projects.forEach(p => {
                if(typeof p.sessions == "undefined") {
                  p.sessions = [];
                }
              });

              this.projectsLoaded = true;
              sub.next(this.projects);
              this.projects$.next(this.projects);
              sub.complete();
            }
          }
        });
        */

        this.systemService.sendCommandToBackend({
          cmd: "fetchProjects",
          requestId: requestId
        }).then((wsMsg:WebSocketMessage) => {
          console.log(wsMsg)
          if(wsMsg.message) {
            return this.notifierService.notify("error", wsMsg.message);
          }
          else {
            this.projects = <Project[]>wsMsg.data.projects;

            this.projects.forEach(p => {
              if(typeof p.sessions == "undefined") {
                p.sessions = [];
              }
            });

            this.projectsLoaded = true;
            sub.next(this.projects);
            this.projects$.next(this.projects);
            sub.complete();
          }
        });

      }
    });
  }

  getProjects():Project[] {
    return this.projects;
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
    return new Observable<any>(subscriber => {
      this.systemService.wsSubject.subscribe((data:any) => {
        if(data.type == "cmd-result" && data.cmd == "deleteProject") {
          if(data.progress == "end") {
            subscriber.next(data);
            subscriber.complete();
          }
        }
      });
  
      let body = {
        project: project
      };
      this.systemService.ws.send(JSON.stringify({
        type: 'cmd',
        cmd: 'deleteProject',
        data: body
      }));
    });
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

  parseProgress(progressString) {
    // Check if the progressString matches the expected format (e.g., '13/17')
    const match = progressString.match(/^(\d+)\/(\d+)$/);
  
    if (match) {
      // Extract the matched numbers and convert them to integers
      const currentStep = parseInt(match[1], 10);
      const totalSteps = parseInt(match[2], 10);
  
      return { currentStep, totalSteps };
    } else {
      // If the format doesn't match, return null or an error message
      return null;
    }
  }

  saveProject(formValues) {
    return new Observable(subscriber => {
      
      subscriber.next({
        msg: "Saving project",
        progressPercentage: 0
      });

      this.systemService.wsSubject.subscribe((data:any) => {
        if(data.type == "cmd-result" && data.cmd == "saveProject") {
          let progress = this.parseProgress(data.progress);
          if(progress.currentStep == progress.totalSteps) {
            subscriber.next({
              msg: "Project saved",
              progressPercentage: 100
            });
            subscriber.complete();
          }
          else {
            subscriber.next({
              msg: data.result,
              progressPercentage: Math.round(progress.currentStep / progress.totalSteps * 100)
            });
          }
        }
      });

      this.systemService.sendCommandToBackend({
        cmd: "saveProject",
        project: formValues,
      }).then((wsMsg:WebSocketMessage) => {
        console.log("Saved project", wsMsg);
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
      
  }

  fetchSprScripts(username:string = null) {
    return new Observable((observer) => {
      let messageToBackend = {
        cmd: "fetchSprScripts",
        data: {
          username: username
        }
      };
      this.systemService.sendCommandToBackend(messageToBackend).then((wsMsg:WebSocketMessage) => {
        observer.next(wsMsg);
        observer.complete();
      });
    });
  }

  saveSprScripts(owner:string, scripts:any) {
    return new Observable((observer) => {
      //make call to backend
      let messageToBackend = {
        cmd: "saveSprScripts",
        data: {
          owner: owner,
          scripts: scripts
        }
      };
      this.systemService.sendCommandToBackend(messageToBackend).then((wsMsg:WebSocketMessage) => {
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
      this.systemService.sendCommandToBackend(messageToBackend).then((wsMsg:WebSocketMessage) => {
        observer.next(wsMsg);
        observer.complete();
      });
    });
  }

  deleteBundle(projectId, sessionId, fileName) {
    return new Observable((observer) => {
      let messageToBackend = {
        cmd: "deleteBundle",
        data: {
          projectId: projectId,
          sessionId: sessionId,
          fileName: fileName,
        }
      };
      this.systemService.sendCommandToBackend(messageToBackend).then((wsMsg:WebSocketMessage) => {
        observer.next(wsMsg);
        observer.complete();
      });
    });
  }

}