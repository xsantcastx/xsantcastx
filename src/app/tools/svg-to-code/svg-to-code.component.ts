import { Component, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

type Framework = 'react-tsx' | 'react-jsx' | 'vue3' | 'angular';
type SizeStrategy = 'props' | 'viewbox';

interface SvgBatchItem {
  name: string;
  rawSvg: string;
  generatedCode: string;
  originalBytes: number;
  optimizedBytes: number;
}

interface A11yStatus {
  hasRole: boolean;
  hasTitle: boolean;
  hasAriaLabel: boolean;
  hasAriaHidden: boolean;
}

@Component({
    selector: 'app-svg-to-code',
    templateUrl: './svg-to-code.component.html',
    styleUrls: ['./svg-to-code.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class SvgToCodeComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  svgInput = '';
  componentName = 'MyIcon';
  selectedFramework: Framework = 'react-tsx';
  sizeStrategy: SizeStrategy = 'props';
  useCurrentColor = true;
  addA11y = true;
  optimizeSvg = true;
  previewColor = '#6366f1';
  previewSize = 64;
  dragOver = false;
  error = '';
  copied = false;
  generatedCode = '';
  originalBytes = 0;
  optimizedBytes = 0;
  a11yStatus: A11yStatus = { hasRole: false, hasTitle: false, hasAriaLabel: false, hasAriaHidden: false };
  batchItems: SvgBatchItem[] = [];
  batchMode = false;
  activeTab: 'output' | 'preview' | 'optimization' = 'output';

  readonly frameworks: { value: Framework; label: string }[] = [
    { value: 'react-tsx', label: 'React TSX' },
    { value: 'react-jsx', label: 'React JSX' },
    { value: 'vue3', label: 'Vue 3 SFC' },
    { value: 'angular', label: 'Angular' }
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free SVG to Code Converter — instantly convert SVG files into React, Vue, or Angular components with props & a11y. No sign-up 🎨')}&url=${encodeURIComponent(SITE_URL + '/tools/svg-to-code')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/svg-to-code')}`;

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      if (files.length === 1) {
        this.readSvgFile(files[0]);
      } else {
        this.batchMode = true;
        Array.from(files).forEach(f => this.readBatchFile(f));
      }
    }
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      this.readSvgFile(files[0]);
    } else {
      this.batchMode = true;
      Array.from(files).forEach(f => this.readBatchFile(f));
    }
    input.value = '';
  }

  private readSvgFile(file: File): void {
    if (!this.isBrowser) return;
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      this.error = 'Please upload an SVG file.';
      return;
    }
    this.error = '';
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        this.svgInput = result;
        const nameWithoutExt = file.name.replace(/\.svg$/i, '');
        this.componentName = this.toPascalCase(nameWithoutExt);
        this.generate();
      }
    };
    reader.readAsText(file);
  }

  private readBatchFile(file: File): void {
    if (!this.isBrowser) return;
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        const nameWithoutExt = file.name.replace(/\.svg$/i, '');
        const compName = this.toPascalCase(nameWithoutExt);
        const originalBytes = new TextEncoder().encode(result).length;
        const optimized = this.optimizeSvg ? this.runOptimize(result) : result;
        const optimizedBytes = new TextEncoder().encode(optimized).length;
        const code = this.buildComponent(optimized, compName);
        this.batchItems.push({ name: compName, rawSvg: result, generatedCode: code, originalBytes, optimizedBytes });
      }
    };
    reader.readAsText(file);
  }

  convertSvg(): void {
    this.generate();
  }

  generate(): void {
    this.error = '';
    if (!this.svgInput.trim()) {
      this.error = 'Please paste SVG code or upload an SVG file.';
      return;
    }
    if (!this.svgInput.trim().includes('<svg')) {
      this.error = 'Input does not appear to be valid SVG markup.';
      return;
    }
    this.originalBytes = new TextEncoder().encode(this.svgInput).length;
    const svgToProcess = this.optimizeSvg ? this.runOptimize(this.svgInput) : this.svgInput;
    this.optimizedBytes = new TextEncoder().encode(svgToProcess).length;
    this.generatedCode = this.buildComponent(svgToProcess, this.componentName);
    this.a11yStatus = this.computeA11yStatus(this.generatedCode);
    this.activeTab = 'output';
  }

  getFrameworkLabel(): string {
    return this.frameworks.find(f => f.value === this.selectedFramework)?.label ?? this.selectedFramework;
  }

  private runOptimize(svg: string): string {
    let result = svg;
    result = result.replace(/<\?xml[^?]*\?>\s*/g, '');
    result = result.replace(/<!DOCTYPE[^>]*>\s*/g, '');
    result = result.replace(/<!--[\s\S]*?-->/g, '');
    result = result.replace(/\s+inkscape:[a-zA-Z-]+="[^"]*"/g, '');
    result = result.replace(/\s+sodipodi:[a-zA-Z-]+="[^"]*"/g, '');
    result = result.replace(/<sodipodi:[^>]*\/>/g, '');
    result = result.replace(/<inkscape:[^>]*\/>/g, '');
    result = result.replace(/<metadata[\s\S]*?<\/metadata>/g, '');
    result = result.replace(/<defs>\s*<\/defs>/g, '');
    result = result.replace(/\s+data-[a-zA-Z-]+="[^"]*"/g, '');
    result = result.replace(/\s{2,}/g, ' ').trim();
    return result;
  }

  private buildComponent(svg: string, name: string): string {
    const safesvg = this.useCurrentColor ? this.applyCurrentColor(svg) : svg;
    switch (this.selectedFramework) {
      case 'react-tsx': return this.buildReactTsx(safesvg, name);
      case 'react-jsx': return this.buildReactJsx(safesvg, name);
      case 'vue3': return this.buildVue3(safesvg, name);
      case 'angular': return this.buildAngular(safesvg, name);
      default: return '';
    }
  }

  private applyCurrentColor(svg: string): string {
    let result = svg;
    result = result.replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"');
    result = result.replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"');
    return result;
  }

  private getSvgAttributes(svg: string): { viewBox: string; existingWidth: string; existingHeight: string } {
    const viewBoxMatch = svg.match(/viewBox="([^"]*)"/);
    const widthMatch = svg.match(/(?:^|\s)width="([^"]*)"/);
    const heightMatch = svg.match(/(?:^|\s)height="([^"]*)"/);
    return {
      viewBox: viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24',
      existingWidth: widthMatch ? widthMatch[1] : '24',
      existingHeight: heightMatch ? heightMatch[1] : '24'
    };
  }

  private stripOuterSvgTag(svg: string): string {
    return svg.replace(/<svg[^>]*>([\s\S]*)<\/svg>/i, '$1').trim();
  }

  private buildReactTsx(svg: string, name: string): string {
    const { viewBox } = this.getSvgAttributes(svg);
    const inner = this.stripOuterSvgTag(svg);
    const sizeProps = this.sizeStrategy === 'props'
      ? `\n  width?: number | string;\n  height?: number | string;`
      : '';
    const ariaProps = this.addA11y
      ? `\n  title?: string;\n  ariaLabel?: string;\n  ariaHidden?: boolean;`
      : '';
    const svgWidthAttr = this.sizeStrategy === 'props' ? ' width={width ?? 24}' : '';
    const svgHeightAttr = this.sizeStrategy === 'props' ? ' height={height ?? 24}' : '';
    const ariaAttrs = this.addA11y
      ? `\n      role="img"\n      aria-label={ariaLabel}\n      aria-hidden={ariaHidden}`
      : '';
    const titleEl = this.addA11y ? `\n      {title && <title>{title}</title>}` : '';
    const destructure = this.buildTsxDestructure();
    return `import React from 'react';

interface ${name}Props {${sizeProps}${ariaProps}
  className?: string;
  style?: React.CSSProperties;
}

const ${name}: React.FC<${name}Props> = ({${destructure}}) => {
  return (
    <svg
      viewBox="${viewBox}"${svgWidthAttr}${svgHeightAttr}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}${ariaAttrs}
    >${titleEl}
      ${inner}
    </svg>
  );
};

export default ${name};
`;
  }

  private buildTsxDestructure(): string {
    const parts: string[] = [];
    if (this.sizeStrategy === 'props') parts.push('width', 'height');
    if (this.addA11y) parts.push('title', 'ariaLabel', 'ariaHidden');
    parts.push('className', 'style');
    return parts.join(', ');
  }

  private buildReactJsx(svg: string, name: string): string {
    const { viewBox } = this.getSvgAttributes(svg);
    const inner = this.stripOuterSvgTag(svg);
    const svgWidthAttr = this.sizeStrategy === 'props' ? ' width={width ?? 24}' : '';
    const svgHeightAttr = this.sizeStrategy === 'props' ? ' height={height ?? 24}' : '';
    const ariaAttrs = this.addA11y
      ? `\n      role="img"\n      aria-label={ariaLabel}\n      aria-hidden={ariaHidden}`
      : '';
    const titleEl = this.addA11y ? `\n      {title && <title>{title}</title>}` : '';
    const destructure = this.buildTsxDestructure();
    return `import React from 'react';

const ${name} = ({${destructure}}) => {
  return (
    <svg
      viewBox="${viewBox}"${svgWidthAttr}${svgHeightAttr}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}${ariaAttrs}
    >${titleEl}
      ${inner}
    </svg>
  );
};

export default ${name};
`;
  }

  private buildVue3(svg: string, name: string): string {
    const { viewBox } = this.getSvgAttributes(svg);
    const inner = this.stripOuterSvgTag(svg);
    const sizeProps = this.sizeStrategy === 'props'
      ? `\n    width: { type: [Number, String], default: 24 },\n    height: { type: [Number, String], default: 24 },`
      : '';
    const ariaProps = this.addA11y
      ? `\n    title: { type: String, default: '' },\n    ariaLabel: { type: String, default: '' },\n    ariaHidden: { type: Boolean, default: false },`
      : '';
    const svgWidthBind = this.sizeStrategy === 'props' ? ' :width="width"' : '';
    const svgHeightBind = this.sizeStrategy === 'props' ? ' :height="height"' : '';
    const ariaBinds = this.addA11y
      ? `\n      role="img"\n      :aria-label="ariaLabel"\n      :aria-hidden="ariaHidden"`
      : '';
    const titleEl = this.addA11y ? `\n      <title v-if="title">{{ title }}</title>` : '';
    return `<template>
  <svg
    viewBox="${viewBox}"${svgWidthBind}${svgHeightBind}
    xmlns="http://www.w3.org/2000/svg"
    v-bind="$attrs"${ariaBinds}
  >${titleEl}
    ${inner}
  </svg>
</template>

<script setup lang="ts">
defineOptions({ name: '${name}', inheritAttrs: false });

defineProps({${sizeProps}${ariaProps}
  class: { type: String, default: '' },
});
</script>
`;
  }

  private buildAngular(svg: string, name: string): string {
    const { viewBox } = this.getSvgAttributes(svg);
    const inner = this.stripOuterSvgTag(svg);
    const kebab = this.toKebabCase(name);
    const selector = `app-${kebab}`;
    const sizeInputs = this.sizeStrategy === 'props'
      ? `\n  @Input() width: number | string = 24;\n  @Input() height: number | string = 24;`
      : '';
    const ariaInputs = this.addA11y
      ? `\n  @Input() title = '';\n  @Input() ariaLabel = '';\n  @Input() ariaHidden = false;`
      : '';
    const svgWidthAttr = this.sizeStrategy === 'props' ? ' [attr.width]="width"' : '';
    const svgHeightAttr = this.sizeStrategy === 'props' ? ' [attr.height]="height"' : '';
    const ariaAttrs = this.addA11y
      ? `\n      role="img"\n      [attr.aria-label]="ariaLabel"\n      [attr.aria-hidden]="ariaHidden"`
      : '';
    const titleEl = this.addA11y ? `\n      <title *ngIf="title">{{title}}</title>` : '';
    const importsList = `Component, Input`;
    return `import { ${importsList} } from '@angular/core';

@Component({
  selector: '${selector}',
  template: \`
    <svg
      viewBox="${viewBox}"${svgWidthAttr}${svgHeightAttr}
      xmlns="http://www.w3.org/2000/svg"${ariaAttrs}
    >${titleEl}
      ${inner}
    </svg>
  \`,
})
export class ${name}Component {${sizeInputs}${ariaInputs}
}
`;
  }

  private computeA11yStatus(code: string): A11yStatus {
    return {
      hasRole: /role=/.test(code),
      hasTitle: /<title/i.test(code),
      hasAriaLabel: /aria-label/i.test(code),
      hasAriaHidden: /aria-hidden/i.test(code)
    };
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toUpperCase());
  }

  private toKebabCase(str: string): string {
    return str
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  copyCode(): void {
    if (!this.isBrowser || !this.generatedCode) return;
    navigator.clipboard.writeText(this.generatedCode).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  copyBatchItem(item: SvgBatchItem): void {
    if (!this.isBrowser) return;
    navigator.clipboard.writeText(item.generatedCode);
  }

  downloadCode(): void {
    if (!this.generatedCode) return;
    const ext = this.getFileExtension();
    const filename = `${this.componentName}.${ext}`;
    this.triggerDownload(this.generatedCode, filename);
  }

  downloadBatchItem(item: SvgBatchItem): void {
    const ext = this.getFileExtension();
    const filename = `${item.name}.${ext}`;
    this.triggerDownload(item.generatedCode, filename);
  }

  downloadBatchZip(): void {
    this.batchItems.forEach(item => {
      const ext = this.getFileExtension();
      this.triggerDownload(item.generatedCode, `${item.name}.${ext}`);
    });
  }

  private getFileExtension(): string {
    switch (this.selectedFramework) {
      case 'vue3': return 'vue';
      case 'react-tsx': return 'tsx';
      case 'react-jsx': return 'jsx';
      default: return 'ts';
    }
  }

  private triggerDownload(content: string, filename: string): void {
    if (!this.isBrowser) return;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
