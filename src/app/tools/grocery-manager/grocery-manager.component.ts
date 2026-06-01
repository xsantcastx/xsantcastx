import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';

/** Internal grocery categories — each mapped to a cosmic palette color in CSS. */
type GroceryCategory =
  | 'Produce'
  | 'Meat & Fish'
  | 'Dairy & Sandwich'
  | 'Bakery'
  | 'Pantry'
  | 'Drinks'
  | 'Other';

interface GroceryItem {
  id: string;
  name: string;          // English
  nameEs: string;        // Spanish
  emoji: string;
  category: GroceryCategory;
  qty: number;
  recurring: boolean;    // "I always get this"
  intervalDays: number;  // repurchase cadence in days (0 = never auto-suggest)
  lastPurchased: string | null; // ISO date (yyyy-mm-dd) or null
  basePrice: number;     // baseline unit price in EUR
  priceOverride: number | null;
  optional: boolean;
  inCart: boolean;       // on the current shopping list
}

interface Region {
  code: string;
  label: string;
  symbol: string;
  factor: number; // multiplier applied to the EUR baseline (FX + cost-of-living, rough)
}

type StockStatus = 'restock' | 'due' | 'soon' | 'stocked';

@Component({
  selector: 'app-grocery-manager',
  templateUrl: './grocery-manager.component.html',
  styleUrls: ['./grocery-manager.component.css'],
  standalone: false,
})
export class GroceryManagerComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly STORAGE_KEY = 'gm-items-v1';
  private readonly PREFS_KEY = 'gm-prefs-v1';

  readonly categories: GroceryCategory[] = [
    'Produce', 'Meat & Fish', 'Dairy & Sandwich', 'Bakery', 'Pantry', 'Drinks', 'Other',
  ];

  readonly regions: Region[] = [
    { code: 'ES', label: '🇪🇸 Spain', symbol: '€', factor: 1.0 },
    { code: 'EU', label: '🇪🇺 Eurozone', symbol: '€', factor: 1.08 },
    { code: 'UK', label: '🇬🇧 United Kingdom', symbol: '£', factor: 1.05 },
    { code: 'US', label: '🇺🇸 United States', symbol: '$', factor: 1.35 },
    { code: 'CA', label: '🇨🇦 Canada', symbol: 'C$', factor: 1.6 },
    { code: 'AU', label: '🇦🇺 Australia', symbol: 'A$', factor: 1.75 },
    { code: 'MX', label: '🇲🇽 Mexico', symbol: 'MX$', factor: 19 },
  ];

  items: GroceryItem[] = [];
  region: Region = this.regions[0];
  showSpanish = true;
  search = '';
  filterCategory: GroceryCategory | 'All' = 'All';

  // Add-item form state
  draft = this.blankDraft();
  showAddForm = false;
  editingId: string | null = null;

  // Social share
  readonly twitterShareUrl =
    `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Grocery Manager — track staples, get restock reminders, and estimate your bill. No sign-up.')}&url=${encodeURIComponent(SITE_URL + '/tools/grocery-manager')}`;
  readonly linkedInShareUrl =
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/grocery-manager')}`;

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.loadPrefs();
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.items = JSON.parse(stored) as GroceryItem[];
      } catch {
        this.items = [];
      }
    }
    if (this.items.length === 0) {
      this.items = this.starterList();
      this.persist();
    }
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Today helper (date-only) ────────────────────────────────
  private todayISO(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private daysBetween(fromISO: string, toISO: string): number {
    const a = new Date(fromISO + 'T00:00:00');
    const b = new Date(toISO + 'T00:00:00');
    return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
  }

  // ── Stock / recommendation logic ────────────────────────────
  daysSince(item: GroceryItem): number | null {
    if (!item.lastPurchased) return null;
    return this.daysBetween(item.lastPurchased, this.todayISO());
  }

  status(item: GroceryItem): StockStatus {
    if (!item.recurring || item.intervalDays <= 0) return 'stocked';
    const since = this.daysSince(item);
    if (since === null) return 'restock';
    if (since >= item.intervalDays) return 'due';
    if (since >= item.intervalDays * 0.8) return 'soon';
    return 'stocked';
  }

  statusLabel(item: GroceryItem): string {
    switch (this.status(item)) {
      case 'restock': return 'Never bought';
      case 'due': return 'Due now';
      case 'soon': return 'Due soon';
      default: return 'Stocked';
    }
  }

  /** Recurring items that need attention and aren't already on the list. */
  get suggestions(): GroceryItem[] {
    return this.items
      .filter(i => !i.inCart)
      .filter(i => {
        const s = this.status(i);
        return s === 'due' || s === 'restock' || s === 'soon';
      })
      .sort((a, b) => this.urgency(b) - this.urgency(a));
  }

  private urgency(item: GroceryItem): number {
    const s = this.status(item);
    if (s === 'restock') return 1000;
    const since = this.daysSince(item);
    if (since === null) return 999;
    return since - item.intervalDays; // overdue amount; higher = more urgent
  }

  // ── Pricing ─────────────────────────────────────────────────
  unitPrice(item: GroceryItem): number {
    const base = item.priceOverride != null ? item.priceOverride : item.basePrice;
    return base * this.region.factor;
  }

  linePrice(item: GroceryItem): number {
    return this.unitPrice(item) * Math.max(1, item.qty);
  }

  fmt(value: number): string {
    const decimals = this.region.factor >= 10 ? 0 : 2;
    return `${this.region.symbol}${value.toFixed(decimals)}`;
  }

  get cartItems(): GroceryItem[] {
    return this.items.filter(i => i.inCart);
  }

  get cartTotal(): number {
    return this.cartItems.reduce((sum, i) => sum + this.linePrice(i), 0);
  }

  get cartCount(): number {
    return this.cartItems.length;
  }

  // ── Filtered list for the main grid ─────────────────────────
  get filteredItems(): GroceryItem[] {
    const q = this.search.trim().toLowerCase();
    return this.items.filter(i => {
      if (this.filterCategory !== 'All' && i.category !== this.filterCategory) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.nameEs.toLowerCase().includes(q)
      );
    });
  }

  itemsInCategory(cat: GroceryCategory): GroceryItem[] {
    return this.filteredItems.filter(i => i.category === cat);
  }

  get visibleCategories(): GroceryCategory[] {
    return this.categories.filter(c => this.itemsInCategory(c).length > 0);
  }

  // ── Item actions ────────────────────────────────────────────
  toggleCart(item: GroceryItem): void {
    item.inCart = !item.inCart;
    this.persist();
  }

  addSuggestionToCart(item: GroceryItem): void {
    item.inCart = true;
    this.persist();
  }

  addAllSuggestions(): void {
    this.suggestions.forEach(i => (i.inCart = true));
    this.persist();
  }

  /** Mark as purchased: stamp today, drop from the active cart. */
  markPurchased(item: GroceryItem): void {
    item.lastPurchased = this.todayISO();
    item.inCart = false;
    this.persist();
  }

  /** Bulk: everything in the cart is bought → stamp + clear. */
  checkoutCart(): void {
    const today = this.todayISO();
    this.cartItems.forEach(i => {
      i.lastPurchased = today;
      i.inCart = false;
    });
    this.persist();
  }

  changeQty(item: GroceryItem, delta: number): void {
    item.qty = Math.max(1, item.qty + delta);
    this.persist();
  }

  deleteItem(item: GroceryItem): void {
    this.items = this.items.filter(i => i.id !== item.id);
    this.persist();
  }

  // ── Add / edit form ─────────────────────────────────────────
  private blankDraft(): GroceryItem {
    return {
      id: '',
      name: '',
      nameEs: '',
      emoji: '🛒',
      category: 'Produce',
      qty: 1,
      recurring: true,
      intervalDays: 7,
      lastPurchased: null,
      basePrice: 1.5,
      priceOverride: null,
      optional: false,
      inCart: false,
    };
  }

  openAddForm(): void {
    this.editingId = null;
    this.draft = this.blankDraft();
    this.showAddForm = true;
  }

  openEditForm(item: GroceryItem): void {
    this.editingId = item.id;
    this.draft = { ...item };
    this.showAddForm = true;
  }

  cancelForm(): void {
    this.showAddForm = false;
    this.editingId = null;
    this.draft = this.blankDraft();
  }

  saveDraft(): void {
    const name = this.draft.name.trim();
    if (!name) return;
    if (this.editingId) {
      const idx = this.items.findIndex(i => i.id === this.editingId);
      if (idx > -1) this.items[idx] = { ...this.draft, id: this.editingId };
    } else {
      this.items.unshift({ ...this.draft, id: this.uid() });
    }
    this.persist();
    this.cancelForm();
  }

  private uid(): string {
    return 'g' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  // ── Bulk utilities ──────────────────────────────────────────
  loadStarterList(): void {
    const existing = new Set(this.items.map(i => i.name.toLowerCase()));
    const fresh = this.starterList().filter(i => !existing.has(i.name.toLowerCase()));
    this.items = [...this.items, ...fresh];
    this.persist();
  }

  clearAll(): void {
    this.items = [];
    this.persist();
  }

  clearCart(): void {
    this.items.forEach(i => (i.inCart = false));
    this.persist();
  }

  // ── Persistence + prefs ─────────────────────────────────────
  private persist(): void {
    if (!this.isBrowser) return;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.items));
  }

  setRegion(code: string): void {
    const r = this.regions.find(x => x.code === code);
    if (r) this.region = r;
    this.savePrefs();
  }

  toggleSpanish(): void {
    this.showSpanish = !this.showSpanish;
    this.savePrefs();
  }

  private savePrefs(): void {
    if (!this.isBrowser) return;
    localStorage.setItem(
      this.PREFS_KEY,
      JSON.stringify({ region: this.region.code, showSpanish: this.showSpanish })
    );
  }

  private loadPrefs(): void {
    const raw = localStorage.getItem(this.PREFS_KEY);
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      const r = this.regions.find(x => x.code === p.region);
      if (r) this.region = r;
      if (typeof p.showSpanish === 'boolean') this.showSpanish = p.showSpanish;
    } catch {
      /* ignore */
    }
  }

  trackById(_: number, item: GroceryItem): string {
    return item.id;
  }

  // ── Seed: the user's own list ───────────────────────────────
  private starterList(): GroceryItem[] {
    const mk = (
      name: string,
      nameEs: string,
      emoji: string,
      category: GroceryCategory,
      basePrice: number,
      intervalDays: number,
      optional = false
    ): GroceryItem => ({
      id: this.uid(),
      name,
      nameEs,
      emoji,
      category,
      qty: 1,
      recurring: !optional,
      intervalDays,
      lastPurchased: null,
      basePrice,
      priceOverride: null,
      optional,
      inCart: false,
    });

    return [
      // PRODUCE
      mk('Potatoes', 'patatas', '🥔', 'Produce', 1.5, 14),
      mk('Apples', 'manzanas', '🍎', 'Produce', 2.0, 7),
      mk('Pears', 'peras', '🍐', 'Produce', 2.0, 7),
      mk('Strawberries', 'fresas', '🍓', 'Produce', 2.5, 7),
      mk('Pineapple', 'piña', '🍍', 'Produce', 1.8, 14),
      mk('Avocado', 'aguacate', '🥑', 'Produce', 1.2, 7),
      mk('Lettuce', 'lechuga', '🥬', 'Produce', 1.0, 7),
      mk('Onion + garlic', 'cebolla + ajo', '🧅', 'Produce', 1.5, 14),
      mk('Banana', 'plátano', '🍌', 'Produce', 1.5, 7),
      mk('Lemon', 'limón', '🍋', 'Produce', 1.0, 14, true),
      mk('Carrots', 'zanahorias', '🥕', 'Produce', 1.0, 14, true),
      mk('Tomatoes', 'tomates', '🍅', 'Produce', 2.0, 7, true),
      // MEAT & FISH
      mk('Chicken', 'pollo', '🍗', 'Meat & Fish', 5.0, 7),
      mk('Hake fillet', 'filete de merluza', '🐟', 'Meat & Fish', 4.0, 14),
      mk('Ground beef', 'carne picada', '🥩', 'Meat & Fish', 4.5, 7),
      mk('Shredded beef', 'carne desmechada', '🥩', 'Meat & Fish', 5.0, 14),
      // DAIRY & SANDWICH
      mk('Sliced cheese', 'queso en lonchas', '🧀', 'Dairy & Sandwich', 2.5, 14),
      mk('Butter (real)', 'mantequilla', '🧈', 'Dairy & Sandwich', 2.0, 21),
      mk('Almond milk', 'leche de almendra', '🥛', 'Dairy & Sandwich', 1.8, 10),
      mk('Sour cream', 'nata / crema', '🥛', 'Dairy & Sandwich', 1.5, 21),
      // BAKERY
      mk('Bread', 'pan', '🍞', 'Bakery', 1.2, 5),
      mk('Burrito wraps', 'tortillas', '🌯', 'Bakery', 2.0, 21),
      // PANTRY
      mk('Pasta', 'pasta', '🍝', 'Pantry', 1.0, 30),
      mk('Rice', 'arroz', '🍚', 'Pantry', 1.5, 45),
      mk('Black beans', 'frijoles', '🫘', 'Pantry', 1.2, 30),
      mk('Tea', 'té', '🍵', 'Pantry', 2.5, 45),
      mk('Coffee', 'café', '☕', 'Pantry', 4.0, 30),
      mk('Chicken soup', 'sopa de pollo', '🍲', 'Pantry', 1.5, 30),
      mk('Olive oil', 'aceite de oliva', '🫒', 'Pantry', 6.0, 60),
      mk('Salt cookies', 'galletas saladas', '🍪', 'Pantry', 1.5, 21),
      // DRINKS
      mk('Water', 'agua', '💧', 'Drinks', 2.0, 7),
      mk('Sparkling water', 'agua con gas', '🫧', 'Drinks', 2.0, 7),
      // OTHER
      mk('Ice bags', 'bolsas de hielo', '🧊', 'Other', 2.0, 14),
      mk('Frozen veggies', 'verdura congelada', '🥦', 'Other', 2.5, 21),
    ];
  }
}
