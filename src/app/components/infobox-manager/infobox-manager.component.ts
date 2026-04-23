import { Component, OnInit } from '@angular/core';
import { Infobox } from '../../models/Infobox';

@Component({
  selector: 'app-infobox-manager',
  templateUrl: './infobox-manager.component.html',
  styleUrls: ['./infobox-manager.component.scss']
})
export class InfoboxManagerComponent implements OnInit {

  infoboxes:Infobox[] = [];

  constructor() { }

  ngOnInit(): void {

    this.infoboxes = [
      {
        name: 'data-management',
        title: 'Data management',
        body: 'We provide an integrated workflow where your data is securely kept on our servers using Git for version control.'
      },
      {
        name: 'help-and-guides',
        title: 'Help & Guides',
        body: 'Want to learn how to start a project in VISP? Find tutorials and references here.'
      }
    ];

  }

}
