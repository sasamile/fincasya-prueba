export type SocialQuickReply = {
  id: string;
  label: string;
  text: string;
};

export const SOCIAL_QUICK_REPLIES: SocialQuickReply[] = [
  {
    id: 'catalogo-whatsapp',
    label: 'Catálogo + WhatsApp',
    text: 'Hola, muchas gracias por comentar. Te compartimos el catálogo de la casa y si le das click allí también recibirás atención personalizada https://wa.me/573157773937',
  },
  {
    id: 'fechas-personas',
    label: 'Pedir fechas y personas',
    text: 'Hola, con gusto te ayudamos. ¿Para qué fechas y cuántas personas necesitas la finca?',
  },
  {
    id: 'precio-grupo',
    label: 'Precio según grupo',
    text: 'Hola, el valor depende de las fechas y el número de personas. Cuéntanos cuántos van y para qué días para cotizarte bien.',
  },
  {
    id: 'gracias',
    label: 'Agradecimiento',
    text: '¡Muchas gracias por tu comentario! Nos encanta saber de ti. Cualquier cosa, escríbenos por WhatsApp https://wa.me/573157773937',
  },
];
