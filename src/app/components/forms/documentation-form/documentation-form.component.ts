import { Component, OnInit, Input, forwardRef, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { FileUploadService } from "../../../services/file-upload.service";
import { NotifierService } from 'angular-notifier';
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

@Component({
  selector: 'app-documentation-form',
  templateUrl: './documentation-form.component.html',
  styleUrls: ['./documentation-form.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DocumentationFormComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DocumentationFormComponent),
      multi: true
    }
  ]
})


export class DocumentationFormComponent implements ControlValueAccessor, OnDestroy, OnInit {

  @Input() context:any;

  status:string = "Ready";
  form:FormGroup;
  docFiles:FormArray;
  private readonly notifier: NotifierService;

  constructor(private http:HttpClient, private fileUploadService:FileUploadService, private notifierService: NotifierService, private fb:FormBuilder) {
  }

  ngOnInit(): void {
    this.form = this.fb.group({});

    this.docFiles = this.fb.array([]);

    //this.form.addControl("formContextId", new FormControl(this.formContextId));
    //this.form.addControl("project", new FormControl(this.project));
    this.form.addControl("files", this.docFiles);

  }

  ngOnDestroy(): void {
    
  }

  writeValue(obj: any): void {
    if(obj) {
      this.form.patchValue(obj);
    }
  }

  registerOnChange(fn: any): void {
    this.form.valueChanges.subscribe(fn);
  }

  registerOnTouched(fn: any): void {
    
  }

  onUpload(event) {
    this.docFiles.value.push(...event.addedFiles);
    this.status = "Uploading";

    for(let key in event.addedFiles) {
      let file = event.addedFiles[key];
      this.uploadFile(file).then(() => {
        console.log("Doc file upload complete");
        this.status = "Ready";
      });
    }
  }

  async uploadFile(file:File) {
    return await this.fileUploadService.upload(file, this.context.formContextId, "docs");
  }

  onRemove(file) {
    this.fileUploadService.cancelUpload(file);
    for(let key in this.docFiles.value) {
      if(this.docFiles.value[key] == file) {
        let keyNum:number = +key;
        this.docFiles.value.splice(keyNum, 1);
      }
    }
  }

}
