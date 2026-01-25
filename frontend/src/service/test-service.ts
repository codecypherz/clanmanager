import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class TestService {

  constructor(private http: HttpClient) { }

  getBackendData() {
    return this.http.get('/api/data'); // We use a relative path for easy wiring
  }
}
