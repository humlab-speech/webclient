import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NotifierService } from 'angular-notifier';
import { of, Subject } from 'rxjs';
import { SystemService } from 'src/app/services/system.service';

import { MenuBarComponent } from './menu-bar.component';

describe('MenuBarComponent', () => {
  let component: MenuBarComponent;
  let fixture: ComponentFixture<MenuBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MenuBarComponent ],
      providers: [
        { provide: Router, useValue: { events: of(), navigate: jasmine.createSpy('navigate') } },
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
