import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SkillsComponent } from './skills/skills.component';
import { ProjectsComponent } from './projects/projects.component';
import { ContactComponent } from './contact/contact.component';
import { DonateComponent } from './donate/donate.component';
import { LandingComponent } from './landing/landing.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { GamesComponent } from './games/games.component';
import { GuestbookComponent } from './guestbook/guestbook.component';
import { McpComponent } from './mcp/mcp.component';
import { RouteTitles } from './shared/title-strategy.service';
import { SITE_URL } from './seo.service';
import { LiveComponent } from './live/live.component';

const routes: Routes = [
  {
      path: 'home',
      component: LandingComponent,
      title: 'xsantcastx | Full-Stack Developer & Free Browser Tools',
      data: {
        description: 'xsantcastx — Full-Stack Developer building modern web apps and free browser tools. CSS Box Shadow Generator, Email Deliverability Auditor, SSL Inspector, SVG to Code & more. No sign-up.',
        keywords: 'full stack developer, web development, angular, typescript, css box shadow generator, email deliverability checker, ssl certificate checker, svg to react component, free browser tools, pdf generator, color palette',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Person',
              '@id': `${SITE_URL}/#person`,
              name: 'xsantcastx',
              url: SITE_URL,
              jobTitle: 'Full-Stack Developer',
              description: 'Independent developer building web applications and free browser tools for designers and developers.',
              knowsAbout: ['Angular', 'TypeScript', 'Node.js', 'Firebase', 'React', 'Web Development'],
              sameAs: []
            },
            {
              '@type': 'WebPage',
              '@id': `${SITE_URL}/home`,
              url: `${SITE_URL}/home`,
              name: 'xsantcastx | Full-Stack Developer & Free Browser Tools',
              description: 'Portfolio and free browser tools — CSS Box Shadow Generator, Email Deliverability Auditor, SSL Certificate Inspector, SVG to Code, PDF Catalog Generator, Color Palette Extractor and more.',
              author: { '@id': `${SITE_URL}/#person` }
            }
          ]
        }
      }
    },
  {
      path: 'skills',
      component: SkillsComponent,
      title: RouteTitles.skills,
      data: {
        description: 'Technical skills across Angular, React, TypeScript, Node.js, Firebase, and more. Full-stack expertise for modern web and mobile applications.',
        keywords: 'angular, react, typescript, nodejs, firebase, full stack skills, web developer skills',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'WebPage', name: 'Skills — xsantcastx',
          url: `${SITE_URL}/skills`,
          description: 'Technical skills across Angular, React, TypeScript, Node.js, Firebase, and more.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
            { '@type': 'ListItem', position: 2, name: 'Skills', item: `${SITE_URL}/skills` }
          ]}
        }
      }
    },
  {
      path: 'projects',
      component: ProjectsComponent,
      title: RouteTitles.projects,
      data: {
        description: 'Portfolio of real-world projects: e-commerce platforms, web applications, and developer tools built with Angular, Firebase, and TypeScript.',
        keywords: 'portfolio, web projects, angular projects, firebase projects, case studies, web applications',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Projects — xsantcastx',
          url: `${SITE_URL}/projects`,
          description: 'Portfolio of real-world projects built with Angular, Firebase, and TypeScript.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
            { '@type': 'ListItem', position: 2, name: 'Projects', item: `${SITE_URL}/projects` }
          ]}
        }
      }
    },
  {
      path: 'contact',
      component: ContactComponent,
      title: RouteTitles.contact,
      data: {
        description: 'Get in touch for freelance web development, project collaboration, or consulting. Based in Spain, working globally.',
        keywords: 'hire developer, freelance web development, contact, project consultation',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact — xsantcastx',
          url: `${SITE_URL}/contact`,
          description: 'Get in touch for freelance web development, project collaboration, or consulting.'
        }
      }
    },
  {
      path: 'donate',
      component: DonateComponent,
      title: RouteTitles.donate,
      data: {
        description: 'Support open-source tools and development work. Donate via Stripe, PayPal, or crypto.',
        keywords: 'donate, support developer, open source, sponsorship',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'WebPage', name: 'Donate — xsantcastx',
          url: `${SITE_URL}/donate`,
          description: 'Support open-source tools and development work. Donate via Stripe, PayPal, or crypto.'
        }
      }
    },
  {
      path: 'live',
      component: LiveComponent,
      title: 'Watch Live Work — AI Mission Control | xsantcastx',
      data: {
        description: 'Watch Claude AI work in real time. A live mission control feed showing tool calls, task progress, and AI activity as it happens.',
        keywords: 'watch ai work live, claude ai real time, ai mission control, live coding stream, ai development feed',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'WebPage', name: 'Watch Live — AI Mission Control',
          url: `${SITE_URL}/live`,
          description: 'Watch Claude AI work in real time. A live mission control feed showing tool calls, task progress, and AI activity.',
          breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/home` },
            { '@type': 'ListItem', position: 2, name: 'Live', item: `${SITE_URL}/live` }
          ]}
        }
      }
    },
  {
      path: 'mcp',
      component: McpComponent,
      title: 'xsantcastx MCP Server — 14 Developer Tools for AI Agents',
      data: {
        description: 'A local MCP server with 14 developer tools: JSON formatting, UUID generation, Base64, JWT decoding, regex, hashing, color contrast, and cron expression tools.',
        keywords: 'mcp server, model context protocol, claude tools, ai developer tools, json formatter mcp, uuid generator mcp, base64 mcp, jwt decoder mcp, regex mcp, hash generator mcp',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`,
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'xsantcastx MCP Server',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Any',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          url: 'https://www.npmjs.com/package/xsantcastx-mcp-server',
          description: 'A local MCP server with 14 developer tools for AI agents.'
        }
      }
    },
  {
      path: 'games',
      component: GamesComponent,
      title: 'Games & Easter Eggs — Unlock Hidden Games | xsantcastx',
      data: {
        description: 'Use tools to discover Easter eggs and unlock hidden mini-games. 106 secrets across 135 tools.',
        keywords: 'easter eggs, hidden games, developer games, tool secrets, mini games',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`
      }
    },
  {
      path: 'guestbook',
      component: GuestbookComponent,
      title: 'Guestbook — Sign the wall | xsantcastx',
      data: {
        description: 'Leave a message in the cosmic guestbook. A constellation of visitors who passed through.',
        keywords: 'guestbook, visitors, leave a message, xsantcastx',
        ogImage: `${SITE_URL}/assets/og/og-default.jpg`
      }
    },
  {
    path: 'tools',
    loadChildren: () => import('./tools/tools.module').then(m => m.ToolsModule)
  },
  {
    path: 'embed',
    loadChildren: () => import('./tools/embed.module').then(m => m.EmbedModule)
  },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  {
      path: '**',
      component: NotFoundComponent,
      title: '404 — Page Not Found | xsantcastx',
      data: {
        description: 'The page you are looking for does not exist. Browse free developer tools or return to the homepage.',
        keywords: '404, page not found, xsantcastx'
      }
    }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
