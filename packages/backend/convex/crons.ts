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

export default crons;
