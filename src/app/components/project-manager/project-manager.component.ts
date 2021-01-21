import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { ProjectService } from "../../services/project.service";
import { Session } from "../../models/Session";
import { Project } from "../../models/Project";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { FormControl, FormGroup } from '@angular/forms';
import { ThrowStmt } from '@angular/compiler';

@Component({
  selector: 'app-project-manager',
  templateUrl: './project-manager.component.html',
  styleUrls: ['./project-manager.component.scss']
})
export class ProjectManagerComponent implements OnInit {

  projectsLoaded:boolean = false;
  projects:Project[];
  userIsSignedIn:boolean = false;
  showCreateProjectDialog:boolean = false;

  createProjectForm = new FormGroup({
    projectName: new FormControl(''),
    genEmuDb: new FormControl(false)
  });
  //projectName = new FormControl('');
  //genEmuDb = new FormControl(false);


  constructor(private userService:UserService, private projectService:ProjectService, private http:HttpClient) { }

  ngOnInit():void {
    /*
    this.projectService.fetchProjects().subscribe(projects => {
      //this.projects = projects;
      this.projects = this.projectService.projects;
      this.projectsLoaded = true;
    });
    */

    /*
    setInterval(() => {
      console.log("update project list");
      this.projects = this.projectService.projects;
      console.log(this.projects);
    }, 1000);
    */

    this.userService.sessionObs.subscribe((session:Session) => {
      console.log("Session updated", session);
      if(session.email != null) {
        this.userIsSignedIn = true;
      }
      else {
        this.userIsSignedIn = false;
      }
    });

    this.projectService.projects$.subscribe((projects) => {
      console.log("well whaddaya know! the projects list seems to be updated! aint that somehting...");
      this.projects = projects;
      this.projectsLoaded = true;
    });
    
  }

  dumpSession() {
    console.log("Dump Session");
    let obs = this.http.get("/api/v1/magick", {
      responseType: "text"
    });
    obs.subscribe((data) => {
      console.log(data);
    });
  }

  createProject() {
    this.projectsLoaded = false;
    let projectCreateObs = this.projectService.createProject(
      this.createProjectForm.controls.projectName.value,
      this.createProjectForm.controls.genEmuDb.value
      );
    projectCreateObs.subscribe((data) => {
      console.log(data);
      //this.projectsLoaded = true;
      this.createProjectForm.reset();
    });

    
    this.showCreateProjectDialog = false;
  }

  closeCreateProjectDialog() {
    this.showCreateProjectDialog = false;
  }

}
