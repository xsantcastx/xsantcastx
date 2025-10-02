import { Injectable } from '@angular/core';
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
    'contact.form.success': { en: 'Thank you! Your project brief has been sent. We will reply within 24 hours.', es: 'Gracias! Tu propuesta fue enviada. Responderemos en menos de 24 horas.' },
    'contact.form.error': { en: 'Sorry, there was an error sending your message. Please try again or contact us directly.', es: 'Lo sentimos, hubo un error al enviar tu mensaje. Intenta de nuevo o contactanos directamente.' },

    // Donation Form
    'donation.form.title': { en: 'Support with KASPA', es: 'Apoya con KASPA' },
    'donation.form.subtitle': { en: 'Scan, send a note, and keep the builds flowing.', es: 'Escanea, deja un mensaje y ayuda a que los proyectos sigan.' },
    'donation.form.walletLabel': { en: 'Kaspa wallet address', es: 'Direccion de billetera Kaspa' },
    'donation.form.copy': { en: 'Copy', es: 'Copiar' },
    'donation.form.copySuccess': { en: 'Wallet copied to clipboard.', es: 'Direccion copiada al portapapeles.' },
    'donation.form.copyError': { en: 'Unable to copy. Please copy it manually.', es: 'No se pudo copiar. Copia la direccion manualmente.' },
    'donation.form.qrAlt': { en: 'Kaspa wallet QR code', es: 'Codigo QR de la billetera Kaspa' },
    'donation.form.messageLabel': { en: 'Leave a message', es: 'Deja un mensaje' },
    'donation.form.messagePlaceholder': { en: 'Share a shout-out, request, or idea you would like me to build next...', es: 'Comparte un saludo, una peticion o una idea que te gustaria que construyera.' },
    'donation.form.messageRequired': { en: 'Please add a short message before sending.', es: 'Agrega un mensaje corto antes de enviarlo.' },
    'donation.form.submit': { en: 'Send message', es: 'Enviar mensaje' },
    'donation.form.success': { en: 'Thank you for the support!', es: 'Gracias por el apoyo!' },
    'donation.form.error': { en: 'Could not send the message. Try again in a moment.', es: 'No se pudo enviar el mensaje. Intentalo de nuevo en un momento.' },

    // Footer
    'footer.donate': { en: 'Support My Work', es: 'Apoya Mi Trabajo' },
    'footer.donate.desc': { en: 'Help me continue creating amazing projects', es: 'Ayudame a seguir creando proyectos increibles' },
    'footer.paypal.title': { en: 'PayPal Donation', es: 'Donacion PayPal' },
    'footer.paypal.desc': { en: 'Support my development work with a secure PayPal donation', es: 'Apoya mi trabajo de desarrollo con una donacion segura por PayPal' },
    'footer.paypal.note': { en: 'Your support helps me create better projects!', es: 'Tu apoyo me ayuda a crear mejores proyectos!' },
    'footer.stripe.title': { en: 'Card Donation', es: 'Donacion con Tarjeta' },
    'footer.stripe.desc': { en: 'Support my work with a secure card payment', es: 'Apoya mi trabajo con un pago seguro con tarjeta' },
    'footer.stripe.note': { en: 'Powered by Stripe for secure transactions', es: 'Impulsado por Stripe para transacciones seguras' },
    'footer.donation': { en: 'Donation', es: 'Donacion' },
    'footer.amount': { en: 'Amount', es: 'Cantidad' },
    'footer.custom.amount': { en: 'Custom Amount', es: 'Cantidad Personalizada' },
    'footer.custom.placeholder': { en: 'Enter amount (min $1)', es: 'Ingresa una cantidad (minimo $1)' },
    'footer.custom.invalid': { en: 'Please enter a valid amount (minimum $1)', es: 'Ingresa una cantidad valida (minimo $1)' },
    'footer.or': { en: 'or', es: 'o' },
    'footer.processing': { en: 'Processing...', es: 'Procesando...' },
    'footer.success': { en: 'Thank you for your support!', es: 'Gracias por tu apoyo!' },
    'footer.error': { en: 'Payment failed. Please try again.', es: 'El pago fallo. Intenta de nuevo.' }
  };

  constructor() {
    const savedLanguage = localStorage.getItem('preferred-language') || 'en';
    this.currentLanguageSubject.next(savedLanguage);
  }

  setLanguage(language: string): void {
    this.currentLanguageSubject.next(language);
    localStorage.setItem('preferred-language', language);
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


