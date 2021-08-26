import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContainerSessionRenderComponent } from './container-session-render.component';

describe('ContainerSessionRenderComponent', () => {
  let component: ContainerSessionRenderComponent;
  let fixture: ComponentFixture<ContainerSessionRenderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ContainerSessionRenderComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ContainerSessionRenderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
