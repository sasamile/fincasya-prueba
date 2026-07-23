// Default content for internal pages
// Easy to edit - change values here, not in page components

// ============ VINCÚLATE ============
export const VINCULATE_DEFAULT = {
  heroTitle: "Publica tu finca con nosotros",
  heroSubtitle:
    "Somos la plataforma de descanso líder en Colombia. Con más de 600 fincas verificadas y +40K huéspedes satisfechos.",
  stats: [
    { label: "Fincas", value: "+600" },
    { label: "Huéspedes", value: "+40K" },
    { label: "Ciudades", value: "50+" },
    { label: "Rating", value: "4.8" },
  ],
  benefitsSectionTitle: "¿Por qué publicar con FincasYa?",
  benefits: [
    {
      icon: "CheckCircle",
      title: "Fincas 100% verificadas",
      description:
        "Visitamos cada propiedad para garantizar que las fotos y descripción sean reales.",
    },
    {
      icon: "Megaphone",
      title: "Marketing incluido",
      description:
        "Fotos profesionales, posicionamiento SEO y promoción en redes sociales.",
    },
    {
      icon: "Headphones",
      title: "Soporte 24/7",
      description:
        "Nuestro equipo atiende a los huéspedes antes, durante y después de la estadía.",
    },
    {
      icon: "Shield",
      title: "Pagos seguros",
      description:
        "Gestionamos cobros y pagos. Tú solo recibes el ingreso, nosotros nos encargamos del resto.",
    },
  ],
  stepsSectionTitle: "Así de fácil es comenzar",
  steps: [
    {
      title: "Registra tu propiedad",
      description:
        "Escríbenos con los datos básicos de tu finca: ubicación, capacidad, servicios.",
    },
    {
      title: "Verificamos tu finca",
      description:
        "Nuestro equipo evalúa tu propiedad y, si cumple los estándares, tomanos fotos profesionales.",
    },
    {
      title: "Recibe huéspedes",
      description:
        "Publicamos tu finca y starts receive bookings. Tú solo disfruta de los ingresos.",
    },
  ],
  formTitle: "¿Listo para empezar?",
  formSubtitle: "Escríbenos y te contactamos en menos de 24 horas",
  formFields: {
    nombre: "Nombre completo",
    telefono: "Teléfono / WhatsApp",
    correo: "Correo electrónico",
    ubicacion: "Ciudad o zona de la propiedad",
    tipoPropiedad: "Tipo de propiedad",
    mensaje: "Cuéntanos sobre tu propiedad",
  },
  formSubmit: "Enviar mensaje",
  formNote: "O escríbenos directamente por WhatsApp",
  ctaTitle: "¿Tienes dudas?",
  ctaSubtitle: "Nuestro equipo te resuelve cualquier pregunta",
  ctaWhatsappUrl: "https://wa.me/573157773937?text=Hola%20FincasYa!%20Me%20interesa%20publicar%20mi%20finca",
};

// ============ BLOG ============
export const BLOG_DEFAULT = {
  heroTitle: "Blog FincasYa",
  heroSubtitle:
    "Consejos, guías y destinos para tu próxima escapada. Descubre los mejores lugares para descansar en Colombia.",
  enabled: true,
  categories: ["Todos", "Novedades", "Destinos", "Consejos", "Experiencias", "Tendencias"],
  posts: [
    {
      id: 7,
      category: "Novedades",
      title: "Hoy FincasYa da un paso gigante con inteligencia artificial",
      excerpt:
        "Seguimos construyendo el futuro de nuestra empresa con IA supervisada y software propio, para una mejor experiencia de clientes y propietarios.",
      imageUrl: "/apple-touch-icon.png",
      date: "23 de julio, 2026",
      readTime: 3,
      active: true,
      content: `
<p><strong>Hoy FincasYa.com da un paso gigante.</strong></p>
<p>Después de mucho trabajo, aprendizaje y cientos de horas de desarrollo, seguimos construyendo el futuro de nuestra empresa de la mano de la <strong>inteligencia artificial supervisada</strong> y de un <strong>software propio</strong> diseñado para ofrecer una mejor experiencia a nuestros clientes y propietarios.</p>
<p>La tecnología nunca reemplazará el valor de las personas, pero bien utilizada nos permite ser más rápidos, más seguros y brindar un servicio cada vez mejor.</p>
<p>Muy agradecido con todo el equipo que hace esto posible. Lo mejor aún está por venir.</p>
<p class="text-sm text-muted-foreground">#FincasYa #InteligenciaArtificial #Innovación #Tecnología #Emprendimiento #Turismo #Software #Colombia</p>
      `.trim(),
    },
    {
      id: 1,
      category: "Destinos",
      title: "Los mejores destinos para fincas en 2025",
      excerpt:
        "Descubre los destinos más populares para alquilar fincas este año. Desde Villavicencio hasta la costa.",
      imageUrl: "",
      date: "15 de marzo, 2025",
      readTime: 8,
      content: `
<h2>¿Por qué elegir una finca para tus vacaciones?</h2>
<p>Las fincas ofrecen una experiencia única que los hoteles tradicionales no pueden igualar. Espacio, privacidad, naturaleza y la posibilidad de desconectarte del caos de la ciudad.</p>

<h2>Villavicencio: El destino estrella</h2>
<p>Conocida como la "Puerta al Llano", Villavicencio se ha convertido en el destino favorito para quienes buscan fincas cerca de Bogotá. A solo 2-3 horas de la capital, encontrarás fincas con piscina, zonas verdes y actividades al aire libre.</p>

<h2>La costa atlántica: Sol y playa</h2>
<p>Desde Cartagena hasta Santa Marta, las fincas costeras ofrecen lo mejor de ambos mundos: la playa y el descanso en espacios privados. Perfecto para familias y grupos grandes.</p>

<h2>Eje cafetero: Cultura y naturaleza</h2>
<p>Pereira, Manizales y Armenia te ofrecen fincas en medio de montañas cafeteras. Despierta con el aroma del café fresco y disfruta de paisajes únicos.</p>
      `,
    },
    {
      id: 2,
      category: "Consejos",
      title: "Guía completa: qué llevar a una finca",
      excerpt:
        "No olvides nada y disfruta al máximo tu estadía. Lista completa de essentials para tu viaje.",
      imageUrl: "",
      date: "10 de marzo, 2025",
      readTime: 5,
      content: `
<h2>Essentials para tu viaje</h2>
<p>Viajar a una finca requiere cierta preparación. Aquí te dejamos la lista definitiva:</p>

<h3>Documentos</h3>
<ul>
<li>Identificación personal</li>
<li>Reservación confirmada</li>
<li>Contacto del propietario</li>
</ul>

<h3>Artículos de aseo</h3>
<ul>
<li>Toallas (verifica si la finca las proporciona)</li>
<li>Protector solar</li>
<li>Repelente de insectos</li>
</ul>

<h3>Comida y bebidas</h3>
<ul>
<li>Snacks para el camino</li>
<li>Bebidas esenciales</li>
<li>Ingredientes básicos si vas a cocinar</li>
</ul>

<h3>Entretenimiento</h3>
<ul>
<li>Juegos de mesa</li>
<li>Libros</li>
<li>Música</li>
</ul>
      `,
    },
    {
      id: 3,
      category: "Experiencias",
      title: "Finca cerca de Bogotá: nuestra experiencia",
      excerpt:
        "Una familia comparte su experiencia encontrando la finca perfecta a solo 2 horas de la capital.",
      imageUrl: "",
      date: "5 de marzo, 2025",
      readTime: 6,
      content: `
<h2>Nuestra escapada familiar</h2>
<p>Después de meses buscando el destino perfecto para nuestro fin de semana largo, descubrimos una joya a solo 2 horas de Bogotá.</p>

<h2>La elección</h2>
<p>Decidimos buscar en FincasYa por recomendaciones y encontramos una finca en Girardot con piscina privada. Era ideal para nuestra familia de 5 personas.</p>

<h2>La experiencia</h2>
<p>Los niños pasaron horas en la piscina mientras nosotros relaxeamos en la hamaca. La cocina estaba completamente equipada y pudimos preparar unas/arepas colombianas deliciosas.</p>

<h2>Nuestra recomendación</h2>
<p>Si buscas una escapada rápida desde Bogotá, las fincas en los LLanos Orientales o cerca de Girardot son perfectas. No te失望es!</p>
      `,
    },
    {
      id: 4,
      category: "Tendencias",
      title: "Glamping en Colombia: la nueva tendencia",
      excerpt:
        "El lujo bajo las estrellas. Descubre qué es el glamping y por qué está revolucionando el turismo rural.",
      imageUrl: "",
      date: "28 de febrero, 2025",
      readTime: 7,
      content: `
<h2>¿Qué es el glamping?</h2>
<p>Glamping = Glamour + Camping. Es la tendencia que combina la naturaleza con el lujo: carpas safari, domos geodésicos, cabañas elevadas con todas las comodidades.</p>

<h2>Glamping en Colombia</h2>
<p>El país tiene destinos perfectos para esta experiencia:</p>
<ul>
<li><strong>Eje Cafetero:</strong> Domos con vista a montañas cafeteras</li>
<li><strong>Santander:</strong> Cabañas en medio de cañones</li>
<li><strong>Caribe:</strong> Eco-cabañas en la selva</li>
</ul>

<h2>Por qué se popularizó</h2>
<p>El glamping appeals a quienes quieren conectar con la naturaleza sin sacrificar comodidad. WiFi, cama Queen, baño privado y vistas espectaculares.</p>
      `,
    },
    {
      id: 5,
      category: "Consejos",
      title: "Cómo elegir la finca perfecta",
      excerpt:
        "Guía práctica para encontrar la propiedad ideal según tus necesidades y presupuesto.",
      imageUrl: "",
      date: "22 de febrero, 2025",
      readTime: 6,
      content: `
<h2>Define tu needs</h2>
<p>Antes de buscar, responde estas preguntas:</p>
<ul>
<li>¿Cuántas personas viajarán?</li>
<li>¿Niños involucrados?</li>
<li>¿Qué actividades quieres realizar?</li>
<li>¿Cuál es tu presupuesto?</li>
</ul>

<h2>Filtros importantes</h2>
<h3>Ubicación</h3>
<p>¿Cerca de Bogotá? ¿Playa? ¿Montaña? Cada destino ofrece experiencias distintas.</p>

<h3>Servicios</h3>
<ul>
<li>Piscina</li>
<li>Parqueadero</li>
<li>Cocina equipada</li>
<li>Zona BBQ</li>
<li>Mascotas permitidas</li>
</ul>

<h2>Lee las reseñas</h2>
<p>Las experiencias de otros huéspedes te dan información valiosa que las fotos no muestran.</p>
      `,
    },
    {
      id: 6,
      category: "Destinos",
      title: "Rutas de fincas por regiones de Colombia",
      excerpt:
        "Recorre los mejores destinos de descanso por región: Meta, Cundinamarca, Antioquia y más.",
      imageUrl: "",
      date: "18 de febrero, 2025",
      readTime: 10,
      content: `
<h2>Región Andina (Cundinamarca y Boyacá)</h2>
<p>Ahora de Bogotá, find fincas en:</p>
<ul>
<li><strong>Zipaquirá:</strong> Historia y clima de páramo</li>
<li><strong>Villa de Leyva:</strong> Pueblo mágico, fincas coloniales</li>
<li><strong>La Calera:</strong> Cercano, ideal para días cortos</li>
</ul>

<h2>Los Llanos (Meta)</h2>
<p>Aventura y naturaleza:</p>
<ul>
<li><strong>Villavicencio:</strong> Capital llanera, fincas con piscina</li>
<li><strong>Puerto López:</strong> Acceso al meta river</li>
<li><strong>Cumaral:</strong> Fincas de tradición ganadera</li>
</ul>

<h2>Antioquia</h2>
<p>Café y montañas:</p>
<ul>
<li><strong>Jardín:</strong> Pueblo colorido, fincas cafeteras</li>
<li><strong>Santa Fe de Antioquia:</strong> Clima cálido,finca colonial</li>
<li><strong>El Retiro:</strong> Montañas y naturaleza</li>
</ul>

<h2>Eje Cafetero</h2>
<p>Café, naturaleza y clima perfecto:</p>
<ul>
<li><strong>Salento:</strong> Valle de Cocora</li>
<li><strong>Filandia:</strong> Miradores y cafe</li>
<li><strong>Manizales:</strong> Termales y montañas</li>
</ul>
      `,
    },
  ],
  loadMore: "Cargar más",
  ctaTitle: "¿Tienes una historia?",
  ctaSubtitle: "Comparte tu experiencia con nosotros",
  ctaWhatsappUrl: "https://wa.me/573157773937?text=Hola%20FincasYa!%20Quiero%20compartir%20mi%20experiencia%20en%20el%20blog",
};

// ============ CENTRO DE AYUDA ============
export const CENTRO_DE_AYUDA_DEFAULT = {
  heroTitle: "Centro de Ayuda",
  heroSubtitle: "Encuentra respuestas a tus preguntas",
  searchPlaceholder: "Buscar en el centro de ayuda...",
  categoriesSectionTitle: "Explora por tema",
  categories: [
    {
      icon: "Ticket",
      title: "Reservas",
      description: "Cómo reservar, disponibilidad, fechas",
    },
    {
      icon: "CreditCard",
      title: "Pagos",
      description: "Métodos de pago, seguridad, recibos",
    },
    {
      icon: "XCircle",
      title: "Cancelaciones",
      description: "Política de cancelaciones, reembolsos",
    },
    {
      icon: "Home",
      title: "Propietarios",
      description: "Publicar tu propiedad, gestión, tips",
    },
    {
      icon: "PawPrint",
      title: "Mascotas",
      description: "Políticas de mascotas por finca",
    },
    {
      icon: "HelpCircle",
      title: "General",
      description: "Otras preguntas frecuentes",
    },
  ],
  faqSectionTitle: "Preguntas frecuentes",
  faqs: [
    {
      question: "¿Cómo reservo una finca?",
      answer:
        "Puedes explorar nuestro catálogo y contactar directamente por WhatsApp. Nuestro equipo te ayudará con la disponibilidad, precios y todo lo que necesites.",
    },
    {
      question: "¿Qué métodos de pago aceptan?",
      answer:
        "Aceptamos transferencias bancarias, PSE y principales tarjetas de crédito/débito. Tu pago está protegido hasta confirmar la estadía.",
    },
    {
      question: "¿Cuál es la política de cancelación?",
      answer:
        "Las condiciones dependen del plazo de aviso y la temporada. En temporada regular, con más de 15 días de anticipación puedes obtener reembolso completo.",
    },
    {
      question: "¿Puedo llevar mascotas?",
      answer:
        "Depende de cada propiedad. Algunas fincas aceptan mascotas con costo adicional. Puedes verificar en la descripción de cada propiedad o preguntarnos por WhatsApp.",
    },
    {
      question: "¿Qué incluye el precio de la renta?",
      answer:
        "El precio incluye el alquiler de la propiedad, servicios básicos (agua, luz, gas) y el uso de las áreas comunes. Costos adicionales como alimentación o servicios extra se acuerdan directamente.",
    },
    {
      question: "¿Cómo funciona el depósito de garantía?",
      answer:
        "Se requiere un depósito de garantía que se devuelve al check-out una vez verificado el estado de la propiedad. Usually 5-10 días hábiles.",
    },
    {
      question: "¿Cómo contacto al propietario?",
      answer:
        "Toda la comunicación se maneja a través de nuestro equipo de WhatsApp. Te pasamos el contacto directo después de confirmar la reserva.",
    },
    {
      question: "¿Qué hago si hay un problema durante la estadía?",
      answer:
        "Contáctanos inmediatamente por WhatsApp al +57 315 777 3937. Nuestro equipo está disponible 24/7 y coordinará con el propietario para resolver cualquier incidencia.",
    },
    {
      question: "¿Las fotos son reales?",
      answer:
        "Sí. Verificamos cada propiedad antes de publicarla. Las fotos corresponden al estado actual de la propiedad. Si algo no está como esperabas, contactanos.",
    },
    {
      question: "¿FincasYa es el dueño de las fincas?",
      answer:
        "No. FincasYa actúa como intermediario entre propietarios y huéspedes. Verificamos las propiedades, gestionamos reservas y brindamos soporte.",
    },
  ],
  ctaTitle: "¿No encontraste lo que buscabas?",
  ctaSubtitle: "Escríbenos y te ayudamos",
  ctaWhatsappUrl: "https://wa.me/573157773937?text=Hola%20FincasYa!%20Tengo%20una%20pregunta%20del%20centro%20de%20ayuda",
};

// ============ CONTACTO ============
export const CONTACTO_DEFAULT = {
  heroTitle: "Contáctenos",
  heroSubtitle: "Estamos aquí para ayudarte. Elige el canal que prefieras.",
  formTitle: "Escríbenos",
  formSubtitle: "Responderemos en 24-48 horas",
  formFields: {
    nombre: "Nombre completo *",
    correo: "Correo electrónico *",
    telefono: "Teléfono (opcional)",
    asunto: "Asunto *",
    mensaje: "Mensaje *",
  },
  asuntoOptions: [
    { value: "general", label: "General" },
    { value: "reservas", label: "Reservas" },
    { value: "propietarios", label: "Propietarios" },
    { value: "sugerencias", label: "Sugerencias" },
    { value: "quejas", label: "Quejas" },
  ],
  formSubmit: "Enviar mensaje",
  formNote: "Nota: Este formulario es solo informativo. Por respuestas más rápidas, contáctanos por WhatsApp.",
  infoTitle: "Información de contacto",
  info: {
    email: "info@fincasya.com",
    phone: "+57 315 777 3937",
    address: "Cl. 7 #N 44-76 of 301, Villavicencio, Meta",
    schedule: "Lunes a Viernes: 8am - 6pm\nSábado: 9am - 1pm",
    note: "* No se aceptan visitas presenciales",
  },
  ctaTitle: "¿Prefieres WhatsApp?",
  ctaSubtitle: "Chatea con nosotros directamente",
  ctaWhatsappUrl: "https://wa.me/573157773937?text=Hola%20FincasYa!%20Quiero%20contactarlos",
};

// ============ TÉRMINOS Y CONDICIONES ============
export const TERMINOS_DEFAULT = {
  heroTitle: "Términos y Condiciones de Uso",
  heroSubtitle: "Reglas que rigen el uso de la plataforma FincasYa.com",
  content: `<p>Contenido de términos y condiciones por definir. Edite desde el panel de administración.</p>`,
};

// ============ POLÍTICA DE PRIVACIDAD ============
export const PRIVACIDAD_DEFAULT = {
  heroTitle: "Política de Privacidad",
  heroSubtitle: "Tratamiento de datos personales conforme a la Ley 1581 de 2012",
  content: `<p>Contenido de política de privacidad por definir. Edite desde el panel de administración.</p>`,
};

// ============ POLÍTICA DE CANCELACIÓN ============
export const CANCELACION_DEFAULT = {
  heroTitle: "Política de Cancelación",
  heroSubtitle: "Reprogramación y Reembolsos",
  content: `<p>Contenido de política de cancelación por definir. Edite desde el panel de administración.</p>`,
};

// ============ HABEAS DATA ============
export const HABEAS_DATA_DEFAULT = {
  heroTitle: "Política de Habeas Data",
  heroSubtitle:
    "Tratamiento de datos personales conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013",
  content: `<p>En FincasYa.com respetamos tu privacidad y protegemos tus datos personales. Esta política describe cómo recopilamos, usamos y protegemos tu información cuando utilizas nuestros servicios.</p>
<p>Para ejercer tus derechos de acceso, rectificación, actualización o supresión, escríbenos a <strong>info@fincasya.com</strong>.</p>`,
};
