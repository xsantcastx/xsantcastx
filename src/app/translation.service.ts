import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

interface Translations {
  [key: string]: {
    en: string;
    es: string;
  };
}

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
    'contact.info.header': { en: 'Work With xsantcastx', es: 'Trabaja con xsantcastx' },
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
    'cosmic.anchor.whisper':        { en: 'somewhere between the tools and the void — a world still spinning.', es: 'en algun lugar entre las herramientas y el vacio — un mundo que sigue girando.' },

    // ─── Payment fallback copy ─────────────────────────────────────────────
    'footer.stripe.notReady':       { en: '✦ The card portal is still tuning in. Try Crypto or PayPal — or refresh in a few seconds to retry.', es: '✦ El portal de tarjetas aun se esta sintonizando. Prueba Crypto o PayPal — o recarga en unos segundos.' },

    // ─── Trust microcopy ───────────────────────────────────────────────────
    'contact.form.trust':           { en: '🛡 Sent only to xsantcastx — we reply within 24 hours.',     es: '🛡 Enviado solo a xsantcastx — respondemos en menos de 24 horas.' },
    'newsletter.trust':             { en: 'No spam. No account needed. Unsubscribe anytime.',          es: 'Sin spam. Sin cuenta. Date de baja cuando quieras.' }
  };

  constructor() {
    const savedLanguage = (this.isBrowser ? localStorage.getItem('preferred-language') : null) || 'en';
    this.currentLanguageSubject.next(savedLanguage);
  }

  setLanguage(language: string): void {
    this.currentLanguageSubject.next(language);
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


