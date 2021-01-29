import { Component, OnInit, Input } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Project } from '../../models/Project';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-project-item',
  templateUrl: './project-item.component.html',
  styleUrls: ['./project-item.component.scss']
})
export class ProjectItemComponent implements OnInit {
  
  @Input() project: Project;

  statusMsg:string = "";
  domain:string = window.location.hostname;
  rstudioSaveInProgress:boolean = false;
  rstudioDeleteInProgress:boolean = false;
  projectMenuVisible:boolean = false;
  menuTimeout:any;

  constructor(private http:HttpClient, private projectService:ProjectService) { }

  ngOnInit(): void {
  }

  showProjectMenu(show:boolean = true, useTimer = false) {
    clearTimeout(this.menuTimeout);
    if(useTimer) {
      this.menuTimeout = setTimeout(() => {
        this.projectMenuVisible = show;
      }, 500);
    }
    else {
      this.projectMenuVisible = show;
    }
  }

  hasRunningSessionsOfType(sessionType) {
    //sessionType = 'rstudio'
    for(let key in this.project.sessions) {
      if(this.project.sessions[key].type == sessionType) {
        return true;
      }
    }
    return false;
  }

  launchProjectInApp(app) {
    console.log(app, this.project);

    switch(app) {
      case "rstudio":
        this.launchRstudio();
        break;
    }

  }

  launchRstudio() {
    this.statusMsg = "Creating your environment...";

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: this.project.id
    };

    console.log(body);

    this.http.post<any>('/api/v1/rstudio/session/please', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      console.log(data);
      this.statusMsg = "Taking you there...";
      
      document.cookie = "rstudioSession="+data.sessionAccessCode+"; domain="+this.domain;
      setTimeout(() => {
        window.location.href = "https://rstudio."+this.domain;
      }, 1000);
    }, (error) => {
      console.error(error);
    });


  }

  saveAndClose(appName) {
    if(appName != "rstudio") {
      return false;
    }
    this.rstudioDeleteInProgress = true;
    this.rstudioSaveInProgress = true;
    //this.statusMsg = "Committing & pushing...";
    let cookies = this.getCookies();
    console.log("Save session", cookies['rstudioSession']);

    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      rstudioSession: cookies['rstudioSession']
    };

    this.http.post<any>('/api/v1/rstudio/save', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      this.statusMsg = "";
      console.log("saved:", data);
      
      //Clear session from local registry
      this.rstudioSaveInProgress = false;
    });

    this.http.post<any>('/api/v1/rstudio/close', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      for(let key in this.project.sessions) {
        if(this.project.sessions[key].sessionCode == cookies['rstudioSession']) {
          this.project.sessions.splice(key, 1);
        }
      }
      console.log("closed:", data);
      this.rstudioDeleteInProgress = false;
    });

  }

  discardAndClose(appName) {
    if(appName != "rstudio") {
      return false;
    }
    this.rstudioDeleteInProgress = true;
    //this.statusMsg = "Deleting & closing...";
    let cookies = this.getCookies();
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      rstudioSession: cookies['rstudioSession']
    };
    this.http.post<any>('/api/v1/rstudio/close', "data="+JSON.stringify(body), { headers }).subscribe((data) => {
      this.statusMsg = "";
      console.log(data);
      
      //Clear session from local registry
      for(let key in this.project.sessions) {
        if(this.project.sessions[key].sessionCode == cookies['rstudioSession']) {
          this.project.sessions.splice(key, 1);
        }
      }
      this.rstudioDeleteInProgress = false;
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

  deleteProject() {
    if(window.confirm('Are sure you want to delete this project? All data associated with this project will be lost.')){
      this.projectService.deleteProject(this.project).subscribe(() => {
        this.projectService.updateProjects();
      });
    }
  }

}
