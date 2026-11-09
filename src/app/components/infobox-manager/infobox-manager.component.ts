import { Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Infobox } from '../../models/Infobox';

@Component({
  selector: 'app-infobox-manager',
  templateUrl: './infobox-manager.component.html',
  styleUrls: ['./infobox-manager.component.scss']
})
export class InfoboxManagerComponent implements OnInit, OnChanges {

  @Input() expandedLayout:boolean = false;
  @ViewChild('accessEmailInput') accessEmailInput?: ElementRef<HTMLInputElement>;
  infoboxes:Infobox[] = [];
  showAccessRequestForm:boolean = false;
  accessRequestForm:FormGroup;

  constructor(private fb:FormBuilder) {
    this.accessRequestForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    this.refreshInfoboxes();
  }

  ngOnChanges(_changes:SimpleChanges):void {
    this.refreshInfoboxes();
  }

  private refreshInfoboxes():void {
    if(!this.expandedLayout) {
      this.showAccessRequestForm = false;
      this.accessRequestForm.reset();
    }

    this.infoboxes = this.expandedLayout
      ? [
          {
            name: 'secure-infrastructure',
            title: 'Secure infrastructure',
            body: 'An isolated environment for speech data processing, designed around security and compliance.'
          },
          {
            name: 'reproducible-workflows',
            title: 'Reproducible workflows',
            body: 'Documented project structures support reproducible processing, collaboration, long-term archiving, and FAIR data practices.'
          },
          {
            name: 'tools',
            title: 'Tools',
            body: 'TRATT is a free browser-based transcription tool. Audio stays in your browser and is not uploaded to VISP.'
          }
        ]
      : [
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

  get headingText():string {
    return this.expandedLayout ? 'Built for speech research' : 'Get Started';
  }

  toggleAccessRequestForm():void {
    this.showAccessRequestForm = !this.showAccessRequestForm;
    if(this.showAccessRequestForm) {
      setTimeout(() => this.accessEmailInput?.nativeElement.focus());
    }
  }

  submitAccessRequest():void {
    if(this.accessRequestForm.invalid) {
      this.accessRequestForm.markAllAsTouched();
      return;
    }

    const email = `${this.accessRequestForm.value.email || ''}`.trim();
    const subject = encodeURIComponent('VISP access request');
    const body = encodeURIComponent(
      `Hello,\n\nI would like to request access to VISP.\n\nContact email: ${email}\n`
    );

    if(typeof window !== 'undefined') {
      window.location.href = `mailto:support@humlab.umu.se?subject=${subject}&body=${body}`;
    }
  }

  get accessEmailControl() {
    return this.accessRequestForm.get('email');
  }

}
