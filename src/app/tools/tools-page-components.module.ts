import { NgModule } from '@angular/core';
import { ToolsSharedModule } from '../shared/tools-shared.module';
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

/**
 * ToolsPageComponentsModule — declares EVERY tool page component plus the
 * /tools index (ToolsComponent) and /embed index (EmbedLandingComponent).
 * Both lazy route modules (ToolsModule, EmbedModule) import this module so the
 * components are declared exactly once and code-split into shared lazy chunks.
 */
@NgModule({
  declarations: [
    AnimationGeneratorComponent,
    ApcaContrastComponent,
    ApiRequestBuilderComponent,
    AsciiArtComponent,
    AspectRatioComponent,
    Base64EncoderComponent,
    BaseConverterComponent,
    BinaryTextComponent,
    BorderRadiusComponent,
    BoxModelComponent,
    BoxShadowGeneratorComponent,
    ButtonGeneratorComponent,
    CaesarCipherComponent,
    CaseConverterComponent,
    CharMapComponent,
    ChecklistComponent,
    ChmodCalculatorComponent,
    ClipPathComponent,
    ColorBlindnessComponent,
    ColorConverterComponent,
    ColorNameComponent,
    ColorPaletteComponent,
    ColorPickerComponent,
    ColorShadesComponent,
    ContrastCheckerComponent,
    CountdownComponent,
    CronBuilderComponent,
    CrontabRefComponent,
    CssFilterComponent,
    CssMinifierComponent,
    CssUnitsComponent,
    CssVariablesComponent,
    CsvJsonComponent,
    DataSizeComponent,
    DesignTokensComponent,
    DiffCheckerComponent,
    DnsLookupComponent,
    DockerRefComponent,
    EmailDeliverabilityAuditorComponent,
    EmbedLandingComponent,
    EmojiPickerComponent,
    EncodingConverterComponent,
    EnvValidatorComponent,
    FaviconGeneratorComponent,
    FlexboxGeneratorComponent,
    FontPairerComponent,
    GitReferenceComponent,
    GitignoreGeneratorComponent,
    GmailDeliverabilityCheckerComponent,
    GradientGeneratorComponent,
    GradientTextComponent,
    GridGeneratorComponent,
    GroceryManagerComponent,
    HashGeneratorComponent,
    HeadingCheckerComponent,
    HexEditorComponent,
    HmacGeneratorComponent,
    HtmlEntitiesComponent,
    HtmlMinifierComponent,
    HtmlToMdComponent,
    HttpStatusComponent,
    ImageCompressorComponent,
    ImageResizerComponent,
    IpLookupComponent,
    JsMinifierComponent,
    JsonDiffComponent,
    JsonEscapeComponent,
    JsonFormatterComponent,
    JsonMinifierComponent,
    JsonPathComponent,
    JsonSchemaComponent,
    JsonToTsComponent,
    JsonTreeComponent,
    JwtCheatsheetComponent,
    JwtDecoderComponent,
    JwtGeneratorComponent,
    KeyboardShortcutsComponent,
    LicensePickerComponent,
    LinesorterComponent,
    LoremGeneratorComponent,
    MarkdownEditorComponent,
    MdTableGeneratorComponent,
    MediaQueryComponent,
    MetaTagGeneratorComponent,
    MimeLookupComponent,
    MockDataComponent,
    MorseCodeComponent,
    NpmSearchComponent,
    OgImagePreviewComponent,
    PackageJsonComponent,
    PasswordGeneratorComponent,
    PdfGeneratorComponent,
    PlaceholderImageComponent,
    PomodoroComponent,
    ProgressBarComponent,
    QrGeneratorComponent,
    RegexCheatsheetComponent,
    RegexGeneratorComponent,
    RegexTesterComponent,
    ResponsivePreviewComponent,
    RobotsGeneratorComponent,
    ScreenInfoComponent,
    ScrollSnapComponent,
    SeoCheckerComponent,
    SitemapGeneratorComponent,
    SlugGeneratorComponent,
    SnippetManagerComponent,
    SpacingScaleComponent,
    SqlFormatterComponent,
    SslCertificateAuditorComponent,
    SslCertificateInspectorComponent,
    StringRepeaterComponent,
    SvgPathEditorComponent,
    SvgToCodeComponent,
    TailwindLookupComponent,
    TextCounterComponent,
    TextShadowComponent,
    TimestampConverterComponent,
    TimezoneConverterComponent,
    ToolsComponent,
    TransformPlaygroundComponent,
    TransitionGeneratorComponent,
    TsPlaygroundComponent,
    UaParserComponent,
    UrlEncoderComponent,
    UuidGeneratorComponent,
    WebhookTesterComponent,
    YamlJsonComponent,
  ],
  imports: [ToolsSharedModule],
  exports: [
    AnimationGeneratorComponent,
    ApcaContrastComponent,
    ApiRequestBuilderComponent,
    AsciiArtComponent,
    AspectRatioComponent,
    Base64EncoderComponent,
    BaseConverterComponent,
    BinaryTextComponent,
    BorderRadiusComponent,
    BoxModelComponent,
    BoxShadowGeneratorComponent,
    ButtonGeneratorComponent,
    CaesarCipherComponent,
    CaseConverterComponent,
    CharMapComponent,
    ChecklistComponent,
    ChmodCalculatorComponent,
    ClipPathComponent,
    ColorBlindnessComponent,
    ColorConverterComponent,
    ColorNameComponent,
    ColorPaletteComponent,
    ColorPickerComponent,
    ColorShadesComponent,
    ContrastCheckerComponent,
    CountdownComponent,
    CronBuilderComponent,
    CrontabRefComponent,
    CssFilterComponent,
    CssMinifierComponent,
    CssUnitsComponent,
    CssVariablesComponent,
    CsvJsonComponent,
    DataSizeComponent,
    DesignTokensComponent,
    DiffCheckerComponent,
    DnsLookupComponent,
    DockerRefComponent,
    EmailDeliverabilityAuditorComponent,
    EmbedLandingComponent,
    EmojiPickerComponent,
    EncodingConverterComponent,
    EnvValidatorComponent,
    FaviconGeneratorComponent,
    FlexboxGeneratorComponent,
    FontPairerComponent,
    GitReferenceComponent,
    GitignoreGeneratorComponent,
    GmailDeliverabilityCheckerComponent,
    GradientGeneratorComponent,
    GradientTextComponent,
    GridGeneratorComponent,
    GroceryManagerComponent,
    HashGeneratorComponent,
    HeadingCheckerComponent,
    HexEditorComponent,
    HmacGeneratorComponent,
    HtmlEntitiesComponent,
    HtmlMinifierComponent,
    HtmlToMdComponent,
    HttpStatusComponent,
    ImageCompressorComponent,
    ImageResizerComponent,
    IpLookupComponent,
    JsMinifierComponent,
    JsonDiffComponent,
    JsonEscapeComponent,
    JsonFormatterComponent,
    JsonMinifierComponent,
    JsonPathComponent,
    JsonSchemaComponent,
    JsonToTsComponent,
    JsonTreeComponent,
    JwtCheatsheetComponent,
    JwtDecoderComponent,
    JwtGeneratorComponent,
    KeyboardShortcutsComponent,
    LicensePickerComponent,
    LinesorterComponent,
    LoremGeneratorComponent,
    MarkdownEditorComponent,
    MdTableGeneratorComponent,
    MediaQueryComponent,
    MetaTagGeneratorComponent,
    MimeLookupComponent,
    MockDataComponent,
    MorseCodeComponent,
    NpmSearchComponent,
    OgImagePreviewComponent,
    PackageJsonComponent,
    PasswordGeneratorComponent,
    PdfGeneratorComponent,
    PlaceholderImageComponent,
    PomodoroComponent,
    ProgressBarComponent,
    QrGeneratorComponent,
    RegexCheatsheetComponent,
    RegexGeneratorComponent,
    RegexTesterComponent,
    ResponsivePreviewComponent,
    RobotsGeneratorComponent,
    ScreenInfoComponent,
    ScrollSnapComponent,
    SeoCheckerComponent,
    SitemapGeneratorComponent,
    SlugGeneratorComponent,
    SnippetManagerComponent,
    SpacingScaleComponent,
    SqlFormatterComponent,
    SslCertificateAuditorComponent,
    SslCertificateInspectorComponent,
    StringRepeaterComponent,
    SvgPathEditorComponent,
    SvgToCodeComponent,
    TailwindLookupComponent,
    TextCounterComponent,
    TextShadowComponent,
    TimestampConverterComponent,
    TimezoneConverterComponent,
    ToolsComponent,
    TransformPlaygroundComponent,
    TransitionGeneratorComponent,
    TsPlaygroundComponent,
    UaParserComponent,
    UrlEncoderComponent,
    UuidGeneratorComponent,
    WebhookTesterComponent,
    YamlJsonComponent,
  ]
})
export class ToolsPageComponentsModule {}
