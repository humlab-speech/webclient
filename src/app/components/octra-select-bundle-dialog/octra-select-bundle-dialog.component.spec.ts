import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OctraSelectBundleDialogComponent } from './octra-select-bundle-dialog.component';

describe('OctraSelectBundleDialogComponent', () => {
  let component: OctraSelectBundleDialogComponent;
  let fixture: ComponentFixture<OctraSelectBundleDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OctraSelectBundleDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OctraSelectBundleDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
