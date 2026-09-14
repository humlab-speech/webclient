import { Component, OnInit } from '@angular/core';
import { ModalService } from '../../services/modal.service';
import Cookies from 'js-cookie';
import { SystemService } from 'src/app/services/system.service';

@Component({
  selector: 'app-container-session-render',
  templateUrl: './container-session-render.component.html',
  styleUrls: ['./container-session-render.component.scss']
})
export class ContainerSessionRenderComponent implements OnInit {
  public token:string = "";
  public showLoadingIndicator:boolean = true;
  private modalService: ModalService;
  public modalActive:boolean = false;
  public modalName:string = "";
  public modalArgs:any[] = [];

  constructor(modalService: ModalService, private systemService: SystemService) {
    this.modalService = modalService;
    let token = window.location.search.substr(window.location.search.indexOf("token=")+6);
    this.token = token;
    this.systemService = systemService;
  }

  ngOnInit(): void {
    let iframe = document.getElementById("proxied-container");
    
    iframe.onload = () => {
      setTimeout(() => {
        this.showLoadingIndicator = false;
      }, 500);
    }

    console.log(window.location.protocol+"//app."+window.location.hostname+"?token="+this.token);

    switch(window.location.pathname) {
      case "/app":
        iframe.setAttribute("src", window.location.protocol+"//app."+window.location.hostname+"?token="+this.token);
        break;
      case "/artic":
        let emuWebAppUrl = window.location.protocol+"//artic."+window.location.hostname+window.location.search;
        iframe.setAttribute("src", emuWebAppUrl);
        break;
      case "/tratt":
        this.setupTratt(iframe);
        break;
    }

    this.modalService.displayModal$.subscribe(modal => {
      this.modalActive = modal.active;
      this.modalName = modal.modalName;
      this.modalArgs = modal.args || [];
    });
  }

  setupTratt(iframe) {
    const DEBUG = false;

    let trattTask = Cookies.get("trattTask");
    if (DEBUG) console.log("Tratt task from cookie:", trattTask);
    let trattTaskAnnotationFile = Cookies.get("trattTaskAnnotationFile");
    if (DEBUG) console.log("Tratt task annotation file from cookie:", trattTaskAnnotationFile);

    // Use current origin so this works across domains/environments, including ports
    const apiBase = window.location.protocol + "//tratt." + window.location.host;
    const taskUrl = `${apiBase}/api/v1/file/download/${trattTask}`;
    if (!trattTask) {
      console.warn('Tratt task not found in cookies; download URL will be invalid.');
    }
    let trattUrlParams = `?embedded=true&audio_url=${encodeURIComponent(taskUrl)}.wav`;
    if(trattTaskAnnotationFile) {
      trattUrlParams += `&transcript=${encodeURIComponent(taskUrl)}_annot.json`;
    }
    let trattUrl = window.location.protocol+"//tratt."+window.location.hostname + trattUrlParams;

    iframe.setAttribute("src", trattUrl);

    interface TrattWindowMessageEventData {
      status?: "success" | "changed" | "error";
      data?: {
        annotation: IFile; // IFile with annotation saved as AnnotJSON.
      }
      error?: string; // only set on error
    }

    interface IFile {
      name: string;
      content: string;
      type: string;
      encoding: string;
    }

    window.addEventListener("message", (event) => {
      const trattMessageData: TrattWindowMessageEventData = event.data;

      if (trattMessageData?.status === "error" && trattMessageData?.error) {
        // something went wrong
        const error = trattMessageData.error;
        console.log("Tratt error:", error);
      } else if (trattMessageData?.status === "success") {
          // user clicked on "SAVE" button on the bottom
          const annotation = trattMessageData.data.annotation; // annotJSON
          if (DEBUG) console.log("Tratt annotation saved:", annotation);

          const annotationParsed = JSON.parse(annotation.content);

          this.systemService.sendCommandToBackend({
            cmd: "saveOctraTask",
            octraTaskId: annotationParsed.name,
            annotation: annotationParsed
          }).then((response: any) => {
            if (DEBUG) console.log('Task updated:', response);
          });

        } else if (trattMessageData?.status === "changed") {
          // user changed something in Tratt
          const annotation = trattMessageData.data.annotation; // annotJSON
          if (DEBUG) console.log("Tratt annotation changed:", annotation);
        }
    });
  }



  openModal() {
    console.log("Opening modal");
    this.modalService.showModal("invite-codes-dialog");
  }
  
}
