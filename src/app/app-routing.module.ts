import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';

import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SpeechrecorderngComponent, SpeechRecorderConfig, SpeechrecorderngModule } from 'speechrecorderng';


const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'auth', redirectTo: '/', pathMatch: 'full' }
];


const MY_APP_ROUTES: Routes = [
  { path: 'spr', component: SpeechrecorderngComponent}
];

const SPR_CFG:SpeechRecorderConfig={
  apiEndPoint: '/myapppath/api/v1'
}

@NgModule({
  imports: [
    RouterModule.forRoot(routes),
    RouterModule.forRoot(MY_APP_ROUTES),BrowserModule,BrowserAnimationsModule,SpeechrecorderngModule.forRoot(SPR_CFG)
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
