import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface MimeEntry { extension: string; mimeType: string; category: string; }

@Component({
    selector: 'app-mime-lookup',
    templateUrl: './mime-lookup.component.html',
    styleUrls: ['./mime-lookup.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class MimeLookupComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('MIME Type Lookup — searchable reference for file extensions and MIME types')}&url=${encodeURIComponent(SITE_URL + '/tools/mime-lookup')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/mime-lookup')}`;

  searchQuery = '';
  copied = false;

  readonly mimeTypes: MimeEntry[] = [
    { extension: '.html', mimeType: 'text/html', category: 'Web' },
    { extension: '.css', mimeType: 'text/css', category: 'Web' },
    { extension: '.js', mimeType: 'application/javascript', category: 'Web' },
    { extension: '.json', mimeType: 'application/json', category: 'Data' },
    { extension: '.xml', mimeType: 'application/xml', category: 'Data' },
    { extension: '.csv', mimeType: 'text/csv', category: 'Data' },
    { extension: '.txt', mimeType: 'text/plain', category: 'Text' },
    { extension: '.md', mimeType: 'text/markdown', category: 'Text' },
    { extension: '.pdf', mimeType: 'application/pdf', category: 'Document' },
    { extension: '.doc', mimeType: 'application/msword', category: 'Document' },
    { extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'Document' },
    { extension: '.xls', mimeType: 'application/vnd.ms-excel', category: 'Document' },
    { extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'Document' },
    { extension: '.ppt', mimeType: 'application/vnd.ms-powerpoint', category: 'Document' },
    { extension: '.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', category: 'Document' },
    { extension: '.png', mimeType: 'image/png', category: 'Image' },
    { extension: '.jpg', mimeType: 'image/jpeg', category: 'Image' },
    { extension: '.jpeg', mimeType: 'image/jpeg', category: 'Image' },
    { extension: '.gif', mimeType: 'image/gif', category: 'Image' },
    { extension: '.svg', mimeType: 'image/svg+xml', category: 'Image' },
    { extension: '.webp', mimeType: 'image/webp', category: 'Image' },
    { extension: '.ico', mimeType: 'image/x-icon', category: 'Image' },
    { extension: '.avif', mimeType: 'image/avif', category: 'Image' },
    { extension: '.bmp', mimeType: 'image/bmp', category: 'Image' },
    { extension: '.tiff', mimeType: 'image/tiff', category: 'Image' },
    { extension: '.mp3', mimeType: 'audio/mpeg', category: 'Audio' },
    { extension: '.wav', mimeType: 'audio/wav', category: 'Audio' },
    { extension: '.ogg', mimeType: 'audio/ogg', category: 'Audio' },
    { extension: '.flac', mimeType: 'audio/flac', category: 'Audio' },
    { extension: '.aac', mimeType: 'audio/aac', category: 'Audio' },
    { extension: '.mp4', mimeType: 'video/mp4', category: 'Video' },
    { extension: '.webm', mimeType: 'video/webm', category: 'Video' },
    { extension: '.avi', mimeType: 'video/x-msvideo', category: 'Video' },
    { extension: '.mov', mimeType: 'video/quicktime', category: 'Video' },
    { extension: '.mkv', mimeType: 'video/x-matroska', category: 'Video' },
    { extension: '.zip', mimeType: 'application/zip', category: 'Archive' },
    { extension: '.gz', mimeType: 'application/gzip', category: 'Archive' },
    { extension: '.tar', mimeType: 'application/x-tar', category: 'Archive' },
    { extension: '.rar', mimeType: 'application/vnd.rar', category: 'Archive' },
    { extension: '.7z', mimeType: 'application/x-7z-compressed', category: 'Archive' },
    { extension: '.woff', mimeType: 'font/woff', category: 'Font' },
    { extension: '.woff2', mimeType: 'font/woff2', category: 'Font' },
    { extension: '.ttf', mimeType: 'font/ttf', category: 'Font' },
    { extension: '.otf', mimeType: 'font/otf', category: 'Font' },
    { extension: '.eot', mimeType: 'application/vnd.ms-fontobject', category: 'Font' },
    { extension: '.bin', mimeType: 'application/octet-stream', category: 'Binary' },
    { extension: '.exe', mimeType: 'application/octet-stream', category: 'Binary' },
    { extension: '.wasm', mimeType: 'application/wasm', category: 'Web' },
    { extension: '.ts', mimeType: 'application/typescript', category: 'Web' },
    { extension: '.yaml', mimeType: 'application/x-yaml', category: 'Data' },
    { extension: '.toml', mimeType: 'application/toml', category: 'Data' },
    { extension: '.sql', mimeType: 'application/sql', category: 'Data' },
  ];

  constructor(private router: Router) {}

  goBack(): void { this.router.navigate(['/tools']); }

  onSearchInput(): void {
    if (this.searchQuery.toLowerCase().includes('octet-stream')) {
      this.eggs.trigger('mime-binary');
    }
  }

  get filteredMimeTypes(): MimeEntry[] {
    if (!this.searchQuery.trim()) return this.mimeTypes;
    const q = this.searchQuery.toLowerCase();
    return this.mimeTypes.filter(m => m.extension.toLowerCase().includes(q) || m.mimeType.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  }

  async copyMime(entry: MimeEntry): Promise<void> {
    if (!this.isBrowser) return;
    try { await navigator.clipboard.writeText(entry.mimeType); this.copied = true; setTimeout(() => (this.copied = false), 2000); } catch {}
  }
}
