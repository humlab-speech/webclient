import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray } from '@angular/forms';
import { nanoid } from 'nanoid'
import { ProjectService } from "../../../services/project.service";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { FileUploadService } from "../../../services/file-upload.service";
import { NotifierService } from 'angular-notifier';

@Component({
  selector: 'app-documentation-form',
  templateUrl: './documentation-form.component.html',
  styleUrls: ['./documentation-form.component.scss']
})
export class DocumentationFormComponent implements OnInit {

  @Input() context:any;

  status:string = "Ready";
  docFiles:object[] = [];
  private readonly notifier: NotifierService;

  constructor(private http:HttpClient, private fileUploadService:FileUploadService, notifierService: NotifierService) {
    this.notifier = notifierService;
  }

  ngOnInit(): void {
  }

  onUpload(event) {
    /*
    for(let key in event.addedFiles) {
      if(event.addedFiles[key].type == "") {
        this.notifier.notify('info', "File '"+event.addedFiles[key].name+"' has no type and cannot be added. Did you try to upload a directory?");
        event.addedFiles.splice(key, 1);
      }
    }
    */

    this.docFiles.push(...event.addedFiles);

    this.status = "Uploading";

    for(let key in event.addedFiles) {
      let file:File = event.addedFiles[key];
      this.uploadFile(file);
    }
  }

  async uploadFile(file:File) {
    this.fileUploadService.upload(file, this.context.formContextId, "docs");
  }
}
