'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  CheckCircle,
  Phone,
  DollarSign,
  Shield,
  Home,
  Star,
  ChevronDown,
} from 'lucide-react';
import { COMO_FUNCIONA_DEFAULT } from '@/features/admin/constants/como-funciona.constants';
import type { ComoFuncionaData } from '@/features/admin/types/como-funciona.types';
import {
  PublicBlackHero,
  PublicMarketingShell,
  fadeInUp,
} from '@/features/site-pages/components/PublicMarketingShell';
import { useInternalPageContent } from '@/features/site-pages/hooks/use-internal-page';

const iconMap: Record<string, React.ElementType> = {
  CheckCircle,
  Phone,
  DollarSign,
  Shield,
  Home,
  Star,
};

export function ComoFuncionaPublicPage() {
  const { data, loading } = useInternalPageContent<ComoFuncionaData>(
    'como-funciona',
    COMO_FUNCIONA_DEFAULT,
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  if (loading) {
    return <PublicMarketingShell loading />;
  }

  const content = data;
  if (!content) {
    return <PublicMarketingShell unavailable />;
  }

  return (
    <PublicMarketingShell>
      <PublicBlackHero
        title={content.heroTitle}
        subtitle={content.heroSubtitle}
        stats={content.heroStats}
      />

      <section className="py-16">
        <div className="container mx-auto max-w-3xl px-6">
          <motion.div {...fadeInUp} className="mb-12 text-center">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
              {content.guestSectionEyebrow}
            </span>
            <h2 className="mb-2 text-2xl font-extrabold md:text-3xl">
              {content.guestSectionTitle}
            </h2>
            <p className="text-muted-foreground">{content.guestSectionSubtitle}</p>
          </motion.div>

          <div className="relative flex flex-col gap-0">
            {content.guestSteps.map((step, i) => (
              <motion.div
                key={step.title}
                {...fadeInUp}
                transition={{ delay: i * 0.1 }}
                className="relative flex gap-5 pb-8 last:pb-0"
              >
                <div className="flex shrink-0 flex-col items-center">
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-white">
                    {i + 1}
                  </div>
                  {i < content.guestSteps.length - 1 ? (
                    <div className="w-0.5 grow bg-primary/20" />
                  ) : null}
                </div>
                <div className="flex-1 rounded-xl border-l-4 border-primary bg-secondary/50 p-5">
                  <h3 className="mb-1 text-lg font-bold">{step.title}</h3>
                  {step.channel ? (
                    <span className="mb-2 inline-block rounded-full bg-green-100 px-3 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {step.channel}
                    </span>
                  ) : null}
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-secondary/30 py-16">
        <div className="container mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp} className="mb-12 text-center">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
              {content.ownerSectionEyebrow}
            </span>
            <h2 className="mb-2 text-2xl font-extrabold md:text-3xl">
              {content.ownerSectionTitle}
            </h2>
            <p className="text-muted-foreground">{content.ownerSectionSubtitle}</p>
          </motion.div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {content.ownerSteps.map((step, i) => (
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
        <div className="container mx-auto max-w-4xl px-6">
          <motion.div {...fadeInUp} className="mb-12 text-center">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
              {content.benefitsSectionEyebrow}
            </span>
            <h2 className="text-2xl font-extrabold md:text-3xl">
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
        <div className="container mx-auto max-w-2xl px-6">
          <motion.div {...fadeInUp} className="mb-12 text-center">
            <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-primary">
              {content.faqSectionEyebrow}
            </span>
            <h2 className="text-2xl font-extrabold md:text-3xl">{content.faqSectionTitle}</h2>
          </motion.div>
          <div className="divide-y space-y-0">
            {content.faqs.map((faq, i) => (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between py-5 text-left text-base font-semibold transition-colors hover:text-primary"
                >
                  {faq.question}
                  <ChevronDown
                    className={`ml-3 h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaq === i ? 'max-h-60 pb-5' : 'max-h-0'
                  }`}
                >
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
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
                {content.ctaPrimaryLabel}
              </a>
              <Link
                href={content.ctaSecondaryHref}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-white/50 px-6 py-3 font-bold text-white transition-colors hover:border-white"
              >
                {content.ctaSecondaryLabel}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicMarketingShell>
  );
}
