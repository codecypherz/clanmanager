import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class KickCountService {

  getKickCount(playerTag: string): number {
    const data = localStorage.getItem(this.getStorageKey(playerTag));
    const kickCount: number = data ? JSON.parse(data) : 0;
    return kickCount; 
  }

  setKickCount(playerTag: string, kickCount: number) {
    localStorage.setItem(this.getStorageKey(playerTag), JSON.stringify(kickCount));
  }

  private getStorageKey(playerTag: string): string {
    return `kick_count_${playerTag}`;
  }
}
