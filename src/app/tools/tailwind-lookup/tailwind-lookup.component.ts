import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';

export interface TailwindEntry {
  className: string;
  css: string;
  category: string;
}

type CategoryFilter = 'all' | 'spacing' | 'sizing' | 'typography' | 'colors' | 'flexbox' | 'grid' | 'borders' | 'effects' | 'transitions';

@Component({
    selector: 'app-tailwind-lookup',
    templateUrl: './tailwind-lookup.component.html',
    styleUrls: ['./tailwind-lookup.component.css'],
    imports: [ToolsSharedModule, FormsModule]
})
export class TailwindLookupComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Tailwind CSS Class Lookup — search 300+ utility classes with CSS equivalents.')}&url=${encodeURIComponent(SITE_URL + '/tools/tailwind-lookup')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/tailwind-lookup')}`;

  searchQuery = '';
  activeCategory: CategoryFilter = 'all';
  copied = false;
  copiedClass = '';
  previewEntry: TailwindEntry | null = null;

  readonly categories: { key: CategoryFilter; label: string; icon: string }[] = [
    { key: 'all',         label: 'All',         icon: 'M4 6h16M4 12h16M4 18h16' },
    { key: 'spacing',     label: 'Spacing',     icon: 'M21 3H3v18h18V3zM9 3v18M15 3v18M3 9h18M3 15h18' },
    { key: 'sizing',      label: 'Sizing',      icon: 'M21 3H3v18h18V3zM3 9h18' },
    { key: 'typography',  label: 'Typography',  icon: 'M4 7V4h16v3M9 20h6M12 4v16' },
    { key: 'colors',      label: 'Colors',      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z' },
    { key: 'flexbox',     label: 'Flexbox',     icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
    { key: 'grid',        label: 'Grid',        icon: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18' },
    { key: 'borders',     label: 'Borders',     icon: 'M3 3h18v18H3z' },
    { key: 'effects',     label: 'Effects',     icon: 'M12 3v1m0 16v1m-8-9H3m18 0h-1m-2.636-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707' },
    { key: 'transitions', label: 'Transitions', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  ];

  readonly entries: TailwindEntry[] = [
    // ── Spacing: padding ──
    { className: 'p-0',   css: 'padding: 0px;',            category: 'spacing' },
    { className: 'p-1',   css: 'padding: 0.25rem;',        category: 'spacing' },
    { className: 'p-2',   css: 'padding: 0.5rem;',         category: 'spacing' },
    { className: 'p-3',   css: 'padding: 0.75rem;',        category: 'spacing' },
    { className: 'p-4',   css: 'padding: 1rem;',           category: 'spacing' },
    { className: 'p-5',   css: 'padding: 1.25rem;',        category: 'spacing' },
    { className: 'p-6',   css: 'padding: 1.5rem;',         category: 'spacing' },
    { className: 'p-8',   css: 'padding: 2rem;',           category: 'spacing' },
    { className: 'p-10',  css: 'padding: 2.5rem;',         category: 'spacing' },
    { className: 'p-12',  css: 'padding: 3rem;',           category: 'spacing' },
    { className: 'p-16',  css: 'padding: 4rem;',           category: 'spacing' },
    { className: 'p-20',  css: 'padding: 5rem;',           category: 'spacing' },
    { className: 'px-0',  css: 'padding-left: 0px; padding-right: 0px;',   category: 'spacing' },
    { className: 'px-2',  css: 'padding-left: 0.5rem; padding-right: 0.5rem;', category: 'spacing' },
    { className: 'px-4',  css: 'padding-left: 1rem; padding-right: 1rem;',     category: 'spacing' },
    { className: 'px-6',  css: 'padding-left: 1.5rem; padding-right: 1.5rem;', category: 'spacing' },
    { className: 'px-8',  css: 'padding-left: 2rem; padding-right: 2rem;',     category: 'spacing' },
    { className: 'py-0',  css: 'padding-top: 0px; padding-bottom: 0px;',       category: 'spacing' },
    { className: 'py-2',  css: 'padding-top: 0.5rem; padding-bottom: 0.5rem;', category: 'spacing' },
    { className: 'py-4',  css: 'padding-top: 1rem; padding-bottom: 1rem;',     category: 'spacing' },
    { className: 'py-6',  css: 'padding-top: 1.5rem; padding-bottom: 1.5rem;', category: 'spacing' },
    { className: 'py-8',  css: 'padding-top: 2rem; padding-bottom: 2rem;',     category: 'spacing' },
    { className: 'pt-0',  css: 'padding-top: 0px;',        category: 'spacing' },
    { className: 'pt-2',  css: 'padding-top: 0.5rem;',     category: 'spacing' },
    { className: 'pt-4',  css: 'padding-top: 1rem;',       category: 'spacing' },
    { className: 'pb-0',  css: 'padding-bottom: 0px;',     category: 'spacing' },
    { className: 'pb-4',  css: 'padding-bottom: 1rem;',    category: 'spacing' },
    { className: 'pb-8',  css: 'padding-bottom: 2rem;',    category: 'spacing' },
    { className: 'pl-0',  css: 'padding-left: 0px;',       category: 'spacing' },
    { className: 'pl-4',  css: 'padding-left: 1rem;',      category: 'spacing' },
    { className: 'pr-0',  css: 'padding-right: 0px;',      category: 'spacing' },
    { className: 'pr-4',  css: 'padding-right: 1rem;',     category: 'spacing' },
    // ── Spacing: margin ──
    { className: 'm-0',   css: 'margin: 0px;',             category: 'spacing' },
    { className: 'm-1',   css: 'margin: 0.25rem;',         category: 'spacing' },
    { className: 'm-2',   css: 'margin: 0.5rem;',          category: 'spacing' },
    { className: 'm-3',   css: 'margin: 0.75rem;',         category: 'spacing' },
    { className: 'm-4',   css: 'margin: 1rem;',            category: 'spacing' },
    { className: 'm-6',   css: 'margin: 1.5rem;',          category: 'spacing' },
    { className: 'm-8',   css: 'margin: 2rem;',            category: 'spacing' },
    { className: 'm-auto', css: 'margin: auto;',           category: 'spacing' },
    { className: 'mx-0',  css: 'margin-left: 0px; margin-right: 0px;',         category: 'spacing' },
    { className: 'mx-2',  css: 'margin-left: 0.5rem; margin-right: 0.5rem;',   category: 'spacing' },
    { className: 'mx-4',  css: 'margin-left: 1rem; margin-right: 1rem;',       category: 'spacing' },
    { className: 'mx-auto', css: 'margin-left: auto; margin-right: auto;',     category: 'spacing' },
    { className: 'my-0',  css: 'margin-top: 0px; margin-bottom: 0px;',         category: 'spacing' },
    { className: 'my-2',  css: 'margin-top: 0.5rem; margin-bottom: 0.5rem;',   category: 'spacing' },
    { className: 'my-4',  css: 'margin-top: 1rem; margin-bottom: 1rem;',       category: 'spacing' },
    { className: 'my-8',  css: 'margin-top: 2rem; margin-bottom: 2rem;',       category: 'spacing' },
    { className: 'mt-0',  css: 'margin-top: 0px;',         category: 'spacing' },
    { className: 'mt-2',  css: 'margin-top: 0.5rem;',      category: 'spacing' },
    { className: 'mt-4',  css: 'margin-top: 1rem;',        category: 'spacing' },
    { className: 'mt-8',  css: 'margin-top: 2rem;',        category: 'spacing' },
    { className: 'mb-0',  css: 'margin-bottom: 0px;',      category: 'spacing' },
    { className: 'mb-2',  css: 'margin-bottom: 0.5rem;',   category: 'spacing' },
    { className: 'mb-4',  css: 'margin-bottom: 1rem;',     category: 'spacing' },
    { className: 'mb-8',  css: 'margin-bottom: 2rem;',     category: 'spacing' },
    { className: 'ml-0',  css: 'margin-left: 0px;',        category: 'spacing' },
    { className: 'ml-4',  css: 'margin-left: 1rem;',       category: 'spacing' },
    { className: 'mr-0',  css: 'margin-right: 0px;',       category: 'spacing' },
    { className: 'mr-4',  css: 'margin-right: 1rem;',      category: 'spacing' },
    { className: '-m-1',  css: 'margin: -0.25rem;',        category: 'spacing' },
    { className: '-m-2',  css: 'margin: -0.5rem;',         category: 'spacing' },
    { className: '-mt-4', css: 'margin-top: -1rem;',       category: 'spacing' },
    { className: 'space-x-2', css: '> * + * { margin-left: 0.5rem; }',  category: 'spacing' },
    { className: 'space-x-4', css: '> * + * { margin-left: 1rem; }',    category: 'spacing' },
    { className: 'space-y-2', css: '> * + * { margin-top: 0.5rem; }',   category: 'spacing' },
    { className: 'space-y-4', css: '> * + * { margin-top: 1rem; }',     category: 'spacing' },
    { className: 'gap-0',  css: 'gap: 0px;',               category: 'spacing' },
    { className: 'gap-1',  css: 'gap: 0.25rem;',           category: 'spacing' },
    { className: 'gap-2',  css: 'gap: 0.5rem;',            category: 'spacing' },
    { className: 'gap-3',  css: 'gap: 0.75rem;',           category: 'spacing' },
    { className: 'gap-4',  css: 'gap: 1rem;',              category: 'spacing' },
    { className: 'gap-6',  css: 'gap: 1.5rem;',            category: 'spacing' },
    { className: 'gap-8',  css: 'gap: 2rem;',              category: 'spacing' },

    // ── Sizing ──
    { className: 'w-0',     css: 'width: 0px;',               category: 'sizing' },
    { className: 'w-1',     css: 'width: 0.25rem;',           category: 'sizing' },
    { className: 'w-2',     css: 'width: 0.5rem;',            category: 'sizing' },
    { className: 'w-4',     css: 'width: 1rem;',              category: 'sizing' },
    { className: 'w-8',     css: 'width: 2rem;',              category: 'sizing' },
    { className: 'w-12',    css: 'width: 3rem;',              category: 'sizing' },
    { className: 'w-16',    css: 'width: 4rem;',              category: 'sizing' },
    { className: 'w-24',    css: 'width: 6rem;',              category: 'sizing' },
    { className: 'w-32',    css: 'width: 8rem;',              category: 'sizing' },
    { className: 'w-48',    css: 'width: 12rem;',             category: 'sizing' },
    { className: 'w-64',    css: 'width: 16rem;',             category: 'sizing' },
    { className: 'w-full',  css: 'width: 100%;',              category: 'sizing' },
    { className: 'w-screen', css: 'width: 100vw;',            category: 'sizing' },
    { className: 'w-auto',  css: 'width: auto;',              category: 'sizing' },
    { className: 'w-1/2',   css: 'width: 50%;',               category: 'sizing' },
    { className: 'w-1/3',   css: 'width: 33.333333%;',        category: 'sizing' },
    { className: 'w-2/3',   css: 'width: 66.666667%;',        category: 'sizing' },
    { className: 'w-1/4',   css: 'width: 25%;',               category: 'sizing' },
    { className: 'w-3/4',   css: 'width: 75%;',               category: 'sizing' },
    { className: 'w-fit',   css: 'width: fit-content;',       category: 'sizing' },
    { className: 'w-min',   css: 'width: min-content;',       category: 'sizing' },
    { className: 'w-max',   css: 'width: max-content;',       category: 'sizing' },
    { className: 'min-w-0',    css: 'min-width: 0px;',        category: 'sizing' },
    { className: 'min-w-full', css: 'min-width: 100%;',       category: 'sizing' },
    { className: 'max-w-sm',   css: 'max-width: 24rem;',      category: 'sizing' },
    { className: 'max-w-md',   css: 'max-width: 28rem;',      category: 'sizing' },
    { className: 'max-w-lg',   css: 'max-width: 32rem;',      category: 'sizing' },
    { className: 'max-w-xl',   css: 'max-width: 36rem;',      category: 'sizing' },
    { className: 'max-w-2xl',  css: 'max-width: 42rem;',      category: 'sizing' },
    { className: 'max-w-4xl',  css: 'max-width: 56rem;',      category: 'sizing' },
    { className: 'max-w-6xl',  css: 'max-width: 72rem;',      category: 'sizing' },
    { className: 'max-w-full', css: 'max-width: 100%;',       category: 'sizing' },
    { className: 'max-w-screen-sm', css: 'max-width: 640px;', category: 'sizing' },
    { className: 'max-w-screen-md', css: 'max-width: 768px;', category: 'sizing' },
    { className: 'max-w-screen-lg', css: 'max-width: 1024px;', category: 'sizing' },
    { className: 'max-w-screen-xl', css: 'max-width: 1280px;', category: 'sizing' },
    { className: 'h-0',     css: 'height: 0px;',              category: 'sizing' },
    { className: 'h-1',     css: 'height: 0.25rem;',          category: 'sizing' },
    { className: 'h-4',     css: 'height: 1rem;',             category: 'sizing' },
    { className: 'h-8',     css: 'height: 2rem;',             category: 'sizing' },
    { className: 'h-16',    css: 'height: 4rem;',             category: 'sizing' },
    { className: 'h-32',    css: 'height: 8rem;',             category: 'sizing' },
    { className: 'h-64',    css: 'height: 16rem;',            category: 'sizing' },
    { className: 'h-full',  css: 'height: 100%;',             category: 'sizing' },
    { className: 'h-screen', css: 'height: 100vh;',           category: 'sizing' },
    { className: 'h-auto',  css: 'height: auto;',             category: 'sizing' },
    { className: 'h-fit',   css: 'height: fit-content;',      category: 'sizing' },
    { className: 'h-min',   css: 'height: min-content;',      category: 'sizing' },
    { className: 'h-max',   css: 'height: max-content;',      category: 'sizing' },
    { className: 'min-h-0',      css: 'min-height: 0px;',     category: 'sizing' },
    { className: 'min-h-full',   css: 'min-height: 100%;',    category: 'sizing' },
    { className: 'min-h-screen', css: 'min-height: 100vh;',   category: 'sizing' },
    { className: 'max-h-full',   css: 'max-height: 100%;',    category: 'sizing' },
    { className: 'max-h-screen', css: 'max-height: 100vh;',   category: 'sizing' },
    { className: 'size-4',  css: 'width: 1rem; height: 1rem;',   category: 'sizing' },
    { className: 'size-8',  css: 'width: 2rem; height: 2rem;',   category: 'sizing' },
    { className: 'size-full', css: 'width: 100%; height: 100%;', category: 'sizing' },

    // ── Typography ──
    { className: 'text-xs',   css: 'font-size: 0.75rem; line-height: 1rem;',     category: 'typography' },
    { className: 'text-sm',   css: 'font-size: 0.875rem; line-height: 1.25rem;', category: 'typography' },
    { className: 'text-base', css: 'font-size: 1rem; line-height: 1.5rem;',      category: 'typography' },
    { className: 'text-lg',   css: 'font-size: 1.125rem; line-height: 1.75rem;', category: 'typography' },
    { className: 'text-xl',   css: 'font-size: 1.25rem; line-height: 1.75rem;',  category: 'typography' },
    { className: 'text-2xl',  css: 'font-size: 1.5rem; line-height: 2rem;',      category: 'typography' },
    { className: 'text-3xl',  css: 'font-size: 1.875rem; line-height: 2.25rem;', category: 'typography' },
    { className: 'text-4xl',  css: 'font-size: 2.25rem; line-height: 2.5rem;',   category: 'typography' },
    { className: 'text-5xl',  css: 'font-size: 3rem; line-height: 1;',           category: 'typography' },
    { className: 'text-6xl',  css: 'font-size: 3.75rem; line-height: 1;',        category: 'typography' },
    { className: 'text-7xl',  css: 'font-size: 4.5rem; line-height: 1;',         category: 'typography' },
    { className: 'text-8xl',  css: 'font-size: 6rem; line-height: 1;',           category: 'typography' },
    { className: 'text-9xl',  css: 'font-size: 8rem; line-height: 1;',           category: 'typography' },
    { className: 'font-thin',       css: 'font-weight: 100;',   category: 'typography' },
    { className: 'font-extralight', css: 'font-weight: 200;',   category: 'typography' },
    { className: 'font-light',      css: 'font-weight: 300;',   category: 'typography' },
    { className: 'font-normal',     css: 'font-weight: 400;',   category: 'typography' },
    { className: 'font-medium',     css: 'font-weight: 500;',   category: 'typography' },
    { className: 'font-semibold',   css: 'font-weight: 600;',   category: 'typography' },
    { className: 'font-bold',       css: 'font-weight: 700;',   category: 'typography' },
    { className: 'font-extrabold',  css: 'font-weight: 800;',   category: 'typography' },
    { className: 'font-black',      css: 'font-weight: 900;',   category: 'typography' },
    { className: 'font-sans',  css: 'font-family: ui-sans-serif, system-ui, sans-serif;', category: 'typography' },
    { className: 'font-serif', css: 'font-family: ui-serif, Georgia, serif;',              category: 'typography' },
    { className: 'font-mono',  css: 'font-family: ui-monospace, monospace;',                category: 'typography' },
    { className: 'italic',     css: 'font-style: italic;',       category: 'typography' },
    { className: 'not-italic', css: 'font-style: normal;',       category: 'typography' },
    { className: 'text-left',    css: 'text-align: left;',       category: 'typography' },
    { className: 'text-center',  css: 'text-align: center;',     category: 'typography' },
    { className: 'text-right',   css: 'text-align: right;',      category: 'typography' },
    { className: 'text-justify', css: 'text-align: justify;',    category: 'typography' },
    { className: 'uppercase',    css: 'text-transform: uppercase;',   category: 'typography' },
    { className: 'lowercase',    css: 'text-transform: lowercase;',   category: 'typography' },
    { className: 'capitalize',   css: 'text-transform: capitalize;',  category: 'typography' },
    { className: 'normal-case',  css: 'text-transform: none;',        category: 'typography' },
    { className: 'underline',       css: 'text-decoration-line: underline;',      category: 'typography' },
    { className: 'overline',        css: 'text-decoration-line: overline;',       category: 'typography' },
    { className: 'line-through',    css: 'text-decoration-line: line-through;',   category: 'typography' },
    { className: 'no-underline',    css: 'text-decoration-line: none;',           category: 'typography' },
    { className: 'leading-none',    css: 'line-height: 1;',        category: 'typography' },
    { className: 'leading-tight',   css: 'line-height: 1.25;',     category: 'typography' },
    { className: 'leading-normal',  css: 'line-height: 1.5;',      category: 'typography' },
    { className: 'leading-relaxed', css: 'line-height: 1.625;',    category: 'typography' },
    { className: 'leading-loose',   css: 'line-height: 2;',        category: 'typography' },
    { className: 'tracking-tighter', css: 'letter-spacing: -0.05em;', category: 'typography' },
    { className: 'tracking-tight',   css: 'letter-spacing: -0.025em;', category: 'typography' },
    { className: 'tracking-normal',  css: 'letter-spacing: 0em;',      category: 'typography' },
    { className: 'tracking-wide',    css: 'letter-spacing: 0.025em;',  category: 'typography' },
    { className: 'tracking-wider',   css: 'letter-spacing: 0.05em;',   category: 'typography' },
    { className: 'tracking-widest',  css: 'letter-spacing: 0.1em;',    category: 'typography' },
    { className: 'truncate',  css: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;', category: 'typography' },
    { className: 'text-wrap',   css: 'text-wrap: wrap;',     category: 'typography' },
    { className: 'text-nowrap', css: 'text-wrap: nowrap;',   category: 'typography' },
    { className: 'whitespace-normal',  css: 'white-space: normal;',  category: 'typography' },
    { className: 'whitespace-nowrap',  css: 'white-space: nowrap;',  category: 'typography' },
    { className: 'whitespace-pre',     css: 'white-space: pre;',     category: 'typography' },
    { className: 'break-words', css: 'overflow-wrap: break-word;',   category: 'typography' },
    { className: 'break-all',  css: 'word-break: break-all;',        category: 'typography' },
    { className: 'list-none',  css: 'list-style-type: none;',        category: 'typography' },
    { className: 'list-disc',  css: 'list-style-type: disc;',        category: 'typography' },
    { className: 'list-decimal', css: 'list-style-type: decimal;',   category: 'typography' },

    // ── Colors ──
    { className: 'text-white',      css: 'color: #fff;',                    category: 'colors' },
    { className: 'text-black',      css: 'color: #000;',                    category: 'colors' },
    { className: 'text-transparent', css: 'color: transparent;',            category: 'colors' },
    { className: 'text-gray-50',    css: 'color: #f9fafb;',                 category: 'colors' },
    { className: 'text-gray-100',   css: 'color: #f3f4f6;',                 category: 'colors' },
    { className: 'text-gray-300',   css: 'color: #d1d5db;',                 category: 'colors' },
    { className: 'text-gray-500',   css: 'color: #6b7280;',                 category: 'colors' },
    { className: 'text-gray-700',   css: 'color: #374151;',                 category: 'colors' },
    { className: 'text-gray-900',   css: 'color: #111827;',                 category: 'colors' },
    { className: 'text-red-500',    css: 'color: #ef4444;',                 category: 'colors' },
    { className: 'text-blue-500',   css: 'color: #3b82f6;',                 category: 'colors' },
    { className: 'text-green-500',  css: 'color: #22c55e;',                 category: 'colors' },
    { className: 'text-yellow-500', css: 'color: #eab308;',                 category: 'colors' },
    { className: 'text-purple-500', css: 'color: #a855f7;',                 category: 'colors' },
    { className: 'text-pink-500',   css: 'color: #ec4899;',                 category: 'colors' },
    { className: 'text-indigo-500', css: 'color: #6366f1;',                 category: 'colors' },
    { className: 'text-cyan-500',   css: 'color: #06b6d4;',                 category: 'colors' },
    { className: 'bg-white',       css: 'background-color: #fff;',          category: 'colors' },
    { className: 'bg-black',       css: 'background-color: #000;',          category: 'colors' },
    { className: 'bg-transparent', css: 'background-color: transparent;',   category: 'colors' },
    { className: 'bg-gray-50',     css: 'background-color: #f9fafb;',       category: 'colors' },
    { className: 'bg-gray-100',    css: 'background-color: #f3f4f6;',       category: 'colors' },
    { className: 'bg-gray-200',    css: 'background-color: #e5e7eb;',       category: 'colors' },
    { className: 'bg-gray-500',    css: 'background-color: #6b7280;',       category: 'colors' },
    { className: 'bg-gray-800',    css: 'background-color: #1f2937;',       category: 'colors' },
    { className: 'bg-gray-900',    css: 'background-color: #111827;',       category: 'colors' },
    { className: 'bg-red-500',     css: 'background-color: #ef4444;',       category: 'colors' },
    { className: 'bg-blue-500',    css: 'background-color: #3b82f6;',       category: 'colors' },
    { className: 'bg-green-500',   css: 'background-color: #22c55e;',       category: 'colors' },
    { className: 'bg-yellow-500',  css: 'background-color: #eab308;',       category: 'colors' },
    { className: 'bg-purple-500',  css: 'background-color: #a855f7;',       category: 'colors' },
    { className: 'bg-indigo-500',  css: 'background-color: #6366f1;',       category: 'colors' },
    { className: 'bg-gradient-to-r', css: 'background-image: linear-gradient(to right, var(--tw-gradient-stops));', category: 'colors' },
    { className: 'bg-gradient-to-b', css: 'background-image: linear-gradient(to bottom, var(--tw-gradient-stops));', category: 'colors' },
    { className: 'from-blue-500',  css: '--tw-gradient-from: #3b82f6;',     category: 'colors' },
    { className: 'to-purple-500',  css: '--tw-gradient-to: #a855f7;',       category: 'colors' },
    { className: 'via-green-500',  css: '--tw-gradient-via: #22c55e;',      category: 'colors' },
    { className: 'opacity-0',   css: 'opacity: 0;',     category: 'colors' },
    { className: 'opacity-25',  css: 'opacity: 0.25;',  category: 'colors' },
    { className: 'opacity-50',  css: 'opacity: 0.5;',   category: 'colors' },
    { className: 'opacity-75',  css: 'opacity: 0.75;',  category: 'colors' },
    { className: 'opacity-100', css: 'opacity: 1;',     category: 'colors' },

    // ── Flexbox ──
    { className: 'flex',         css: 'display: flex;',                    category: 'flexbox' },
    { className: 'inline-flex',  css: 'display: inline-flex;',             category: 'flexbox' },
    { className: 'flex-row',     css: 'flex-direction: row;',              category: 'flexbox' },
    { className: 'flex-row-reverse', css: 'flex-direction: row-reverse;',  category: 'flexbox' },
    { className: 'flex-col',     css: 'flex-direction: column;',           category: 'flexbox' },
    { className: 'flex-col-reverse', css: 'flex-direction: column-reverse;', category: 'flexbox' },
    { className: 'flex-wrap',    css: 'flex-wrap: wrap;',                  category: 'flexbox' },
    { className: 'flex-nowrap',  css: 'flex-wrap: nowrap;',                category: 'flexbox' },
    { className: 'flex-wrap-reverse', css: 'flex-wrap: wrap-reverse;',     category: 'flexbox' },
    { className: 'flex-1',      css: 'flex: 1 1 0%;',                     category: 'flexbox' },
    { className: 'flex-auto',   css: 'flex: 1 1 auto;',                   category: 'flexbox' },
    { className: 'flex-initial', css: 'flex: 0 1 auto;',                  category: 'flexbox' },
    { className: 'flex-none',   css: 'flex: none;',                        category: 'flexbox' },
    { className: 'grow',        css: 'flex-grow: 1;',                      category: 'flexbox' },
    { className: 'grow-0',      css: 'flex-grow: 0;',                      category: 'flexbox' },
    { className: 'shrink',      css: 'flex-shrink: 1;',                    category: 'flexbox' },
    { className: 'shrink-0',    css: 'flex-shrink: 0;',                    category: 'flexbox' },
    { className: 'justify-start',   css: 'justify-content: flex-start;',  category: 'flexbox' },
    { className: 'justify-end',     css: 'justify-content: flex-end;',    category: 'flexbox' },
    { className: 'justify-center',  css: 'justify-content: center;',      category: 'flexbox' },
    { className: 'justify-between', css: 'justify-content: space-between;', category: 'flexbox' },
    { className: 'justify-around',  css: 'justify-content: space-around;',  category: 'flexbox' },
    { className: 'justify-evenly',  css: 'justify-content: space-evenly;',  category: 'flexbox' },
    { className: 'items-start',     css: 'align-items: flex-start;',      category: 'flexbox' },
    { className: 'items-end',       css: 'align-items: flex-end;',        category: 'flexbox' },
    { className: 'items-center',    css: 'align-items: center;',          category: 'flexbox' },
    { className: 'items-baseline',  css: 'align-items: baseline;',        category: 'flexbox' },
    { className: 'items-stretch',   css: 'align-items: stretch;',         category: 'flexbox' },
    { className: 'self-auto',    css: 'align-self: auto;',                category: 'flexbox' },
    { className: 'self-start',   css: 'align-self: flex-start;',          category: 'flexbox' },
    { className: 'self-end',     css: 'align-self: flex-end;',            category: 'flexbox' },
    { className: 'self-center',  css: 'align-self: center;',              category: 'flexbox' },
    { className: 'self-stretch', css: 'align-self: stretch;',             category: 'flexbox' },
    { className: 'order-1',     css: 'order: 1;',                         category: 'flexbox' },
    { className: 'order-2',     css: 'order: 2;',                         category: 'flexbox' },
    { className: 'order-first', css: 'order: -9999;',                     category: 'flexbox' },
    { className: 'order-last',  css: 'order: 9999;',                      category: 'flexbox' },
    { className: 'order-none',  css: 'order: 0;',                         category: 'flexbox' },

    // ── Grid ──
    { className: 'grid',          css: 'display: grid;',                           category: 'grid' },
    { className: 'inline-grid',   css: 'display: inline-grid;',                    category: 'grid' },
    { className: 'grid-cols-1',   css: 'grid-template-columns: repeat(1, minmax(0, 1fr));',  category: 'grid' },
    { className: 'grid-cols-2',   css: 'grid-template-columns: repeat(2, minmax(0, 1fr));',  category: 'grid' },
    { className: 'grid-cols-3',   css: 'grid-template-columns: repeat(3, minmax(0, 1fr));',  category: 'grid' },
    { className: 'grid-cols-4',   css: 'grid-template-columns: repeat(4, minmax(0, 1fr));',  category: 'grid' },
    { className: 'grid-cols-6',   css: 'grid-template-columns: repeat(6, minmax(0, 1fr));',  category: 'grid' },
    { className: 'grid-cols-12',  css: 'grid-template-columns: repeat(12, minmax(0, 1fr));', category: 'grid' },
    { className: 'grid-cols-none', css: 'grid-template-columns: none;',            category: 'grid' },
    { className: 'grid-rows-1',   css: 'grid-template-rows: repeat(1, minmax(0, 1fr));',    category: 'grid' },
    { className: 'grid-rows-2',   css: 'grid-template-rows: repeat(2, minmax(0, 1fr));',    category: 'grid' },
    { className: 'grid-rows-3',   css: 'grid-template-rows: repeat(3, minmax(0, 1fr));',    category: 'grid' },
    { className: 'grid-rows-none', css: 'grid-template-rows: none;',               category: 'grid' },
    { className: 'col-span-1',    css: 'grid-column: span 1 / span 1;',            category: 'grid' },
    { className: 'col-span-2',    css: 'grid-column: span 2 / span 2;',            category: 'grid' },
    { className: 'col-span-3',    css: 'grid-column: span 3 / span 3;',            category: 'grid' },
    { className: 'col-span-4',    css: 'grid-column: span 4 / span 4;',            category: 'grid' },
    { className: 'col-span-6',    css: 'grid-column: span 6 / span 6;',            category: 'grid' },
    { className: 'col-span-full', css: 'grid-column: 1 / -1;',                     category: 'grid' },
    { className: 'col-start-1',   css: 'grid-column-start: 1;',                    category: 'grid' },
    { className: 'col-end-3',     css: 'grid-column-end: 3;',                      category: 'grid' },
    { className: 'row-span-1',    css: 'grid-row: span 1 / span 1;',               category: 'grid' },
    { className: 'row-span-2',    css: 'grid-row: span 2 / span 2;',               category: 'grid' },
    { className: 'row-span-full', css: 'grid-row: 1 / -1;',                        category: 'grid' },
    { className: 'grid-flow-row',  css: 'grid-auto-flow: row;',                    category: 'grid' },
    { className: 'grid-flow-col',  css: 'grid-auto-flow: column;',                 category: 'grid' },
    { className: 'grid-flow-dense', css: 'grid-auto-flow: dense;',                 category: 'grid' },
    { className: 'auto-cols-auto', css: 'grid-auto-columns: auto;',                category: 'grid' },
    { className: 'auto-cols-fr',   css: 'grid-auto-columns: minmax(0, 1fr);',      category: 'grid' },
    { className: 'auto-rows-auto', css: 'grid-auto-rows: auto;',                   category: 'grid' },
    { className: 'auto-rows-fr',   css: 'grid-auto-rows: minmax(0, 1fr);',         category: 'grid' },
    { className: 'place-content-center', css: 'place-content: center;',            category: 'grid' },
    { className: 'place-items-center',   css: 'place-items: center;',              category: 'grid' },
    { className: 'place-self-center',    css: 'place-self: center;',               category: 'grid' },

    // ── Borders ──
    { className: 'border',     css: 'border-width: 1px;',              category: 'borders' },
    { className: 'border-0',   css: 'border-width: 0px;',              category: 'borders' },
    { className: 'border-2',   css: 'border-width: 2px;',              category: 'borders' },
    { className: 'border-4',   css: 'border-width: 4px;',              category: 'borders' },
    { className: 'border-8',   css: 'border-width: 8px;',              category: 'borders' },
    { className: 'border-t',   css: 'border-top-width: 1px;',          category: 'borders' },
    { className: 'border-b',   css: 'border-bottom-width: 1px;',       category: 'borders' },
    { className: 'border-l',   css: 'border-left-width: 1px;',         category: 'borders' },
    { className: 'border-r',   css: 'border-right-width: 1px;',        category: 'borders' },
    { className: 'border-solid',  css: 'border-style: solid;',         category: 'borders' },
    { className: 'border-dashed', css: 'border-style: dashed;',        category: 'borders' },
    { className: 'border-dotted', css: 'border-style: dotted;',        category: 'borders' },
    { className: 'border-double', css: 'border-style: double;',        category: 'borders' },
    { className: 'border-none',   css: 'border-style: none;',          category: 'borders' },
    { className: 'border-gray-300',  css: 'border-color: #d1d5db;',    category: 'borders' },
    { className: 'border-gray-500',  css: 'border-color: #6b7280;',    category: 'borders' },
    { className: 'border-red-500',   css: 'border-color: #ef4444;',    category: 'borders' },
    { className: 'border-blue-500',  css: 'border-color: #3b82f6;',    category: 'borders' },
    { className: 'border-green-500', css: 'border-color: #22c55e;',    category: 'borders' },
    { className: 'border-white',     css: 'border-color: #fff;',       category: 'borders' },
    { className: 'border-black',     css: 'border-color: #000;',       category: 'borders' },
    { className: 'border-transparent', css: 'border-color: transparent;', category: 'borders' },
    { className: 'rounded-none', css: 'border-radius: 0px;',           category: 'borders' },
    { className: 'rounded-sm',   css: 'border-radius: 0.125rem;',      category: 'borders' },
    { className: 'rounded',      css: 'border-radius: 0.25rem;',       category: 'borders' },
    { className: 'rounded-md',   css: 'border-radius: 0.375rem;',      category: 'borders' },
    { className: 'rounded-lg',   css: 'border-radius: 0.5rem;',        category: 'borders' },
    { className: 'rounded-xl',   css: 'border-radius: 0.75rem;',       category: 'borders' },
    { className: 'rounded-2xl',  css: 'border-radius: 1rem;',          category: 'borders' },
    { className: 'rounded-3xl',  css: 'border-radius: 1.5rem;',        category: 'borders' },
    { className: 'rounded-full', css: 'border-radius: 9999px;',        category: 'borders' },
    { className: 'rounded-t-lg', css: 'border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem;',         category: 'borders' },
    { className: 'rounded-b-lg', css: 'border-bottom-left-radius: 0.5rem; border-bottom-right-radius: 0.5rem;',   category: 'borders' },
    { className: 'outline-none', css: 'outline: 2px solid transparent; outline-offset: 2px;', category: 'borders' },
    { className: 'outline',      css: 'outline-style: solid;',         category: 'borders' },
    { className: 'ring-0',       css: 'box-shadow: var(--tw-ring-inset) 0 0 0 0px var(--tw-ring-color);', category: 'borders' },
    { className: 'ring-1',       css: 'box-shadow: var(--tw-ring-inset) 0 0 0 1px var(--tw-ring-color);', category: 'borders' },
    { className: 'ring-2',       css: 'box-shadow: var(--tw-ring-inset) 0 0 0 2px var(--tw-ring-color);', category: 'borders' },
    { className: 'divide-x',     css: '> * + * { border-left-width: 1px; }',  category: 'borders' },
    { className: 'divide-y',     css: '> * + * { border-top-width: 1px; }',   category: 'borders' },

    // ── Effects ──
    { className: 'shadow-sm',  css: 'box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);',                                    category: 'effects' },
    { className: 'shadow',     css: 'box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);',    category: 'effects' },
    { className: 'shadow-md',  css: 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);', category: 'effects' },
    { className: 'shadow-lg',  css: 'box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);', category: 'effects' },
    { className: 'shadow-xl',  css: 'box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);', category: 'effects' },
    { className: 'shadow-2xl', css: 'box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);',                               category: 'effects' },
    { className: 'shadow-inner', css: 'box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);',                            category: 'effects' },
    { className: 'shadow-none', css: 'box-shadow: 0 0 #0000;',           category: 'effects' },
    { className: 'blur-sm',    css: 'filter: blur(4px);',                 category: 'effects' },
    { className: 'blur',       css: 'filter: blur(8px);',                 category: 'effects' },
    { className: 'blur-md',    css: 'filter: blur(12px);',                category: 'effects' },
    { className: 'blur-lg',    css: 'filter: blur(16px);',                category: 'effects' },
    { className: 'blur-none',  css: 'filter: blur(0);',                   category: 'effects' },
    { className: 'brightness-50',  css: 'filter: brightness(.5);',        category: 'effects' },
    { className: 'brightness-100', css: 'filter: brightness(1);',         category: 'effects' },
    { className: 'brightness-150', css: 'filter: brightness(1.5);',       category: 'effects' },
    { className: 'contrast-50',  css: 'filter: contrast(.5);',            category: 'effects' },
    { className: 'contrast-100', css: 'filter: contrast(1);',             category: 'effects' },
    { className: 'grayscale',   css: 'filter: grayscale(100%);',           category: 'effects' },
    { className: 'grayscale-0', css: 'filter: grayscale(0);',              category: 'effects' },
    { className: 'invert',     css: 'filter: invert(100%);',               category: 'effects' },
    { className: 'invert-0',   css: 'filter: invert(0);',                  category: 'effects' },
    { className: 'saturate-50',  css: 'filter: saturate(.5);',             category: 'effects' },
    { className: 'saturate-100', css: 'filter: saturate(1);',              category: 'effects' },
    { className: 'saturate-200', css: 'filter: saturate(2);',              category: 'effects' },
    { className: 'sepia',       css: 'filter: sepia(100%);',               category: 'effects' },
    { className: 'sepia-0',     css: 'filter: sepia(0);',                  category: 'effects' },
    { className: 'backdrop-blur-sm',  css: 'backdrop-filter: blur(4px);',  category: 'effects' },
    { className: 'backdrop-blur-md',  css: 'backdrop-filter: blur(12px);', category: 'effects' },
    { className: 'mix-blend-normal',   css: 'mix-blend-mode: normal;',     category: 'effects' },
    { className: 'mix-blend-multiply', css: 'mix-blend-mode: multiply;',   category: 'effects' },
    { className: 'mix-blend-screen',   css: 'mix-blend-mode: screen;',     category: 'effects' },
    { className: 'mix-blend-overlay',  css: 'mix-blend-mode: overlay;',    category: 'effects' },
    { className: 'hidden',      css: 'display: none;',                     category: 'effects' },
    { className: 'block',       css: 'display: block;',                    category: 'effects' },
    { className: 'inline',      css: 'display: inline;',                   category: 'effects' },
    { className: 'inline-block', css: 'display: inline-block;',            category: 'effects' },
    { className: 'invisible',   css: 'visibility: hidden;',                category: 'effects' },
    { className: 'visible',     css: 'visibility: visible;',               category: 'effects' },
    { className: 'overflow-hidden',  css: 'overflow: hidden;',             category: 'effects' },
    { className: 'overflow-auto',    css: 'overflow: auto;',               category: 'effects' },
    { className: 'overflow-scroll',  css: 'overflow: scroll;',             category: 'effects' },
    { className: 'overflow-visible', css: 'overflow: visible;',            category: 'effects' },
    { className: 'overflow-x-auto',  css: 'overflow-x: auto;',            category: 'effects' },
    { className: 'overflow-y-auto',  css: 'overflow-y: auto;',            category: 'effects' },
    { className: 'relative',  css: 'position: relative;',                  category: 'effects' },
    { className: 'absolute',  css: 'position: absolute;',                  category: 'effects' },
    { className: 'fixed',     css: 'position: fixed;',                     category: 'effects' },
    { className: 'sticky',    css: 'position: sticky;',                    category: 'effects' },
    { className: 'static',    css: 'position: static;',                    category: 'effects' },
    { className: 'inset-0',   css: 'inset: 0px;',                          category: 'effects' },
    { className: 'top-0',     css: 'top: 0px;',                            category: 'effects' },
    { className: 'right-0',   css: 'right: 0px;',                          category: 'effects' },
    { className: 'bottom-0',  css: 'bottom: 0px;',                         category: 'effects' },
    { className: 'left-0',    css: 'left: 0px;',                           category: 'effects' },
    { className: 'z-0',       css: 'z-index: 0;',                          category: 'effects' },
    { className: 'z-10',      css: 'z-index: 10;',                         category: 'effects' },
    { className: 'z-20',      css: 'z-index: 20;',                         category: 'effects' },
    { className: 'z-30',      css: 'z-index: 30;',                         category: 'effects' },
    { className: 'z-40',      css: 'z-index: 40;',                         category: 'effects' },
    { className: 'z-50',      css: 'z-index: 50;',                         category: 'effects' },
    { className: 'z-auto',    css: 'z-index: auto;',                       category: 'effects' },
    { className: 'cursor-pointer',  css: 'cursor: pointer;',               category: 'effects' },
    { className: 'cursor-default',  css: 'cursor: default;',               category: 'effects' },
    { className: 'cursor-not-allowed', css: 'cursor: not-allowed;',        category: 'effects' },
    { className: 'cursor-wait',     css: 'cursor: wait;',                  category: 'effects' },
    { className: 'pointer-events-none', css: 'pointer-events: none;',      category: 'effects' },
    { className: 'pointer-events-auto', css: 'pointer-events: auto;',      category: 'effects' },
    { className: 'select-none', css: 'user-select: none;',                 category: 'effects' },
    { className: 'select-text', css: 'user-select: text;',                 category: 'effects' },
    { className: 'select-all',  css: 'user-select: all;',                  category: 'effects' },
    { className: 'resize-none', css: 'resize: none;',                      category: 'effects' },
    { className: 'resize',      css: 'resize: both;',                      category: 'effects' },
    { className: 'resize-x',    css: 'resize: horizontal;',                category: 'effects' },
    { className: 'resize-y',    css: 'resize: vertical;',                  category: 'effects' },
    { className: 'appearance-none', css: 'appearance: none;',              category: 'effects' },

    // ── Transitions ──
    { className: 'transition',       css: 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;', category: 'transitions' },
    { className: 'transition-all',   css: 'transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;', category: 'transitions' },
    { className: 'transition-colors', css: 'transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;', category: 'transitions' },
    { className: 'transition-opacity', css: 'transition-property: opacity; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;', category: 'transitions' },
    { className: 'transition-shadow', css: 'transition-property: box-shadow; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;', category: 'transitions' },
    { className: 'transition-transform', css: 'transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms;', category: 'transitions' },
    { className: 'transition-none', css: 'transition-property: none;',     category: 'transitions' },
    { className: 'duration-75',  css: 'transition-duration: 75ms;',        category: 'transitions' },
    { className: 'duration-100', css: 'transition-duration: 100ms;',       category: 'transitions' },
    { className: 'duration-150', css: 'transition-duration: 150ms;',       category: 'transitions' },
    { className: 'duration-200', css: 'transition-duration: 200ms;',       category: 'transitions' },
    { className: 'duration-300', css: 'transition-duration: 300ms;',       category: 'transitions' },
    { className: 'duration-500', css: 'transition-duration: 500ms;',       category: 'transitions' },
    { className: 'duration-700', css: 'transition-duration: 700ms;',       category: 'transitions' },
    { className: 'duration-1000', css: 'transition-duration: 1000ms;',     category: 'transitions' },
    { className: 'ease-linear',  css: 'transition-timing-function: linear;',                     category: 'transitions' },
    { className: 'ease-in',      css: 'transition-timing-function: cubic-bezier(0.4, 0, 1, 1);', category: 'transitions' },
    { className: 'ease-out',     css: 'transition-timing-function: cubic-bezier(0, 0, 0.2, 1);', category: 'transitions' },
    { className: 'ease-in-out',  css: 'transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);', category: 'transitions' },
    { className: 'delay-75',    css: 'transition-delay: 75ms;',           category: 'transitions' },
    { className: 'delay-100',   css: 'transition-delay: 100ms;',          category: 'transitions' },
    { className: 'delay-150',   css: 'transition-delay: 150ms;',          category: 'transitions' },
    { className: 'delay-200',   css: 'transition-delay: 200ms;',          category: 'transitions' },
    { className: 'delay-300',   css: 'transition-delay: 300ms;',          category: 'transitions' },
    { className: 'delay-500',   css: 'transition-delay: 500ms;',          category: 'transitions' },
    { className: 'animate-none',   css: 'animation: none;',               category: 'transitions' },
    { className: 'animate-spin',   css: 'animation: spin 1s linear infinite;',   category: 'transitions' },
    { className: 'animate-ping',   css: 'animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;', category: 'transitions' },
    { className: 'animate-pulse',  css: 'animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;', category: 'transitions' },
    { className: 'animate-bounce', css: 'animation: bounce 1s infinite;', category: 'transitions' },
    { className: 'transform',      css: 'transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));', category: 'transitions' },
    { className: 'transform-none', css: 'transform: none;',               category: 'transitions' },
    { className: 'scale-0',    css: 'transform: scale(0);',               category: 'transitions' },
    { className: 'scale-50',   css: 'transform: scale(.5);',              category: 'transitions' },
    { className: 'scale-75',   css: 'transform: scale(.75);',             category: 'transitions' },
    { className: 'scale-100',  css: 'transform: scale(1);',               category: 'transitions' },
    { className: 'scale-110',  css: 'transform: scale(1.1);',             category: 'transitions' },
    { className: 'scale-125',  css: 'transform: scale(1.25);',            category: 'transitions' },
    { className: 'scale-150',  css: 'transform: scale(1.5);',             category: 'transitions' },
    { className: 'rotate-0',   css: 'transform: rotate(0deg);',           category: 'transitions' },
    { className: 'rotate-45',  css: 'transform: rotate(45deg);',          category: 'transitions' },
    { className: 'rotate-90',  css: 'transform: rotate(90deg);',          category: 'transitions' },
    { className: 'rotate-180', css: 'transform: rotate(180deg);',         category: 'transitions' },
    { className: '-rotate-45', css: 'transform: rotate(-45deg);',         category: 'transitions' },
    { className: '-rotate-90', css: 'transform: rotate(-90deg);',         category: 'transitions' },
    { className: 'translate-x-0',    css: 'transform: translateX(0px);',         category: 'transitions' },
    { className: 'translate-x-1',    css: 'transform: translateX(0.25rem);',     category: 'transitions' },
    { className: 'translate-x-full', css: 'transform: translateX(100%);',        category: 'transitions' },
    { className: 'translate-y-0',    css: 'transform: translateY(0px);',         category: 'transitions' },
    { className: 'translate-y-full', css: 'transform: translateY(100%);',        category: 'transitions' },
    { className: '-translate-x-1/2', css: 'transform: translateX(-50%);',        category: 'transitions' },
    { className: '-translate-y-1/2', css: 'transform: translateY(-50%);',        category: 'transitions' },
    { className: 'origin-center', css: 'transform-origin: center;',       category: 'transitions' },
    { className: 'origin-top',    css: 'transform-origin: top;',          category: 'transitions' },
    { className: 'origin-bottom', css: 'transform-origin: bottom;',       category: 'transitions' },
    { className: 'origin-left',   css: 'transform-origin: left;',         category: 'transitions' },
    { className: 'origin-right',  css: 'transform-origin: right;',        category: 'transitions' },
    { className: 'will-change-auto',      css: 'will-change: auto;',      category: 'transitions' },
    { className: 'will-change-scroll',    css: 'will-change: scroll-position;', category: 'transitions' },
    { className: 'will-change-transform', css: 'will-change: transform;', category: 'transitions' },
  ];

  constructor(private router: Router) {}

  get filteredEntries(): TailwindEntry[] {
    const q = this.searchQuery.toLowerCase().trim();
    let results = this.entries;

    if (this.activeCategory !== 'all') {
      results = results.filter(e => e.category === this.activeCategory);
    }

    if (q) {
      // Easter egg
      if (q === 'hidden') {
        this.eggs.trigger('tw-hidden');
      }

      results = results.filter(e =>
        e.className.toLowerCase().includes(q) ||
        e.css.toLowerCase().includes(q)
      );
    }

    return results;
  }

  get resultCount(): number {
    return this.filteredEntries.length;
  }

  get totalCount(): number {
    return this.entries.length;
  }

  setCategory(cat: CategoryFilter) {
    this.activeCategory = cat;
  }

  getCategoryCount(cat: CategoryFilter): number {
    if (cat === 'all') return this.entries.length;
    return this.entries.filter(e => e.category === cat).length;
  }

  goBack() {
    this.router.navigate(['/tools']);
  }

  async copyClass(entry: TailwindEntry) {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(entry.className);
      this.copied = true;
      this.copiedClass = entry.className;
      setTimeout(() => {
        this.copied = false;
        this.copiedClass = '';
      }, 2000);
    } catch {
      this.fallbackCopy(entry.className);
    }
  }

  private fallbackCopy(text: string) {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copied = true;
    this.copiedClass = text;
    setTimeout(() => {
      this.copied = false;
      this.copiedClass = '';
    }, 2000);
  }

  showPreview(entry: TailwindEntry) {
    this.previewEntry = entry;
  }

  hidePreview() {
    this.previewEntry = null;
  }

  clearSearch() {
    this.searchQuery = '';
    this.activeCategory = 'all';
  }
}
