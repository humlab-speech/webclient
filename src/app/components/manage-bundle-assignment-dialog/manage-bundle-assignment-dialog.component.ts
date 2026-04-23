import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { Project } from "../../models/Project";
import { ManageBundleAssignmentFormComponent } from '../forms/manage-bundle-assignment-form/manage-bundle-assignment-form.component';

@Component({
  selector: 'app-manage-bundle-assignment-dialog',
  templateUrl: './manage-bundle-assignment-dialog.component.html',
  styleUrls: ['./manage-bundle-assignment-dialog.component.scss']
})
export class ManageBundleAssignmentDialogComponent implements OnInit {
  @ViewChild(ManageBundleAssignmentFormComponent, { static: true }) public manageBundleAssignmentFormComponent: ManageBundleAssignmentFormComponent;
  @Input() projectManager: ProjectManagerComponent;
  @Input() project: Project;

  constructor() { }

  ngOnInit(): void {
    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null;
  }

  closeDialog() {
    /*
    if(this.manageProjectMembersFormComponent.sessionAccessCode != null) {
      this.manageProjectMembersFormComponent.shutdownSession();
    }
    */
    this.projectManager.dashboard.modalActive = false;
  }

}