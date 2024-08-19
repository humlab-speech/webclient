import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InviteCodeEntryComponent } from './invite-code-entry.component';

describe('InviteCodeEntryComponent', () => {
  let component: InviteCodeEntryComponent;
  let fixture: ComponentFixture<InviteCodeEntryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InviteCodeEntryComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InviteCodeEntryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
