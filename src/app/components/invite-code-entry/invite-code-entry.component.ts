import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SystemService } from '../../services/system.service';
import { ProjectService } from '../../services/project.service';
import { WebSocketMessage } from '../../models/WebSocketMessage';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-invite-code-entry',
  templateUrl: './invite-code-entry.component.html',
  styleUrls: ['./invite-code-entry.component.scss']
})
export class InviteCodeEntryComponent implements OnInit {
  inviteCodeForm: FormGroup;
  formMessage: string;

  constructor(private fb: FormBuilder, 
    private systemService: SystemService, 
    private userService: UserService,
    private projectService: ProjectService
  ) { }

  ngOnInit(): void {
    this.formMessage = '';
    this.inviteCodeForm = this.fb.group({
      code: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.inviteCodeForm.valid) {
      const code = this.inviteCodeForm.get('code').value;
      let userSession = this.userService.getSession();
      
      if(userSession == null) {
        console.error("User session is null");
        return;
      }
      
      let data = {
        cmd: "validateInviteCode",
        data: {
          code: code,
          session: userSession
        }
      };

      this.systemService.sendCommandToBackend(data).then((wsMsg:WebSocketMessage) => {

        if (wsMsg.result) {
          //code is valid
          //redirect to base path
          this.formMessage = 'Your code has been verified. You will be redirected in a few seconds.';
          
          setTimeout(() => {
            console.log("Setting user authentication status to authorized");
            this.formMessage = '';
            this.userService.setAuthorizationStatus(true);

            //re-fetch projects
            this.projectService.fetchProjects(true).subscribe(projects => {
              console.log(projects);
            });
          }, 3000);
          
        } else {
          //code is invalid
          //display error message
          this.formMessage = 'We were unable to verify this code. Please contact us at support@humlab.umu.se for assistance.';
        }
      });


    }
  }
}
