import { Component, OnInit, Input } from '@angular/core';
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


@Component({
  selector: 'app-create-project-dialog',
  templateUrl: './create-project-dialog.component.html',
  styleUrls: ['./create-project-dialog.component.scss']
})
export class CreateProjectDialogComponent implements OnInit {

  EMUDB_INTEGRATION = Config.EMUDB_INTEGRATION;

  @Input() projectManager: ProjectManagerComponent;

  submitBtnLabel:string = "Create project";
  submitBtnEnabled:boolean = false;
  pendingUpload:boolean = false;
  formValidationInterval:any;

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

  constructor(private http:HttpClient, private fb:FormBuilder, private projectService:ProjectService, private userService:UserService, private fileUploadService:FileUploadService, private notifierService: NotifierService) { }

  ngOnInit(): void {

    this.form = this.fb.group({
      projectName: new FormControl('', {
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      }),
      standardDirectoryStructure: new FormControl(true),
      createEmuDb: new FormControl(Config.EMUDB_INTEGRATION)
    });

    //Disabled this for now - something's wrong with it and it doesn't work right
    //this.form.controls['projectName'].setAsyncValidators([this.validateProjectName(this.http, this.userService)]);

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

    this.fileUploadService.eventEmitter.subscribe((event) => {
      if(event == "pendingFormUploads") {
        this.validateForm();
      }
      if(event == "pendingFormUploadsComplete") {
        this.notifierService.notify('info', 'All uploads complete.');
        this.validateForm();
      }
    });

    document.getElementById("projectName").focus();
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
        map( (projects:any) =>  {
          let isForNameTaken = false;
          for(let key in projects) {
            if(projects[key].name == value) {
              isForNameTaken = true;
            }
          }
          return { 'isFormNameTaken': isForNameTaken };
        })
      );
    }
  }
  
  validateForm() {
    if(this.form.status != "INVALID" && this.fileUploadService.hasPendingUploads == false) {
      this.submitBtnEnabled = true;
    }
    else {
      this.submitBtnEnabled = false;
    }
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

  async createProject(form) {
    if(this.form.status != "INVALID" && !this.submitBtnEnabled) {
      this.notifierService.notify('warning', "The form is not ready to be submitted yet.");
      return false;
    }

    if(this.fileUploadService.hasPendingUploads == true) {
      this.notifierService.notify('info', 'There are file uploads in progress, please wait until they are complete.');
      return false;
    }

    if(await this.isProjectNameTaken() == true) {
      this.notifierService.notify('warning', "This project name is already taken, please choose another.");
      return false;
    }

    this.projectManager.projectsLoaded = false;
    this.projectService.createProject(form.value, this.formContextId);

    /*
    let webSocket = new WebSocket('wss://'+Config.BASE_DOMAIN+'/ws', "create-project-feed");
    webSocket.send("Here's some text that the server is urgently awaiting!");
    */

    this.form.reset();
    this.closeCreateProjectDialog();
  }

  closeCreateProjectDialog() {
    this.fileUploadService.reset();
    this.projectManager.dashboard.modalActive = false;
  }


  addAnnotLevel(name = "", type = "ITEM") {
    const annotLevel = this.fb.group({
      name: new FormControl(name, [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")]),
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
      name: new FormControl('Session '+(this.sessionForms.length+1), {
        validators: [Validators.required, Validators.minLength(3), Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
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
    return await this.fileUploadService.upload(file, this.formContextId, "emudb-sessions/"+session.controls.name.value);
  }
  
  onRemove(event, session) {
    session.value.files.splice(session.value.files.indexOf(event), 1);
    //TODO: Remove the uploaded file from the server?
  }

}
