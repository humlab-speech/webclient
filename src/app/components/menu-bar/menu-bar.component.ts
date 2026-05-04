import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { NotifierService } from 'angular-notifier';
import { Subscription } from 'rxjs';
import { UserSession } from 'src/app/models/UserSession';
import { ModalService } from 'src/app/services/modal.service';
import { SystemService } from 'src/app/services/system.service';
import { UserService } from 'src/app/services/user.service';

interface TopBarNotification {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  read: boolean;
  source: 'toast' | 'notification';
}

@Component({
  selector: 'app-menu-bar',
  templateUrl: './menu-bar.component.html',
  styleUrls: ['./menu-bar.component.scss']
})
export class MenuBarComponent implements OnInit, OnDestroy {

  public containerSessionViewActive:boolean = false;
  public showBackToDashboardButton:boolean = false;
  public isDashboardRoute:boolean = false;

  public userAuthenticationCheckPerformed:boolean = false;
  public userIsAuthenticated:boolean = false;
  public userIsAuthorized:boolean = false;
  public userFullName:string = '';
  public userSession:UserSession = null;

  public heroCollapseProgress:number = 1;
  public isNotificationsPanelOpen:boolean = false;
  public unreadNotificationCount:number = 0;
  public notifications: TopBarNotification[] = [];

  private readonly maxNotifications:number = 12;
  private readonly heroCollapseDistance:number = 216;
  private readonly collapseBottomLockDistance:number = 6;
  private heroCollapseRafId:number | null = null;
  private observedScrollElement: HTMLElement | null = null;
  private readonly onAnyDocumentScroll = (event: Event) => {
    const eventTarget = event.target;
    if(eventTarget instanceof HTMLElement) {
      this.observedScrollElement = eventTarget;
    }
    this.scheduleHeroCollapseUpdate();
  };

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

  private routerSubscription?: Subscription;
  private userEventSubscription?: Subscription;
  private toastActionSubscription?: Subscription;
  private wsMessageSubscription?: Subscription;

  constructor(
    private router: Router,
    private systemService: SystemService,
    private toastService: NotifierService,
    private userService: UserService,
    private modalService: ModalService
  ) {
    this.userFullName = (window as any).visp?.fullName || '';
    this.userAuthenticationCheckPerformed = this.userService.userAuthenticationCheckPerformed;
    this.userIsAuthenticated = this.userService.userIsAuthenticated;
    this.userIsAuthorized = this.userService.userIsAuthorized;
    this.userSession = this.userService.getSession();
  }

  ngOnInit(): void {
    this.updateRouteFlags(this.router.url || '/');
    if(typeof document !== 'undefined') {
      document.addEventListener('scroll', this.onAnyDocumentScroll, { passive: true, capture: true });
    }

    this.routerSubscription = this.router.events.subscribe((value) => {
      if(value instanceof NavigationEnd) {
        this.updateRouteFlags(value.urlAfterRedirects || value.url);
      }
    });

    this.userEventSubscription = this.userService.eventEmitter.subscribe((event) => {
      if(event === 'userAuthentication') {
        this.userIsAuthenticated = this.userService.userIsAuthenticated;
        this.userAuthenticationCheckPerformed = true;
        if(this.userIsAuthenticated) {
          this.userSession = this.userService.getSession();
        }
      }

      if(event === 'userAuthorization') {
        this.userIsAuthorized = this.userService.userIsAuthorized;
        if(this.userIsAuthorized) {
          this.userSession = this.userService.getSession();
        }
      }

      this.scheduleHeroCollapseUpdate();
    });

    this.toastActionSubscription = this.toastService.actionStream.subscribe((action:any) => {
      this.addNotificationFromToast(action);
    });

    this.wsMessageSubscription = this.systemService.wsSubject.subscribe((message:any) => {
      if(message?.cmd !== 'serverNotification' || !message?.data?.notification) {
        return;
      }

      this.addNotification(this.mapServerNotification(message.data.notification));
    });

    this.fetchNotificationsFromBackend();
    this.scheduleHeroCollapseUpdate();
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.userEventSubscription?.unsubscribe();
    this.toastActionSubscription?.unsubscribe();
    this.wsMessageSubscription?.unsubscribe();

    if(this.heroCollapseRafId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.heroCollapseRafId);
      this.heroCollapseRafId = null;
    }

    if(typeof document !== 'undefined') {
      document.removeEventListener('scroll', this.onAnyDocumentScroll, true);
    }
  }

  backButtonClicked() {
    this.router.navigate(['/']);
    this.systemService.setCurrentApplication('dashboard');
  }

  createProject(): void {
    if(!this.canCreateProjects) {
      return;
    }

    this.modalService.showModal('project-dialog');
  }

  openHelpDialog(): void {
    this.modalService.showModal('help-dialog');
  }

  toggleNotificationsPanel(event: MouseEvent) {
    event.stopPropagation();
    this.isNotificationsPanelOpen = !this.isNotificationsPanelOpen;

    if(this.isNotificationsPanelOpen) {
      this.markVisibleNotificationsAsRead();
      this.unreadNotificationCount = 0;
    }
  }

  closeNotificationsPanel(event: MouseEvent) {
    event.stopPropagation();
    this.isNotificationsPanelOpen = false;
  }

  clearNotifications() {
    this.markVisibleNotificationsAsRead();
    this.notifications = [];
    this.unreadNotificationCount = 0;
  }

  trackByNotificationId(_index:number, notification:TopBarNotification) {
    return notification.id;
  }

  get showDashboardHero():boolean {
    if(!this.isDashboardRoute || this.showBackToDashboardButton || !this.userAuthenticationCheckPerformed) {
      return false;
    }

    if(!this.userIsAuthenticated) {
      return true;
    }

    return this.userIsAuthorized;
  }

  get showSignedInHero():boolean {
    return this.showDashboardHero && this.userIsAuthenticated && this.userIsAuthorized;
  }

  get showSignedOutHero():boolean {
    return this.showDashboardHero && !this.userIsAuthenticated;
  }

  get canCreateProjects():boolean {
    return !!this.userSession?.privileges?.createProjects;
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

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleHeroCollapseUpdate();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.isNotificationsPanelOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscapePressed() {
    this.isNotificationsPanelOpen = false;
  }

  private updateRouteFlags(url:string): void {
    const firstPathPart = this.getFirstPathPart(url);

    this.containerSessionViewActive = firstPathPart === 'app' || firstPathPart === 'artic';
    this.showBackToDashboardButton = firstPathPart === 'app' || firstPathPart === 'artic' || firstPathPart === 'octra' || firstPathPart === 'admin';
    this.isDashboardRoute = firstPathPart === '';

    this.scheduleHeroCollapseUpdate();
  }

  private getFirstPathPart(url:string): string {
    const pathWithoutQuery = (url || '').split('?')[0];
    const normalizedPath = pathWithoutQuery.startsWith('/') ? pathWithoutQuery : `/${pathWithoutQuery}`;

    return normalizedPath.split('/')[1] || '';
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
    if(!this.showDashboardHero) {
      this.heroCollapseProgress = 1;
      return;
    }

    const { scrollTop, maxScrollTop } = this.getCurrentScrollMetrics();
    const distanceToBottom = maxScrollTop - scrollTop;
    const lockCollapsedAtBottom = maxScrollTop > 0 && distanceToBottom <= this.collapseBottomLockDistance;

    if(lockCollapsedAtBottom) {
      if(this.heroCollapseProgress !== 1) {
        this.heroCollapseProgress = 1;
      }
      return;
    }

    const nextProgress = Math.max(0, Math.min(1, scrollTop / this.heroCollapseDistance));

    if(Math.abs(nextProgress - this.heroCollapseProgress) > 0.001) {
      this.heroCollapseProgress = nextProgress;
    } else if(nextProgress === 0 || nextProgress === 1) {
      this.heroCollapseProgress = nextProgress;
    }
  }

  private getCurrentScrollMetrics(): { scrollTop:number; maxScrollTop:number } {
    if(typeof window === 'undefined') {
      return { scrollTop: 0, maxScrollTop: 0 };
    }

    const scrollRoot = (document.scrollingElement || document.documentElement || document.body) as HTMLElement;
    const candidates: HTMLElement[] = [];

    if(this.observedScrollElement) {
      candidates.push(this.observedScrollElement);
    }
    if(scrollRoot) {
      candidates.push(scrollRoot);
    }

    let bestScrollTop = 0;
    let bestMaxScrollTop = 0;

    for(const candidate of candidates) {
      const candidateScrollTop = Math.max(0, candidate.scrollTop || 0);
      const candidateMaxScrollTop = Math.max(0, (candidate.scrollHeight || 0) - (candidate.clientHeight || 0));

      if(candidateScrollTop > bestScrollTop || (candidateScrollTop === bestScrollTop && candidateMaxScrollTop > bestMaxScrollTop)) {
        bestScrollTop = candidateScrollTop;
        bestMaxScrollTop = candidateMaxScrollTop;
      }
    }

    const windowScrollTop = Math.max(0, window.scrollY || window.pageYOffset || 0);
    if(windowScrollTop > bestScrollTop) {
      bestScrollTop = windowScrollTop;
      bestMaxScrollTop = Math.max(bestMaxScrollTop, Math.max(0, (scrollRoot?.scrollHeight || 0) - (scrollRoot?.clientHeight || 0)));
    }

    return {
      scrollTop: bestScrollTop,
      maxScrollTop: bestMaxScrollTop
    };
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

  private async fetchNotificationsFromBackend() {
    try {
      const response:any = await this.systemService.sendCommandToBackend({
        cmd: 'fetchNotifications',
        data: {
          limit: this.maxNotifications
        }
      });

      const notifications = Array.isArray(response?.data?.notifications) ? response.data.notifications : [];
      this.notifications = notifications.map((notification:any) => this.mapServerNotification(notification));
      this.unreadNotificationCount = this.notifications.filter((notification) => notification.read === false).length;
    } catch (error) {
      console.warn('Failed to fetch notifications from backend', error);
    }
  }

  private mapServerNotification(notification:any):TopBarNotification {
    return {
      id: notification.id || `notification_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type: (notification.type || 'info').toLowerCase(),
      message: notification.message || '',
      createdAt: notification.createdAt ? new Date(notification.createdAt) : new Date(),
      read: notification.read === true,
      source: 'notification'
    };
  }

  private addNotificationFromToast(action:any) {
    if(action.type !== 'SHOW' || !action.payload?.message) {
      return;
    }

    this.addNotification({
      id: action.payload.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type: (action.payload.type || 'info').toLowerCase(),
      message: action.payload.message,
      createdAt: new Date(),
      read: false,
      source: 'toast'
    });
  }

  private addNotification(notification: TopBarNotification) {
    this.notifications = [notification, ...this.notifications].slice(0, this.maxNotifications);

    if(!this.isNotificationsPanelOpen && notification.read === false) {
      this.unreadNotificationCount += 1;
    }
  }

  private markVisibleNotificationsAsRead() {
    const unreadNotificationIds = this.notifications
      .filter((notification) => notification.source === 'notification' && notification.read === false)
      .map((notification) => notification.id);

    this.notifications = this.notifications.map((notification) => ({ ...notification, read: true }));

    if(unreadNotificationIds.length < 1) {
      return;
    }

    this.systemService.sendCommandToBackend({
      cmd: 'markNotificationsRead',
      data: {
        notificationIds: unreadNotificationIds
      }
    }).catch((error) => {
      console.warn('Failed to mark notifications as read', error);
    });
  }

}
