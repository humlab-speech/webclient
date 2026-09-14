import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrattSelectBundleDialogComponent } from './tratt-select-bundle-dialog.component';

describe('TrattSelectBundleDialogComponent', () => {
  let component: TrattSelectBundleDialogComponent;
  let fixture: ComponentFixture<TrattSelectBundleDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrattSelectBundleDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrattSelectBundleDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
