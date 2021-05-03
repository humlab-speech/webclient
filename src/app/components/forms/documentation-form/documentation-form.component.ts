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

  constructor(private http:HttpClient, private fileUploadService:FileUploadService, private notifierService: NotifierService) {
  }

  ngOnInit(): void {
  }

  onUpload(event) {
    for(let key in event.addedFiles) {
      event.addedFiles[key].uploadComplete = false;
    }

    this.docFiles.push(...event.addedFiles);

    this.status = "Uploading";

    for(let key in event.addedFiles) {
      let file = event.addedFiles[key];
      this.uploadFile(file).then(() => {
        this.notifierService.notify('info', 'Upload of ' + file.name + ' complete.');
        file.uploadComplete = true;
      })
    }
  }


  uploadFile(file:File) {
    return new Promise((resolve, reject) => {
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
          resolve(data);
        });
      });
    });
  }

  onRemove(file) {
    for(let key in this.docFiles) {
      if(this.docFiles[key] == file) {
        let keyNum:number = +key;
        this.docFiles.splice(keyNum, 1);
      }
    }
  }

}
