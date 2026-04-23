import { Component, OnInit } from '@angular/core';
import { ModalService } from '../../services/modal.service';
import ShepherdBase from 'shepherd.js';
import { SystemService } from 'src/app/services/system.service';

@Component({
  selector: 'app-help-dialog',
  templateUrl: './help-dialog.component.html',
  styleUrls: ['./help-dialog.component.scss']
})
export class HelpDialogComponent implements OnInit {

  modalService: ModalService;
  systemService: SystemService;
  shepherd: any;

  constructor(modalService:ModalService, systemService: SystemService) {
    this.systemService = systemService;
    this.modalService = modalService;
    this.shepherd = new ShepherdBase.Tour({
      defaultStepOptions: {
        classes: 'shadow-md bg-purple-dark',
        scrollTo: true
      },
      useModalOverlay: true
    });

  }

  getCurrentNavigation() {
    return this.systemService.getCurrentApplication();
  }

  ngOnInit(): void {
    this.initTour();
  }

  startTour() {
    this.closeDialog();
    this.shepherd.start();
  }

  initTour() {
    this.shepherd.addStep({
      id: 'step-1',
      text: 'This is the first step',
      attachTo: {
        element: '.step-1',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Next',
          action: this.shepherd.next
        }
      ]
    });

    this.shepherd.addStep({
      id: 'step-2',
      text: 'This is the second step',
      attachTo: {
        element: '.step-2',
        on: 'bottom'
      },
      buttons: [
        {
          text: 'Next',
          action: this.shepherd.next
        }
      ]
    });
  }

  closeDialog() {
    this.modalService.hideModal("help-dialog");
  }


  copyCode(codeId: string): void {
    const codeElement = document.getElementById(codeId);
    if (codeElement) {
      const codeText = codeElement.innerText;
      navigator.clipboard.writeText(codeText).then(() => {
        console.log('Text copied to clipboard');
      }).catch(err => {
        console.error('Could not copy text: ', err);
      });
    }
  }

}
