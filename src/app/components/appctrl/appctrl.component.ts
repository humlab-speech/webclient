import { Component, OnInit, Input } from '@angular/core';
import { Project } from '../../models/Project';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { VispApp } from "../../models/VispApp";
import { NotifierService } from 'angular-notifier';
import { Router } from '@angular/router';
import { UserService } from 'src/app/services/user.service';
import { ProjectService } from 'src/app/services/project.service';
import { environment } from 'src/environments/environment';
import Cookies from 'js-cookie';
import { SystemService } from 'src/app/services/system.service';
import { WebSocketMessage } from 'src/app/models/WebSocketMessage';
import { ModalService } from 'src/app/services/modal.service';

@Component({
  selector: 'app-appctrl',
  templateUrl: './appctrl.component.html',
  styleUrls: ['./appctrl.component.scss']
})
export class AppctrlComponent implements OnInit {

  @Input() project: Project;
  @Input() projectItem: any;
  @Input() vispApp: VispApp;

  private userService: UserService;
  private projectService: ProjectService;
  private readonly notifier: NotifierService;
  private systemService: SystemService;
  private modalService: ModalService;

  showLoadingIndicator:boolean = false;
  hasRunningSessions:boolean = false;
  statusMsg:string = "";
  btnTitle:string;
  appIconPath:string;
  domain:string = window.location.hostname;
  showSaveButton:boolean = true;

  constructor(
    private http:HttpClient, 
    notifierService: NotifierService, 
    userService: UserService, 
    projectService: ProjectService, 
    systemService: SystemService, 
    private router: Router,
    modalService: ModalService
  ) {
    this.notifier = notifierService;
    this.userService = userService;
    this.projectService = projectService;
    this.systemService = systemService;
    this.router = router;
    this.modalService = modalService;
  }

  ngOnInit(): void {
    this.appIconPath = "/assets/"+this.vispApp.icon;
    this.btnTitle = this.vispApp.title;
    
    if(this.updateHasRunningSessions()) {
      this.statusMsg = "Running";
      this.showLoadingIndicator = false;
    }

  }

  preFlightChecks() {
    let failures = [];
    if(this.vispApp.name == "emu-webapp") {
      let foundFiles = false;
      //check that this project contains at least one session with files in it, otherwise emu-webapp should not be launchable
      this.project.sessions.forEach((session) => {
        if(session.files.length > 0) {
          foundFiles = true;
        }
      });

      if(!foundFiles) {
        failures.push("No audio files in project.");
      }
    }

    /*
    if(this.vispApp.disabled) {
      failures.push("Please close other applications first.");
    }
    */

    return failures;
  }

  selectAppOptions() {
    //launch popup with app options
    this.modalService.showModal("octra-select-bundle-dialog", this.project);
  }

  launchProjectInApp() {
    this.modalService.setCurrentNavigation(this.vispApp.name);

    let showStoppers = this.preFlightChecks();
    if(showStoppers.length > 0) {
      this.notifier.notify("warning", showStoppers.join(" "));
      return;
    }

    this.projectItem.sessionUpdateFromAppCtrlCallback({
      type: "launch",
      app: this.vispApp.name
    });

    switch(this.vispApp.name) {
      case "rstudio":
        this.launchContainerSession("rstudio");
        this.systemService.setCurrentApplication("rstudio");
      break;
      case "emu-webapp":
        this.launchEmuWebAppSession();
        this.systemService.setCurrentApplication("emu-webapp");
      break;
      case "octra":
        this.launchOctraSession();
        this.systemService.setCurrentApplication("octra");
      break;
      case "jupyter":
        this.launchContainerSession("jupyter");
        this.systemService.setCurrentApplication("jupyter");
        break;
      case "vscode":
        this.launchContainerSession("vscode");
        this.systemService.setCurrentApplication("vscode");
      break;
      case "script":
        this.showScriptAppDialog();
        this.systemService.setCurrentApplication("script");
      break;
    }

    //send event signaling that the app has been launched
    window.dispatchEvent(new Event('app-launched'));
    window.dispatchEvent(new Event('app-launched-'+this.vispApp.name));
  }

  showScriptAppDialog() {
    console.log("Show script dialog");
    window.dispatchEvent(new Event('show-script-dialog'));
  }

  goToUrl(url) {
    console.log("Performing window open on: "+url);
    this.statusMsg = "";
    this.showLoadingIndicator = false;
    //window.open(url);
    window.location.href = url;
  }

  launchContainerSession(appName) {
    console.log("Launch container session", appName);
    this.statusMsg = "Launching";
    this.showLoadingIndicator = true;

    this.systemService.sendCommandToBackendObservable({
      cmd: "launchContainerSession",
      projectId: this.project.id,
      appName: appName
    }).subscribe((wsMsg:WebSocketMessage) => {
      if(!wsMsg.result) {
        this.notifier.notify("error", "Error: "+wsMsg.message);
        return;
      }
      if(wsMsg.progress == "update") {
        this.statusMsg = wsMsg.message;
      }
      if(wsMsg.progress == "end") {
        let sessionAccessCode = wsMsg.message;
        if(!sessionAccessCode) {
          this.notifier.notify("error", "No sessionAccessCode received.");
          return;
        }
        this.statusMsg = "Taking you there...";
        this.showLoadingIndicator = true;
        
        let cookieParams = " SameSite=None; Secure";
        if(environment.PROTOCOL == "http") {
          cookieParams = "";
        }
        Cookies.set('SessionAccessCode', sessionAccessCode, { domain: this.domain, secure: true, sameSite: 'None' });
  
        this.router.navigate(['/app'], { queryParams: { token: sessionAccessCode }});
      }
    });
  }

  launchContainerSessionOLD(appName) {

    this.statusMsg = "Launching";
    this.showLoadingIndicator = true;

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id
    };

    this.http.post<any>('/api/v1/'+appName+'/session/please', "data="+JSON.stringify(body), { headers }).subscribe({
      next: (data) => {
        let sessionAccessCode = JSON.parse(data.body).sessionAccessCode;
        if(!sessionAccessCode) {
          this.notifier.notify("error", "No sessionAccessCode received.");
          return;
        }
        this.statusMsg = "Taking you there...";
        this.showLoadingIndicator = true;
        
        let cookieParams = " SameSite=None; Secure";
        if(environment.PROTOCOL == "http") {
          cookieParams = "";
        }
        console.log("Setting SessionAccessCode cookie");
        Cookies.set('SessionAccessCode', sessionAccessCode, { domain: this.domain, secure: true, sameSite: 'None' });
        //document.cookie = "SessionAccessCode="+sessionAccessCode+"; domain="+this.domain+";"+cookieParams;
  
        this.router.navigate(['/app'], { queryParams: { token: sessionAccessCode }});
      },
      error: (error) => {
        console.error(error);
      }
    });
  }

  launchEmuWebAppSession() {
    this.statusMsg = "Launching";
    this.showLoadingIndicator = true;
    
    //set projectId cookie
    Cookies.set('projectId', this.project.id, { domain: this.domain, secure: true, sameSite: 'None' });

    this.router.navigate(['/emu-webapp'], { queryParams: {
      autoConnect: true,
      serverUrl: "wss://emu-webapp."+window.location.hostname
    }});
  }

  launchOctraSession() {
    this.statusMsg = "Launching";
    this.showLoadingIndicator = true;
    
    //set projectId cookie
    Cookies.set('projectId', this.project.id, { domain: this.domain, secure: true, sameSite: 'None' });

    this.router.navigate(['/octra'], { queryParams: {
    }});
  }

  updateHasRunningSessions() {
    for(let key in this.project.liveAppSessions) {
      if(this.project.liveAppSessions[key].type == this.vispApp.name) {
        this.hasRunningSessions = true;
        return this.hasRunningSessions;
      }
    }
    this.hasRunningSessions = false;
    return this.hasRunningSessions;
  }

  save() {
    this.statusMsg = "Saving";
    this.showLoadingIndicator = true;

    let sessionAccessCode = this.getSessionAccessCode();
    console.log("Save session", sessionAccessCode);

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id,
      sessionId: sessionAccessCode
    };

    this.http.post<any>('/api/v1/session/save', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      let statusObj = JSON.parse(data.body);
      this.notifier.notify('info', statusObj.msg);
      this.showLoadingIndicator = false;
      this.statusMsg = "Running";
    });
  }

  close() {
    if(!window.confirm("Are you sure? Any unsaved changes will be lost.")) {
      return;
    }
    let sessionAccessCode = this.getSessionAccessCode();

    this.statusMsg = "Closing";
    this.showLoadingIndicator = true;

    //send command to backend
    this.systemService.sendCommandToBackend({
      cmd: "closeSession",
      sessionAccessCode: sessionAccessCode
    }).then((data:WebSocketMessage) => {
      if(data.progress == "end" && data.result) {
        this.statusMsg = "";
        this.showLoadingIndicator = false;
        
        //Clear session from local registry
        for(let key in this.project.liveAppSessions) {
          if(this.project.liveAppSessions[key].sessionAccessCode == sessionAccessCode) {
            this.project.liveAppSessions.splice(key, 1);
          }
        }
        
        console.log(this.project.liveAppSessions);
        this.updateHasRunningSessions();
  
        this.projectItem.sessionUpdateFromAppCtrlCallback({
          type: "close",
          app: this.vispApp.name
        });
      }
      else {
        this.notifier.notify("error", data.message);
      }
    });
  }

  getSessionAccessCode() {
    for(let key in this.project.liveAppSessions) {
      if(this.project.liveAppSessions[key].type == this.vispApp.name) {
        return this.project.liveAppSessions[key].sessionAccessCode;
      }
    }
    return false;
  }

}
