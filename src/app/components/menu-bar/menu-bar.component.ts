import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { NotifierService } from 'angular-notifier';
import { Subscription } from 'rxjs';
import { SystemService } from 'src/app/services/system.service';

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
  public isNotificationsPanelOpen:boolean = false;
  public unreadNotificationCount:number = 0;
  public notifications: TopBarNotification[] = [];

  private readonly maxNotifications:number = 12;
  private routerSubscription?: Subscription;
  private toastActionSubscription?: Subscription;
  private wsMessageSubscription?: Subscription;

  constructor(private router: Router, private systemService: SystemService, private toastService: NotifierService) {
    this.router = router;
    this.systemService = systemService;
    this.toastService = toastService;
  }

  ngOnInit(): void {
    this.routerSubscription = this.router.events.subscribe((value) => {
      if(value instanceof NavigationEnd) {
        let pathParts = value.url.split('/');
        let firstPathPart = pathParts[1];

        if(firstPathPart.indexOf('?') != -1) {
          firstPathPart = firstPathPart.substring(0, firstPathPart.indexOf('?'));
        }

        this.containerSessionViewActive = firstPathPart == 'app' || firstPathPart == 'arctic';
        this.showBackToDashboardButton = firstPathPart == 'app' || firstPathPart == 'arctic' || firstPathPart == 'octra' || firstPathPart == 'admin';
      }
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
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
    this.toastActionSubscription?.unsubscribe();
    this.wsMessageSubscription?.unsubscribe();
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

  @HostListener('document:click')
  onDocumentClick() {
    this.isNotificationsPanelOpen = false;
  }

  @HostListener('document:keydown.escape')
  onEscapePressed() {
    this.isNotificationsPanelOpen = false;
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
