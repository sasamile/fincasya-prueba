'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  CheckCircle,
  Megaphone,
  Headphones,
  Shield,
  Send,
  MessageCircle,
} from 'lucide-react';
import { VINCULATE_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';
import {
  PublicBlackHero,
  PublicMarketingShell,
  fadeInUp,
} from '@/features/site-pages/components/PublicMarketingShell';
import { useInternalPageContent } from '@/features/site-pages/hooks/use-internal-page';

type VinculateData = typeof VINCULATE_DEFAULT;

const iconMap: Record<string, React.ElementType> = {
  CheckCircle,
  Megaphone,
  Headphones,
  Shield,
};

export function VinculatePublicPage() {
  const { data, loading } = useInternalPageContent<VinculateData>(
    'vinculate',
    VINCULATE_DEFAULT,
  );
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    correo: '',
    ubicacion: '',
    tipoPropiedad: '',
    mensaje: '',
  });

  if (loading) return <PublicMarketingShell loading />;
  const content = data;
  if (!content) return <PublicMarketingShell unavailable />;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    window.open(content.ctaWhatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <PublicMarketingShell>
      <PublicBlackHero
        title={content.heroTitle}
        subtitle={content.heroSubtitle}
        stats={content.stats}
      />

      <section className="py-16">
        <div className="container mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp} className="mb-12 text-center">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
              ¿Por qué FincasYa?
            </span>
            <h2 className="mb-2 text-2xl font-extrabold md:text-3xl">
              {content.benefitsSectionTitle}
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {content.benefits.map((benefit, i) => {
              const IconComponent = iconMap[benefit.icon] || CheckCircle;
              return (
                <motion.div
                  key={benefit.title}
                  {...fadeInUp}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-4 rounded-xl border bg-card p-5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="mb-1 font-bold">{benefit.title}</h4>
                    <p className="text-sm text-muted-foreground">{benefit.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-secondary/30 py-16">
        <div className="container mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp} className="mb-12 text-center">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
              Proceso
            </span>
            <h2 className="mb-2 text-2xl font-extrabold md:text-3xl">
              {content.stepsSectionTitle}
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {content.steps.map((step, i) => (
              <motion.div
                key={step.title}
                {...fadeInUp}
                transition={{ delay: i * 0.15 }}
                className="rounded-2xl border bg-card p-6 text-center shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-xl font-extrabold text-primary">
                  {i + 1}
                </div>
                <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto max-w-2xl px-6">
          <motion.div {...fadeInUp} className="mb-12 text-center">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
              Contacto
            </span>
            <h2 className="mb-2 text-2xl font-extrabold md:text-3xl">{content.formTitle}</h2>
            <p className="text-muted-foreground">{content.formSubtitle}</p>
          </motion.div>
          <motion.div {...fadeInUp} className="rounded-xl border bg-card p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {content.formFields.nombre}
                  </label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {content.formFields.telefono}
                  </label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {content.formFields.correo}
                  </label>
                  <input
                    type="email"
                    name="correo"
                    value={formData.correo}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    {content.formFields.ubicacion}
                  </label>
                  <input
                    type="text"
                    name="ubicacion"
                    value={formData.ubicacion}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {content.formFields.tipoPropiedad}
                </label>
                <select
                  name="tipoPropiedad"
                  value={formData.tipoPropiedad}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Selecciona el tipo</option>
                  <option value="finca">Finca</option>
                  <option value="casa_campestre">Casa Campestre</option>
                  <option value="villa">Villa</option>
                  <option value="hacienda">Hacienda</option>
                  <option value="glamping">Glamping</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {content.formFields.mensaje}
                </label>
                <textarea
                  name="mensaje"
                  value={formData.mensaje}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-white transition-all hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
                {content.formSubmit}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                {content.formNote}{' '}
                <a
                  href={content.ctaWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Escríbenos por WhatsApp
                </a>
              </p>
            </form>
          </motion.div>
        </div>
      </section>

      <section className="bg-linear-to-br from-primary to-orange-700 py-16 text-center text-white">
        <div className="container mx-auto px-6">
          <motion.div {...fadeInUp}>
            <h2 className="mb-3 text-2xl font-extrabold md:text-3xl">{content.ctaTitle}</h2>
            <p className="mx-auto mb-8 max-w-md text-white/90">{content.ctaSubtitle}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href={content.ctaWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-bold text-orange-600 transition-transform hover:scale-105"
              >
                <MessageCircle className="h-5 w-5" />
                Escríbenos por WhatsApp
              </a>
              <Link
                href="/como-funciona"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-white/50 px-6 py-3 font-bold text-white transition-colors hover:border-white"
              >
                Ver cómo funciona
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicMarketingShell>
  );
}
