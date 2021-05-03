import { Component, OnInit, Input } from '@angular/core';
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
    this.docFiles.push(...event.addedFiles);

    this.status = "Uploading";

    for(let key in event.addedFiles) {
      let file = event.addedFiles[key];
      this.uploadFile(file).then(() => {
      })
    }
  }

  async uploadFile(file:File) {
    return await this.fileUploadService.upload(file, this.context.formContextId, "docs");
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
