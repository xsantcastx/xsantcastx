import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UserService {
  private nickname: string = 'Anonymous';

  setNickname(name: string) {
    this.nickname = name || 'Anonymous';
  }

  getNickname(): string {
    return this.nickname;
  }
}
