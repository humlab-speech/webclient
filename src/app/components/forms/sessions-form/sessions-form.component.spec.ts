import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SessionsFormComponent } from './sessions-form.component';

describe('EmudbFormComponent', () => {
  let component: SessionsFormComponent;
  let fixture: ComponentFixture<SessionsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SessionsFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SessionsFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
