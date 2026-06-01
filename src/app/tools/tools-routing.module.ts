import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SITE_URL } from '../seo.service';
import { AnimationGeneratorComponent } from './animation-generator/animation-generator.component';
import { ApcaContrastComponent } from './apca-contrast/apca-contrast.component';
import { ApiRequestBuilderComponent } from './api-request-builder/api-request-builder.component';
import { AsciiArtComponent } from './ascii-art/ascii-art.component';
import { AspectRatioComponent } from './aspect-ratio/aspect-ratio.component';
import { Base64EncoderComponent } from './base64-encoder/base64-encoder.component';
import { BaseConverterComponent } from './base-converter/base-converter.component';
import { BinaryTextComponent } from './binary-text/binary-text.component';
import { BorderRadiusComponent } from './border-radius/border-radius.component';
import { BoxModelComponent } from './box-model/box-model.component';
import { BoxShadowGeneratorComponent } from './box-shadow-generator/box-shadow-generator.component';
import { ButtonGeneratorComponent } from './button-generator/button-generator.component';
import { CaesarCipherComponent } from './caesar-cipher/caesar-cipher.component';
import { CaseConverterComponent } from './case-converter/case-converter.component';
import { CharMapComponent } from './char-map/char-map.component';
import { ChecklistComponent } from './checklist/checklist.component';
import { ChmodCalculatorComponent } from './chmod-calculator/chmod-calculator.component';
import { ClipPathComponent } from './clip-path/clip-path.component';
import { ColorBlindnessComponent } from './color-blindness/color-blindness.component';
import { ColorConverterComponent } from './color-converter/color-converter.component';
import { ColorNameComponent } from './color-name/color-name.component';
import { ColorPaletteComponent } from './color-palette/color-palette.component';
import { ColorPickerComponent } from './color-picker/color-picker.component';
import { ColorShadesComponent } from './color-shades/color-shades.component';
import { ContrastCheckerComponent } from './contrast-checker/contrast-checker.component';
import { CountdownComponent } from './countdown/countdown.component';
import { CronBuilderComponent } from './cron-builder/cron-builder.component';
import { CrontabRefComponent } from './crontab-ref/crontab-ref.component';
import { CssFilterComponent } from './css-filter/css-filter.component';
import { CssMinifierComponent } from './css-minifier/css-minifier.component';
import { CssUnitsComponent } from './css-units/css-units.component';
import { CssVariablesComponent } from './css-variables/css-variables.component';
import { CsvJsonComponent } from './csv-json/csv-json.component';
import { DataSizeComponent } from './data-size/data-size.component';
import { DesignTokensComponent } from './design-tokens/design-tokens.component';
import { DiffCheckerComponent } from './diff-checker/diff-checker.component';
import { DnsLookupComponent } from './dns-lookup/dns-lookup.component';
import { DockerRefComponent } from './docker-ref/docker-ref.component';
import { EmailDeliverabilityAuditorComponent } from './email-deliverability-auditor/email-deliverability-auditor.component';
import { EmojiPickerComponent } from './emoji-picker/emoji-picker.component';
import { EncodingConverterComponent } from './encoding-converter/encoding-converter.component';
import { EnvValidatorComponent } from './env-validator/env-validator.component';
import { FaviconGeneratorComponent } from './favicon-generator/favicon-generator.component';
import { FlexboxGeneratorComponent } from './flexbox-generator/flexbox-generator.component';
import { FontPairerComponent } from './font-pairer/font-pairer.component';
import { GitReferenceComponent } from './git-reference/git-reference.component';
import { GitignoreGeneratorComponent } from './gitignore-generator/gitignore-generator.component';
import { GmailDeliverabilityCheckerComponent } from './gmail-deliverability-checker/gmail-deliverability-checker.component';
import { GradientGeneratorComponent } from './gradient-generator/gradient-generator.component';
import { GradientTextComponent } from './gradient-text/gradient-text.component';
import { GridGeneratorComponent } from './grid-generator/grid-generator.component';
import { GroceryManagerComponent } from './grocery-manager/grocery-manager.component';
import { HashGeneratorComponent } from './hash-generator/hash-generator.component';
import { HeadingCheckerComponent } from './heading-checker/heading-checker.component';
import { HexEditorComponent } from './hex-editor/hex-editor.component';
import { HmacGeneratorComponent } from './hmac-generator/hmac-generator.component';
import { HtmlEntitiesComponent } from './html-entities/html-entities.component';
import { HtmlMinifierComponent } from './html-minifier/html-minifier.component';
import { HtmlToMdComponent } from './html-to-md/html-to-md.component';
import { HttpStatusComponent } from './http-status/http-status.component';
import { ImageCompressorComponent } from './image-compressor/image-compressor.component';
import { ImageResizerComponent } from './image-resizer/image-resizer.component';
import { IpLookupComponent } from './ip-lookup/ip-lookup.component';
import { JsMinifierComponent } from './js-minifier/js-minifier.component';
import { JsonDiffComponent } from './json-diff/json-diff.component';
import { JsonEscapeComponent } from './json-escape/json-escape.component';
import { JsonFormatterComponent } from './json-formatter/json-formatter.component';
import { JsonMinifierComponent } from './json-minifier/json-minifier.component';
import { JsonPathComponent } from './json-path/json-path.component';
import { JsonSchemaComponent } from './json-schema/json-schema.component';
import { JsonToTsComponent } from './json-to-ts/json-to-ts.component';
import { JsonTreeComponent } from './json-tree/json-tree.component';
import { JwtCheatsheetComponent } from './jwt-cheatsheet/jwt-cheatsheet.component';
import { JwtDecoderComponent } from './jwt-decoder/jwt-decoder.component';
import { JwtGeneratorComponent } from './jwt-generator/jwt-generator.component';
import { KeyboardShortcutsComponent } from './keyboard-shortcuts/keyboard-shortcuts.component';
import { LicensePickerComponent } from './license-picker/license-picker.component';
import { LinesorterComponent } from './line-sorter/line-sorter.component';
import { LoremGeneratorComponent } from './lorem-generator/lorem-generator.component';
import { MarkdownEditorComponent } from './markdown-editor/markdown-editor.component';
import { MdTableGeneratorComponent } from './md-table-generator/md-table-generator.component';
import { MediaQueryComponent } from './media-query/media-query.component';
import { MetaTagGeneratorComponent } from './meta-tag-generator/meta-tag-generator.component';
import { MimeLookupComponent } from './mime-lookup/mime-lookup.component';
import { MockDataComponent } from './mock-data/mock-data.component';
import { MorseCodeComponent } from './morse-code/morse-code.component';
import { NpmSearchComponent } from './npm-search/npm-search.component';
import { OgImagePreviewComponent } from './og-image-preview/og-image-preview.component';
import { PackageJsonComponent } from './package-json/package-json.component';
import { PasswordGeneratorComponent } from './password-generator/password-generator.component';
import { PdfGeneratorComponent } from './pdf-generator/pdf-generator.component';
import { PlaceholderImageComponent } from './placeholder-image/placeholder-image.component';
import { PomodoroComponent } from './pomodoro/pomodoro.component';
import { ProgressBarComponent } from './progress-bar/progress-bar.component';
import { QrGeneratorComponent } from './qr-generator/qr-generator.component';
import { RegexCheatsheetComponent } from './regex-cheatsheet/regex-cheatsheet.component';
import { RegexGeneratorComponent } from './regex-generator/regex-generator.component';
import { RegexTesterComponent } from './regex-tester/regex-tester.component';
import { ResponsivePreviewComponent } from './responsive-preview/responsive-preview.component';
import { RobotsGeneratorComponent } from './robots-generator/robots-generator.component';
import { ScreenInfoComponent } from './screen-info/screen-info.component';
import { ScrollSnapComponent } from './scroll-snap/scroll-snap.component';
import { SeoCheckerComponent } from './seo-checker/seo-checker.component';
import { SitemapGeneratorComponent } from './sitemap-generator/sitemap-generator.component';
import { SlugGeneratorComponent } from './slug-generator/slug-generator.component';
import { SnippetManagerComponent } from './snippet-manager/snippet-manager.component';
import { SpacingScaleComponent } from './spacing-scale/spacing-scale.component';
import { SqlFormatterComponent } from './sql-formatter/sql-formatter.component';
import { SslCertificateAuditorComponent } from './ssl-certificate-auditor/ssl-certificate-auditor.component';
import { SslCertificateInspectorComponent } from './ssl-certificate-inspector/ssl-certificate-inspector.component';
import { StringRepeaterComponent } from './string-repeater/string-repeater.component';
import { SvgPathEditorComponent } from './svg-path-editor/svg-path-editor.component';
import { SvgToCodeComponent } from './svg-to-code/svg-to-code.component';
import { TailwindLookupComponent } from './tailwind-lookup/tailwind-lookup.component';
import { TextCounterComponent } from './text-counter/text-counter.component';
import { TextShadowComponent } from './text-shadow/text-shadow.component';
import { TimestampConverterComponent } from './timestamp-converter/timestamp-converter.component';
import { TimezoneConverterComponent } from './timezone-converter/timezone-converter.component';
import { ToolsComponent } from './tools.component';
import { TransformPlaygroundComponent } from './transform-playground/transform-playground.component';
import { TransitionGeneratorComponent } from './transition-generator/transition-generator.component';
import { TsPlaygroundComponent } from './ts-playground/ts-playground.component';
import { UaParserComponent } from './ua-parser/ua-parser.component';
import { UrlEncoderComponent } from './url-encoder/url-encoder.component';
import { UuidGeneratorComponent } from './uuid-generator/uuid-generator.component';
import { WebhookTesterComponent } from './webhook-tester/webhook-tester.component';
import { YamlJsonComponent } from './yaml-json/yaml-json.component';

const routes: Routes = [
  {
      path: '',
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
      path: 'pdf-generator',
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
      path: 'color-palette',
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
      path: 'contrast-checker',
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
      path: 'image-compressor',
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
      path: 'gmail-deliverability-checker',
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
      path: 'box-shadow-generator',
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
      path: 'gradient-generator',
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
      path: 'email-deliverability-auditor',
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
      path: 'ssl-certificate-inspector',
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
      path: 'svg-to-code',
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
      path: 'ssl-certificate-auditor',
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
      path: 'json-formatter',
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
      path: 'base64-encoder',
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
      path: 'regex-tester',
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
  {
      path: 'jwt-decoder',
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
      path: 'uuid-generator',
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
      path: 'hash-generator',
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
      path: 'meta-tag-generator',
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
      path: 'env-validator',
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
      path: 'font-pairer',
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
  { path: 'cron-builder', component: CronBuilderComponent, title: 'Free Cron Expression Builder — Visual Schedule Creator | xsantcastx', data: { description: 'Build cron schedules visually with human-readable descriptions and next-run preview. No sign-up.', keywords: 'cron expression builder, cron generator, cron schedule, crontab maker, visual cron editor', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Cron Expression Builder', url: `${SITE_URL}/tools/cron-builder`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Cron Builder', item: `${SITE_URL}/tools/cron-builder` }] } } } },
  { path: 'api-request-builder', component: ApiRequestBuilderComponent, title: 'Free API Request Builder — Test HTTP Endpoints | xsantcastx', data: { description: 'Build and test HTTP requests in the browser. A lightweight Postman alternative with headers, body editor, and response viewer.', keywords: 'api request builder, http tester, rest client online, postman alternative, api testing tool free', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'API Request Builder', url: `${SITE_URL}/tools/api-request-builder`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'API Request Builder', item: `${SITE_URL}/tools/api-request-builder` }] } } } },
  { path: 'json-to-ts', component: JsonToTsComponent, title: 'Free JSON to TypeScript Converter — Generate Interfaces | xsantcastx', data: { description: 'Convert JSON to TypeScript interfaces with nested object, array, and union type support. Client-side only.', keywords: 'json to typescript, json to interface, typescript generator, json converter, type generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JSON to TypeScript', url: `${SITE_URL}/tools/json-to-ts`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'JSON to TypeScript', item: `${SITE_URL}/tools/json-to-ts` }] } } } },
  { path: 'markdown-editor', component: MarkdownEditorComponent, title: 'Free Markdown Editor & Preview — GFM Support | xsantcastx', data: { description: 'Write and preview GitHub Flavored Markdown with live rendering, formatting toolbar, and HTML export.', keywords: 'markdown editor, markdown preview, gfm editor, markdown to html, live markdown editor online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Markdown Editor & Preview', url: `${SITE_URL}/tools/markdown-editor`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Markdown Editor', item: `${SITE_URL}/tools/markdown-editor` }] } } } },
  { path: 'diff-checker', component: DiffCheckerComponent, title: 'Free Text Diff Checker — Side-by-Side Comparison | xsantcastx', data: { description: 'Compare two texts side-by-side with color-coded additions, deletions, and changes. Unified diff view available.', keywords: 'diff checker, text compare, code diff, side by side comparison, diff tool online free', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Text Diff Checker', url: `${SITE_URL}/tools/diff-checker`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Diff Checker', item: `${SITE_URL}/tools/diff-checker` }] } } } },
  { path: 'timestamp-converter', component: TimestampConverterComponent, title: 'Free Unix Timestamp Converter — Epoch to Date | xsantcastx', data: { description: 'Convert between Unix timestamps and human-readable dates with timezone support and live clock.', keywords: 'unix timestamp converter, epoch converter, timestamp to date, date to timestamp, unix time', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Unix Timestamp Converter', url: `${SITE_URL}/tools/timestamp-converter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Timestamp Converter', item: `${SITE_URL}/tools/timestamp-converter` }] } } } },
  { path: 'url-encoder', component: UrlEncoderComponent, title: 'Free URL Encoder / Decoder — Percent-Encoding Tool | xsantcastx', data: { description: 'Encode and decode URLs and query parameters with a built-in URL parser and query string builder.', keywords: 'url encoder, url decoder, percent encoding, urlencode online, query string builder', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'URL Encoder / Decoder', url: `${SITE_URL}/tools/url-encoder`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'URL Encoder', item: `${SITE_URL}/tools/url-encoder` }] } } } },
  { path: 'sql-formatter', component: SqlFormatterComponent, title: 'Free SQL Formatter & Beautifier — Format Queries | xsantcastx', data: { description: 'Format and beautify SQL queries with syntax highlighting, dialect support, and minify mode.', keywords: 'sql formatter, sql beautifier, format sql online, sql pretty print, sql indenter', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'SQL Formatter & Beautifier', url: `${SITE_URL}/tools/sql-formatter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'SQL Formatter', item: `${SITE_URL}/tools/sql-formatter` }] } } } },
  { path: 'base-converter', component: BaseConverterComponent, title: 'Free Number Base Converter — Binary, Hex, Octal, Decimal | xsantcastx', data: { description: 'Convert numbers between binary, octal, decimal, and hexadecimal instantly with bit visualization.', keywords: 'number base converter, binary to decimal, hex converter, octal converter, base conversion tool', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Number Base Converter', url: `${SITE_URL}/tools/base-converter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Base Converter', item: `${SITE_URL}/tools/base-converter` }] } } } },
  { path: 'password-generator', component: PasswordGeneratorComponent, title: 'Free Secure String Generator | xsantcastx', data: { description: 'Generate cryptographically secure random strings and passphrases with strength analysis.', keywords: 'secure string generator, random string, passphrase generator, crypto random, string generator online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Secure String Generator', url: `${SITE_URL}/tools/password-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'qr-generator', component: QrGeneratorComponent, title: 'Free QR Code Generator | xsantcastx', data: { description: 'Generate QR codes from text, URLs, email, WiFi, or vCard with custom colors and download.', keywords: 'qr code generator, qr maker, create qr code free, qr code online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'QR Code Generator', url: `${SITE_URL}/tools/qr-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'lorem-generator', component: LoremGeneratorComponent, title: 'Free Lorem Ipsum Generator | xsantcastx', data: { description: 'Generate placeholder text in classic, hipster, or tech variants.', keywords: 'lorem ipsum generator, placeholder text, dummy text generator, lipsum', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Lorem Ipsum Generator', url: `${SITE_URL}/tools/lorem-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'color-converter', component: ColorConverterComponent, title: 'Free Color Converter — HEX RGB HSL CMYK | xsantcastx', data: { description: 'Convert colors between HEX, RGB, HSL, HSB, and CMYK with harmonies and tints/shades.', keywords: 'color converter, hex to rgb, rgb to hsl, color picker, cmyk converter', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Color Converter', url: `${SITE_URL}/tools/color-converter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'case-converter', component: CaseConverterComponent, title: 'Free Text Case Converter — 12 Formats | xsantcastx', data: { description: 'Convert text between 12 case formats: camelCase, snake_case, kebab-case, PascalCase, and more.', keywords: 'text case converter, camelcase converter, snake case, kebab case, pascal case', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Text Case Converter', url: `${SITE_URL}/tools/case-converter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'flexbox-generator', component: FlexboxGeneratorComponent, title: 'Free CSS Flexbox Generator — Visual Playground | xsantcastx', data: { description: 'Visual flexbox playground with container and item controls, layout presets, and live CSS output.', keywords: 'flexbox generator, css flexbox playground, flex layout builder, flexbox visual editor', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Flexbox Generator', url: `${SITE_URL}/tools/flexbox-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'chmod-calculator', component: ChmodCalculatorComponent, title: 'Free Chmod Calculator — Unix Permissions | xsantcastx', data: { description: 'Interactive Unix permission calculator with checkbox matrix, symbolic notation, and umask support.', keywords: 'chmod calculator, unix permissions, file permissions calculator, chmod 755, chmod 644', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Chmod Calculator', url: `${SITE_URL}/tools/chmod-calculator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'html-entities', component: HtmlEntitiesComponent, title: 'Free HTML Entity Encoder / Decoder | xsantcastx', data: { description: 'Encode and decode HTML entities with a searchable reference table of 70+ common entities.', keywords: 'html entity encoder, html entity decoder, html special characters, html entities list', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'HTML Entity Encoder / Decoder', url: `${SITE_URL}/tools/html-entities`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'json-path', component: JsonPathComponent, title: 'Free JSON Path Finder — Interactive Explorer | xsantcastx', data: { description: 'Explore JSON as an interactive tree and click any node to get its full path.', keywords: 'json path finder, json explorer, json tree viewer, jsonpath, json navigator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JSON Path Finder', url: `${SITE_URL}/tools/json-path`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'css-units', component: CssUnitsComponent, title: 'Free CSS Units Converter — px rem em vw | xsantcastx', data: { description: 'Convert between px, rem, em, %, vw, vh, pt, cm, mm, and in with spacing scale.', keywords: 'css units converter, px to rem, rem to px, em converter, viewport units', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Units Converter', url: `${SITE_URL}/tools/css-units`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'aspect-ratio', component: AspectRatioComponent, title: 'Free Aspect Ratio Calculator | xsantcastx', data: { description: 'Calculate and visualize aspect ratios with social media presets and CSS output.', keywords: 'aspect ratio calculator, screen ratio, 16 9 calculator, image ratio, social media sizes', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Aspect Ratio Calculator', url: `${SITE_URL}/tools/aspect-ratio`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'css-minifier', component: CssMinifierComponent, title: 'Free CSS Minifier & Beautifier | xsantcastx', data: { description: 'Minify or beautify CSS with syntax highlighting and compression stats.', keywords: 'css minifier, css beautifier, minify css online, css formatter, compress css', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Minifier & Beautifier', url: `${SITE_URL}/tools/css-minifier`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'http-status', component: HttpStatusComponent, title: 'HTTP Status Code Reference — All Codes Explained | xsantcastx', data: { description: 'Searchable reference of all HTTP status codes with categories, descriptions, and use cases.', keywords: 'http status codes, http status reference, 404 meaning, 200 ok, 500 error, status code list', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'HTTP Status Code Reference', url: `${SITE_URL}/tools/http-status`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'border-radius', component: BorderRadiusComponent, title: 'Free CSS Border Radius Generator | xsantcastx', data: { description: 'Visual border-radius editor with individual corner controls, blob shapes, and presets.', keywords: 'border radius generator, css border radius, rounded corners, blob shape generator, css border radius tool', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Border Radius Generator', url: `${SITE_URL}/tools/border-radius`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'emoji-picker', component: EmojiPickerComponent, title: 'Free Emoji Picker & Search | xsantcastx', data: { description: 'Search 500+ emojis by name, copy as emoji, HTML entity, or Unicode codepoint.', keywords: 'emoji picker, emoji search, copy emoji, emoji unicode, html emoji, emoji list', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Emoji Picker & Search', url: `${SITE_URL}/tools/emoji-picker`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'ip-lookup', component: IpLookupComponent, title: 'Free IP Address Lookup & Subnet Calculator | xsantcastx', data: { description: 'Detect your public IP, validate IPv4/IPv6 addresses, and calculate subnets.', keywords: 'ip lookup, my ip address, subnet calculator, ipv4 ipv6 validator, cidr calculator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'IP Address Lookup', url: `${SITE_URL}/tools/ip-lookup`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'grocery-manager', component: GroceryManagerComponent, title: 'Free Grocery Manager — Restock Reminders & Bill Estimate | xsantcastx', data: { description: 'Track the staples you always buy, get restock reminders based on the last time you bought each item, and estimate your shopping bill by region. Bilingual EN/ES. Saved in your browser, no sign-up.', keywords: 'grocery manager, shopping list app, grocery tracker, restock reminder, grocery budget estimate, recurring shopping list, pantry tracker, bilingual grocery list', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Grocery Manager', url: `${SITE_URL}/tools/grocery-manager`, applicationCategory: 'LifestyleApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Restock reminders', 'Bilingual EN/ES', 'Bill estimate by region', 'Saved in your browser'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Grocery Manager', item: `${SITE_URL}/tools/grocery-manager` }] } } } },
  { path: 'grid-generator', component: GridGeneratorComponent, title: 'Free CSS Grid Generator — Visual Layout Builder | xsantcastx', data: { description: 'Visual CSS Grid playground with template areas, item controls, and layout presets.', keywords: 'css grid generator, grid layout builder, css grid playground, grid template generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Grid Generator', url: `${SITE_URL}/tools/grid-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'yaml-json', component: YamlJsonComponent, title: 'Free YAML to JSON Converter | xsantcastx', data: { description: 'Convert between YAML and JSON bidirectionally with no dependencies.', keywords: 'yaml to json, json to yaml, yaml converter, yaml parser online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'YAML to JSON Converter', url: `${SITE_URL}/tools/yaml-json`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'jwt-generator', component: JwtGeneratorComponent, title: 'Free JWT Generator & Builder — Sign Tokens | xsantcastx', data: { description: 'Build and sign JWT tokens with custom claims and HMAC via Web Crypto.', keywords: 'jwt generator, jwt builder, create jwt token, jwt signer, hmac jwt', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JWT Generator', url: `${SITE_URL}/tools/jwt-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'tailwind-lookup', component: TailwindLookupComponent, title: 'Free Tailwind CSS Class Lookup | xsantcastx', data: { description: 'Searchable reference of 300+ Tailwind utility classes with CSS equivalents.', keywords: 'tailwind css lookup, tailwind classes, tailwind reference, tailwind to css', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Tailwind CSS Lookup', url: `${SITE_URL}/tools/tailwind-lookup`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'md-table-generator', component: MdTableGeneratorComponent, title: 'Free Markdown Table Generator | xsantcastx', data: { description: 'Visual markdown table editor with CSV import and HTML export.', keywords: 'markdown table generator, md table builder, csv to markdown table, markdown table editor', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Markdown Table Generator', url: `${SITE_URL}/tools/md-table-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'json-escape', component: JsonEscapeComponent, title: 'Free JSON String Escape / Unescape | xsantcastx', data: { description: 'Escape and unescape special characters in JSON strings.', keywords: 'json escape, json unescape, json string escape, escape json online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JSON String Escape', url: `${SITE_URL}/tools/json-escape`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'animation-generator', component: AnimationGeneratorComponent, title: 'Free CSS Animation Generator — Keyframe Builder | xsantcastx', data: { description: 'Visual keyframe animation builder with presets and live preview.', keywords: 'css animation generator, keyframe builder, css animation maker, animation creator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Animation Generator', url: `${SITE_URL}/tools/animation-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'text-counter', component: TextCounterComponent, title: 'Free Text Counter & Word Analyzer | xsantcastx', data: { description: 'Count words, characters, sentences with reading time and keyword density.', keywords: 'word counter, character counter, text analyzer, reading time calculator, keyword density', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Text Counter', url: `${SITE_URL}/tools/text-counter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'screen-info', component: ScreenInfoComponent, title: 'Free Screen Resolution & Pixel Density Info | xsantcastx', data: { description: 'Auto-detect screen resolution, DPR, viewport size, and responsive breakpoint.', keywords: 'screen resolution detector, pixel density, dpr checker, viewport size, responsive breakpoint', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Screen Info', url: `${SITE_URL}/tools/screen-info`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'slug-generator', component: SlugGeneratorComponent, title: 'Free Slug Generator — URL-Friendly Text | xsantcastx', data: { description: 'Convert text to URL-friendly slugs with transliteration and bulk mode.', keywords: 'slug generator, url slug, slugify text, url friendly, seo slug generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Slug Generator', url: `${SITE_URL}/tools/slug-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'csv-json', component: CsvJsonComponent, title: 'Free CSV to JSON Converter | xsantcastx', data: { description: 'Convert between CSV and JSON with delimiter options and file upload.', keywords: 'csv to json, json to csv, csv converter, csv parser online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSV to JSON Converter', url: `${SITE_URL}/tools/csv-json`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'favicon-generator', component: FaviconGeneratorComponent, title: 'Free Favicon Generator — Text, Emoji, Image | xsantcastx', data: { description: 'Generate favicons from text, emoji, or image with multiple sizes and HTML tags.', keywords: 'favicon generator, favicon maker, create favicon, ico generator, favicon from text', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Favicon Generator', url: `${SITE_URL}/tools/favicon-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'keyboard-shortcuts', component: KeyboardShortcutsComponent, title: 'Keyboard Shortcuts Reference — VS Code, Chrome, Git | xsantcastx', data: { description: 'Searchable reference of 200+ keyboard shortcuts for popular developer tools.', keywords: 'keyboard shortcuts, vs code shortcuts, chrome shortcuts, git shortcuts, developer shortcuts', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Keyboard Shortcuts Reference', url: `${SITE_URL}/tools/keyboard-shortcuts`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'placeholder-image', component: PlaceholderImageComponent, title: 'Free Placeholder Image Generator | xsantcastx', data: { description: 'Generate placeholder images with custom size, colors, and text.', keywords: 'placeholder image, dummy image generator, placeholder png, test image generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Placeholder Image Generator', url: `${SITE_URL}/tools/placeholder-image`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'color-blindness', component: ColorBlindnessComponent, title: 'Free Color Blindness Simulator | xsantcastx', data: { description: 'Simulate how colors appear under 7 types of color vision deficiency.', keywords: 'color blindness simulator, color blind test, protanopia, deuteranopia, tritanopia, accessibility', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Color Blindness Simulator', url: `${SITE_URL}/tools/color-blindness`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'robots-generator', component: RobotsGeneratorComponent, title: 'Free Robots Meta Tag & robots.txt Generator | xsantcastx', data: { description: 'Visual builder for robots meta tags and robots.txt directives.', keywords: 'robots meta tag generator, robots.txt generator, noindex nofollow, seo robots', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Robots Generator', url: `${SITE_URL}/tools/robots-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'dns-lookup', component: DnsLookupComponent, title: 'Free DNS Record Lookup | xsantcastx', data: { description: 'Look up A, AAAA, CNAME, MX, NS, TXT, SOA records via Cloudflare DoH.', keywords: 'dns lookup, dns checker, mx record lookup, txt record, dns query online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'DNS Record Lookup', url: `${SITE_URL}/tools/dns-lookup`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'box-model', component: BoxModelComponent, title: 'Free CSS Box Model Visualizer | xsantcastx', data: { description: 'Interactive CSS box model diagram with margin, border, padding controls.', keywords: 'css box model, box model visualizer, margin padding border, box sizing, css layout', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Box Model Visualizer', url: `${SITE_URL}/tools/box-model`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'snippet-manager', component: SnippetManagerComponent, title: 'Free Code Snippet Manager | xsantcastx', data: { description: 'Save, organize, and search code snippets locally with syntax highlighting.', keywords: 'code snippet manager, snippet organizer, code vault, save code snippets, code library', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Code Snippet Manager', url: `${SITE_URL}/tools/snippet-manager`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'regex-generator', component: RegexGeneratorComponent, title: 'Free Regex Pattern Generator | xsantcastx', data: { description: 'Common regex patterns library with test area and flag selectors.', keywords: 'regex generator, regex patterns, regular expression builder', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Regex Pattern Generator', url: `${SITE_URL}/tools/regex-generator`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'text-shadow', component: TextShadowComponent, title: 'Free CSS Text Shadow Generator | xsantcastx', data: { description: 'Visual text shadow editor with multiple layers and presets.', keywords: 'css text shadow generator, text shadow editor, neon text effect', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Text Shadow Generator', url: `${SITE_URL}/tools/text-shadow`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'html-to-md', component: HtmlToMdComponent, title: 'Free HTML to Markdown Converter | xsantcastx', data: { description: 'Convert HTML to Markdown and back with no dependencies.', keywords: 'html to markdown, markdown to html, html converter', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'HTML to Markdown Converter', url: `${SITE_URL}/tools/html-to-md`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'data-size', component: DataSizeComponent, title: 'Free Data Size Calculator | xsantcastx', data: { description: 'Convert between bytes, KB, MB, GB, TB with bandwidth calculator.', keywords: 'data size calculator, byte converter, mb to gb, bandwidth calculator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Data Size Calculator', url: `${SITE_URL}/tools/data-size`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'color-shades', component: ColorShadesComponent, title: 'Free Color Shades & Tints Generator | xsantcastx', data: { description: 'Generate tints, shades, tones, and harmonies from a single color.', keywords: 'color shades generator, tints and shades, color palette generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Color Shades Generator', url: `${SITE_URL}/tools/color-shades`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'git-reference', component: GitReferenceComponent, title: 'Git Command Reference & Cheatsheet | xsantcastx', data: { description: 'Searchable reference of 100+ git commands with examples.', keywords: 'git commands, git reference, git cheatsheet, git help', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Git Command Reference', url: `${SITE_URL}/tools/git-reference`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'responsive-preview', component: ResponsivePreviewComponent, title: 'Free Responsive Design Preview | xsantcastx', data: { description: 'Preview URLs at different screen sizes with device presets.', keywords: 'responsive preview, responsive tester, screen size preview, device preview', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Responsive Preview', url: `${SITE_URL}/tools/responsive-preview`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'pomodoro', component: PomodoroComponent, title: 'Free Pomodoro Timer | xsantcastx', data: { description: 'Focus timer with work/break cycles, audio alerts, and session history.', keywords: 'pomodoro timer, focus timer, productivity timer, work break timer', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Pomodoro Timer', url: `${SITE_URL}/tools/pomodoro`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'css-filter', component: CssFilterComponent, title: 'Free CSS Filter Generator | xsantcastx', data: { description: 'Visual CSS filter editor with blur, brightness, contrast and presets.', keywords: 'css filter generator, css filter effects, image filter css, blur brightness', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Filter Generator', url: `${SITE_URL}/tools/css-filter`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'npm-search', component: NpmSearchComponent, title: 'Free NPM Package Search | xsantcastx', data: { description: 'Search npm packages, compare install commands, view package details.', keywords: 'npm search, npm package finder, npm registry search', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'NPM Package Search', url: `${SITE_URL}/tools/npm-search`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'json-minifier', component: JsonMinifierComponent, title: 'Free JSON Minifier & Compressor | xsantcastx', data: { description: 'Minify or beautify JSON with sort keys and compression stats.', keywords: 'json minifier, json compressor, minify json online, json beautifier', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JSON Minifier', url: `${SITE_URL}/tools/json-minifier`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'morse-code', component: MorseCodeComponent, title: 'Free Morse Code Translator | xsantcastx', data: { description: 'Translate text to Morse code and back with audio playback.', keywords: 'morse code translator, morse encoder, morse decoder, morse audio', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Morse Code Translator', url: `${SITE_URL}/tools/morse-code`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'binary-text', component: BinaryTextComponent, title: 'Free Binary to Text Converter | xsantcastx', data: { description: 'Convert text to 8-bit binary and binary to text.', keywords: 'binary to text, text to binary, binary converter, ascii binary', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Binary to Text Converter', url: `${SITE_URL}/tools/binary-text`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'string-repeater', component: StringRepeaterComponent, title: 'Free Text Repeater & Manipulator | xsantcastx', data: { description: 'Repeat, reverse, shuffle, sort, and deduplicate text lines.', keywords: 'text repeater, string repeater, text manipulator, sort lines, deduplicate', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Text Repeater', url: `${SITE_URL}/tools/string-repeater`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'mock-data', component: MockDataComponent, title: 'Free Random Mock Data Generator | xsantcastx', data: { description: 'Generate random names, emails, addresses as JSON, CSV, or SQL.', keywords: 'mock data generator, random data, fake data, test data generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Mock Data Generator', url: `${SITE_URL}/tools/mock-data`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'apca-contrast', component: ApcaContrastComponent, title: 'Free APCA Contrast Calculator | xsantcastx', data: { description: 'Calculate APCA and WCAG 2.x contrast ratios with font compliance.', keywords: 'apca contrast, wcag contrast, color contrast calculator, accessibility contrast', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'APCA Contrast Calculator', url: `${SITE_URL}/tools/apca-contrast`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'ts-playground', component: TsPlaygroundComponent, title: 'TypeScript Type Reference & Playground | xsantcastx', data: { description: 'Interactive reference of TypeScript utility types with examples.', keywords: 'typescript types, utility types, typescript reference, partial record omit', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'TypeScript Type Reference', url: `${SITE_URL}/tools/ts-playground`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'caesar-cipher', component: CaesarCipherComponent, title: 'Free ROT13 & Caesar Cipher | xsantcastx', data: { description: 'Encode/decode ROT13 and Caesar cipher with brute force view.', keywords: 'rot13, caesar cipher, cipher encoder, brute force cipher, rotation cipher', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'ROT13 & Caesar Cipher', url: `${SITE_URL}/tools/caesar-cipher`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'design-tokens', component: DesignTokensComponent, title: 'Free Design Token Converter | xsantcastx', data: { description: 'Convert design tokens to CSS variables, SCSS, or Tailwind config.', keywords: 'design tokens, figma tokens, css variables generator, scss variables, tailwind config', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Design Token Converter', url: `${SITE_URL}/tools/design-tokens`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } } },
  { path: 'json-schema', component: JsonSchemaComponent, title: 'Free JSON Schema Generator — Draft-07 | xsantcastx', data: { description: 'Paste JSON and generate a valid JSON Schema (draft-07) with type detection and format inference. Free, client-side, no sign-up required.', keywords: 'json schema generator, json to schema, json schema draft-07, json schema validator, generate json schema online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JSON Schema Generator', url: `${SITE_URL}/tools/json-schema`, applicationCategory: 'UtilityApplication', operatingSystem: 'Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'JSON Schema Generator', item: `${SITE_URL}/tools/json-schema` }] } } } },
  { path: 'image-resizer', component: ImageResizerComponent, title: 'Free Image Resizer — Resize, Scale & Convert Images | xsantcastx', data: { description: 'Resize images by percentage, exact dimensions, or social media presets. Free, client-side, no sign-up required.', keywords: 'resize image online, image resizer, resize photo, scale image, crop image online, social media image size, bulk image resize', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Image Resizer', url: `${SITE_URL}/tools/image-resizer`, description: 'Free browser-based image resizer. Resize by percentage, exact pixels, or social media presets — no uploads, no account required.', applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Resize by percentage or exact dimensions', 'Social media preset sizes', 'Batch resize up to 20 images', 'Output as JPEG, PNG, or WebP', 'No server uploads — 100% client-side'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Image Resizer', item: `${SITE_URL}/tools/image-resizer` }] } } } },
  { path: 'ascii-art', component: AsciiArtComponent, title: 'Free ASCII Art Generator — Text to Block Letters | xsantcastx', data: { description: 'Generate block letter ASCII art from any text. Free, client-side, no sign-up required. Copy to clipboard and download.', keywords: 'ascii art generator, ascii text generator, ascii art online, block letters, text art, fancy text generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'ASCII Art Generator', url: `${SITE_URL}/tools/ascii-art`, description: 'Free browser-based ASCII art generator. Convert text to block letters with live preview and one-click copy.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'ASCII Art Generator', item: `${SITE_URL}/tools/ascii-art` }] } } } },
  { path: 'button-generator', component: ButtonGeneratorComponent, title: 'Free CSS Button Generator — Design & Export | xsantcastx', data: { description: 'Create styled HTML buttons with custom colors, sizes, and hover effects. Free CSS button designer with live preview.', keywords: 'button generator, css button generator, button maker, html button generator, button css code', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Button Generator', url: `${SITE_URL}/tools/button-generator`, description: 'Free browser-based CSS button generator. Design buttons with colors, sizes, and hover effects — no code required.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Button Generator', item: `${SITE_URL}/tools/button-generator` }] } } } },
  { path: 'checklist', component: ChecklistComponent, title: 'Free Smart Checklist — To-Do List & Task Manager | xsantcastx', data: { description: 'Interactive to-do list with categories, priorities, and persistent local storage. Free checklist app, no login required.', keywords: 'checklist, todo list, task manager, productivity, to do app, task list, checklist app', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Smart Checklist', url: `${SITE_URL}/tools/checklist`, description: 'Free browser-based checklist and to-do list manager. Organize tasks with categories and persistent storage.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Checklist', item: `${SITE_URL}/tools/checklist` }] } } } },
  { path: 'color-name', component: ColorNameComponent, title: 'Free CSS Color Name Finder — Hex to Named Color | xsantcastx', data: { description: 'Find the closest CSS named color from any hex value. Searchable 150+ CSS color names with instant display.', keywords: 'css color name, color name finder, hex to color name, css colors, color reference', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Color Name Finder', url: `${SITE_URL}/tools/color-name`, description: 'Free CSS color name finder. Convert hex colors to named CSS colors from 150+ standard names.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Color Name Finder', item: `${SITE_URL}/tools/color-name` }] } } } },
  { path: 'color-picker', component: ColorPickerComponent, title: 'Free Advanced Color Picker — RGB, HSL, Hex | xsantcastx', data: { description: 'RGB, HSL, and hex color picker with interactive sliders, color history, and palette building tools.', keywords: 'color picker, rgb picker, hsl picker, hex color picker, color palette', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Color Picker', url: `${SITE_URL}/tools/color-picker`, description: 'Free advanced color picker with RGB, HSL, and hex input. Interactive sliders with color history and palette export.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Color Picker', item: `${SITE_URL}/tools/color-picker` }] } } } },
  { path: 'countdown', component: CountdownComponent, title: 'Free Countdown Timer — Count Down to Any Date | xsantcastx', data: { description: 'Count down to any date and time with formatted display and browser notifications. Free timer, no login.', keywords: 'countdown timer, count down, timer, countdown app, date countdown', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Countdown Timer', url: `${SITE_URL}/tools/countdown`, description: 'Free countdown timer to any date. Live display with browser notifications and automatic DST handling.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Countdown Timer', item: `${SITE_URL}/tools/countdown` }] } } } },
  { path: 'gitignore-generator', component: GitignoreGeneratorComponent, title: 'Free Gitignore Generator — Create .gitignore Files | xsantcastx', data: { description: 'Generate .gitignore files for 20+ frameworks and tech stacks. Searchable templates for Node, Python, Java, Go and more.', keywords: 'gitignore generator, gitignore template, git ignore', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Gitignore Generator', url: `${SITE_URL}/tools/gitignore-generator`, description: 'Free .gitignore file generator for 20+ frameworks. Searchable templates for Node.js, Python, Java, Go and more.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Gitignore Generator', item: `${SITE_URL}/tools/gitignore-generator` }] } } } },
  { path: 'heading-checker', component: HeadingCheckerComponent, title: 'Free HTML Heading Checker — SEO & Accessibility Audit | xsantcastx', data: { description: 'Analyze heading hierarchy and structure for accessibility and SEO issues. Find duplicate headings and improper nesting.', keywords: 'heading checker, h1 checker, heading structure, seo heading audit, accessibility headings', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Heading Checker', url: `${SITE_URL}/tools/heading-checker`, description: 'Free HTML heading hierarchy checker. Validate heading structure for accessibility and SEO compliance.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Heading Checker', item: `${SITE_URL}/tools/heading-checker` }] } } } },
  { path: 'hmac-generator', component: HmacGeneratorComponent, title: 'Free HMAC Generator — SHA1, SHA256, SHA512 | xsantcastx', data: { description: 'Generate HMAC signatures with SHA algorithms for secure message authentication. Free security tool, no login.', keywords: 'hmac generator, sha256 hmac, hmac online, hash generator, security', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'HMAC Generator', url: `${SITE_URL}/tools/hmac-generator`, description: 'Free HMAC generator supporting SHA1, SHA256, and SHA512. Generate authentication codes with live preview.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'HMAC Generator', item: `${SITE_URL}/tools/hmac-generator` }] } } } },
  { path: 'html-minifier', component: HtmlMinifierComponent, title: 'Free HTML Minifier & Beautifier — Minify & Format | xsantcastx', data: { description: 'Minify or beautify HTML code with compression statistics. Remove comments, whitespace, and optimize file size.', keywords: 'html minifier, minify html, html compressor, beautify html, html formatter', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'HTML Minifier', url: `${SITE_URL}/tools/html-minifier`, description: 'Free HTML minifier and beautifier. Minify or format HTML with compression stats and optimization options.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'HTML Minifier', item: `${SITE_URL}/tools/html-minifier` }] } } } },
  { path: 'js-minifier', component: JsMinifierComponent, title: 'Free JavaScript Minifier & Beautifier — Minify JS | xsantcastx', data: { description: 'Minify or beautify JavaScript code with compression analysis. Reduce file size and check syntax instantly.', keywords: 'js minifier, javascript minifier, minify javascript, js beautifier, javascript minifier online', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JavaScript Minifier', url: `${SITE_URL}/tools/js-minifier`, description: 'Free JavaScript minifier and beautifier. Minify or format JS code with compression stats and syntax checking.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'JS Minifier', item: `${SITE_URL}/tools/js-minifier` }] } } } },
  { path: 'json-diff', component: JsonDiffComponent, title: 'Free JSON Diff Checker — Compare JSON Objects | xsantcastx', data: { description: 'Compare two JSON objects side-by-side and identify additions, deletions, and changes with color highlighting.', keywords: 'json diff, json comparison, json differ, compare json, json diff tool', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JSON Diff Checker', url: `${SITE_URL}/tools/json-diff`, description: 'Free JSON diff checker. Compare two JSON objects side-by-side with color-highlighted changes and statistics.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'JSON Diff', item: `${SITE_URL}/tools/json-diff` }] } } } },
  { path: 'json-tree', component: JsonTreeComponent, title: 'Free JSON Tree Explorer — Interactive Path Finder | xsantcastx', data: { description: 'Explore JSON as an interactive tree and get property paths in dot or bracket notation with one-click copy.', keywords: 'json tree, json explorer, json path, json viewer, json parser', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JSON Tree Explorer', url: `${SITE_URL}/tools/json-tree`, description: 'Free JSON tree explorer. View JSON structures interactively and get property paths in dot or bracket notation.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'JSON Tree', item: `${SITE_URL}/tools/json-tree` }] } } } },
  { path: 'jwt-cheatsheet', component: JwtCheatsheetComponent, title: 'Free JWT Claims Reference — JSON Web Token Guide | xsantcastx', data: { description: 'Quick reference for JWT claims, algorithms, and structure. Searchable database of standard claims and examples.', keywords: 'jwt, json web token, jwt claims, jwt reference, jwt cheatsheet', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'JWT Cheatsheet', url: `${SITE_URL}/tools/jwt-cheatsheet`, description: 'Free JWT reference guide. Explore standard claims, algorithms, and code examples for JSON Web Tokens.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'JWT Cheatsheet', item: `${SITE_URL}/tools/jwt-cheatsheet` }] } } } },
  { path: 'license-picker', component: LicensePickerComponent, title: 'Free License Picker — Compare Open Source Licenses | xsantcastx', data: { description: 'Compare popular open source licenses side-by-side. Choose the right MIT, Apache, GPL, or other license.', keywords: 'license picker, open source licenses, mit license, apache license, gpl license', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'License Picker', url: `${SITE_URL}/tools/license-picker`, description: 'Free open source license comparison tool. Compare MIT, Apache, GPL, and other licenses side-by-side.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'License Picker', item: `${SITE_URL}/tools/license-picker` }] } } } },
  { path: 'line-sorter', component: LinesorterComponent, title: 'Free Line Sorter — Sort Text Alphabetically & Numerically | xsantcastx', data: { description: 'Sort text lines alphabetically, by length, numerically, or randomly. Remove duplicates and reorder.', keywords: 'line sorter, text sorter, sort lines, alphabetical sort, text sorting tool', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Line Sorter', url: `${SITE_URL}/tools/line-sorter`, description: 'Free text line sorter. Sort alphabetically, by length, numerically, or randomly with duplicate removal.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Line Sorter', item: `${SITE_URL}/tools/line-sorter` }] } } } },
  { path: 'mime-lookup', component: MimeLookupComponent, title: 'Free MIME Type Lookup — File Extensions Reference | xsantcastx', data: { description: 'Searchable reference for 500+ file extensions and MIME types. Find correct MIME types instantly.', keywords: 'mime type, mime lookup, file extensions, content type', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'MIME Lookup', url: `${SITE_URL}/tools/mime-lookup`, description: 'Free MIME type lookup. Search 500+ file extensions and corresponding MIME types instantly.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'MIME Lookup', item: `${SITE_URL}/tools/mime-lookup` }] } } } },
  { path: 'og-image-preview', component: OgImagePreviewComponent, title: 'Free OG Image Preview — Preview Social Meta Tags | xsantcastx', data: { description: 'Preview how your Open Graph tags display on Facebook, Twitter, LinkedIn, and Discord with live editor.', keywords: 'og image, open graph, social preview, meta tags, facebook preview', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'OG Image Preview', url: `${SITE_URL}/tools/og-image-preview`, description: 'Free OG preview tool. See how your Open Graph tags display on Facebook, Twitter, LinkedIn, and Discord.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'OG Preview', item: `${SITE_URL}/tools/og-image-preview` }] } } } },
  { path: 'package-json', component: PackageJsonComponent, title: 'Free Package.json Builder — Visual JSON Editor | xsantcastx', data: { description: 'Visual editor for package.json with script presets and dependency management. Generate valid JSON instantly.', keywords: 'package.json generator, package json editor, npm config', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Package.json Builder', url: `${SITE_URL}/tools/package-json`, description: 'Free package.json visual editor. Build package.json with script presets and dependency management.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Package.json', item: `${SITE_URL}/tools/package-json` }] } } } },
  { path: 'regex-cheatsheet', component: RegexCheatsheetComponent, title: 'Free Regex Cheatsheet — 80+ Pattern Reference | xsantcastx', data: { description: '80+ regex patterns categorized and searchable. Quick reference for email, URLs, phone, ZIP codes and more.', keywords: 'regex, regular expression, regex pattern, regex reference, regex cheatsheet', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Regex Cheatsheet', url: `${SITE_URL}/tools/regex-cheatsheet`, description: 'Free regex cheatsheet with 80+ patterns. Searchable reference for email, URLs, phone numbers and more.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Regex', item: `${SITE_URL}/tools/regex-cheatsheet` }] } } } },
  { path: 'scroll-snap', component: ScrollSnapComponent, title: 'Free CSS Scroll-Snap Builder — Visual Layout Creator | xsantcastx', data: { description: 'Create scroll-snap layouts visually with direction controls and live preview. Export CSS code instantly.', keywords: 'scroll snap, css scroll-snap, scroll snap align, scroll snap type', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Scroll-Snap Builder', url: `${SITE_URL}/tools/scroll-snap`, description: 'Free CSS scroll-snap builder. Create scroll-snap layouts visually with live preview and CSS export.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Scroll-Snap', item: `${SITE_URL}/tools/scroll-snap` }] } } } },
  { path: 'spacing-scale', component: SpacingScaleComponent, title: 'Free Spacing Scale Generator — Design System Builder | xsantcastx', data: { description: 'Generate linear and geometric spacing scales for design systems. Export CSS variables and Tailwind config.', keywords: 'spacing scale, design system, css spacing, tailwind spacing, space scale', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Spacing Scale Generator', url: `${SITE_URL}/tools/spacing-scale`, description: 'Free spacing scale generator for design systems. Create linear and geometric scales with CSS export.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Spacing Scale', item: `${SITE_URL}/tools/spacing-scale` }] } } } },
  { path: 'timezone-converter', component: TimezoneConverterComponent, title: 'Free Timezone Converter — 30+ Timezones | xsantcastx', data: { description: 'Convert times between 30+ timezones with automatic DST handling. Compare timezones instantly.', keywords: 'timezone converter, time converter, utc converter, timezone calculator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Timezone Converter', url: `${SITE_URL}/tools/timezone-converter`, description: 'Free timezone converter for 30+ timezones. Automatic DST handling with live time comparison.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Timezone Converter', item: `${SITE_URL}/tools/timezone-converter` }] } } } },
  { path: 'transform-playground', component: TransformPlaygroundComponent, title: 'Free CSS Transform Playground — 3D Transforms | xsantcastx', data: { description: 'Translate, rotate, scale, and skew CSS elements with live 3D preview and code export.', keywords: 'css transform, transform generator, 3d transform, css 3d, rotate scale', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Transform Playground', url: `${SITE_URL}/tools/transform-playground`, description: 'Free CSS transform playground with 3D preview. Control translate, rotate, scale, and skew visually.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Transform', item: `${SITE_URL}/tools/transform-playground` }] } } } },
  { path: 'transition-generator', component: TransitionGeneratorComponent, title: 'Free CSS Transition Generator — Cubic-Bezier Editor | xsantcastx', data: { description: 'Build CSS transitions with cubic-bezier curve editor, easing presets, and live animation preview.', keywords: 'css transition, transition generator, cubic-bezier, easing function', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Transition Generator', url: `${SITE_URL}/tools/transition-generator`, description: 'Free CSS transition generator with cubic-bezier editor. Create animations with easing presets and live preview.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Transition', item: `${SITE_URL}/tools/transition-generator` }] } } } },
  { path: 'ua-parser', component: UaParserComponent, title: 'Free User Agent Parser — Browser & Device Info | xsantcastx', data: { description: 'Parse and analyze browser and device information from user agent strings. Identify browser, OS, and device.', keywords: 'user agent parser, user agent string, browser parser, device detector', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'User Agent Parser', url: `${SITE_URL}/tools/ua-parser`, description: 'Free user agent parser. Analyze browser, OS, and device information from user agent strings.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'UA Parser', item: `${SITE_URL}/tools/ua-parser` }] } } } },
  { path: 'webhook-tester', component: WebhookTesterComponent, title: 'Free Webhook Tester — Payload Builder & Inspector | xsantcastx', data: { description: 'Test webhooks with payload builder, request templates, and request inspection. Debug webhooks instantly.', keywords: 'webhook tester, webhook testing, payload builder, webhook debugger', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Webhook Tester', url: `${SITE_URL}/tools/webhook-tester`, description: 'Free webhook tester with payload builder and templates. Test and debug webhooks with request inspection.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Webhook Tester', item: `${SITE_URL}/tools/webhook-tester` }] } } } },
  { path: 'gradient-text', component: GradientTextComponent, title: 'Free CSS Gradient Text Generator — Colorful Text Effects | xsantcastx', data: { description: 'Create stunning gradient text effects with CSS. Pick colors, adjust direction and copy the CSS code.', keywords: 'css gradient text, gradient text generator, colorful text css, text gradient effect, gradient heading', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Gradient Text Generator', url: `${SITE_URL}/tools/gradient-text`, description: 'Create gradient text effects with CSS. Pick colors, adjust direction and copy ready-to-use code.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Multi-stop gradients', 'Direction control', 'Live preview', 'One-click CSS copy'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'CSS Gradient Text Generator', item: `${SITE_URL}/tools/gradient-text` }] } } } },
  { path: 'hex-editor', component: HexEditorComponent, title: 'Free Online Hex Editor — View & Edit Binary Data | xsantcastx', data: { description: 'View and edit binary data in hexadecimal. Load files, inspect bytes, search hex patterns and export changes.', keywords: 'hex editor online, binary editor, hex viewer, hexadecimal editor, byte editor, hex dump', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Hex Editor', url: `${SITE_URL}/tools/hex-editor`, description: 'View and edit binary data in hex. Load files, inspect bytes, search patterns and export changes.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Hex + ASCII view', 'File loading', 'Byte editing', 'Search patterns'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Hex Editor', item: `${SITE_URL}/tools/hex-editor` }] } } } },
  { path: 'sitemap-generator', component: SitemapGeneratorComponent, title: 'Free XML Sitemap Generator — Create Sitemaps for SEO | xsantcastx', data: { description: 'Generate XML sitemaps for your website. Add URLs with priority and change frequency, then download the sitemap file.', keywords: 'sitemap generator, xml sitemap, create sitemap, sitemap builder, seo sitemap, sitemap.xml generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'XML Sitemap Generator', url: `${SITE_URL}/tools/sitemap-generator`, description: 'Generate XML sitemaps. Add URLs with priority and change frequency, then download the file.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Add URLs manually', 'Set priority & frequency', 'Download XML', 'Validate structure'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'XML Sitemap Generator', item: `${SITE_URL}/tools/sitemap-generator` }] } } } },
  { path: 'seo-checker', component: SeoCheckerComponent, title: 'Free SEO Checker — Title & Meta Description Analyzer with SERP Preview | xsantcastx', data: { description: 'Analyze page titles, meta descriptions, and keywords with a live Google SERP preview. Get instant SEO suggestions for better rankings.', keywords: 'seo checker, serp preview, meta description length, title tag analyzer, keyword density, seo tool, on-page seo', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'SEO Checker', url: `${SITE_URL}/tools/seo-checker`, description: 'Analyze page titles, meta descriptions, and keywords with a live Google SERP preview and actionable SEO suggestions.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Title length analysis', 'Meta description checker', 'Live SERP preview', 'Keyword density', 'Open Graph preview', 'SEO suggestions'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'SEO Checker', item: `${SITE_URL}/tools/seo-checker` }] } } } },
  { path: 'encoding-converter', component: EncodingConverterComponent, title: 'Free Encoding Converter — UTF-8, ASCII, URL, HTML Entities & Hex | xsantcastx', data: { description: 'Convert text between UTF-8, ASCII, Latin-1, URL encoding, HTML entities, Unicode escapes, hex and octal. Includes hex dump and character breakdown.', keywords: 'encoding converter, utf-8 converter, url encoding, html entities, unicode escape, hex dump, ascii converter, text encoding', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Encoding Converter', url: `${SITE_URL}/tools/encoding-converter`, description: 'Convert text between 9 encoding formats with hex dump view and per-character breakdown.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['UTF-8 hex bytes', 'URL encoding', 'HTML entities', 'Unicode escapes', 'Hex dump view', 'Character table'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Encoding Converter', item: `${SITE_URL}/tools/encoding-converter` }] } } } },
  { path: 'crontab-ref', component: CrontabRefComponent, title: 'Free Crontab Quick Reference — 30+ Cron Expressions with Search & Copy | xsantcastx', data: { description: 'Visual cron syntax guide with 30+ categorized expressions, search, one-click copy, and next run time calculator. No sign-up required.', keywords: 'crontab reference, cron cheatsheet, cron expressions, crontab syntax, cron schedule, cron examples, crontab guide', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Crontab Quick Reference', url: `${SITE_URL}/tools/crontab-ref`, description: 'Visual cron syntax guide with 30+ categorized expressions, search, and one-click copy.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['30+ cron expressions', 'Category filters', 'Search & copy', 'Next run calculator', 'Syntax diagram', 'Wildcard reference'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Crontab Quick Reference', item: `${SITE_URL}/tools/crontab-ref` }] } } } },
  { path: 'css-variables', component: CssVariablesComponent, title: 'Free CSS Custom Properties Generator — Design Tokens to CSS/SCSS/JSON/Tailwind | xsantcastx', data: { description: 'Build a design system with CSS custom properties. Add variables, import from CSS, preview live, and export to CSS, SCSS, JSON, or Tailwind config.', keywords: 'css variables generator, css custom properties, design tokens, css variables builder, scss variables, tailwind config generator, design system', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Custom Properties Generator', url: `${SITE_URL}/tools/css-variables`, description: 'Build a design system with CSS custom properties and export to CSS, SCSS, JSON, or Tailwind.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Add/edit/delete variables', 'Import from CSS', 'Live preview', 'Export CSS/SCSS/JSON/Tailwind', 'Color swatch preview', 'Sample variables'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'CSS Custom Properties Generator', item: `${SITE_URL}/tools/css-variables` }] } } } },
  { path: 'docker-ref', component: DockerRefComponent, title: 'Free Docker Compose Reference — Searchable Directives & YAML Templates | xsantcastx', data: { description: 'Complete Docker Compose reference with 50+ searchable directives, categorized by services, networks, volumes, and configs. Includes ready-to-use YAML templates.', keywords: 'docker compose reference, docker compose cheatsheet, docker-compose.yml, docker compose directives, docker yaml templates, docker compose examples', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Docker Compose Reference', url: `${SITE_URL}/tools/docker-ref`, description: 'Complete Docker Compose reference with 50+ searchable directives and ready-to-use YAML templates.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['50+ directives', 'Category filters', 'YAML examples', 'Ready-to-use templates', 'One-click copy', 'Search & filter'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Docker Compose Reference', item: `${SITE_URL}/tools/docker-ref` }] } } } },
  { path: 'media-query', component: MediaQueryComponent, title: 'Free CSS Media Query Builder — Framework Presets, Live Detection & Copy | xsantcastx', data: { description: 'Visual media query generator with Bootstrap, Tailwind & common presets, live breakpoint detection, and one-click copy. No sign-up required.', keywords: 'media query builder, css media queries, responsive breakpoints, bootstrap breakpoints, tailwind breakpoints, media query generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Media Query Builder', url: `${SITE_URL}/tools/media-query`, description: 'Visual media query generator with framework presets, live breakpoint detection, and one-click copy.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Visual query builder', 'Bootstrap presets', 'Tailwind presets', 'Live breakpoint detection', 'One-click copy'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Media Query Builder', item: `${SITE_URL}/tools/media-query` }] } } } },
  { path: 'progress-bar', component: ProgressBarComponent, title: 'Free CSS Progress Bar Generator — Live Preview, Stripes & Gradients | xsantcastx', data: { description: 'Design custom CSS progress bars with animated stripes, gradient fills, presets, and live preview. Copy-paste ready code.', keywords: 'progress bar generator, css progress bar, animated progress bar, striped progress bar, gradient progress bar, css generator', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Progress Bar Generator', url: `${SITE_URL}/tools/progress-bar`, description: 'Design custom CSS progress bars with animated stripes, gradient fills, and live preview.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Live preview', 'Animated stripes', 'Gradient fills', 'Presets', 'Copy-paste code'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Progress Bar Generator', item: `${SITE_URL}/tools/progress-bar` }] } } } },
  { path: 'clip-path', component: ClipPathComponent, title: 'Free CSS Clip-Path Generator — Visual Editor with Drag Handles | xsantcastx', data: { description: 'Visually design CSS clip-path shapes with drag handles, shape presets, and one-click code copy. Supports polygon, circle, ellipse, inset.', keywords: 'clip-path generator, css clip-path, polygon clip-path, css shapes, clip-path editor, clip-path presets', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'CSS Clip-Path Generator', url: `${SITE_URL}/tools/clip-path`, description: 'Visually design CSS clip-path shapes with drag handles, presets, and one-click code copy.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Visual editor', 'Drag handles', 'Shape presets', 'Polygon, circle, ellipse, inset', 'One-click copy'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Clip-Path Generator', item: `${SITE_URL}/tools/clip-path` }] } } } },
  { path: 'char-map', component: CharMapComponent, title: 'Free Special Characters & Symbols Map — 400+ Unicode Glyphs, Click to Copy | xsantcastx', data: { description: 'Browse 400+ Unicode characters across 8 categories. Click any glyph to copy it as a character, HTML entity, or Unicode codepoint — all client-side, no sign-up.', keywords: 'special characters, unicode map, html entities, symbols, glyphs, character picker, unicode lookup, copy unicode', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Special Characters & Symbols Map', url: `${SITE_URL}/tools/char-map`, description: 'Browse and copy 400+ Unicode characters and symbols. Click any glyph to copy as character, HTML entity, or Unicode codepoint.', applicationCategory: 'UtilityApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['400+ Unicode characters', '8 categories', 'Search by name/keyword/codepoint', 'Copy as char/HTML/Unicode', 'Recent characters', 'Client-side only'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'Special Characters Map', item: `${SITE_URL}/tools/char-map` }] } } } },
  { path: 'svg-path-editor', component: SvgPathEditorComponent, title: 'Free SVG Path Visualizer & Editor — Drag Control Points, Minify, Copy | xsantcastx', data: { description: 'Paste, visualize, edit, and optimize SVG path data in your browser. Drag control points, see live measurements, and copy minified output — 100% client-side.', keywords: 'svg path editor, svg path visualizer, svg path minifier, bezier curve editor, svg d attribute, svg path tool, svg path optimizer', ogImage: `${SITE_URL}/assets/og/og-default.jpg`, jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'SVG Path Visualizer & Editor', url: `${SITE_URL}/tools/svg-path-editor`, description: 'Visualize, edit, and minify SVG path data with draggable control points and live measurements.', applicationCategory: 'DeveloperApplication', operatingSystem: 'Any Web Browser', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, featureList: ['Path parser', 'Draggable control points', 'Pan & zoom viewport', 'Bounding box & length', 'Minified output with precision control', 'Preset shapes', 'Edit commands inline'], breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${SITE_URL}/tools` }, { '@type': 'ListItem', position: 2, name: 'SVG Path Editor', item: `${SITE_URL}/tools/svg-path-editor` }] } } } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ToolsRoutingModule {}
