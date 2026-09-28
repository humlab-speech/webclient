import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders } from '@angular/common/http'
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import * as JSZip from 'jszip';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {

  hasPendingUploads:boolean = false;
  zipBeforeUpload = false;
  pendingUploads:any = [];
  statusStream:Subject<any>;
  // Uploads in flight, so that removing a file can wait for its upload to land
  private uploadPromises = new WeakMap<object, Promise<any>>();

  constructor(private http:HttpClient) {
    this.statusStream = new Subject<any>();
  }
  

  async upload(file, context:string = "", group:string = ""):Promise<Subscription> {
    console.log("Uploading "+file.name);

    this.statusStream.next("uploads-in-progress");

    file.uploadComplete = false;
    this.hasPendingUploads = true;
    this.pendingUploads.push(file);

    let zipBlob = null;
    if(this.zipBeforeUpload) {
      console.log("Zipping uploaded file");
      console.time("Zip complete");
      const zip = new JSZip.default();
      zip.file(file.name, file);

     zipBlob = await zip.generateAsync({
        type : "blob",
        platform: "UNIX",
        compression: "DEFLATE",
        compressionOptions: {
          level: 1
        }
      });

      console.timeEnd("Zip complete");
    }

    console.log("Uploading file");

    let formData = new FormData();
    let fileMeta = {
      filename: file.name,
      context: context,
      group: group
    };
    formData.append("fileMeta", JSON.stringify(fileMeta));
    
    if(this.zipBeforeUpload) {
      let parts = fileMeta.filename.split(".");
      parts.pop();
      fileMeta.filename = parts.join(".")+".zip";
      formData.append("fileData", zipBlob);
    }
    else {
      formData.append("fileData", file);
    }

    const uploadPromise = new Promise((resolve, reject) => {
      this.http.post<any>("/api/v1/upload", formData).subscribe({
        next: (data) => {
          file.uploadComplete = true;
          if (this.isAllUploadsComplete()) {
            this.statusStream.next("all-uploads-complete");
          }
          resolve(data);
        },
        error: (error) => {
          console.error(error);
          reject(error);
        }
      });
    });
    this.uploadPromises.set(file, uploadPromise);
    return uploadPromise as Promise<any>;
  }

  // The name the API stores an upload under; mirrors sanitize() in api.php
  static storedName(name:string):string {
    const strip = ["~", "`", "!", "@", "#", "$", "%", "^", "&", "*", "=", "+", "[", "{", "]",
      "}", "\\", "|", ";", ":", "\"", "'", ",", "<", ">", "?", "(", ")"];
    let clean = String(name).replace(/<[^>]*>/g, "");
    for(const c of strip) {
      clean = clean.split(c).join("");
    }
    return clean.trim().replace(/\s+/g, "_");
  }

  /**
   * Deletes an upload from the server again, for a file removed before the
   * form was saved: otherwise it would still be added on save. Counts as a
   * pending upload until done, so the form can't be saved in between.
   * Resolves to whether the file is gone.
   */
  async deleteUpload(file, context:string, group:string):Promise<boolean> {
    const pending = { name: file.name, uploadComplete: false };
    this.pendingUploads.push(pending);
    this.hasPendingUploads = true;
    this.statusStream.next("uploads-in-progress");
    try {
      // A file removed while still uploading is deleted once its upload has landed
      await this.uploadPromises.get(file)?.catch(() => null);
      const response:any = await firstValueFrom(this.http.post("/api/v1/upload/delete", {
        context: context,
        group: group,
        filename: file.name,
      }));
      // 404: nothing was stored, e.g. because the upload itself failed
      return response?.code == 200 || response?.code == 404;
    }
    catch(error) {
      console.error(error);
      return false;
    }
    finally {
      this.cancelUpload(pending);
      if(this.isAllUploadsComplete()) {
        this.statusStream.next("all-uploads-complete");
      }
    }
  }


  cancelUpload(file) {
    for(let key in this.pendingUploads) {
      if(this.pendingUploads[key] === file) {
        this.pendingUploads.splice(key, 1);
      }
    }
    this.isAllUploadsComplete();
  }

  isAllUploadsComplete() {
    for(let key in this.pendingUploads) {
      if(this.pendingUploads[key].uploadComplete == false) {
        this.hasPendingUploads = true;
        return false;
      }
    }
    this.hasPendingUploads = false;
    return true;
  }

  async readFile(file: File, returnAsDataUrl = true): Promise<string | ArrayBuffer> {
    return new Promise<string | ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = e => {
        return resolve((e.target as FileReader).result);
      };

      reader.onerror = e => {
        console.error(`FileReader failed on file ${file.name}.`);
        return reject(null);
      };

      if (!file) {
        console.error('No file to read.');
        return reject(null);
      }

      
      if(returnAsDataUrl) {
        reader.readAsDataURL(file);
      }
      else {
        reader.readAsArrayBuffer(file);
      }
      
    });
  }

  reset() {
    this.pendingUploads = [];
    this.hasPendingUploads = false;
  }
}
