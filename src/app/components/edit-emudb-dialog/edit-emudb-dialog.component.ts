import { Component, Input, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import { FileUploadService } from 'src/app/services/file-upload.service';
import { ProjectService } from 'src/app/services/project.service';
import { ProjectManagerComponent } from '../project-manager/project-manager.component';
import { EmudbFormComponent, EmudbFormValues } from '../forms/emudb-form/emudb-form.component';
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
  loadingStatus:boolean = true;
  loadingMessage:string = "Loading Status";
  sessionAccessCode:string = null;

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

    //If there's a project associated with this dialog, load it in a container so we have access to it
    if(this.project != null) {
      this.fetchSession().then((sessionAccessCode:string) => {
        this.sessionAccessCode = sessionAccessCode;

        //Scan the project
        /*
        this.systemService.getEmuDb(this.sessionAccessCode).then((emudb) => {
        });
        */
      });
    }
  }

  async fetchSession() {
    return new Promise((resolve, reject) => {
      let userSession = this.userService.getSession();
      const wsContext = nanoid();

      this.systemService.wsSubject.subscribe((messageEvt) => {
        let wsMessage = JSON.parse(messageEvt.data);
        if(wsMessage.context == wsContext) {
          if(wsMessage.type == "status-update") {
            this.loadingMessage = wsMessage.message;
          }
          if(wsMessage.type == "data") {
            setTimeout(() => { this.loadingMessage = ""; this.loadingStatus = false; }, 500);
            resolve(wsMessage.message);
          }
        }
      });

      this.systemService.ws.send(new WebSocketMessage(wsContext, 'cmd', 'fetchOperationsSession', { user: userSession, project: this.project }).toJSON());
    });
  }

  async shutdownSession() {
    await this.systemService.shutdownOperationsSession(this.sessionAccessCode);
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
    if(this.sessionAccessCode == null) {
      this.notifierService.notify('warn', 'Please wait for init to close dialog.');
      return;
    }
    this.shutdownSession();
    this.fileUploadService.reset();
    this.projectManager.dashboard.modalActive = false;
  }
}