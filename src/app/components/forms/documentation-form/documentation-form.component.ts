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

  status:string = "";
  docFiles:object[] = [];
  private readonly notifier: NotifierService;

  constructor(private http:HttpClient, private fileUploadService:FileUploadService, notifierService: NotifierService) {
    this.notifier = notifierService;
  }

  ngOnInit(): void {
  }

  onUpload(event) {
    for(let key in event.addedFiles) {
      if(event.addedFiles[key].type == "") {
        this.notifier.notify('info', "File '"+event.addedFiles[key].name+"' has no type and cannot be added. Did you try to upload a directory?");
        event.addedFiles.splice(key, 1);
      }
    }

    this.docFiles.push(...event.addedFiles);

    this.status = "Uploading";
    let uploads:Promise<any>[] = [];

    for(let key in event.addedFiles) {
      let file:File = event.addedFiles[key];
      uploads.push(this.uploadFile(file));
    }

    Promise.all(uploads).then((result) => {
      this.status = "";
    });
  }

  async uploadFile(file:File) {

    this.fileUploadService.readFile(file).then(fileContents => {
      let headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      };
      let body = {
        filename: file.name,
        file: fileContents,
        context: this.context.formContextId,
        group: "docs"
      };
      this.http.post<any>("/api/v1/upload", "data="+JSON.stringify(body), { headers }).subscribe(data => {
        return data;
      });
    });
    
    
  }
}
