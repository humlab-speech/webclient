
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

    this.sessions = this.fb.array([]);
    this.annotLevels = this.fb.array([]);
    this.annotLevelLinks = this.fb.array([]);

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

    /*
    this.fileUploadService.eventEmitter.subscribe((event) => {
      if(event == "pendingFormUploads") {
        this.formIsValid = this.isFormValid();
      }
      if(event == "pendingFormUploadsComplete") {
        this.notifierService.notify('info', 'All uploads complete.');
        this.formIsValid = this.isFormValid();
      }
    });
    */

    //this.loadEmuDb();

  }

  createFormGroup() {
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


  loadEmuDb() {
    //Spin up an operations container
    this.projectService.getSession(this.project.id);
    //clone out the project
    //scan the emudb and fetch all the sessions & bundles & annotation levels & links
  }

  addAnnotLevel(name = "", type = "ITEM") {
    const annotLevel = this.fb.group({
      name: new FormControl(name, {
        validators: [Validators.required, Validators.maxLength(30), Validators.pattern("[a-zA-Z0-9 \\\-_]*")],
        updateOn: 'blur'
      } ),
      type: new FormControl(type, Validators.required)
    });

    /*
    annotLevel.get('name').valueChanges.subscribe((value) => {
      console.log(value);
      console.log(this.annotLevelForms);
    });

    this.annotLevelForms.statusChanges.subscribe((status) => {
      console.log(status);
    });

    annotLevel.valueChanges.subscribe((formGroupValues) => {
    });
    */
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

  emuSessionNameIsAvailable(projectService, project) {
    return function(control:AbstractControl):Observable<ValidationErrors> | null {
      const sessionName: string = control.value;
      return projectService.emuSessionNameIsAvailable(project, sessionName);
    }
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

    //If we are editing a project, setup validator for checking session name collisions
    if(this.project) {
      session.get('name').setAsyncValidators([this.emuSessionNameIsAvailable(this.projectService, this.project)]);
    }

    this.sessions.push(session);
  }

  deleteSession(index) {
    this.sessionForms.removeAt(index);
  }

  onAudioUpload(event, session) {
    //this.parentForm.fileUploadEvent(event);

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

  closeDialog() {
    this.projectManager.dashboard.modalActive = false;
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
