import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ClanListComponent } from '../components/clanlist/clan-list';
import { AsyncPipe, CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    ClanListComponent,
    RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('clanmanager');
}
