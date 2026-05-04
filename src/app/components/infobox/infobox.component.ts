import { Component, OnInit, Input } from '@angular/core';
import { Infobox } from '../../models/Infobox';
import { environment } from 'src/environments/environment';
import { UserService } from '../../services/user.service';
import { ModalService } from '../../services/modal.service';

@Component({
  selector: 'app-infobox',
  templateUrl: './infobox.component.html',
  styleUrls: ['./infobox.component.scss']
})
export class InfoboxComponent implements OnInit {

  @Input() infobox: Infobox;
  octraEnabled:boolean = false;
  octraUrl:string = '';
  userIsLoggedIn:boolean = false;

  constructor(
    private userService: UserService,
    private modalService: ModalService
  ) { }

  ngOnInit(): void {
    this.octraEnabled = environment.ENABLED_APPLICATIONS.includes('octra');
    this.octraUrl = `https://octra.${window.location.hostname}`;
    this.userIsLoggedIn = !!this.userService.getSession()?.eppn;

    this.userService.sessionObs.subscribe((userSession) => {
      this.userIsLoggedIn = !!userSession?.eppn;
    });
  }

  showHelpDialog() {
    this.modalService.showModal('help-dialog');
  }
}
