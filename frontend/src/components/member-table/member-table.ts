import { Component, Input } from '@angular/core';
import { ClanMember, Eval, WarParticipant } from '../../../../shared/models/clan-member';

interface Unit {
  label: string;
  ms: number;
}

const UNITS: Unit[] = [
  { label: 'day', ms: 86400000 },
  { label: 'hour', ms: 3600000 },
  { label: 'minute', ms: 60000 },
  { label: 'second', ms: 1000 },
];

@Component({
  selector: 'app-member-table',
  templateUrl: './member-table.html',
})
export class MemberTableComponent {
  @Input({ required: true }) members!: ClanMember[];

  getRelativeTime(timestamp: number | Date): string {
    const diff = new Date().getTime() - new Date(timestamp).getTime();
    if (diff < 60000) return 'Now';

    for (const { label, ms: unitMs } of UNITS) {
      const count = Math.floor(diff / unitMs);
      if (count > 0) {
        return `${count}${label.charAt(0)}`;
      }
    }
    return '??';
  }

  getFameText(war: WarParticipant | undefined): string {
    if (war && war.warEval != Eval.NOT_APPLICABLE) {
      return war.fame.toString();
    }
    return "N/A";
  }

  getActiveWarDays(war: WarParticipant | undefined): string {
    if (war && war.warEval != Eval.NOT_APPLICABLE) {
      let warDaysActive = war.warDaysActive || 0;
      return "(" + warDaysActive + ")";
    }
    return "N/A";
  }

  isPartialParticipation(war: WarParticipant | undefined): boolean {
    if (war && war.warEval != Eval.NOT_APPLICABLE) {
      let warDaysActive = war.warDaysActive || 0;
      return warDaysActive > 0 && warDaysActive < 4;
    }
    return false;
  }
}
