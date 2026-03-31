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
import { SslCertificateAuditorComponent } from './tools/ssl-certificate-auditor/ssl-certificate-auditor.component';
import { JsonFormatterComponent } from './tools/json-formatter/json-formatter.component';
import { RegexTesterComponent } from './tools/regex-tester/regex-tester.component';
import { Base64EncoderComponent } from './tools/base64-encoder/base64-encoder.component';
import { GradientGeneratorComponent } from './tools/gradient-generator/gradient-generator.component';
import { JwtDecoderComponent } from './tools/jwt-decoder/jwt-decoder.component';
import { UuidGeneratorComponent } from './tools/uuid-generator/uuid-generator.component';
import { HashGeneratorComponent } from './tools/hash-generator/hash-generator.component';
import { MetaTagGeneratorComponent } from './tools/meta-tag-generator/meta-tag-generator.component';
import { EnvValidatorComponent } from './tools/env-validator/env-validator.component';
import { FontPairerComponent } from './tools/font-pairer/font-pairer.component';
import { CronBuilderComponent } from './tools/cron-builder/cron-builder.component';
import { ApiRequestBuilderComponent } from './tools/api-request-builder/api-request-builder.component';
import { JsonToTsComponent } from './tools/json-to-ts/json-to-ts.component';
import { MarkdownEditorComponent } from './tools/markdown-editor/markdown-editor.component';
import { DiffCheckerComponent } from './tools/diff-checker/diff-checker.component';
import { TimestampConverterComponent } from './tools/timestamp-converter/timestamp-converter.component';
import { UrlEncoderComponent } from './tools/url-encoder/url-encoder.component';
import { SqlFormatterComponent } from './tools/sql-formatter/sql-formatter.component';
import { BaseConverterComponent } from './tools/base-converter/base-converter.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { EmbedLandingComponent } from './embed-landing/embed-landing.component';
import { RouteTitles } from './shared/title-strategy.service';
import { SITE_URL } from './seo.service';
import { LiveComponent } from './live/live.component';

const routes: Routes = [
  {
    path: 'home',
    component: LandingComponent,
    title: 'xsantcastx | Full-Stack Developer & Free Browser Tools',
    data: {
      description: 'xsantcastx — Full-Stack Developer building modern web apps and free browser tools. CSS Box Shadow Generator, Email Deliverability Auditor, SSL Inspector, SVG to Code & more. No sign-up.',
      keywords: 'full stack developer, web development, angular, typescript, css box shadow generator, email deliverability checker, ssl certificate checker, svg to react component, free browser tools, pdf generator, color palette',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Person',
            '@id': `${SITE_URL}/#person`,
            name: 'xsantcastx',
            url: SITE_URL,
            jobTitle: 'Full-Stack Developer',
            description: 'Independent developer building web applications and free browser tools for designers and developers.',
            knowsAbout: ['Angular', 'TypeScript', 'Node.js', 'Firebase', 'React', 'Web Development'],
            sameAs: []
          },
          {
            '@type': 'WebPage',
            '@id': `${SITE_URL}/home`,
            url: `${SITE_URL}/home`,
            name: 'xsantcastx | Full-Stack Developer & Free Browser Tools',
            description: 'Portfolio and free browser tools — CSS Box Shadow Generator, Email Deliverability Auditor, SSL Certificate Inspector, SVG to Code, PDF Catalog Generator, Color Palette Extractor and more.',
            author: { '@id': `${SITE_URL}/#person` }
          }
        ]
      }
    }
  },
  {
    path: 'skills',
    component: SkillsComponent,
    title: RouteTitles.skills,
    data: {
      description: 'Technical skills across Angular, React, TypeScript, Node.js, Firebase, and more. Full-stack expertise for modern web and mobile applications.',
      keywords: 'angular, react, typescript, nodejs, firebase, full stack skills, web developer skills',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'WebPage', name: 'Skills — xsantcastx',
        url: `${SITE_URL}/skills`,
        description: 'Technical skills across Angular, React, TypeScript, Node.js, Firebase, and more.',
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
          { '@type': 'ListItem', position: 2, name: 'Skills', item: `${SITE_URL}/skills` }
        ]}
      }
    }
  },
  {
    path: 'projects',
    component: ProjectsComponent,
    title: RouteTitles.projects,
    data: {
      description: 'Portfolio of real-world projects: e-commerce platforms, web applications, and developer tools built with Angular, Firebase, and TypeScript.',
      keywords: 'portfolio, web projects, angular projects, firebase projects, case studies, web applications',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Projects — xsantcastx',
        url: `${SITE_URL}/projects`,
        description: 'Portfolio of real-world projects built with Angular, Firebase, and TypeScript.',
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
          { '@type': 'ListItem', position: 2, name: 'Projects', item: `${SITE_URL}/projects` }
        ]}
      }
    }
  },
  {
    path: 'contact',
    component: ContactComponent,
    title: RouteTitles.contact,
    data: {
      description: 'Get in touch for freelance web development, project collaboration, or consulting. Based in Spain, working globally.',
      keywords: 'hire developer, freelance web development, contact, project consultation',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact — xsantcastx',
        url: `${SITE_URL}/contact`,
        description: 'Get in touch for freelance web development, project collaboration, or consulting.'
      }
    }
  },
  {
    path: 'donate',
    component: DonateComponent,
    title: RouteTitles.donate,
    data: {
      description: 'Support open-source tools and development work. Donate via Stripe, PayPal, or crypto.',
      keywords: 'donate, support developer, open source, sponsorship',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'WebPage', name: 'Donate — xsantcastx',
        url: `${SITE_URL}/donate`,
        description: 'Support open-source tools and development work. Donate via Stripe, PayPal, or crypto.'
      }
    }
  },
  {
    path: 'tools',
    component: ToolsComponent,
    title: 'Free Online Tools for Developers & Designers — No Sign-Up | xsantcastx',
    data: {
      description: 'Free browser tools: CSS Box Shadow Generator, Email Deliverability Auditor, Gmail Checker, SSL Certificate Inspector, SVG to Code, PDF Catalog Generator, Color Palette Extractor & more.',
      keywords: 'free online tools, css box shadow generator, email deliverability checker, gmail deliverability, ssl certificate checker, svg to react component, pdf catalog generator, color palette extractor, wcag contrast checker, image compressor, browser tools, no sign up',
      ogImage: `${SITE_URL}/assets/og/og-tools.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Free Browser Tools for Developers & Designers',
        description: 'Free browser-based tools — CSS Box Shadow Generator, Email Deliverability Auditor, SSL Certificate Inspector, SVG to Code Converter, PDF Catalog Generator, Color Palette Extractor, WCAG Contrast Checker, Image Compressor. No sign-up required.',
        url: `${SITE_URL}/tools`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            item: {
              '@type': 'SoftwareApplication',
              name: 'CSS Box Shadow Generator',
              url: `${SITE_URL}/tools/box-shadow-generator`,
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 2,
            item: {
              '@type': 'SoftwareApplication',
              name: 'Email Deliverability Auditor',
              url: `${SITE_URL}/tools/email-deliverability-auditor`,
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 3,
            item: {
              '@type': 'SoftwareApplication',
              name: 'Gmail Deliverability Checker',
              url: `${SITE_URL}/tools/gmail-deliverability-checker`,
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 4,
            item: {
              '@type': 'SoftwareApplication',
              name: 'SSL Certificate Inspector',
              url: `${SITE_URL}/tools/ssl-certificate-inspector`,
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 5,
            item: {
              '@type': 'SoftwareApplication',
              name: 'SVG to Code Converter',
              url: `${SITE_URL}/tools/svg-to-code`,
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 6,
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
            position: 7,
            item: {
              '@type': 'SoftwareApplication',
              name: 'Color Palette Extractor',
              url: `${SITE_URL}/tools/color-palette`,
              applicationCategory: 'DesignApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 8,
            item: {
              '@type': 'SoftwareApplication',
              name: 'WCAG Contrast Checker',
              url: `${SITE_URL}/tools/contrast-checker`,
              applicationCategory: 'DesignApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 9,
            item: {
              '@type': 'SoftwareApplication',
              name: 'Image Compressor',
              url: `${SITE_URL}/tools/image-compressor`,
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 10,
            item: {
              '@type': 'SoftwareApplication',
              name: 'JSON Formatter & Validator',
              url: `${SITE_URL}/tools/json-formatter`,
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 11,
            item: {
              '@type': 'SoftwareApplication',
              name: 'Base64 Encoder & Decoder',
              url: `${SITE_URL}/tools/base64-encoder`,
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 12,
            item: {
              '@type': 'SoftwareApplication',
              name: 'Regex Tester',
              url: `${SITE_URL}/tools/regex-tester`,
              applicationCategory: 'UtilityApplication',
              operatingSystem: 'Web Browser',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
            }
          },
          {
            '@type': 'ListItem',
            position: 13,
            item: {
              '@type': 'SoftwareApplication',
              name: 'CSS Gradient Generator',
              url: `${SITE_URL}/tools/gradient-generator`,
              applicationCategory: 'UtilityApplication',
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
    title: 'Free Gmail Deliverability Checker — Fix SPF, DKIM & DMARC Issues | xsantcastx',
    data: {
      description: 'Free tool to diagnose why your emails land in Gmail spam. Check SPF, DKIM, DMARC & MX records, get auto-generated DNS fixes, and improve inbox delivery rates instantly.',
      keywords: 'gmail deliverability checker, emails going to spam gmail, fix gmail spam filter, SPF record generator, DKIM checker, DMARC setup, email authentication DNS, inbox delivery tool',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Gmail Deliverability Checker',
        url: `${SITE_URL}/tools/gmail-deliverability-checker`,
        description: 'Free browser-based tool to diagnose Gmail delivery problems. Checks SPF, DKIM, DMARC and MX records, identifies issues, and auto-generates ready-to-copy DNS configuration fixes.',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'SPF record validation and auto-generator',
          'DKIM DNS record checker',
          'DMARC policy analyzer',
          'MX record lookup',
          'Gmail-specific spam filter diagnostics',
          'Ready-to-copy DNS fix suggestions',
          'No account required'
        ],
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
    title: 'Free CSS Box Shadow Generator — Live Preview & Code Copy | xsantcastx',
    data: {
      description: 'Generate CSS box shadows visually with live preview. Add multiple shadow layers, adjust blur, spread, offset and color, then copy the ready-to-use CSS code in one click. Free, no sign-up.',
      keywords: 'css box shadow generator, free box shadow generator, box shadow css tool, css drop shadow generator, multi-layer shadow, css shadow maker online, box shadow examples, css shadow code',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'CSS Box Shadow Generator',
        url: `${SITE_URL}/tools/box-shadow-generator`,
        description: 'Design CSS box shadows visually. Add multiple layers, control blur, spread, offset, color and inset, see a live preview, and copy the finished CSS box-shadow property instantly.',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Multiple shadow layers',
          'Live visual preview',
          'Adjustable blur, spread, X and Y offset',
          'Inset shadow support',
          'RGBA color picker',
          'One-click CSS code copy',
          'No account required'
        ],
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
    path: 'tools/gradient-generator',
    component: GradientGeneratorComponent,
    title: 'Free CSS Gradient Generator — Linear, Radial & Conic | xsantcastx',
    data: {
      description: 'Create beautiful CSS gradients for free. Build linear, radial and conic gradients with a visual editor, live preview and one-click code copy. No sign-up.',
      keywords: 'css gradient generator, linear gradient, radial gradient, conic gradient, css gradient maker, gradient creator online, css background gradient, gradient color picker',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'CSS Gradient Generator',
        url: `${SITE_URL}/tools/gradient-generator`,
        description: 'Free browser-based CSS gradient generator. Create linear, radial and conic gradients visually, add and remove color stops, adjust angles and positions, and copy ready-to-use CSS code instantly.',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Linear, radial and conic gradient types',
          'Visual color stop editor',
          'Angle and position controls',
          'Live gradient preview',
          'Preset gradient library',
          'One-click CSS code copy',
          'No account required'
        ],
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'CSS Gradient Generator', item: `${SITE_URL}/tools/gradient-generator` }
          ]
        }
      }
    }
  },
    {
    path: 'tools/email-deliverability-auditor',
    component: EmailDeliverabilityAuditorComponent,
    title: 'Free Email Deliverability Auditor — Check SPF, DKIM, DMARC & MX Records | xsantcastx',
    data: {
      description: 'Audit your email deliverability for free. Instantly check SPF, DKIM, DMARC and MX DNS records for any domain, find misconfigurations, and get step-by-step fix recommendations. No sign-up.',
      keywords: 'email deliverability auditor, check email deliverability free, SPF record checker, DKIM validator, DMARC record checker, MX record lookup, email DNS audit, fix email going to spam',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Email Deliverability Auditor',
        url: `${SITE_URL}/tools/email-deliverability-auditor`,
        description: 'Free browser-based email deliverability auditor. Enter any domain to check SPF, DKIM, DMARC and MX DNS records, identify misconfigurations, and get actionable fix recommendations instantly.',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'SPF record validation',
          'DKIM DNS record lookup',
          'DMARC policy checker',
          'MX record audit',
          'Actionable fix recommendations',
          'Shareable result URL with ?domain= parameter',
          'No account required'
        ],
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
    title: 'Free SSL Certificate Checker — Inspect TLS Chain & Expiry Online | xsantcastx',
    data: {
      description: 'Check SSL/TLS certificates for free online. Verify expiry dates, detect weak algorithms, inspect the full certificate chain, and audit Certificate Authority reputation — no install needed.',
      keywords: 'ssl certificate checker, free ssl checker online, check ssl certificate expiry, tls certificate analyzer, certificate chain inspector, CA audit tool, https security checker, ssl expiration checker',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SSL Certificate Inspector',
        url: `${SITE_URL}/tools/ssl-certificate-inspector`,
        description: 'Free online SSL/TLS certificate checker. Enter any domain to inspect certificate expiry, cipher strength, full chain visualization, and Certificate Authority reputation — runs in your browser.',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'SSL/TLS certificate expiry checker',
          'Full certificate chain visualization',
          'Weak cipher algorithm detection',
          'Certificate Authority reputation audit',
          'Subject Alternative Names (SAN) inspection',
          'Pre-fill domain via ?domain= URL parameter',
          'No account required'
        ],
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
    title: 'Free SVG to Code Converter — React, Vue & Angular Components | xsantcastx',
    data: {
      description: 'Convert SVG files to React, Vue, or Angular components free online. Generates clean, production-ready code with size props, color overrides, and ARIA accessibility attributes built in.',
      keywords: 'svg to react component, svg to jsx, svg to vue component, svg to angular component, svg code generator online, convert svg to component free, svgr online, svg to typescript component',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SVG to Code Converter',
        url: `${SITE_URL}/tools/svg-to-code`,
        description: 'Free browser-based SVG to component converter. Paste or upload an SVG and instantly get a production-ready React (JSX/TSX), Vue, or Angular component with configurable props and ARIA attributes.',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Convert SVG to React JSX and TSX',
          'Convert SVG to Vue component',
          'Convert SVG to Angular component',
          'Size and color override props',
          'ARIA accessibility attributes',
          'SVG optimization and cleanup',
          'No account required'
        ],
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
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'WebPage', name: 'Watch Live — AI Mission Control',
        url: `${SITE_URL}/live`,
        description: 'Watch Claude AI work in real time. A live mission control feed showing tool calls, task progress, and AI activity.',
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
          { '@type': 'ListItem', position: 2, name: 'Live', item: `${SITE_URL}/live` }
        ]}
      }
    }
  },
    {
    path: 'tools/ssl-certificate-auditor',
    component: SslCertificateAuditorComponent,
    title: 'SSL Certificate Auditor | xsantcastx',
    data: {
      description: 'Quickly audit SSL/TLS certificates, verify root CA ownership, check expiry, and surface security flags—no backend required.',
      keywords: 'SSL certificate checker, root CA analyzer, HTTPS validator, TLS certificate audit',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SSL Certificate Auditor',
        url: `${SITE_URL}/tools/ssl-certificate-auditor`,
        description: 'Quickly audit SSL/TLS certificates, verify root CA ownership, check expiry, and surface security flags—no backend required.',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'SSL Certificate Auditor', item: `${SITE_URL}/tools/ssl-certificate-auditor` }
          ]
        }
      }
    }
  },
  {
    path: 'tools/json-formatter',
    component: JsonFormatterComponent,
    title: 'Free JSON Formatter & Validator — Prettify, Minify & Repair | xsantcastx',
    data: {
      description: 'Format, validate, and minify JSON online for free. Live syntax checking, key sorting, one-click copy and JSON repair. No sign-up required.',
      keywords: 'json formatter online free, json validator, prettify json, minify json, json beautifier, format json, json lint, json repair',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'JSON Formatter & Validator',
        url: `${SITE_URL}/tools/json-formatter`,
        description: 'Free browser-based JSON formatter, validator and minifier. Paste JSON to get live validation, syntax highlighting, key sorting, one-click copy and automatic repair of common errors — no account required.',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Format & prettify JSON with 2 spaces, 4 spaces or tabs',
          'Minify & compress JSON',
          'Live JSON validation with line/column error details',
          'Syntax highlighting',
          'Sort keys alphabetically',
          'Repair mode: fix trailing commas, single quotes, unquoted keys, JS comments',
          'Copy output to clipboard',
          'Download as .json file',
          'Line count and byte size stats',
          'No account required'
        ],
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'JSON Formatter & Validator', item: `${SITE_URL}/tools/json-formatter` }
          ]
        }
      }
    }
  },
  {
    path: 'tools/base64-encoder',
    component: Base64EncoderComponent,
    title: 'Free Base64 Encoder & Decoder Online — Text & File Support | xsantcastx',
    data: {
      description: 'Encode and decode Base64 online for free. Supports text, URL-safe Base64, and file encoding. Live conversion, no sign-up required.',
      keywords: 'base64 encoder online free, base64 decoder, base64 encode text, base64 file encoder, url safe base64',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Base64 Encoder & Decoder',
        url: `${SITE_URL}/tools/base64-encoder`,
        description: 'Free browser-based Base64 encoder and decoder. Encode text or files to Base64, decode Base64 to text, URL-safe mode, live conversion — no account required.',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Any Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Encode text to Base64',
          'Decode Base64 to text',
          'URL-safe Base64 (RFC 4648)',
          'File encode mode — drag & drop any file',
          'Live conversion with 300ms debounce',
          'Unicode / UTF-8 support',
          'Copy output to clipboard',
          'Character count and size stats',
          'No account required'
        ],
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
            { '@type': 'ListItem', position: 2, name: 'Base64 Encoder & Decoder', item: `${SITE_URL}/tools/base64-encoder` }
          ]
        }
      }
    }
  },
  {
    path: 'tools/regex-tester',
    component: RegexTesterComponent,
    title: 'Free Regex Tester Online — Live Match Highlighting & Explanation | xsantcastx',
    data: {
      description: 'Test and debug regular expressions online for free. Live match highlighting, capture groups, flags, and plain-English regex explanations. No sign-up.',
      keywords: 'regex tester online free, regular expression tester, regex match, test regex javascript, regex debugger, regex live preview, capture groups, regex flags',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'SoftwareApplication',
            name: 'Regex Tester',
            url: `${SITE_URL}/tools/regex-tester`,
            description: 'Free browser-based regular expression tester. Enter a pattern, set flags (g, i, m, s, u), and see all matches highlighted live with capture groups, match indices, and a plain-English breakdown of your regex — no account required.',
            applicationCategory: 'UtilityApplication',
            operatingSystem: 'Any Web Browser',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            featureList: [
              'Live match highlighting with 300ms debounce',
              'Regex flags: g, i, m, s, u',
              'Match results with index, value, start/end positions',
              'Capture groups ($1, $2, named groups)',
              'Plain-English regex explanation',
              'Common patterns library: email, URL, phone, IP, date, hex color, ZIP, HTML tag',
              'Copy /pattern/flags to clipboard',
              'Error display for invalid regex',
              'No account required'
            ]
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
              { '@type': 'ListItem', position: 2, name: 'Regex Tester', item: `${SITE_URL}/tools/regex-tester` }
            ]
          }
        ]
      }
    }
  },
  // ── Embed landing page (docs + pricing for embedders) ───────────────────
  {
    path: 'embed',
    component: EmbedLandingComponent,
    title: 'Embed Developer Tools on Your Site — Free Widgets | xsantcastx',
    data: {
      description: 'Embed free developer tools on your blog, docs, or app. JSON Formatter, Base64 Encoder, Regex Tester, and more. One iframe tag, zero setup.',
      keywords: 'embed developer tools, embeddable widgets, iframe tools, json formatter widget, developer tool embed, free embed',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'Embed Developer Tools — xsantcastx',
        description: 'Embed free browser-based developer tools on any website with a single iframe tag.',
        url: `${SITE_URL}/embed`
      }
    }
  },

  // ── New tool routes (batch 2026-03-30) ──────────────────────────────────
  {
    path: 'tools/jwt-decoder',
    component: JwtDecoderComponent,
    title: 'Free JWT Decoder & Debugger — Inspect Tokens Instantly | xsantcastx',
    data: {
      description: 'Decode and inspect JSON Web Tokens for free. View header, payload, claims with human-readable labels, and expiration countdown. Client-side only.',
      keywords: 'jwt decoder, jwt debugger, json web token decoder, jwt inspector, jwt viewer, decode jwt token online free',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        name: 'JWT Decoder & Debugger', url: `${SITE_URL}/tools/jwt-decoder`,
        description: 'Free browser-based JWT decoder. Inspect header, payload, claims and expiration status instantly.',
        applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
          { '@type': 'ListItem', position: 2, name: 'JWT Decoder', item: `${SITE_URL}/tools/jwt-decoder` }
        ]}
      }
    }
  },
  {
    path: 'tools/uuid-generator',
    component: UuidGeneratorComponent,
    title: 'Free UUID/GUID Generator — v1, v4 & ULID | xsantcastx',
    data: {
      description: 'Generate UUID v1, v4, and ULID identifiers for free. Bulk generation, format options, and UUID validator. Client-side only.',
      keywords: 'uuid generator, guid generator, uuid v4, uuid v1, ulid generator, bulk uuid, uuid validator, random uuid online',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        name: 'UUID/GUID Generator', url: `${SITE_URL}/tools/uuid-generator`,
        description: 'Free browser-based UUID generator. Create v1, v4 and ULID identifiers with bulk mode and validation.',
        applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
          { '@type': 'ListItem', position: 2, name: 'UUID Generator', item: `${SITE_URL}/tools/uuid-generator` }
        ]}
      }
    }
  },
  {
    path: 'tools/hash-generator',
    component: HashGeneratorComponent,
    title: 'Free Hash Generator — MD5, SHA-256, SHA-512 | xsantcastx',
    data: {
      description: 'Generate MD5, SHA-1, SHA-256, SHA-384, SHA-512 hashes from text or files for free. Compare hashes and drag-drop file support. Client-side only.',
      keywords: 'hash generator, md5 hash, sha256 hash, sha512 hash, file hash generator, hash comparison tool, online hash calculator',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        name: 'Hash Generator', url: `${SITE_URL}/tools/hash-generator`,
        description: 'Free browser-based hash generator. Create MD5, SHA-1, SHA-256, SHA-384, SHA-512 hashes from text or files.',
        applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
          { '@type': 'ListItem', position: 2, name: 'Hash Generator', item: `${SITE_URL}/tools/hash-generator` }
        ]}
      }
    }
  },
  {
    path: 'tools/meta-tag-generator',
    component: MetaTagGeneratorComponent,
    title: 'Free Open Graph & Meta Tag Generator — SEO & Social Cards | xsantcastx',
    data: {
      description: 'Generate Open Graph, Twitter Card, and SEO meta tags for free. Live social preview mockups for Facebook, Twitter, LinkedIn. One-click HTML copy.',
      keywords: 'meta tag generator, open graph generator, twitter card generator, seo meta tags, og tags, social media preview, meta description generator',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        name: 'Open Graph & Meta Tag Generator', url: `${SITE_URL}/tools/meta-tag-generator`,
        description: 'Free browser-based meta tag generator with live social preview mockups for Facebook, Twitter and LinkedIn.',
        applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
          { '@type': 'ListItem', position: 2, name: 'Meta Tag Generator', item: `${SITE_URL}/tools/meta-tag-generator` }
        ]}
      }
    }
  },
  {
    path: 'tools/env-validator',
    component: EnvValidatorComponent,
    title: 'Free .env File Validator & Secret Scanner | xsantcastx',
    data: {
      description: 'Validate .env file syntax and scan for exposed API keys, tokens, and secrets for free. Export sanitized .env.example files. Client-side only.',
      keywords: 'env file validator, secret scanner, env syntax checker, api key scanner, dotenv validator, env file linter, secret detection',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        name: '.env File Validator & Secret Scanner', url: `${SITE_URL}/tools/env-validator`,
        description: 'Free browser-based .env file validator and secret scanner. Detect exposed API keys, tokens and passwords.',
        applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
          { '@type': 'ListItem', position: 2, name: '.env Validator', item: `${SITE_URL}/tools/env-validator` }
        ]}
      }
    }
  },
  {
    path: 'tools/font-pairer',
    component: FontPairerComponent,
    title: 'Free Font Pairer — Google Font Combinations with Live Preview | xsantcastx',
    data: {
      description: 'Find beautiful Google Font pairings for free. 18 curated heading + body combinations with live preview, category filters, and CSS export.',
      keywords: 'font pairer, google fonts pairing, font combination tool, typography pairing, heading body font pair, font matcher, web font pairing',
      ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        name: 'Font Pairer', url: `${SITE_URL}/tools/font-pairer`,
        description: 'Free browser-based font pairing tool. Browse 18 curated Google Font combinations with live preview and CSS export.',
        applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` },
          { '@type': 'ListItem', position: 2, name: 'Font Pairer', item: `${SITE_URL}/tools/font-pairer` }
        ]}
      }
    }
  },

  // ── Batch 3 tool routes (2026-03-31) ────────────────────────────────────
  { path: 'tools/cron-builder', component: CronBuilderComponent, title: 'Free Cron Expression Builder — Visual Schedule Creator | xsantcastx', data: { description: 'Build cron schedules visually with human-readable descriptions and next-run preview. No sign-up.', keywords: 'cron expression builder, cron generator, cron schedule, crontab maker, visual cron editor', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Cron Expression Builder', url: `${SITE_URL}/tools/cron-builder`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Cron Builder', item: `${SITE_URL}/tools/cron-builder` }] } } } },
  { path: 'tools/api-request-builder', component: ApiRequestBuilderComponent, title: 'Free API Request Builder — Test HTTP Endpoints | xsantcastx', data: { description: 'Build and test HTTP requests in the browser. A lightweight Postman alternative with headers, body editor, and response viewer.', keywords: 'api request builder, http tester, rest client online, postman alternative, api testing tool free', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'API Request Builder', url: `${SITE_URL}/tools/api-request-builder`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'API Request Builder', item: `${SITE_URL}/tools/api-request-builder` }] } } } },
  { path: 'tools/json-to-ts', component: JsonToTsComponent, title: 'Free JSON to TypeScript Converter — Generate Interfaces | xsantcastx', data: { description: 'Convert JSON to TypeScript interfaces with nested object, array, and union type support. Client-side only.', keywords: 'json to typescript, json to interface, typescript generator, json converter, type generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JSON to TypeScript', url: `${SITE_URL}/tools/json-to-ts`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'JSON to TypeScript', item: `${SITE_URL}/tools/json-to-ts` }] } } } },
  { path: 'tools/markdown-editor', component: MarkdownEditorComponent, title: 'Free Markdown Editor & Preview — GFM Support | xsantcastx', data: { description: 'Write and preview GitHub Flavored Markdown with live rendering, formatting toolbar, and HTML export.', keywords: 'markdown editor, markdown preview, gfm editor, markdown to html, live markdown editor online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Markdown Editor & Preview', url: `${SITE_URL}/tools/markdown-editor`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Markdown Editor', item: `${SITE_URL}/tools/markdown-editor` }] } } } },
  { path: 'tools/diff-checker', component: DiffCheckerComponent, title: 'Free Text Diff Checker — Side-by-Side Comparison | xsantcastx', data: { description: 'Compare two texts side-by-side with color-coded additions, deletions, and changes. Unified diff view available.', keywords: 'diff checker, text compare, code diff, side by side comparison, diff tool online free', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Text Diff Checker', url: `${SITE_URL}/tools/diff-checker`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Diff Checker', item: `${SITE_URL}/tools/diff-checker` }] } } } },
  { path: 'tools/timestamp-converter', component: TimestampConverterComponent, title: 'Free Unix Timestamp Converter — Epoch to Date | xsantcastx', data: { description: 'Convert between Unix timestamps and human-readable dates with timezone support and live clock.', keywords: 'unix timestamp converter, epoch converter, timestamp to date, date to timestamp, unix time', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Unix Timestamp Converter', url: `${SITE_URL}/tools/timestamp-converter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Timestamp Converter', item: `${SITE_URL}/tools/timestamp-converter` }] } } } },
  { path: 'tools/url-encoder', component: UrlEncoderComponent, title: 'Free URL Encoder / Decoder — Percent-Encoding Tool | xsantcastx', data: { description: 'Encode and decode URLs and query parameters with a built-in URL parser and query string builder.', keywords: 'url encoder, url decoder, percent encoding, urlencode online, query string builder', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'URL Encoder / Decoder', url: `${SITE_URL}/tools/url-encoder`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'URL Encoder', item: `${SITE_URL}/tools/url-encoder` }] } } } },
  { path: 'tools/sql-formatter', component: SqlFormatterComponent, title: 'Free SQL Formatter & Beautifier — Format Queries | xsantcastx', data: { description: 'Format and beautify SQL queries with syntax highlighting, dialect support, and minify mode.', keywords: 'sql formatter, sql beautifier, format sql online, sql pretty print, sql indenter', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'SQL Formatter & Beautifier', url: `${SITE_URL}/tools/sql-formatter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'SQL Formatter', item: `${SITE_URL}/tools/sql-formatter` }] } } } },
  { path: 'tools/base-converter', component: BaseConverterComponent, title: 'Free Number Base Converter — Binary, Hex, Octal, Decimal | xsantcastx', data: { description: 'Convert numbers between binary, octal, decimal, and hexadecimal instantly with bit visualization.', keywords: 'number base converter, binary to decimal, hex converter, octal converter, base conversion tool', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Number Base Converter', url: `${SITE_URL}/tools/base-converter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Base Converter', item: `${SITE_URL}/tools/base-converter` }] } } } },

  // ── Embed routes (minimal chrome, iframe-friendly) ──────────────────────
  { path: 'embed/json-formatter', component: JsonFormatterComponent, data: { embed: true } },
  { path: 'embed/base64-encoder', component: Base64EncoderComponent, data: { embed: true } },
  { path: 'embed/regex-tester', component: RegexTesterComponent, data: { embed: true } },
  { path: 'embed/box-shadow-generator', component: BoxShadowGeneratorComponent, data: { embed: true } },
  { path: 'embed/color-palette', component: ColorPaletteComponent, data: { embed: true } },
  { path: 'embed/contrast-checker', component: ContrastCheckerComponent, data: { embed: true } },
  { path: 'embed/image-compressor', component: ImageCompressorComponent, data: { embed: true } },
  { path: 'embed/pdf-generator', component: PdfGeneratorComponent, data: { embed: true } },
  { path: 'embed/gmail-deliverability-checker', component: GmailDeliverabilityCheckerComponent, data: { embed: true } },
  { path: 'embed/email-deliverability-auditor', component: EmailDeliverabilityAuditorComponent, data: { embed: true } },
  { path: 'embed/ssl-certificate-inspector', component: SslCertificateInspectorComponent, data: { embed: true } },
  { path: 'embed/ssl-certificate-auditor', component: SslCertificateAuditorComponent, data: { embed: true } },
  { path: 'embed/svg-to-code', component: SvgToCodeComponent, data: { embed: true } },
  { path: 'embed/gradient-generator', component: GradientGeneratorComponent, data: { embed: true } },
  { path: 'embed/jwt-decoder', component: JwtDecoderComponent, data: { embed: true } },
  { path: 'embed/uuid-generator', component: UuidGeneratorComponent, data: { embed: true } },
  { path: 'embed/hash-generator', component: HashGeneratorComponent, data: { embed: true } },
  { path: 'embed/meta-tag-generator', component: MetaTagGeneratorComponent, data: { embed: true } },
  { path: 'embed/env-validator', component: EnvValidatorComponent, data: { embed: true } },
  { path: 'embed/font-pairer', component: FontPairerComponent, data: { embed: true } },
  { path: 'embed/cron-builder', component: CronBuilderComponent, data: { embed: true } },
  { path: 'embed/api-request-builder', component: ApiRequestBuilderComponent, data: { embed: true } },
  { path: 'embed/json-to-ts', component: JsonToTsComponent, data: { embed: true } },
  { path: 'embed/markdown-editor', component: MarkdownEditorComponent, data: { embed: true } },
  { path: 'embed/diff-checker', component: DiffCheckerComponent, data: { embed: true } },
  { path: 'embed/timestamp-converter', component: TimestampConverterComponent, data: { embed: true } },
  { path: 'embed/url-encoder', component: UrlEncoderComponent, data: { embed: true } },
  { path: 'embed/sql-formatter', component: SqlFormatterComponent, data: { embed: true } },
  { path: 'embed/base-converter', component: BaseConverterComponent, data: { embed: true } },

  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
    path: '**',
    component: NotFoundComponent,
    title: '404 — Page Not Found | xsantcastx',
    data: {
      description: 'The page you are looking for does not exist. Browse free developer tools or return to the homepage.',
      keywords: '404, page not found, xsantcastx'
    }
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }