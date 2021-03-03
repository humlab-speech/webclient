import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http'

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LogoComponent } from './components/logo/logo.component';
import { FooterComponent } from './components/footer/footer.component';
import { InfoboxComponent } from './components/infobox/infobox.component';
import { InfoboxManagerComponent } from './components/infobox-manager/infobox-manager.component';
import { HeaderComponent } from './components/header/header.component';
import { SigninCtrlComponent } from './components/signin-ctrl/signin-ctrl.component';
import { ProjectManagerComponent } from './components/project-manager/project-manager.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProjectItemComponent } from './components/project-item/project-item.component';
import { AppctrlComponent } from './components/appctrl/appctrl.component';

import { NgxDropzoneModule } from 'ngx-dropzone';
import { UserService } from './services/user.service';
import { CreateProjectDialogComponent } from './components/project-manager/create-project-dialog/create-project-dialog.component';


@NgModule({
  declarations: [
    AppComponent,
    LogoComponent,
    FooterComponent,
    InfoboxComponent,
    InfoboxManagerComponent,
    HeaderComponent,
    SigninCtrlComponent,
    ProjectManagerComponent,
    DashboardComponent,
    ProjectItemComponent,
    AppctrlComponent,
    CreateProjectDialogComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    NgxDropzoneModule
  ],
  providers: [
    UserService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
