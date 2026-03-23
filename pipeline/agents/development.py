"""Agent 3 — Development Agent.

Reads the plan, reads 2 existing tool components as patterns, then calls Claude
separately for each file (.ts, .html, .css, icon) to avoid JSON token-limit truncation.
Writes files and patches routing / module / tools list.
Output: runs/YYYY-MM-DD/03_dev.json
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.claude_client import call_claude

REPO_ROOT = Path(__file__).parent.parent.parent

# ---------------------------------------------------------------------------
# Per-file system prompts
# ---------------------------------------------------------------------------

_RULES = """\
CRITICAL RULES — any violation will break the Angular build:
1.  standalone: false in @Component (module-based app, NOT standalone)
2.  Import Router from '@angular/router'
3.  Import SITE_URL from '../../seo.service'
4.  Import TranslationService from '../../translation.service'
5.  Constructor: constructor(private router: Router, private translationService: TranslationService)
6.  Include: translate(key: string): string { return this.translationService.translate(key); }
7.  Include: goBack(): void { this.router.navigate(['/tools']); }
8.  Use *ngIf and *ngFor — NOT @if/@for (Angular 16 template syntax only)
9.  Component must be FULLY FUNCTIONAL with real working logic — no TODO placeholders
10. Include twitterShareUrl and linkedInShareUrl as readonly properties using SITE_URL
"""

TS_SYSTEM = f"""\
You are an expert Angular developer. Generate a single Angular component TypeScript file.

{_RULES}

Return ONLY the raw TypeScript source — no markdown fences, no explanation, no extra text.
The output must start with 'import' and be a complete, valid .ts file."""

HTML_SYSTEM = """\
You are an expert Angular developer. Generate a single Angular component HTML template file.

RULES:
1. Must include a .back-link button with chevron SVG calling goBack()
2. Must include .tool-header with .tool-header__eyebrow, .tool-header__title, .tool-header__subtitle
3. Must include .tool-header__share with Twitter and LinkedIn share buttons (matching the pattern in examples)
4. Use *ngIf and *ngFor — NOT @if/@for
5. Bind to all properties and methods defined in the provided TypeScript component
6. Use glassmorphism card sections matching the existing UI patterns

Return ONLY the raw HTML — no markdown fences, no explanation, no extra text."""

CSS_SYSTEM = """\
You are an expert CSS developer. Generate a CSS file for an Angular component in a dark glassmorphism theme.

RULES:
1. Use ONLY these CSS variables for theme colours (no hardcoded hex values):
   --primary-color, --secondary-color, --highlight-color
   --surface-color, --surface-strong, --surface-hover
   --glass-border, --glass-border-strong
   --shadow-soft, --shadow-strong
   --text-color, --text-muted
   --radius-md, --radius-lg
   --font-heading, --font-body
2. Style all classes referenced in the HTML template
3. Match the glassmorphism card aesthetic of the existing tools
4. Include responsive styles for mobile (max-width: 640px)

Return ONLY the raw CSS — no markdown fences, no explanation, no extra text."""

ICON_SYSTEM = """\
Return ONLY the inner SVG elements for a simple 24x24 icon (viewBox="0 0 24 24").
Use stroke-based paths (stroke="currentColor"). Do NOT include the outer <svg> tag.
Example valid output: <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="4"/>
Return nothing else — no markdown, no explanation."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```[\w]*\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _read_tool_source(slug: str) -> str:
    tool_dir = REPO_ROOT / "src" / "app" / "tools" / slug
    parts: list[str] = []
    for suffix in (".component.ts", ".component.html", ".component.css"):
        f = tool_dir / (slug + suffix)
        if f.exists():
            parts.append(f"=== {f.name} ===\n{f.read_text()}")
    return "\n\n".join(parts)


def _escape_sq(s: str) -> str:
    return s.replace("'", "\\'")


def _generate_files(tool: dict, class_name: str, slug: str) -> dict:
    """Call Claude once per file to avoid JSON token-limit truncation."""
    example1 = _read_tool_source("color-palette")
    example2 = _read_tool_source("image-compressor")
    routing_content = (REPO_ROOT / "src" / "app" / "app-routing.module.ts").read_text()
    tools_ts = (REPO_ROOT / "src" / "app" / "tools" / "tools.component.ts").read_text()

    base = (
        f"Tool specification:\n{json.dumps(tool, indent=2, ensure_ascii=False)}\n\n"
        f"Angular class name: {class_name}\n"
        f"Selector: {tool['component_spec']['angular_selector']}\n"
        f"Slug: {slug}\n\n"
        f"=== EXISTING TOOL EXAMPLE 1 (color-palette) ===\n{example1}\n\n"
        f"=== EXISTING TOOL EXAMPLE 2 (image-compressor) ===\n{example2}\n\n"
        f"=== app-routing.module.ts (import/route pattern reference) ===\n{routing_content}\n\n"
        f"=== tools.component.ts (ToolCard icon pattern reference) ===\n{tools_ts}"
    )

    print("[development] Generating .ts file…")
    ts = _strip_fences(call_claude(
        system=TS_SYSTEM,
        messages=[{"role": "user", "content": base + "\n\nGenerate ONLY the complete .component.ts file. Real working logic, no placeholders."}],
        max_tokens=8096,
    ))

    print("[development] Generating .html file…")
    html = _strip_fences(call_claude(
        system=HTML_SYSTEM,
        messages=[{"role": "user", "content": (
            base
            + f"\n\n=== GENERATED .component.ts (match all bindings) ===\n{ts}"
            + "\n\nGenerate ONLY the complete .component.html file."
        )}],
        max_tokens=4096,
    ))

    print("[development] Generating .css file…")
    css = _strip_fences(call_claude(
        system=CSS_SYSTEM,
        messages=[{"role": "user", "content": (
            base
            + f"\n\n=== GENERATED .component.html (style all classes in this template) ===\n{html}"
            + "\n\nGenerate ONLY the complete .component.css file."
        )}],
        max_tokens=4096,
    ))

    print("[development] Generating icon SVG…")
    icon = _strip_fences(call_claude(
        system=ICON_SYSTEM,
        messages=[{"role": "user", "content": f"Icon for: {tool['name']} — {tool['description']}"}],
        max_tokens=256,
    ))

    return {"component_ts": ts, "component_html": html, "component_css": css, "icon_svg_paths": icon}


# ---------------------------------------------------------------------------
# Angular file patchers
# ---------------------------------------------------------------------------

def _build_route_entry(tool: dict, class_name: str) -> str:
    slug = tool["slug"]
    name = _escape_sq(tool["name"])
    title = _escape_sq(tool.get("seo_title", f"{tool['name']} | xsantcastx"))
    desc = _escape_sq(tool.get("seo_description", tool.get("description", "")))
    kw = _escape_sq(tool.get("seo_keywords", ""))
    return (
        f"  {{\n"
        f"    path: 'tools/{slug}',\n"
        f"    component: {class_name},\n"
        f"    title: '{title}',\n"
        f"    data: {{\n"
        f"      description: '{desc}',\n"
        f"      keywords: '{kw}',\n"
        f"      ogImage: `${{SITE_URL}}/assets/og/og-default.jpg`,\n"
        f"      jsonLd: {{\n"
        f"        '@context': 'https://schema.org',\n"
        f"        '@type': 'SoftwareApplication',\n"
        f"        name: '{name}',\n"
        f"        url: `${{SITE_URL}}/tools/{slug}`,\n"
        f"        description: '{desc}',\n"
        f"        applicationCategory: 'UtilitiesApplication',\n"
        f"        operatingSystem: 'Any Web Browser',\n"
        f"        offers: {{ '@type': 'Offer', price: '0', priceCurrency: 'USD' }},\n"
        f"        breadcrumb: {{\n"
        f"          '@type': 'BreadcrumbList',\n"
        f"          itemListElement: [\n"
        f"            {{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${{SITE_URL}}/tools` }},\n"
        f"            {{ '@type': 'ListItem', position: 2, name: '{name}', item: `${{SITE_URL}}/tools/{slug}` }}\n"
        f"          ]\n"
        f"        }}\n"
        f"      }}\n"
        f"    }}\n"
        f"  }},"
    )


def _update_routing(tool: dict, class_name: str) -> None:
    f = REPO_ROOT / "src" / "app" / "app-routing.module.ts"
    content = f.read_text()
    slug = tool["slug"]
    imp = f"import {{ {class_name} }} from './tools/{slug}/{slug}.component';"
    if imp not in content:
        content = content.replace("import { RouteTitles }", f"{imp}\nimport {{ RouteTitles }}")
    anchor = "{ path: '', redirectTo: '/home', pathMatch: 'full' }"
    if f"path: 'tools/{slug}'" not in content:
        content = content.replace(anchor, f"{_build_route_entry(tool, class_name)}\n  {anchor}")
    f.write_text(content)
    print("[development] Updated app-routing.module.ts")


def _update_module(class_name: str, slug: str) -> None:
    f = REPO_ROOT / "src" / "app" / "app.module.ts"
    content = f.read_text()
    imp = f"import {{ {class_name} }} from './tools/{slug}/{slug}.component';"
    if imp not in content:
        content = content.replace("import { NewsFeedComponent }", f"{imp}\nimport {{ NewsFeedComponent }}")
    if f"{class_name}," not in content:
        content = content.replace(
            "    ImageCompressorComponent,\n    NewsFeedComponent,",
            f"    ImageCompressorComponent,\n    {class_name},\n    NewsFeedComponent,",
        )
    f.write_text(content)
    print("[development] Updated app.module.ts")


def _update_tools_list(tool: dict, icon: str) -> None:
    f = REPO_ROOT / "src" / "app" / "tools" / "tools.component.ts"
    content = f.read_text()
    slug = tool["slug"]
    if f"id: '{slug}'" in content:
        print("[development] Tool card already present — skipping.")
        return
    name = _escape_sq(tool["name"])
    desc = _escape_sq(tool["description"])
    tags_ts = "[" + ", ".join(f"'{t}'" for t in tool.get("tags", [])) + "]"
    card = (
        f"      {{\n"
        f"        id: '{slug}',\n"
        f"        title: '{name}',\n"
        f"        description: '{desc}',\n"
        f"        route: '/tools/{slug}',\n"
        f"        status: 'live',\n"
        f"        tags: {tags_ts},\n"
        f"        icon: `{icon}`\n"
        f"      }},\n"
    )
    anchor = "      {\n        id: 'gradient-generator',"
    if anchor in content:
        content = content.replace(anchor, f"{card}{anchor}")
    else:
        content = content.replace("    ];\n  }", f"{card}    ];\n  }}")
    f.write_text(content)
    print("[development] Updated tools.component.ts")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run(run_dir: Path) -> dict:
    output_path = run_dir / "03_dev.json"
    if output_path.exists():
        print("[development] Output already exists — skipping.")
        return json.loads(output_path.read_text())

    plan = json.loads((run_dir / "02_plan.json").read_text())
    tool = plan["tool"]
    slug = tool["slug"]
    class_name: str = tool["component_spec"]["angular_class_name"]

    print(f"[development] Tool: {tool['name']} ({slug})")
    print(f"[development] Class: {class_name}")

    generated = _generate_files(tool, class_name, slug)

    # Write component files
    tool_dir = REPO_ROOT / "src" / "app" / "tools" / slug
    tool_dir.mkdir(parents=True, exist_ok=True)
    (tool_dir / f"{slug}.component.ts").write_text(generated["component_ts"])
    (tool_dir / f"{slug}.component.html").write_text(generated["component_html"])
    (tool_dir / f"{slug}.component.css").write_text(generated["component_css"])
    print(f"[development] Wrote 3 component files to src/app/tools/{slug}/")

    _update_routing(tool, class_name)
    _update_module(class_name, slug)
    _update_tools_list(tool, generated.get("icon_svg_paths", ""))

    result = {
        "slug": slug,
        "tool_name": tool["name"],
        "class_name": class_name,
        "files_written": [
            f"src/app/tools/{slug}/{slug}.component.ts",
            f"src/app/tools/{slug}/{slug}.component.html",
            f"src/app/tools/{slug}/{slug}.component.css",
        ],
        "files_updated": [
            "src/app/app-routing.module.ts",
            "src/app/app.module.ts",
            "src/app/tools/tools.component.ts",
        ],
    }
    output_path.write_text(json.dumps(result, indent=2))
    print(f"[development] Manifest → {output_path}")
    return result
