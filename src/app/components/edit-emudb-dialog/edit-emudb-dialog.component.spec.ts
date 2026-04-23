import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditEmudbDialogComponent } from './edit-emudb-dialog.component';

describe('EditEmudbDialogComponent', () => {
  let component: EditEmudbDialogComponent;
  let fixture: ComponentFixture<EditEmudbDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EditEmudbDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EditEmudbDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
