import { Component, OnInit, Input } from '@angular/core';
import { Project } from '../../models/Project';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { HsApp } from "../../models/HsApp";
import { NotifierService } from 'angular-notifier';
import { Router } from '@angular/router';
import { UserService } from 'src/app/services/user.service';
import { ProjectService } from 'src/app/services/project.service';

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

  showLoadingIndicator:boolean = false;
  hasRunningSessions:boolean = false;
  statusMsg:string = "";
  btnTitle:string;
  appIconPath:string;
  domain:string = window.location.hostname;
  showSaveButton:boolean = true;

  constructor(private http:HttpClient, notifierService: NotifierService, userService: UserService, projectService: ProjectService, private router: Router) {
    this.notifier = notifierService;
    this.userService = userService;
    this.projectService = projectService;
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
      this.notifier.notify("info", "Prevented launch of "+this.hsApp.title+". Please close other applications first.");
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
    this.statusMsg = "Launching";
    this.showLoadingIndicator = true;

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id
    };

    this.http.post<any>('/api/v1/'+appName+'/session/please', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      let sessionAccessCode = JSON.parse(data.body).sessionAccessCode;
      this.statusMsg = "Taking you there...";
      this.showLoadingIndicator = true;
      
      document.cookie = "SessionAccessCode="+sessionAccessCode+"; domain="+this.domain+"; SameSite=None; Secure";

      this.router.navigate(['/app'], { queryParams: { token: sessionAccessCode }});
    },
    (error) => {
      console.error(error);
    });
  }

  launchEmuWebAppSession() {
    this.statusMsg = "Launching";
    this.showLoadingIndicator = true;

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id
    };

    let bundleListName:string = "user.user";
    this.http.post<any>('/api/v1/'+this.hsApp.name+'/session/please', "data="+JSON.stringify(body), { headers }).subscribe(async (data) => {
      let session = this.userService.getSession();
      
      bundleListName = await new Promise((resolve, reject) => {
      this.projectService.fetchBundleList(this.project, session.username).subscribe(bundleList => {
          resolve(session.username);
        }, (err) => {
          console.log("No such bundle list! Going with user.user");
          resolve(bundleListName);
        });
      });

      let gitlabURL:string = "https://gitlab."+window.location.hostname;
        let projectId:number = this.project.id;
        let emuDBname:string  = "VISP";
        let privateToken:string = data.body.personalAccessToken;
        
        this.router.navigate(['/emu-webapp'], { queryParams: {
          gitlabURL: gitlabURL,
          projectID: projectId,
          gitlabPath: "Data/VISP_emuDB",
          emuDBname: emuDBname,
          bundleListName: bundleListName,
          privateToken: privateToken
        }});
    });
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
      let url = "https://"+this.hsApp.name+"."+this.domain+"/";
      this.goToUrl(url);
    });
  }

  updateHasRunningSessions() {
    for(let key in this.project.sessions) {
      if(this.project.sessions[key].type == this.hsApp.name) {
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

    console.log("Delete session", sessionAccessCode);

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id,
      sessionId: sessionAccessCode
    };

    this.http.post<any>('/api/v1/session/close', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      this.statusMsg = "";
      this.showLoadingIndicator = false;
      

      //Clear session from local registry
      for(let key in this.project.sessions) {
        if(this.project.sessions[key].sessionCode == sessionAccessCode) {
          this.project.sessions.splice(key, 1);
        }
      }
      this.updateHasRunningSessions();

      this.projectItem.sessionUpdateFromAppCtrlCallback({
        type: "close",
        app: this.hsApp.name
      });

    });
  }

  getSessionAccessCode() {
    for(let key in this.project.sessions) {
      if(this.project.sessions[key].type == this.hsApp.name) {
        return this.project.sessions[key].sessionCode;
      }
    }
    return false;
  }

}
