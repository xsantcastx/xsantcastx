"""Agent 3 — Development Agent.

Uses claude-sonnet-4-6 (quality needed for code).
Generates each file in a separate plain-text call — no JSON, no truncation risk.
Context is trimmed: examples capped at 2500 chars each to control token spend.
Output: runs/YYYY-MM-DD/03_dev.json
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.claude_client import call_claude, SONNET

REPO_ROOT = Path(__file__).parent.parent.parent

MAX_EXAMPLE_CHARS = 2500  # cap per example file to limit input tokens

# ---------------------------------------------------------------------------
# System prompts
# ---------------------------------------------------------------------------

_RULES = """\
RULES (violating any will break the build):
- standalone: false in @Component
- Import Router, SITE_URL from '../../seo.service', TranslationService from '../../translation.service'
- constructor(private router: Router, private translationService: TranslationService)
- translate(key: string): string { return this.translationService.translate(key); }
- goBack(): void { this.router.navigate(['/tools']); }
- Use *ngIf/*ngFor NOT @if/@for
- Fully functional logic — no TODO placeholders
- twitterShareUrl and linkedInShareUrl readonly properties using SITE_URL
"""

TS_SYSTEM = f"Expert Angular developer. Generate a complete .component.ts file.\n{_RULES}\nReturn ONLY raw TypeScript — no markdown, no explanation."

HTML_SYSTEM = """\
Expert Angular developer. Generate a complete .component.html template.
Must include: .back-link button (goBack()), .tool-header (.tool-header__eyebrow/title/subtitle),
.tool-header__share (Twitter + LinkedIn), and the tool UI.
Use *ngIf/*ngFor only. Bind to all properties/methods in the TS file.
Return ONLY raw HTML — no markdown, no explanation."""

CSS_SYSTEM = """\
Expert CSS developer. Generate a complete .component.css file for a dark glassmorphism Angular tool.
Use ONLY CSS variables: --primary-color, --secondary-color, --highlight-color, --surface-color,
--surface-strong, --surface-hover, --glass-border, --glass-border-strong, --shadow-soft,
--shadow-strong, --text-color, --text-muted, --radius-md, --radius-lg, --font-heading, --font-body.
No hardcoded hex colours. Include mobile responsive styles (max-width: 640px).
Return ONLY raw CSS — no markdown, no explanation."""

ICON_SYSTEM = "Return ONLY inner SVG elements for a 24x24 stroke icon. No <svg> wrapper. Example: <path d=\"M3 3h18v18H3z\"/>. Nothing else."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```[\w]*\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _read_example(slug: str) -> str:
    """Read one existing tool's .ts + .html trimmed to MAX_EXAMPLE_CHARS total."""
    tool_dir = REPO_ROOT / "src" / "app" / "tools" / slug
    parts: list[str] = []
    for suffix in (".component.ts", ".component.html"):
        f = tool_dir / (slug + suffix)
        if f.exists():
            content = f.read_text()[:MAX_EXAMPLE_CHARS]
            parts.append(f"--- {f.name} ---\n{content}")
    return "\n".join(parts)


def _esc(s: str) -> str:
    return s.replace("'", "\\'")


# ---------------------------------------------------------------------------
# Code generation
# ---------------------------------------------------------------------------

def _generate_files(tool: dict, class_name: str, slug: str) -> dict:
    ex1 = _read_example("color-palette")
    ex2 = _read_example("image-compressor")

    base = (
        f"Spec:\n{json.dumps(tool, indent=2, ensure_ascii=False)}\n\n"
        f"Class: {class_name} | Selector: {tool['component_spec']['angular_selector']} | Slug: {slug}\n\n"
        f"Example 1 (color-palette):\n{ex1}\n\nExample 2 (image-compressor):\n{ex2}"
    )

    print("[development] Generating .ts…")
    ts = _strip_fences(call_claude(
        system=TS_SYSTEM,
        messages=[{"role": "user", "content": base + "\n\nGenerate the complete .component.ts file."}],
        max_tokens=4096, model=SONNET,
    ))

    print("[development] Generating .html…")
    html = _strip_fences(call_claude(
        system=HTML_SYSTEM,
        messages=[{"role": "user", "content":
            base + f"\n\nTS file:\n{ts[:3000]}\n\nGenerate the complete .component.html file."}],
        max_tokens=4096, model=SONNET,
    ))

    print("[development] Generating .css…")
    css = _strip_fences(call_claude(
        system=CSS_SYSTEM,
        messages=[{"role": "user", "content":
            base + f"\n\nHTML template:\n{html[:2000]}\n\nGenerate the complete .component.css file."}],
        max_tokens=4096, model=SONNET,
    ))

    print("[development] Generating icon…")
    icon = _strip_fences(call_claude(
        system=ICON_SYSTEM,
        messages=[{"role": "user", "content": f"Icon for: {tool['name']}"}],
        max_tokens=150, model=SONNET,
    ))

    return {"component_ts": ts, "component_html": html, "component_css": css, "icon_svg_paths": icon}


# ---------------------------------------------------------------------------
# Angular file patchers
# ---------------------------------------------------------------------------

def _route_entry(tool: dict, class_name: str) -> str:
    slug, name = tool["slug"], _esc(tool["name"])
    title = _esc(tool.get("seo_title", f"{tool['name']} | xsantcastx"))
    desc  = _esc(tool.get("seo_description", tool.get("description", "")))
    kw    = _esc(tool.get("seo_keywords", ""))
    return (
        f"  {{\n    path: 'tools/{slug}',\n    component: {class_name},\n"
        f"    title: '{title}',\n"
        f"    data: {{\n      description: '{desc}',\n      keywords: '{kw}',\n"
        f"      ogImage: `${{SITE_URL}}/assets/og/og-default.jpg`,\n"
        f"      jsonLd: {{\n        '@context': 'https://schema.org',\n"
        f"        '@type': 'SoftwareApplication',\n        name: '{name}',\n"
        f"        url: `${{SITE_URL}}/tools/{slug}`,\n        description: '{desc}',\n"
        f"        applicationCategory: 'UtilitiesApplication',\n"
        f"        operatingSystem: 'Any Web Browser',\n"
        f"        offers: {{ '@type': 'Offer', price: '0', priceCurrency: 'USD' }},\n"
        f"        breadcrumb: {{\n          '@type': 'BreadcrumbList',\n"
        f"          itemListElement: [\n"
        f"            {{ '@type': 'ListItem', position: 1, name: 'Tools', item: `${{SITE_URL}}/tools` }},\n"
        f"            {{ '@type': 'ListItem', position: 2, name: '{name}', item: `${{SITE_URL}}/tools/{slug}` }}\n"
        f"          ]\n        }}\n      }}\n    }}\n  }},"
    )


def _patch_routing(tool: dict, class_name: str) -> None:
    f = REPO_ROOT / "src" / "app" / "app-routing.module.ts"
    c = f.read_text()
    slug = tool["slug"]
    imp = f"import {{ {class_name} }} from './tools/{slug}/{slug}.component';"
    if imp not in c:
        c = c.replace("import { RouteTitles }", f"{imp}\nimport {{ RouteTitles }}")
    if f"path: 'tools/{slug}'" not in c:
        anchor = "{ path: '', redirectTo: '/home', pathMatch: 'full' }"
        c = c.replace(anchor, f"{_route_entry(tool, class_name)}\n  {anchor}")
    f.write_text(c)
    print("[development] Patched app-routing.module.ts")


def _patch_module(class_name: str, slug: str) -> None:
    f = REPO_ROOT / "src" / "app" / "app.module.ts"
    c = f.read_text()
    imp = f"import {{ {class_name} }} from './tools/{slug}/{slug}.component';"
    if imp not in c:
        c = c.replace("import { NewsFeedComponent }", f"{imp}\nimport {{ NewsFeedComponent }}")
    if f"{class_name}," not in c:
        c = c.replace(
            "    ImageCompressorComponent,\n    NewsFeedComponent,",
            f"    ImageCompressorComponent,\n    {class_name},\n    NewsFeedComponent,",
        )
    f.write_text(c)
    print("[development] Patched app.module.ts")


def _patch_tools_list(tool: dict, icon: str) -> None:
    f = REPO_ROOT / "src" / "app" / "tools" / "tools.component.ts"
    c = f.read_text()
    slug = tool["slug"]
    if f"id: '{slug}'" in c:
        print("[development] Tool card already present — skipping.")
        return
    tags_ts = "[" + ", ".join(f"'{t}'" for t in tool.get("tags", [])) + "]"
    card = (
        f"      {{\n        id: '{slug}',\n        title: '{_esc(tool['name'])}',\n"
        f"        description: '{_esc(tool['description'])}',\n"
        f"        route: '/tools/{slug}',\n        status: 'live',\n"
        f"        tags: {tags_ts},\n        icon: `{icon}`\n      }},\n"
    )
    anchor = "      {\n        id: 'gradient-generator',"
    c = c.replace(anchor, f"{card}{anchor}") if anchor in c else c.replace("    ];\n  }", f"{card}    ];\n  }}")
    f.write_text(c)
    print("[development] Patched tools.component.ts")


# ---------------------------------------------------------------------------
# Main
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
    print(f"[development] {tool['name']} ({slug}) — {class_name}")

    generated = _generate_files(tool, class_name, slug)

    tool_dir = REPO_ROOT / "src" / "app" / "tools" / slug
    tool_dir.mkdir(parents=True, exist_ok=True)
    (tool_dir / f"{slug}.component.ts").write_text(generated["component_ts"])
    (tool_dir / f"{slug}.component.html").write_text(generated["component_html"])
    (tool_dir / f"{slug}.component.css").write_text(generated["component_css"])
    print(f"[development] Wrote files to src/app/tools/{slug}/")

    _patch_routing(tool, class_name)
    _patch_module(class_name, slug)
    _patch_tools_list(tool, generated.get("icon_svg_paths", ""))

    result = {
        "slug": slug, "tool_name": tool["name"], "class_name": class_name,
        "files_written": [f"src/app/tools/{slug}/{slug}.component.{e}" for e in ["ts","html","css"]],
        "files_updated": ["src/app/app-routing.module.ts","src/app/app.module.ts","src/app/tools/tools.component.ts"],
    }
    output_path.write_text(json.dumps(result, indent=2))
    print(f"[development] Done → {output_path}")
    return result
