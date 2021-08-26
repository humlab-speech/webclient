
import { Component, OnInit, Input, forwardRef, OnDestroy } from '@angular/core';
//import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray, AbstractControl } from '@angular/forms';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
  FormArray,
  NG_VALIDATORS,
  ValidationErrors,
  AbstractControl,
  ValidatorFn
} from '@angular/forms';
import { Subscription } from 'rxjs';
import { NotifierService } from 'angular-notifier';
import { ProjectService } from 'src/app/services/project.service';
import { Project } from '../../../models/Project';
import { ProjectManagerComponent } from '../../project-manager/project-manager.component';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { FileUploadService } from "../../../services/file-upload.service";
import { Observable, of } from 'rxjs';
import { map, debounceTime } from 'rxjs/operators';
import { Config } from '../../../config';
import { UserService } from 'src/app/services/user.service';
import { nanoid } from 'nanoid';

export interface EmudbFormValues {
  sessions: [];
  annotLevels: [];
  annotLevelLinks: [];
}

@Component({
  selector: 'app-emudb-form',
  templateUrl: './emudb-form.component.html',
  styleUrls: ['./emudb-form.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EmudbFormComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => EmudbFormComponent),
      multi: true
    }
  ]
})

export class EmudbFormComponent implements ControlValueAccessor, OnDestroy {
  @Input() formContextId: string;
  @Input() projectManager: ProjectManagerComponent;
  @Input() project: Project|null;
  @Input() parentForm:any;
  

  form:FormGroup;
  subscriptions: Subscription[] = [];
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

  showSessions:boolean = true;
  showAnnotLevels:boolean = true;
  showAnnotLevelLinks:boolean = true;
  storedEmuDb:any = null; //The EmuDB as it exists in Gitlab (if any)
  sessionAccessCode:string = null;

  formIsValid:boolean = true;

  get value(): EmudbFormValues {
    return this.form.value;
  }

  set value(value: EmudbFormValues) {
    this.form.setValue(value);
    this.onChange(value);
    this.onTouched();
  }

  constructor(private fb:FormBuilder, private notifierService: NotifierService, private projectService: ProjectService, private fileUploadService: FileUploadService) {}
  
  ngOnInit(): void {
    this.form = this.fb.group({});

    this.sessions = this.fb.array([], this.validateSessionNameUnique);
    this.annotLevels = this.fb.array([], this.validateAnnotLevelNameUnique);
    this.annotLevelLinks = this.fb.array([], this.validateAnnotLevelLinkNotToSame);

    this.form.addControl("sessions", this.sessions);
    this.form.addControl("annotLevels", this.annotLevels);
    this.form.addControl("annotLevelLinks", this.annotLevelLinks);

    this.subscriptions.push(
      // any time the inner form changes update the parent of any change
      this.form.valueChanges.subscribe(value => {
        this.onChange(value);
        this.onTouched();
      })
    );
    
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

  }

  loadEmuDbStruct(emuDbStruct) {
    this.resetForm();

    emuDbStruct.sessions.forEach(session => {
      this.addSession(session);
    });

    emuDbStruct.bundles.forEach(bundle => {

    });
  }

  loadProject(project) {
    return new Observable<any>(subscriber => {

      this.showAnnotLevels = false;
      this.showAnnotLevelLinks = false;
      subscriber.next({
        status: "loading",
        msg: "Fetching project session"
      });

      const context = nanoid();

      this.projectService.fetchSession(project, context).subscribe(msg => {
        let msgData = JSON.parse(msg.data);
        if(msgData.type == "cmd-result" && msgData.cmd == "fetchSession") {
          if(msgData.progress == "end") {
            this.sessionAccessCode = msgData.result;

            subscriber.next({
              status: "loading",
              message: "Scanning EmuDB"
            });

            this.projectService.scanEmuDb(this.sessionAccessCode).subscribe(msg => {
              let cmdResponse = JSON.parse(msg.data);
              let apiResponse = JSON.parse(cmdResponse.result);
              this.storedEmuDb = apiResponse.body;

              subscriber.next({
                status: "end",
                message: "Done"
              });

              subscriber.complete();
            });
          }
          else {
            subscriber.next({
              status: "loading",
              message: msgData.result
            });
          }
        }
      });
    });
  }

  adjustSessionNamesToAvoidConflict(externalSessions) {
    console.log(this.sessions.value)

    
    for(let key in this.sessions.value) {
      externalSessions.forEach(exSess => {
        console.log(exSess.name, this.sessions.value[key].name);
        if(exSess.name == this.sessions.value[key].name) {
          console.log('conflicut');

        }
      });
    }
    
  }

  getFormGroup() {
    return this.form;
  }
  

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  isFormValid() {
    return this.form.status != "INVALID" && this.fileUploadService.hasPendingUploads == false;
  }

  onChange: any = () => {};
  onTouched: any = () => {};

  registerOnChange(fn) {
    this.onChange = fn;
  }

  writeValue(value) {
    if (value) {
      this.value = value;
    }

    if (value === null) {
      //this.form.reset(); //I honestly don't know why angular is writing null when the form is initialized, but it does, and it's a nuisance, and disabling the reset doens't seem to hurt
    }
  }

  registerOnTouched(fn) {
    this.onTouched = fn;
  }

  // communicate the inner form validation to the parent form
  validate(_: FormControl) {
    return this.form.valid ? null : { profile: { valid: false } };
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

  validateAnnotLevelNameUnique(control: AbstractControl): {[key: string]: any} | null  {
    for(let key in control.value) {
      for(let key2 in control.value) {
        if(control.value[key].name == control.value[key2].name && key != key2) {
          return { 'annotLevelNameNotUnique': true };
        }
      }
    }
    return null;
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

  validateAnnotLevelLinkNotToSame(control: AbstractControl): {[key: string]: any} | null  {
    for(let key in control.value) {
      if(control.value[key].superLevel == control.value[key].subLevel) {
        return { 'annotLevelLinkCyclic': true };
      }
    }
    return null;
  }

  deleteAnnotLevelLink(index) {
    this.annotLevelLinkForms.removeAt(index);
  }

  emuSessionNameIsAvailable(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      let sessionNameTaken:boolean = false;
      if(this.storedEmuDb == null) {
        return null;
      }
      for(let key in this.storedEmuDb.sessions) {
        if(this.storedEmuDb.sessions[key].name == control.value) {
          sessionNameTaken = true;
        }
      }
      return sessionNameTaken ? { 'sessionNameTaken': sessionNameTaken } : null;
    };
  }


  addSession(session = null) {
    let sessionName = session != null ? session.name : 'Speaker_'+(this.sessionForms.length+1);

    if(this.project != null) {
      sessionName = "";
    }

    const sessionGroup = this.fb.group({
      id: new FormControl('session-' + nanoid()),
      name: new FormControl(sessionName, {
        validators: [Validators.required, Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*"), this.emuSessionNameIsAvailable()],
        updateOn: 'blur'
      }),
      speakerGender: new FormControl(null, {
        updateOn: 'blur'
      }),
      speakerAge: new FormControl(35, {
        validators: [Validators.pattern("[0-9]*"), Validators.nullValidator],
        updateOn: 'blur'
      }),
      files: this.fb.array([])
    });

    this.sessions.push(sessionGroup);
  }

  validateSessionNameUnique(control: AbstractControl): {[key: string]: any} | null  {
    for(let key in control.value) {
      for(let key2 in control.value) {
        if(control.value[key].name == control.value[key2].name && key != key2) {
          return { 'sessionNameNotUnique': true };
        }
      }
    }
    return null;
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
  
  onRemove(file, session) {
    this.fileUploadService.cancelUpload(file);
    session.value.files.splice(session.value.files.indexOf(event), 1);
    //TODO: Remove the uploaded file from the server?
  }

  closeDialog() {
    this.projectManager.dashboard.modalActive = false;
  }

  shutdownSession() {
    this.projectService.shutdownSession(this.sessionAccessCode).subscribe(msg => {
      if(!msg.data) {
        return;
      }
      let msgDataPkt = JSON.parse(msg.data);
      if(msgDataPkt.type == "cmd-result" && msgDataPkt.cmd == "shutdownSession") {
        if(msgDataPkt.progress != "end") {
          console.warn("Something went wrong with shutting down container session");
        }
      }
    });
  }

  resetForm() {
    while(this.sessions.length > 0) {
      this.sessions.removeAt(0);
    }

    while(this.annotLevels.length > 0) {
      this.annotLevels.removeAt(0);
    }

    while(this.annotLevelLinks.length > 0) {
      this.annotLevelLinks.removeAt(0);
    }
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

  submit() {
    console.log("submit");
  }

}
