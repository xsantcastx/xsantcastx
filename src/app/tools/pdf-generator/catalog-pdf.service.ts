import { Injectable } from '@angular/core';
import type jsPDFType from 'jspdf';
import { CatalogPdfConfig, FieldConfig, FieldKey, ProductSection, Product, BadgeType } from './pdf-generator.types';
import { buildCollagePages, COLLAGE_VCOLS } from './collage-layout.util';

// ─── Colour palette ────────────────────────────────────────────────────────
const C = {
  ink:     { r: 10,  g: 10,  b: 14  },
  white:   { r: 255, g: 255, b: 255 },
  muted:   { r: 140, g: 148, b: 165 },
  accent:  { r: 0,   g: 255, b: 204 },
  gold:    { r: 201, g: 168, b: 76  },
  surface: { r: 18,  g: 24,  b: 42  },
  dark:    { r: 8,   g: 8,   b: 12  },
};

type RGB = { r: number; g: number; b: number };

@Injectable({ providedIn: 'root' })
export class CatalogPdfService {

  // ─── PUBLIC GENERATE ──────────────────────────────────────────────────────

  async generate(config: CatalogPdfConfig, sections: ProductSection[], enabledFields: FieldConfig[]): Promise<void> {
    const populated = sections.filter(s => s.products.length > 0);
    if (populated.length === 0) return;

    const { default: jsPDF } = await import('jspdf');

    const format: [number, number] | string =
      config.pageSize === 'letter' ? [215.9, 279.4] : 'a4';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format });

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    const accentRgb = this.hexToRgb(config.accentColor);

    if (config.showCoverPage) {
      this.drawCover(doc, config, populated, pw, ph, accentRgb);
    }

    let isFirstContent = !config.showCoverPage;

    for (const section of populated) {
      if (!isFirstContent) doc.addPage();
      isFirstContent = false;

      if (config.showSectionDividers) {
        this.drawSectionDivider(doc, section, pw, ph, accentRgb);
        doc.addPage();
      }

      switch (config.template) {
        case 'minimal':
          this.drawMinimalPages(doc, section, config, enabledFields, pw, ph, accentRgb);
          break;
        case 'detailed':
          this.drawDetailedPages(doc, section, config, enabledFields, pw, ph, accentRgb);
          break;
        case 'editorial':
          this.drawEditorialPages(doc, section, config, pw, ph);
          break;
      }
    }

    if (config.showPageNumbers) {
      this.addPageNumbers(doc, config.showCoverPage ? 1 : 0);
    }

    const slug = (config.title || 'catalog')
      .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    doc.save(`${slug || 'catalog'}.pdf`);
  }

  // ─── HEX TO RGB HELPER ────────────────────────────────────────────────────

  private hexToRgb(hex: string): RGB {
    const fallback: RGB = { r: 201, g: 168, b: 76 };
    if (!hex || !hex.startsWith('#')) return fallback;
    const clean = hex.slice(1);
    if (clean.length !== 6) return fallback;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return fallback;
    return { r, g, b };
  }

  // ─── COVER ────────────────────────────────────────────────────────────────

  private drawCover(
    doc: jsPDFType,
    config: CatalogPdfConfig,
    sections: ProductSection[],
    pw: number,
    ph: number,
    accentRgb: RGB
  ): void {
    this.fillRect(doc, C.dark, 0, 0, pw, ph);

    const firstImage = sections[0]?.products[0]?.images[0];
    if (firstImage?.dataUrl) {
      try {
        doc.addImage(firstImage.dataUrl, this.fmt(firstImage.mimeType), 0, 0, pw, ph, undefined, 'FAST');
        doc.setFillColor(C.dark.r, C.dark.g, C.dark.b);
        doc.setGState(doc.GState({ opacity: 0.78 }));
        doc.rect(0, 0, pw, ph, 'F');
        doc.setGState(doc.GState({ opacity: 1 }));
      } catch { /* leave dark bg */ }
    }

    const cx = pw / 2;

    this.hRule(doc, accentRgb, cx - 20, ph * 0.35, 40);

    if (config.brand) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(C.white.r, C.white.g, C.white.b);
      doc.setCharSpace(6);
      doc.text(config.brand.toUpperCase(), cx, ph * 0.42, { align: 'center' });
      doc.setCharSpace(0);
    }

    if (config.title) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(config.brand ? 13 : 22);
      doc.setTextColor(C.white.r, C.white.g, C.white.b);
      doc.text(config.title, cx, ph * 0.50, { align: 'center' });
    }

    if (config.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
      doc.text(config.subtitle, cx, ph * 0.56, { align: 'center' });
    }

    this.hRule(doc, accentRgb, cx - 20, ph * 0.61, 40);

    const tags = sections.map(s => s.name.toUpperCase());
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.setCharSpace(2);
    doc.text(tags.join('   ·   '), cx, ph * 0.84, { align: 'center' });
    doc.setCharSpace(0);
  }

  // ─── SECTION DIVIDER ──────────────────────────────────────────────────────

  private drawSectionDivider(
    doc: jsPDFType,
    section: ProductSection,
    pw: number,
    ph: number,
    accentRgb: RGB
  ): void {
    this.fillRect(doc, C.dark, 0, 0, pw, ph);

    const coverProduct = section.featuredProductId
      ? (section.products.find(p => p.id === section.featuredProductId) ?? section.products[0])
      : section.products[0];
    const firstImage = coverProduct?.images[0];
    if (firstImage?.dataUrl) {
      try {
        doc.addImage(firstImage.dataUrl, this.fmt(firstImage.mimeType), 0, 0, pw, ph, undefined, 'FAST');
        doc.setFillColor(C.dark.r, C.dark.g, C.dark.b);
        doc.setGState(doc.GState({ opacity: 0.72 }));
        doc.rect(0, 0, pw, ph, 'F');
        doc.setGState(doc.GState({ opacity: 1 }));
      } catch { /* leave dark bg */ }
    }

    const cx = pw / 2;

    this.hRule(doc, accentRgb, cx - 18, ph * 0.43, 36);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(36);
    doc.setTextColor(C.white.r, C.white.g, C.white.b);
    doc.setCharSpace(8);
    doc.text(section.name.toUpperCase(), cx, ph * 0.52, { align: 'center' });
    doc.setCharSpace(0);

    if (section.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
      doc.text(section.subtitle, cx, ph * 0.60, { align: 'center' });
    }

    this.hRule(doc, accentRgb, cx - 18, ph * 0.66, 36);
  }

  // ─── MINIMAL LAYOUT ───────────────────────────────────────────────────────

  private drawMinimalPages(
    doc: jsPDFType,
    section: ProductSection,
    config: CatalogPdfConfig,
    enabledFields: FieldConfig[],
    pw: number,
    ph: number,
    accentRgb: RGB
  ): void {
    const margin = 14;
    const gap = 4;
    const headerH = 12;
    const footerH = 8;
    const contentW = pw - margin * 2;
    const contentH = ph - margin * 2 - headerH - footerH;
    const y0 = margin + headerH;

    const cols = config.columns;
    const cellW = (contentW - gap * (cols - 1)) / cols;
    const imageH = cellW * 0.78;

    const enabledKeys = enabledFields.map(f => f.key);
    const hasName = enabledKeys.includes('name');
    const hasPrice = enabledKeys.includes('price') || enabledKeys.includes('salePrice');
    let textH: number;
    if (hasName && hasPrice) {
      textH = 10;
    } else if (hasName || hasPrice) {
      textH = 6;
    } else {
      textH = 2;
    }

    const cardH = imageH + textH;
    const rowH = cardH + gap;
    const rowsPerPage = Math.max(1, Math.floor(contentH / rowH));
    const perPage = cols * rowsPerPage;
    const totalPages = Math.ceil(section.products.length / perPage);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (pageIdx > 0) doc.addPage();

      this.drawPageHeader(doc, config, section.name, pageIdx + 1, totalPages, margin, pw, margin + 2, accentRgb);

      const pageProducts = section.products.slice(pageIdx * perPage, (pageIdx + 1) * perPage);
      let col = 0;
      let row = 0;

      for (const product of pageProducts) {
        const x = margin + col * (cellW + gap);
        const y = y0 + row * rowH;

        // Draw image
        const primaryImage = product.images[0];
        if (primaryImage) {
          this.placeImage(doc, primaryImage.dataUrl, primaryImage.mimeType, x, y, cellW, imageH);
        } else {
          this.drawPlaceholder(doc, x, y, cellW, imageH, product.name || '');
        }

        // Draw badge chips
        if (product.badges.length > 0) {
          this.drawBadgeChips(doc, product.badges, x + 1.5, y + 1.5);
        }

        // Draw text area
        let textY = y + imageH + 1.5;
        if (hasName && product.name) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(C.ink.r, C.ink.g, C.ink.b);
          const nameText = (doc.splitTextToSize(product.name, cellW) as string[])[0] ?? '';
          doc.text(nameText, x, textY + 4);
          textY += 5;
        }
        if (enabledKeys.includes('price') || enabledKeys.includes('salePrice')) {
          const hasSaleEnabled = enabledKeys.includes('salePrice');
          if (hasSaleEnabled && product.salePrice) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(C.accent.r, C.accent.g, C.accent.b);
            doc.text(`${config.currency}${product.salePrice}`, x, textY + 4);
            if (enabledKeys.includes('price') && product.price) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6);
              doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
              doc.text(`${config.currency}${product.price}`, x + doc.getTextWidth(`${config.currency}${product.salePrice}`) + 1.5, textY + 4);
            }
          } else if (enabledKeys.includes('price') && product.price) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
            doc.text(`${config.currency}${product.price}`, x, textY + 4);
          }
        }

        col++;
        if (col >= cols) {
          col = 0;
          row++;
        }
      }

      this.drawPageFooter(doc, config, pw, ph, margin, footerH, accentRgb);
    }
  }

  // ─── DETAILED LAYOUT ──────────────────────────────────────────────────────

  private drawDetailedPages(
    doc: jsPDFType,
    section: ProductSection,
    config: CatalogPdfConfig,
    enabledFields: FieldConfig[],
    pw: number,
    ph: number,
    accentRgb: RGB
  ): void {
    const margin = 14;
    const gap = 4;
    const headerH = 12;
    const footerH = 8;
    const contentW = pw - margin * 2;
    const contentH = ph - margin * 2 - headerH - footerH;
    const y0 = margin + headerH;

    const cols = Math.min(config.columns, 3) as 2 | 3;
    const cellW = (contentW - gap * (cols - 1)) / cols;
    const imageH = cellW * 0.65;

    const enabledKeys = enabledFields.map(f => f.key);

    // Compute textH
    let textH = 4; // top pad
    const hasPriceRow = enabledKeys.includes('price') || enabledKeys.includes('salePrice');

    for (const key of enabledKeys) {
      switch (key as FieldKey) {
        case 'name':          textH += 5; break;
        case 'price':
        case 'salePrice':     /* handled combined */; break;
        case 'description':   textH += 7; break;
        case 'sku':
        case 'category':      /* handled combined */; break;
        case 'dimensions':
        case 'materials':
        case 'colors':        textH += 4; break;
        case 'longDescription': textH += 10; break;
        case 'notes':         textH += 4; break;
      }
    }
    if (hasPriceRow) textH += 5;
    // sku+category counted once if either present
    if (enabledKeys.includes('sku') || enabledKeys.includes('category')) textH += 4;
    textH += 3; // bot pad
    textH = Math.max(20, Math.min(50, textH));

    const cardH = imageH + textH;
    const rowH = cardH + gap;
    const rowsPerPage = Math.max(1, Math.floor(contentH / rowH));
    const perPage = cols * rowsPerPage;
    const totalPages = Math.ceil(section.products.length / perPage);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      if (pageIdx > 0) doc.addPage();

      this.drawPageHeader(doc, config, section.name, pageIdx + 1, totalPages, margin, pw, margin + 2, accentRgb);

      const pageProducts = section.products.slice(pageIdx * perPage, (pageIdx + 1) * perPage);
      let col = 0;
      let row = 0;

      for (const product of pageProducts) {
        const x = margin + col * (cellW + gap);
        const y = y0 + row * rowH;
        const w = cellW;
        const h = cardH;

        // Thin border rect
        doc.setDrawColor(C.surface.r, C.surface.g, C.surface.b);
        doc.setLineWidth(0.25);
        doc.rect(x, y, w, h, 'S');

        // Image
        const primaryImage = product.images[0];
        if (primaryImage) {
          this.placeImage(doc, primaryImage.dataUrl, primaryImage.mimeType, x, y, w, imageH);
        } else {
          this.drawPlaceholder(doc, x, y, w, imageH, product.name || '');
        }

        // Badges
        if (product.badges.length > 0) {
          this.drawBadgeChips(doc, product.badges, x + 1.5, y + 1.5);
        }

        // Text fields
        this.drawDetailedText(doc, product, enabledFields, config, x, y + imageH, w, textH, accentRgb);

        col++;
        if (col >= cols) {
          col = 0;
          row++;
        }
      }

      this.drawPageFooter(doc, config, pw, ph, margin, footerH, accentRgb);
    }
  }

  private drawDetailedText(
    doc: jsPDFType,
    product: Product,
    enabledFields: FieldConfig[],
    config: CatalogPdfConfig,
    x: number,
    y: number,
    w: number,
    maxH: number,
    accentRgb: RGB
  ): void {
    let curY = y + 3;
    const bottom = y + maxH;
    const enabledKeys = enabledFields.map(f => f.key);

    let skuCatDone = false;
    let priceDone = false;

    for (const fc of enabledFields) {
      if (curY > bottom) break;

      switch (fc.key as FieldKey) {
        case 'name':
          if (product.name) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(C.ink.r, C.ink.g, C.ink.b);
            const n = (doc.splitTextToSize(product.name, w - 2) as string[])[0] ?? '';
            doc.text(n, x + 1, curY + 4);
            curY += 5;
          }
          break;

        case 'price':
        case 'salePrice':
          if (!priceDone) {
            priceDone = true;
            const hasSale = enabledKeys.includes('salePrice') && !!product.salePrice;
            if (hasSale) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7);
              doc.setTextColor(C.accent.r, C.accent.g, C.accent.b);
              doc.text(`${config.currency}${product.salePrice}`, x + 1, curY + 4);
              if (enabledKeys.includes('price') && product.price) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
                doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
                const saleW = doc.getTextWidth(`${config.currency}${product.salePrice}`);
                doc.text(`${config.currency}${product.price}`, x + 1 + saleW + 1.5, curY + 4);
              }
            } else if (enabledKeys.includes('price') && product.price) {
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7);
              doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
              doc.text(`${config.currency}${product.price}`, x + 1, curY + 4);
            }
            curY += 5;
          }
          break;

        case 'description':
          if (product.description) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
            const lines = (doc.splitTextToSize(product.description, w - 2) as string[]).slice(0, 2);
            lines.forEach((line, i) => {
              if (curY + i * 3.5 + 4 < bottom) doc.text(line, x + 1, curY + i * 3.5 + 4);
            });
            curY += lines.length * 3.5 + 1;
          }
          break;

        case 'sku':
        case 'category':
          if (!skuCatDone) {
            skuCatDone = true;
            const parts: string[] = [];
            if (enabledKeys.includes('sku') && product.sku) parts.push(product.sku);
            if (enabledKeys.includes('category') && product.category) parts.push(product.category);
            if (parts.length > 0) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(5.5);
              doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
              const txt = (doc.splitTextToSize(parts.join(' · '), w - 2) as string[])[0] ?? '';
              doc.text(txt, x + 1, curY + 4);
              curY += 4;
            }
          }
          break;

        case 'dimensions':
          if (product.dimensions) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
            const txt = (doc.splitTextToSize(product.dimensions, w - 2) as string[])[0] ?? '';
            doc.text(txt, x + 1, curY + 4);
            curY += 4;
          }
          break;

        case 'materials':
          if (product.materials) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
            const txt = (doc.splitTextToSize(product.materials, w - 2) as string[])[0] ?? '';
            doc.text(txt, x + 1, curY + 4);
            curY += 4;
          }
          break;

        case 'colors':
          if (product.colors) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.5);
            doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
            const txt = (doc.splitTextToSize(product.colors, w - 2) as string[])[0] ?? '';
            doc.text(txt, x + 1, curY + 4);
            curY += 4;
          }
          break;

        case 'longDescription':
          if (product.longDescription) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
            const lines = (doc.splitTextToSize(product.longDescription, w - 2) as string[]).slice(0, 3);
            lines.forEach((line, i) => {
              if (curY + i * 3.5 + 4 < bottom) doc.text(line, x + 1, curY + i * 3.5 + 4);
            });
            curY += lines.length * 3.5 + 1;
          }
          break;

        case 'notes':
          if (product.notes) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(5.5);
            doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
            const txt = (doc.splitTextToSize(product.notes, w - 2) as string[])[0] ?? '';
            doc.text(txt, x + 1, curY + 4);
            curY += 4;
          }
          break;
      }
    }
  }

  // ─── EDITORIAL LAYOUT ─────────────────────────────────────────────────────

  private drawEditorialPages(
    doc: jsPDFType,
    section: ProductSection,
    config: CatalogPdfConfig,
    pw: number,
    ph: number
  ): void {
    const margin = 14;
    const GAP = 3;
    const headerH = 12;
    const footerH = 8;
    const contentW = pw - margin * 2;
    const contentH = ph - margin * 2 - headerH - footerH;
    const y0 = margin + headerH;

    const accentRgb = this.hexToRgb(config.accentColor);
    const unitW = (contentW - GAP * (COLLAGE_VCOLS - 1)) / COLLAGE_VCOLS;
    const collagePaged = buildCollagePages(section.products);
    const totalPages = collagePaged.length;

    for (let pageIdx = 0; pageIdx < collagePaged.length; pageIdx++) {
      if (pageIdx > 0) doc.addPage();

      const { items, layout } = collagePaged[pageIdx];

      const unitH = layout.totalRows > 0
        ? (contentH - GAP * (layout.totalRows - 1)) / layout.totalRows
        : 22;

      this.drawPageHeader(doc, config, section.name, pageIdx + 1, totalPages, margin, pw, margin + 2, accentRgb);

      for (let i = 0; i < items.length; i++) {
        const cell = layout.cells[i];
        const item = items[i];

        const x = margin + cell.colStart * (unitW + GAP);
        const y = y0 + cell.rowStart * (unitH + GAP);
        const w = cell.colSpan * unitW + (cell.colSpan - 1) * GAP;
        const h = cell.rowSpan * unitH + (cell.rowSpan - 1) * GAP;

        const primaryImage = item.images[0];
        if (primaryImage) {
          this.placeImage(doc, primaryImage.dataUrl, primaryImage.mimeType, x, y, w, h);
        } else {
          this.drawPlaceholder(doc, x, y, w, h, item.name || '');
        }

        // Badges
        if (item.badges.length > 0) {
          this.drawBadgeChips(doc, item.badges, x + 1.5, y + 1.5);
        }

        // Name/price overlay
        if ((config.showNameOverlay || config.showPriceOverlay) && (item.name || item.price)) {
          const overlayH = 8;
          doc.setFillColor(C.dark.r, C.dark.g, C.dark.b);
          doc.rect(x, y + h - overlayH, w, overlayH, 'F');
          doc.setGState(doc.GState({ opacity: 0.7 }));
          doc.rect(x, y + h - overlayH, w, overlayH, 'F');
          doc.setGState(doc.GState({ opacity: 1 }));

          if (config.showNameOverlay && item.name) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(C.white.r, C.white.g, C.white.b);
            doc.text(item.name, x + 1.5, y + h - overlayH + 5);
          }

          if (config.showPriceOverlay && (item.salePrice || item.price)) {
            const priceText = `${config.currency}${item.salePrice || item.price}`;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(C.accent.r, C.accent.g, C.accent.b);
            doc.text(priceText, x + w - 1.5, y + h - overlayH + 5, { align: 'right' });
          }
        }
      }

      this.drawPageFooter(doc, config, pw, ph, margin, footerH, accentRgb);
    }
  }

  // ─── BADGE CHIPS ──────────────────────────────────────────────────────────

  private drawBadgeChips(doc: jsPDFType, badges: BadgeType[], x: number, y: number): void {
    const badgeColors: Record<BadgeType, RGB> = {
      new:        C.accent,
      featured:   { r: 123, g: 97,  b: 255 },
      sale:       { r: 220, g: 60,  b: 60  },
      bestseller: C.gold,
      limited:    C.muted,
    };

    let curX = x;
    const maxBadges = Math.min(badges.length, 2);

    for (let i = 0; i < maxBadges; i++) {
      const badge = badges[i];
      const color = badgeColors[badge];
      const label = badge.toUpperCase();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      const textW = doc.getTextWidth(label);
      const chipW = textW + 3;
      const chipH = 3.5;

      doc.setFillColor(color.r, color.g, color.b);
      doc.rect(curX, y, chipW, chipH, 'F');

      doc.setTextColor(C.dark.r, C.dark.g, C.dark.b);
      doc.text(label, curX + 1.5, y + chipH - 0.8);

      curX += chipW + 1.5;
    }
  }

  // ─── PAGE CHROME ──────────────────────────────────────────────────────────

  private drawPageHeader(
    doc: jsPDFType,
    config: CatalogPdfConfig,
    sectionName: string,
    pageNum: number,
    totalPages: number,
    margin: number,
    pw: number,
    y: number,
    accentRgb: RGB
  ): void {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(C.ink.r, C.ink.g, C.ink.b);
    doc.setCharSpace(4);
    if (config.brand) doc.text(config.brand.toUpperCase(), margin, y + 5);
    doc.setCharSpace(0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.setCharSpace(2);
    doc.text(sectionName.toUpperCase(), pw / 2, y + 5, { align: 'center' });
    doc.setCharSpace(0);

    if (totalPages > 0) {
      doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
      doc.setFontSize(7);
      const label = `${String(pageNum).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`;
      doc.text(label, pw - margin, y + 5, { align: 'right' });
    }

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.25);
    doc.line(margin, y + 8, pw - margin, y + 8);
  }

  private drawPageFooter(
    doc: jsPDFType,
    config: CatalogPdfConfig,
    pw: number,
    ph: number,
    margin: number,
    footerH: number,
    accentRgb: RGB
  ): void {
    const y = ph - margin - footerH + 2;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.25);
    doc.line(margin, y, pw - margin, y);

    if (config.brand) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
      doc.setCharSpace(3);
      doc.text(config.brand.toUpperCase(), margin, y + 4);
      doc.setCharSpace(0);
    }

    if (config.title) {
      doc.setFontSize(6);
      doc.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
      doc.text(config.title, pw / 2, y + 4, { align: 'center' });
    }
  }

  // ─── PAGE NUMBERS ─────────────────────────────────────────────────────────

  private addPageNumbers(doc: jsPDFType, skipFirst: number): void {
    const total = (doc.internal as unknown as { getNumberOfPages(): number }).getNumberOfPages();
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    for (let p = skipFirst + 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
      doc.text(`${p - skipFirst}`, pw - 14, ph - 5, { align: 'right' });
    }
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private placeImage(
    doc: jsPDFType,
    dataUrl: string,
    mimeType: string,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    if (!dataUrl) {
      this.drawPlaceholder(doc, x, y, w, h, '');
      return;
    }
    try {
      doc.addImage(dataUrl, this.fmt(mimeType), x, y, w, h, undefined, 'FAST');
    } catch {
      this.drawPlaceholder(doc, x, y, w, h, '');
    }
  }

  private drawPlaceholder(doc: jsPDFType, x: number, y: number, w: number, h: number, label: string): void {
    doc.setFillColor(C.surface.r, C.surface.g, C.surface.b);
    doc.setDrawColor(50, 60, 90);
    doc.setLineWidth(0.25);
    doc.rect(x, y, w, h, 'FD');
    if (label) {
      doc.setFontSize(6.5);
      doc.setTextColor(C.muted.r, C.muted.g, C.muted.b);
      const short = label.length > 22 ? label.slice(0, 20) + '…' : label;
      doc.text(short, x + w / 2, y + h / 2, { align: 'center' });
    }
  }

  private fillRect(doc: jsPDFType, c: RGB, x: number, y: number, w: number, h: number): void {
    doc.setFillColor(c.r, c.g, c.b);
    doc.rect(x, y, w, h, 'F');
  }

  private hRule(doc: jsPDFType, c: RGB, x: number, y: number, w: number): void {
    doc.setDrawColor(c.r, c.g, c.b);
    doc.setLineWidth(0.4);
    doc.line(x, y, x + w, y);
  }

  private fmt(mimeType: string): string {
    if (mimeType.includes('png')) return 'PNG';
    if (mimeType.includes('gif')) return 'GIF';
    if (mimeType.includes('webp')) return 'WEBP';
    return 'JPEG';
  }

  // ─── STATIC UTILITIES ─────────────────────────────────────────────────────

  static readFile(file: File): Promise<{ dataUrl: string; naturalWidth: number; naturalHeight: number }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const img = new Image();
        img.onload = () => resolve({ dataUrl, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
        img.onerror = () => resolve({ dataUrl, naturalWidth: 1, naturalHeight: 1 });
        img.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
