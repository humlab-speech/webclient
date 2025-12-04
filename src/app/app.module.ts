import { CommonModule } from '@angular/common';
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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { UserComponent } from './components/user/user.component';
import { ScriptAppDialogComponent } from './components/script-app-dialog/script-app-dialog.component';
import { NgxPopperjsModule } from 'ngx-popperjs';
import { NotifierModule } from 'angular-notifier';
import { ProjectDialogComponent } from './components/project-manager/project-dialog/project-dialog.component';
import { DocumentationFormComponent } from './components/forms/documentation-form/documentation-form.component';
import { SessionsFormComponent } from './components/forms/sessions-form/sessions-form.component';
import { EditEmudbDialogComponent } from './components/edit-emudb-dialog/edit-emudb-dialog.component';
import { MenuBarComponent } from './components/menu-bar/menu-bar.component';
import { ContainerSessionRenderComponent } from './components/container-session-render/container-session-render.component';
import { AboutComponent } from './components/about/about.component';
import { ManageProjectMembersDialogComponent } from './components/manage-project-members-dialog/manage-project-members-dialog.component';
import { ManageProjectMembersFormComponent } from './components/forms/manage-project-members-form/manage-project-members-form.component';
import { MatTreeModule } from '@angular/material/tree';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ManageSessionsDialogComponent } from './components/manage-sessions-dialog/manage-sessions-dialog.component';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { SprScriptsFormComponent } from './components/forms/spr-scripts-form/spr-scripts-form.component';
import { ManageSprScriptsDialogComponent } from './components/manage-spr-scripts-dialog/manage-spr-scripts-dialog.component';
import { ManageBundleAssignmentDialogComponent } from './components/manage-bundle-assignment-dialog/manage-bundle-assignment-dialog.component';
import { ManageBundleAssignmentFormComponent } from './components/forms/manage-bundle-assignment-form/manage-bundle-assignment-form.component';
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { InviteCodesDialogComponent } from './components/invite-codes-dialog/invite-codes-dialog.component';
import { InviteCodeEntryComponent } from './components/invite-code-entry/invite-code-entry.component';
import { HelpDialogComponent } from './components/help-dialog/help-dialog.component';
import { HelpCtrlComponent } from './components/help-ctrl/help-ctrl.component';
import { TranscribeDialogComponent } from './components/transcribe-dialog/transcribe-dialog.component';
import { OctraSelectBundleDialogComponent } from './components/octra-select-bundle-dialog/octra-select-bundle-dialog.component';

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
    ProjectDialogComponent,
    UserComponent,
    ScriptAppDialogComponent,
    DocumentationFormComponent,
    SessionsFormComponent,
    EditEmudbDialogComponent,
    MenuBarComponent,
    ContainerSessionRenderComponent,
    AboutComponent,
    ManageProjectMembersDialogComponent,
    ManageProjectMembersFormComponent,
    ManageSessionsDialogComponent,
    SprScriptsFormComponent,
    ManageSprScriptsDialogComponent,
    ManageBundleAssignmentDialogComponent,
    ManageBundleAssignmentFormComponent,
    InviteCodesDialogComponent,
    InviteCodeEntryComponent,
    HelpDialogComponent,
    HelpCtrlComponent,
    TranscribeDialogComponent,
    OctraSelectBundleDialogComponent
  ],
  imports: [
    CommonModule,
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
    MatRadioModule,
    MatChipsModule,
    NgxPopperjsModule,
    MatFormFieldModule,
    MatTreeModule,
    MatIconModule,
    MatTooltipModule,
    ClipboardModule,
    NgxDatatableModule,
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
