import { Component, Input, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { FileUploadService } from 'src/app/services/file-upload.service';
import { ProjectService } from 'src/app/services/project.service';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { SessionsFormComponent, EmudbFormValues } from '../forms/sessions-form/sessions-form.component';
import { nanoid } from 'nanoid';
import { NotifierService } from 'angular-notifier';
import { SystemService } from 'src/app/services/system.service';
import { UserService } from 'src/app/services/user.service';
import { WebSocketMessage } from 'src/app/models/WebSocketMessage';

@Component({
  selector: 'app-edit-emudb-dialog',
  templateUrl: './edit-emudb-dialog.component.html',
  styleUrls: ['./edit-emudb-dialog.component.scss'],
})
export class EditEmudbDialogComponent {
  @ViewChild(SessionsFormComponent, { static: true }) public emudbFormComponent: SessionsFormComponent;

  @Input() projectManager: ProjectManagerComponent;

  emuDbForm: FormGroup;
  project: any;
  submitBtnLabel:string = "Save";
  submitBtnEnabled:boolean = true;
  submitBtnEnabledLockout = false;
  formContextId:string = nanoid();
  showLoadingIndicator:boolean = false;
  fileUploadsComlete:boolean = true;
  loadingStatus:boolean = true;
  loadingMessage:string = "Loading Status";
  sessionAccessCode:string = null;
  setupEmuDbFormChangeListener:any = null;
  emuDb:any = null;

  constructor(
    private formBuilder: FormBuilder,
    private fileUploadService: FileUploadService,
    private projectService: ProjectService,
    private notifierService: NotifierService,
    private systemService: SystemService,
    private userService: UserService
    ) {}

  ngOnInit() {
    this.setLoadingStatus(false);

    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null;

    this.emuDbForm = this.formBuilder.group({
      emuDb: this.emudbFormComponent.getFormGroup()
    });

    //This is stupid, but we need to wait for the emuDb-form-module to initialize
    this.setupEmuDbFormChangeListener = setInterval(() => {
      if(typeof this.emudbFormComponent.getFormGroup() != "undefined") {
        clearInterval(this.setupEmuDbFormChangeListener);
        this.emudbFormComponent.getFormGroup().valueChanges.subscribe(() => {
          this.validateForm();
        });
        this.validateForm();
      }
    }, 100);

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

    //If there's a project associated with this dialog, load it in a container so we have access to it
    if(this.project != null) {
      console.log("Going into edit mode");
      
      this.projectService.fetchEmuDbInProject(this.project.id).subscribe(emuDb => {
        this.emuDb = emuDb;
        this.loadingStatus = false;
        this.validateForm();
      });
    }
  }

  validateForm() {
    if(this.emudbFormComponent.getFormGroup().status == "VALID" && this.emuDbForm.valid && this.fileUploadsComlete && this.loadingStatus == false) {
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

  

  async submitForm() {
    console.log(this.project);
    
    //set pristine=false on all controls below in order to trigger validation
    console.log(this.emudbFormComponent);
    this.emudbFormComponent.getFormGroup().markAllAsTouched();
    this.emudbFormComponent.getFormGroup().markAsDirty();
    this.emudbFormComponent.getFormGroup().updateValueAndValidity();
    this.emudbFormComponent.getFormGroup().get('sessions').markAllAsTouched();
    this.emudbFormComponent.getFormGroup().get('sessions').markAsDirty();

    console.log(this.emudbFormComponent.getFormGroup().get('sessions'))

    //validate form
    //this.emudbFormComponent.validate();



    this.projectService.saveProject(this.emudbFormComponent);
    return;

    console.log("submitForm");
    console.log(this.emudbFormComponent);
    let projectId = this.emudbFormComponent.project.id;

    if(!this.emuDbForm.valid) {
      this.notifierService.notify('warning', 'This form contains errors, please review them first.');
      return false;
    }

    this.setLoadingStatus();

    

    /*
    if(this.fileUploadService.isAllUploadsComplete() === false) {
      this.notifierService.notify('warning', 'There are uploads in progress, please wait until they complete.');
      return false;
    }
    */
    

    let formValues = {
      sessions: this.emudbFormComponent.sessions.value
    };

    this.projectService.pushSessions(this.emudbFormComponent.project.id, this.emudbFormComponent.sessions);
    //this.projectService.deleteSessions(); //implement me!

    return;
    let progressSteps = 1;
    this.projectService.addSessions(this.projectManager.projectInEdit.id, formValues, this.emudbFormComponent.formContextId, this.emudbFormComponent.sessionAccessCode).subscribe((data) => {
      console.log(data);
      //this.notifierService.notify('info', data.result);
      
      let slashPos = data.progress.indexOf("/");
      if(slashPos != -1) {
        progressSteps = parseInt(data.progress.substr(slashPos+1));
      }

      let progressPercent = Math.ceil((data.progress / progressSteps) * 100);
      let button = document.getElementById("submitBtn");
      button.style.background = 'linear-gradient(90deg, #669bbcff '+progressPercent+'%, #654c4f '+progressPercent+'%)';
      button.style.color = "#fff";
      this.submitBtnLabel = data.result;
      
      if(data.progress == "end") {
        this.emuDbForm.reset();
        this.closeDialog();
        this.setLoadingStatus(false);
        this.submitBtnLabel = "Save";
      }
    });
    
  }

  closeDialog() {
    /*
    if(this.emudbFormComponent.sessionAccessCode == null) {
      this.notifierService.notify('warn', 'Please wait for init to close dialog.');
      return;
    }
    
    this.emudbFormComponent.shutdownSession();
    */
    this.fileUploadService.reset();
    this.projectManager.dashboard.modalActive = false;
  }
}