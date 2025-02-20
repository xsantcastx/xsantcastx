import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Skills, Projects } from './models/portfolio.models';

@Injectable({
  providedIn: 'root'
})
export class PortfolioService {
  private skillsUrl = 'assets/data/skills.json';
  private projectsUrl = 'assets/data/projects.json';

  constructor(private http: HttpClient) {}

  getSkills(): Observable<Skills[]> {
    return this.http.get<Skills[]>(this.skillsUrl);
  }

  getProjects(): Observable<Projects[]> {
    return this.http.get<Projects[]>(this.projectsUrl);
  }
}