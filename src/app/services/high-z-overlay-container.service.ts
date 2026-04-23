import { OverlayContainer } from '@angular/cdk/overlay';
import { Injectable } from '@angular/core';

/**
 * Custom OverlayContainer that raises the z-index above the app's custom
 * modals (.modal-bg uses z-index 20000). Angular CDK sets the container's
 * z-index as an inline style, so a plain CSS rule cannot override it — this
 * service-level override is the correct fix.
 */
@Injectable()
export class HighZOverlayContainer extends OverlayContainer {
  protected override _createContainer(): void {
    super._createContainer();
    if (this._containerElement) {
      this._containerElement.style.zIndex = '30000';
    }
  }
}
