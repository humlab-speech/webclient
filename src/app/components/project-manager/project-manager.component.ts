import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { ProjectService } from "../../services/project.service";
import { Project } from "../../models/Project";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { FormControl, FormGroup } from '@angular/forms';
import { CreateProjectDialogComponent } from './create-project-dialog/create-project-dialog.component';

@Component({
  selector: 'app-project-manager',
  templateUrl: './project-manager.component.html',
  styleUrls: ['./project-manager.component.scss']
})
export class ProjectManagerComponent implements OnInit {

  projectsLoaded:boolean = false;
  projects:Project[];
  showCreateProjectDialog:boolean = false;
  projectCreateInProgress:boolean = false;
  showScriptsDialog:boolean = false;

  constructor(private userService:UserService, private projectService:ProjectService, private http:HttpClient) { }

  ngOnInit():void {

    window.addEventListener('project-create-in-progress', () => {
      this.projectCreateInProgress = true;
    });

    window.addEventListener('project-create-done', () => {
      this.projectCreateInProgress = false;
    });

    window.addEventListener('show-script-dialog', () => {
      this.showScriptsDialog = true;
    });

    window.addEventListener('hide-script-dialog', () => {
      this.showScriptsDialog = false;
    });

    this.projectService.projects$.subscribe((projects) => {
      this.projects = projects;
      this.projectsLoaded = true;
    });
  }
}
