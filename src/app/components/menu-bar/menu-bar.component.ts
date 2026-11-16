import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { NotifierService } from 'angular-notifier';
import { Subscription } from 'rxjs';
import { SystemService } from 'src/app/services/system.service';
import { UserService } from 'src/app/services/user.service';
import { ThemeService } from 'src/app/services/theme.service';
import { brandLanguage } from 'src/app/lib/locale';

interface TopBarNotification {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  read: boolean;
  source: 'toast' | 'notification';
}

// Logo of the node hosting this installation, shown beside the topbar actions:
// Umeå University's Humlab variant (seal, name and "Humlab" on one line).
const HOST_NODE = {
  sv: { label: 'Humlab, Umeå universitet', href: 'https://www.umu.se/humlab/', logo: '/assets/humlab-umu-logo-SE.svg' },
  en: { label: 'Humlab, Umeå University', href: 'https://www.umu.se/en/humlab/', logo: '/assets/humlab-umu-logo-EN.svg' },
};

@Component({
  selector: 'app-menu-bar',
  templateUrl: './menu-bar.component.html',
  styleUrls: ['./menu-bar.component.scss']
})
export class MenuBarComponent implements OnInit, OnDestroy {

  public containerSessionViewActive:boolean = false;
  public showBackToDashboardButton:boolean = false;

  // Platform logo, per Språkbanken's graphic profile. The topbar is dark in
  // both themes and too slim for the slogan, which stays in the alt text.
  private readonly brandLang = brandLanguage();
  public readonly brandLogoPath = '/assets/visp_dark.svg';
  public readonly brandSlogan = this.brandLang === 'sv' ? 'Språkbankens talforskningsplattform' : 'Språkbanken’s speech research platform';
  public readonly hostNode = HOST_NODE[this.brandLang];
  public isDashboardRoute:boolean = false;

  public userAuthenticationCheckPerformed:boolean = false;
  public userIsAuthenticated:boolean = false;
  public userIsAuthorized:boolean = false;

  public heroCollapseProgress:number = 1;
  public isNotificationsPanelOpen:boolean = false;
  public unreadNotificationCount:number = 0;
  public notifications: TopBarNotification[] = [];

  private readonly maxNotifications:number = 12;

  private readonly COLLAPSE_DISTANCE = 520;
  private readonly BASE_CHASE_SPEED = 0.14;
  private readonly DISTANCE_CHASE_BOOST = 0.42;
  private readonly SNAP_THRESHOLD = 1.4;

  private collapseTargetScroll = 0;
  private collapseAnimatedScroll = 0;
  private isPageScrollUnlocked = false;
  private prevShowDashboardHero = false;
  private heroCollapseRafId:number | null = null;
  private lastTouchClientY:number | null = null;

  // Any open dialog (project-dialog, invite-codes-dialog, etc.) owns wheel/touch/keydown
  // input for as long as it's open — all of them share the .modal-bg backdrop. Without this
  // check, this hero-collapse animation (which lives at the window level, ahead of the
  // dialog's own scroll handling) hijacks scroll input meant for the dialog and animates
  // the hero banner behind it instead, which reads as "the dashboard scrolls in the background".
  private isEventInsideModal(target: EventTarget | null): boolean {
    return !!(target as HTMLElement | null)?.closest?.('.modal-bg');
  }

  private readonly onCollapseWheel = (event: WheelEvent) => {
    if(!this.showDashboardHero || this.isEventInsideModal(event.target)) {
      return;
    }

    if(!this.isPageScrollUnlocked) {
      event.preventDefault();
      this.handleCollapseDelta(event.deltaY);
      return;
    }

    if(window.scrollY <= 0 && event.deltaY < 0) {
      event.preventDefault();
      this.lockCollapsePage();
      this.handleCollapseDelta(event.deltaY);
    }
  };

  private readonly onCollapseTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    this.lastTouchClientY = touch ? touch.clientY : null;
  };

  private readonly onCollapseTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    if(!touch || this.lastTouchClientY === null) {
      return;
    }

    const deltaY = this.lastTouchClientY - touch.clientY;
    this.lastTouchClientY = touch.clientY;

    if(this.isEventInsideModal(event.target)) {
      return;
    }

    if(!this.isPageScrollUnlocked) {
      event.preventDefault();
      this.handleCollapseDelta(deltaY * 1.4);
      return;
    }

    if(window.scrollY <= 0 && deltaY < 0) {
      event.preventDefault();
      this.lockCollapsePage();
      this.handleCollapseDelta(deltaY * 1.4);
    }
  };

  private readonly onCollapseTouchEnd = () => {
    this.lastTouchClientY = null;
  };

  private readonly onCollapseKeydown = (event: KeyboardEvent) => {
    if(!this.showDashboardHero || this.isEventInsideModal(event.target)) {
      return;
    }

    const downKeys = ['ArrowDown', 'PageDown', ' '];
    const upKeys = ['ArrowUp', 'PageUp'];

    if(!this.isPageScrollUnlocked && downKeys.includes(event.key)) {
      event.preventDefault();
      this.handleCollapseDelta(event.key === 'PageDown' || event.key === ' ' ? 140 : 42);
      return;
    }

    if(!this.isPageScrollUnlocked && upKeys.includes(event.key)) {
      event.preventDefault();
      this.handleCollapseDelta(event.key === 'PageUp' ? -140 : -42);
      return;
    }

    if(this.isPageScrollUnlocked && window.scrollY <= 0 && upKeys.includes(event.key)) {
      event.preventDefault();
      this.lockCollapsePage();
      this.handleCollapseDelta(event.key === 'PageUp' ? -140 : -42);
    }
  };

  private readonly onCollapseScroll = () => {
    if(!this.showDashboardHero) {
      return;
    }

    if(this.isPageScrollUnlocked && window.scrollY <= 0 && this.collapseTargetScroll < this.COLLAPSE_DISTANCE) {
      this.lockCollapsePage();
    }
  };

  private routerSubscription?: Subscription;
  private userEventSubscription?: Subscription;
  private toastActionSubscription?: Subscription;
  private wsMessageSubscription?: Subscription;
  private notificationsFetched:boolean = false;

  constructor(
    private router: Router,
    private systemService: SystemService,
    private toastService: NotifierService,
    private userService: UserService,
    public themeService: ThemeService
  ) {
    this.userAuthenticationCheckPerformed = this.userService.userAuthenticationCheckPerformed;
    this.userIsAuthenticated = this.userService.userIsAuthenticated;
    this.userIsAuthorized = this.userService.userIsAuthorized;
  }

  ngOnInit(): void {
    this.updateRouteFlags(this.router.url || '/');
    if(typeof window !== 'undefined') {
      window.addEventListener('wheel', this.onCollapseWheel, { passive: false });
      window.addEventListener('touchstart', this.onCollapseTouchStart, { passive: true });
      window.addEventListener('touchmove', this.onCollapseTouchMove, { passive: false });
      window.addEventListener('touchend', this.onCollapseTouchEnd, { passive: true });
      window.addEventListener('touchcancel', this.onCollapseTouchEnd, { passive: true });
      window.addEventListener('keydown', this.onCollapseKeydown);
      window.addEventListener('scroll', this.onCollapseScroll, { passive: true });
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
      }

      if(event === 'userAuthorization') {
        this.userIsAuthorized = this.userService.userIsAuthorized;
        if(this.userIsAuthorized) {
          this.fetchNotificationsFromBackend();
        }
      }

      this.updateHeroCollapseForStateChange();
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

    if(this.userIsAuthorized) {
      this.fetchNotificationsFromBackend();
    }
    this.updateHeroCollapseForStateChange();
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

    if(typeof window !== 'undefined') {
      window.removeEventListener('wheel', this.onCollapseWheel);
      window.removeEventListener('touchstart', this.onCollapseTouchStart);
      window.removeEventListener('touchmove', this.onCollapseTouchMove);
      window.removeEventListener('touchend', this.onCollapseTouchEnd);
      window.removeEventListener('touchcancel', this.onCollapseTouchEnd);
      window.removeEventListener('keydown', this.onCollapseKeydown);
      window.removeEventListener('scroll', this.onCollapseScroll);
    }

    this.unlockCollapsePage();
  }

  backButtonClicked() {
    this.router.navigate(['/']);
    this.systemService.setCurrentApplication('dashboard');
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

  // The hero welcomes signed-out visitors on the front page; signed-in users
  // go straight to their projects (New project and Help live there too).
  get showDashboardHero():boolean {
    return this.isDashboardRoute
      && !this.showBackToDashboardButton
      && this.userAuthenticationCheckPerformed
      && !this.userIsAuthenticated;
  }

  get showUserActions():boolean {
    // Notifications only mean something to a user who can reach projects.
    return this.userIsAuthenticated && this.userIsAuthorized;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
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
    this.showBackToDashboardButton = firstPathPart === 'app' || firstPathPart === 'artic' || firstPathPart === 'tratt' || firstPathPart === 'admin';
    this.isDashboardRoute = firstPathPart === '';

    this.updateHeroCollapseForStateChange();
  }

  private getFirstPathPart(url:string): string {
    const pathWithoutQuery = (url || '').split('?')[0];
    const normalizedPath = pathWithoutQuery.startsWith('/') ? pathWithoutQuery : `/${pathWithoutQuery}`;

    return normalizedPath.split('/')[1] || '';
  }

  private updateHeroCollapseForStateChange(): void {
    const current = this.showDashboardHero;

    if(current && !this.prevShowDashboardHero) {
      this.collapseTargetScroll = 0;
      this.collapseAnimatedScroll = 0;
      this.heroCollapseProgress = 0;
      this.lockCollapsePage();
    } else if(!current && this.prevShowDashboardHero) {
      this.heroCollapseProgress = 1;
      this.collapseTargetScroll = 0;
      this.collapseAnimatedScroll = 0;
      this.unlockCollapsePage();
    }

    this.prevShowDashboardHero = current;
  }

  private handleCollapseDelta(deltaY: number): void {
    this.collapseTargetScroll = Math.max(0, Math.min(this.COLLAPSE_DISTANCE, this.collapseTargetScroll + deltaY));

    if(this.collapseTargetScroll >= this.COLLAPSE_DISTANCE && !this.isPageScrollUnlocked) {
      this.unlockCollapsePage();
    }

    this.scheduleCollapseApply();
  }

  private scheduleCollapseApply(): void {
    if(typeof window === 'undefined' || this.heroCollapseRafId !== null) {
      return;
    }

    this.heroCollapseRafId = window.requestAnimationFrame(() => this.applyCollapse());
  }

  private applyCollapse(): void {
    this.heroCollapseRafId = null;

    const distanceToTarget = this.collapseTargetScroll - this.collapseAnimatedScroll;
    const normalizedDistance = Math.abs(distanceToTarget) / this.COLLAPSE_DISTANCE;
    const chaseSpeed = this.BASE_CHASE_SPEED + normalizedDistance * this.DISTANCE_CHASE_BOOST;

    this.collapseAnimatedScroll += distanceToTarget * chaseSpeed;

    if(Math.abs(distanceToTarget) < this.SNAP_THRESHOLD) {
      this.collapseAnimatedScroll = this.collapseTargetScroll;
    }

    if(this.collapseTargetScroll >= this.COLLAPSE_DISTANCE && !this.isPageScrollUnlocked) {
      this.unlockCollapsePage();
    }

    this.heroCollapseProgress = Math.max(0, Math.min(1, this.collapseAnimatedScroll / this.COLLAPSE_DISTANCE));

    if(Math.abs(this.collapseTargetScroll - this.collapseAnimatedScroll) > this.SNAP_THRESHOLD) {
      this.scheduleCollapseApply();
    }
  }

  private lockCollapsePage(): void {
    this.isPageScrollUnlocked = false;

    if(typeof document !== 'undefined') {
      document.body.classList.add('hero-phase1');
    }

    if(typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }

  private unlockCollapsePage(): void {
    this.isPageScrollUnlocked = true;

    if(typeof document !== 'undefined') {
      document.body.classList.remove('hero-phase1');
    }
  }

  private async fetchNotificationsFromBackend() {
    if(this.notificationsFetched) {
      return;
    }

    this.notificationsFetched = true;

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
      this.notificationsFetched = false;
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
