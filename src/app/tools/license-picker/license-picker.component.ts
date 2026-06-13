import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { FormsModule } from '@angular/forms';
import { ToolsSharedModule } from '../../shared/tools-shared.module';

interface License {
  id: string;
  name: string;
  category: string;
  permissions: string[];
  conditions: string[];
  limitations: string[];
  body: string;
}

@Component({
    selector: 'app-license-picker',
    templateUrl: './license-picker.component.html',
    styleUrls: ['./license-picker.component.css'],
    imports: [FormsModule, ToolsSharedModule]
})
export class LicensePickerComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free License Picker — browse 15+ open source licenses!')}&url=${encodeURIComponent(SITE_URL + '/tools/license-picker')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/license-picker')}`;

  selectedLicense: License | null = null;
  authorName = '';
  year = new Date().getFullYear().toString();
  copied = false;
  searchTerm = '';

  readonly licenses: License[] = [
    { id: 'mit', name: 'MIT License', category: 'Permissive', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: ['License notice'], limitations: ['No liability', 'No warranty'], body: 'MIT License\n\nCopyright (c) [year] [author]\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.' },
    { id: 'apache-2.0', name: 'Apache 2.0', category: 'Permissive', permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'], conditions: ['License notice', 'State changes'], limitations: ['No trademark use', 'No liability', 'No warranty'], body: 'Apache License, Version 2.0\n\nCopyright [year] [author]\n\nLicensed under the Apache License, Version 2.0.' },
    { id: 'gpl-3.0', name: 'GPL 3.0', category: 'Copyleft', permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'], conditions: ['Disclose source', 'License notice', 'Same license', 'State changes'], limitations: ['No liability', 'No warranty'], body: 'GNU General Public License v3.0\n\nCopyright (C) [year] [author]\n\nThis program is free software.' },
    { id: 'gpl-2.0', name: 'GPL 2.0', category: 'Copyleft', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: ['Disclose source', 'License notice', 'Same license', 'State changes'], limitations: ['No liability', 'No warranty'], body: 'GNU General Public License v2.0\n\nCopyright (C) [year] [author]' },
    { id: 'lgpl-3.0', name: 'LGPL 3.0', category: 'Copyleft', permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'], conditions: ['Disclose source', 'License notice', 'Same license (library)'], limitations: ['No liability', 'No warranty'], body: 'GNU Lesser General Public License v3.0\n\nCopyright (C) [year] [author]' },
    { id: 'bsd-2', name: 'BSD 2-Clause', category: 'Permissive', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: ['License notice'], limitations: ['No liability', 'No warranty'], body: 'BSD 2-Clause License\n\nCopyright (c) [year], [author]\nAll rights reserved.' },
    { id: 'bsd-3', name: 'BSD 3-Clause', category: 'Permissive', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: ['License notice', 'No endorsement'], limitations: ['No liability', 'No warranty'], body: 'BSD 3-Clause License\n\nCopyright (c) [year], [author]\nAll rights reserved.' },
    { id: 'mpl-2.0', name: 'MPL 2.0', category: 'Copyleft', permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'], conditions: ['Disclose source', 'License notice'], limitations: ['No liability', 'No warranty', 'No trademark use'], body: 'Mozilla Public License 2.0\n\nCopyright (c) [year] [author]' },
    { id: 'isc', name: 'ISC License', category: 'Permissive', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: ['License notice'], limitations: ['No liability', 'No warranty'], body: 'ISC License\n\nCopyright (c) [year] [author]\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.' },
    { id: 'unlicense', name: 'The Unlicense', category: 'Public Domain', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: [], limitations: ['No liability', 'No warranty'], body: 'This is free and unencumbered software released into the public domain.\n\nAnyone is free to copy, modify, publish, use, compile, sell, or distribute this software.' },
    { id: 'cc0', name: 'CC0 1.0', category: 'Public Domain', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: [], limitations: ['No liability', 'No warranty', 'No patent rights'], body: 'CC0 1.0 Universal\n\nThe person who associated a work with this deed has dedicated the work to the public domain.' },
    { id: 'agpl-3.0', name: 'AGPL 3.0', category: 'Copyleft', permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'], conditions: ['Disclose source', 'License notice', 'Same license', 'Network use is distribution'], limitations: ['No liability', 'No warranty'], body: 'GNU Affero General Public License v3.0\n\nCopyright (C) [year] [author]' },
    { id: 'artistic-2.0', name: 'Artistic 2.0', category: 'Permissive', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: ['License notice', 'State changes'], limitations: ['No liability', 'No warranty'], body: 'Artistic License 2.0\n\nCopyright (c) [year] [author]' },
    { id: 'zlib', name: 'zlib License', category: 'Permissive', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: ['License notice', 'State changes'], limitations: ['No liability', 'No warranty'], body: 'zlib License\n\nCopyright (c) [year] [author]' },
    { id: 'wtfpl', name: 'WTFPL', category: 'Public Domain', permissions: ['Commercial use', 'Modification', 'Distribution', 'Private use'], conditions: [], limitations: [], body: 'DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE\nVersion 2, December 2004\n\nCopyright (C) [year] [author]\n\nEveryone is permitted to copy and distribute verbatim or modified copies of this license document, and changing it is allowed as long as the name is changed.\n\nDO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE\nTERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION\n\n0. You just DO WHAT THE FUCK YOU WANT TO.' },
    { id: 'eupl-1.2', name: 'EUPL 1.2', category: 'Copyleft', permissions: ['Commercial use', 'Modification', 'Distribution', 'Patent use', 'Private use'], conditions: ['Disclose source', 'License notice', 'Same license'], limitations: ['No liability', 'No warranty'], body: 'European Union Public License 1.2\n\nCopyright (c) [year] [author]' },
  ];

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  selectLicense(lic: License) {
    this.selectedLicense = lic;
    if (lic.id === 'wtfpl') {
      this.eggs.trigger('license-wtf');
    }
  }

  get filteredLicenses(): License[] {
    if (!this.searchTerm) return this.licenses;
    const term = this.searchTerm.toLowerCase();
    return this.licenses.filter(l => l.name.toLowerCase().includes(term) || l.category.toLowerCase().includes(term));
  }

  get generatedBody(): string {
    if (!this.selectedLicense) return '';
    return this.selectedLicense.body
      .replace(/\[year\]/g, this.year)
      .replace(/\[author\]/g, this.authorName || '[Your Name]');
  }

  async copyLicense() {
    if (!this.generatedBody || !this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.generatedBody);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }
}
