import { AbstractControl, ValidationErrors } from '@angular/forms'
import { Observable, of } from 'rxjs';
import { map, debounceTime } from 'rxjs/operators';
import { Config } from '../../../../config';

export function validateProjectName(control:AbstractControl):Observable<ValidationErrors> | null {

    const value: string = control.value;

    return this.http.get(Config.API_ENDPOINT + '/projects?search=' + value)
    .pipe(
      debounceTime(500),
      map( (data:any) =>  {
        console.log(data);
          if (!data.isValid) return ({ 'isFormNameFree': true })
      })
    );

    /*
    if(control.value == "thisisdog") {
        console.log("hello dog!");
        return of({ 'isFormNameFree': true, 'requiredValue': 10 })
    }
    
    return of(null);
    */
  }