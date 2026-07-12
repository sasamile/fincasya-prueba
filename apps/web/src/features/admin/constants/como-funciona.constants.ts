import { ComoFuncionaData } from "../types/como-funciona.types";

export const COMO_FUNCIONA_DEFAULT: ComoFuncionaData = {
  heroTitle: "Reservar tu finca es así de fácil",
  heroSubtitle:
    "En FincasYa.com te acompañamos en cada paso del proceso. Desde la búsqueda hasta el check-out, estamos contigo.",
  heroStats: [
    { label: "Fincas verificadas", value: "+600" },
    { label: "Calificación promedio", value: "4.8" },
    { label: "Huéspedes felices", value: "+40K" },
    { label: "Soporte por WhatsApp", value: "24/7" },
  ],
  guestSectionEyebrow: "Para Huéspedes",
  guestSectionTitle: "Tu experiencia paso a paso",
  guestSectionSubtitle:
    "Reservar con nosotros es sencillo, rápido y seguro. Así funciona:",
  guestSteps: [
    {
      title: "Explora nuestro catálogo",
      channel: "fincasya.com",
      description:
        "Navega por más de 600 fincas verificadas en todo Colombia. Filtra por destino, número de huéspedes, fechas y tipo de propiedad. Cada finca tiene fotos reales, descripción detallada, ubicación en mapa, servicios disponibles y capacidad.",
    },
    {
      title: "Consulta disponibilidad por WhatsApp",
      channel: "WhatsApp",
      description:
        "¿Te gustó una finca? Haz clic en el botón de WhatsApp de la propiedad y escríbenos. Nuestro equipo te confirma disponibilidad en las fechas deseadas, te detalla la tarifa exacta (con impuestos incluidos), condiciones especiales y todo lo que necesitas saber. Atención 24/7.",
    },
    {
      title: "Confirma y realiza tu pago",
      channel: "Transferencia / PSE / Tarjeta",
      description:
        "Una vez validada la disponibilidad, podrás asegurar tu estadía con un anticipo del 50%. Puedes pagar por transferencia bancaria, PSE o tarjeta. Cuando confirmemos el pago, recibirás tu comprobante y te enviaremos el contrato para firma. Para completar el proceso, solo deberás devolverlo firmado con la información y documentación solicitada. Después, te enviaremos la confirmación final de tu reserva con todos los detalles importantes: dirección exacta, cómo llegar, contacto del propietario y normas de la finca.",
    },
    {
      title: "Disfruta tu estadía",
      channel: "Soporte 24/7",
      description:
        "Llega a la finca, realiza tu check-in y disfruta. Durante toda tu estadía, nuestro equipo está disponible por WhatsApp para resolver cualquier duda o incidencia. Si algo no está como esperabas, nos encargamos de solucionarlo.",
    },
    {
      title: "Check-out y devolución de depósito",
      channel: "Automático",
      description:
        "Al finalizar tu estadía, realiza el check-out antes de las 12:00 PM. Si dejaste un depósito de garantía, se devuelve íntegramente en 5 a 10 días hábiles una vez verificado el estado de la propiedad. ¡Así de simple!",
    },
  ],
  ownerSectionEyebrow: "Para Propietarios",
  ownerSectionTitle: "Publica tu finca y empieza a generar ingresos",
  ownerSectionSubtitle:
    "Nos encargamos de todo: publicación, marketing, atención al huésped y gestión de reservas.",
  ownerSteps: [
    {
      title: "Contáctanos",
      description:
        "Escríbenos por WhatsApp o email con los datos de tu propiedad. Nuestro equipo evaluará si cumple los estándares de calidad de FincasYa.",
    },
    {
      title: "Verificación y publicación",
      description:
        "Verificamos tu propiedad (fotos, servicios, ubicación, documentación). Creamos un perfil atractivo con fotografías profesionales y descripción optimizada para atraer huéspedes.",
    },
    {
      title: "Recibe huéspedes",
      description:
        "FincasYa se encarga de la promoción, atención al cliente y gestión de reservas. Tú solo recibe a los huéspedes y cobra. Nosotros nos ocupamos del resto.",
    },
  ],
  benefitsSectionEyebrow: "¿Por qué FincasYa?",
  benefitsSectionTitle: "Ventajas que nos diferencian",
  benefits: [
    {
      icon: "CheckCircle",
      title: "Fincas 100% verificadas",
      description:
        "Visitamos y verificamos cada propiedad antes de publicarla. Fotos reales, descripciones honestas.",
    },
    {
      icon: "Phone",
      title: "Atención 24/7 por WhatsApp",
      description:
        "Nuestro equipo está disponible todo el día, todos los días. Antes, durante y después de tu estadía.",
    },
    {
      icon: "DollarSign",
      title: "Precios transparentes",
      description:
        "Sin cargos ocultos. Te comunicamos la tarifa total desde el primer momento, con impuestos incluidos.",
    },
    {
      icon: "Shield",
      title: "Pagos seguros",
      description:
        "Transferencias bancarias, PSE, tarjetas. Tu dinero está protegido hasta que se confirme tu estadía.",
    },
    {
      icon: "Home",
      title: "+600 propiedades en Colombia",
      description:
        "Fincas, casas campestres, cabañas, glamping y más. En los mejores destinos turísticos del país.",
    },
    {
      icon: "Star",
      title: "4.8 de calificación promedio",
      description:
        "Miles de huéspedes satisfechos nos respaldan. Lee las reseñas de otros viajeros antes de reservar.",
    },
  ],
  faqSectionEyebrow: "Preguntas Frecuentes",
  faqSectionTitle: "Lo que más nos preguntan",
  faqs: [
    {
      question: "¿Necesito crear una cuenta para reservar?",
      answer:
        "No es obligatorio. Puedes explorar todo el catálogo sin registrarte. Las reservas se gestionan directamente por WhatsApp, así que solo necesitas tu número de teléfono.",
    },
    {
      question: "¿Cuánto anticipo debo pagar para confirmar?",
      answer:
        "Generalmente el 50% del valor total de la estadía. En temporada alta, puede ser entre el 50% y el 100%. Te informamos el monto exacto al momento de la consulta.",
    },
    {
      question: "¿Puedo cancelar mi reserva?",
      answer:
        "Sí. Las condiciones dependen del plazo de aviso y la temporada. Con más de 15 días de anticipación en temporada regular puedes obtener reembolso completo.",
    },
    {
      question: "¿Las fotos son reales?",
      answer:
        "Sí. Verificamos cada propiedad antes de publicarla. Las fotos corresponden al estado actual de la finca. Si una propiedad no cumple nuestros estándares, no la publicamos.",
    },
    {
      question: "¿Qué pasa si hay un problema durante mi estadía?",
      answer:
        "Contáctanos inmediatamente por WhatsApp al +57 315 777 3937. Nuestro equipo está disponible 24/7 y se encargará de coordinar con el propietario para resolver cualquier incidencia lo antes posible.",
    },
    {
      question: "¿FincasYa es el dueño de las fincas?",
      answer:
        "No. FincasYa actúa como intermediario entre propietarios y huéspedes. Verificamos las propiedades, gestionamos las reservas y brindamos soporte, pero el contrato de alojamiento es directamente entre tú y el propietario.",
    },
    {
      question: "¿Cómo publico mi finca en FincasYa?",
      answer:
        "Escríbenos por WhatsApp o a info@fincasya.com con los datos de tu propiedad. Evaluamos la finca, tomamos fotos profesionales y la publicamos en nuestra plataforma. No tiene costo inicial: cobramos una comisión por reserva confirmada.",
    },
  ],
  ctaTitle: "¿Listo para tu próxima escapada?",
  ctaSubtitle:
    "Encuentra la finca perfecta para ti y tu familia. Estamos a un mensaje de distancia.",
  ctaPrimaryLabel: "Escríbenos por WhatsApp",
  ctaSecondaryLabel: "Ver todas las fincas",
  ctaSecondaryHref: "/fincas",
  ctaWhatsappUrl:
    "https://wa.me/573157773937?text=Hola%20FincasYa!%20Me%20interesa%20reservar%20una%20finca",
};
