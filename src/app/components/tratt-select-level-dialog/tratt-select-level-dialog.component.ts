import { Component, OnInit, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ModalService } from '../../services/modal.service';
import { SystemService } from 'src/app/services/system.service';
import { UserService } from 'src/app/services/user.service';
import { TrattLevelOption, preferredTrattLevel, trattLevelOptions } from '../../models/TrattLevels';

/**
 * Asks which annotation level TRATT should transcribe into. TRATT then opens
 * on the user's bundle list in the project (the bundles assigned to them),
 * like Artic, so no bundle is chosen here.
 */
@Component({
  selector: 'app-tratt-select-level-dialog',
  templateUrl: './tratt-select-level-dialog.component.html',
  styleUrl: './tratt-select-level-dialog.component.scss'
})
export class TrattSelectLevelDialogComponent implements OnInit {

  @Input() project;
  /** Called with the chosen level name; the caller launches TRATT. */
  @Input() onLaunch: (level: string) => void;

  levelOptions: TrattLevelOption[] = [];
  level = new FormControl<string | null>(null);
  /** Bundles assigned to the user in this project; null until known. */
  assignedBundleCount: number | null = null;

  constructor(private modalService: ModalService, private systemService: SystemService, private userService: UserService) {}

  async ngOnInit(): Promise<void> {
    this.levelOptions = trattLevelOptions(this.project?.annotationLevels, this.project?.annotationLinks);
    this.level.setValue(preferredTrattLevel(this.levelOptions, this.rememberedLevel()));
    this.assignedBundleCount = await this.fetchAssignedBundleCount();
  }

  get usableLevels(): TrattLevelOption[] {
    return this.levelOptions.filter(option => option.usable);
  }

  get unusableLevels(): TrattLevelOption[] {
    return this.levelOptions.filter(option => !option.usable);
  }

  launchDisabled(): boolean {
    return !this.level.value || this.assignedBundleCount === 0;
  }

  launch(): void {
    const level = this.level.value;
    if (!level || this.launchDisabled()) {
      return;
    }
    this.rememberLevel(level);
    this.closeDialog();
    this.onLaunch?.(level);
  }

  closeDialog(): void {
    this.modalService.hideModal("tratt-select-level-dialog");
  }

  private async fetchAssignedBundleCount(): Promise<number | null> {
    const username = this.userService.getSession()?.username;
    if (!username || !this.project?.id) {
      return null;
    }
    try {
      const response: any = await this.systemService.sendCommandToBackend({
        cmd: "fetchBundleList",
        projectId: this.project.id,
        username: username,
      });
      if (!response?.result) {
        return null;
      }
      const bundles = response.data?.data?.bundles;
      return Array.isArray(bundles) ? bundles.length : 0;
    } catch (error) {
      // Not knowing must not block the launch: TRATT shows the list itself.
      console.error('Error fetching bundle list:', error);
      return null;
    }
  }

  // The last level used per project, so a returning user is not asked to pick it again.
  private storageKey(): string {
    return `visp-tratt-level:${this.project?.id}`;
  }

  private rememberedLevel(): string | null {
    try {
      return localStorage.getItem(this.storageKey());
    } catch {
      return null;
    }
  }

  private rememberLevel(level: string): void {
    try {
      localStorage.setItem(this.storageKey(), level);
    } catch {
      // storage unavailable (private window): nothing to remember
    }
  }
}
