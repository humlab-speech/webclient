import { Component, OnInit, Input } from '@angular/core';
import { Project } from '../../models/Project';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { HsApp } from "../../models/HsApp";
import { Url } from 'url';

@Component({
  selector: 'app-appctrl',
  templateUrl: './appctrl.component.html',
  styleUrls: ['./appctrl.component.scss']
})
export class AppctrlComponent implements OnInit {

  @Input() project: Project;
  @Input() hsApp: HsApp;

  showLoadingIndicator:boolean = false;
  hasRunningSessions:boolean = false;
  statusMsg:string = "";
  btnTitle:string;
  appIconPath:string;
  domain:string = window.location.hostname;

  constructor(private http:HttpClient) { }

  ngOnInit(): void {
    this.appIconPath = "/assets/"+this.hsApp.icon;
    this.btnTitle = this.hsApp.title;
    
    if(this.updateHasRunningSessions()) {
      this.statusMsg = "Running";
      this.showLoadingIndicator = false;
    }
  }

  launchProjectInApp() {
    switch(this.hsApp.name) {
      case "rstudio":
        this.launchContainerSession("rstudio");
      break;
      case "emuwebapp":
        this.launchEmuWebAppSession();
      break;
      case "octra":
        this.launchOctraSession();
      break;
      case "jupyter":
        this.launchContainerSession("jupyter");
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
      
      document.cookie = "SessionAccessCode="+sessionAccessCode+"; domain="+this.domain;
      this.goToUrl("https://"+appName+"."+this.domain+"/?token="+sessionAccessCode);

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
    this.http.post<any>('/api/v1/'+this.hsApp.name+'/session/please', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      //Example: https://ips-lmu.github.io/EMU-webApp/?autoConnect=true&comMode=GITLAB&gitlabURL=https:%2F%2Fgitlab.lrz.de&projectID=44728&emuDBname=ae&bundleListName=test.user&privateToken=reQFspQnbCHbvTfHjwfP

      let gitlabURL:string = encodeURIComponent("https://gitlab."+window.location.hostname);
      let projectId:number = this.project.id;
      let emuDBname:string  = "humlabspeech";
      let bundleListName:string = "user.user";
      let privateToken:string = data.body.personalAccessToken;

      let url = "https://"+this.hsApp.name+"."+this.domain+"/?autoConnect=true&comMode=GITLAB";
      url += "&gitlabURL="+gitlabURL;
      url += "&projectID="+projectId;
      url += "&gitlabPath=Data%2Fhumlabspeech_emuDB";
      url += "&emuDBname="+emuDBname;
      url += "&bundleListName="+bundleListName;
      url += "&privateToken="+privateToken;
      
      this.goToUrl(url);
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

  saveAndClose() {
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
      
      //Now that everything is saved, we can close
      /*
      this.statusMsg = "Closing...";

      this.http.post<any>('/api/v1/rstudio/close', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
        for(let key in this.project.sessions) {
          if(this.project.sessions[key].sessionCode == sessionAccessCode) {
            this.project.sessions.splice(key, 1);
          }
        }
        this.statusMsg = "";
        this.showLoadingIndicator = false;
        this.updateHasRunningSessions();
      });
      */
      this.showLoadingIndicator = false;
      this.statusMsg = "Running";

    });
  }

  discardAndClose() {
    if(!window.confirm("Are you sure? All changes made in this session will be lost.")) {
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
