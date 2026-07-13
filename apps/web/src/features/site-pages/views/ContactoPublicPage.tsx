'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  MessageCircle,
} from 'lucide-react';
import { CONTACTO_DEFAULT } from '@/features/admin/constants/paginas-internas.constants';
import {
  PublicBlackHero,
  PublicMarketingShell,
  fadeInUp,
} from '@/features/site-pages/components/PublicMarketingShell';
import { useInternalPageContent } from '@/features/site-pages/hooks/use-internal-page';

type ContactData = typeof CONTACTO_DEFAULT;

export function ContactoPublicPage() {
  const { data, loading } = useInternalPageContent<ContactData>('contacto', CONTACTO_DEFAULT);
  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    telefono: '',
    asunto: '',
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
      <PublicBlackHero title={content.heroTitle} subtitle={content.heroSubtitle} />

      <section className="py-16">
        <div className="container mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <motion.div {...fadeInUp}>
              <div className="mb-6">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
                  Formulario
                </span>
                <h2 className="text-2xl font-extrabold md:text-3xl">{content.formTitle}</h2>
                <p className="text-muted-foreground">{content.formSubtitle}</p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {content.formFields.nombre}
                    </label>
                    <input
                      type="text"
                      name="nombre"
                      required
                      value={formData.nombre}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {content.formFields.correo}
                    </label>
                    <input
                      type="email"
                      name="correo"
                      required
                      value={formData.correo}
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
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {content.formFields.asunto}
                    </label>
                    <select
                      name="asunto"
                      required
                      value={formData.asunto}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Selecciona un asunto</option>
                      {content.asuntoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      {content.formFields.mensaje}
                    </label>
                    <textarea
                      name="mensaje"
                      required
                      value={formData.mensaje}
                      onChange={handleChange}
                      rows={5}
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
                  <p className="text-center text-xs text-muted-foreground">{content.formNote}</p>
                </form>
              </div>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ delay: 0.2 }}>
              <div className="mb-6">
                <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
                  Canales
                </span>
                <h2 className="text-2xl font-extrabold md:text-3xl">{content.infoTitle}</h2>
              </div>
              <div className="space-y-6">
                <div className="rounded-xl border bg-card p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <a
                          href={`mailto:${content.info.email}`}
                          className="font-medium hover:text-primary"
                        >
                          {content.info.email}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Phone className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Teléfono / WhatsApp</p>
                        <a href={content.ctaWhatsappUrl} className="font-medium hover:text-primary">
                          {content.info.phone}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Dirección</p>
                        <p className="font-medium">{content.info.address}</p>
                        <p className="text-xs font-medium text-primary/80">{content.info.note}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Horario</p>
                        <p className="whitespace-pre-line font-medium">{content.info.schedule}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <a
                  href={content.ctaWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 rounded-xl bg-primary p-4 text-white transition-all hover:bg-primary/90 hover:shadow-lg"
                >
                  <MessageCircle className="h-6 w-6" />
                  <span className="font-bold">Chatea con nosotros</span>
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-linear-to-br from-primary to-orange-700 py-16 text-center text-white">
        <div className="container mx-auto px-6">
          <motion.div {...fadeInUp}>
            <h2 className="mb-3 text-2xl font-extrabold md:text-3xl">{content.ctaTitle}</h2>
            <p className="mx-auto mb-8 max-w-md text-white/90">{content.ctaSubtitle}</p>
            <a
              href={content.ctaWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-bold text-orange-600 transition-transform hover:scale-105"
            >
              <MessageCircle className="h-5 w-5" />
              Ir a WhatsApp
            </a>
          </motion.div>
        </div>
      </section>
    </PublicMarketingShell>
  );
}
