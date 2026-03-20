import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HeroComponent } from './hero/hero.component';
import { SkillsComponent } from './skills/skills.component';
import { ProjectsComponent } from './projects/projects.component';
import { ContactComponent } from './contact/contact.component';
import { DonateComponent } from './donate/donate.component';
import { LandingComponent } from './landing/landing.component';
import { ToolsComponent } from './tools/tools.component';
import { PdfGeneratorComponent } from './tools/pdf-generator/pdf-generator.component';
import { ColorPaletteComponent } from './tools/color-palette/color-palette.component';
import { RouteTitles } from './shared/title-strategy.service';
import { SITE_URL } from './seo.service';

const routes: Routes = [
  {
    path: 'home',
    component: LandingComponent,
    title: 'xsantcastx | Full-Stack Developer & Studio Utilities',
    data: {
      description: 'xsantcastx — Full-Stack Developer building modern web apps and free browser-based tools for designers and developers. No installs, no accounts.',
      keywords: 'full stack developer, web development, angular, typescript, free browser tools, pdf generator, color palette',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'xsantcastx',
        url: SITE_URL,
        jobTitle: 'Full-Stack Developer',
        description: 'Independent developer building web applications and free browser tools.',
        sameAs: []
      }
    }
  },
  {
    path: 'skills',
    component: SkillsComponent,
    title: RouteTitles.skills,
    data: {
      description: 'Technical skills across Angular, React, TypeScript, Node.js, Firebase, and more. Full-stack expertise for modern web and mobile applications.',
      keywords: 'angular, react, typescript, nodejs, firebase, full stack skills, web developer skills'
    }
  },
  {
    path: 'projects',
    component: ProjectsComponent,
    title: RouteTitles.projects,
    data: {
      description: 'Portfolio of real-world projects: e-commerce platforms, web applications, and developer tools built with Angular, Firebase, and TypeScript.',
      keywords: 'portfolio, web projects, angular projects, firebase projects, case studies, web applications'
    }
  },
  {
    path: 'contact',
    component: ContactComponent,
    title: RouteTitles.contact,
    data: {
      description: 'Get in touch for freelance web development, project collaboration, or consulting. Based in Spain, working globally.',
      keywords: 'hire developer, freelance web development, contact, project consultation'
    }
  },
  {
    path: 'donate',
    component: DonateComponent,
    title: RouteTitles.donate,
    data: {
      description: 'Support open-source tools and development work. Donate via Stripe, PayPal, or crypto.',
      keywords: 'donate, support developer, open source, sponsorship'
    }
  },
  {
    path: 'tools',
    component: ToolsComponent,
    title: 'Free Browser Tools for Designers & Developers | xsantcastx',
    data: {
      description: 'Free browser-based tools — PDF Catalog Generator, Color Palette Extractor, and more. No sign-up, no installs, no uploads. Just open and use.',
      keywords: 'free online tools, browser tools, pdf catalog generator, color palette extractor, developer tools, design tools, no sign up',
      ogImage: `${SITE_URL}/assets/og/og-tools.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Free Browser Tools',
        description: 'Free browser-based tools for designers and developers',
        url: `${SITE_URL}/tools`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            item: {
              '@type': 'SoftwareApplication',
              name: 'PDF Catalog Generator',
              url: `${SITE_URL}/tools/pdf-generator`,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 2,
            item: {
              '@type': 'SoftwareApplication',
              name: 'Color Palette Extractor',
              url: `${SITE_URL}/tools/color-palette`,
              applicationCategory: 'DesignApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          }
        ]
      }
    }
  },
  {
    path: 'tools/pdf-generator',
    component: PdfGeneratorComponent,
    title: 'Free PDF Catalog Generator — Upload Images & Export PDF | xsantcastx',
    data: {
      description: 'Free online PDF catalog generator. Upload product images, add names, prices and descriptions, choose a layout template, and download a professional PDF. No sign-up needed.',
      keywords: 'free pdf catalog maker, product catalog pdf, image to pdf online, pdf generator no sign up, catalog builder online, product brochure maker',
      ogImage: `${SITE_URL}/assets/og/og-pdf-generator.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'PDF Catalog Generator',
        url: `${SITE_URL}/tools/pdf-generator`,
        description: 'Free browser-based PDF catalog builder. Upload images, configure product details and layout, download a professional PDF — no account required.',
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Drag and drop image upload',
          'Multiple layout templates',
          'Custom accent colors',
          'Undo / Redo',
          'Auto-save to browser',
          'Export and import catalog JSON',
          'No account required'
        ],
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'PDF Catalog Generator', item: `${SITE_URL}/tools/pdf-generator` }
          ]
        }
      }
    }
  },
  {
    path: 'tools/color-palette',
    component: ColorPaletteComponent,
    title: 'Free Color Palette Extractor — Get Colors from Any Image | xsantcastx',
    data: {
      description: 'Extract dominant colors from any image for free. Copy HEX, RGB or HSL values instantly. Export your palette as CSS variables, Tailwind config, or JSON. No upload, runs in browser.',
      keywords: 'color palette extractor, dominant colors from image, image color picker, css color variables, tailwind colors, hex color extractor, color palette generator',
      ogImage: `${SITE_URL}/assets/og/og-color-palette.png`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Color Palette Extractor',
        url: `${SITE_URL}/tools/color-palette`,
        description: 'Extract dominant colors from any image. Copy HEX, RGB or HSL values and export as CSS variables, Tailwind config, or JSON — free and runs entirely in your browser.',
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Dominant color extraction',
          'HEX, RGB and HSL formats',
          'Export as CSS variables',
          'Export as Tailwind config',
          'Export as JSON',
          'Adjustable palette size (4–12 colors)',
          'No account required'
        ],
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'Color Palette Extractor', item: `${SITE_URL}/tools/color-palette` }
          ]
        }
      }
    }
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }