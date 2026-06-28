"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface HomePageProps {
  params: { locale: string };
}

export default function HomePage({ params }: HomePageProps) {
  const t = useTranslations("home");
  const tNav = useTranslations("nav");
  const { locale } = params;

  return (
    <div className="min-h-screen bg-white">
      <Header locale={locale} />

      {/* Hero Section */}
      <section className="min-h-screen bg-gradient-to-br from-kazi-navy via-kazi-navy2 to-blue-950 flex items-center justify-center text-center px-5 pt-20 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(244,121,32,0.08)_0%,transparent_70%)]" />
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-block bg-kazi-orange/15 border border-kazi-orange/35 text-kazi-orange text-xs font-semibold tracking-widest uppercase px-4 py-1 rounded-full mb-8">
            {t("hero.badge")}
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 leading-tight">
            The AI Growth Engine<br />
            for the <span className="text-kazi-orange">Next Billion</span>
          </h1>
          <p className="text-lg text-white/70 max-w-xl mx-auto mb-10">
            {t("hero.subtitle")}
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href={`/${locale}/chat`}>
              <Button size="lg" className="text-base px-8 shadow-lg shadow-kazi-orange/25">
                💬 {t("hero.ctaChat")}
              </Button>
            </Link>
            <Link href={`/${locale}/chat`}>
              <Button variant="outline" size="lg" className="text-base px-8 text-white border-white/25 hover:border-kazi-orange hover:text-kazi-orange">
                Explore the Platform
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Market Stats */}
      <section className="py-24 px-5 bg-gray-50">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-kazi-orange mb-3">
            {t("market.label")}
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-kazi-navy mb-4">
            {t("market.title")}
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto mb-12">
            {t("market.subtitle")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { num: "4.8B+", label: t("market.population") },
              { num: "$10T+", label: t("market.economy") },
              { num: "85%", label: t("market.youth") },
              { num: "$19.2B", label: t("market.ecommerce") },
              { num: "28%", label: t("market.cagr") },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="text-3xl font-extrabold bg-gradient-to-r from-kazi-orange to-green-500 bg-clip-text text-transparent mb-2">
                  {stat.num}
                </div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="py-24 px-5">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-kazi-orange mb-3">
            {t("partners.label")}
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-kazi-navy mb-4">
            {t("partners.title")}
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto mb-12">
            {t("partners.subtitle")}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Career Partner */}
            <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-100 hover:shadow-xl hover:-translate-y-2 transition-all">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-orange-100 flex items-center justify-center text-2xl mb-5">
                  💼
                </div>
                <h3 className="text-xl font-bold text-kazi-navy mb-3">
                  {t("partners.career.title")}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                  {t("partners.career.desc")}
                </p>
                <span className="inline-block text-xs font-bold uppercase tracking-wide text-kazi-orange bg-orange-100 px-3 py-1 rounded-full">
                  {t("partners.career.tags")}
                </span>
              </CardContent>
            </Card>
            {/* Learning Partner */}
            <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 hover:shadow-xl hover:-translate-y-2 transition-all">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-2xl mb-5">
                  📚
                </div>
                <h3 className="text-xl font-bold text-kazi-navy mb-3">
                  {t("partners.learning.title")}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                  {t("partners.learning.desc")}
                </p>
                <span className="inline-block text-xs font-bold uppercase tracking-wide text-green-600 bg-green-100 px-3 py-1 rounded-full">
                  {t("partners.learning.tags")}
                </span>
              </CardContent>
            </Card>
            {/* Life Partner */}
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 hover:shadow-xl hover:-translate-y-2 transition-all">
              <CardContent className="p-8">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl mb-5">
                  🤝
                </div>
                <h3 className="text-xl font-bold text-kazi-navy mb-3">
                  {t("partners.life.title")}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">
                  {t("partners.life.desc")}
                </p>
                <span className="inline-block text-xs font-bold uppercase tracking-wide text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                  {t("partners.life.tags")}
                </span>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Trio */}
      <section className="py-24 px-5 bg-kazi-navy">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-kazi-orange mb-3">
            {t("trio.label")}
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            {t("trio.title")}
          </h2>
          <p className="text-white/55 max-w-xl mx-auto mb-12">
            {t("trio.subtitle")}
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Ali */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-8 hover:bg-white/8 transition-colors">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-kazi-orange to-amber-500 flex items-center justify-center text-2xl mb-5 mx-auto">
                🔍
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{t("trio.ali.name")}</h3>
              <p className="text-xs font-semibold uppercase tracking-wide text-kazi-orange mb-4">
                {t("trio.ali.role")}
              </p>
              <p className="text-sm text-white/55 leading-relaxed">
                {t("trio.ali.desc")}
              </p>
            </div>
            {/* Max */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-8 hover:bg-white/8 transition-colors">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-800 flex items-center justify-center text-2xl mb-5 mx-auto">
                ⚡
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{t("trio.max.name")}</h3>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-400 mb-4">
                {t("trio.max.role")}
              </p>
              <p className="text-sm text-white/55 leading-relaxed">
                {t("trio.max.desc")}
              </p>
            </div>
            {/* Aida */}
            <div className="bg-white/4 border border-white/8 rounded-2xl p-8 hover:bg-white/8 transition-colors">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-2xl mb-5 mx-auto">
                🌐
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{t("trio.aida.name")}</h3>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400 mb-4">
                {t("trio.aida.role")}
              </p>
              <p className="text-sm text-white/55 leading-relaxed">
                {t("trio.aida.desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 py-8 px-5 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-2xl font-bold text-white/70">
            <span className="text-kazi-orange">Kazi</span>Space
          </div>
          <p className="text-sm text-white/30">
            © 2026 KaziSpace. All rights reserved. · Empowering the Next Billion.
          </p>
        </div>
      </footer>

      <BottomNav locale={locale} />
    </div>
  );
}
