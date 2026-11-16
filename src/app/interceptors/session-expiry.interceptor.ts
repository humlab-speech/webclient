import { Injectable, Injector } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { UserService } from '../services/user.service';

/**
 * Whether a request went to Visp's own PHP API (/api/v1/...). The recorder's
 * API (/spr/api/v1) and third-party hosts answer 401 for their own reasons.
 */
export function isVispApiUrl(url:string):boolean {
  try {
    return new URL(url, window.location.href).pathname.startsWith("/api/v1/");
  }
  catch {
    return false;
  }
}

/**
 * api.php answers 401 only when it cannot tell who the browser is - the
 * session cookie is gone or the session behind it is. Whichever request is
 * first to find that out (an upload, the heartbeat) brings the signed-in UI
 * down, instead of leaving the user on a dashboard that can no longer act.
 * A 403 (signed in, no access grant) is deliberately left alone.
 */
@Injectable()
export class SessionExpiryInterceptor implements HttpInterceptor {
  // UserService is fetched lazily: it injects HttpClient, which depends on the
  // interceptors, so a constructor dependency on it would be circular.
  constructor(private injector:Injector) {}

  intercept(req:HttpRequest<unknown>, next:HttpHandler):Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(tap({
      error: (error) => {
        if(error instanceof HttpErrorResponse && error.status === 401 && isVispApiUrl(req.url)) {
          this.injector.get(UserService).handleSessionInvalidated();
        }
      }
    }));
  }
}
