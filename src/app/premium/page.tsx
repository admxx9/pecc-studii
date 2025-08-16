
'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ArrowLeft, X, Gift, Loader2, Star, BrainCircuit, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';

const plans = [
  {
    id: 'basic',
    name: 'Básico',
    price: 9.99,
    period: '/mês',
    features: [
        { text: 'Acesso a aulas premium', included: true },
        { text: 'Suporte básico', included: true },
        { text: 'Download de ferramentas essenciais', included: false }
    ],
    cta: 'Obter Acesso',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29.00,
    period: '/mês',
    features: [
        { text: 'Acesso a todas as aulas (Premium)', included: true },
        { text: 'Suporte prioritário via ticket', included: true },
        { text: 'Acesso a ferramentas exclusivas', included: true },
        { text: 'Acesso a mapas prontos', included: true },
        { text: 'Acesso ao Launcher exclusivo', included: true },
    ],
    highlight: true,
    cta: 'Obter Acesso',
  },
];

export default function PremiumPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
       <header className="bg-card px-4 md:px-6 py-3 flex items-center justify-between shadow-md h-[var(--header-height)] sticky top-0 z-30">
        <Button variant="outline" onClick={() => router.push('/')} className="text-sm">
          <ArrowLeft className="mr-2 h-4 w-4"/>
          Voltar para Home
        </Button>
        <h1 className="text-xl font-bold text-primary font-[Orbitron,sans-serif]">
          Planos Premium
        </h1>
        <div></div>
      </header>

      <main className="flex-1 container mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Desbloqueie Acesso Exclusivo
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Assine um dos nossos planos para ter acesso a aulas, ferramentas e suporte prioritário para acelerar seu desenvolvimento.
              </p>
            </div>
            
            <section id="premium-plans">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 md:max-w-4xl md:mx-auto">
                {plans.map((plan) => (
                    <Card
                    key={plan.id}
                    className={`flex flex-col bg-card border rounded-lg shadow-lg overflow-hidden ${plan.highlight
                        ? 'border-primary border-2'
                        : 'border-border'} hover:shadow-xl transition-all duration-300`}
                    >
                    <CardHeader className={`p-6 ${plan.highlight ? 'bg-primary/10' : 'bg-secondary/50'}`}>
                        <CardTitle className="text-2xl font-semibold text-foreground text-center">{plan.name}</CardTitle>
                        <CardDescription className="text-center text-muted-foreground mt-1">
                        <span className="text-3xl font-bold text-foreground">R$ {plan.price.toFixed(2).replace('.', ',')}</span>
                        <span className="text-sm">{plan.period}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 flex-grow flex flex-col justify-between">
                        <ul className="space-y-3 mb-6">
                        {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start">
                            {feature.included ? (
                                <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5"/>
                            ) : (
                                <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5"/>
                            )}
                            <span className={`text-sm ${feature.included ? 'text-muted-foreground' : 'text-muted-foreground/70 line-through'}`}>
                                {feature.text}
                            </span>
                            </li>
                        ))}
                        </ul>
                    <Button
                        asChild
                        variant={plan.highlight ? 'default' : 'outline'}
                        className={`w-full mt-auto ${plan.highlight ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'}`}
                    >
                       <Link href="/?tab=chat">
                         <Users className="mr-2 h-4 w-4" />
                         {plan.cta} via Discord
                       </Link>
                    </Button>
                    </CardContent>
                    </Card>
                ))}
                </div>
            </section>
      </main>
    </div>
  );
}
