import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NotifierService } from 'angular-notifier';
import { of, Subject } from 'rxjs';
import { ModalService } from 'src/app/services/modal.service';
import { SystemService } from 'src/app/services/system.service';
import { UserService } from 'src/app/services/user.service';

import { MenuBarComponent } from './menu-bar.component';

describe('MenuBarComponent', () => {
  let component: MenuBarComponent;
  let fixture: ComponentFixture<MenuBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MenuBarComponent ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: Router, useValue: { events: of(), navigate: jasmine.createSpy('navigate'), url: '/' } },
        {
          provide: SystemService,
          useValue: {
            setCurrentApplication: jasmine.createSpy('setCurrentApplication'),
            wsSubject: new Subject(),
            sendCommandToBackend: jasmine.createSpy('sendCommandToBackend').and.returnValue(
              Promise.resolve({
                data: {
                  notifications: []
                }
              })
            )
          }
        },
        {
          provide: UserService,
          useValue: {
            eventEmitter: new Subject(),
            userAuthenticationCheckPerformed: true,
            userIsAuthenticated: false,
            userIsAuthorized: false,
            getSession: jasmine.createSpy('getSession').and.returnValue(null)
          }
        },
        { provide: ModalService, useValue: { showModal: jasmine.createSpy('showModal') } },
        { provide: NotifierService, useValue: { actionStream: of() } }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MenuBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
