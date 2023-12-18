import { Component, OnInit, Input } from '@angular/core';
import { Project } from '../../models/Project';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { HsApp } from "../../models/HsApp";
import { NotifierService } from 'angular-notifier';
import { Router } from '@angular/router';
import { UserService } from 'src/app/services/user.service';
import { ProjectService } from 'src/app/services/project.service';
import { environment } from 'src/environments/environment';
import Cookies from 'js-cookie';
import { SystemService } from 'src/app/services/system.service';

@Component({
  selector: 'app-appctrl',
  templateUrl: './appctrl.component.html',
  styleUrls: ['./appctrl.component.scss']
})
export class AppctrlComponent implements OnInit {

  @Input() project: Project;
  @Input() projectItem: any;
  @Input() hsApp: HsApp;

  private userService: UserService;
  private projectService: ProjectService;
  private readonly notifier: NotifierService;
  private systemService: SystemService;

  showLoadingIndicator:boolean = false;
  hasRunningSessions:boolean = false;
  statusMsg:string = "";
  btnTitle:string;
  appIconPath:string;
  domain:string = window.location.hostname;
  showSaveButton:boolean = true;

  constructor(private http:HttpClient, notifierService: NotifierService, userService: UserService, projectService: ProjectService, systemService: SystemService, private router: Router) {
    this.notifier = notifierService;
    this.userService = userService;
    this.projectService = projectService;
    this.systemService = systemService;
    this.router = router;
  }

  ngOnInit(): void {
    this.appIconPath = "/assets/"+this.hsApp.icon;
    this.btnTitle = this.hsApp.title;
    
    if(this.updateHasRunningSessions()) {
      this.statusMsg = "Running";
      this.showLoadingIndicator = false;
    }
  }

  launchProjectInApp() {
    if(this.hsApp.disabled) {
      this.notifier.notify("info", "Can't launch "+this.hsApp.title+". Please close other applications first.");
      return;
    }

    this.projectItem.sessionUpdateFromAppCtrlCallback({
      type: "launch",
      app: this.hsApp.name
    });

    switch(this.hsApp.name) {
      case "rstudio":
        this.launchContainerSession("rstudio");
      break;
      case "emu-webapp":
        this.launchEmuWebAppSession();
      break;
      case "octra":
        this.launchOctraSession();
      break;
      case "jupyter":
        this.launchContainerSession("jupyter");
        break;
      case "vscode":
        this.launchContainerSession("vscode");
      break;
      case "script":
        this.showScriptAppDialog();
      break;
    }
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

    this.systemService.sendCommandToBackend({
      cmd: "launchContainerSession",
      projectId: this.project.id,
      appName: appName
    }).then((data:any) => {
      if(data.progress == "end" && data.result) {
        let sessionAccessCode = data.result;
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
      else {
        this.notifier.notify("error", data.message);
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
        console.log(document.cookie);
  
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
      serverUrl: "wss://emu-webapp.visp.local"
    }});
    /*
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id
    };
    */

    /*
    //send command to backend
    this.systemService.sendCommandToBackend({
      cmd: "emuWebappSession",
      projectId: this.project.id
    }).then((data) => {
      console.log(data);

      
      let sessionAccessCode = data.sessionAccessCode;
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
      console.log(document.cookie);

      this.router.navigate(['/emu-webapp'], { queryParams: {
        autoConnect: true,
        serverUrl: "wss://emu-webapp.visp.local"
      }});
      
    });
    */

    /*
    let bundleListName:string = "user.user";
    this.http.post<any>('/api/v1/'+this.hsApp.name+'/session/please', "data="+JSON.stringify(body), { headers }).subscribe(async (data) => {
      let session = this.userService.getSession();

      this.router.navigate(['/emu-webapp'], { queryParams: {
        autoConnect: true,
        serverUrl: "wss://emu-webapp.visp.local"
      }});

    });
    */
  }

  launchOctraSession() {
    this.statusMsg = "Launching";
    this.showLoadingIndicator = true;

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id
    };
    this.http.post<any>('/api/v1/'+this.hsApp.name+'/session/please', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      let url = window.location.protocol+"//"+this.hsApp.name+"."+this.domain+"/";
      this.goToUrl(url);
    });
  }

  updateHasRunningSessions() {
    for(let key in this.project.liveAppSessions) {
      if(this.project.liveAppSessions[key].type == this.hsApp.name) {
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
    }).then((data:any) => {
      if(data.progress == "end" && data.result == "Session deleted") {
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
          app: this.hsApp.name
        });
      }
      else {
        this.notifier.notify("error", data.result);
      }
    });
  }

  getSessionAccessCode() {
    for(let key in this.project.liveAppSessions) {
      if(this.project.liveAppSessions[key].type == this.hsApp.name) {
        return this.project.liveAppSessions[key].sessionAccessCode;
      }
    }
    return false;
  }

}
