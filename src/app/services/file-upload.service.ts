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
  // Uploads in flight, so that removing a file can wait for the upload that made
  // its stored copy. The per-destination sequence number stops a delete from
  // removing a copy that a newer upload of the same name has taken over.
  private uploadPromises = new WeakMap<object, { key:string, seq:number, promise:Promise<any> }>();
  private lastUploadSeq = new Map<string, number>();
  private uploadSeq = 0;

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

    // Where api.php will store this upload
    const uploadKey = context + "/" + group + "/" + FileUploadService.storedName(file.name);
    const uploadSeq = ++this.uploadSeq;
    this.lastUploadSeq.set(uploadKey, uploadSeq);

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
    this.uploadPromises.set(file, { key: uploadKey, seq: uploadSeq, promise: uploadPromise });
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
    // Trim and collapse exactly like api.php does (byte-wise, ASCII only): its
    // trim() set is " \t\n\r\0\x0B" and preg_replace('/\s+/') without /u is
    // " \t\n\r\f\v". JS's .trim() and /\s+/ additionally eat U+00A0 and the
    // Unicode spaces, which made "a\u00a0b.pdf" and "a b.pdf" the same key here
    // while api.php stored them as two different files: the second was then
    // treated as a duplicate, and deleting one skipped the server-side delete of
    // the other, so a removed upload survived and was imported on the next save.
    return clean
      .replace(/^[\t\n\r\0\x0B ]+|[\t\n\r\0\x0B ]+$/g, "")
      .replace(/[ \t\n\r\f\v]+/g, "_");
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
      const upload = this.uploadPromises.get(file);
      if(upload) {
        await upload.promise.catch(() => null);
        if(this.lastUploadSeq.get(upload.key) !== upload.seq) {
          // The same file was dropped again in the meantime, so that upload owns
          // the stored copy now: deleting would throw away a file to be imported.
          return true;
        }
      }
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
