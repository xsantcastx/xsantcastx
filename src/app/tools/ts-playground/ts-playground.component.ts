import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { SITE_URL } from '../../seo.service';

interface TypeEntry {
  name: string;
  signature: string;
  description: string;
  explanation: string;
  example: string;
  category: 'utility' | 'mapped' | 'conditional' | 'infer';
}

interface GenericExample {
  title: string;
  code: string;
  explanation: string;
}

@Component({
  selector: 'app-ts-playground',
  templateUrl: './ts-playground.component.html',
  styleUrls: ['./ts-playground.component.css'],
  standalone: false
})
export class TsPlaygroundComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('TypeScript Type Playground — explore utility types, generics & more interactively. No sign-up')}&url=${encodeURIComponent(SITE_URL + '/tools/ts-playground')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/ts-playground')}`;

  // State
  searchQuery = '';
  selectedType: TypeEntry | null = null;
  activeTab: 'reference' | 'generics' | 'playground' = 'reference';
  copiedSnippet: string | null = null;
  activeCategory: 'all' | 'utility' | 'mapped' | 'conditional' | 'infer' = 'all';

  // Playground
  playgroundInput = `// Write your TypeScript type definitions here\n// and see them explained below.\n\ntype User = {\n  id: number;\n  name: string;\n  email: string;\n  role: 'admin' | 'user' | 'guest';\n};\n\n// Try using utility types:\ntype PartialUser = Partial<User>;\ntype UserName = Pick<User, 'name' | 'email'>;\ntype WithoutEmail = Omit<User, 'email'>;`;
  playgroundExplanation = '';

  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/tools']);
  }

  // ── Type reference data ─────────────────────────────────────

  readonly typeEntries: TypeEntry[] = [
    {
      name: 'Record<K, V>',
      signature: 'type Record<K extends keyof any, T> = { [P in K]: T; }',
      description: 'Constructs an object type whose property keys are K and values are T.',
      explanation: 'Record creates a type with a set of properties K of type T. It is useful for mapping the properties of a type to another type. Think of it as defining a dictionary or lookup table.',
      example: `// Map status codes to messages\ntype StatusMap = Record<'ok' | 'error' | 'loading', string>;\n\nconst status: StatusMap = {\n  ok: 'Success',\n  error: 'Something went wrong',\n  loading: 'Please wait...'\n};\n\n// Dynamic key indexing\ntype UserRoles = Record<string, boolean>;\nconst roles: UserRoles = { admin: true, editor: false };`,
      category: 'mapped'
    },
    {
      name: 'Partial<T>',
      signature: 'type Partial<T> = { [P in keyof T]?: T[P]; }',
      description: 'Makes all properties in T optional.',
      explanation: 'Partial takes a type and makes every property optional (adds ? to each). This is perfect for update functions where you only want to change some fields, or for providing default configurations.',
      example: `interface Config {\n  host: string;\n  port: number;\n  debug: boolean;\n}\n\n// All fields become optional\ntype PartialConfig = Partial<Config>;\n\n// Useful for update patterns\nfunction updateConfig(current: Config, updates: Partial<Config>): Config {\n  return { ...current, ...updates };\n}\n\nupdateConfig(defaultConfig, { debug: true }); // only override debug`,
      category: 'mapped'
    },
    {
      name: 'Required<T>',
      signature: 'type Required<T> = { [P in keyof T]-?: T[P]; }',
      description: 'Makes all properties in T required (removes optionality).',
      explanation: 'Required is the opposite of Partial. The -? syntax removes the optional modifier from each property. Use it when you need to ensure all fields are provided, for example after validation.',
      example: `interface FormData {\n  name?: string;\n  email?: string;\n  age?: number;\n}\n\n// All fields are now mandatory\ntype CompleteForm = Required<FormData>;\n\n// This would error:\n// const form: CompleteForm = { name: 'Alice' };\n// Missing: email, age\n\nconst form: CompleteForm = {\n  name: 'Alice',\n  email: 'alice@example.com',\n  age: 30\n};`,
      category: 'mapped'
    },
    {
      name: 'Omit<T, K>',
      signature: 'type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>',
      description: 'Constructs a type by picking all properties from T and then removing K.',
      explanation: 'Omit creates a new type by taking an existing type and excluding specific properties. It is the inverse of Pick. Commonly used to create types for database inserts (omitting auto-generated fields like id).',
      example: `interface Article {\n  id: number;\n  title: string;\n  body: string;\n  createdAt: Date;\n  author: string;\n}\n\n// Remove auto-generated fields for creation\ntype NewArticle = Omit<Article, 'id' | 'createdAt'>;\n\nconst draft: NewArticle = {\n  title: 'TypeScript Tips',\n  body: 'Utility types are powerful...',\n  author: 'Dev'\n};`,
      category: 'utility'
    },
    {
      name: 'Pick<T, K>',
      signature: 'type Pick<T, K extends keyof T> = { [P in K]: T[P]; }',
      description: 'Constructs a type by picking the set of properties K from T.',
      explanation: 'Pick creates a type by selecting specific properties from another type. It is like destructuring at the type level. Use it to create focused interfaces from larger ones.',
      example: `interface User {\n  id: number;\n  name: string;\n  email: string;\n  avatar: string;\n  role: string;\n}\n\n// Only the fields needed for a card\ntype UserCard = Pick<User, 'name' | 'avatar'>;\n\n// Only the fields needed for auth\ntype AuthUser = Pick<User, 'id' | 'email' | 'role'>;\n\nconst card: UserCard = {\n  name: 'Alice',\n  avatar: 'https://...'\n};`,
      category: 'mapped'
    },
    {
      name: 'Extract<T, U>',
      signature: 'type Extract<T, U> = T extends U ? T : never',
      description: 'Extracts from T those types that are assignable to U.',
      explanation: 'Extract filters a union type, keeping only the members assignable to U. Think of it as an intersection for union types. It is the opposite of Exclude.',
      example: `type AllEvents = 'click' | 'scroll' | 'mousemove' | 'keydown' | 'keyup';\n\n// Keep only mouse-related events\ntype MouseEvents = Extract<AllEvents, 'click' | 'scroll' | 'mousemove'>;\n// Result: 'click' | 'scroll' | 'mousemove'\n\n// Extract specific shapes\ntype Shape = { kind: 'circle'; r: number } | { kind: 'rect'; w: number; h: number };\ntype Circle = Extract<Shape, { kind: 'circle' }>;\n// Result: { kind: 'circle'; r: number }`,
      category: 'conditional'
    },
    {
      name: 'Exclude<T, U>',
      signature: 'type Exclude<T, U> = T extends U ? never : T',
      description: 'Excludes from T those types that are assignable to U.',
      explanation: 'Exclude removes types from a union that match U. It distributes over union members, checking each one. Use it to filter out unwanted variants.',
      example: `type Status = 'active' | 'inactive' | 'banned' | 'pending';\n\n// Remove negative statuses\ntype PositiveStatus = Exclude<Status, 'banned' | 'inactive'>;\n// Result: 'active' | 'pending'\n\n// Remove null and undefined\ntype MaybeString = string | null | undefined;\ntype DefiniteString = Exclude<MaybeString, null | undefined>;\n// Result: string`,
      category: 'conditional'
    },
    {
      name: 'ReturnType<T>',
      signature: 'type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any',
      description: 'Extracts the return type of a function type.',
      explanation: 'ReturnType uses the infer keyword to extract what a function returns. This is incredibly useful when you want to type a variable based on what a function produces, without manually duplicating the type.',
      example: `function createUser(name: string, age: number) {\n  return { id: Math.random(), name, age, createdAt: new Date() };\n}\n\n// Automatically infer the return shape\ntype User = ReturnType<typeof createUser>;\n// Result: { id: number; name: string; age: number; createdAt: Date }\n\n// Works with arrow functions too\ntype ParseResult = ReturnType<typeof JSON.parse>;\n// Result: any`,
      category: 'infer'
    },
    {
      name: 'Parameters<T>',
      signature: 'type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never',
      description: 'Extracts the parameter types of a function type as a tuple.',
      explanation: 'Parameters extracts function argument types as a tuple. Use it to create wrapper functions or to reference argument types without repeating them. Combined with spread, it enables perfect forwarding.',
      example: `function sendEmail(to: string, subject: string, body: string, urgent: boolean) {\n  // ...\n}\n\n// Extract the parameter types as a tuple\ntype EmailParams = Parameters<typeof sendEmail>;\n// Result: [string, string, string, boolean]\n\n// Use individual params\ntype Recipient = EmailParams[0]; // string\ntype IsUrgent = EmailParams[3];  // boolean\n\n// Perfect forwarding\nfunction logAndSend(...args: Parameters<typeof sendEmail>) {\n  console.log('Sending to:', args[0]);\n  return sendEmail(...args);\n}`,
      category: 'infer'
    },
    {
      name: 'Awaited<T>',
      signature: 'type Awaited<T> = T extends null | undefined ? T : T extends object & { then(onfulfilled: infer F, ...args: infer _): any } ? F extends ((value: infer V, ...args: infer _) => any) ? Awaited<V> : never : T',
      description: 'Recursively unwraps the "awaited type" of a Promise.',
      explanation: 'Awaited unwraps Promise types, even nested ones. It mirrors what happens when you use await in async code. It handles Promise<Promise<T>> by recursively unwrapping to T.',
      example: `// Simple unwrap\ntype A = Awaited<Promise<string>>;\n// Result: string\n\n// Nested promises\ntype B = Awaited<Promise<Promise<number>>>;\n// Result: number\n\n// Practical: extract API response type\nasync function fetchUser(id: string) {\n  const res = await fetch(\`/api/users/\${id}\`);\n  return res.json() as Promise<{ name: string; email: string }>;\n}\n\ntype UserData = Awaited<ReturnType<typeof fetchUser>>;\n// Result: { name: string; email: string }`,
      category: 'infer'
    },
    {
      name: 'NonNullable<T>',
      signature: 'type NonNullable<T> = T & {}',
      description: 'Excludes null and undefined from T.',
      explanation: 'NonNullable strips null and undefined from a type. It is a shorthand for Exclude<T, null | undefined>. Essential when working with strict null checks and you need to guarantee a value exists.',
      example: `type MaybeUser = string | null | undefined;\n\ntype DefiniteUser = NonNullable<MaybeUser>;\n// Result: string\n\n// Practical: after null check\nfunction processName(name: string | null | undefined) {\n  if (name == null) return;\n  // TypeScript narrows, but NonNullable is useful in generics:\n  const clean: NonNullable<typeof name> = name;\n  return clean.toUpperCase();\n}\n\n// With arrays\ntype Items = (string | null | undefined)[];\ntype CleanItems = NonNullable<Items[number]>[]; // string[]`,
      category: 'conditional'
    }
  ];

  // ── Generics explainer ──────────────────────────────────────

  readonly genericExamples: GenericExample[] = [
    {
      title: 'What are Generics?',
      code: `// Generics let you write reusable code that works with any type.\n// Think of <T> as a "type variable" — a placeholder filled in later.\n\nfunction identity<T>(value: T): T {\n  return value;\n}\n\nconst num = identity(42);       // T = number\nconst str = identity('hello');  // T = string`,
      explanation: 'Generics add a type parameter (usually T) that acts as a placeholder. TypeScript infers the actual type from usage, giving you type safety without sacrificing flexibility.'
    },
    {
      title: 'Generic Constraints',
      code: `// Use "extends" to constrain what types T can be.\n\ninterface HasLength {\n  length: number;\n}\n\nfunction logLength<T extends HasLength>(item: T): void {\n  console.log(item.length);\n}\n\nlogLength('hello');     // OK: string has .length\nlogLength([1, 2, 3]);   // OK: array has .length\n// logLength(42);       // Error: number has no .length`,
      explanation: 'Constraints (T extends X) restrict the types that can be passed in. This lets you safely access properties or methods on the generic type while keeping it flexible.'
    },
    {
      title: 'Multiple Type Parameters',
      code: `// You can use multiple type parameters for relationships.\n\nfunction map<T, U>(arr: T[], fn: (item: T) => U): U[] {\n  return arr.map(fn);\n}\n\nconst nums = [1, 2, 3];\nconst strs = map(nums, n => String(n));\n// T = number, U = string, result: string[]\n\n// Key-value pair with two generics\ntype Pair<K, V> = { key: K; value: V };\nconst entry: Pair<string, number> = { key: 'age', value: 30 };`,
      explanation: 'Multiple type parameters let you describe relationships between inputs and outputs. TypeScript infers each parameter independently, maintaining type connections throughout.'
    },
    {
      title: 'Generic Interfaces & Classes',
      code: `// Generics work with interfaces and classes too.\n\ninterface Repository<T> {\n  findById(id: string): Promise<T | null>;\n  save(entity: T): Promise<T>;\n  delete(id: string): Promise<void>;\n}\n\nclass InMemoryRepo<T extends { id: string }> implements Repository<T> {\n  private items = new Map<string, T>();\n\n  async findById(id: string) { return this.items.get(id) ?? null; }\n  async save(entity: T) { this.items.set(entity.id, entity); return entity; }\n  async delete(id: string) { this.items.delete(id); }\n}`,
      explanation: 'Generic interfaces define contracts that work with any type. Generic classes implement those contracts while maintaining type safety. This is the foundation of patterns like Repository, Observable, and Result.'
    },
    {
      title: 'Conditional Types & infer',
      code: `// Conditional types choose between types based on a condition.\n\ntype IsString<T> = T extends string ? 'yes' : 'no';\n\ntype A = IsString<'hello'>; // 'yes'\ntype B = IsString<42>;      // 'no'\n\n// "infer" extracts types within conditional checks\ntype UnwrapArray<T> = T extends Array<infer Item> ? Item : T;\n\ntype C = UnwrapArray<string[]>;  // string\ntype D = UnwrapArray<number>;    // number (not an array, returns T)`,
      explanation: 'Conditional types (T extends U ? X : Y) act like ternary operators for types. The infer keyword lets you capture and extract part of a type within the condition, which is how ReturnType, Parameters, and Awaited work internally.'
    },
    {
      title: 'Default Type Parameters',
      code: `// Generics can have default values, just like function params.\n\ninterface ApiResponse<T = unknown, E = Error> {\n  data: T | null;\n  error: E | null;\n  status: number;\n}\n\n// Use defaults\nconst res1: ApiResponse = { data: null, error: null, status: 200 };\n\n// Override specific params\nconst res2: ApiResponse<User> = { data: user, error: null, status: 200 };\n\n// Override both\nconst res3: ApiResponse<User, CustomError> = { ... };`,
      explanation: 'Default type parameters (T = Default) provide fallback types when none is specified. This makes generic types easier to use in simple cases while still allowing full customization.'
    }
  ];

  // ── Filtered types ──────────────────────────────────────────

  get filteredTypes(): TypeEntry[] {
    let types = this.typeEntries;

    if (this.activeCategory !== 'all') {
      types = types.filter(t => t.category === this.activeCategory);
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      types = types.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }

    return types;
  }

  // ── Search with Easter Egg ──────────────────────────────────

  onSearch() {
    const q = this.searchQuery.toLowerCase().trim();
    if (q === 'any') {
      this.eggs.trigger('ts-any');
    }
  }

  // ── Select a type ───────────────────────────────────────────

  selectType(entry: TypeEntry) {
    this.selectedType = this.selectedType === entry ? null : entry;
  }

  // ── Category filter ─────────────────────────────────────────

  setCategory(cat: 'all' | 'utility' | 'mapped' | 'conditional' | 'infer') {
    this.activeCategory = cat;
  }

  getCategoryLabel(cat: string): string {
    const labels: Record<string, string> = {
      utility: 'Utility',
      mapped: 'Mapped',
      conditional: 'Conditional',
      infer: 'Infer'
    };
    return labels[cat] || cat;
  }

  // ── Playground ──────────────────────────────────────────────

  analyzePlayground() {
    if (!this.playgroundInput.trim()) {
      this.playgroundExplanation = '';
      return;
    }

    const lines = this.playgroundInput.split('\n');
    const explanations: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Detect type alias
      const typeMatch = trimmed.match(/^type\s+(\w+)(?:<[^>]*>)?\s*=\s*(.+);?\s*$/);
      if (typeMatch) {
        const [, name, definition] = typeMatch;
        explanations.push(this.explainDefinition(name, definition));
        continue;
      }

      // Detect interface
      const ifaceMatch = trimmed.match(/^interface\s+(\w+)(?:<[^>]*>)?\s*\{?/);
      if (ifaceMatch) {
        explanations.push(`Interface "${ifaceMatch[1]}" defines an object shape with typed properties.`);
        continue;
      }
    }

    this.playgroundExplanation = explanations.length > 0
      ? explanations.join('\n\n')
      : 'Type your TypeScript type definitions above to see explanations. Try using type aliases, interfaces, and utility types.';
  }

  private explainDefinition(name: string, def: string): string {
    const d = def.trim().replace(/;$/, '');

    if (d.match(/^Partial<(.+)>$/)) {
      const inner = d.match(/^Partial<(.+)>$/)![1];
      return `"${name}" makes all properties of ${inner} optional. Each field can be omitted when creating a value of this type.`;
    }
    if (d.match(/^Required<(.+)>$/)) {
      const inner = d.match(/^Required<(.+)>$/)![1];
      return `"${name}" makes all properties of ${inner} required. No field can be omitted.`;
    }
    if (d.match(/^Pick<(.+),\s*(.+)>$/)) {
      const m = d.match(/^Pick<(.+),\s*(.+)>$/)!;
      return `"${name}" selects only the properties ${m[2]} from ${m[1]}, creating a narrower type.`;
    }
    if (d.match(/^Omit<(.+),\s*(.+)>$/)) {
      const m = d.match(/^Omit<(.+),\s*(.+)>$/)!;
      return `"${name}" takes all properties from ${m[1]} except ${m[2]}.`;
    }
    if (d.match(/^Record<(.+),\s*(.+)>$/)) {
      const m = d.match(/^Record<(.+),\s*(.+)>$/)!;
      return `"${name}" creates an object type with keys of type ${m[1]} and values of type ${m[2]}.`;
    }
    if (d.match(/^ReturnType<(.+)>$/)) {
      const inner = d.match(/^ReturnType<(.+)>$/)![1];
      return `"${name}" extracts the return type of ${inner}.`;
    }
    if (d.match(/^Parameters<(.+)>$/)) {
      const inner = d.match(/^Parameters<(.+)>$/)![1];
      return `"${name}" extracts the parameter types of ${inner} as a tuple.`;
    }
    if (d.match(/^Awaited<(.+)>$/)) {
      const inner = d.match(/^Awaited<(.+)>$/)![1];
      return `"${name}" unwraps the Promise type of ${inner} to get the resolved value type.`;
    }
    if (d.match(/^NonNullable<(.+)>$/)) {
      const inner = d.match(/^NonNullable<(.+)>$/)![1];
      return `"${name}" removes null and undefined from ${inner}.`;
    }
    if (d.match(/^Extract<(.+),\s*(.+)>$/)) {
      const m = d.match(/^Extract<(.+),\s*(.+)>$/)!;
      return `"${name}" extracts from ${m[1]} only those types assignable to ${m[2]}.`;
    }
    if (d.match(/^Exclude<(.+),\s*(.+)>$/)) {
      const m = d.match(/^Exclude<(.+),\s*(.+)>$/)!;
      return `"${name}" excludes from ${m[1]} those types assignable to ${m[2]}.`;
    }
    if (d.includes('|')) {
      return `"${name}" is a union type: it can be any one of ${d}. Values must match at least one variant.`;
    }
    if (d.includes('&')) {
      return `"${name}" is an intersection type combining ${d}. Values must satisfy all constituent types.`;
    }
    if (d.startsWith('{')) {
      return `"${name}" is an object type literal with inline property definitions.`;
    }

    return `"${name}" is defined as: ${d}`;
  }

  // ── Copy to clipboard ──────────────────────────────────────

  async copySnippet(code: string, id: string) {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(code);
      this.copiedSnippet = id;
      setTimeout(() => (this.copiedSnippet = null), 2000);
    } catch {
      this.fallbackCopy(code, id);
    }
  }

  private fallbackCopy(text: string, id: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.copiedSnippet = id;
    setTimeout(() => (this.copiedSnippet = null), 2000);
  }
}
