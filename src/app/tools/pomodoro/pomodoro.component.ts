import { Component, OnDestroy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';
type TimerState = 'idle' | 'running' | 'paused';

interface PomodoroSession {
  taskName: string;
  mode: TimerMode;
  duration: number;        // configured duration in seconds
  completedAt: string;     // ISO string
}

@Component({
    selector: 'app-pomodoro',
    templateUrl: './pomodoro.component.html',
    styleUrls: ['./pomodoro.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class PomodoroComponent implements OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;

  // ── Configurable durations (in minutes) ───────────────────────
  workMinutes = 25;
  shortBreakMinutes = 5;
  longBreakMinutes = 15;

  // ── Timer state ───────────────────────────────────────────────
  currentMode: TimerMode = 'work';
  timerState: TimerState = 'idle';
  timeRemaining = 25 * 60;   // seconds
  totalTime = 25 * 60;       // seconds (for progress calc)

  // ── Session tracking ──────────────────────────────────────────
  completedPomodoros = 0;
  pomodorosUntilLongBreak = 4;
  taskName = '';

  // ── History ───────────────────────────────────────────────────
  history: PomodoroSession[] = [];

  constructor(private router: Router) {
    this.loadHistory();
  }

  ngOnDestroy() {
    this.clearInterval();
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Mode labels & helpers ─────────────────────────────────────

  get modeLabel(): string {
    switch (this.currentMode) {
      case 'work': return 'Focus Time';
      case 'shortBreak': return 'Short Break';
      case 'longBreak': return 'Long Break';
    }
  }

  get modeIcon(): string {
    switch (this.currentMode) {
      case 'work': return 'work';
      case 'shortBreak': return 'short';
      case 'longBreak': return 'long';
    }
  }

  get progressPercent(): number {
    if (this.totalTime === 0) return 0;
    return ((this.totalTime - this.timeRemaining) / this.totalTime) * 100;
  }

  get circumference(): number {
    return 2 * Math.PI * 120; // radius = 120
  }

  get strokeDashoffset(): number {
    return this.circumference * (1 - this.progressPercent / 100);
  }

  get displayMinutes(): string {
    const m = Math.floor(this.timeRemaining / 60);
    return m.toString().padStart(2, '0');
  }

  get displaySeconds(): string {
    const s = this.timeRemaining % 60;
    return s.toString().padStart(2, '0');
  }

  get pomodoroDotsArray(): boolean[] {
    return Array.from({ length: this.pomodorosUntilLongBreak }, (_, i) => i < (this.completedPomodoros % this.pomodorosUntilLongBreak));
  }

  // ── Duration changes ──────────────────────────────────────────

  onDurationChange() {
    // Clamp values
    this.workMinutes = Math.max(1, Math.min(120, this.workMinutes || 1));
    this.shortBreakMinutes = Math.max(1, Math.min(60, this.shortBreakMinutes || 1));
    this.longBreakMinutes = Math.max(1, Math.min(60, this.longBreakMinutes || 1));

    // Easter egg: work duration set to 1 minute
    if (this.workMinutes === 1) {
      this.eggs.trigger('pomodoro-speedrun');
    }

    // If idle, reset the timer to reflect new duration
    if (this.timerState === 'idle') {
      this.resetTimerForMode(this.currentMode);
    }
  }

  private resetTimerForMode(mode: TimerMode) {
    switch (mode) {
      case 'work':
        this.totalTime = this.workMinutes * 60;
        break;
      case 'shortBreak':
        this.totalTime = this.shortBreakMinutes * 60;
        break;
      case 'longBreak':
        this.totalTime = this.longBreakMinutes * 60;
        break;
    }
    this.timeRemaining = this.totalTime;
  }

  // ── Mode switching ────────────────────────────────────────────

  setMode(mode: TimerMode) {
    if (this.timerState === 'running') return; // don't switch while running
    this.currentMode = mode;
    this.timerState = 'idle';
    this.resetTimerForMode(mode);
    this.clearInterval();
  }

  // ── Timer controls ────────────────────────────────────────────

  start() {
    if (this.timerState === 'running') return;

    if (this.timerState === 'idle') {
      this.resetTimerForMode(this.currentMode);
    }

    this.timerState = 'running';
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  pause() {
    if (this.timerState !== 'running') return;
    this.timerState = 'paused';
    this.clearInterval();
  }

  reset() {
    this.timerState = 'idle';
    this.clearInterval();
    this.resetTimerForMode(this.currentMode);
  }

  toggleTimer() {
    if (this.timerState === 'running') {
      this.pause();
    } else {
      this.start();
    }
  }

  private tick() {
    if (this.timeRemaining <= 0) {
      this.onTimerComplete();
      return;
    }
    this.timeRemaining--;
  }

  private onTimerComplete() {
    this.clearInterval();
    this.timerState = 'idle';
    this.playNotificationSound();

    if (this.currentMode === 'work') {
      this.completedPomodoros++;
      this.saveSession('work');

      // Determine next break
      if (this.completedPomodoros % this.pomodorosUntilLongBreak === 0) {
        this.currentMode = 'longBreak';
      } else {
        this.currentMode = 'shortBreak';
      }
    } else {
      this.saveSession(this.currentMode);
      this.currentMode = 'work';
    }

    this.resetTimerForMode(this.currentMode);
  }

  private clearInterval() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // ── Audio notification (Web Audio API beep) ───────────────────

  private playNotificationSound() {
    if (!this.isBrowser) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = this.audioCtx;

      // Play two-tone beep
      const frequencies = [660, 880, 660];
      let startTime = ctx.currentTime;

      for (const freq of frequencies) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

        osc.start(startTime);
        osc.stop(startTime + 0.2);
        startTime += 0.25;
      }
    } catch { /* silent fallback */ }
  }

  // ── History (sessionStorage) ──────────────────────────────────

  private saveSession(mode: TimerMode) {
    if (!this.isBrowser) return;
    const session: PomodoroSession = {
      taskName: this.taskName || 'Untitled',
      mode,
      duration: this.totalTime,
      completedAt: new Date().toISOString()
    };
    this.history.unshift(session);
    // Keep last 50 sessions
    if (this.history.length > 50) this.history = this.history.slice(0, 50);
    try {
      sessionStorage.setItem('pomodoro-history', JSON.stringify(this.history));
    } catch { /* silent */ }
  }

  private loadHistory() {
    if (!this.isBrowser) return;
    try {
      const stored = sessionStorage.getItem('pomodoro-history');
      if (stored) {
        this.history = JSON.parse(stored);
      }
    } catch { /* silent */ }
  }

  clearHistory() {
    this.history = [];
    if (this.isBrowser) {
      try { sessionStorage.removeItem('pomodoro-history'); } catch { /* silent */ }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────

  formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  formatTime(iso: string): string {
    if (!this.isBrowser) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getModeDisplayLabel(mode: TimerMode): string {
    switch (mode) {
      case 'work': return 'Focus';
      case 'shortBreak': return 'Short Break';
      case 'longBreak': return 'Long Break';
    }
  }
}
