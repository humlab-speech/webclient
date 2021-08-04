import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray, AbstractControl } from '@angular/forms';
import { nanoid } from 'nanoid';
import { ProjectService } from "../../../services/project.service";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ProjectManagerComponent } from '../project-manager.component';
import { FileUploadService } from "../../../services/file-upload.service";
import { NotifierService } from 'angular-notifier';
import { Observable, of } from 'rxjs';
import { map, debounceTime } from 'rxjs/operators';
import { Config } from '../../../config';
import { UserService } from 'src/app/services/user.service';
import { EmudbFormComponent } from '../../forms/emudb-form/emudb-form.component';

@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss']
})
export class CreateProjectDialogComponent implements OnInit {
  @ViewChild(EmudbFormComponent, { static: true }) public emudbFormComponent: EmudbFormComponent;

  EMUDB_INTEGRATION = Config.EMUDB_INTEGRATION;

  @Input() projectManager: ProjectManagerComponent;

  submitBtnLabel:string = "Create project";
  submitBtnEnabled:boolean = false;
  pendingUpload:boolean = false;
  showLoadingIndicator:boolean = false;
  submitBtnEnabledLockout:boolean = false;
  formValidationInterval:any;
  fileUploadsComlete:boolean = true;

  sessions:FormArray;
  annotLevels:FormArray;
  annotLevelLinks:FormArray;
  annotLevelTypes = [
    'ITEM',
    'SEGMENT',
    'EVENT'
  ];
  
  annotLevelLinkTypes = [
    'ONE_TO_MANY',
    'ONE_TO_ONE',
    'MANY_TO_MANY'
  ];


  form:FormGroup;

  formContextId:string = nanoid();

  constructor(private http:HttpClient, private fb:FormBuilder, private projectService:ProjectService, private userService:UserService, private fileUploadService:FileUploadService, private notifierService: NotifierService) {
  }

  ngOnInit(): void {
    this.setLoadingStatus(false);

    this.form = this.fb.group({
      projectName: new FormControl('', {
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      }),
      standardDirectoryStructure: new FormControl(true),
      createEmuDb: new FormControl(Config.EMUDB_INTEGRATION),
      emuDb: this.emudbFormComponent.createFormGroup()
    });

    //Disabled this for now - something's wrong with it and it doesn't work right
    this.form.controls['projectName'].setAsyncValidators([this.validateProjectName(this.http, this.userService)]);

    this.form.valueChanges.subscribe((values) => {
      this.validateForm();
    });
    

    this.sessions = this.fb.array([]);
    this.annotLevels = this.fb.array([]);
    this.annotLevelLinks = this.fb.array([]);

    this.form.addControl("sessions", this.sessions);
    this.form.addControl("annotLevels", this.annotLevels);
    this.form.addControl("annotLevelLinks", this.annotLevelLinks);

    if(this.sessionForms.length == 0) {
      this.addSession();
    }
    if(this.annotLevelForms.length == 0) {
      this.addAnnotLevel("Word", "ITEM");
      this.addAnnotLevel("Phonetic", "SEGMENT");
    }

    if(this.annotLevelLinks.length == 0) {
      this.addAnnotLevelLink("Word", "Phonetic");
    }

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

    document.getElementById("projectName").focus();
  }

  setLoadingStatus(isLoading = true) {
    if(isLoading) {
      //Set loading indicator
      this.submitBtnEnabled = false;
      this.showLoadingIndicator = true;
      this.submitBtnLabel = "Creating project";
      this.submitBtnEnabledLockout = true;
    }
    else {
      this.submitBtnEnabled = true;
      this.showLoadingIndicator = false;
      this.submitBtnLabel = "Create project";
      this.submitBtnEnabledLockout = false;
    }
  }
  
  validateForm() {
    if(this.form.valid && this.fileUploadsComlete) {
      this.submitBtnEnabled = true;
    }
    else {
      this.submitBtnEnabled = false;
    }

    return this.submitBtnEnabled;
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

  get annotLevelsForm() {
    return this.annotLevels.value as FormArray;
  }

  get sessionForms() {
    return this.form.get('sessions') as FormArray;
  }

  get annotLevelForms() {
    return this.form.get('annotLevels') as FormArray;
  }

  get annotLevelLinkForms() {
    return this.form.get('annotLevelLinks') as FormArray;
  }

  async createProject(form) {
    if(!this.validateForm()) {
      this.notifierService.notify('warning', "This form is not ready to be submitted yet.");
    }

    if(await this.isProjectNameTaken() == true) {
      this.notifierService.notify('warning', "This project name is already taken, please choose another.");
      return false;
    }

    this.setLoadingStatus(true);

    let formData = form.value;
    formData.sessions = this.emudbFormComponent.sessions.value;
    formData.annotLevels = this.emudbFormComponent.annotLevels.value;
    formData.annotLevelLinks = this.emudbFormComponent.annotLevelLinks.value;
   
    this.projectManager.projectsLoaded = false;
    
    this.projectService.createProject(form.value, this.formContextId).subscribe(msg => {
      let msgData = JSON.parse(msg.data);
      if(msgData.type == "cmd-result" && msgData.cmd == "createProject") {
        if(msgData.progress == "end") {
          this.projectService.updateProjects();
          this.form.reset();
          this.closeCreateProjectDialog();
        }
        else {
          this.submitBtnLabel = msgData.result;
        }
        
      }
    });

    /*
    this.projectService.createProject(form.value, this.formContextId).then(() => {
      this.form.reset();
      this.closeCreateProjectDialog();
    });
    */
   
  }

  closeCreateProjectDialog() {
    this.fileUploadService.reset();
    this.projectManager.dashboard.modalActive = false;
  }


  addAnnotLevel(name = "", type = "ITEM") {
    const annotLevel = this.fb.group({
      name: new FormControl(name, {
        validators: [Validators.required, Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      } ),
      type: new FormControl(type, Validators.required)
    });
    
    this.annotLevelForms.push(annotLevel);
  }

  deleteAnnotLevel(index) {
    //Delete any links which reference this annotLevel
    for(let key in this.annotLevelLinks.controls) {
      let keyNum:number = +key;
      let annotLevelLink:any = this.annotLevelLinks.controls[key];
      let annotLevelForm:any = this.annotLevelForms.at(index);
      if(annotLevelLink.controls.superLevel.value == annotLevelForm.controls.name.value || annotLevelLink.controls.subLevel.value == annotLevelForm.controls.name.value) {
        this.annotLevelLinks.removeAt(keyNum);
      }
    }
    
    this.annotLevelForms.removeAt(index);
  }

  addAnnotLevelLink(superLevel = null, subLevel = null, type = "ONE_TO_MANY") {
    const annotLevelLink = this.fb.group({
      superLevel: new FormControl(superLevel, Validators.required),
      subLevel: new FormControl(subLevel, Validators.required),
      type: new FormControl(type, Validators.required)
    });

    this.annotLevelLinkForms.push(annotLevelLink);
  }

  deleteAnnotLevelLink(index) {
    this.annotLevelLinkForms.removeAt(index);
  }

  addSession() {
    const session = this.fb.group({
      id: new FormControl('session-' + nanoid()),
      name: new FormControl('Speaker_'+(this.sessionForms.length+1), {
        validators: [Validators.required, Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      }),
      speakerGender: new FormControl(null, {
        updateOn: 'blur'
      }),
      speakerAge: new FormControl(null, {
        validators: [Validators.pattern("[0-9]*")],
        updateOn: 'blur'
      }),
      files: this.fb.array([])
    });
    this.sessionForms.push(session);
  }

  deleteSession(index) {
    this.sessionForms.removeAt(index);
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

  async isProjectNameTaken() {
    let session = this.userService.getSession();
    let headers = {
      "PRIVATE-TOKEN": session.personalAccessToken
    };

    return await new Promise((resolve, reject) => {
      this.http.get('https://gitlab.' + Config.BASE_DOMAIN + '/api/v4/projects?search=' + this.form.value.projectName, { headers }).subscribe((projects) => {
        for(let key in projects) {
          if(projects[key].name == this.form.value.projectName) {
            resolve(true);
            return;
          }
        }
        resolve(false);
      });
    });
  }

  validateProjectName(http:HttpClient, userService:UserService) {
    return function(control:AbstractControl):Observable<ValidationErrors> | null {
      const value: string = control.value;

      let session = userService.getSession();
      let headers = {
        "PRIVATE-TOKEN": session.personalAccessToken
      };

      return http.get('https://gitlab.' + Config.BASE_DOMAIN + '/api/v4/projects?search=' + value, { headers })
      .pipe(
        debounceTime(500),
        map( (projects:any) => {
          let isFormNameTaken = false;
          for(let key in projects) {
            if(projects[key].name == value) {
              isFormNameTaken = true;
            }
          }
          return isFormNameTaken ? { 'isFormNameTaken': isFormNameTaken } : null;
        })
      );
    }
  }

}
