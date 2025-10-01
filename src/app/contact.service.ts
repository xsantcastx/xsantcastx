import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
  projectType?: string;
  budget?: string;
}

export interface ContactResponse {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private readonly functionUrl = 'https://contact-sendemail-77wvanqjhq-uk.a.run.app';

  constructor(private http: HttpClient) {}

  sendContactForm(data: ContactFormData): Observable<ContactResponse> {
    return this.http.post<ContactResponse>(this.functionUrl, data);
  }
}