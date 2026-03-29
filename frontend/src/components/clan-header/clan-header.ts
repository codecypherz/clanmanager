import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-clan-header',
  templateUrl: './clan-header.html',
})
export class ClanHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
}
