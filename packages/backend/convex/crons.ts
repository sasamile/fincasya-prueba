import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// 07:30 UTC = 02:30 en Colombia: cura las conversaciones nuevas del dia
// (ventas y cierres positivos entran solos al RAG) y calcula embeddings.
crons.daily(
  'curacion nocturna del historico',
  { hourUTC: 7, minuteUTC: 30 },
  internal.curation.nightly,
  {},
);

// Cada hora: el motor filtra por la hora configurada en Automatizaciones
// (America/Bogota). Así el admin puede elegir 8:00, 9:00, 10:00, etc.
crons.interval(
  'mensajeria programada check-in',
  { hours: 1 },
  internal.checkinMessaging.runDailyScheduledMoments,
  {},
);

// Cada hora: los eventos externos del Google Calendar con match de finca
// confiable (alta/media) se convierten SOLOS en bloqueos → el bot deja de
// ofrecer esas fincas sin esperar la revisión del operador. Los dudosos
// (confianza baja/ambiguos) siguen entrando solo por la pantalla de revisión.
crons.interval(
  'auto-import bloqueos Google Calendar',
  { hours: 1 },
  internal.googleCalendar.autoImportHighConfidence,
  {},
);

export default crons;
