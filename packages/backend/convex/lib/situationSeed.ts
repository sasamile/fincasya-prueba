/**
 * Mensajes SITUACIONALES del equipo (portados del bot anterior y de
 * conversaciones reales). Entran al RAG como CONTEXTO: la IA imita el tono
 * y respeta los DATOS exactos (50%, RNT, minimos de noches), pero redacta
 * natural segun el hilo — regla de Santiago: no pegar plantillas tal cual.
 */

import { HORARIOS_OFICIALES } from './copys';

export const SITUATION_SEED: Array<{
  key: string;
  situation: string;
  clientExamples: string[];
  response: string;
}> = [
  {
    key: 'sit:horarios-atencion',
    situation:
      'El cliente pregunta por los horarios de atencion. Se responde con el horario oficial EXACTO (nunca inventar horas).',
    clientExamples: [
      'Cuales son sus horarios de atencion?',
      'Hasta que hora atienden?',
      'Atienden los domingos?',
      'A que hora abren mañana?',
    ],
    response: `¡Con gusto! Te comparto nuestros horarios de atención:

${HORARIOS_OFICIALES}

Si nos escribes fuera de ese horario, tu mensaje queda recibido y te respondemos tan pronto regresemos 🙌`,
  },
  {
    key: 'sit:mascotas-respuesta',
    situation:
      'El cliente pregunta si puede llevar mascotas o confirma que lleva una. Se responde con la politica oficial de mascotas (bienvenidas en la mayoria + recomendaciones + cargos) y se pregunta cuantas van.',
    clientExamples: [
      'Puedo llevar mascotas?',
      'Aceptan perros?',
      'Voy a llevar una mascota',
      'Llevamos un perrito pequeño',
      'Se puede con gatos?',
    ],
    response: `✨🐶 Tus mascotas son bienvenidas en la mayoría de nuestras propiedades. Para garantizar una excelente estancia, ten en cuenta las siguientes condiciones: 🐾

💰 Depósito: Se requiere un depósito reembolsable de $100.000 por cada mascota

✅ Tarifas adicionales: A partir de la tercera (3ra) mascota, se cobrará una tarifa de ingreso de $30.000 por cada una

🧹 Limpieza adicional: Si viajas con 3 o más mascotas, aplica un cargo único de aseo de $70.000.

📌 Recomendaciones importantes:
🚫 No ingresar las mascotas a la piscina.
🐾 Evitar orina o pelaje en zonas interiores.
🛋️ No subirlas a muebles ni camas.
🦴 Cuidar que no muerdan implementos de la casa.
💩 Recoger sus necesidades constantemente.

❗Recuerda: El incumplimiento de estas normas puede generar descuentos en el depósito de garantía. ¡Gracias por cuidar la propiedad mientras disfrutas con tus peluditos! 💚

Cuéntanos por favor cuántas mascotas llevas y de qué tamaño, para validar la finca ideal 🤝`,
  },
  {
    key: 'qr:servicio-limpieza',
    situation:
      'El cliente pregunta si puede contratar servicio de limpieza/cocina/personal de apoyo, o si viene incluido en el arriendo. OJO: esto NO es el auxilio/deposito de aseo del contrato (ese es un cargo general aparte) — no mezclarlos. FincasYa solo hace el CONTACTO con la persona; el pago y condiciones se acuerdan directamente con ella.',
    clientExamples: [
      'Puedo contratar servicio de limpieza o viene incluido en el valor del arriendo?',
      'La finca incluye alguien que haga el aseo?',
      'Tienen cocinera o empleada?',
      'Puedo llevar a alguien que nos cocine?',
    ],
    response: `Podemos recomendarte personal de apoyo para tu estadía (cocina y aseo) 🤝

💰 Costo: Desde $100.000 por día, variando según la temporada.
🤝 Acuerdo: El pago y las condiciones se coordinan directamente con la persona asignada.
✅ Recomendación: Sugerimos 2 personas para grupos mayores a 15 integrantes.
En algunas propiedades, la contratación del servicio es obligatoria para garantizar el cuidado del inmueble.

Si deseas, al avanzar con tu reserva te contactamos con las personas adecuadas que brindan el servicio 😊`,
  },
  {
    key: 'qr:checkin',
    situation:
      'El cliente pregunta por la hora de entrada (check-in) o de salida (check-out) de las fincas.',
    clientExamples: [
      'A que hora es el check in?',
      'Hasta que hora podemos quedarnos?',
      'A que hora entregan la finca?',
      'A que hora hay que salir?',
    ],
    response: `Pensando en tu comodidad, manejamos horarios bastante amplios para que aproveches al máximo tu viaje:
🔓 Check-in (Entrada): 10:00 AM.
🔒 Check-out (Salida): 04:00 PM`,
  },
  {
    key: 'qr:noches-minimas',
    situation:
      'El cliente pregunta cuantas noches minimo debe reservar, o sus fechas no cumplen el minimo de la temporada.',
    clientExamples: [
      'Cuantas noches minimo?',
      'Puedo reservar una sola noche?',
      'Hay minimo de noches para el puente?',
    ],
    response: `Para garantizar tu reserva, ten en cuenta el tiempo mínimo de estadía según la fecha:
🏡 Fines de semana (sin festivo): Mínimo 1 noche.
📅 Fines de semana (con puente): Mínimo 2 noches.
🤴 Reyes: Mínimo 3 noches.
⛪ Semana Santa: Mínimo 3 a 4 noches.
🎅 Navidad: Mínimo 4 noches.
🎄 Fin de Año: Mínimo 6 a 7 noches.`,
  },
  {
    key: 'qr:fdaa-ciclos',
    situation:
      'El cliente quiere reservar fin de año: se le comparten los ciclos de reserva disponibles (maximo 7 dias).',
    clientExamples: [
      'Quiero finca para fin de año',
      'Del 30 de diciembre al 2 de enero',
      'Disponibilidad para año nuevo',
    ],
    response: `Contamos con los siguientes ciclos de reserva 🏡:
🗓️ 28 de dic al 03 de ene
🗓️ 29 de dic al 04 de ene
🗓️ 30 de dic al 05 de ene
¡Asegura tu fecha con anticipación! ✨`,
  },
  {
    key: 'qr:celebracion',
    situation:
      'El cliente menciona que es un evento, fiesta o celebracion: se pregunta la logistica antes de filtrar fincas.',
    clientExamples: [
      'Es para una fiesta de cumpleaños',
      'Queremos hacer un evento',
      'Es una reunion empresarial con musica',
    ],
    response: `🪅 Detalles de tu evento
Por favor, cuéntanos si tienes contemplado ingresar:
🎧 Sonido profesional, iluminación o DJ.
🎸 Grupos musicales o presentaciones en vivo.
🏡 ¿O prefieres departir solo con el sonido básico de la finca?
Esta información es clave para verificar la disponibilidad según las normas de cada propiedad.`,
  },
  {
    key: 'qr:sector-no-disponible',
    situation:
      'No hay fincas disponibles en el sector/municipio que pidio el cliente: se ofrece zonas cercanas.',
    clientExamples: [
      'No tienen nada en ese pueblo?',
      'Busco finca en un municipio donde no hay inventario',
    ],
    response: `Hola, gusto saludarte. Desafortunadamente, para el sector solicitado no contamos con disponibilidad en este momento🏡
✅ Si gustas, podemos enviarte opciones increíbles en zonas cercanas para tus fechas`,
  },
  {
    key: 'qr:sectores-disponibles',
    situation: 'El cliente pregunta en que zonas/municipios hay fincas disponibles.',
    clientExamples: [
      'En que zonas tienen fincas?',
      'Que municipios manejan?',
      'Donde tienen propiedades?',
    ],
    response: `Te podemos brindar disponibilidad en los siguientes sectores:
✅ ANAPOIMA
✅ TOCAIMA
✅ VIOTÁ
✅ VILLETA
✅ LA MESA
✅ NILO CUNDINAMARCA
✅ FLANDES
✅ GIRARDOT
✅ CARTAGENA
✅ SANTA MARTA
✅ VILLAVICENCIO - RESTREPO META Y ACACÍAS META
✅ MELGAR
✅ CARMEN DE APICALÁ`,
  },
  {
    key: 'qr:visita-garantia',
    situation:
      'El cliente desconfia, pregunta si puede visitar la finca antes de reservar, o pide la ubicacion exacta.',
    clientExamples: [
      'Puedo ir a conocer la finca antes?',
      'Como se que no es estafa?',
      'Me pasas la ubicacion exacta?',
    ],
    response: `📲 Para tu total tranquilidad, cuentas con nuestra Garantía de Satisfacción:
📅 Visita de verificación: Puedes agendarla de martes a jueves (9:00 a.m. a 4:00 p.m.) una vez realices tu reserva.
💸 Reembolso inmediato: Si al visitar la finca notas que no corresponde al video y fotos enviadas, te devolvemos el valor de tu reserva de inmediato. ✅
📍 Por seguridad de nuestros propietarios y huéspedes, la ubicación exacta se comparte únicamente al confirmar la reserva. Con gusto te enviamos una ubicación aproximada para calcular tiempos de viaje 🚗💨
🔍 Puedes ver las opiniones reales de clientes en Google — más de 10 años de trayectoria ⭐`,
  },
  {
    key: 'qr:chat-center',
    situation:
      'El cliente pide una llamada o pregunta por que solo lo atienden por chat.',
    clientExamples: [
      'Me pueden llamar?',
      'Tienen numero para llamar?',
      'Prefiero hablar por telefono',
    ],
    response: `¡Hola! Un gusto saludarte. Para brindarte un mejor servicio, te atendemos por este medio ya que, al ser un chat center, debemos dejar constancia de todos los detalles de tu reserva 🤝.
Si te resulta más cómodo, puedes enviarnos audios y con gusto te responderemos de la misma forma 😊`,
  },
  {
    key: 'qr:anticipacion',
    situation:
      'El cliente dice que va a pensarlo o que decide despues: recordarle que la disponibilidad cambia rapido.',
    clientExamples: [
      'Dejame lo consulto con mi familia',
      'Yo te aviso mas tarde',
      'Lo voy a pensar',
    ],
    response: `⚡ ¡Asegura tu lugar!
Nuestra disponibilidad se actualiza en tiempo real, por lo que te recomendamos reservar lo antes posible; los cupos suelen cambiar constantemente. ⏳🏠
¡No dudes en reservar cuando estés listo! Quedamos atentos a cualquier duda o inquietud que tengas. 😊🤝`,
  },
  {
    key: 'qr:finca-puntual-sin-fechas',
    situation:
      'El cliente pregunta por una finca especifica (de un anuncio/redes) pero aun no da fechas ni numero de personas.',
    clientExamples: [
      'Vi esta finca en Instagram, cuanto vale?',
      'Info de esta propiedad por favor',
      'Me interesa esta casa que publicaron',
    ],
    response: `¡Gracias por escribir! Esta propiedad es una de las joyas de nuestro portafolio, perfecta para grupos que buscan comodidad y privacidad.
Para darte el presupuesto exacto, por favor confírmanos:
📅 Fechas: Entrada y salida.
👥 Personas: Cantidad total de asistentes.
A la mayor brevedad te compartiremos la información detallada de esta casa y otras opciones similares. 😊🚀`,
  },
  {
    key: 'sit:finca-dudas',
    situation:
      'El cliente señala una finca del catalogo pero tiene dudas o preguntas antes de decidir (precio, disponibilidad, comodidades, capacidad, mascotas, que incluye).',
    clientExamples: [
      'La segunda tiene piscina?',
      'Cuanto sale exactamente esa finca?',
      'Esta disponible del 8 al 10?',
      'Me gusta la de Melgar pero cuantas personas caben?',
      'Que incluye esa propiedad?',
    ],
    response: `Responde la duda con la informacion que tengas (buscar_fincas o consultar_disponibilidad). Si el dato no esta confirmado, dilo con honestidad — no inventes. NO escales ni confirmes reserva en este turno: primero resuelve la duda. Al cerrar, invita a decir si esa finca le sirve para avanzar 🤝`,
  },
  {
    key: 'sit:finca-elegida',
    situation:
      'El cliente confirmo que quiere una finca del catalogo (sin dudas pendientes). Se confirma su interes y se escala a un experto humano.',
    clientExamples: [
      'Me gusto esta finca',
      'Quiero reservar la segunda opcion',
      'Esa me sirve, sigamos',
      'Quiero separar esa finca',
    ],
    response: `¡Excelente elección! Nos alegra saber que esta propiedad es de tu interés. En breve, uno de nuestros expertos se comunicará contigo para brindarte toda la información, resolver tus dudas y ayudarte a gestionar el mejor precio posible para tu reserva. ¡Gracias por confiar en nosotros!`,
  },
  {
    key: 'sit:contrato-datos',
    situation:
      'El cliente pregunta que se requiere para el alquiler o como separar, pero aun no ha confirmado finca o disponibilidad. El bot NO envia el proceso de contrato.',
    clientExamples: [
      'Que se requiere para el alquiler?',
      'Como seria la separacion y demas',
      'Cual es el paso a seguir?',
    ],
    response: `Cuando confirmes la finca de tu interés, uno de nuestros expertos verificará la disponibilidad para tus fechas y te guiará en los pasos para separarla 🤝 Somos FincasYa.com, con RNT 163658 verificable — tu reserva siempre es segura y respaldada.`,
  },
  {
    key: 'sit:contrato-pago',
    situation:
      'El cliente ya decidio reservar y envia o pide datos de pago o contrato. Se escala a humano.',
    clientExamples: [
      'Mañana se realiza el giro del 50% por Nequi',
      'Me regalas el numero de cuenta para hacer el pago',
      'Te envio mis datos para el contrato',
    ],
    response: `Perfecto, en un momento un Experto de nuestro equipo se comunica contigo para confirmar disponibilidad y los siguientes pasos ✅`,
  },
  {
    key: 'sit:temporada-especial',
    situation:
      'El cliente pide fechas de Navidad, fin de año o puente de Reyes. Hay condiciones especiales y estancia minima de noches en esas temporadas.',
    clientExamples: [
      'Necesito finca del 30 de diciembre al 3 de enero',
      'Tienen algo para navidad?',
      'Para el 31 de diciembre una noche',
      'Finca para recibir el año nuevo',
    ],
    response: `Hola, gusto saludarte 👋🏻

Por favor ten presente que en temporadas especiales como *Fin de año*, *Navidad* y *puente de Reyes*, los costos y condiciones de alquiler son distintos ☝️🎄

🏡 Las propiedades tienen una *estancia mínima de noches*, que varía según la fecha:

🎅 Navidad: Mínimo 4 noches.
🎄 Fin de Año: Mínimo 6 a 7 noches (máximo 7).
🤴 Reyes: Mínimo 3 noches.

Si tus fechas cumplen el mínimo, con gusto te compartimos las opciones disponibles; si no, ajustemos las fechas y seguimos 🙌`,
  },
  {
    key: 'sit:pre-catalogo',
    situation:
      'Ya se tienen los datos del cliente y se le van a enviar (o se acaban de enviar) las fichas del catalogo con las opciones para sus fechas.',
    clientExamples: [
      'Listo, esas son mis fechas, que opciones hay?',
      'Somos 12 personas para Melgar del 8 al 10',
      'Me muestras las fincas disponibles?',
    ],
    response: `Con gusto en atenderte 🙋

A continuación, te comparto las opciones disponibles para tus fechas 📅 Si alguna de estas propiedades te gusta, dímelo y te ayudaré a gestionar el mejor precio posible 🤝`,
  },
  {
    key: 'sit:post-catalogo-cierre',
    situation:
      'Se acaban de enviar las fichas del catalogo; mensaje de cierre invitando a elegir o pedir mas detalle.',
    clientExamples: [
      'Ya vi las opciones',
      'Dejame revisar lo que me enviaste',
    ],
    response: `Estas son nuestras mejores opciones disponibles para ti! 🤩🏡
El valor que muestra cada finca es por noche y varía según la temporada.
Si alguna te llama la atención, indícanos cuál es la de tu interés y te ayudamos a gestionar el mejor precio 🤝
¡Listos para ayudarte a elegir el lugar perfecto para tu estadía! ✨`,
  },
  {
    key: 'sit:transicion-momento',
    situation:
      'El cliente pide informacion de una finca puntual o mas opciones y se necesita un momento para prepararlas. Transicion corta antes de enviar el material.',
    clientExamples: [
      'Tienes disponible esta casa del 14 al 17?',
      'Me pasas mas fotos de esa finca',
      'Tienes mas opciones un poco mas economicas?',
    ],
    response:
      'Claro que sí! Permítenos un momento, te compartimos más información sobre la opción de tu interés 🤩✅',
  },
];
