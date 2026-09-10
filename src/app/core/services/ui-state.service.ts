import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UiStateService {
  // Panel visibility states
  readonly isLeftPanelOpen = signal<boolean>(true);
  readonly isRightPanelOpen = signal<boolean>(true);

  toggleLeftPanel(): void {
    this.isLeftPanelOpen.update(v => !v);
  }

  toggleRightPanel(): void {
    this.isRightPanelOpen.update(v => !v);
  }

  closeRightPanel(): void {
    this.isRightPanelOpen.set(false);
  }

  openRightPanel(): void {
    this.isRightPanelOpen.set(true);
  }
}
