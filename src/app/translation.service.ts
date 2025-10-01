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
    'hero.title': { en: "We're xsantcastx", es: 'Somos xsantcastx' },
    'hero.subtitle': { en: 'Development Enterprise', es: 'Empresa de Desarrollo' },
    'hero.description': { 
      en: 'I create modern web applications and mobile apps that drive business growth. From sleek frontends to robust backends, I turn your ideas into digital reality.',
      es: 'Creo aplicaciones web modernas y apps móviles que impulsan el crecimiento empresarial. Desde interfaces elegantes hasta backends robustos, convierto tus ideas en realidad digital.'
    },
    'hero.cta.work': { en: 'View My Work', es: 'Ver Mi Trabajo' },
    'hero.cta.talk': { en: "Let's Talk", es: 'Hablemos' },
    
    // Services Section
    'services.title': { en: 'What I Build', es: 'Lo Que Construyo' },
    'services.subtitle': { en: 'Full-stack solutions that drive your business forward', es: 'Soluciones full-stack que impulsan tu negocio' },
    'services.frontend.title': { en: 'Frontend Development', es: 'Desarrollo Frontend' },
    'services.frontend.desc': { en: 'Modern, responsive web applications with cutting-edge frameworks and smooth user experiences.', es: 'Aplicaciones web modernas y responsivas con frameworks de vanguardia y experiencias de usuario fluidas.' },
    'services.backend.title': { en: 'Backend Development', es: 'Desarrollo Backend' },
    'services.backend.desc': { en: 'Robust server-side solutions, APIs, and database architecture that scale with your business.', es: 'Soluciones robustas del lado del servidor, APIs y arquitectura de base de datos que escalan con tu negocio.' },
    'services.fullstack.title': { en: 'Full-Stack Applications', es: 'Aplicaciones Full-Stack' },
    'services.fullstack.desc': { en: 'Complete web solutions from concept to deployment, handling both frontend and backend.', es: 'Soluciones web completas desde el concepto hasta el despliegue, manejando tanto frontend como backend.' },
    'services.mobile.title': { en: 'Mobile Applications', es: 'Aplicaciones Móviles' },
    'services.mobile.desc': { en: 'Native and cross-platform mobile apps that deliver seamless experiences on any device.', es: 'Apps móviles nativas y multiplataforma que brindan experiencias perfectas en cualquier dispositivo.' },
    'services.cta.title': { en: 'Ready to build something amazing?', es: '¿Listo para construir algo increíble?' },
    'services.cta.button': { en: 'Start Your Project', es: 'Inicia Tu Proyecto' },
    
    // Projects Section
    'projects.title': { en: 'Featured Projects', es: 'Proyectos Destacados' },
    'projects.subtitle': { en: 'Real-world applications showcasing modern web development', es: 'Aplicaciones del mundo real que muestran desarrollo web moderno' },
    'projects.live': { en: 'Live Demo', es: 'Demo en Vivo' },
    'projects.code': { en: 'Code', es: 'Código' },
    'projects.features': { en: 'Key Features:', es: 'Características Clave:' },
    'projects.cta.title': { en: 'Interested in working together?', es: '¿Interesado en trabajar juntos?' },
    'projects.cta.desc': { en: "Let's discuss your next project and bring your ideas to life", es: 'Hablemos de tu próximo proyecto y hagamos realidad tus ideas' },
    'projects.cta.button': { en: 'Get In Touch', es: 'Contáctame' },
    
    // About Section
    'about.title': { en: '🧠 About xsantcastx', es: '🧠 Acerca de xsantcastx' },
    'about.intro': { 
      en: "We are xsantcastx—a cutting-edge development enterprise specializing in full-stack solutions and innovative web technologies that leave a lasting digital impact.",
      es: 'Somos xsantcastx—una empresa de desarrollo de vanguardia especializada en soluciones full-stack y tecnologías web innovadoras que dejan un impacto digital duradero.'
    },
    'about.description': { 
      en: "We're not just about code and databases—we're passionate innovators, blockchain enthusiasts, and technology pioneers. Whether we're architecting scalable web applications, implementing modern CI/CD pipelines, or exploring emerging tech stacks, we bring expertise and innovation to every project.",
      es: 'No solo se trata de código y bases de datos—somos innovadores apasionados, entusiastas de blockchain y pioneros tecnológicos. Ya sea arquitecturando aplicaciones web escalables, implementando pipelines modernos de CI/CD, o explorando nuevos stacks tecnológicos, aportamos experiencia e innovación a cada proyecto.'
    },
    'about.drives.title': { en: '💡 What Drives Us', es: '💡 Lo Que Nos Motiva' },
    'about.drives.innovation': { en: 'Innovation is at our core—we transform complex challenges into elegant, scalable solutions.', es: 'La innovación está en nuestro núcleo—transformamos desafíos complejos en soluciones elegantes y escalables.' },
    'about.drives.quality': { en: 'We deliver high-quality, maintainable code that exceeds client expectations and industry standards.', es: 'Entregamos código de alta calidad y mantenible que supera las expectativas del cliente y los estándares de la industria.' },
    'about.drives.global': { en: 'Operating in English and Spanish markets, we provide global reach with local expertise.', es: 'Operando en mercados de inglés y español, proporcionamos alcance global con experiencia local.' },
    'about.beyond.title': { en: '🚀 Our Technology Edge', es: '🚀 Nuestra Ventaja Tecnológica' },
    'about.beyond.fullstack': { en: 'Full-Stack Mastery: From Angular and React frontends to Node.js and Python backends, we cover the complete development spectrum.', es: 'Dominio Full-Stack: Desde frontends de Angular y React hasta backends de Node.js y Python, cubrimos todo el espectro de desarrollo.' },
    'about.beyond.cloud': { en: 'Cloud & DevOps: Expert implementation of AWS, Firebase, Docker, and Kubernetes for scalable, production-ready solutions.', es: 'Cloud y DevOps: Implementación experta de AWS, Firebase, Docker y Kubernetes para soluciones escalables y listas para producción.' },
    'about.beyond.modern': { en: 'Modern Architecture: We embrace cutting-edge patterns, microservices, and progressive web applications.', es: 'Arquitectura Moderna: Adoptamos patrones de vanguardia, microservicios y aplicaciones web progresivas.' },
    'about.levelup.title': { en: '📚 Continuous Evolution', es: '📚 Evolución Continua' },
    'about.levelup.research': { en: 'We continuously research emerging technologies, AI integration, and next-generation development frameworks.', es: 'Investigamos continuamente tecnologías emergentes, integración de IA y frameworks de desarrollo de próxima generación.' },
    'about.levelup.innovation': { en: 'Our R&D initiatives explore blockchain applications, Web3 solutions, and advanced data processing techniques.', es: 'Nuestras iniciativas de I+D exploran aplicaciones blockchain, soluciones Web3 y técnicas avanzadas de procesamiento de datos.' },
    
    // Additional About Section Content
    'about.subtitle': { en: 'Full-Stack Development Enterprise & Digital Solutions Architect', es: 'Empresa de Desarrollo Full-Stack y Arquitecto de Soluciones Digitales' },
    'about.enterprise.intro': {
      en: "We're a passionate full-stack development enterprise with expertise in modern web technologies and a proven track record of delivering high-quality digital solutions. Our journey in web development spans across multiple industries, from e-commerce to business platforms.",
      es: 'Somos una empresa de desarrollo full-stack apasionada con experiencia en tecnologías web modernas y un historial comprobado de entrega de soluciones digitales de alta calidad. Nuestro camino en el desarrollo web abarca múltiples industrias, desde e-commerce hasta plataformas empresariales.'
    },
    'about.enterprise.specialization': {
      en: 'We specialize in creating scalable applications that not only look great but perform exceptionally. Whether you need a sophisticated e-commerce platform, a business management system, or a custom web application, we bring both technical expertise and creative problem-solving to every project.',
      es: 'Nos especializamos en crear aplicaciones escalables que no solo se ven geniales sino que funcionan excepcionalmente. Ya sea que necesites una plataforma de e-commerce sofisticada, un sistema de gestión empresarial, o una aplicación web personalizada, aportamos tanto experiencia técnica como resolución creativa de problemas a cada proyecto.'
    },
    'about.enterprise.approach': {
      en: 'Our approach focuses on understanding your business goals and translating them into digital experiences that drive results and delight users.',
      es: 'Nuestro enfoque se centra en entender tus objetivos empresariales y traducirlos en experiencias digitales que generen resultados y deleiten a los usuarios.'
    },
    
    // Skills Section
    'skills.title': { en: 'My Skills', es: 'Mis Habilidades' },
    'skills.loading': { en: 'Loading...', es: 'Cargando...' },
    'skills.error': { en: 'Failed to load skills. Please try again.', es: 'Error al cargar habilidades. Por favor intenta de nuevo.' },
    
    // Contact Section
    'contact.title': { en: "Let's Build Something Amazing", es: 'Construyamos Algo Increíble' },
    'contact.subtitle': { en: "Ready to transform your ideas into reality? Let's discuss your project.", es: '¿Listo para transformar tus ideas en realidad? Hablemos de tu proyecto.' },
    'contact.info.header': { en: 'Ready to start your project?', es: '¿Listo para comenzar tu proyecto?' },
    'contact.info.desc': { en: "We're here to help bring your vision to life with cutting-edge web solutions.", es: 'Estamos aquí para ayudar a dar vida a tu visión con soluciones web de vanguardia.' },
    'contact.method.email': { en: 'Email', es: 'Email' },
    'contact.method.github': { en: 'GitHub', es: 'GitHub' },
    'contact.method.response': { en: 'Response Time', es: 'Tiempo de Respuesta' },
    'contact.method.response.time': { en: 'Usually within 24 hours', es: 'Usualmente dentro de 24 horas' },
    'contact.projects.title': { en: 'Project Types I Excel At:', es: 'Tipos de Proyectos en los que Sobresalgo:' },
    'contact.projects.ecommerce': { en: 'E-commerce Platforms', es: 'Plataformas de E-commerce' },
    'contact.projects.business': { en: 'Business Web Applications', es: 'Aplicaciones Web Empresariales' },
    'contact.projects.cms': { en: 'Custom CMS Solutions', es: 'Soluciones CMS Personalizadas' },
    'contact.projects.mobile': { en: 'Mobile App Development', es: 'Desarrollo de Apps Móviles' },
    'contact.projects.api': { en: 'API Development & Integration', es: 'Desarrollo e Integración de APIs' },
    'contact.form.name': { en: 'Your Name', es: 'Tu Nombre' },
    'contact.form.name.placeholder': { en: 'Enter your name', es: 'Ingresa tu nombre' },
    'contact.form.email': { en: 'Email Address', es: 'Dirección de Email' },
    'contact.form.email.placeholder': { en: 'your@email.com', es: 'tu@email.com' },
    'contact.form.project': { en: 'Project Type', es: 'Tipo de Proyecto' },
    'contact.form.project.select': { en: 'Select project type', es: 'Selecciona tipo de proyecto' },
    'contact.form.project.webapp': { en: 'Web Application', es: 'Aplicación Web' },
    'contact.form.project.ecommerce': { en: 'E-commerce Site', es: 'Sitio de E-commerce' },
    'contact.form.project.mobile': { en: 'Mobile App', es: 'App Móvil' },
    'contact.form.project.api': { en: 'API Development', es: 'Desarrollo de API' },
    'contact.form.project.other': { en: 'Other', es: 'Otro' },
    'contact.form.budget': { en: 'Budget Range', es: 'Rango de Presupuesto' },
    'contact.form.budget.select': { en: 'Select budget range', es: 'Selecciona rango de presupuesto' },
    'contact.form.budget.under5k': { en: 'Under $5,000', es: 'Menos de $5,000' },
    'contact.form.budget.5k10k': { en: '$5,000 - $10,000', es: '$5,000 - $10,000' },
    'contact.form.budget.10k25k': { en: '$10,000 - $25,000', es: '$10,000 - $25,000' },
    'contact.form.budget.25kplus': { en: '$25,000+', es: '$25,000+' },
    'contact.form.message': { en: 'Project Details', es: 'Detalles del Proyecto' },
    'contact.form.message.placeholder': { en: 'Tell me about your project, goals, and any specific requirements...', es: 'Cuéntame sobre tu proyecto, objetivos y cualquier requerimiento específico...' },
    'contact.form.submit': { en: 'Send Project Brief', es: 'Enviar Propuesta' },
    'contact.form.sending': { en: 'Sending...', es: 'Enviando...' },
    'contact.form.success': { en: 'Thank you! Your project brief has been sent successfully. We\'ll get back to you within 24 hours.', es: '¡Gracias! Tu propuesta de proyecto ha sido enviada exitosamente. Te contactaremos dentro de 24 horas.' },
    'contact.form.error': { en: 'Sorry, there was an error sending your message. Please try again or contact us directly.', es: 'Lo sentimos, hubo un error enviando tu mensaje. Por favor intenta de nuevo o contáctanos directamente.' },
    
    // Footer
    'footer.donate': { en: 'Support My Work', es: 'Apoya Mi Trabajo' },
    'footer.donate.desc': { en: 'Help me continue creating amazing projects', es: 'Ayúdame a seguir creando proyectos increíbles' },
    'footer.paypal.title': { en: 'PayPal Donation', es: 'Donación PayPal' },
    'footer.paypal.desc': { en: 'Support my development work with a secure PayPal donation', es: 'Apoya mi trabajo de desarrollo con una donación segura por PayPal' },
    'footer.paypal.note': { en: 'Your support helps me create better projects!', es: '¡Tu apoyo me ayuda a crear mejores proyectos!' },
    'footer.stripe.title': { en: 'Card Donation', es: 'Donación con Tarjeta' },
    'footer.stripe.desc': { en: 'Support my work with a secure card payment', es: 'Apoya mi trabajo con un pago seguro con tarjeta' },
    'footer.stripe.note': { en: 'Powered by Stripe for secure transactions', es: 'Impulsado por Stripe para transacciones seguras' },
    'footer.donation': { en: 'Donation', es: 'Donación' },
    'footer.amount': { en: 'Amount', es: 'Cantidad' },
    'footer.custom.amount': { en: 'Custom Amount', es: 'Cantidad Personalizada' },
    'footer.custom.placeholder': { en: 'Enter amount (min $1)', es: 'Ingresa cantidad (mín $1)' },
    'footer.custom.invalid': { en: 'Please enter a valid amount (minimum $1)', es: 'Por favor ingresa una cantidad válida (mínimo $1)' },
    'footer.or': { en: 'or', es: 'o' },
    'footer.processing': { en: 'Processing...', es: 'Procesando...' },
    'footer.success': { en: 'Thank you for your support!', es: '¡Gracias por tu apoyo!' },
    'footer.error': { en: 'Payment failed. Please try again.', es: 'El pago falló. Por favor intenta de nuevo.' }
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
    
    // Fallback to English if translation not found
    return translation?.en || key;
  }
}