import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http'
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LogoComponent } from './components/logo/logo.component';
import { FooterComponent } from './components/footer/footer.component';
import { InfoboxComponent } from './components/infobox/infobox.component';
import { InfoboxManagerComponent } from './components/infobox-manager/infobox-manager.component';
import { SigninCtrlComponent } from './components/signin-ctrl/signin-ctrl.component';
import { ProjectManagerComponent } from './components/project-manager/project-manager.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { ProjectItemComponent } from './components/project-item/project-item.component';
import { AppctrlComponent } from './components/appctrl/appctrl.component';
import { NgxDropzoneModule } from 'ngx-dropzone';
import { UserService } from './services/user.service';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { UserComponent } from './components/user/user.component';
import { ScriptAppDialogComponent } from './components/script-app-dialog/script-app-dialog.component';
import { NgxPopperjsModule } from 'ngx-popperjs';
import { NotifierModule } from 'angular-notifier';
import { CreateProjectDialogComponent } from './components/project-manager/create-project-dialog/create-project-dialog.component';
import { DocumentationFormComponent } from './components/forms/documentation-form/documentation-form.component';
import { EmudbFormComponent } from './components/forms/emudb-form/emudb-form.component';
import { EditEmudbDialogComponent } from './components/edit-emudb-dialog/edit-emudb-dialog.component';
import { MenuBarComponent } from './components/menu-bar/menu-bar.component';
import { ContainerSessionRenderComponent } from './components/container-session-render/container-session-render.component';
import { AboutComponent } from './components/about/about.component';


@NgModule({
  declarations: [
    AppComponent,
    LogoComponent,
    FooterComponent,
    InfoboxComponent,
    InfoboxManagerComponent,
    SigninCtrlComponent,
    ProjectManagerComponent,
    DashboardComponent,
    ProjectItemComponent,
    AppctrlComponent,
    CreateProjectDialogComponent,
    UserComponent,
    ScriptAppDialogComponent,
    DocumentationFormComponent,
    EmudbFormComponent,
    EditEmudbDialogComponent,
    MenuBarComponent,
    ContainerSessionRenderComponent,
    AboutComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    NgxDropzoneModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    NgxPopperjsModule,
    NotifierModule.withConfig({
      position: {
        horizontal: {
          position: 'right',
          distance: 12,
        },
        vertical: {
          position: 'top',
          distance: 12,
          gap: 10,
        }
      },
      behaviour: {
        autoHide: 5000,
        showDismissButton: true,
        stacking: 5
      }
    })
  ],
  providers: [
    UserService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
