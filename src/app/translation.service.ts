import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

interface Translations {
  [key: string]: {
    en: string;
    es: string;
  };
}

/** The languages the site actually ships copy for, and the only values `?lang=` honours. */
export const SUPPORTED_LANGUAGES = ['en', 'es'] as const;
export const DEFAULT_LANGUAGE = 'en';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private currentLanguageSubject = new BehaviorSubject<string>('en');
  public currentLanguage$ = this.currentLanguageSubject.asObservable();

  private translations: Translations = {
    // Navigation
    'nav.services': { en: 'Services', es: 'Servicios' },
    'nav.projects': { en: 'Projects', es: 'Proyectos' },
    'nav.about': { en: 'About', es: 'Acerca de' },
    'nav.contact': { en: 'Contact', es: 'Contacto' },

    // ── The Godforge command bar ─────────────────────────────────────────
    // Realm *names* are deliberately absent: they come from REALMS in
    // realm.model.ts and are proper nouns in the lore, untranslated in both
    // languages exactly as the tools page already renders them.
    'gfnav.realms':       { en: 'Realms',        es: 'Reinos' },
    'gfnav.realmsHd':     { en: 'The Five Realms', es: 'Los cinco reinos' },
    'gfnav.allArtifacts': { en: 'All Artifacts', es: 'Todos los artefactos' },
    'gfnav.arena':        { en: 'Arena',         es: 'Arena' },
    'gfnav.codex':        { en: 'Codex',         es: 'Codice' },
    'gfnav.warTable':     { en: 'War Table',     es: 'Mesa de guerra' },
    'gfnav.market':       { en: 'Market',        es: 'Mercado' },
    'gfnav.quests':       { en: 'Quests',        es: 'Misiones' },
    'gfnav.keeper':       { en: 'Your Forge',    es: 'Tu forja' },
    'gfnav.live':         { en: 'Live',          es: 'En vivo' },
    'gfnav.mcp':          { en: 'MCP Server',    es: 'Servidor MCP' },
    'gfnav.sponsors':     { en: 'Sponsors',      es: 'Patrocinadores' },
    'gfnav.hallsHd':      { en: 'The Halls',     es: 'Las salas' },
    'gfnav.keeperLabel':  { en: 'Your Forge — rank, inventory and achievements', es: 'Tu forja: rango, inventario y logros' },
    'gfnav.menuLabel':    { en: 'Open the tome', es: 'Abrir el tomo' },
    'gfnav.tomeMark':     { en: 'every tool you use earns you power', es: 'cada herramienta que usas te da poder' },

    'gfnav.hint.tools':    { en: '125 artifacts, five realms',      es: '125 artefactos, cinco reinos' },
    'gfnav.hint.arena':    { en: 'Games forged in the eclipse',     es: 'Juegos forjados en el eclipse' },
    'gfnav.hint.codex':    { en: 'Fragments of a broken sun',       es: 'Fragmentos de un sol roto' },
    'gfnav.hint.warTable': { en: 'What is being built, and why',    es: 'Que se construye, y por que' },
    'gfnav.hint.market':   { en: 'Spend gold, sharpen the forge',   es: 'Gasta oro, afila la forja' },
    'gfnav.hint.quests':   { en: 'Daily, weekly and epic trials',   es: 'Pruebas diarias, semanales y epicas' },
    'gfnav.hint.keeper':   { en: 'Your rank and everything you own', es: 'Tu rango y todo lo que posees' },
    'gfnav.hint.live':     { en: 'Watch the forge burn in real time', es: 'Mira la forja arder en tiempo real' },
    'gfnav.hint.mcp':      { en: 'Tools for AI agents',             es: 'Herramientas para agentes de IA' },
    'gfnav.hint.sponsors': { en: 'Back the forge',                  es: 'Apoya la forja' },

    'gffoot.forgedBy':    { en: 'Forged by xsantcastx',            es: 'Forjado por xsantcastx' },

    // Hero Section
    'hero.title.line1': { en: 'xsantcastx', es: 'xsantcastx' },
    'hero.title.line2': { en: 'Development Studio', es: 'Estudio de Desarrollo' },
    'hero.subtitle': { en: 'Innovative Full-Stack Solutions', es: 'Soluciones Full-Stack Innovadoras' },
    'hero.description': {
      en: 'We create cutting-edge web experiences that move ideas from concept to launch with measurable impact.',
      es: 'Creamos experiencias web de vanguardia que llevan las ideas del concepto al lanzamiento con impacto medible.'
    },
    'hero.stats.projects': { en: 'Projects', es: 'Proyectos' },
    'hero.stats.years': { en: 'Years', es: 'Anios' },
    'hero.stats.support': { en: 'Support', es: 'Soporte' },
    'hero.scroll': { en: 'Explore Our Work', es: 'Explora Nuestro Trabajo' },
    'hero.cta.work': { en: 'View Portfolio', es: 'Ver Portafolio' },
    'hero.cta.talk': { en: "Let's Collaborate", es: 'Colaboremos' },

    // Services Section
    'services.title': { en: 'What We Build', es: 'Lo Que Construimos' },
    'services.subtitle': { en: 'Full-stack solutions that drive your business forward', es: 'Soluciones full-stack que impulsan tu negocio' },
    'services.frontend.title': { en: 'Frontend Development', es: 'Desarrollo Frontend' },
    'services.frontend.desc': { en: 'Modern, responsive web applications with premium frameworks and refined UX.', es: 'Aplicaciones web modernas y responsivas con frameworks premium y UX refinada.' },
    'services.backend.title': { en: 'Backend Development', es: 'Desarrollo Backend' },
    'services.backend.desc': { en: 'Robust APIs, services, and data architecture engineered to scale with your growth.', es: 'APIs, servicios y arquitectura de datos robustos disenados para escalar con tu crecimiento.' },
    'services.fullstack.title': { en: 'Full-Stack Applications', es: 'Aplicaciones Full-Stack' },
    'services.fullstack.desc': { en: 'End-to-end platforms, from concept and design to deployment and support.', es: 'Plataformas completas, desde el concepto y diseno hasta el despliegue y soporte.' },
    'services.mobile.title': { en: 'Mobile Applications', es: 'Aplicaciones Moviles' },
    'services.mobile.desc': { en: 'Native and cross-platform apps that feel great on every device.', es: 'Aplicaciones nativas y multiplataforma que funcionan perfecto en cada dispositivo.' },
    'services.cta.title': { en: 'Ready to build something amazing?', es: 'Listo para construir algo increible?' },
    'services.cta.button': { en: 'Start Your Project', es: 'Inicia Tu Proyecto' },

    // Projects Section
    'projects.title': { en: 'Featured Projects', es: 'Proyectos Destacados' },
    'projects.subtitle': { en: 'Real solutions built for real teams and audiences.', es: 'Soluciones reales construidas para equipos y audiencias reales.' },
    'projects.live': { en: 'Live Demo', es: 'Demo en Vivo' },
    'projects.code': { en: 'Code', es: 'Codigo' },
    'projects.features': { en: 'Key Features:', es: 'Caracteristicas Clave:' },
    'projects.cta.title': { en: 'Interested in working together?', es: 'Interesado en trabajar juntos?' },
    'projects.cta.desc': { en: "Let's discuss your next project and bring your ideas to life", es: 'Hablemos de tu proximo proyecto y hagamos realidad tus ideas' },
    'projects.cta.button': { en: 'Get In Touch', es: 'Contactame' },

    'projects.items.stone.title': { en: 'The Stone Ceramics', es: 'The Stone Ceramics' },
    'projects.items.stone.description': { en: 'Premium ceramic storefront with advanced filters, 3D views, and bilingual content.', es: 'Tienda premium de ceramicas con filtros avanzados, vistas 3D y contenido bilingue.' },
    'projects.items.stone.features.catalog': { en: 'Advanced product catalog filtering', es: 'Filtrado avanzado del catalogo de productos' },
    'projects.items.stone.features.multilingual': { en: 'Spanish / English experience', es: 'Experiencia en espanol e ingles' },
    'projects.items.stone.features.specs': { en: 'Technical specification viewer', es: 'Visor de especificaciones tecnicas' },
    'projects.items.stone.features.consultation': { en: 'Consultation and inquiry flow', es: 'Flujo de consultas y asesoria' },
    'projects.items.stone.features.responsive': { en: 'Responsive layout on any device', es: 'Diseno responsive en cualquier dispositivo' },

    'projects.items.xengrave.title': { en: 'Xengrave Laser Studio', es: 'Xengrave Laser Studio' },
    'projects.items.xengrave.description': { en: 'Custom engraving portal with instant quoting, proof approval, and tracking.', es: 'Portal de grabado personalizado con cotizacion instantanea, aprobacion de pruebas y seguimiento.' },
    'projects.items.xengrave.features.configuration': { en: 'Dynamic order configuration', es: 'Configuracion dinamica de pedidos' },
    'projects.items.xengrave.features.proof': { en: '24-hour proof generation', es: 'Generacion de pruebas en 24 horas' },
    'projects.items.xengrave.features.gallery': { en: 'Showcase gallery of past work', es: 'Galeria de trabajos destacados' },
    'projects.items.xengrave.features.pricing': { en: 'Interactive pricing calculator', es: 'Calculadora interactiva de precios' },
    'projects.items.xengrave.features.tracking': { en: 'Integrated project tracking', es: 'Seguimiento de proyectos integrado' },

    'projects.items.lux.title': { en: 'The Lux Vending', es: 'The Lux Vending' },
    'projects.items.lux.description': { en: 'Partnership platform connecting venues to smart vending opportunities and ROI modeling.', es: 'Plataforma de alianzas que conecta espacios con oportunidades de vending inteligente y modelado de ROI.' },
    'projects.items.lux.features.calculator': { en: 'Interactive earnings calculator', es: 'Calculadora interactiva de ganancias' },
    'projects.items.lux.features.eligibility': { en: 'Business eligibility checker', es: 'Verificador de elegibilidad comercial' },
    'projects.items.lux.features.mapping': { en: 'Service area mapping', es: 'Mapeo de areas de servicio' },
    'projects.items.lux.features.application': { en: 'Partnership application flow', es: 'Flujo de solicitud de partnership' },
    'projects.items.lux.features.analytics': { en: 'ROI analytics dashboard', es: 'Panel de analitica de ROI' },

    // About Section
    'about.title': { en: 'About xsantcastx', es: 'Acerca de xsantcastx' },
    'about.subtitle': { en: 'Full-Stack Development Studio & Digital Solutions Architect', es: 'Estudio de Desarrollo Full-Stack y Arquitecto de Soluciones Digitales' },
    'about.intro': {
      en: 'xsantcastx is a full-stack product studio that ships launch-ready experiences for teams that demand momentum.',
      es: 'xsantcastx es un estudio full-stack que entrega experiencias listas para lanzar para equipos que buscan impulso.'
    },
    'about.description': {
      en: 'We blend strategy, design, and engineering to transform raw ideas into measurable results that align business goals with memorable human moments.',
      es: 'Combinamos estrategia, diseno e ingenieria para transformar ideas en resultados medibles que alinean objetivos de negocio con experiencias memorables.'
    },
    'about.drives.title': { en: 'What Drives Us', es: 'Lo Que Nos Motiva' },
    'about.drives.innovation': { en: 'Innovation lives in every sprint - we turn ambiguous problem statements into polished experiences that feel inevitable.', es: 'La innovacion vive en cada sprint - convertimos problemas ambiguos en experiencias pulidas que parecen inevitables.' },
    'about.drives.quality': { en: 'Quality means readable, tested code, design systems, and deployment pipelines that teams can trust.', es: 'Calidad significa codigo legible y probado, sistemas de diseno y pipelines de despliegue confiables.' },
    'about.drives.global': { en: 'We collaborate in English and Spanish across time zones, keeping every stakeholder aligned and velocity high.', es: 'Colaboramos en ingles y espanol a traves de zonas horarias, manteniendo a cada stakeholder alineado y con alta velocidad.' },
    'about.beyond.title': { en: 'Our Technology Edge', es: 'Nuestra Ventaja Tecnologica' },
    'about.beyond.fullstack': { en: 'Full-stack mastery across React, Angular, Next.js, Node, and Python to assemble the right stack for the mission.', es: 'Dominio full-stack en React, Angular, Next.js, Node y Python para armar la tecnologia correcta para cada mision.' },
    'about.beyond.cloud': { en: 'Cloud and DevOps excellence with Firebase, AWS, Docker, and CI/CD pipelines tuned for resilient releases.', es: 'Excelencia en nube y DevOps con Firebase, AWS, Docker y pipelines CI/CD ajustados para lanzamientos resilientes.' },
    'about.beyond.modern': { en: 'Composable architectures, microservices, and progressive web apps that scale as your audience grows.', es: 'Arquitecturas componibles, microservicios y aplicaciones web progresivas que escalan con tu audiencia.' },
    'about.levelup.title': { en: 'Continuous Evolution', es: 'Evolucion Continua' },
    'about.levelup.research': { en: 'We stay ahead of the curve with emerging tools, AI integration, and next-gen frameworks before they trend.', es: 'Nos mantenemos por delante con herramientas emergentes, integracion de IA y frameworks de nueva generacion antes de que sean tendencia.' },
    'about.levelup.innovation': { en: 'We experiment with blockchain, Web3, advanced analytics, and automation to unlock new value streams.', es: 'Experimentamos con blockchain, Web3, analitica avanzada y automatizacion para desbloquear nuevos flujos de valor.' },
    'about.enterprise.intro': {
      en: '<strong>Your elastic product squad.</strong> We plug into founders, agencies, and enterprise teams to ship ambitious web, mobile, and cloud platforms without the overhead.',
      es: '<strong>Tu escuadron de producto elastico.</strong> Nos conectamos con fundadores, agencias y equipos empresariales para lanzar plataformas web, moviles y cloud sin sobrecarga.'
    },
    'about.enterprise.specialization': {
      en: '<strong>Specialties:</strong> commerce ecosystems, B2B dashboards, creator tools, community platforms, and AI-assisted workflows built on modern JavaScript, Node, and serverless infrastructure.',
      es: '<strong>Especialidades:</strong> ecosistemas de comercio, tableros B2B, herramientas para creadores, plataformas de comunidad y flujos asistidos por IA sobre JavaScript moderno, Node y arquitectura serverless.'
    },
    'about.enterprise.approach': {
      en: '<strong>Approach:</strong> discovery sprints, rapid prototyping, test-driven delivery, and ongoing optimization to keep shipping fast after launch.',
      es: '<strong>Metodo:</strong> discovery sprints, prototipado rapido, entrega guiada por pruebas y optimizacion continua para mantener el ritmo despues del lanzamiento.'
    },

    // Skills Section
    'skills.title': { en: 'Core Skills', es: 'Habilidades Clave' },
    'skills.loading': { en: 'Loading skills...', es: 'Cargando habilidades...' },
    'skills.error': { en: 'Failed to load skills. Please try again.', es: 'No se pudieron cargar las habilidades. Intenta de nuevo.' },

    // Contact Section
    'contact.title': { en: "Let's Build Together", es: 'Construyamos Juntos' },
    'contact.subtitle': { en: "Ready to transform your ideas into reality? Let's discuss your project.", es: 'Listo para transformar tus ideas en realidad? Hablemos de tu proyecto.' },
    'contact.info.header': { en: 'Work With The Godforge', es: 'Trabaja con The Godforge' },
    'contact.info.desc': { en: 'Tell us about your goals and we will help you craft the right solution.', es: 'Cuentanos tus objetivos y te ayudaremos a crear la solucion correcta.' },
    'contact.method.email': { en: 'Direct Email', es: 'Email Directo' },
    'contact.method.github': { en: 'GitHub', es: 'GitHub' },
    'contact.method.response': { en: 'Typical Response Time', es: 'Tiempo de Respuesta' },
    'contact.method.response.time': { en: 'Under 24 hours, Monday to Friday', es: 'Menos de 24 horas, lunes a viernes' },
    'contact.projects.title': { en: 'Project Types We Deliver', es: 'Tipos de Proyecto que Entregamos' },
    'contact.projects.ecommerce': { en: 'E-commerce Platforms', es: 'Plataformas de E-commerce' },
    'contact.projects.business': { en: 'Business Web Applications', es: 'Aplicaciones Web Empresariales' },
    'contact.projects.cms': { en: 'Custom CMS Solutions', es: 'Soluciones CMS Personalizadas' },
    'contact.projects.mobile': { en: 'Mobile & PWA Experiences', es: 'Experiencias Moviles y PWA' },
    'contact.projects.api': { en: 'API Development & Integration', es: 'Desarrollo e Integracion de API' },
    'contact.form.name': { en: 'Your Name', es: 'Tu Nombre' },
    'contact.form.name.placeholder': { en: 'Enter your name', es: 'Ingresa tu nombre' },
    'contact.form.email': { en: 'Email Address', es: 'Direccion de Email' },
    'contact.form.email.placeholder': { en: 'your@email.com', es: 'tu@email.com' },
    'contact.form.project': { en: 'Project Type', es: 'Tipo de Proyecto' },
    'contact.form.project.select': { en: 'Select project type', es: 'Selecciona tipo de proyecto' },
    'contact.form.project.webapp': { en: 'Web Application', es: 'Aplicacion Web' },
    'contact.form.project.ecommerce': { en: 'E-commerce Site', es: 'Sitio de E-commerce' },
    'contact.form.project.mobile': { en: 'Mobile App', es: 'Aplicacion Movil' },
    'contact.form.project.api': { en: 'API Development', es: 'Desarrollo de API' },
    'contact.form.project.other': { en: 'Other', es: 'Otro' },
    'contact.form.budget': { en: 'Budget Range', es: 'Rango de Presupuesto' },
    'contact.form.budget.select': { en: 'Select budget range', es: 'Selecciona un rango' },
    'contact.form.budget.under5k': { en: 'Under $5,000', es: 'Menos de $5,000' },
    'contact.form.budget.5k10k': { en: '$5,000 - $10,000', es: '$5,000 - $10,000' },
    'contact.form.budget.10k25k': { en: '$10,000 - $25,000', es: '$10,000 - $25,000' },
    'contact.form.budget.25kplus': { en: '$25,000+', es: '$25,000+' },
    'contact.form.message': { en: 'Project Details', es: 'Detalles del Proyecto' },
    'contact.form.message.placeholder': { en: 'Tell us about your project, goals, and any specific requirements...', es: 'Cuentanos sobre tu proyecto, objetivos y requerimientos.' },
    'contact.form.submit': { en: 'Send Project Brief', es: 'Enviar Propuesta' },
    'contact.form.sending': { en: 'Sending...', es: 'Enviando...' },
    'contact.form.success': { en: 'Signal received. Your transmission reached us — we will reply within 24 hours.', es: 'Senal recibida. Tu transmision llego — responderemos en menos de 24 horas.' },
    'contact.form.error': { en: 'The transmission scattered before it reached us. Try again — or send a beam directly to xsantcastx@xsantcastx.com.', es: 'La transmision se disperso antes de llegar. Intenta de nuevo — o envia un mensaje directo a xsantcastx@xsantcastx.com.' },

    // Donation Form
    'donation.form.title': { en: 'Fuel the mission with KASPA', es: 'Alimenta la mision con KASPA' },
    'donation.form.subtitle': { en: 'Scan the seal, whisper a name, keep the stars burning.', es: 'Escanea el sello, susurra un nombre y mantiene las estrellas ardiendo.' },
    'donation.form.walletLabel': { en: 'KASPA wallet address', es: 'Direccion de billetera KASPA' },
    'donation.form.copy': { en: 'Copy', es: 'Copiar' },
    'donation.form.copySuccess': { en: 'Address copied into your hand.', es: 'Direccion copiada a tu mano.' },
    'donation.form.copyError': { en: 'Could not copy the signal. Take it manually.', es: 'No se pudo copiar la senal. Tomala manualmente.' },
    'donation.form.qrAlt': { en: 'KASPA wallet QR sigil', es: 'Sigilo QR de la billetera KASPA' },
    'donation.form.messageLabel': { en: 'Leave a whisper', es: 'Deja un susurro' },
    'donation.form.messagePlaceholder': { en: 'A shout-out, a request, an idea worth building next...', es: 'Un saludo, una peticion, una idea que valga la pena construir...' },
    'donation.form.messageRequired': { en: 'Whisper something into the void first.', es: 'Susurra algo al vacio primero.' },
    'donation.form.submit': { en: 'Send the signal →', es: 'Enviar la senal →' },
    'donation.form.success': { en: 'The cosmos heard you. Thank you.', es: 'El cosmos te escucho. Gracias.' },
    'donation.form.error': { en: 'The signal scattered. Try again in a moment.', es: 'La senal se disperso. Intentalo de nuevo.' },

    // Footer
    'footer.donate': { en: 'Fuel the mission', es: 'Alimenta la mision' },
    'footer.donate.desc': { en: 'Every coin keeps another star alive in this universe.', es: 'Cada moneda mantiene viva una estrella mas en este universo.' },
    'footer.paypal.title': { en: 'PayPal portal', es: 'Portal PayPal' },
    'footer.paypal.desc': { en: 'Send fuel through PayPal — a secure, instant signal.', es: 'Envia combustible por PayPal — senal segura e instantanea.' },
    'footer.paypal.note': { en: 'Every drop of fuel keeps a new tool shipping.', es: 'Cada gota de combustible mantiene una herramienta nueva en orbita.' },
    'footer.stripe.title': { en: 'Card portal', es: 'Portal de Tarjeta' },
    'footer.stripe.desc': { en: 'Send fuel by card — a secure, instant signal.', es: 'Envia combustible con tarjeta — senal segura e instantanea.' },
    'footer.stripe.note': { en: 'Encrypted by Stripe — your card never crosses my orbit.', es: 'Cifrado por Stripe — tu tarjeta nunca cruza mi orbita.' },
    'footer.donation': { en: 'Donation', es: 'Donacion' },
    'footer.amount': { en: 'Amount', es: 'Cantidad' },
    'footer.custom.amount': { en: 'Custom Amount', es: 'Cantidad Personalizada' },
    'footer.custom.placeholder': { en: 'Enter amount (min $1)', es: 'Ingresa una cantidad (minimo $1)' },
    'footer.custom.invalid': { en: 'Please enter a valid amount (minimum $1)', es: 'Ingresa una cantidad valida (minimo $1)' },
    'footer.or': { en: 'or', es: 'o' },
    'footer.processing': { en: 'Processing...', es: 'Procesando...' },
    'footer.success': { en: 'Thank you for your support!', es: 'Gracias por tu apoyo!' },
    'footer.error': { en: 'Payment failed. Please try again.', es: 'El pago fallo. Intenta de nuevo.' },

    // ─── Tools section ────────────────────────────────────────────────────────

    // Tools landing page
    'tools.page.eyebrow': { en: 'Studio Utilities', es: 'Utilidades del Estudio' },
    'tools.page.title': { en: 'Tools', es: 'Herramientas' },
    'tools.page.subtitle': { en: 'Browser-based utilities for creative and developer workflows. No accounts. No uploads. Just open and use.', es: 'Utilidades basadas en el navegador para flujos creativos y de desarrollo. Sin cuentas. Sin subidas. Solo abre y usa.' },
    'tools.page.share.x': { en: 'Share on X', es: 'Compartir en X' },
    'tools.badge.soon': { en: 'Soon', es: 'Próximamente' },
    'tools.common.back': { en: 'All Tools', es: 'Todas las Herramientas' },
    'tools.common.share': { en: 'Share', es: 'Compartir' },
    // Shared button + UI panel labels — reusable across all tool templates (i18n batch 2026-04-26)
    'tools.common.shareX': { en: 'Share on X', es: 'Compartir en X' },
    'tools.common.shareLinkedIn': { en: 'Share on LinkedIn', es: 'Compartir en LinkedIn' },
    'tools.common.backToTools': { en: 'Back to Tools', es: 'Volver a Herramientas' },
    'tools.common.copy': { en: 'Copy', es: 'Copiar' },
    'tools.common.copied': { en: 'Copied', es: 'Copiado' },
    'tools.common.copyCode': { en: 'Copy Code', es: 'Copiar Código' },
    'tools.common.copyAll': { en: 'Copy All', es: 'Copiar Todo' },
    'tools.common.clear': { en: 'Clear', es: 'Borrar' },
    'tools.common.sample': { en: 'Sample', es: 'Ejemplo' },
    'tools.common.generate': { en: 'Generate', es: 'Generar' },
    'tools.common.compare': { en: 'Compare', es: 'Comparar' },
    'tools.common.download': { en: 'Download', es: 'Descargar' },
    'tools.common.input': { en: 'Input', es: 'Entrada' },
    'tools.common.output': { en: 'Output', es: 'Salida' },
    'tools.common.options': { en: 'Options', es: 'Opciones' },
    'tools.common.results': { en: 'Results', es: 'Resultados' },
    'tools.common.presets': { en: 'Presets', es: 'Preajustes' },
    'tools.common.mode': { en: 'Mode', es: 'Modo' },
    'tools.common.text': { en: 'Text', es: 'Texto' },
    'tools.common.file': { en: 'File', es: 'Archivo' },
    'tools.common.charsCount': { en: 'chars', es: 'caracteres' },
    'tools.common.copiedExclaim': { en: 'Copied!', es: '¡Copiado!' },
    'tools.common.clearAll': { en: 'Clear All', es: 'Borrar Todo' },
    'tools.common.reset': { en: 'Reset', es: 'Restablecer' },
    'tools.common.result': { en: 'Result', es: 'Resultado' },
    'tools.common.preview': { en: 'Preview', es: 'Vista Previa' },
    'tools.common.settings': { en: 'Settings', es: 'Ajustes' },

    // Tool category eyebrows — shared across every tool header
    'tools.common.cat.accessibility': { en: 'Accessibility', es: 'Accesibilidad' },
    'tools.common.cat.apiTools': { en: 'API Tools', es: 'Herramientas de API' },
    'tools.common.cat.binaryTools': { en: 'Binary Tools', es: 'Herramientas Binarias' },
    'tools.common.cat.browserTools': { en: 'Browser Tools', es: 'Herramientas de Navegador' },
    'tools.common.cat.codeConverters': { en: 'Code Converters', es: 'Conversores de Código' },
    'tools.common.cat.codeFormatters': { en: 'Code Formatters', es: 'Formateadores de Código' },
    'tools.common.cat.codeTools': { en: 'Code Tools', es: 'Herramientas de Código' },
    'tools.common.cat.codeUtilities': { en: 'Code Utilities', es: 'Utilidades de Código' },
    'tools.common.cat.colorTools': { en: 'Color Tools', es: 'Herramientas de Color' },
    'tools.common.cat.cryptography': { en: 'Cryptography', es: 'Criptografía' },
    'tools.common.cat.cssTool': { en: 'CSS Tool', es: 'Herramienta CSS' },
    'tools.common.cat.cssTools': { en: 'CSS Tools', es: 'Herramientas CSS' },
    'tools.common.cat.cssUtilities': { en: 'CSS Utilities', es: 'Utilidades CSS' },
    'tools.common.cat.dataTools': { en: 'Data Tools', es: 'Herramientas de Datos' },
    'tools.common.cat.dataUtilities': { en: 'Data Utilities', es: 'Utilidades de Datos' },
    'tools.common.cat.dateAndTime': { en: 'Date & Time', es: 'Fecha & Hora' },
    'tools.common.cat.designSystems': { en: 'Design Systems', es: 'Sistemas de Diseño' },
    'tools.common.cat.designTools': { en: 'Design Tools', es: 'Herramientas de Diseño' },
    'tools.common.cat.developerReferences': { en: 'Developer References', es: 'Referencias para Desarrolladores' },
    'tools.common.cat.developerTools': { en: 'Developer Tools', es: 'Herramientas de Desarrollo' },
    'tools.common.cat.deviceAndDisplay': { en: 'Device & Display', es: 'Dispositivo & Pantalla' },
    'tools.common.cat.devopsTools': { en: 'DevOps Tools', es: 'Herramientas DevOps' },
    'tools.common.cat.devopsUtilities': { en: 'DevOps Utilities', es: 'Utilidades DevOps' },
    'tools.common.cat.funTools': { en: 'Fun Tools', es: 'Herramientas Divertidas' },
    'tools.common.cat.generators': { en: 'Generators', es: 'Generadores' },
    'tools.common.cat.imageAndMedia': { en: 'Image & Media', es: 'Imagen & Medios' },
    'tools.common.cat.jsonTools': { en: 'JSON Tools', es: 'Herramientas JSON' },
    'tools.common.cat.legal': { en: 'Legal', es: 'Legal' },
    'tools.common.cat.markdownTools': { en: 'Markdown Tools', es: 'Herramientas Markdown' },
    'tools.common.cat.networkTools': { en: 'Network Tools', es: 'Herramientas de Red' },
    'tools.common.cat.nodeJsTools': { en: 'Node.js Tools', es: 'Herramientas Node.js' },
    'tools.common.cat.packageTools': { en: 'Package Tools', es: 'Herramientas de Paquetes' },
    'tools.common.cat.productivity': { en: 'Productivity', es: 'Productividad' },
    'tools.common.cat.reference': { en: 'Reference', es: 'Referencia' },
    'tools.common.cat.referenceTools': { en: 'Reference Tools', es: 'Herramientas de Referencia' },
    'tools.common.cat.securityTools': { en: 'Security Tools', es: 'Herramientas de Seguridad' },
    'tools.common.cat.seoTool': { en: 'SEO Tool', es: 'Herramienta SEO' },
    'tools.common.cat.seoTools': { en: 'SEO Tools', es: 'Herramientas SEO' },
    'tools.common.cat.testingTools': { en: 'Testing Tools', es: 'Herramientas de Pruebas' },
    'tools.common.cat.textAndDataTool': { en: 'Text & Data Tool', es: 'Herramienta de Texto & Datos' },
    'tools.common.cat.textData': { en: 'Text & Data', es: 'Texto & Datos' },
    'tools.common.cat.textGenerators': { en: 'Text Generators', es: 'Generadores de Texto' },
    'tools.common.cat.textTools': { en: 'Text Tools', es: 'Herramientas de Texto' },
    'tools.common.cat.textUtilities': { en: 'Text Utilities', es: 'Utilidades de Texto' },
    'tools.common.cat.typescript': { en: 'TypeScript', es: 'TypeScript' },
    'tools.common.cat.utilities': { en: 'Utilities', es: 'Utilidades' },
    'tools.common.cat.utilityTools': { en: 'Utility Tools', es: 'Herramientas Utilitarias' },
    'tools.common.cat.writingTools': { en: 'Writing Tools', es: 'Herramientas de Escritura' },
    'tools.common.cat.cssGenerators': { en: 'CSS Generators', es: 'Generadores CSS' },
    'tools.common.cat.dnsAndEmailTools': { en: 'DNS & Email Tools', es: 'Herramientas de DNS & Correo' },
    'tools.common.cat.emailDnsSecurity': { en: 'Email · DNS · Security', es: 'Correo · DNS · Seguridad' },
    'tools.common.cat.securityAndDevtools': { en: 'Security & DevTools', es: 'Seguridad & DevTools' },
    'tools.common.cat.securityNetworking': { en: 'Security / Networking', es: 'Seguridad / Redes' },
    'tools.common.cat.svgTools': { en: 'SVG Tools', es: 'Herramientas SVG' },
    'tools.common.cat.typographyTool': { en: 'Typography Tool', es: 'Herramienta de Tipografía' },

    // ─── Per-tool headers (title / subtitle) ──────────────────────────────────
    // Batch 1 — highest-traffic tools
    'tools.base64Encoder.title': { en: 'Base64 Encoder', es: 'Codificador Base64' },
    'tools.base64Encoder.title2': { en: 'Decoder', es: 'Decodificador' },
    'tools.base64Encoder.subtitle': { en: 'Encode text or files to Base64 and decode Base64 back to text — URL-safe mode, live conversion, no sign-up required.', es: 'Codifica texto o archivos a Base64 y decodifica Base64 de vuelta a texto — modo seguro para URL, conversión en vivo, sin registro.' },

    'tools.passwordGenerator.title': { en: 'Secure String', es: 'Cadena Segura' },
    'tools.passwordGenerator.title2': { en: 'Generator', es: 'Generador' },
    'tools.passwordGenerator.subtitle': { en: 'Generate cryptographically secure random strings and passphrases. Adjustable length, character sets, strength meter, and bulk generation — all client-side with crypto.getRandomValues().', es: 'Genera cadenas y frases de contraseña aleatorias criptográficamente seguras. Longitud ajustable, conjuntos de caracteres, medidor de fuerza y generación por lotes — todo en el cliente con crypto.getRandomValues().' },

    'tools.regexTester.title': { en: 'Regex', es: 'Regex' },
    'tools.regexTester.title2': { en: 'Tester', es: 'Probador' },
    'tools.regexTester.subtitle': { en: 'Test and debug regular expressions with live match highlighting, capture groups, flags, and plain-English explanations — no sign-up required.', es: 'Prueba y depura expresiones regulares con resaltado de coincidencias en vivo, grupos de captura, banderas y explicaciones en lenguaje claro — sin registro.' },

    'tools.uuidGenerator.title': { en: 'UUID', es: 'UUID' },
    'tools.uuidGenerator.title2': { en: 'GUID Generator', es: 'Generador GUID' },
    'tools.uuidGenerator.subtitle': { en: 'Generate UUIDs (v1, v4), ULIDs, and GUIDs instantly. Bulk generation, format options, and built-in validator — all client-side, no sign-up required.', es: 'Genera UUIDs (v1, v4), ULIDs y GUIDs al instante. Generación por lotes, opciones de formato y validador integrado — todo en el cliente, sin registro.' },

    'tools.jwtDecoder.title': { en: 'JWT Decoder', es: 'Decodificador JWT' },
    'tools.jwtDecoder.title2': { en: 'Debugger', es: 'Depurador' },
    'tools.jwtDecoder.subtitle': { en: 'Decode, inspect and debug JSON Web Tokens instantly — view claims, check expiration, and analyze signatures. Client-side only, no data sent anywhere.', es: 'Decodifica, inspecciona y depura JSON Web Tokens al instante — revisa los claims, verifica la expiración y analiza firmas. Solo en el cliente, sin enviar datos a ningún lado.' },

    'tools.urlEncoder.title': { en: 'URL Encoder', es: 'Codificador de URL' },
    'tools.urlEncoder.title2': { en: 'Decoder', es: 'Decodificador' },
    'tools.urlEncoder.subtitle': { en: 'Encode and decode URLs, parse URL components, and build query strings — supports encodeURIComponent and encodeURI modes, live conversion, no sign-up required.', es: 'Codifica y decodifica URLs, analiza componentes de URL y construye cadenas de consulta — admite los modos encodeURIComponent y encodeURI, conversión en vivo, sin registro.' },

    'tools.caseConverter.title': { en: 'Text Case', es: 'Mayúsculas y Minúsculas' },
    'tools.caseConverter.title2': { en: 'Converter', es: 'Conversor' },
    'tools.caseConverter.subtitle': { en: 'Convert text between UPPERCASE, camelCase, snake_case, kebab-case and more — all conversions at once, no sign-up required.', es: 'Convierte texto entre MAYÚSCULAS, camelCase, snake_case, kebab-case y más — todas las conversiones a la vez, sin registro.' },

    'tools.colorConverter.title': { en: 'Color Converter', es: 'Conversor de Color' },
    'tools.colorConverter.subtitle': { en: 'Convert between HEX, RGB, HSL, HSB/HSV, and CMYK color formats with live preview, color harmonies, tints & shades.', es: 'Convierte entre los formatos de color HEX, RGB, HSL, HSB/HSV y CMYK con vista previa en vivo, armonías de color, tintes & sombras.' },

    'tools.colorPicker.title': { en: 'Color Picker', es: 'Selector de Color' },
    'tools.colorPicker.subtitle': { en: 'Advanced color picker with RGB/HSL sliders, hex input, and color history.', es: 'Selector de color avanzado con deslizadores RGB/HSL, entrada hex e historial de colores.' },

    'tools.timestampConverter.title': { en: 'Unix Timestamp', es: 'Marca de Tiempo Unix' },
    'tools.timestampConverter.title2': { en: 'Converter', es: 'Conversor' },
    'tools.timestampConverter.subtitle': { en: 'Convert Unix timestamps to human-readable dates and back. Supports seconds, milliseconds, timezones, relative time, and ISO 8601.', es: 'Convierte marcas de tiempo Unix a fechas legibles y viceversa. Admite segundos, milisegundos, zonas horarias, tiempo relativo e ISO 8601.' },

    'tools.loremGenerator.title': { en: 'Lorem Ipsum Generator', es: 'Generador de Lorem Ipsum' },
    'tools.loremGenerator.subtitle': { en: 'Generate placeholder text by paragraphs, sentences, or words. Classic lorem ipsum and fun alternative variants — no sign-up required.', es: 'Genera texto de relleno por párrafos, oraciones o palabras. Lorem ipsum clásico y variantes alternativas divertidas — sin registro.' },

    'tools.qrGenerator.title': { en: 'QR Code', es: 'Código QR' },
    'tools.qrGenerator.title2': { en: 'Generator', es: 'Generador' },
    'tools.qrGenerator.subtitle': { en: 'Generate QR codes from text, URLs, email, WiFi credentials, or vCard contacts — customize colors, download as PNG or SVG, no sign-up required.', es: 'Genera códigos QR desde texto, URLs, correo, credenciales WiFi o contactos vCard — personaliza colores, descarga como PNG o SVG, sin registro.' },

    'tools.diffChecker.title': { en: 'Text Diff', es: 'Comparador de Texto' },
    'tools.diffChecker.title2': { en: 'Checker', es: 'Diferencias' },
    'tools.diffChecker.subtitle': { en: 'Compare two texts side-by-side with color-coded diffs. Find additions, deletions and changes instantly — no sign-up required.', es: 'Compara dos textos lado a lado con diferencias codificadas por color. Encuentra adiciones, eliminaciones y cambios al instante — sin registro.' },

    // Batch 2 — JSON / data / minifier tools
    'tools.jsonMinifier.title': { en: 'JSON Minifier', es: 'Minificador JSON' },
    'tools.jsonMinifier.title2': { en: 'Compressor', es: 'Compresor' },
    'tools.jsonMinifier.subtitle': { en: 'Minify, beautify, and optimize JSON instantly — remove whitespace, null values, empty strings, and more.', es: 'Minifica, embellece y optimiza JSON al instante — elimina espacios en blanco, valores nulos, cadenas vacías y más.' },

    'tools.jsonDiff.title': { en: 'JSON Diff', es: 'Comparador JSON' },
    'tools.jsonDiff.subtitle': { en: 'Compare two JSON objects and see added, removed, and changed keys highlighted with colors.', es: 'Compara dos objetos JSON y observa las claves añadidas, eliminadas y modificadas resaltadas con colores.' },

    'tools.jsonToTs.title': { en: 'JSON', es: 'JSON' },
    'tools.jsonToTs.title2': { en: 'to', es: 'a' },
    'tools.jsonToTs.title3': { en: 'TypeScript', es: 'TypeScript' },
    'tools.jsonToTs.subtitle': { en: 'Paste JSON on the left, get TypeScript interfaces on the right — handles nested objects, arrays, union types and nulls.', es: 'Pega JSON a la izquierda y obtén interfaces de TypeScript a la derecha — maneja objetos anidados, arreglos, tipos unión y nulos.' },

    'tools.jsonPath.title': { en: 'JSON Path Finder', es: 'Buscador de Rutas JSON' },
    'tools.jsonPath.subtitle': { en: 'Paste JSON and explore it as an interactive tree. Click any node to get its full path in dot and bracket notation.', es: 'Pega JSON y explóralo como un árbol interactivo. Haz clic en cualquier nodo para obtener su ruta completa en notación de punto y de corchetes.' },

    'tools.jsonTree.title': { en: 'JSON Tree Viewer', es: 'Visor de Árbol JSON' },
    'tools.jsonTree.subtitle': { en: 'Collapsible JSON tree viewer with type badges and search. Paste JSON to explore its structure.', es: 'Visor de árbol JSON plegable con etiquetas de tipo y búsqueda. Pega JSON para explorar su estructura.' },

    'tools.jsonEscape.title': { en: 'JSON String Escape', es: 'Escape de Cadenas JSON' },
    'tools.jsonEscape.title2': { en: 'Unescape', es: 'Desescape' },
    'tools.jsonEscape.subtitle': { en: 'Escape and unescape strings for JSON — convert quotes, backslashes, newlines, tabs, and unicode characters to their JSON-safe equivalents. Live conversion, no sign-up required.', es: 'Escapa y desescapa cadenas para JSON — convierte comillas, barras invertidas, saltos de línea, tabulaciones y caracteres unicode a sus equivalentes seguros para JSON. Conversión en vivo, sin registro.' },

    'tools.jsonSchema.title': { en: 'JSON Schema', es: 'Esquema JSON' },
    'tools.jsonSchema.title2': { en: 'Generator', es: 'Generador' },
    'tools.jsonSchema.subtitle': { en: 'Paste any JSON and instantly generate a valid JSON Schema (draft-07) with type detection, nested objects, arrays, and format inference.', es: 'Pega cualquier JSON y genera al instante un JSON Schema válido (draft-07) con detección de tipos, objetos anidados, arreglos e inferencia de formato.' },

    'tools.csvJson.title': { en: 'CSV', es: 'CSV' },
    'tools.csvJson.title2': { en: 'JSON', es: 'JSON' },
    'tools.csvJson.title3': { en: 'Converter', es: 'Conversor' },
    'tools.csvJson.subtitle': { en: 'Convert between CSV and JSON bidirectionally. Handles quoted fields, nested objects, multiple delimiters &mdash; all client-side, no data leaves your browser.', es: 'Convierte entre CSV y JSON de forma bidireccional. Maneja campos entrecomillados, objetos anidados y múltiples delimitadores &mdash; todo en el cliente, ningún dato sale de tu navegador.' },

    'tools.yamlJson.title': { en: 'YAML', es: 'YAML' },
    'tools.yamlJson.title2': { en: 'JSON Converter', es: 'Conversor JSON' },
    'tools.yamlJson.subtitle': { en: 'Convert between YAML and JSON instantly — bidirectional conversion with syntax highlighting, no sign-up required.', es: 'Convierte entre YAML y JSON al instante — conversión bidireccional con resaltado de sintaxis, sin registro.' },

    'tools.htmlEntities.title': { en: 'HTML Entity Encoder', es: 'Codificador de Entidades HTML' },
    'tools.htmlEntities.title2': { en: 'Decoder', es: 'Decodificador' },
    'tools.htmlEntities.subtitle': { en: 'Encode special HTML characters to entities and decode entities back to characters — named & numeric entity support, live conversion, no sign-up required.', es: 'Codifica caracteres HTML especiales a entidades y decodifica entidades de vuelta a caracteres — compatible con entidades con nombre y numéricas, conversión en vivo, sin registro.' },

    'tools.htmlMinifier.title': { en: 'HTML Minifier', es: 'Minificador HTML' },
    'tools.htmlMinifier.title2': { en: 'Beautifier', es: 'Embellecedor' },
    'tools.htmlMinifier.subtitle': { en: 'Minify or beautify HTML, remove comments and whitespace, see size stats.', es: 'Minifica o embellece HTML, elimina comentarios y espacios en blanco, y consulta las estadísticas de tamaño.' },

    'tools.cssMinifier.title': { en: 'CSS Minifier', es: 'Minificador CSS' },
    'tools.cssMinifier.title2': { en: 'Beautifier', es: 'Embellecedor' },
    'tools.cssMinifier.subtitle': { en: 'Minify or beautify CSS instantly — compress for production or format for readability, no sign-up required.', es: 'Minifica o embellece CSS al instante — comprime para producción o formatea para legibilidad, sin registro.' },

    'tools.jsMinifier.title': { en: 'JavaScript Minifier', es: 'Minificador de JavaScript' },
    'tools.jsMinifier.title2': { en: 'Beautifier', es: 'Embellecedor' },
    'tools.jsMinifier.subtitle': { en: 'Minify or beautify JavaScript code with live processing.', es: 'Minifica o embellece código JavaScript con procesamiento en vivo.' },

    // Batch 3 — text / markdown / encoding tools
    'tools.markdownEditor.title': { en: 'Markdown Preview', es: 'Vista Previa de Markdown' },
    'tools.markdownEditor.title2': { en: 'Editor', es: 'Editor' },
    'tools.markdownEditor.subtitle': { en: 'Write GitHub Flavored Markdown with a live HTML preview — no sign-up, fully client-side.', es: 'Escribe Markdown con sabor GitHub y una vista previa HTML en vivo — sin registro, totalmente en el cliente.' },

    'tools.mdTableGenerator.title': { en: 'Markdown Table', es: 'Tabla Markdown' },
    'tools.mdTableGenerator.title2': { en: 'Generator', es: 'Generador' },
    'tools.mdTableGenerator.subtitle': { en: 'Visual table editor with live Markdown preview, CSV import, HTML export, and column alignment controls.', es: 'Editor visual de tablas con vista previa de Markdown en vivo, importación CSV, exportación HTML y controles de alineación de columnas.' },

    'tools.htmlToMd.title': { en: 'HTML', es: 'HTML' },
    'tools.htmlToMd.title2': { en: 'Markdown Converter', es: 'Conversor Markdown' },
    'tools.htmlToMd.subtitle': { en: 'Convert between HTML and Markdown instantly — bidirectional, no sign-up, no external libraries.', es: 'Convierte entre HTML y Markdown al instante — bidireccional, sin registro, sin librerías externas.' },

    'tools.sqlFormatter.title': { en: 'SQL Formatter', es: 'Formateador SQL' },
    'tools.sqlFormatter.title2': { en: 'Beautifier', es: 'Embellecedor' },
    'tools.sqlFormatter.subtitle': { en: 'Format, beautify, minify and syntax-highlight SQL instantly — supports PostgreSQL, MySQL and SQLite. No sign-up required.', es: 'Formatea, embellece, minifica y resalta la sintaxis de SQL al instante — compatible con PostgreSQL, MySQL y SQLite. Sin registro.' },

    'tools.stringRepeater.title': { en: 'Text/String Repeater', es: 'Repetidor de Texto/Cadenas' },
    'tools.stringRepeater.title2': { en: 'Multiplier', es: 'Multiplicador' },
    'tools.stringRepeater.subtitle': { en: 'Repeat text N times with custom separators, reverse, shuffle, sort, number lines, wrap with prefix/suffix — no sign-up required.', es: 'Repite texto N veces con separadores personalizados, invierte, mezcla, ordena, numera líneas y envuelve con prefijo/sufijo — sin registro.' },

    'tools.lineSorter.title': { en: 'Line Sorter', es: 'Ordenador de Líneas' },
    'tools.lineSorter.subtitle': { en: 'Sort lines alphabetically, by length, numerically, or randomly. Remove duplicates and empty lines.', es: 'Ordena líneas alfabéticamente, por longitud, numéricamente o al azar. Elimina duplicados y líneas vacías.' },

    'tools.binaryText.title': { en: 'Binary', es: 'Binario' },
    'tools.binaryText.title2': { en: 'Text', es: 'Texto' },
    'tools.binaryText.title3': { en: 'Converter', es: 'Conversor' },
    'tools.binaryText.subtitle': { en: 'Convert between text and binary representation with per-character breakdown, separator options, and ASCII/UTF-8 support.', es: 'Convierte entre texto y representación binaria con desglose por carácter, opciones de separador y compatibilidad con ASCII/UTF-8.' },

    'tools.baseConverter.title': { en: 'Number Base', es: 'Base Numérica' },
    'tools.baseConverter.title2': { en: 'Converter', es: 'Conversor' },
    'tools.baseConverter.subtitle': { en: 'Convert between Binary, Octal, Decimal, and Hexadecimal instantly with bit visualization and BigInt support.', es: 'Convierte entre binario, octal, decimal y hexadecimal al instante con visualización de bits y compatibilidad con BigInt.' },

    'tools.caesarCipher.title': { en: 'ROT13', es: 'ROT13' },
    'tools.caesarCipher.title2': { en: 'Caesar Cipher', es: 'Cifrado César' },
    'tools.caesarCipher.subtitle': { en: 'Encode and decode text with ROT13 or any Caesar cipher shift (1-25). Live preview, brute-force all 26 rotations, preserves case and non-alpha characters.', es: 'Codifica y decodifica texto con ROT13 o cualquier desplazamiento del cifrado César (1-25). Vista previa en vivo, fuerza bruta sobre las 26 rotaciones, conserva mayúsculas y caracteres no alfabéticos.' },

    'tools.morseCode.title': { en: 'Morse Code', es: 'Código Morse' },
    'tools.morseCode.title2': { en: 'Translator', es: 'Traductor' },
    'tools.morseCode.subtitle': { en: 'Encode text to Morse code and decode Morse back to text — play audio, visual display, speed control, no sign-up required.', es: 'Codifica texto a código Morse y decodifica Morse de vuelta a texto — reproduce audio, visualización, control de velocidad, sin registro.' },

    'tools.hmacGenerator.title': { en: 'HMAC', es: 'HMAC' },
    'tools.hmacGenerator.title2': { en: 'Generator', es: 'Generador' },
    'tools.hmacGenerator.subtitle': { en: 'Generate HMAC signatures with SHA-1, SHA-256, SHA-384, and SHA-512. Verify API signatures, authenticate webhooks — all client-side, no data leaves your browser.', es: 'Genera firmas HMAC con SHA-1, SHA-256, SHA-384 y SHA-512. Verifica firmas de API y autentica webhooks — todo en el cliente, ningún dato sale de tu navegador.' },

    'tools.asciiArt.title': { en: 'ASCII Art Generator', es: 'Generador de Arte ASCII' },
    'tools.asciiArt.subtitle': { en: 'Type text and render it as ASCII art block letters. Supports A-Z, 0-9, and basic punctuation.', es: 'Escribe texto y conviértelo en letras de bloque de arte ASCII. Admite A-Z, 0-9 y puntuación básica.' },

    'tools.aspectRatio.title': { en: 'Aspect Ratio', es: 'Relación de Aspecto' },
    'tools.aspectRatio.title2': { en: 'Calculator', es: 'Calculadora' },
    'tools.aspectRatio.subtitle': { en: 'Calculate simplified aspect ratios, lock dimensions, preview proportions, and get CSS output — with presets for social media and common resolutions.', es: 'Calcula relaciones de aspecto simplificadas, bloquea dimensiones, previsualiza proporciones y obtén la salida CSS — con preajustes para redes sociales y resoluciones comunes.' },

    'tools.chmodCalculator.title': { en: 'Chmod', es: 'Chmod' },
    'tools.chmodCalculator.title2': { en: 'Calculator', es: 'Calculadora' },
    'tools.chmodCalculator.subtitle': { en: 'Interactive file permission calculator with numeric & symbolic notation, presets, umask calculator, and ready-to-use commands.', es: 'Calculadora interactiva de permisos de archivos con notación numérica & simbólica, preajustes, calculadora de umask y comandos listos para usar.' },

    // Batch 4 — CSS / design-system / color tools
    'tools.cssUnits.title': { en: 'CSS Units Converter', es: 'Conversor de Unidades CSS' },
    'tools.cssUnits.subtitle': { en: 'Convert between px, rem, em, %, vw, vh, pt, cm, mm, and in — see all results at once with custom base font size and viewport dimensions.', es: 'Convierte entre px, rem, em, %, vw, vh, pt, cm, mm e in — consulta todos los resultados a la vez con tamaño de fuente base y dimensiones de viewport personalizados.' },

    'tools.cssVariables.title': { en: 'CSS Custom Properties', es: 'Propiedades Personalizadas CSS' },
    'tools.cssVariables.title2': { en: 'Generator', es: 'Generador' },
    'tools.cssVariables.subtitle': { en: 'Build a design system with live preview. Export to CSS, SCSS, JSON, or Tailwind config.', es: 'Construye un sistema de diseño con vista previa en vivo. Exporta a CSS, SCSS, JSON o configuración de Tailwind.' },

    'tools.mediaQuery.title': { en: 'Media Query', es: 'Media Query' },
    'tools.mediaQuery.title2': { en: 'Builder', es: 'Constructor' },
    'tools.mediaQuery.subtitle': { en: 'Visual media query generator with framework presets, live breakpoint detection, and one-click copy. 100% client-side.', es: 'Generador visual de media queries con preajustes de frameworks, detección de breakpoints en vivo y copia con un clic. 100% en el cliente.' },

    'tools.scrollSnap.title': { en: 'Scroll Snap Builder', es: 'Constructor de Scroll Snap' },
    'tools.scrollSnap.subtitle': { en: 'Build CSS scroll-snap layouts with a live preview. Configure direction, snap type, and alignment.', es: 'Construye diseños CSS con scroll-snap y vista previa en vivo. Configura dirección, tipo de anclaje y alineación.' },

    'tools.transitionGenerator.title': { en: 'Transition Generator', es: 'Generador de Transiciones' },
    'tools.transitionGenerator.subtitle': { en: 'Build CSS transitions with timing functions, cubic-bezier curves, and live preview.', es: 'Construye transiciones CSS con funciones de temporización, curvas cubic-bezier y vista previa en vivo.' },

    'tools.buttonGenerator.title': { en: 'Button Generator', es: 'Generador de Botones' },
    'tools.buttonGenerator.subtitle': { en: 'CSS button builder with 10 presets, hover states, and live preview.', es: 'Constructor de botones CSS con 10 preajustes, estados hover y vista previa en vivo.' },

    'tools.animationGenerator.title': { en: 'CSS Animation Generator', es: 'Generador de Animaciones CSS' },
    'tools.animationGenerator.subtitle': { en: 'Visually build CSS keyframe animations with live preview and one-click code export. No sign-up, runs entirely in your browser.', es: 'Construye visualmente animaciones CSS con keyframes, vista previa en vivo y exportación de código con un clic. Sin registro, se ejecuta enteramente en tu navegador.' },

    'tools.designTokens.title': { en: 'Design Token', es: 'Tokens de Diseño' },
    'tools.designTokens.title2': { en: 'Converter', es: 'Conversor' },
    'tools.designTokens.subtitle': { en: 'Paste Figma Tokens JSON, convert to CSS custom properties, SCSS variables, Tailwind theme config or flat JSON instantly.', es: 'Pega el JSON de Figma Tokens y conviértelo al instante en propiedades personalizadas CSS, variables SCSS, configuración de tema de Tailwind o JSON plano.' },

    'tools.spacingScale.title': { en: 'Spacing Scale Generator', es: 'Generador de Escalas de Espaciado' },
    'tools.spacingScale.subtitle': { en: 'Generate consistent spacing scales (linear or geometric) with visual bars and CSS variable output.', es: 'Genera escalas de espaciado consistentes (lineales o geométricas) con barras visuales y salida en variables CSS.' },

    'tools.colorShades.title': { en: 'Color Shades', es: 'Sombras de Color' },
    'tools.colorShades.title2': { en: 'Tones', es: 'Tonos' },
    'tools.colorShades.subtitle': { en: 'Enter a color and generate tints, shades, tones, and color harmonies. Export as CSS variables, Tailwind config, or SCSS.', es: 'Introduce un color y genera tintes, sombras, tonos y armonías de color. Exporta como variables CSS, configuración de Tailwind o SCSS.' },

    'tools.colorName.title': { en: 'CSS Color Name Finder', es: 'Buscador de Nombres de Color CSS' },
    'tools.colorName.subtitle': { en: 'Find the closest named CSS color from any hex value. Browse all 148 named colors.', es: 'Encuentra el color CSS con nombre más cercano a cualquier valor hex. Explora los 148 colores con nombre.' },

    'tools.colorBlindness.title': { en: 'Color Blindness', es: 'Daltonismo' },
    'tools.colorBlindness.title2': { en: 'Simulator', es: 'Simulador' },
    'tools.colorBlindness.subtitle': { en: 'See how your colors appear under different types of color vision deficiency. Test contrast, simulate swatches, and apply filters to images.', es: 'Observa cómo se ven tus colores bajo distintos tipos de deficiencia de visión cromática. Prueba el contraste, simula muestras y aplica filtros a imágenes.' },

    'tools.apcaContrast.title': { en: 'APCA Contrast', es: 'Contraste APCA' },
    'tools.apcaContrast.title2': { en: 'WCAG 3', es: 'WCAG 3' },
    'tools.apcaContrast.subtitle': { en: 'Compare WCAG 2.x contrast ratio with APCA (WCAG 3 draft) Lc value side by side. Font-size and weight aware compliance checking.', es: 'Compara lado a lado la relación de contraste WCAG 2.x con el valor Lc de APCA (borrador WCAG 3). Verificación de cumplimiento sensible al tamaño y grosor de la fuente.' },

    'tools.apiRequestBuilder.title': { en: 'API Request', es: 'Peticiones de API' },
    'tools.apiRequestBuilder.title2': { en: 'Builder', es: 'Constructor' },
    'tools.apiRequestBuilder.subtitle': { en: 'Build, send and inspect HTTP requests directly from your browser — no backend, no sign-up.', es: 'Construye, envía e inspecciona peticiones HTTP directamente desde tu navegador — sin backend, sin registro.' },

    // Batch 5 — network / device / image tools
    'tools.dnsLookup.title': { en: 'DNS Record', es: 'Registros DNS' },
    'tools.dnsLookup.title2': { en: 'Lookup', es: 'Consulta' },
    'tools.dnsLookup.subtitle': { en: 'Query DNS records for any domain using Cloudflare DNS-over-HTTPS. View A, AAAA, CNAME, MX, NS, TXT, SOA, and SRV records with TTL values — all client-side.', es: 'Consulta los registros DNS de cualquier dominio usando Cloudflare DNS-over-HTTPS. Visualiza registros A, AAAA, CNAME, MX, NS, TXT, SOA y SRV con sus valores TTL — todo en el cliente.' },

    'tools.ipLookup.title': { en: 'IP Address', es: 'Dirección IP' },
    'tools.ipLookup.title2': { en: 'Info', es: 'Info' },
    'tools.ipLookup.subtitle': { en: 'Detect your public IP, validate IPv4/IPv6 addresses, calculate subnets, and explore private IP ranges -- no sign-up required.', es: 'Detecta tu IP pública, valida direcciones IPv4/IPv6, calcula subredes y explora rangos de IP privadas -- sin registro.' },

    'tools.webhookTester.title': { en: 'Webhook Tester', es: 'Probador de Webhooks' },
    'tools.webhookTester.subtitle': { en: 'Build webhook payloads with templates for GitHub, Stripe, and Slack. Generate cURL commands.', es: 'Construye payloads de webhook con plantillas para GitHub, Stripe y Slack. Genera comandos cURL.' },

    'tools.httpStatus.title': { en: 'HTTP Status Code', es: 'Códigos de Estado HTTP' },
    'tools.httpStatus.title2': { en: 'Reference', es: 'Referencia' },
    'tools.httpStatus.subtitle': { en: 'Searchable reference of every HTTP status code (1xx-5xx) with descriptions, common use cases, and detailed explanations. Color-coded by category.', es: 'Referencia consultable de todos los códigos de estado HTTP (1xx-5xx) con descripciones, casos de uso comunes y explicaciones detalladas. Codificada por color según la categoría.' },

    'tools.mimeLookup.title': { en: 'MIME Type Lookup', es: 'Consulta de Tipos MIME' },
    'tools.mimeLookup.subtitle': { en: 'Searchable MIME type reference. Find MIME types by file extension or search by type.', es: 'Referencia consultable de tipos MIME. Encuentra tipos MIME por extensión de archivo o busca por tipo.' },

    'tools.uaParser.title': { en: 'User Agent Parser', es: 'Analizador de User Agent' },
    'tools.uaParser.subtitle': { en: 'Parse any user agent string to detect browser, OS, device type, and rendering engine.', es: 'Analiza cualquier cadena de user agent para detectar el navegador, el sistema operativo, el tipo de dispositivo y el motor de renderizado.' },

    'tools.screenInfo.title': { en: 'Screen Resolution', es: 'Resolución de Pantalla' },
    'tools.screenInfo.title2': { en: 'Pixel Density', es: 'Densidad de Píxeles' },
    'tools.screenInfo.subtitle': { en: 'Auto-detect your screen resolution, viewport size, DPR, color depth, orientation, and more. Calculate PPI/DPI for any display.', es: 'Detecta automáticamente la resolución de tu pantalla, el tamaño del viewport, el DPR, la profundidad de color, la orientación y más. Calcula el PPI/DPI de cualquier pantalla.' },

    'tools.responsivePreview.title': { en: 'Responsive Preview', es: 'Vista Previa Responsiva' },
    'tools.responsivePreview.subtitle': { en: 'Preview any URL at different screen sizes. Compare devices side-by-side, rotate between portrait and landscape, and test with custom dimensions.', es: 'Previsualiza cualquier URL en distintos tamaños de pantalla. Compara dispositivos lado a lado, alterna entre vertical y horizontal y prueba con dimensiones personalizadas.' },

    'tools.ogImagePreview.title': { en: 'OG Image Preview', es: 'Vista Previa de Imagen OG' },
    'tools.ogImagePreview.subtitle': { en: 'Preview how your Open Graph tags will look on Facebook, Twitter/X, LinkedIn, and Discord.', es: 'Previsualiza cómo se verán tus etiquetas Open Graph en Facebook, Twitter/X, LinkedIn y Discord.' },

    'tools.faviconGenerator.title': { en: 'Favicon', es: 'Favicon' },
    'tools.faviconGenerator.title2': { en: 'Generator', es: 'Generador' },
    'tools.faviconGenerator.subtitle': { en: 'Generate favicons from text, emoji, or uploaded images. Customize colors, shape, and font. Download as PNG or ICO with ready-to-use HTML tags.', es: 'Genera favicons a partir de texto, emojis o imágenes subidas. Personaliza colores, forma y fuente. Descarga como PNG o ICO con etiquetas HTML listas para usar.' },

    'tools.placeholderImage.title': { en: 'Placeholder Image', es: 'Imágenes de Relleno' },
    'tools.placeholderImage.title2': { en: 'Generator', es: 'Generador' },
    'tools.placeholderImage.subtitle': { en: 'Generate custom placeholder images with configurable dimensions, colors, text & format. Download or copy as data URI — no external service needed.', es: 'Genera imágenes de relleno personalizadas con dimensiones, colores, texto y formato configurables. Descárgalas o cópialas como data URI — sin necesidad de servicios externos.' },

    'tools.imageResizer.title': { en: 'Image Resizer', es: 'Redimensionador de Imágenes' },
    'tools.imageResizer.subtitle': { en: 'Resize images by percentage, exact dimensions, or social media presets. All processing happens in your browser — nothing is uploaded.', es: 'Redimensiona imágenes por porcentaje, dimensiones exactas o preajustes de redes sociales. Todo el procesamiento ocurre en tu navegador — no se sube nada.' },

    'tools.charMap.title': { en: 'Special Characters & Symbols Map', es: 'Mapa de Caracteres Especiales & Símbolos' },
    'tools.charMap.subtitle': { en: 'Browse 400+ Unicode characters across 8 categories. Click any glyph to copy it as a character, HTML entity, or Unicode codepoint — all client-side, no sign-up.', es: 'Explora más de 400 caracteres Unicode en 8 categorías. Haz clic en cualquier glifo para copiarlo como carácter, entidad HTML o punto de código Unicode — todo en el cliente, sin registro.' },

    'tools.checklist.title': { en: 'Checklist Maker', es: 'Creador de Listas de Verificación' },
    'tools.checklist.subtitle': { en: 'Create checklists, check items off, and export as Markdown. Use templates for code review, deploy, or PR checklists.', es: 'Crea listas de verificación, marca elementos como completados y expórtalas como Markdown. Usa plantillas para revisión de código, despliegue o PRs.' },

    // Batch 6 — SEO / security / project-config tools
    'tools.seoChecker.title': { en: 'SEO Checker', es: 'Verificador SEO' },
    'tools.seoChecker.subtitle': { en: 'Analyze your page title, meta description, and keywords with a live Google SERP preview. Get instant SEO suggestions — 100% client-side.', es: 'Analiza el título, la meta descripción y las palabras clave de tu página con una vista previa en vivo del SERP de Google. Obtén sugerencias SEO al instante — 100% en el cliente.' },

    'tools.headingChecker.title': { en: 'Heading Checker', es: 'Verificador de Encabezados' },
    'tools.headingChecker.subtitle': { en: 'Extract HTML headings, visualize hierarchy tree, and flag SEO issues.', es: 'Extrae los encabezados HTML, visualiza el árbol de jerarquía y señala problemas de SEO.' },

    'tools.sitemapGenerator.title': { en: 'Sitemap', es: 'Sitemap' },
    'tools.sitemapGenerator.title2': { en: 'XML', es: 'XML' },
    'tools.sitemapGenerator.title3': { en: 'Generator', es: 'Generador' },
    'tools.sitemapGenerator.subtitle': { en: 'Generate valid sitemap.xml files with per-URL options for lastmod, changefreq and priority. Download or copy instantly.', es: 'Genera archivos sitemap.xml válidos con opciones por URL para lastmod, changefreq y priority. Descarga o copia al instante.' },

    'tools.robotsGenerator.title': { en: 'Robots Meta Tag', es: 'Meta Etiqueta Robots' },
    'tools.robotsGenerator.title2': { en: 'robots.txt Generator', es: 'Generador de robots.txt' },
    'tools.robotsGenerator.subtitle': { en: 'Visually build robots meta tags and robots.txt directives for search engine crawlers — no sign-up required.', es: 'Construye visualmente meta etiquetas robots y directivas de robots.txt para los rastreadores de buscadores — sin registro.' },

    'tools.slugGenerator.title': { en: 'Slug Generator', es: 'Generador de Slugs' },
    'tools.slugGenerator.subtitle': { en: 'Convert any text into clean, URL-friendly slugs. Transliterates accented characters, supports multiple case styles, and bulk mode.', es: 'Convierte cualquier texto en slugs limpios y aptos para URL. Translitera caracteres acentuados, admite varios estilos de capitalización y modo por lotes.' },

    'tools.textCounter.title': { en: 'Text Counter', es: 'Contador de Texto' },
    'tools.textCounter.title2': { en: 'Analyzer', es: 'Analizador' },
    'tools.textCounter.subtitle': { en: 'Paste text and get instant stats: word count, character count, reading time, keyword density, and more — real-time as you type.', es: 'Pega texto y obtén estadísticas al instante: número de palabras, número de caracteres, tiempo de lectura, densidad de palabras clave y más — en tiempo real mientras escribes.' },

    'tools.jwtGenerator.title': { en: 'JWT Generator', es: 'Generador JWT' },
    'tools.jwtGenerator.title2': { en: 'Builder', es: 'Constructor' },
    'tools.jwtGenerator.subtitle': { en: 'Build and sign JSON Web Tokens visually — configure headers, set claims, pick expiration dates, and sign with HMAC. Client-side only, no data sent anywhere.', es: 'Construye y firma JSON Web Tokens visualmente — configura cabeceras, define claims, elige fechas de expiración y firma con HMAC. Solo en el cliente, sin enviar datos a ningún lado.' },

    'tools.jwtCheatsheet.title': { en: 'JWT Cheatsheet', es: 'Chuleta de JWT' },
    'tools.jwtCheatsheet.subtitle': { en: 'JWT claims reference with algorithm comparison. Quick lookup for JSON Web Token development.', es: 'Referencia de claims JWT con comparación de algoritmos. Consulta rápida para el desarrollo con JSON Web Tokens.' },

    'tools.envValidator.title': { en: '.env Validator', es: 'Validador de .env' },
    'tools.envValidator.title2': { en: 'Secret Scanner', es: 'Escáner de Secretos' },
    'tools.envValidator.subtitle': { en: 'Validate .env file syntax, detect leaked secrets, and export sanitized .env.example files — 100% client-side, no data leaves your browser.', es: 'Valida la sintaxis de archivos .env, detecta secretos filtrados y exporta archivos .env.example saneados — 100% en el cliente, ningún dato sale de tu navegador.' },

    'tools.gitignoreGenerator.title': { en: '.gitignore Generator', es: 'Generador de .gitignore' },
    'tools.gitignoreGenerator.subtitle': { en: 'Select your technologies and generate a comprehensive .gitignore file instantly.', es: 'Selecciona tus tecnologías y genera al instante un archivo .gitignore completo.' },

    'tools.licensePicker.title': { en: 'License Picker', es: 'Selector de Licencias' },
    'tools.licensePicker.subtitle': { en: 'Browse 15+ open source licenses, compare permissions, and generate a LICENSE file for your project.', es: 'Explora más de 15 licencias de código abierto, compara permisos y genera un archivo LICENSE para tu proyecto.' },

    'tools.packageJson.title': { en: 'package.json Builder', es: 'Constructor de package.json' },
    'tools.packageJson.subtitle': { en: 'Visual package.json editor with script presets for Node.js, React, TypeScript, and Vite.', es: 'Editor visual de package.json con preajustes de scripts para Node.js, React, TypeScript y Vite.' },

    'tools.npmSearch.title': { en: 'NPM Package', es: 'Paquetes NPM' },
    'tools.npmSearch.title2': { en: 'Info', es: 'Info' },
    'tools.npmSearch.subtitle': { en: 'Search the npm registry, compare install commands across package managers, check bundle sizes, and explore package details.', es: 'Busca en el registro de npm, compara comandos de instalación entre gestores de paquetes, revisa el tamaño de los bundles y explora los detalles de cada paquete.' },

    'tools.countdown.title': { en: 'Countdown Timer', es: 'Temporizador de Cuenta Regresiva' },
    'tools.countdown.subtitle': { en: 'Set a target date and time, watch the countdown live.', es: 'Fija una fecha y hora objetivo y observa la cuenta regresiva en vivo.' },

    // Batch 7 — DevOps references, productivity and data tools
    'tools.cronBuilder.title': { en: 'Cron Expression', es: 'Expresiones Cron' },
    'tools.cronBuilder.title2': { en: 'Builder', es: 'Constructor' },
    'tools.cronBuilder.subtitle': { en: 'Build, validate and preview cron schedules visually — see next run times instantly, no sign-up required.', es: 'Construye, valida y previsualiza programaciones cron de forma visual — consulta las próximas ejecuciones al instante, sin registro.' },

    'tools.regexBuilder.ph.pattern': { en: 'Type a pattern — e.g. \\b\\w+@\\w+\\.\\w{2,}\\b', es: 'Escribe un patrón — ej. \\b\\w+@\\w+\\.\\w{2,}\\b' },
    'tools.regexBuilder.ph.testText': { en: 'Paste the text you want to match against…', es: 'Pega el texto contra el que quieres buscar coincidencias…' },
    'tools.regexBuilder.ph.replacement': { en: 'Use $1, $&, $<name> to reference captures', es: 'Usa $1, $&, $<name> para referenciar capturas' },
    'tools.regexBuilder.title': { en: 'Regex Builder', es: 'Constructor de Regex' },
    'tools.regexBuilder.title2': { en: '& Tester', es: '& Probador' },
    'tools.regexBuilder.subtitle': { en: 'Build, test and debug regular expressions with live match highlighting, capture groups and a find-and-replace preview — everything runs in your browser.', es: 'Construye, prueba y depura expresiones regulares con resaltado de coincidencias en vivo, grupos de captura y vista previa de buscar y reemplazar — todo se ejecuta en tu navegador.' },

    // HAR File Analyzer
    'tools.harAnalyzer.title': { en: 'HAR File Analyzer', es: 'Analizador de Archivos HAR' },
    'tools.harAnalyzer.title2': { en: '& Waterfall', es: '& Cascada' },
    'tools.harAnalyzer.subtitle': { en: 'Drop a .har capture and get a request waterfall, reconstructed Core Web Vitals, a performance findings list and a privacy-redacted export. Nothing is uploaded — the file never leaves your browser.', es: 'Suelta una captura .har y obtén una cascada de peticiones, Core Web Vitals reconstruidos, una lista de hallazgos de rendimiento y una exportación censurada. Nada se sube — el archivo nunca sale de tu navegador.' },

    'tools.harAnalyzer.drop.title': { en: 'Drop a .har file here', es: 'Suelta un archivo .har aquí' },
    'tools.harAnalyzer.drop.hint': { en: 'Parsed in a background thread, so even a 100 MB capture will not freeze the tab.', es: 'Se analiza en un hilo en segundo plano, así que ni una captura de 100 MB congelará la pestaña.' },
    'tools.harAnalyzer.drop.choose': { en: 'Choose a file', es: 'Elegir archivo' },
    'tools.harAnalyzer.drop.sample': { en: 'Try a sample capture', es: 'Probar una captura de ejemplo' },
    'tools.harAnalyzer.drop.privacy': { en: '100% client-side — no upload, no server, no telemetry.', es: '100% en el cliente — sin subidas, sin servidor, sin telemetría.' },

    'tools.harAnalyzer.howto.title': { en: 'How to capture a HAR', es: 'Cómo capturar un HAR' },
    'tools.harAnalyzer.howto.note': { en: 'A HAR records every request your browser made, including cookies and auth headers. Use the redaction export below before sharing one with anybody.', es: 'Un HAR registra todas las peticiones del navegador, incluidas cookies y cabeceras de autenticación. Usa la exportación censurada antes de compartirlo con nadie.' },

    'tools.harAnalyzer.action.copySummary': { en: 'Copy summary', es: 'Copiar resumen' },
    'tools.harAnalyzer.action.report': { en: 'Download report', es: 'Descargar informe' },
    'tools.harAnalyzer.action.redact': { en: 'Download redacted HAR', es: 'Descargar HAR censurado' },
    'tools.harAnalyzer.action.redacting': { en: 'Redacting…', es: 'Censurando…' },
    'tools.harAnalyzer.action.share': { en: 'Share link', es: 'Enlace para compartir' },
    'tools.harAnalyzer.action.building': { en: 'Building…', es: 'Generando…' },
    'tools.harAnalyzer.action.linkCopied': { en: 'Link copied!', es: '¡Enlace copiado!' },
    'tools.harAnalyzer.action.newFile': { en: 'New file', es: 'Nuevo archivo' },

    'tools.harAnalyzer.notice.snapshot': { en: 'You are viewing a shared snapshot. It carries the summary and the first requests only — the original HAR was never uploaded, so bodies, headers and redaction are unavailable here.', es: 'Estás viendo una instantánea compartida. Solo incluye el resumen y las primeras peticiones — el HAR original nunca se subió, así que los cuerpos, cabeceras y la censura no están disponibles aquí.' },
    'tools.harAnalyzer.notice.truncated1': { en: 'This capture is very large. Showing the first', es: 'Esta captura es muy grande. Mostrando las primeras' },
    'tools.harAnalyzer.notice.truncated2': { en: 'requests; entries not analysed:', es: 'peticiones; entradas no analizadas:' },
    'tools.harAnalyzer.notice.shareTooLarge': { en: 'This analysis is too large to fit in a share link. Download the Markdown report instead — it holds the full picture.', es: 'Este análisis es demasiado grande para un enlace. Descarga el informe Markdown en su lugar — contiene todo el detalle.' },

    'tools.harAnalyzer.redaction.done': { en: 'Redacted HAR downloaded. Removed:', es: 'HAR censurado descargado. Se eliminaron:' },
    'tools.harAnalyzer.redaction.headers': { en: 'credential headers', es: 'cabeceras con credenciales' },
    'tools.harAnalyzer.redaction.cookies': { en: 'cookies', es: 'cookies' },
    'tools.harAnalyzer.redaction.bodies': { en: 'bodies', es: 'cuerpos' },
    'tools.harAnalyzer.redaction.params': { en: 'query parameters', es: 'parámetros de consulta' },

    'tools.harAnalyzer.stat.requests': { en: 'Requests', es: 'Peticiones' },
    'tools.harAnalyzer.stat.transferred': { en: 'Transferred', es: 'Transferido' },
    'tools.harAnalyzer.stat.uncompressed': { en: 'uncompressed', es: 'sin comprimir' },
    'tools.harAnalyzer.stat.span': { en: 'Total span', es: 'Duración total' },
    'tools.harAnalyzer.stat.load': { en: 'Load event', es: 'Evento load' },
    'tools.harAnalyzer.stat.failed': { en: 'Failed', es: 'Fallidas' },
    'tools.harAnalyzer.stat.redirects': { en: 'redirects', es: 'redirecciones' },
    'tools.harAnalyzer.stat.domains': { en: 'Domains', es: 'Dominios' },
    'tools.harAnalyzer.stat.thirdParty': { en: 'third-party', es: 'de terceros' },

    'tools.harAnalyzer.vitals.title': { en: 'Core Web Vitals', es: 'Core Web Vitals' },
    'tools.harAnalyzer.vitals.lede': { en: 'A HAR records network activity, not painting. Metrics marked "measured" were read straight from the capture; "estimated" ones are bounds derived from the request timeline, and CLS cannot be reconstructed at all. Each card explains its own method.', es: 'Un HAR registra actividad de red, no pintado. Las métricas marcadas como "measured" se leyeron de la captura; las "estimated" son cotas derivadas de la línea temporal, y CLS no puede reconstruirse en absoluto. Cada tarjeta explica su método.' },
    'tools.harAnalyzer.vitals.good': { en: 'Good', es: 'Bueno' },

    'tools.harAnalyzer.byType.title': { en: 'Weight by resource type', es: 'Peso por tipo de recurso' },
    'tools.harAnalyzer.byType.foot': { en: 'Click a row to filter the request table to that type.', es: 'Haz clic en una fila para filtrar la tabla por ese tipo.' },
    'tools.harAnalyzer.byDomain.title': { en: 'Weight by domain', es: 'Peso por dominio' },
    'tools.harAnalyzer.byDomain.foot': { en: 'First-party domain detected as', es: 'Dominio propio detectado como' },

    'tools.harAnalyzer.findings.title': { en: 'Findings', es: 'Hallazgos' },
    'tools.harAnalyzer.findings.recoverable': { en: 'recoverable', es: 'recuperables' },
    'tools.harAnalyzer.findings.show': { en: 'Show the', es: 'Ver las' },
    'tools.harAnalyzer.findings.requests': { en: 'requests', es: 'peticiones' },

    'tools.harAnalyzer.table.title': { en: 'Requests', es: 'Peticiones' },
    'tools.harAnalyzer.table.empty': { en: 'No requests match these filters.', es: 'Ninguna petición coincide con estos filtros.' },
    'tools.harAnalyzer.table.showMore': { en: 'Show more', es: 'Ver más' },
    'tools.harAnalyzer.table.remaining': { en: 'remaining', es: 'restantes' },

    'tools.harAnalyzer.filter.search': { en: 'Search requests', es: 'Buscar peticiones' },
    'tools.harAnalyzer.filter.searchPh': { en: 'Filter by URL or MIME type…', es: 'Filtrar por URL o tipo MIME…' },
    'tools.harAnalyzer.filter.status': { en: 'Status', es: 'Estado' },
    'tools.harAnalyzer.filter.allStatus': { en: 'All statuses', es: 'Todos los estados' },
    'tools.harAnalyzer.filter.failed': { en: 'Failed only', es: 'Solo fallidas' },
    'tools.harAnalyzer.filter.domain': { en: 'Domain', es: 'Dominio' },
    'tools.harAnalyzer.filter.allDomains': { en: 'All domains', es: 'Todos los dominios' },
    'tools.harAnalyzer.filter.reset': { en: 'Reset filters', es: 'Restablecer filtros' },
    'tools.harAnalyzer.filter.thirdParty': { en: 'Third-party only', es: 'Solo terceros' },
    'tools.harAnalyzer.filter.slow': { en: 'Slower than 500 ms', es: 'Más de 500 ms' },
    'tools.harAnalyzer.filter.hideCached': { en: 'Hide cached', es: 'Ocultar caché' },

    'tools.harAnalyzer.col.name': { en: 'Name', es: 'Nombre' },
    'tools.harAnalyzer.col.status': { en: 'Status', es: 'Estado' },
    'tools.harAnalyzer.col.type': { en: 'Type', es: 'Tipo' },
    'tools.harAnalyzer.col.domain': { en: 'Domain', es: 'Dominio' },
    'tools.harAnalyzer.col.size': { en: 'Size', es: 'Tamaño' },
    'tools.harAnalyzer.col.time': { en: 'Time', es: 'Tiempo' },
    'tools.harAnalyzer.col.waterfall': { en: 'Waterfall', es: 'Cascada' },

    'tools.harAnalyzer.detail.headers': { en: 'Headers', es: 'Cabeceras' },
    'tools.harAnalyzer.detail.body': { en: 'Body', es: 'Cuerpo' },
    'tools.harAnalyzer.detail.timing': { en: 'Timing', es: 'Tiempos' },
    'tools.harAnalyzer.detail.reqHeaders': { en: 'Request headers', es: 'Cabeceras de petición' },
    'tools.harAnalyzer.detail.resHeaders': { en: 'Response headers', es: 'Cabeceras de respuesta' },
    'tools.harAnalyzer.detail.query': { en: 'Query string', es: 'Cadena de consulta' },
    'tools.harAnalyzer.detail.payload': { en: 'Request payload', es: 'Carga de la petición' },
    'tools.harAnalyzer.detail.response': { en: 'Response body', es: 'Cuerpo de la respuesta' },
    'tools.harAnalyzer.detail.binary': { en: 'Binary response — not previewable as text.', es: 'Respuesta binaria — no se puede previsualizar como texto.' },
    'tools.harAnalyzer.detail.noBody': { en: 'No response body was stored in this capture. DevTools omits bodies unless the capture was taken with them enabled.', es: 'Esta captura no guardó el cuerpo de la respuesta. DevTools los omite salvo que se capturen explícitamente.' },
    'tools.harAnalyzer.detail.truncated': { en: 'Preview truncated at 20 000 characters.', es: 'Vista previa truncada a 20 000 caracteres.' },
    'tools.harAnalyzer.detail.noTiming': { en: 'This entry carries no timing breakdown.', es: 'Esta entrada no incluye desglose de tiempos.' },
    'tools.harAnalyzer.detail.none': { en: 'None recorded.', es: 'Ninguna registrada.' },
    'tools.harAnalyzer.detail.loading': { en: 'Loading details…', es: 'Cargando detalles…' },
    'tools.harAnalyzer.detail.snapshot': { en: 'Per-request details are not part of a shared snapshot.', es: 'Los detalles por petición no forman parte de una instantánea compartida.' },
    'tools.harAnalyzer.detail.protocol': { en: 'Protocol', es: 'Protocolo' },
    'tools.harAnalyzer.detail.serverIp': { en: 'Server IP', es: 'IP del servidor' },
    'tools.harAnalyzer.detail.priority': { en: 'Priority', es: 'Prioridad' },
    'tools.harAnalyzer.detail.initiator': { en: 'Initiator', es: 'Iniciador' },
    'tools.harAnalyzer.detail.startedAt': { en: 'Started at', es: 'Comenzó en' },
    'tools.harAnalyzer.detail.contentSize': { en: 'Decoded size', es: 'Tamaño decodificado' },

    'tools.crontabRef.title': { en: 'Crontab Quick', es: 'Crontab Guía' },
    'tools.crontabRef.title2': { en: 'Reference', es: 'Rápida' },
    'tools.crontabRef.subtitle': { en: 'Visual cron syntax guide with 30+ expressions, category filters, search, and one-click copy. No sign-up required.', es: 'Guía visual de la sintaxis de cron con más de 30 expresiones, filtros por categoría, búsqueda y copia con un clic. Sin registro.' },

    'tools.dataSize.title': { en: 'Data Size / Storage Calculator', es: 'Calculadora de Tamaño de Datos / Almacenamiento' },
    'tools.dataSize.subtitle': { en: 'Convert between bytes, KB, MB, GB, TB, PB (binary & decimal). Calculate transfer times and plan your storage capacity.', es: 'Convierte entre bytes, KB, MB, GB, TB y PB (binario & decimal). Calcula tiempos de transferencia y planifica tu capacidad de almacenamiento.' },

    'tools.dockerRef.title': { en: 'Docker Compose', es: 'Docker Compose' },
    'tools.dockerRef.title2': { en: 'Reference', es: 'Referencia' },
    'tools.dockerRef.subtitle': { en: 'Searchable, categorized Docker Compose directives with YAML examples. No sign-up required.', es: 'Directivas de Docker Compose categorizadas y consultables, con ejemplos en YAML. Sin registro.' },

    'tools.emojiPicker.title': { en: 'Emoji Picker & Search', es: 'Selector y Buscador de Emojis' },
    'tools.emojiPicker.subtitle': { en: 'Search 500+ emojis, copy as emoji, HTML entity, or Unicode codepoint. Click to copy instantly.', es: 'Busca entre más de 500 emojis y cópialos como emoji, entidad HTML o punto de código Unicode. Haz clic para copiar al instante.' },

    'tools.encodingConverter.title': { en: 'Encoding Converter', es: 'Conversor de Codificación' },
    'tools.encodingConverter.subtitle': { en: 'Convert text between UTF-8, ASCII, Latin-1, URL encoding, HTML entities, Unicode escapes, and more. Includes hex dump view and per-character breakdown — 100% client-side.', es: 'Convierte texto entre UTF-8, ASCII, Latin-1, codificación URL, entidades HTML, escapes Unicode y más. Incluye vista de volcado hexadecimal y desglose por carácter — 100% en el cliente.' },

    'tools.gitReference.title': { en: 'Git Command', es: 'Comandos Git' },
    'tools.gitReference.title2': { en: 'Reference', es: 'Referencia' },
    'tools.gitReference.subtitle': { en: 'Searchable reference of 100+ Git commands with descriptions, usage examples, and common flags. Filter by category, copy commands, or switch to cheatsheet mode.', es: 'Referencia consultable de más de 100 comandos Git con descripciones, ejemplos de uso y banderas comunes. Filtra por categoría, copia comandos o cambia al modo chuleta.' },

    'tools.groceryManager.title': { en: 'Grocery', es: 'Gestor de' },
    'tools.groceryManager.title2': { en: 'Manager', es: 'Compras' },
    'tools.groceryManager.subtitle': { en: 'Track the staples you always buy, get restock reminders based on how long ago you bought them, and see a running estimate of your bill. Everything stays in your browser — no sign-up.', es: 'Lleva el control de los productos que siempre compras, recibe recordatorios de reposición según hace cuánto los compraste y consulta una estimación continua de tu cuenta. Todo se queda en tu navegador — sin registro.' },

    'tools.hexEditor.title': { en: 'Hex Viewer', es: 'Visor Hex' },
    'tools.hexEditor.title2': { en: 'Editor', es: 'Editor' },
    'tools.hexEditor.subtitle': { en: 'Upload files or paste text to view hex dumps with offset, hex bytes, and ASCII. Search hex patterns, convert between text and hex.', es: 'Sube archivos o pega texto para ver volcados hexadecimales con desplazamiento, bytes hex y ASCII. Busca patrones hex y convierte entre texto y hexadecimal.' },

    'tools.keyboardShortcuts.title': { en: 'Keyboard Shortcuts', es: 'Atajos de Teclado' },
    'tools.keyboardShortcuts.title2': { en: 'Reference', es: 'Referencia' },
    'tools.keyboardShortcuts.subtitle': { en: 'Searchable reference of 200+ keyboard shortcuts for VS Code, Chrome DevTools, Git, Terminal, macOS & Windows. Auto-detects your OS for Cmd vs Ctrl.', es: 'Referencia consultable de más de 200 atajos de teclado para VS Code, Chrome DevTools, Git, Terminal, macOS & Windows. Detecta tu sistema operativo para elegir entre Cmd y Ctrl.' },

    'tools.mockData.title': { en: 'Mock Data', es: 'Datos de Prueba' },
    'tools.mockData.title2': { en: 'Generator', es: 'Generador' },
    'tools.mockData.subtitle': { en: 'Generate random mock data instantly — names, emails, addresses, UUIDs & more. Export as JSON, CSV, or SQL INSERT. 100% client-side.', es: 'Genera datos de prueba aleatorios al instante — nombres, correos, direcciones, UUIDs y más. Exporta como JSON, CSV o SQL INSERT. 100% en el cliente.' },

    'tools.pomodoro.title': { en: 'Pomodoro', es: 'Temporizador' },
    'tools.pomodoro.title2': { en: 'Timer', es: 'Pomodoro' },
    'tools.pomodoro.subtitle': { en: 'Stay focused with timed work sessions and breaks. 4 pomodoros earns a long break. No sign-up required.', es: 'Mantén la concentración con sesiones de trabajo y descansos cronometrados. Cada 4 pomodoros ganas un descanso largo. Sin registro.' },

    'tools.regexCheatsheet.title': { en: 'Regex Cheatsheet', es: 'Chuleta de Regex' },
    'tools.regexCheatsheet.subtitlePre': { en: 'Categorized regex reference with', es: 'Referencia de regex categorizada con' },
    'tools.regexCheatsheet.subtitlePost': { en: '+ patterns. Search to find what you need.', es: '+ patrones. Busca para encontrar lo que necesitas.' },

    'tools.regexGenerator.title': { en: 'Regex Pattern', es: 'Patrones Regex' },
    'tools.regexGenerator.title2': { en: 'Generator', es: 'Generador' },
    'tools.regexGenerator.subtitle': { en: 'Generate regex patterns from natural language, browse common patterns, and test them against sample text — no sign-up required.', es: 'Genera patrones de regex a partir de lenguaje natural, explora patrones comunes y pruébalos contra texto de ejemplo — sin registro.' },

    'tools.snippetManager.title': { en: 'Code Snippet', es: 'Fragmentos de Código' },
    'tools.snippetManager.title2': { en: 'Manager', es: 'Gestor' },
    'tools.snippetManager.subtitle': { en: 'Save, organize, and search your code snippets locally. Syntax highlighting, tagging, and instant search — all in your browser.', es: 'Guarda, organiza y busca tus fragmentos de código localmente. Resaltado de sintaxis, etiquetado y búsqueda instantánea — todo en tu navegador.' },

    // Batch 8 — remaining CSS / TypeScript / utility tools
    'tools.tailwindLookup.title': { en: 'Tailwind CSS', es: 'Tailwind CSS' },
    'tools.tailwindLookup.title2': { en: 'Class', es: 'Clases' },
    'tools.tailwindLookup.title3': { en: 'Lookup', es: 'Consulta de' },
    'tools.tailwindLookup.subtitlePre': { en: 'Searchable reference of', es: 'Referencia consultable de' },
    'tools.tailwindLookup.subtitlePost': { en: '+ Tailwind CSS utility classes. Search by class name or CSS property, filter by category, click to copy.', es: '+ clases utilitarias de Tailwind CSS. Busca por nombre de clase o propiedad CSS, filtra por categoría y haz clic para copiar.' },

    'tools.timezoneConverter.title': { en: 'Timezone Converter', es: 'Conversor de Zonas Horarias' },
    'tools.timezoneConverter.subtitle': { en: 'Convert times between 30+ timezones with a world clock display.', es: 'Convierte horas entre más de 30 zonas horarias con un reloj mundial.' },

    'tools.transformPlayground.title': { en: 'CSS Transform Playground', es: 'Laboratorio de Transformaciones CSS' },
    'tools.transformPlayground.subtitle': { en: 'Visually edit CSS transforms with translate, rotate, scale, and skew sliders.', es: 'Edita transformaciones CSS visualmente con deslizadores de translate, rotate, scale y skew.' },

    'tools.tsPlayground.title': { en: 'TS Type', es: 'Laboratorio de' },
    'tools.tsPlayground.title2': { en: 'Playground', es: 'Tipos TS' },
    'tools.tsPlayground.subtitle': { en: 'Write TypeScript type definitions and see them explained. Explore utility types, generics, and conditional types interactively.', es: 'Escribe definiciones de tipos de TypeScript y consulta su explicación. Explora tipos utilitarios, genéricos y tipos condicionales de forma interactiva.' },

    // Batch 9 — CSS generators (TranslationService was injected in an earlier
    // pass, but their headers were still hardcoded English)
    'tools.borderRadius.title': { en: 'Border Radius Generator', es: 'Generador de Border Radius' },
    'tools.borderRadius.subtitle': { en: 'Visually design CSS border-radius with individual corner controls, advanced blob shapes, and one-click code export. No sign-up, runs entirely in your browser.', es: 'Diseña visualmente border-radius en CSS con controles por esquina, formas blob avanzadas y exportación de código con un clic. Sin registro, se ejecuta enteramente en tu navegador.' },

    'tools.boxModel.title': { en: 'Box Model Visualizer', es: 'Visualizador del Modelo de Caja' },
    'tools.boxModel.subtitle': { en: 'Interactive CSS box model diagram with live preview. Adjust margin, border, padding, and content dimensions to generate ready-to-use CSS code.', es: 'Diagrama interactivo del modelo de caja CSS con vista previa en vivo. Ajusta margin, border, padding y las dimensiones del contenido para generar código CSS listo para usar.' },

    'tools.boxShadowGenerator.title': { en: 'Box Shadow Generator', es: 'Generador de Box Shadow' },
    'tools.boxShadowGenerator.subtitle': { en: 'Visually design layered CSS box shadows with live preview and one-click code export. No sign-up, runs entirely in your browser.', es: 'Diseña visualmente sombras CSS en capas con vista previa en vivo y exportación de código con un clic. Sin registro, se ejecuta enteramente en tu navegador.' },

    'tools.clipPath.title': { en: 'Clip-Path', es: 'Clip-Path' },
    'tools.clipPath.title2': { en: 'Generator', es: 'Generador' },
    'tools.clipPath.subtitle': { en: 'Visually design CSS clip-path shapes with drag handles, presets, and one-click code copy. 100% client-side.', es: 'Diseña visualmente formas clip-path en CSS con manejadores arrastrables, preajustes y copia de código con un clic. 100% en el cliente.' },

    'tools.cssFilter.title': { en: 'CSS Filter Generator', es: 'Generador de Filtros CSS' },
    'tools.cssFilter.subtitle': { en: 'Visually design CSS filters with live preview, presets, and one-click code export. Blur, brightness, contrast, grayscale, hue-rotate, and more. No sign-up, runs entirely in your browser.', es: 'Diseña visualmente filtros CSS con vista previa en vivo, preajustes y exportación de código con un clic. Blur, brightness, contrast, grayscale, hue-rotate y más. Sin registro, se ejecuta enteramente en tu navegador.' },

    'tools.flexboxGenerator.title': { en: 'Flexbox Generator', es: 'Generador de Flexbox' },
    'tools.flexboxGenerator.subtitle': { en: 'Visual CSS flexbox playground with live preview. Configure container and item properties, apply common layout presets, and export clean CSS code.', es: 'Laboratorio visual de flexbox CSS con vista previa en vivo. Configura las propiedades del contenedor y de los elementos, aplica preajustes de diseño comunes y exporta código CSS limpio.' },

    'tools.gradientGenerator.title': { en: 'CSS Gradient Generator', es: 'Generador de Gradientes CSS' },
    'tools.gradientGenerator.subtitle': { en: 'Create beautiful CSS gradients with a visual editor. Linear, radial and conic gradients with live preview and one-click code export. No sign-up, runs entirely in your browser.', es: 'Crea gradientes CSS atractivos con un editor visual. Gradientes lineales, radiales y cónicos con vista previa en vivo y exportación de código con un clic. Sin registro, se ejecuta enteramente en tu navegador.' },

    'tools.gradientText.title': { en: 'Gradient Text Generator', es: 'Generador de Texto con Gradiente' },
    'tools.gradientText.subtitle': { en: 'Apply stunning CSS gradient effects to text with live preview. Supports linear & radial gradients, color stops, animation, and 10 curated presets.', es: 'Aplica efectos de gradiente CSS al texto con vista previa en vivo. Admite gradientes lineales & radiales, paradas de color, animación y 10 preajustes curados.' },

    'tools.gridGenerator.title': { en: 'CSS Grid Generator', es: 'Generador de CSS Grid' },
    'tools.gridGenerator.subtitle': { en: 'Visual CSS Grid playground with live preview. Configure rows, columns, template tracks, grid areas, and per-item placement. Export clean CSS code instantly.', es: 'Laboratorio visual de CSS Grid con vista previa en vivo. Configura filas, columnas, pistas de plantilla, áreas de rejilla y la colocación de cada elemento. Exporta código CSS limpio al instante.' },

    // Batch 10 — email/security/SVG tools with headers still hardcoded
    'tools.emailDeliverabilityAuditor.title': { en: 'Email Deliverability Auditor', es: 'Auditor de Entregabilidad de Correo' },
    'tools.emailDeliverabilityAuditor.subtitle': { en: 'Audit SPF, DKIM, DMARC & MX records and get instant fix suggestions for email delivery — runs entirely in your browser via DNS-over-HTTPS.', es: 'Audita los registros SPF, DKIM, DMARC & MX y obtén sugerencias de corrección al instante para la entrega de correo — se ejecuta enteramente en tu navegador mediante DNS-over-HTTPS.' },

    'tools.fontPairer.title': { en: 'Font Pairer', es: 'Combinador de Fuentes' },
    'tools.fontPairer.subtitle': { en: 'Discover beautiful font combinations with live preview. Browse curated heading + body pairings, customize sizes, and copy CSS or Google Fonts link tags instantly.', es: 'Descubre combinaciones de fuentes atractivas con vista previa en vivo. Explora parejas curadas de titular + cuerpo, personaliza tamaños y copia al instante el CSS o las etiquetas link de Google Fonts.' },

    'tools.gmailDeliverabilityChecker.title': { en: 'Gmail Deliverability Checker', es: 'Verificador de Entregabilidad en Gmail' },
    'tools.gmailDeliverabilityChecker.subtitle': { en: 'Diagnose email delivery issues and auto-generate SPF, DKIM, DMARC DNS record fixes instantly — no backend required.', es: 'Diagnostica problemas de entrega de correo y genera automáticamente las correcciones de registros DNS SPF, DKIM y DMARC al instante — sin necesidad de backend.' },

    'tools.metaTagGenerator.title': { en: 'Open Graph & Meta Tag Generator', es: 'Generador de Open Graph & Meta Etiquetas' },
    'tools.metaTagGenerator.subtitle': { en: 'Generate perfect Open Graph, Twitter Card, and SEO meta tags with live social sharing previews. No sign-up, runs entirely in your browser.', es: 'Genera meta etiquetas Open Graph, Twitter Card y SEO perfectas con vistas previas en vivo para redes sociales. Sin registro, se ejecuta enteramente en tu navegador.' },

    'tools.progressBar.title': { en: 'Progress Bar', es: 'Barras de Progreso' },
    'tools.progressBar.title2': { en: 'Generator', es: 'Generador' },
    'tools.progressBar.subtitle': { en: 'Design custom CSS progress bars with live preview, animated stripes, gradients, and presets. Copy-paste ready code.', es: 'Diseña barras de progreso CSS personalizadas con vista previa en vivo, franjas animadas, gradientes y preajustes. Código listo para copiar y pegar.' },

    'tools.sslCertificateAuditor.title': { en: 'SSL Certificate Auditor', es: 'Auditor de Certificados SSL' },
    'tools.sslCertificateAuditor.subtitle': { en: 'Audit SSL/TLS certificates, verify CA chain, check expiry, and surface security flags instantly — no backend required.', es: 'Audita certificados SSL/TLS, verifica la cadena de CA, comprueba la expiración y detecta señales de seguridad al instante — sin necesidad de backend.' },

    'tools.sslCertificateInspector.title': { en: 'SSL Certificate Inspector', es: 'Inspector de Certificados SSL' },
    'tools.sslCertificateInspector.subtitle': { en: 'Inspect SSL/TLS certificates, visualize chain of trust, and audit CA reputation instantly.', es: 'Inspecciona certificados SSL/TLS, visualiza la cadena de confianza y audita la reputación de la CA al instante.' },

    'tools.svgPathEditor.title': { en: 'SVG Path Visualizer & Editor', es: 'Visualizador & Editor de Rutas SVG' },
    'tools.svgPathEditor.subtitle': { en: 'Paste, visualize, edit, and optimize SVG paths in your browser. Drag control points, see live measurements, and copy minified output — 100% client-side.', es: 'Pega, visualiza, edita y optimiza rutas SVG en tu navegador. Arrastra los puntos de control, consulta medidas en vivo y copia la salida minificada — 100% en el cliente.' },

    'tools.textShadow.title': { en: 'Text Shadow Generator', es: 'Generador de Text Shadow' },
    'tools.textShadow.subtitle': { en: 'Design stunning CSS text shadows with multiple layers, live preview, 8 creative presets, and one-click code export. No sign-up, runs entirely in your browser.', es: 'Diseña sombras de texto CSS llamativas con múltiples capas, vista previa en vivo, 8 preajustes creativos y exportación de código con un clic. Sin registro, se ejecuta enteramente en tu navegador.' },

    // Tool card titles & descriptions
    'tools.pdf.title': { en: 'PDF Catalog Generator', es: 'Generador de Catálogo PDF' },
    'tools.pdf.desc': { en: 'Upload images, configure layout and captions, and export a polished catalog-style PDF — entirely in your browser. No uploads, no accounts.', es: 'Sube imágenes, configura el diseño y los textos, y exporta un PDF estilo catálogo elegante — todo en tu navegador. Sin subidas, sin cuentas.' },
    'tools.color.title': { en: 'Color Palette Extractor', es: 'Extractor de Paleta de Colores' },
    'tools.color.desc': { en: 'Upload any image and instantly extract its dominant colors. Copy hex, RGB or HSL values, export as CSS variables, Tailwind config, or JSON.', es: 'Sube cualquier imagen y extrae al instante sus colores dominantes. Copia valores hex, RGB o HSL, exporta como variables CSS, config de Tailwind o JSON.' },
    'tools.contrast.title': { en: 'Contrast Checker', es: 'Verificador de Contraste' },
    'tools.contrast.desc': { en: 'Check WCAG AA/AAA contrast ratios between any two colors. Instant pass/fail for text, UI components, and large text thresholds.', es: 'Verifica las relaciones de contraste WCAG AA/AAA entre dos colores. Resultado inmediato para texto, componentes UI y texto grande.' },
    'tools.compressor.title': { en: 'Image Compressor', es: 'Compresor de Imágenes' },
    'tools.compressor.desc': { en: 'Compress JPEG, PNG and WebP images in your browser with live quality preview. Batch compress, no uploads, no accounts — files never leave your device.', es: 'Comprime imágenes JPEG, PNG y WebP en tu navegador con vista previa de calidad en tiempo real. Compresión por lotes, sin subidas, sin cuentas.' },
    'tools.gradient.title': { en: 'Gradient Generator', es: 'Generador de Gradientes' },
    'tools.gradient.desc': { en: 'Build CSS gradients visually — linear, radial and conic. Add stops, adjust angles, copy ready-to-use CSS with one click.', es: 'Crea gradientes CSS visualmente — lineales, radiales y cónicos. Agrega paradas, ajusta ángulos, copia CSS listo para usar con un clic.' },
    'tools.fontpairer.title': { en: 'Font Pairer', es: 'Combinador de Fuentes' },
    'tools.fontpairer.desc': { en: 'Preview and pair Google Fonts side by side. Adjust size, weight and line-height, then copy the import snippet.', es: 'Previsualiza y combina fuentes de Google lado a lado. Ajusta tamaño, peso e interlineado, luego copia el fragmento de importación.' },

    // Color Palette page
    'tools.color.eyebrow': { en: 'Color Tools', es: 'Herramientas de Color' },
    'tools.color.page.title': { en: 'Palette Extractor', es: 'Extractor de Paleta' },
    'tools.color.page.subtitle': { en: 'Upload any image to extract its dominant colors. Click a swatch to copy.', es: 'Sube cualquier imagen para extraer sus colores dominantes. Haz clic en un color para copiarlo.' },
    'tools.color.upload.title': { en: 'Drop an image here', es: 'Suelta una imagen aquí' },
    'tools.color.upload.hint': { en: 'or click to browse — PNG, JPG, WebP, SVG and more', es: 'o haz clic para explorar — PNG, JPG, WebP, SVG y más' },
    'tools.color.extracting': { en: 'Extracting palette…', es: 'Extrayendo paleta…' },
    'tools.color.change': { en: 'Change image', es: 'Cambiar imagen' },
    'tools.color.label.colors': { en: 'Colors', es: 'Colores' },
    'tools.color.label.format': { en: 'Format', es: 'Formato' },
    'tools.color.label.palette': { en: 'Palette', es: 'Paleta' },
    'tools.color.label.export': { en: 'Export', es: 'Exportar' },
    'tools.color.export.css': { en: 'CSS Variables', es: 'Variables CSS' },
    'tools.color.export.tailwind': { en: 'Tailwind', es: 'Tailwind' },
    'tools.color.export.json': { en: 'JSON', es: 'JSON' },
    'tools.color.copied': { en: '✓ Copied', es: '✓ Copiado' },

    // Contrast Checker page
    'tools.contrast.eyebrow': { en: 'Accessibility', es: 'Accesibilidad' },
    'tools.contrast.page.title': { en: 'Contrast Checker', es: 'Verificador de Contraste' },
    'tools.contrast.page.subtitle': { en: 'Test foreground/background color pairs against WCAG AA and AAA accessibility standards.', es: 'Comprueba pares de colores primer plano/fondo según los estándares de accesibilidad WCAG AA y AAA.' },
    'tools.contrast.fg': { en: 'Foreground', es: 'Primer Plano' },
    'tools.contrast.bg': { en: 'Background', es: 'Fondo' },
    'tools.contrast.swap': { en: 'Swap', es: 'Intercambiar' },
    'tools.contrast.ratio': { en: 'Contrast Ratio', es: 'Relación de Contraste' },
    'tools.contrast.copy': { en: 'Copy', es: 'Copiar' },
    'tools.contrast.copied': { en: 'Copied', es: 'Copiado' },
    'tools.contrast.presets': { en: 'Presets', es: 'Preajustes' },
    'tools.contrast.normal': { en: 'Normal text', es: 'Texto normal' },
    'tools.contrast.large': { en: 'Large text', es: 'Texto grande' },
    'tools.contrast.ui': { en: 'UI components', es: 'Componentes UI' },
    'tools.contrast.preview.heading': { en: 'The quick brown fox', es: 'El veloz zorro marrón' },
    'tools.contrast.preview.body': { en: 'Jumps over the lazy dog. This sentence demonstrates how your color combination looks with body text at regular size.', es: 'Salta sobre el perro perezoso. Esta oración demuestra cómo se ve tu combinación de colores con texto a tamaño normal.' },
    'tools.contrast.preview.large': { en: 'Large text (18pt+)', es: 'Texto grande (18pt+)' },
    'tools.contrast.preview.btn': { en: 'Button', es: 'Botón' },
    'tools.contrast.preview.badge': { en: 'Badge', es: 'Etiqueta' },
    'tools.contrast.preview.input': { en: 'Input field', es: 'Campo de texto' },
    'tools.contrast.preset.white.dark': { en: 'White / Dark', es: 'Blanco / Oscuro' },
    'tools.contrast.preset.cyan.dark': { en: 'Cyan / Dark', es: 'Cian / Oscuro' },
    'tools.contrast.preset.black.white': { en: 'Black / White', es: 'Negro / Blanco' },
    'tools.contrast.preset.navy.white': { en: 'Navy / White', es: 'Azul / Blanco' },
    'tools.contrast.preset.danger': { en: 'Danger', es: 'Peligro' },
    'tools.contrast.preset.warning': { en: 'Warning', es: 'Advertencia' },
    'tools.contrast.invalidHex': { en: 'Invalid hex color', es: 'Color hex inválido' },

    // Image Compressor page
    'tools.compressor.eyebrow': { en: 'Image Tools', es: 'Herramientas de Imagen' },
    'tools.compressor.page.title': { en: 'Image Compressor', es: 'Compresor de Imágenes' },
    'tools.compressor.page.subtitle': { en: 'Compress JPEG, PNG and WebP images in your browser. No uploads, no sign-up — files never leave your device.', es: 'Comprime imágenes JPEG, PNG y WebP en tu navegador. Sin subidas, sin registro — los archivos nunca salen de tu dispositivo.' },
    'tools.compressor.upload.title': { en: 'Drop images here to compress', es: 'Suelta imágenes aquí para comprimir' },
    'tools.compressor.upload.hint': { en: 'JPEG · PNG · WebP · GIF · up to', es: 'JPEG · PNG · WebP · GIF · hasta' },
    'tools.compressor.upload.files': { en: 'files', es: 'archivos' },
    'tools.compressor.quality': { en: 'Quality', es: 'Calidad' },
    'tools.compressor.output': { en: 'Output', es: 'Salida' },
    'tools.compressor.format.same': { en: 'Same', es: 'Igual' },
    'tools.compressor.recompress': { en: 'Re-compress All', es: 'Re-comprimir Todo' },
    'tools.compressor.add.more': { en: 'Add More', es: 'Agregar Más' },
    'tools.compressor.original': { en: 'Original', es: 'Original' },
    'tools.compressor.compressed': { en: 'Compressed', es: 'Comprimido' },
    'tools.compressor.compressing': { en: 'Compressing…', es: 'Comprimiendo…' },
    'tools.compressor.download': { en: 'Download', es: 'Descargar' },
    'tools.compressor.remove': { en: 'Remove', es: 'Eliminar' },
    'tools.compressor.summary.compressed': { en: 'compressed', es: 'comprimido(s)' },
    'tools.compressor.summary.avg': { en: 'avg savings', es: 'ahorro promedio' },
    'tools.compressor.webp.tooltip': { en: 'WebP not supported in this browser', es: 'WebP no es compatible con este navegador' },

    // PDF Generator page
    'tools.pdf.eyebrow': { en: 'PDF Generator', es: 'Generador PDF' },
    'tools.pdf.page.title': { en: 'Product Catalog Builder', es: 'Constructor de Catálogo de Productos' },
    'tools.pdf.page.subtitle': { en: 'Upload images, build product cards with custom fields, choose a template and download a professional PDF catalog.', es: 'Sube imágenes, construye tarjetas de producto con campos personalizados, elige una plantilla y descarga un catálogo PDF profesional.' },
    'tools.pdf.mobile.warning': { en: 'This tool works best on a desktop browser. Some features may be limited on mobile.', es: 'Esta herramienta funciona mejor en un navegador de escritorio. Algunas funciones pueden ser limitadas en móvil.' },
    'tools.pdf.signin.hint': { en: 'Sign in to save catalogs across sessions', es: 'Inicia sesión para guardar catálogos entre sesiones' },
    'tools.pdf.signin.google': { en: 'Continue with Google', es: 'Continuar con Google' },
    'tools.pdf.cloud.saving': { en: 'Saving…', es: 'Guardando…' },
    'tools.pdf.cloud.saved': { en: 'Saved', es: 'Guardado' },
    'tools.pdf.cloud.save': { en: 'Save to Cloud', es: 'Guardar en la Nube' },
    'tools.pdf.cloud.catalogs': { en: 'My Catalogs', es: 'Mis Catálogos' },
    'tools.pdf.catalogs.loading': { en: 'Loading…', es: 'Cargando…' },
    'tools.pdf.catalogs.empty': { en: 'No saved catalogs yet. Click "Save to Cloud" to get started.', es: 'Sin catálogos guardados. Haz clic en "Guardar en la Nube" para comenzar.' },
    'tools.pdf.catalogs.load': { en: 'Load', es: 'Cargar' },
    'tools.pdf.draft.restored': { en: 'Draft restored from your last session.', es: 'Borrador restaurado de tu última sesión.' },
    'tools.pdf.draft.images.lost': { en: ' Images could not be saved — please re-upload.', es: ' Las imágenes no pudieron guardarse — vuelve a subirlas.' },
    'tools.pdf.upload.folder': { en: 'Upload folder', es: 'Subir carpeta' },
    'tools.pdf.upload.folder.hint': { en: 'Each subfolder → section', es: 'Cada subcarpeta → sección' },
    'tools.pdf.upload.images': { en: 'Add images', es: 'Agregar imágenes' },
    'tools.pdf.upload.images.hint': { en: 'Added to "General"', es: 'Agregado a "General"' },
    'tools.pdf.empty': { en: 'Upload a folder or images to get started', es: 'Sube una carpeta o imágenes para comenzar' },
    'tools.pdf.tab.products': { en: 'Products', es: 'Productos' },
    'tools.pdf.tab.fields': { en: 'Fields', es: 'Campos' },
    'tools.pdf.undo': { en: '↩ Undo', es: '↩ Deshacer' },
    'tools.pdf.redo': { en: '↪ Redo', es: '↪ Rehacer' },
    'tools.pdf.collapse': { en: '↕ Collapse', es: '↕ Contraer' },
    'tools.pdf.expand': { en: '↕ Expand', es: '↕ Expandir' },
    'tools.pdf.add.section': { en: '+ Section', es: '+ Sección' },
    'tools.pdf.clear.all': { en: 'Clear all', es: 'Limpiar todo' },
    'tools.pdf.add.product': { en: 'Add product', es: 'Agregar producto' },
    'tools.pdf.fields.hint': { en: 'Choose which fields appear on each product card in the PDF. Reorder to control display priority.', es: 'Elige qué campos aparecen en cada tarjeta de producto en el PDF. Reordena para controlar la prioridad de visualización.' },
    'tools.pdf.config.title': { en: 'Configuration', es: 'Configuración' },
    'tools.pdf.template': { en: 'Template', es: 'Plantilla' },
    'tools.pdf.template.minimal': { en: 'Minimal', es: 'Minimalista' },
    'tools.pdf.template.detailed': { en: 'Detailed', es: 'Detallado' },
    'tools.pdf.template.editorial': { en: 'Editorial', es: 'Editorial' },
    'tools.pdf.columns': { en: 'Columns', es: 'Columnas' },
    'tools.pdf.name.overlay': { en: 'Show name overlay', es: 'Mostrar nombre superpuesto' },
    'tools.pdf.price.overlay': { en: 'Show price overlay', es: 'Mostrar precio superpuesto' },
    'tools.pdf.brand': { en: 'Brand / Studio name', es: 'Marca / Nombre del estudio' },
    'tools.pdf.doc.title': { en: 'Document title', es: 'Título del documento' },
    'tools.pdf.subtitle.label': { en: 'Subtitle', es: 'Subtítulo' },
    'tools.pdf.accent': { en: 'Accent color', es: 'Color de acento' },
    'tools.pdf.currency': { en: 'Currency', es: 'Moneda' },
    'tools.pdf.pagesize': { en: 'Page size', es: 'Tamaño de página' },
    'tools.pdf.cover': { en: 'Cover page', es: 'Página de portada' },
    'tools.pdf.dividers': { en: 'Section divider pages', es: 'Páginas divisoras de sección' },
    'tools.pdf.pagenumbers': { en: 'Page numbers', es: 'Números de página' },
    'tools.pdf.catalog.file': { en: 'Catalog file', es: 'Archivo de catálogo' },
    'tools.pdf.import': { en: 'Import', es: 'Importar' },
    'tools.pdf.export.catalog': { en: 'Export', es: 'Exportar' },
    'tools.pdf.preview': { en: 'Preview PDF', es: 'Previsualizar PDF' },
    'tools.pdf.download': { en: 'Download PDF', es: 'Descargar PDF' },
    'tools.pdf.building': { en: 'Building PDF…', es: 'Construyendo PDF…' },
    'tools.pdf.add.products.hint': { en: 'Add products to enable export.', es: 'Agrega productos para habilitar la exportación.' },
    'tools.pdf.privacy': { en: 'Files stay in your browser. Nothing is uploaded or stored.', es: 'Los archivos permanecen en tu navegador. Nada se sube ni se almacena.' },
    'tools.pdf.preview.title': { en: 'PDF Preview', es: 'Vista Previa del PDF' },
    'tools.pdf.preview.close': { en: 'Close', es: 'Cerrar' },
    'tools.pdf.remove.product': { en: 'Remove product', es: 'Eliminar producto' },
    'tools.pdf.duplicate': { en: 'Duplicate', es: 'Duplicar' },
    'tools.pdf.move.to': { en: 'Move to…', es: 'Mover a…' },
    'tools.pdf.done': { en: 'Done', es: 'Listo' },
    'tools.pdf.reset': { en: 'Reset', es: 'Restablecer' },

    // SVG to Code Converter
    'tools.svgToCode.title': { en: 'SVG to Code Converter', es: 'Convertidor de SVG a Código' },
    'tools.svgToCode.desc': { en: 'Convert SVGs to optimized React, Vue, or Angular components with props and a11y.', es: 'Convierte SVGs en componentes optimizados de React, Vue o Angular con props y accesibilidad.' },
    'tools.svgToCode.eyebrow': { en: 'Code Converters', es: 'Convertidores de Código' },
    'tools.svgToCode.page.title': { en: 'SVG to Code Converter', es: 'Convertidor de SVG a Código' },
    'tools.svgToCode.page.subtitle': { en: 'Convert SVG files into production-ready React, Vue 3, or Angular components with configurable props, accessibility attributes, and SVG optimization.', es: 'Convierte archivos SVG en componentes listos para producción de React, Vue 3 o Angular con props configurables, atributos de accesibilidad y optimización de SVG.' },

    // Cookie Banner / GDPR Consent
    'cookies.banner.title': { en: 'Cookie preferences', es: 'Preferencias de cookies' },
    'cookies.banner.description': { en: 'Tiny analytics breadcrumbs help us see which stars get visited most.', es: 'Pequenas migas de analytics nos ayudan a ver que estrellas se visitan mas.' },
    'cookies.banner.details': { en: 'No personal data is sold or shared — we just count footsteps in the cosmos.', es: 'No se vende ni se comparte ningun dato personal — solo contamos pisadas en el cosmos.' },
    'cookies.accept': { en: 'Accept Analytics', es: 'Aceptar Analytics' },
    'cookies.deny': { en: 'Essential Only', es: 'Solo Esenciales' },
    'cookies.banner.aria': { en: 'Cookie consent banner', es: 'Banner de consentimiento de cookies' },
    'cookies.accept.aria': { en: 'Accept analytics cookies', es: 'Aceptar cookies de analytics' },
    'cookies.deny.aria': { en: 'Use essential cookies only', es: 'Usar solo cookies esenciales' },

    // ─── Cosmic eyebrows + taglines ────────────────────────────────────────
    'cosmic.eyebrow.latestTools':         { en: 'Latest Tools',           es: 'Ultimas herramientas' },
    'cosmic.eyebrow.whatsNew':            { en: "What's New",             es: 'Novedades' },
    'cosmic.eyebrow.openChannel':         { en: 'Open Channel',           es: 'Canal abierto' },
    'cosmic.eyebrow.builtShipped':        { en: 'Built & Shipped',        es: 'Construido y enviado' },
    'cosmic.eyebrow.skillConstellation':  { en: 'Skill Constellation',    es: 'Constelacion de habilidades' },
    'cosmic.eyebrow.visitorConstellation':{ en: 'Visitor Constellation',  es: 'Constelacion de visitantes' },
    'cosmic.eyebrow.fuelMission':         { en: 'Fuel the Mission',       es: 'Alimenta la mision' },

    'cosmic.tagline.latestTools':         { en: 'new stars born this week in the xsantcastx universe',                  es: 'nuevas estrellas nacidas esta semana en el universo xsantcastx' },
    'cosmic.tagline.whatsNew':            { en: 'tracking every star added to the universe',                            es: 'siguiendo cada estrella anadida al universo' },
    'cosmic.tagline.openChannel':         { en: "a signal flare into the universe — drop one and I'll catch it",        es: 'una bengala al universo — lanza una y la atrapo' },
    'cosmic.tagline.builtShipped':        { en: 'galaxies of work — each one a real product orbiting a real audience',  es: 'galaxias de trabajo — cada una un producto real orbitando una audiencia real' },
    'cosmic.tagline.skillConstellation':  { en: 'a constellation of crafts I orbit through every project',              es: 'una constelacion de oficios que orbito en cada proyecto' },
    'cosmic.tagline.visitorConstellation':{ en: 'every name here is a star that passed through',                        es: 'cada nombre aqui es una estrella que paso por este lugar' },
    'cosmic.tagline.fuelMission':         { en: 'every coin keeps another star alive in the universe',                  es: 'cada moneda mantiene viva otra estrella en el universo' },
    'cosmic.tagline.chooseGalaxy':        { en: 'Choose a galaxy — each is a constellation of free tools',              es: 'Elige una galaxia — cada una es una constelacion de herramientas gratis' },

    // ─── Guestbook cosmic copy ─────────────────────────────────────────────
    'cosmic.guestbook.title':       { en: 'Sign the cosmic wall',          es: 'Firma el muro cosmico' },
    'cosmic.guestbook.loading':     { en: 'Tuning the signal...',          es: 'Sintonizando la senal...' },
    'cosmic.guestbook.loadingMore': { en: 'Pulling more echoes...',        es: 'Tirando mas ecos...' },
    'cosmic.guestbook.loadMore':    { en: '✦ Reveal older messages',       es: '✦ Revelar mensajes antiguos' },
    'cosmic.guestbook.nickname':    { en: 'Your call sign',                es: 'Tu nombre clave' },
    'cosmic.guestbook.message':     { en: 'Drop a message into the void...', es: 'Lanza un mensaje al vacio...' },
    'cosmic.guestbook.submit':      { en: 'Send into the void →',          es: 'Enviar al vacio →' },

    // ─── Cosmic anchor planet ──────────────────────────────────────────────
    'cosmic.anchor.whisper':        { en: 'look closer — those lights down there aren\'t ours.', es: 'mira mas de cerca — esas luces de ahi abajo no son nuestras.' },

    // ─── The Godforge — homepage ───────────────────────────────────────────
    // The Eclipse Realms layer over the home page. Lore vocabulary, but every
    // number under it is real: artifacts are registry tools, paths are the
    // prerendered routes, fragments are registered easter eggs.
    'godforge.hero.eyebrow':   { en: 'The Engine of Creation',                     es: 'El motor de la creacion' },
    'godforge.hero.sub':       { en: 'Free Developer Tools Forged in the Eclipse', es: 'Herramientas gratis para desarrolladores forjadas en el Eclipse' },
    'godforge.hero.welcome':   { en: 'Welcome,',                                   es: 'Bienvenido,' },
    'godforge.hero.toNext':    { en: 'XP to',                                      es: 'XP para' },
    'godforge.hero.maxRank':   { en: 'the Eclipse is yours',                       es: 'el Eclipse es tuyo' },
    'godforge.hero.cta':       { en: 'Enter the Forge',                            es: 'Entra en la forja' },
    'godforge.hero.ctaLive':   { en: 'Watch Live Work',                            es: 'Ver el trabajo en vivo' },
    'godforge.hero.orExplore': { en: 'or explore',                                 es: 'o explora' },
    'godforge.hero.theCodex':  { en: 'The Codex',                                  es: 'el Codice' },

    'godforge.pulse.artifacts': { en: 'Artifacts Forged',   es: 'Artefactos forjados' },
    'godforge.pulse.paths':     { en: 'Paths Prerendered',  es: 'Caminos prerenderizados' },
    'godforge.pulse.fragments': { en: 'Fragments Hidden',   es: 'Fragmentos ocultos' },
    'godforge.pulse.realms':    { en: 'Realms to Explore',  es: 'Reinos por explorar' },

    'godforge.forges.eyebrow':   { en: 'The Forges',      es: 'Las forjas' },
    'godforge.forges.title':     { en: 'The Five Realms', es: 'Los cinco reinos' },
    'godforge.forges.tagline':   { en: 'five fires, five domains — open one and see what hangs on its walls', es: 'cinco fuegos, cinco dominios — abre uno y mira que cuelga de sus paredes' },
    'godforge.forges.browseAll': { en: 'Browse all',      es: 'Explorar las' },
    'godforge.forges.seeAll':    { en: 'Walk the full catalogue —', es: 'Recorre el catalogo completo —' },
    'godforge.forges.artifacts': { en: 'artifacts',       es: 'artefactos' },
    'godforge.forges.strike':    { en: 'Strike it',       es: 'Forjala' },
    'godforge.forges.struck':    { en: 'Struck',          es: 'Forjada' },
    'godforge.forges.more':      { en: 'more in',         es: 'mas en' },

    'godforge.chronicle.eyebrow': { en: 'The Chronicle',           es: 'La cronica' },
    'godforge.chronicle.title':   { en: 'Recent Forging Activity', es: 'Actividad reciente de forja' },
    'godforge.chronicle.tagline': { en: 'every strike on the anvil, written down as it lands', es: 'cada golpe en el yunque, anotado en cuanto cae' },

    'godforge.journey.eyebrow':       { en: 'Begin Your Journey',       es: 'Comienza tu viaje' },
    'godforge.journey.title':         { en: 'Every tool leaves a mark', es: 'Cada herramienta deja una marca' },
    'godforge.journey.creed':         { en: 'Every tool you use earns you power. Every secret you find brings you closer to the truth.', es: 'Cada herramienta que usas te da poder. Cada secreto que encuentras te acerca a la verdad.' },
    'godforge.journey.startWith':     { en: 'Start with',              es: 'Empieza con' },
    'godforge.journey.blueprintLabel':{ en: 'Read',                    es: 'Lee' },
    'godforge.journey.blueprint':     { en: 'The War Table',           es: 'La mesa de guerra' },
    'godforge.journey.blueprintHint': { en: 'the roadmap, the architecture, and what ships next', es: 'la hoja de ruta, la arquitectura y lo que viene despues' },
    'godforge.journey.arenaLabel':    { en: 'Prove yourself in',       es: 'Demuestra tu valia en' },
    'godforge.journey.arena':         { en: 'The Arena',               es: 'La arena' },
    'godforge.journey.arenaHint':     { en: 'fragments buried across the realms', es: 'fragmentos enterrados por los reinos' },

    // ─── Payment fallback copy ─────────────────────────────────────────────
    'footer.stripe.notReady':       { en: '✦ The card portal is still tuning in. Try Crypto or PayPal — or refresh in a few seconds to retry.', es: '✦ El portal de tarjetas aun se esta sintonizando. Prueba Crypto o PayPal — o recarga en unos segundos.' },

    // ─── Trust microcopy ───────────────────────────────────────────────────
    'contact.form.trust':           { en: '🛡 Sent only to xsantcastx — we reply within 24 hours.',     es: '🛡 Enviado solo a xsantcastx — respondemos en menos de 24 horas.' },
    'newsletter.trust':             { en: 'No spam. No account needed. Unsubscribe anytime.',          es: 'Sin spam. Sin cuenta. Date de baja cuando quieras.' },

    // ─── JSON Formatter page (i18n batch 2026-04-26) ──────────────────────────
    'tools.jsonFormatter.eyebrow': { en: 'Code Converters', es: 'Convertidores de Código' },
    'tools.jsonFormatter.title': { en: 'JSON Formatter', es: 'Formateador JSON' },
    'tools.jsonFormatter.titleAccent': { en: 'Validator', es: 'Validador' },
    'tools.jsonFormatter.subtitle': {
      en: 'Format, validate, minify and repair JSON instantly — live syntax checking, no sign-up required.',
      es: 'Formatea, valida, minifica y repara JSON al instante — verificación de sintaxis en vivo, sin necesidad de registrarse.'
    },
    'tools.jsonFormatter.loadSample': { en: 'Load sample JSON', es: 'Cargar JSON de ejemplo' },
    'tools.jsonFormatter.clearInput': { en: 'Clear input', es: 'Borrar entrada' },
    'tools.jsonFormatter.format': { en: 'Format / Prettify', es: 'Formatear / Embellecer' },
    'tools.jsonFormatter.minify': { en: 'Minify', es: 'Minificar' },
    'tools.jsonFormatter.copied': { en: 'Copied!', es: '¡Copiado!' },
    'tools.jsonFormatter.saved': { en: 'Saved!', es: '¡Guardado!' },
    'tools.jsonFormatter.outputEmpty': { en: 'Formatted output will appear here', es: 'La salida formateada aparecerá aquí' },

    // ─── Hash Generator page (i18n batch 2026-04-26) ──────────────────────────
    'tools.hashGenerator.eyebrow': { en: 'Security Tools', es: 'Herramientas de Seguridad' },
    'tools.hashGenerator.title': { en: 'Hash', es: 'Hash' },
    'tools.hashGenerator.titleAccent': { en: 'Generator', es: 'Generador' },
    'tools.hashGenerator.subtitle': {
      en: 'Generate MD5, SHA-1, SHA-256, SHA-384 and SHA-512 hashes from text or files. Compare hashes, copy results — all client-side, no data leaves your browser.',
      es: 'Genera hashes MD5, SHA-1, SHA-256, SHA-384 y SHA-512 desde texto o archivos. Compara hashes, copia resultados — todo del lado cliente, ningún dato sale de tu navegador.'
    },

    // Tool input placeholders — batch
    'tools.pdfGenerator.ph.sectionName': { en: 'Section name', es: 'Nombre de la sección' },
    'tools.pdfGenerator.ph.sectionSubtitle': { en: 'Section subtitle (optional)', es: 'Subtítulo de la sección (opcional)' },
    'tools.pdfGenerator.ph.productName': { en: 'Product name', es: 'Nombre del producto' },
    'tools.pdfGenerator.ph.sku': { en: 'e.g. CHR-001', es: 'ej. CHR-001' },
    'tools.pdfGenerator.ph.category': { en: 'e.g. Rings', es: 'ej. Anillos' },
    'tools.pdfGenerator.ph.dimensions': { en: 'e.g. 12 × 8 cm', es: 'ej. 12 × 8 cm' },
    'tools.pdfGenerator.ph.material': { en: 'e.g. 18k Gold', es: 'ej. Oro 18k' },
    'tools.pdfGenerator.ph.finish': { en: 'e.g. Rose Gold', es: 'ej. Oro Rosa' },
    'tools.pdfGenerator.ph.longDescription': { en: 'Extended product description…', es: 'Descripción extendida del producto…' },
    'tools.pdfGenerator.ph.notes': { en: 'Internal or customer notes…', es: 'Notas internas o del cliente…' },
    'tools.pdfGenerator.ph.brand': { en: 'e.g. Pandora', es: 'ej. Pandora' },
    'tools.pdfGenerator.ph.collection': { en: 'e.g. Spring Collection 2025', es: 'ej. Colección Primavera 2025' },
    'tools.metaTagGenerator.ph.title': { en: 'My Awesome Page - Brand Name', es: 'Mi Página Increíble - Nombre de Marca' },
    'tools.metaTagGenerator.ph.description': { en: 'A brief description of your page content for search engines...', es: 'Una breve descripción del contenido de tu página para los motores de búsqueda...' },
    'tools.metaTagGenerator.ph.ogTitle': { en: 'Override title for social sharing', es: 'Sobrescribir el título para redes sociales' },
    'tools.metaTagGenerator.ph.ogDescription': { en: 'Override description for social sharing', es: 'Sobrescribir la descripción para redes sociales' },
    'tools.metaTagGenerator.ph.pageUrl': { en: 'Page URL', es: 'URL de la página' },
    'tools.metaTagGenerator.ph.siteName': { en: 'Your Brand', es: 'Tu Marca' },
    'tools.metaTagGenerator.ph.twitterTitle': { en: 'Override title for Twitter', es: 'Sobrescribir el título para Twitter' },
    'tools.metaTagGenerator.ph.twitterDescription': { en: 'Override description for Twitter', es: 'Sobrescribir la descripción para Twitter' },
    'tools.metaTagGenerator.ph.twitterImage': { en: 'Override image for Twitter', es: 'Sobrescribir la imagen para Twitter' },
    'tools.qrGenerator.ph.emailSubject': { en: 'Email subject', es: 'Asunto del correo' },
    'tools.qrGenerator.ph.emailBody': { en: 'Email body text...', es: 'Cuerpo del correo...' },
    'tools.qrGenerator.ph.wifiSsid': { en: 'My WiFi Network', es: 'Mi Red WiFi' },
    'tools.qrGenerator.ph.wifiPassword': { en: 'Network password', es: 'Contraseña de la red' },
    'tools.qrGenerator.ph.organization': { en: 'Acme Inc.', es: 'Acme S.A.' },
    'tools.snippetManager.ph.search': { en: 'Search by title, tag, or language...', es: 'Busca por título, etiqueta o lenguaje...' },
    'tools.snippetManager.ph.title': { en: 'e.g. Debounce utility function', es: 'ej. Función utilitaria debounce' },
    'tools.snippetManager.ph.tags': { en: 'e.g. utility, async, react', es: 'ej. utilidad, async, react' },
    'tools.snippetManager.ph.code': { en: 'Paste or type your code here...', es: 'Pega o escribe tu código aquí...' },
    'tools.jwtGenerator.ph.subject': { en: 'e.g. user_123456', es: 'ej. user_123456' },
    'tools.jwtGenerator.ph.secret': { en: 'Enter your HMAC secret key', es: 'Introduce tu clave secreta HMAC' },
    'tools.dataSize.ph.eg1024': { en: 'e.g. 1024', es: 'ej. 1024' },
    'tools.dataSize.ph.eg700': { en: 'e.g. 700', es: 'ej. 700' },
    'tools.dataSize.ph.eg100': { en: 'e.g. 100', es: 'ej. 100' },
    'tools.dataSize.ph.eg256': { en: 'e.g. 256', es: 'ej. 256' },
    'tools.aspectRatio.ph.width': { en: 'e.g. 1920', es: 'ej. 1920' },
    'tools.aspectRatio.ph.height': { en: 'e.g. 1080', es: 'ej. 1080' },
    'tools.seoChecker.ph.title': { en: 'Enter your page title...', es: 'Introduce el título de tu página...' },
    'tools.seoChecker.ph.description': { en: 'Enter your meta description...', es: 'Introduce tu meta descripción...' },
    'tools.seoChecker.ph.keyword': { en: 'e.g. seo checker', es: 'ej. verificador seo' },
    'tools.regexGenerator.ph.describe': { en: 'Describe what you want to match... e.g. \'email address\', \'phone number\', \'url\'', es: 'Describe lo que quieres encontrar... ej. \'dirección de correo\', \'número de teléfono\', \'url\'' },
    'tools.regexGenerator.ph.pattern': { en: 'Enter regex pattern...', es: 'Introduce el patrón regex...' },
    'tools.regexGenerator.ph.testText': { en: 'Paste or type text to test your regex against...', es: 'Pega o escribe el texto contra el que probar tu regex...' },
    'tools.ogImagePreview.ph.title': { en: 'My Awesome Page', es: 'Mi Página Increíble' },
    'tools.ogImagePreview.ph.description': { en: 'A brief description of your page...', es: 'Una breve descripción de tu página...' },
    'tools.ogImagePreview.ph.siteName': { en: 'My Website', es: 'Mi Sitio Web' },
    'tools.hexEditor.ph.textInput': { en: 'Type or paste text to convert to hex...', es: 'Escribe o pega el texto a convertir a hex...' },
    'tools.hexEditor.ph.hexInput': { en: 'Paste hex bytes to decode to text...\n\ne.g. 48 65 6C 6C 6F', es: 'Pega bytes hex para decodificar a texto...\n\nej. 48 65 6C 6C 6F' },
    'tools.hexEditor.ph.signature': { en: 'e.g. 4D 5A or FF D8 FF', es: 'ej. 4D 5A o FF D8 FF' },

    // Tool input placeholders — batch
    'tools.hashGenerator.ph.text': { en: 'Paste or type text to hash\n\ne.g. Hello, World!', es: 'Pega o escribe el texto a hashear\n\nej. Hola, Mundo!' },
    'tools.hashGenerator.ph.firstHash': { en: 'Paste first hash here...', es: 'Pega el primer hash aquí...' },
    'tools.hashGenerator.ph.secondHash': { en: 'Paste second hash here...', es: 'Pega el segundo hash aquí...' },
    'tools.groceryManager.ph.search': { en: 'Search items…', es: 'Buscar artículos…' },
    'tools.tsPlayground.ph.searchTypes': { en: 'Search types... (try \'any\')', es: 'Busca tipos... (prueba \'any\')' },
    'tools.tsPlayground.ph.definitions': { en: 'Write TypeScript type definitions here...', es: 'Escribe definiciones de tipos TypeScript aquí...' },
    'tools.timestampConverter.ph.unix': { en: 'Enter Unix timestamp, e.g. 1700000000', es: 'Introduce una marca de tiempo Unix, ej. 1700000000' },
    'tools.timestampConverter.ph.date': { en: 'Enter date, e.g. 2024-01-15 14:30:00', es: 'Introduce una fecha, ej. 2024-01-15 14:30:00' },
    'tools.stringRepeater.ph.text': { en: 'Type or paste text to repeat...\n\ne.g. Hello, World!', es: 'Escribe o pega el texto a repetir...\n\nej. Hola, Mundo!' },
    'tools.stringRepeater.ph.separator': { en: 'Enter custom separator...', es: 'Introduce un separador personalizado...' },
    'tools.regexTester.ph.pattern': { en: 'Enter regex pattern…', es: 'Introduce el patrón regex…' },
    'tools.licensePicker.ph.search': { en: 'Search licenses...', es: 'Buscar licencias...' },
    'tools.licensePicker.ph.author': { en: 'Author name', es: 'Nombre del autor' },
    'tools.ipLookup.ph.address': { en: 'e.g. 192.168.1.1 or 2001:db8::1', es: 'ej. 192.168.1.1 o 2001:db8::1' },
    'tools.ipLookup.ph.network': { en: 'e.g. 192.168.1.0', es: 'ej. 192.168.1.0' },
    'tools.hmacGenerator.ph.secret': { en: 'Enter your secret key...', es: 'Introduce tu clave secreta...' },
    'tools.hmacGenerator.ph.message': { en: 'Enter message to sign with HMAC\n\ne.g. Hello, World!', es: 'Introduce el mensaje a firmar con HMAC\n\nej. Hola, Mundo!' },
    'tools.diffChecker.ph.original': { en: 'Paste or type original text here...', es: 'Pega o escribe el texto original aquí...' },
    'tools.diffChecker.ph.modified': { en: 'Paste or type modified text here...', es: 'Pega o escribe el texto modificado aquí...' },
    'tools.cssVariables.ph.name': { en: 'Variable name (e.g., primary-color)', es: 'Nombre de la variable (ej., primary-color)' },
    'tools.cssVariables.ph.value': { en: 'Value (e.g., #8B5CF6 or 1rem)', es: 'Valor (ej., #8B5CF6 o 1rem)' },
    'tools.colorBlindness.ph.sampleText': { en: 'Enter sample text...', es: 'Introduce un texto de ejemplo...' },

    // Tool input placeholders — batch
    'tools.page.ph.search': { en: 'Search tools...', es: 'Buscar herramientas...' },
    'tools.htmlMinifier.ph.input': { en: 'Paste HTML here...', es: 'Pega HTML aquí...' },
    'tools.regexCheatsheet.ph.search': { en: 'Search patterns, descriptions, examples...', es: 'Busca patrones, descripciones, ejemplos...' },
    'tools.base64Encoder.ph.decode': { en: 'Paste Base64 string to decode…', es: 'Pega la cadena Base64 a decodificar…' },
    'tools.uaParser.ph.input': { en: 'Paste a user agent string or your current UA is auto-detected...', es: 'Pega una cadena de user agent o se detectará automáticamente la tuya...' },
    'tools.screenInfo.ph.diagonal': { en: 'e.g. 15.6', es: 'ej. 15.6' },
    'tools.jsonTree.ph.search': { en: 'Search keys or values...', es: 'Busca claves o valores...' },
    'tools.uuidGenerator.ph.validate': { en: 'Paste a UUID or ULID to validate...', es: 'Pega un UUID o ULID para validar...' },
    'tools.mimeLookup.ph.search': { en: 'Search by extension (.png) or MIME type (image/png)...', es: 'Busca por extensión (.png) o tipo MIME (image/png)...' },
    'tools.caseConverter.ph.input': { en: 'Paste or type text to convert\n\ne.g. the quick brown fox jumps over the lazy dog', es: 'Pega o escribe el texto a convertir\n\nej. el veloz murciélago hindú comía feliz cardillo y kiwi' },
    'tools.markdownEditor.ph.input': { en: 'Write your markdown here...\n\n# Heading\n**Bold**, _italic_, ~~strikethrough~~\n- List item\n> Blockquote', es: 'Escribe tu markdown aquí...\n\n# Encabezado\n**Negrita**, _cursiva_, ~~tachado~~\n- Elemento de lista\n> Cita' },
    'tools.httpStatus.ph.search': { en: 'Search by code (e.g. 404) or name (e.g. Not Found)...', es: 'Busca por código (ej. 404) o nombre (ej. Not Found)...' },

    // Tool input placeholders — batch
    'tools.mdTableGenerator.ph.csv': { en: 'Paste CSV data here...\n\nName,Role,Level\nAlice,Engineer,Senior\nBob,Designer,Mid', es: 'Pega datos CSV aquí...\n\nNombre,Puesto,Nivel\nAlicia,Ingeniera,Senior\nBeto,Disenador,Medio' },
    'tools.colorName.ph.search': { en: 'Search colors...', es: 'Buscar colores...' },
    'tools.npmSearch.ph.search': { en: 'Search npm packages... e.g. react, lodash, express', es: 'Busca paquetes npm... ej. react, lodash, express' },
    'tools.crontabRef.ph.search': { en: 'Search expressions...', es: 'Buscar expresiones...' },
    'tools.emojiPicker.ph.search': { en: 'Search emojis...', es: 'Buscar emojis...' },
    'tools.asciiArt.ph.input': { en: 'Type something...', es: 'Escribe algo...' },
    'tools.jsonPath.ph.search': { en: 'Search keys, values, or paths...', es: 'Busca claves, valores o rutas...' },
    'tools.tailwindLookup.ph.search': { en: 'Search by class name or CSS property... e.g. flex, padding, 1rem', es: 'Busca por nombre de clase o propiedad CSS... ej. flex, padding, 1rem' },
    'tools.envValidator.ph.input': { en: 'Paste your .env file content here...\n\n# Example\nAPP_NAME=MyApp\nDB_HOST=localhost\nAPI_KEY=sk_live_xxxxx', es: 'Pega el contenido de tu archivo .env aquí...\n\n# Ejemplo\nAPP_NAME=MiApp\nDB_HOST=localhost\nAPI_KEY=sk_live_xxxxx' },
    'tools.lineSorter.ph.input': { en: 'Paste lines here...', es: 'Pega las líneas aquí...' },
    'tools.encodingConverter.ph.input': { en: 'Type or paste text to convert...', es: 'Escribe o pega el texto a convertir...' },
    'tools.apiRequestBuilder.ph.headerName': { en: 'Header name', es: 'Nombre de la cabecera' },

    // Tool input placeholders — batch
    'tools.cssUnits.ph.value': { en: 'e.g. 16', es: 'ej. 16' },
    'tools.packageJson.ph.keyword': { en: 'Add keyword...', es: 'Anadir palabra clave...' },
    'tools.gitignoreGenerator.ph.search': { en: 'Search technologies...', es: 'Buscar tecnologías...' },
    'tools.gitReference.ph.search': { en: 'Search by command (e.g. rebase) or description (e.g. squash commits)...', es: 'Busca por comando (ej. rebase) o descripción (ej. combinar commits)...' },
    'tools.jsMinifier.ph.input': { en: 'Paste JavaScript code here...', es: 'Pega código JavaScript aquí...' },
    'tools.dockerRef.ph.search': { en: 'Search directives (e.g. image, volumes, depends_on)...', es: 'Busca directivas (ej. image, volumes, depends_on)...' },
    'tools.htmlEntities.ph.search': { en: 'Search entities...', es: 'Buscar entidades...' },
    'tools.pomodoro.ph.task': { en: 'What are you working on?', es: '¿En qué estás trabajando?' },
    'tools.jwtCheatsheet.ph.search': { en: 'Search claims or algorithms...', es: 'Busca claims o algoritmos...' },
    'tools.gridGenerator.ph.itemName': { en: 'Item name', es: 'Nombre del elemento' },
    'tools.charMap.ph.search': { en: 'Search by name, keyword, codepoint (e.g. \'arrow\', \'U+2192\', \'&rarr;\')', es: 'Busca por nombre, palabra clave o punto de código (ej. \'flecha\', \'U+2192\', \'&rarr;\')' },
    'tools.jwtDecoder.ph.token': { en: 'Paste your JWT token here...\n\ne.g. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U', es: 'Pega tu token JWT aquí...\n\nej. eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U' },

    // Tool input placeholders — batch
    'tools.sslCertificateAuditor.ph.target': { en: 'e.g. github.com or https://github.com/org/repo', es: 'ej. github.com o https://github.com/org/repo' },
    'tools.faviconGenerator.ph.emoji': { en: 'Paste an emoji here...', es: 'Pega un emoji aquí...' },
    'tools.headingChecker.ph.input': { en: 'Paste HTML containing heading tags (h1-h6)...', es: 'Pega HTML que contenga etiquetas de encabezado (h1-h6)...' },
    'tools.morseCode.ph.filter': { en: 'Filter by character or code...', es: 'Filtra por carácter o código...' },
    'tools.textShadow.ph.preview': { en: 'Preview text', es: 'Texto de vista previa' },
    'tools.cssMinifier.ph.input': { en: 'Paste or type your CSS here...\n\ne.g. .container { display: flex; gap: 1rem; }', es: 'Pega o escribe tu CSS aquí...\n\nej. .container { display: flex; gap: 1rem; }' },
    'tools.keyboardShortcuts.ph.search': { en: 'Search by action (e.g. copy) or key (e.g. Ctrl+C)...', es: 'Busca por acción (ej. copiar) o tecla (ej. Ctrl+C)...' },
    'tools.sqlFormatter.ph.input': { en: 'Paste or type your SQL here...\n\ne.g. SELECT * FROM users WHERE id = 1', es: 'Pega o escribe tu SQL aquí...\n\nej. SELECT * FROM users WHERE id = 1' },
    'tools.emailDeliverabilityAuditor.ph.selector': { en: 'Custom selector', es: 'Selector personalizado' },
    'tools.jsonSchema.ph.validate': { en: 'Paste JSON to validate against the generated schema...', es: 'Pega JSON para validarlo contra el esquema generado...' },
    'tools.checklist.ph.newItem': { en: 'Type item and press Enter...', es: 'Escribe un elemento y pulsa Enter...' },
    'tools.gradientText.ph.preview': { en: 'Enter preview text', es: 'Introduce el texto de vista previa' },
};

  constructor() {
    // Precedence: ?lang= in the URL, then the saved preference, then English.
    //
    // The query param has to win. It is the only language signal a crawler can
    // carry: Googlebot has no localStorage and never clicks the EN/ES toggle,
    // so before this the ?lang=es URL that the hreflang annotations advertise
    // rendered byte-identical English and Google would drop the alternate as a
    // duplicate. It also makes the Spanish view linkable and shareable, which
    // a localStorage-only preference never was.
    const saved = this.isBrowser ? localStorage.getItem('preferred-language') : null;
    const language = this.readLanguageFromUrl() ?? this.normalize(saved) ?? DEFAULT_LANGUAGE;
    this.currentLanguageSubject.next(language);
    this.reflectLanguageOnDocument(language);
  }

  /** `?lang=es` / `?lang=en`. Anything unsupported is ignored rather than trusted. */
  private readLanguageFromUrl(): string | null {
    if (!this.isBrowser) return null;
    return this.normalize(new URLSearchParams(window.location.search).get('lang'));
  }

  private normalize(language: string | null): string | null {
    return language && (SUPPORTED_LANGUAGES as readonly string[]).includes(language) ? language : null;
  }

  /**
   * Keep <html lang> honest. It drives screen-reader pronunciation, and it is
   * one of the signals Google cross-checks against an hreflang claim — a page
   * serving Spanish while still declaring lang="en" undermines both.
   */
  private reflectLanguageOnDocument(language: string): void {
    if (!this.isBrowser) return;
    document.documentElement.lang = language;
  }

  setLanguage(language: string): void {
    this.currentLanguageSubject.next(language);
    this.reflectLanguageOnDocument(language);
    if (this.isBrowser) localStorage.setItem('preferred-language', language);
  }

  getCurrentLanguage(): string {
    return this.currentLanguageSubject.value;
  }

  translate(key: string): string {
    const currentLang = this.getCurrentLanguage();
    const translation = this.translations[key];

    if (translation && translation[currentLang as 'en' | 'es']) {
      return translation[currentLang as 'en' | 'es'];
    }

    return translation?.en || key;
  }
}


