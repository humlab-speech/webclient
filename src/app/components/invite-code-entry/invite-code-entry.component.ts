import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SystemService } from '../../services/system.service';
import { WebSocketMessage } from '../../models/WebSocketMessage';

@Component({
  selector: 'app-invite-code-entry',
  templateUrl: './invite-code-entry.component.html',
  styleUrls: ['./invite-code-entry.component.scss']
})
export class InviteCodeEntryComponent implements OnInit {
  inviteCodeForm: FormGroup;

  constructor(private fb: FormBuilder, private systemService: SystemService) { }

  ngOnInit(): void {
    this.inviteCodeForm = this.fb.group({
      code: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    if (this.inviteCodeForm.valid) {
      const code = this.inviteCodeForm.get('code').value;
      console.log(code)
      //check code against backend - and don't use websockets, use regular http since websockets requires authentication
      let data = {
        cmd: "validateInviteCode",
        data: {
          code: code
        }
      };

      this.systemService.sendCommandToBackend(data).then((wsMsg:WebSocketMessage) => {
        console.log(wsMsg);
        if (wsMsg.result) {
          //code is valid
          //redirect to the registration page
          window.location.href = '/register';
        } else {
          //code is invalid
          //display error message
          alert("Invalid code");
        }
      });


    }
  }
}
