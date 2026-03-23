"""Agent 3 — Development Agent.

Reads the plan, reads 2 existing tool components as patterns, sends everything to Claude,
writes the generated Angular files, and updates routing / module / tools list.
Output: runs/YYYY-MM-DD/03_dev.json
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.claude_client import call_claude_json

# Two levels: pipeline/agents/ → pipeline/ → repo root
REPO_ROOT = Path(__file__).parent.parent.parent


# ---------------------------------------------------------------------------
# System prompt for code generation
# ---------------------------------------------------------------------------

SYSTEM = """\
You are an expert Angular developer. You will generate a complete, fully functional
Angular tool component for a dark-themed glassmorphism developer tools website.

CRITICAL RULES — violating any of these will break the build:

1.  `standalone: false` in @Component (this is a module-based app, NOT standalone)
2.  Import `Router` from '@angular/router'
3.  Import `SITE_URL` from '../../seo.service'
4.  Import `TranslationService` from '../../translation.service'
5.  Inject both in the constructor: `constructor(private router: Router, private translationService: TranslationService)`
6.  Include `translate(key: string): string { return this.translationService.translate(key); }`
7.  Include `goBack(): void { this.router.navigate(['/tools']); }`
8.  Use template directives `*ngIf` and `*ngFor` — NOT `@if`/`@for` (Angular 16 syntax only)
9.  CSS must use ONLY these CSS variables for theme colors (no hardcoded hex values):
      --primary-color, --secondary-color, --highlight-color
      --surface-color, --surface-strong, --surface-hover
      --glass-border, --glass-border-strong
      --shadow-soft, --shadow-strong
      --text-color, --text-muted
      --radius-md, --radius-lg
      --font-heading, --font-body
10. The HTML must include:
      - `.back-link` button with chevron SVG calling `goBack()`
      - `.tool-header` with `.tool-header__eyebrow`, `.tool-header__title`, `.tool-header__subtitle`
      - `.tool-header__share` with Twitter and LinkedIn share buttons
      - The tool's actual functional UI
11. The component logic must be FULLY FUNCTIONAL — no placeholder code, no TODO comments.
    Implement real working algorithms in TypeScript (e.g. actual conversion logic, parsing, etc.)
12. Include a share Twitter URL and LinkedIn URL as readonly class properties using SITE_URL.
13. The component file imports (styleUrls, templateUrl) must use the slug-based filename pattern.

Return ONLY valid JSON with these exact top-level keys (no markdown, no extra text):
{
  "component_ts": "...full .ts file content as a JSON string...",
  "component_html": "...full .html file content as a JSON string...",
  "component_css": "...full .css file content as a JSON string...",
  "icon_svg_paths": "...SVG inner markup for the tool card icon (viewBox 24x24, stroke-based)..."
}

All file contents must be complete, valid, and ready to write directly to disk.
Escape all special characters correctly for JSON strings (newlines as \\n, quotes as \\", etc.)."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_tool_source(slug: str) -> str:
    """Read all source files of an existing tool and return them concatenated."""
    tool_dir = REPO_ROOT / "src" / "app" / "tools" / slug
    parts: list[str] = []
    for suffix in (".component.ts", ".component.html", ".component.css"):
        f = tool_dir / (slug + suffix)
        if f.exists():
            parts.append(f"=== {f.name} ===\n{f.read_text()}")
    return "\n\n".join(parts)


def _escape_single_quotes(s: str) -> str:
    return s.replace("'", "\\'")


def _build_route_entry(tool: dict, class_name: str) -> str:
    """Return the TypeScript route object literal to insert into app-routing.module.ts."""
    slug = tool["slug"]
    name = tool["name"].replace("'", "\\'")
    seo_title = tool.get("seo_title", f"{name} | xsantcastx").replace("'", "\\'")
    seo_desc = tool.get("seo_description", tool.get("description", "")).replace("'", "\\'")
    keywords = tool.get("seo_keywords", "").replace("'", "\\'")

    return (
        f"  {{\n"
        f"    path: 'tools/{slug}',\n"
        f"    component: {class_name},\n"
        f"    title: '{seo_title}',\n"
        f"    data: {{\n"
        f"      description: '{seo_desc}',\n"
        f"      keywords: '{keywords}',\n"
        f"      ogImage: `${{SITE_URL}}/assets/og/og-default.jpg`,\n"
        f"      jsonLd: {{\n"
        f"        '@context': 'https://schema.org',\n"
        f"        '@type': 'SoftwareApplication',\n"
        f"        name: '{name}',\n"
        f"        url: `${{SITE_URL}}/tools/{slug}`,\n"
        f"        description: '{seo_desc}',\n"
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
    routing_file = REPO_ROOT / "src" / "app" / "app-routing.module.ts"
    content = routing_file.read_text()

    slug = tool["slug"]
    import_line = f"import {{ {class_name} }} from './tools/{slug}/{slug}.component';"

    # Insert import before the RouteTitles import
    if import_line in content:
        print("[development] Routing import already present — skipping import insertion.")
    else:
        content = content.replace(
            "import { RouteTitles }",
            f"{import_line}\nimport {{ RouteTitles }}",
        )

    # Insert route entry before the catch-all redirect
    redirect_anchor = "{ path: '', redirectTo: '/home', pathMatch: 'full' }"
    if f"path: 'tools/{slug}'" in content:
        print("[development] Route entry already present — skipping route insertion.")
    else:
        route_entry = _build_route_entry(tool, class_name)
        content = content.replace(
            redirect_anchor,
            f"{route_entry}\n  {redirect_anchor}",
        )

    routing_file.write_text(content)
    print("[development] Updated app-routing.module.ts")


def _update_module(class_name: str, slug: str) -> None:
    module_file = REPO_ROOT / "src" / "app" / "app.module.ts"
    content = module_file.read_text()

    import_line = f"import {{ {class_name} }} from './tools/{slug}/{slug}.component';"

    if import_line in content:
        print("[development] Module import already present — skipping.")
    else:
        # Insert before NewsFeedComponent import
        content = content.replace(
            "import { NewsFeedComponent }",
            f"{import_line}\nimport {{ NewsFeedComponent }}",
        )

    if f"{class_name}," in content:
        print("[development] Module declaration already present — skipping.")
    else:
        # Insert in declarations array after ImageCompressorComponent
        content = content.replace(
            "    ImageCompressorComponent,\n    NewsFeedComponent,",
            f"    ImageCompressorComponent,\n    {class_name},\n    NewsFeedComponent,",
        )

    module_file.write_text(content)
    print("[development] Updated app.module.ts")


def _update_tools_list(tool: dict, icon_svg: str) -> None:
    tools_file = REPO_ROOT / "src" / "app" / "tools" / "tools.component.ts"
    content = tools_file.read_text()

    slug = tool["slug"]

    if f"id: '{slug}'" in content:
        print("[development] Tool card already present — skipping.")
        return

    name = _escape_single_quotes(tool["name"])
    desc = _escape_single_quotes(tool["description"])
    tags_ts = "[" + ", ".join(f"'{t}'" for t in tool.get("tags", [])) + "]"

    new_card = (
        f"      {{\n"
        f"        id: '{slug}',\n"
        f"        title: '{name}',\n"
        f"        description: '{desc}',\n"
        f"        route: '/tools/{slug}',\n"
        f"        status: 'live',\n"
        f"        tags: {tags_ts},\n"
        f"        icon: `{icon_svg}`\n"
        f"      }},\n"
    )

    # Insert before the gradient-generator (first coming-soon entry)
    anchor = "      {\n        id: 'gradient-generator',"
    if anchor not in content:
        print("[development] WARNING: could not find gradient-generator anchor — appending to array instead.")
        # Fallback: insert before the closing bracket of the return array
        content = content.replace(
            "    ];\n  }",
            f"{new_card}    ];\n  }}",
        )
    else:
        content = content.replace(anchor, f"{new_card}{anchor}")

    tools_file.write_text(content)
    print("[development] Updated tools.component.ts")


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run(run_dir: Path) -> dict:
    output_path = run_dir / "03_dev.json"

    if output_path.exists():
        print("[development] Output already exists — skipping.")
        return json.loads(output_path.read_text())

    plan_path = run_dir / "02_plan.json"
    if not plan_path.exists():
        raise FileNotFoundError(f"Plan not found: {plan_path}")

    plan = json.loads(plan_path.read_text())
    tool = plan["tool"]
    slug = tool["slug"]
    spec = tool["component_spec"]
    class_name: str = spec["angular_class_name"]

    print(f"[development] Generating: {tool['name']} ({slug})")
    print(f"[development] Class: {class_name}")

    # Read 2 existing tools as pattern examples
    example_color = _read_tool_source("color-palette")
    example_compressor = _read_tool_source("image-compressor")

    # Read key files for context
    routing_content = (REPO_ROOT / "src" / "app" / "app-routing.module.ts").read_text()
    tools_ts_content = (REPO_ROOT / "src" / "app" / "tools" / "tools.component.ts").read_text()

    prompt = (
        f"Tool specification:\n{json.dumps(tool, indent=2, ensure_ascii=False)}\n\n"
        f"The Angular class name must be exactly: {class_name}\n"
        f"The selector must be exactly: {spec['angular_selector']}\n"
        f"The slug/folder name is: {slug}\n\n"
        f"=== EXISTING TOOL EXAMPLE 1 (color-palette — study these patterns carefully) ===\n"
        f"{example_color}\n\n"
        f"=== EXISTING TOOL EXAMPLE 2 (image-compressor — study these patterns carefully) ===\n"
        f"{example_compressor}\n\n"
        f"=== app-routing.module.ts (for import/route pattern reference) ===\n"
        f"{routing_content}\n\n"
        f"=== tools.component.ts (for ToolCard icon pattern reference) ===\n"
        f"{tools_ts_content}\n\n"
        "Generate all 3 component files and the icon SVG. "
        "The component must be FULLY FUNCTIONAL with real working logic — not a stub. "
        "Return valid JSON only."
    )

    generated = call_claude_json(
        system=SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=8096,
    )

    # Write component files
    tool_dir = REPO_ROOT / "src" / "app" / "tools" / slug
    tool_dir.mkdir(parents=True, exist_ok=True)

    (tool_dir / f"{slug}.component.ts").write_text(generated["component_ts"])
    (tool_dir / f"{slug}.component.html").write_text(generated["component_html"])
    (tool_dir / f"{slug}.component.css").write_text(generated["component_css"])
    print(f"[development] Wrote 3 component files to {tool_dir}")

    # Update routing, module, and tools list
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
    print(f"[development] Manifest saved → {output_path}")
    return result
