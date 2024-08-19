import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  title = environment.APPLICATION_NAME;

  showModal: boolean = false;
  modalTitle: string = '';

  constructor() {}

  ngOnInit() {
  }

}
