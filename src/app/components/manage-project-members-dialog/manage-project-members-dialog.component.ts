import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { Project } from "../../models/Project";
import { ManageProjectMembersFormComponent } from '../forms/manage-project-members-form/manage-project-members-form.component';

@Component({
  selector: 'app-manage-project-members-dialog',
  templateUrl: './manage-project-members-dialog.component.html',
  styleUrls: ['./manage-project-members-dialog.component.scss']
})
export class ManageProjectMembersDialogComponent implements OnInit {
  @ViewChild(ManageProjectMembersFormComponent, { static: true }) public manageProjectMembersFormComponent: ManageProjectMembersFormComponent;

  @Input() projectManager: ProjectManagerComponent;
  @Input() project: Project;

  constructor() { }

  ngOnInit(): void {
    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null;
  }

  closeDialog() {
    if(this.manageProjectMembersFormComponent.sessionAccessCode != null) {
      this.manageProjectMembersFormComponent.shutdownSession();
    }
    this.projectManager.dashboard.modalActive = false;
  }

}
