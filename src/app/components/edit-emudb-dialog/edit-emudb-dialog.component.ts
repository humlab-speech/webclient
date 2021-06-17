import { Component, Input, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { FileUploadService } from 'src/app/services/file-upload.service';
import { ProjectService } from 'src/app/services/project.service';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { EmudbFormComponent, EmudbFormValues } from '../forms/emudb-form/emudb-form.component';
import { nanoid } from 'nanoid';
import { NotifierService } from 'angular-notifier';

@Component({
  selector: 'app-edit-emudb-dialog',
  templateUrl: './edit-emudb-dialog.component.html',
  styleUrls: ['./edit-emudb-dialog.component.scss'],
})
export class EditEmudbDialogComponent {
  @ViewChild(EmudbFormComponent, { static: true }) public emudbFormComponent: EmudbFormComponent;

  @Input() projectManager: ProjectManagerComponent;

  emuDbForm: FormGroup;
  project: any;
  submitBtnLabel:string = "Save";
  submitBtnEnabled:boolean = true;
  submitBtnEnabledLockout = false;
  formContextId:string = nanoid();
  showLoadingIndicator:boolean = false;
  fileUploadsComlete:boolean = true;

  constructor(private formBuilder: FormBuilder, private fileUploadService: FileUploadService, private projectService: ProjectService, private notifierService: NotifierService) {}

  ngOnInit() {
    this.setLoadingStatus(false);

    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null

    this.emuDbForm = this.formBuilder.group({
      emuDb: this.emudbFormComponent.createFormGroup()
    });
    
    this.emuDbForm.valueChanges.subscribe((values) => {
      this.validateForm();
    });

    this.fileUploadService.statusStream.subscribe((status) => {
      if(status == "uploads-in-progress") {
        this.fileUploadsComlete = false;
        this.validateForm();
      }
      if(status == "all-uploads-complete") {
        this.fileUploadsComlete = true;
        this.validateForm();
      }
    });
  }

  validateForm() {
    if(this.emuDbForm.valid && this.fileUploadsComlete) {
      this.submitBtnEnabled = true;
    }
    else {
      this.submitBtnEnabled = false;
    }

    return this.submitBtnEnabled;
  }

  setLoadingStatus(isLoading = true) {
    if(isLoading) {
      //Set loading indicator
      this.submitBtnEnabled = false;
      this.showLoadingIndicator = true;
      this.submitBtnLabel = "Saving";
      this.submitBtnEnabledLockout = true;
    }
    else {
      this.submitBtnEnabled = true;
      this.showLoadingIndicator = false;
      this.submitBtnLabel = "Save";
      this.submitBtnEnabledLockout = false;
    }
  }

  submitForm() {
    if(this.fileUploadService.isAllUploadsComplete() === false) {
      this.notifierService.notify('warning', 'There are uploads in progress, please wait until they complete.');
      return false;
    }

    if(!this.emuDbForm.valid) {
      this.notifierService.notify('warning', 'This form contains errors, please review them first.');
      return false;
    }

    this.setLoadingStatus();

    let formValues = {
      sessions: this.emudbFormComponent.sessions.value
    };
    this.projectService.addSessions(this.projectManager.projectInEdit.id, formValues, this.emudbFormComponent.formContextId).subscribe((apiResponse) => {
        if(apiResponse.code != 200) {
          this.notifierService.notify('warning', apiResponse.body);
        }
        else {
          this.notifierService.notify('info', apiResponse.body);
          this.emuDbForm.reset();
          this.closeDialog();
        }

        this.setLoadingStatus(false);
    });
  }

  closeDialog() {
    this.fileUploadService.reset();
    this.projectManager.dashboard.modalActive = false;
  }
}