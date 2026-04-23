import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { UserSession } from '../../models/UserSession';
import { NotifierService } from 'angular-notifier';
import { SystemService } from '../../services/system.service';
import { ModalService } from '../../services/modal.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {

  userAuthenticationCheckPerformed:boolean = false;
  modalActive:boolean = false;
  modalName:string = '';
  modalArgs:any[] = [];
  userIsAuthenticated:boolean = false;
  userIsAuthorized:boolean = false;
  gitlabReady:boolean = false;
  systemService:any = null;
  applicationName:string = environment.APPLICATION_NAME;
  userFullName:string = '';
  userSession:UserSession;
  heroCollapseProgress:number = 0;
  private readonly heroCollapseDistance:number = 216;
  private heroCollapseRafId:number | null = null;
  private readonly firstLoginPhrases:string[] = [
    'Nice to see you',
    'Great to have you here',
    'Happy to have you on board'
  ];
  private readonly returnPhrases:string[] = [
    'Welcome back',
    'Nice to see you again',
    'Glad you made it back'
  ];
  private readonly longBreakPhrases:string[] = [
    'It has been a while',
    'Welcome back after a break'
  ];

  private readonly notifier: NotifierService;

  constructor(private userService:UserService, notifierService: NotifierService, systemService: SystemService, private modalService: ModalService) {
    this.notifier = notifierService;
    this.systemService = systemService;

    this.userFullName = (window as any).visp.fullName;

    userService.eventEmitter.subscribe((event) => {
      if(event == 'userAuthentication') {
        if(!userService.userIsAuthenticated) {
          this.userIsAuthenticated = false;
        }
        else {
          this.userIsAuthenticated = true;
          this.userSession = userService.getSession();
        }
        this.userAuthenticationCheckPerformed = true;
      }
      if(event == 'userAuthorization') {
        if(!userService.userIsAuthorized) {
          this.userIsAuthorized = false;
        }
        else {
          this.userIsAuthorized = true;
          this.userSession = userService.getSession();
        }
      }
    });

    this.userAuthenticationCheckPerformed = userService.userAuthenticationCheckPerformed;
    this.userIsAuthenticated = userService.userIsAuthenticated;
    this.userIsAuthorized = userService.userIsAuthorized;
    this.userSession = userService.getSession();
  }

  ngOnInit(): void {
    this.modalService.displayModal$.subscribe(modal => {
      this.modalActive = modal.active;
      this.modalName = modal.modalName;
      this.modalArgs = modal.args || [];
    });

    this.systemService.setCurrentApplication('dashboard');
    this.scheduleHeroCollapseUpdate();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scheduleHeroCollapseUpdate();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleHeroCollapseUpdate();
  }

  ngOnDestroy(): void {
    if(this.heroCollapseRafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.heroCollapseRafId);
      this.heroCollapseRafId = null;
    }
  }

  private scheduleHeroCollapseUpdate(): void {
    if(typeof window === 'undefined') {
      return;
    }

    if(this.heroCollapseRafId !== null) {
      return;
    }

    this.heroCollapseRafId = window.requestAnimationFrame(() => {
      this.heroCollapseRafId = null;
      this.updateHeroCollapseProgress();
    });
  }

  private updateHeroCollapseProgress(): void {
    const scrollTop = typeof window !== 'undefined'
      ? (window.scrollY || window.pageYOffset || 0)
      : 0;

    const nextProgress = Math.max(0, Math.min(1, scrollTop / this.heroCollapseDistance));

    if(Math.abs(nextProgress - this.heroCollapseProgress) > 0.001) {
      this.heroCollapseProgress = nextProgress;
    } else if(nextProgress === 0 || nextProgress === 1) {
      this.heroCollapseProgress = nextProgress;
    }
  }

  get firstName():string {
    if(this.userSession?.firstName) {
      return this.userSession.firstName;
    }

    if(this.userFullName) {
      return this.userFullName.split(' ')[0] || this.userFullName;
    }

    return 'researcher';
  }

  get greetingLine():string {
    return `${this.getGreetingPrefix()}, ${this.firstName}`;
  }

  private getGreetingPrefix():string {
    const loginCount = this.userSession?.loginCount || 0;
    const lastLoginDurationSeconds = this.userSession?.lastLoginDurationSeconds;

    if(loginCount <= 1) {
      return this.pickPhrase(this.firstLoginPhrases);
    }

    if(typeof lastLoginDurationSeconds === 'number' && lastLoginDurationSeconds >= 60 * 60 * 24 * 14) {
      return this.pickPhrase(this.longBreakPhrases);
    }

    return this.pickPhrase(this.returnPhrases);
  }

  private pickPhrase(phrases:string[]):string {
    const seed = `${this.userSession?.username || this.userFullName || ''}:${this.userSession?.loginCount || 0}`;
    let hash = 0;
    for(let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }

    const index = Math.abs(hash) % phrases.length;
    return phrases[index];
  }

  get canCreateProjects():boolean {
    return !!this.userSession?.privileges?.createProjects;
  }

  createProject() {
    if(!this.canCreateProjects) {
      return;
    }
    this.modalService.showModal('project-dialog');
  }

  openHelpDialog() {
    this.modalService.showModal('help-dialog');
  }

  closeModal() {
    this.modalService.hideModal('invite-codes-dialog');
  }

}
