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

export default crons;
