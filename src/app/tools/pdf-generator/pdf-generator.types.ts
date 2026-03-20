// ─── Type aliases ──────────────────────────────────────────────────────────

export type FieldKey =
  | 'name'
  | 'description'
  | 'longDescription'
  | 'price'
  | 'salePrice'
  | 'sku'
  | 'category'
  | 'dimensions'
  | 'materials'
  | 'colors'
  | 'notes';

export type BadgeType = 'new' | 'featured' | 'sale' | 'bestseller' | 'limited';

export type PdfTemplate = 'minimal' | 'detailed' | 'editorial';

export type ColumnCount = 2 | 3 | 4;

// ─── Interfaces ────────────────────────────────────────────────────────────

export interface FieldConfig {
  key: FieldKey;
  label: string;
  enabled: boolean;
}

export interface ProductImage {
  id: string;
  file: File | null;
  dataUrl: string;
  mimeType: string;
  naturalWidth: number;
  naturalHeight: number;
  isPrimary: boolean;
}

export interface Product {
  id: string;
  images: ProductImage[];
  name: string;
  description: string;
  longDescription: string;
  price: string;
  salePrice: string;
  sku: string;
  category: string;
  dimensions: string;
  materials: string;
  colors: string;
  notes: string;
  badges: BadgeType[];
}

/** Pick of all string-valued fields on Product — used in updateProductField for strict-safe indexing. */
export type ProductStringFields = Pick<Product,
  'name' | 'description' | 'longDescription' | 'price' | 'salePrice' |
  'sku' | 'category' | 'dimensions' | 'materials' | 'colors' | 'notes'
>;

export interface ProductSection {
  id: string;
  name: string;
  subtitle: string;
  products: Product[];
  collapsed: boolean;
  featuredProductId: string | null;
}

export interface CatalogPdfConfig {
  title: string;
  subtitle: string;
  brand: string;
  pageSize: 'a4' | 'letter';
  template: PdfTemplate;
  columns: ColumnCount;
  currency: string;
  showPageNumbers: boolean;
  showCoverPage: boolean;
  showSectionDividers: boolean;
  showNameOverlay: boolean;
  showPriceOverlay: boolean;
  accentColor: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const DEFAULT_FIELD_CONFIGS: FieldConfig[] = [
  { key: 'name',            label: 'Name',             enabled: true  },
  { key: 'description',     label: 'Description',      enabled: true  },
  { key: 'price',           label: 'Price',            enabled: true  },
  { key: 'salePrice',       label: 'Sale price',       enabled: false },
  { key: 'sku',             label: 'SKU',              enabled: false },
  { key: 'category',        label: 'Category',         enabled: false },
  { key: 'dimensions',      label: 'Dimensions',       enabled: false },
  { key: 'materials',       label: 'Materials',        enabled: false },
  { key: 'colors',          label: 'Colors / Finish',  enabled: false },
  { key: 'longDescription', label: 'Long description', enabled: false },
  { key: 'notes',           label: 'Notes',            enabled: false },
];

export const BADGE_LABELS: Record<BadgeType, string> = {
  new:        'New',
  featured:   'Featured',
  sale:       'Sale',
  bestseller: 'Bestseller',
  limited:    'Limited',
};
