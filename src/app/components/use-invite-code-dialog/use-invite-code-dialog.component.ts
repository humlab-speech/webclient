import { Component } from '@angular/core';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-use-invite-code-dialog',
  templateUrl: './use-invite-code-dialog.component.html',
  styleUrls: ['./use-invite-code-dialog.component.scss']
})
export class UseInviteCodeDialogComponent {

  constructor(private modalService: ModalService) { }

  closeDialog(): void {
    this.modalService.hideModal('use-invite-code-dialog');
  }
}
