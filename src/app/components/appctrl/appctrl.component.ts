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

  appSaveInProgress:boolean = false;
  appDeleteInProgress:boolean = false;
  statusMsg:string = "";
  btnTitle:string;
  domain:string = window.location.hostname;

  constructor(private http:HttpClient) { }

  ngOnInit(): void {
    this.btnTitle = this.hsApp.title;
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
    }
  }

  goToUrl(url) {
    console.log("Performing window open on: "+url);
    this.statusMsg = "";
    //window.open(url);
    window.location.href = url;
  }

  launchContainerSession(appName) {
    this.statusMsg = "Creating your environment...";

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id
    };

    this.http.post<any>('/api/v1/'+appName+'/session/please', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      let sessionAccessCode = JSON.parse(data.body).sessionAccessCode;
      this.statusMsg = "Taking you there...";
      
      document.cookie = "SessionAccessCode="+sessionAccessCode+"; domain="+this.domain;
      this.goToUrl("https://"+appName+"."+this.domain+"/?token="+sessionAccessCode);

    },
    (error) => {
      console.error(error);
    });
  }

  launchEmuWebAppSession() {
    this.statusMsg = "Taking you there...";

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
      let emuDBname:string  = "default";
      let bundleListName:string = "user.user";
      let privateToken:string = data.body.personalAccessToken;

      let url = "https://"+this.hsApp.name+"."+this.domain+"/?autoConnect=true&comMode=GITLAB";
      url += "&gitlabURL="+gitlabURL;
      url += "&projectID="+projectId;
      url += "&emuDBname="+emuDBname;
      url += "&bundleListName="+bundleListName;
      url += "&privateToken="+privateToken;
      
      this.goToUrl(url);
    });
  }

  launchOctraSession() {
    this.statusMsg = "Taking you there...";

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

  hasRunningSessions() {
    for(let key in this.project.sessions) {
      if(this.project.sessions[key].type == this.hsApp.name) {
        return true;
      }
    }
    return false;
  }

  saveAndClose() {
    this.appSaveInProgress = true;
    //this.statusMsg = "Committing & pushing...";
    let cookies = this.getCookies();
    console.log("Save session", cookies['rstudioSession']);

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id,
      rstudioSession: cookies['rstudioSession']
    };

    this.http.post<any>('/api/v1/rstudio/save', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      this.statusMsg = "";

      //Now that everything is saved, we can close
      this.appSaveInProgress = false;
      this.appDeleteInProgress = true;
      
      this.http.post<any>('/api/v1/rstudio/close', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
        for(let key in this.project.sessions) {
          if(this.project.sessions[key].sessionCode == cookies['rstudioSession']) {
            this.project.sessions.splice(key, 1);
          }
        }
        this.appDeleteInProgress = false;
      });

    });
  }

  discardAndClose() {
    this.appDeleteInProgress = true;
    //this.statusMsg = "Deleting & closing...";
    let cookies = this.getCookies();
    console.log("Delete session", cookies['rstudioSession']);
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id,
      rstudioSession: cookies['rstudioSession']
    };

    this.http.post<any>('/api/v1/rstudio/close', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      //this.statusMsg = "";
      
      //Clear session from local registry
      for(let key in this.project.sessions) {
        if(this.project.sessions[key].sessionCode == cookies['rstudioSession']) {
          this.project.sessions.splice(key, 1);
        }
      }
      this.appDeleteInProgress = false;
    });
  }

  getCookies() {
    let cookiesParsed = [];
    let cookies = document.cookie.split("; ");
    cookies.forEach((cookie) => {
        let cparts = cookie.split("=");
        let key = cparts[0];
        let value = cparts[1];
        cookiesParsed[key] = value;
    });

    return cookiesParsed;
  }

}
