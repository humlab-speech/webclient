import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray, AbstractControl, FormControlName } from '@angular/forms';
import { nanoid } from 'nanoid';
import { ProjectService } from "../../../services/project.service";
import { HttpClient } from '@angular/common/http'
import { ProjectManagerComponent } from '../project-manager.component';
import { FileUploadService } from "../../../services/file-upload.service";
import { NotifierService } from 'angular-notifier';
import { Observable, Subject } from 'rxjs';
import { UserService } from 'src/app/services/user.service';
import { SessionsFormComponent } from '../../forms/sessions-form/sessions-form.component';
import { DocumentationFormComponent } from '../../forms/documentation-form/documentation-form.component';
import { environment } from 'src/environments/environment';
import { SystemService } from 'src/app/services/system.service';

@Component({
  selector: 'app-project-dialog',
  templateUrl: './project-dialog.component.html',
  styleUrls: ['./project-dialog.component.scss']
})
export class ProjectDialogComponent implements OnInit {
  @ViewChild(SessionsFormComponent, { static: false }) public emudbFormComponent: SessionsFormComponent;
  @ViewChild(DocumentationFormComponent, { static: false }) public docsFormComponent: DocumentationFormComponent;

  EMUDB_INTEGRATION = environment.EMUDB_INTEGRATION;

  @Input() projectManager: ProjectManagerComponent;

  submitBtnLabel:string = "Create project";
  isLoading:boolean = false;
  submitBtnEnabled:boolean = false;
  pendingUpload:boolean = false;
  showLoadingIndicator:boolean = false;
  submitBtnEnabledLockout:boolean = false;
  formValidationInterval:any;
  fileUploadsComlete:boolean = true;
  validateWaitInterval:any = null;
  setupEmuDbFormChangeListener:any = null;
  emuDbIntegrationEnabled:boolean = true;
  docFiles:FormArray;
  project:any = null;
  emuDb:any = null;
  dialogTitle:string = "Create new project";
  emuDbLoadedSubject:Subject<boolean> = new Subject<boolean>();
  emuDbLoaded$:Observable<boolean> = this.emuDbLoadedSubject.asObservable();

  form:FormGroup;

  formContextId:string = nanoid();

  constructor(private http:HttpClient, private fb:FormBuilder, private systemService:SystemService, private projectService:ProjectService, private userService:UserService, private fileUploadService:FileUploadService, private notifierService: NotifierService) {
    this.emuDbIntegrationEnabled = environment.EMUDB_INTEGRATION;
    /*
    console.log(this.docsFormComponent, this.emudbFormComponent);
    setInterval(() => {
      console.log(this.docsFormComponent, this.emudbFormComponent);
    }, 1000);
    */
  }

  /*

  this.userService.sessionObs.subscribe((session:UserSession) => {
      if(session && session.eppn != null) {
        this.userIsSignedIn = true;
        let userSession = this.userService.getSession();
        console.log("User session", userSession);
        if(userSession.privileges.createInviteCodes) {
          this.showInviteCodesMenuOption = true;
        }
      }
      else {
        this.userIsSignedIn = false;
      }
    });

  */

  ngOnInit(): void {
    this.project = this.projectManager.projectInEdit ? this.projectManager.projectInEdit : null
    console.log(this.project);

    this.setLoadingStatus(false);

    this.docFiles = this.fb.array([]);

    this.form = this.fb.group({
      projectName: new FormControl('', {
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30)],
        updateOn: 'blur'
      }),
      docFiles: this.docFiles,
      standardDirectoryStructure: new FormControl(true),
      createEmuDb: new FormControl(environment.EMUDB_INTEGRATION),
    });

    this.form.statusChanges.subscribe((status) => {
      this.validateForm();
    });

    this.form.controls['projectName'].setAsyncValidators([this.validateProjectName(this.http, this.userService, this.systemService)]);

    this.fileUploadService.statusStream.subscribe((status) => {
      if(status == "uploads-in-progress") {
        this.fileUploadsComlete = false;
      }
      if(status == "all-uploads-complete") {
        this.fileUploadsComlete = true;
      }
    });

    document.getElementById("projectName").focus();

    //If there's a project associated with this dialog, load it in a container so we have access to it
    if(this.project != null) {
      this.dialogTitle = "Edit project "+this.project.name;
      
      this.form.addControl("id", new FormControl(this.project.id));
      this.form.addControl("annotationLevels", new FormControl(this.project.annotationLevels));
      this.form.addControl("annotationLinks", new FormControl(this.project.annotationLinks));
      this.form.addControl("members", new FormControl(this.project.members));
      this.form.addControl("name", new FormControl(this.project.name));
      this.form.addControl("sessions", new FormControl(this.project.sessions));

      this.form.controls.projectName.setValue(this.project.name);
      this.form.controls.projectName.disable();

      this.setLoadingStatus(true);
      console.log("Going into edit mode");
      console.log(this.project);
      console.log(this.form);
      this.setLoadingStatus(false);
    }
    else {
      this.setLoadingStatus(false);
    }

  }

  setLoadingStatus(isLoading = true, label = "Loading") {
    this.isLoading = isLoading;
    if(isLoading) {
      //Set loading indicator
      this.submitBtnEnabled = false;
      this.showLoadingIndicator = true;
      this.submitBtnLabel = label;
      this.submitBtnEnabledLockout = true;
    }
    else {
      this.showLoadingIndicator = false;
      this.submitBtnLabel = "Save";
      this.submitBtnEnabledLockout = false;
    }
  }
  
  validateForm() {
    if(this.fileUploadsComlete && this.form.status == "VALID" && this.isLoading == false) {
      this.submitBtnEnabled = true;
    }
    else {
      //this.submitBtnEnabled = false;
    }

    let childFormsValid = true;
    //also check if the sessions form is valid
    if (this.docsFormComponent && this.docsFormComponent.form.status != "VALID") {
      childFormsValid = false;
    }

    if (this.emudbFormComponent && !this.emudbFormComponent.formIsValid) {
      childFormsValid = false;
    }

    if(!this.fileUploadsComlete) {
      console.log("File uploads are not complete");
    }
    if(this.form.status != "VALID") {
      console.log("Form is not valid");
    }
    if(this.isLoading) {
      console.log("Form is loading");
    }

    /* this is a beautiful 'fix'
    if(!childFormsValid) {
      console.log("Child forms are not valid");
    }
    */
    childFormsValid = true;

    return this.fileUploadsComlete && this.form.status == "VALID" && this.isLoading == false && childFormsValid;
  }

  get projectName() {
    return this.form.get('projectName');
  }

  get standardDirectoryStructure() {
    return this.form.get('standardDirectoryStructure');
  }

  get createEmuDb() {
    return this.form.get('createEmuDb');
  }

  async saveProject(form) {
    this.projectService.loadingStatus$.subscribe((status) => {
      this.submitBtnLabel = status;
    });

    if(!this.validateForm()) {
      this.notifierService.notify('warning', "This form is not ready to be submitted yet.");
      //this.setLoadingStatus(false);
      return false;
    }

    this.setLoadingStatus(true);

    this.projectService.loadingStatus$.subscribe(status => {
      this.submitBtnLabel = status;
    });

    let emuDbFormValues = this.emudbFormComponent.getFormGroup().getRawValue();
    if(this.docsFormComponent.status == "Uploading") {
      this.notifierService.notify('warning', "Please wait for the documentation files to finish uploading before submitting the form.");
      return false;
    }
    
    //merge with the main form
    let formValues = form.form.getRawValue();
    delete emuDbFormValues.project;

    this.emudbFormComponent.sessions.value.forEach(formSess => {
      let clearnedFiles = [];
      formSess.files.forEach(fileFormData => {
        clearnedFiles.push({
          name: fileFormData.name,
          size: fileFormData.size,
          type: fileFormData.type
        });
      });

      formSess.files = clearnedFiles;
    });

    let mergedForm = formValues;
    mergedForm.sessions = this.emudbFormComponent.sessions.value;
    mergedForm.annotLevels = emuDbFormValues.annotLevels;
    mergedForm.annotLevelLinks = emuDbFormValues.annotLevelLinks;
    mergedForm.formContextId = this.formContextId;

    mergedForm.docFiles = [];
    this.docsFormComponent.docFiles.value.forEach(docFile => {
      mergedForm.docFiles.push({
        name: docFile.name,
        size: docFile.size,
        type: docFile.type
      });
    })

    delete mergedForm.annotationLevels;
    delete mergedForm.annotationLinks;
    
    this.projectService.saveProject(mergedForm).subscribe((data:any) => {
      this.setTaskProgressPercentage(data.progressPercentage, "submitBtn", data.msg);

      if(data.progressPercentage == 100) {
        this.projectService.fetchProjects(true).subscribe(msg => {
          this.setLoadingStatus(false);
          this.closeCreateProjectDialog();
        });
      }
    });
  }

  setTaskProgressPercentage(progressPercent, targetElementId = null, msg = null) {
    if(targetElementId != null) {
      let targetEl = document.getElementById(targetElementId);
      targetEl.style.background = 'linear-gradient(90deg, #73A790 '+progressPercent+'%, #654c4f '+progressPercent+'%)';
      targetEl.style.color = "#fff";
    }
    if(msg != null) {
      this.submitBtnLabel = msg;
    }
  }

  setTaskProgress(progressStep, totalNumSteps, targetElementId = null, msg = null) {
    console.log("setTaskProgress", progressStep, totalNumSteps, targetElementId, msg);
    let progressPercent = Math.ceil((progressStep / totalNumSteps) * 100);
    if(targetElementId != null) {
      let targetEl = document.getElementById(targetElementId);
      targetEl.style.background = 'linear-gradient(90deg, #73A790 '+progressPercent+'%, #654c4f '+progressPercent+'%)';
      targetEl.style.color = "#fff";
    }
    if(msg != null) {
      this.submitBtnLabel = msg;
    }
  }

  closeCreateProjectDialog() {
    this.fileUploadService.reset();
    this.projectManager.dashboard.modalActive = false;
  }

  onAudioUpload(event, session) {
    let allowedFilesTypes = ['audio/wav', 'audio/x-wav'];

    for(let key in event.addedFiles) {
      if(allowedFilesTypes.includes(event.addedFiles[key].type) == false) {
        this.notifierService.notify('warning', 'There file ' + event.addedFiles[key].name + ' is of an invalid type ' + event.addedFiles[key].type + '. Please only upload WAV files here.');
        event.addedFiles.splice(key, 1);
      }
    }

    if(event.addedFiles.length == 0) {
      return;
    }

    session.value.files.push(...event.addedFiles);

    for(let key in event.addedFiles) {
      let file = event.addedFiles[key];
      this.uploadFile(file, session).then(() => {
      })
    }
  }

  async uploadFile(file:File, session) {
    return await this.fileUploadService.upload(file, this.formContextId, "emudb-sessions/"+session.controls.id.value);
  }
  
  onRemove(event, session) {
    session.value.files.splice(session.value.files.indexOf(event), 1);
    //TODO: Remove the uploaded file from the server?
  }

  validateProjectName(http:HttpClient, userService:UserService, systemService:SystemService) {
    return function(control:AbstractControl):Observable<ValidationErrors> | null {
      const value: string = control.value;
      let session = userService.getSession();

      //use websocket backend
      let requestId = nanoid();
      //create a websocket request


      return new Observable((observer) => {
        systemService.wsSubject.subscribe((data:any) => {
          if(data.type == "cmd-result" && data.cmd == "validateProjectName") {
            if(data.requestId == requestId && data.progress == "end") {
              let result = null;
              if(data.result == false) {
                //control.setErrors({ isFormNameTaken: true });
                if(data.message == "Project name already exists") {
                  result = { 'isFormNameTaken': true };
                }
                if(data.message == "Project name must be alphanumeric") {
                  result = { 'pattern': true };
                }
              }
              observer.next(result);
              observer.complete();
            }
          }
        });
  
        systemService.ws.send(JSON.stringify({
          requestId: requestId,
          type: 'cmd',
          cmd: 'validateProjectName',
          projectName: value,
        }));

      });
    }
  }

  onDocDrop(event) {
    this.docFiles.value.push(...event.addedFiles);
  }
  

}
