import { Component, OnInit } from '@angular/core';
import { ModalService } from '../../services/modal.service';

@Component({
    selector: 'app-help-ctrl',
    templateUrl: './help-ctrl.component.html',
    styleUrls: ['./help-ctrl.component.scss'],
    standalone: false
})
export class HelpCtrlComponent implements OnInit {

  modalService: any;

  constructor(modalService:ModalService) {
    this.modalService = modalService;
  }

  ngOnInit(): void {
  }

  showHelp() {
    this.modalService.showModal("help-dialog");
  }

}
