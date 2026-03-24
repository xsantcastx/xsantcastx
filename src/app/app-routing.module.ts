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
import { ContrastCheckerComponent } from './tools/contrast-checker/contrast-checker.component';
import { ImageCompressorComponent } from './tools/image-compressor/image-compressor.component';
import { GmailDeliverabilityCheckerComponent } from './tools/gmail-deliverability-checker/gmail-deliverability-checker.component';
import { BoxShadowGeneratorComponent } from './tools/box-shadow-generator/box-shadow-generator.component';
import { EmailDeliverabilityAuditorComponent } from './tools/email-deliverability-auditor/email-deliverability-auditor.component';
import { SslCertificateInspectorComponent } from './tools/ssl-certificate-inspector/ssl-certificate-inspector.component';
import { SvgToCodeComponent } from './tools/svg-to-code/svg-to-code.component';
import { RouteTitles } from './shared/title-strategy.service';
import { SITE_URL } from './seo.service';
import { LiveComponent } from './live/live.component';

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
  {
    path: 'tools/contrast-checker',
    component: ContrastCheckerComponent,
    title: 'Free WCAG Contrast Checker — AA & AAA Compliance | xsantcastx',
    data: {
      description: 'Free online WCAG contrast checker. Test foreground/background color pairs against AA and AAA accessibility standards for normal text, large text, and UI components.',
      keywords: 'wcag contrast checker, color contrast ratio, accessibility checker, aa aaa compliance, contrast ratio tool, web accessibility',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'WCAG Contrast Checker',
        url: `${SITE_URL}/tools/contrast-checker`,
        description: 'Free browser-based WCAG contrast checker. Test color pairs against AA and AAA standards for normal text, large text, and UI components.',
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: ['WCAG AA checking', 'WCAG AAA checking', 'Normal text, large text, UI components', 'Live preview', 'Color picker', 'Preset color pairs'],
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'Contrast Checker', item: `${SITE_URL}/tools/contrast-checker` }
          ]
        }
      }
    }
  },
  {
    path: 'tools/image-compressor',
    component: ImageCompressorComponent,
    title: 'Free Image Compressor — JPEG, PNG, WebP | xsantcastx',
    data: {
      description: 'Compress JPEG, PNG and WebP images in your browser for free. No uploads, no sign-up. Batch compress with live quality preview and instant download.',
      keywords: 'free image compressor, compress jpeg online, compress png online, compress webp, browser image optimizer, reduce image size, batch image compression',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Image Compressor',
        url: `${SITE_URL}/tools/image-compressor`,
        description: 'Free browser-based image compressor. Compress JPEG, PNG and WebP images with live quality preview — no uploads, no account required.',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'JPEG, PNG and WebP compression',
          'Live quality slider (1–100)',
          'Output format selector (JPEG / WebP)',
          'Batch compression up to 20 images',
          'Before and after file size comparison',
          'Download individual or all files',
          'No uploads — runs entirely in browser',
          'No account required'
        ],
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'Image Compressor', item: `${SITE_URL}/tools/image-compressor` }
          ]
        }
      }
    }
  },
    {
    path: 'tools/gmail-deliverability-checker',
    component: GmailDeliverabilityCheckerComponent,
    title: 'Gmail Deliverability Checker | xsantcastx',
    data: {
      description: 'Browser-based tool to diagnose Gmail delivery issues and auto-generate SPF, DKIM, DMARC configuration fixes instantly.',
      keywords: 'Gmail deliverability, SPF generator, DKIM, DMARC, email authentication, DNS records',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Gmail Deliverability Checker',
        url: `${SITE_URL}/tools/gmail-deliverability-checker`,
        description: 'Browser-based tool to diagnose Gmail delivery issues and auto-generate SPF, DKIM, DMARC configuration fixes instantly.',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'Gmail Deliverability Checker', item: `${SITE_URL}/tools/gmail-deliverability-checker` }
          ]
        }
      }
    }
  },
  {
    path: 'tools/box-shadow-generator',
    component: BoxShadowGeneratorComponent,
    title: 'CSS Box Shadow Generator — Live Preview | xsantcastx',
    data: {
      description: 'Design beautiful CSS box shadows visually with multiple layers, live preview, and one-click code copy. Free browser-based tool for developers and designers.',
      keywords: 'css box shadow generator, box shadow css, css shadow generator, drop shadow tool, css box shadow examples, shadow generator online, css shadow maker',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'CSS Box Shadow Generator',
        url: `${SITE_URL}/tools/box-shadow-generator`,
        description: 'Design beautiful CSS box shadows visually with multiple layers, live preview, and one-click code copy. Free browser-based tool for developers and designers.',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'CSS Box Shadow Generator', item: `${SITE_URL}/tools/box-shadow-generator` }
          ]
        }
      }
    }
  },
    {
    path: 'tools/email-deliverability-auditor',
    component: EmailDeliverabilityAuditorComponent,
    title: 'Email Deliverability Auditor | xsantcastx',
    data: {
      description: 'Free in-browser SPF, DKIM, DMARC & MX record auditor. Instantly find email deliverability issues and get actionable fix suggestions — no signup required.',
      keywords: 'email deliverability checker, SPF validator, DKIM checker, DMARC auditor, MX record lookup, DNS email configuration',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Email Deliverability Auditor',
        url: `${SITE_URL}/tools/email-deliverability-auditor`,
        description: 'Free in-browser SPF, DKIM, DMARC & MX record auditor. Instantly find email deliverability issues and get actionable fix suggestions — no signup required.',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'Email Deliverability Auditor', item: `${SITE_URL}/tools/email-deliverability-auditor` }
          ]
        }
      }
    }
  },
    {
    path: 'tools/ssl-certificate-inspector',
    component: SslCertificateInspectorComponent,
    title: 'SSL Certificate Inspector & Chain Analyzer | xsantcastx',
    data: {
      description: 'Check SSL/TLS certificates for expiry, weak algorithms, and risky CAs. Visualize the full certificate chain and get actionable security insights in-browser.',
      keywords: 'SSL certificate checker, TLS certificate analyzer, certificate chain visualization, CA reputation audit, HTTPS security tool',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SSL Certificate Inspector',
        url: `${SITE_URL}/tools/ssl-certificate-inspector`,
        description: 'Check SSL/TLS certificates for expiry, weak algorithms, and risky CAs. Visualize the full certificate chain and get actionable security insights in-browser.',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'SSL Certificate Inspector', item: `${SITE_URL}/tools/ssl-certificate-inspector` }
          ]
        }
      }
    }
  },
    {
    path: 'tools/svg-to-code',
    component: SvgToCodeComponent,
    title: 'SVG to Code Converter – React, Vue & Angular | xsantcastx',
    data: {
      description: 'Instantly convert SVG files into production-ready React, Vue, or Angular components with size props, color overrides, and ARIA accessibility attributes.',
      keywords: 'SVG to React component, SVG to Vue, SVG to Angular, SVG code generator, SVG optimizer, accessible SVG component',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SVG to Code Converter',
        url: `${SITE_URL}/tools/svg-to-code`,
        description: 'Instantly convert SVG files into production-ready React, Vue, or Angular components with size props, color overrides, and ARIA accessibility attributes.',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'SVG to Code Converter', item: `${SITE_URL}/tools/svg-to-code` }
          ]
        }
      }
    }
  },
  {
    path: 'live',
    component: LiveComponent,
    title: 'Watch Live Work — AI Mission Control | xsantcastx',
    data: {
      description: 'Watch Claude AI work in real time. A live mission control feed showing tool calls, task progress, and AI activity as it happens.',
      keywords: 'watch ai work live, claude ai real time, ai mission control, live coding stream, ai development feed',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
    }
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }