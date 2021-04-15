import { Component, OnInit, Input } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidationErrors, Validators, FormArray } from '@angular/forms';
import { nanoid } from 'nanoid'
import { ProjectService } from "../../../services/project.service";
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { FileUploadService } from "../../../services/file-upload.service";

@Component({
  selector: 'app-documentation-form',
  templateUrl: './documentation-form.component.html',
  styleUrls: ['./documentation-form.component.scss']
})
export class DocumentationFormComponent implements OnInit {

  @Input() context:any;

  status:string = "";
  docFiles:object[] = [];

  constructor(private http:HttpClient, private fileUploadService:FileUploadService) { }

  ngOnInit(): void {
    console.log(this.context);
  }

  onUpload(event) {
    console.log(event);
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
