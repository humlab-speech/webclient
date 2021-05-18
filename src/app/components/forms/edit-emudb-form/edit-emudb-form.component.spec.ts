import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditEmudbFormComponent } from './edit-emudb-form.component';

describe('EditEmudbFormComponent', () => {
  let component: EditEmudbFormComponent;
  let fixture: ComponentFixture<EditEmudbFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditEmudbFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditEmudbFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
