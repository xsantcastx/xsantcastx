import { Component, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { DecimalPipe } from '@angular/common';

interface WordFrequency {
  word: string;
  count: number;
  density: number;
}

interface CharFrequency {
  char: string;
  count: number;
  percentage: number;
}

@Component({
    selector: 'app-text-counter',
    templateUrl: './text-counter.component.html',
    styleUrls: ['./text-counter.component.css'],
    imports: [FormsModule, ToolsSharedModule, DecimalPipe]
})
export class TextCounterComponent implements OnDestroy {
  private readonly eggs = inject(EasterEggService);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  textInput = '';

  // Basic stats
  characters = 0;
  charactersNoSpaces = 0;
  words = 0;
  sentences = 0;
  paragraphs = 0;
  lines = 0;
  readingTime = '';
  speakingTime = '';
  averageWordLength = 0;
  longestWord = '';

  // Frequency data
  topWords: WordFrequency[] = [];
  charFrequency: CharFrequency[] = [];
  keywordDensity: WordFrequency[] = [];

  // UI state
  activeTab: 'words' | 'chars' | 'density' = 'words';
  showAllDensity = false;

  constructor(private router: Router) {}

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  onInput() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.analyze(), 150);
  }

  private analyze() {
    const text = this.textInput;

    // Easter egg
    if (text === 'hello world') {
      this.eggs.trigger('text-hello');
    }

    // Characters
    this.characters = text.length;
    this.charactersNoSpaces = text.replace(/\s/g, '').length;

    // Words
    const wordMatches = text.match(/\b[\w']+\b/g) || [];
    this.words = wordMatches.length;

    // Sentences (split on . ! ?)
    if (text.trim().length === 0) {
      this.sentences = 0;
    } else {
      const sentenceMatches = text.match(/[^.!?]*[.!?]+/g) || [];
      this.sentences = sentenceMatches.length || (text.trim().length > 0 ? 1 : 0);
    }

    // Paragraphs (non-empty lines separated by blank lines)
    if (text.trim().length === 0) {
      this.paragraphs = 0;
    } else {
      this.paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
      if (this.paragraphs === 0 && text.trim().length > 0) this.paragraphs = 1;
    }

    // Lines
    if (text.length === 0) {
      this.lines = 0;
    } else {
      this.lines = text.split('\n').length;
    }

    // Reading time (200 wpm) & Speaking time (130 wpm)
    this.readingTime = this.formatTime(this.words / 200);
    this.speakingTime = this.formatTime(this.words / 130);

    // Average word length
    if (wordMatches.length > 0) {
      const totalLen = wordMatches.reduce((sum, w) => sum + w.length, 0);
      this.averageWordLength = Math.round((totalLen / wordMatches.length) * 10) / 10;
    } else {
      this.averageWordLength = 0;
    }

    // Longest word
    if (wordMatches.length > 0) {
      this.longestWord = wordMatches.reduce((a, b) => a.length >= b.length ? a : b, '');
    } else {
      this.longestWord = '';
    }

    // Word frequency
    this.computeWordFrequency(wordMatches);

    // Character frequency
    this.computeCharFrequency(text);
  }

  private computeWordFrequency(wordMatches: string[]) {
    const freq = new Map<string, number>();
    for (const w of wordMatches) {
      const lower = w.toLowerCase();
      freq.set(lower, (freq.get(lower) || 0) + 1);
    }

    const sorted = [...freq.entries()]
      .map(([word, count]) => ({
        word,
        count,
        density: this.words > 0 ? Math.round((count / this.words) * 10000) / 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    this.topWords = sorted.slice(0, 10);
    this.keywordDensity = sorted;
  }

  private computeCharFrequency(text: string) {
    if (text.length === 0) {
      this.charFrequency = [];
      return;
    }
    const freq = new Map<string, number>();
    for (const ch of text) {
      freq.set(ch, (freq.get(ch) || 0) + 1);
    }
    this.charFrequency = [...freq.entries()]
      .map(([char, count]) => ({
        char: char === ' ' ? 'Space' : char === '\n' ? 'Newline' : char === '\t' ? 'Tab' : char,
        count,
        percentage: Math.round((count / text.length) * 10000) / 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private formatTime(minutes: number): string {
    if (minutes < 1) {
      const secs = Math.round(minutes * 60);
      return secs <= 0 ? '0s' : `${secs}s`;
    }
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
  }

  setTab(tab: 'words' | 'chars' | 'density') {
    this.activeTab = tab;
  }

  get visibleDensity(): WordFrequency[] {
    return this.showAllDensity ? this.keywordDensity : this.keywordDensity.slice(0, 15);
  }

  clearAll() {
    this.textInput = '';
    this.characters = 0;
    this.charactersNoSpaces = 0;
    this.words = 0;
    this.sentences = 0;
    this.paragraphs = 0;
    this.lines = 0;
    this.readingTime = '';
    this.speakingTime = '';
    this.averageWordLength = 0;
    this.longestWord = '';
    this.topWords = [];
    this.charFrequency = [];
    this.keywordDensity = [];
    this.showAllDensity = false;
  }

  loadSample() {
    this.textInput = `The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet at least once, making it a well-known pangram.

Pangrams are often used to display typefaces, test fonts, and develop skills in handwriting, calligraphy, and typing. The phrase has been used since at least the late 19th century.

In the world of programming, the quick brown fox is frequently seen in code examples, documentation, and test cases. Developers love a good pangram because it exercises all character paths in text rendering pipelines.`;
    this.onInput();
  }
}
