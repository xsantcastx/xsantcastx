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
import { EmbedLandingComponent } from '../embed-landing/embed-landing.component';
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
  { path: 'json-formatter', component: JsonFormatterComponent, data: { embed: true } },
  { path: 'base64-encoder', component: Base64EncoderComponent, data: { embed: true } },
  { path: 'regex-tester', component: RegexTesterComponent, data: { embed: true } },
  { path: 'box-shadow-generator', component: BoxShadowGeneratorComponent, data: { embed: true } },
  { path: 'color-palette', component: ColorPaletteComponent, data: { embed: true } },
  { path: 'contrast-checker', component: ContrastCheckerComponent, data: { embed: true } },
  { path: 'image-compressor', component: ImageCompressorComponent, data: { embed: true } },
  { path: 'pdf-generator', component: PdfGeneratorComponent, data: { embed: true } },
  { path: 'gmail-deliverability-checker', component: GmailDeliverabilityCheckerComponent, data: { embed: true } },
  { path: 'email-deliverability-auditor', component: EmailDeliverabilityAuditorComponent, data: { embed: true } },
  { path: 'ssl-certificate-inspector', component: SslCertificateInspectorComponent, data: { embed: true } },
  { path: 'ssl-certificate-auditor', component: SslCertificateAuditorComponent, data: { embed: true } },
  { path: 'svg-to-code', component: SvgToCodeComponent, data: { embed: true } },
  { path: 'gradient-generator', component: GradientGeneratorComponent, data: { embed: true } },
  { path: 'jwt-decoder', component: JwtDecoderComponent, data: { embed: true } },
  { path: 'uuid-generator', component: UuidGeneratorComponent, data: { embed: true } },
  { path: 'hash-generator', component: HashGeneratorComponent, data: { embed: true } },
  { path: 'meta-tag-generator', component: MetaTagGeneratorComponent, data: { embed: true } },
  { path: 'env-validator', component: EnvValidatorComponent, data: { embed: true } },
  { path: 'font-pairer', component: FontPairerComponent, data: { embed: true } },
  { path: 'cron-builder', component: CronBuilderComponent, data: { embed: true } },
  { path: 'api-request-builder', component: ApiRequestBuilderComponent, data: { embed: true } },
  { path: 'json-to-ts', component: JsonToTsComponent, data: { embed: true } },
  { path: 'markdown-editor', component: MarkdownEditorComponent, data: { embed: true } },
  { path: 'diff-checker', component: DiffCheckerComponent, data: { embed: true } },
  { path: 'timestamp-converter', component: TimestampConverterComponent, data: { embed: true } },
  { path: 'url-encoder', component: UrlEncoderComponent, data: { embed: true } },
  { path: 'sql-formatter', component: SqlFormatterComponent, data: { embed: true } },
  { path: 'base-converter', component: BaseConverterComponent, data: { embed: true } },
  { path: 'password-generator', component: PasswordGeneratorComponent, data: { embed: true } },
  { path: 'qr-generator', component: QrGeneratorComponent, data: { embed: true } },
  { path: 'lorem-generator', component: LoremGeneratorComponent, data: { embed: true } },
  { path: 'color-converter', component: ColorConverterComponent, data: { embed: true } },
  { path: 'case-converter', component: CaseConverterComponent, data: { embed: true } },
  { path: 'flexbox-generator', component: FlexboxGeneratorComponent, data: { embed: true } },
  { path: 'chmod-calculator', component: ChmodCalculatorComponent, data: { embed: true } },
  { path: 'html-entities', component: HtmlEntitiesComponent, data: { embed: true } },
  { path: 'json-path', component: JsonPathComponent, data: { embed: true } },
  { path: 'css-units', component: CssUnitsComponent, data: { embed: true } },
  { path: 'aspect-ratio', component: AspectRatioComponent, data: { embed: true } },
  { path: 'css-minifier', component: CssMinifierComponent, data: { embed: true } },
  { path: 'http-status', component: HttpStatusComponent, data: { embed: true } },
  { path: 'border-radius', component: BorderRadiusComponent, data: { embed: true } },
  { path: 'emoji-picker', component: EmojiPickerComponent, data: { embed: true } },
  { path: 'ip-lookup', component: IpLookupComponent, data: { embed: true } },
  { path: 'grid-generator', component: GridGeneratorComponent, data: { embed: true } },
  { path: 'yaml-json', component: YamlJsonComponent, data: { embed: true } },
  { path: 'jwt-generator', component: JwtGeneratorComponent, data: { embed: true } },
  { path: 'tailwind-lookup', component: TailwindLookupComponent, data: { embed: true } },
  { path: 'md-table-generator', component: MdTableGeneratorComponent, data: { embed: true } },
  { path: 'json-escape', component: JsonEscapeComponent, data: { embed: true } },
  { path: 'animation-generator', component: AnimationGeneratorComponent, data: { embed: true } },
  { path: 'text-counter', component: TextCounterComponent, data: { embed: true } },
  { path: 'screen-info', component: ScreenInfoComponent, data: { embed: true } },
  { path: 'slug-generator', component: SlugGeneratorComponent, data: { embed: true } },
  { path: 'csv-json', component: CsvJsonComponent, data: { embed: true } },
  { path: 'favicon-generator', component: FaviconGeneratorComponent, data: { embed: true } },
  { path: 'keyboard-shortcuts', component: KeyboardShortcutsComponent, data: { embed: true } },
  { path: 'placeholder-image', component: PlaceholderImageComponent, data: { embed: true } },
  { path: 'color-blindness', component: ColorBlindnessComponent, data: { embed: true } },
  { path: 'robots-generator', component: RobotsGeneratorComponent, data: { embed: true } },
  { path: 'dns-lookup', component: DnsLookupComponent, data: { embed: true } },
  { path: 'box-model', component: BoxModelComponent, data: { embed: true } },
  { path: 'snippet-manager', component: SnippetManagerComponent, data: { embed: true } },
  { path: 'regex-generator', component: RegexGeneratorComponent, data: { embed: true } },
  { path: 'text-shadow', component: TextShadowComponent, data: { embed: true } },
  { path: 'html-to-md', component: HtmlToMdComponent, data: { embed: true } },
  { path: 'data-size', component: DataSizeComponent, data: { embed: true } },
  { path: 'color-shades', component: ColorShadesComponent, data: { embed: true } },
  { path: 'git-reference', component: GitReferenceComponent, data: { embed: true } },
  { path: 'responsive-preview', component: ResponsivePreviewComponent, data: { embed: true } },
  { path: 'pomodoro', component: PomodoroComponent, data: { embed: true } },
  { path: 'css-filter', component: CssFilterComponent, data: { embed: true } },
  { path: 'npm-search', component: NpmSearchComponent, data: { embed: true } },
  { path: 'json-minifier', component: JsonMinifierComponent, data: { embed: true } },
  { path: 'morse-code', component: MorseCodeComponent, data: { embed: true } },
  { path: 'binary-text', component: BinaryTextComponent, data: { embed: true } },
  { path: 'string-repeater', component: StringRepeaterComponent, data: { embed: true } },
  { path: 'mock-data', component: MockDataComponent, data: { embed: true } },
  { path: 'apca-contrast', component: ApcaContrastComponent, data: { embed: true } },
  { path: 'ts-playground', component: TsPlaygroundComponent, data: { embed: true } },
  { path: 'caesar-cipher', component: CaesarCipherComponent, data: { embed: true } },
  { path: 'design-tokens', component: DesignTokensComponent, data: { embed: true } },
  { path: 'json-schema', component: JsonSchemaComponent, data: { embed: true } },
  { path: 'image-resizer', component: ImageResizerComponent, data: { embed: true } },
  { path: 'gradient-text', component: GradientTextComponent, data: { embed: true } },
  { path: 'hex-editor', component: HexEditorComponent, data: { embed: true } },
  { path: 'sitemap-generator', component: SitemapGeneratorComponent, data: { embed: true } },
  { path: 'seo-checker', component: SeoCheckerComponent, data: { embed: true } },
  { path: 'encoding-converter', component: EncodingConverterComponent, data: { embed: true } },
  { path: 'crontab-ref', component: CrontabRefComponent, data: { embed: true } },
  { path: 'css-variables', component: CssVariablesComponent, data: { embed: true } },
  { path: 'docker-ref', component: DockerRefComponent, data: { embed: true } },
  { path: 'ascii-art', component: AsciiArtComponent, data: { embed: true } },
  { path: 'button-generator', component: ButtonGeneratorComponent, data: { embed: true } },
  { path: 'checklist', component: ChecklistComponent, data: { embed: true } },
  { path: 'color-name', component: ColorNameComponent, data: { embed: true } },
  { path: 'color-picker', component: ColorPickerComponent, data: { embed: true } },
  { path: 'countdown', component: CountdownComponent, data: { embed: true } },
  { path: 'gitignore-generator', component: GitignoreGeneratorComponent, data: { embed: true } },
  { path: 'heading-checker', component: HeadingCheckerComponent, data: { embed: true } },
  { path: 'hmac-generator', component: HmacGeneratorComponent, data: { embed: true } },
  { path: 'html-minifier', component: HtmlMinifierComponent, data: { embed: true } },
  { path: 'js-minifier', component: JsMinifierComponent, data: { embed: true } },
  { path: 'json-diff', component: JsonDiffComponent, data: { embed: true } },
  { path: 'json-tree', component: JsonTreeComponent, data: { embed: true } },
  { path: 'jwt-cheatsheet', component: JwtCheatsheetComponent, data: { embed: true } },
  { path: 'license-picker', component: LicensePickerComponent, data: { embed: true } },
  { path: 'line-sorter', component: LinesorterComponent, data: { embed: true } },
  { path: 'mime-lookup', component: MimeLookupComponent, data: { embed: true } },
  { path: 'og-image-preview', component: OgImagePreviewComponent, data: { embed: true } },
  { path: 'package-json', component: PackageJsonComponent, data: { embed: true } },
  { path: 'regex-cheatsheet', component: RegexCheatsheetComponent, data: { embed: true } },
  { path: 'scroll-snap', component: ScrollSnapComponent, data: { embed: true } },
  { path: 'spacing-scale', component: SpacingScaleComponent, data: { embed: true } },
  { path: 'timezone-converter', component: TimezoneConverterComponent, data: { embed: true } },
  { path: 'transform-playground', component: TransformPlaygroundComponent, data: { embed: true } },
  { path: 'transition-generator', component: TransitionGeneratorComponent, data: { embed: true } },
  { path: 'ua-parser', component: UaParserComponent, data: { embed: true } },
  { path: 'webhook-tester', component: WebhookTesterComponent, data: { embed: true } },
  { path: 'media-query', component: MediaQueryComponent, data: { embed: true } },
  { path: 'progress-bar', component: ProgressBarComponent, data: { embed: true } },
  { path: 'clip-path', component: ClipPathComponent, data: { embed: true } },
  { path: 'char-map', component: CharMapComponent, data: { embed: true } },
  { path: 'svg-path-editor', component: SvgPathEditorComponent, data: { embed: true } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EmbedRoutingModule {}
