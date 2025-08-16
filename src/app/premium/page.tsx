
'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, ArrowLeft, X, Gift, Loader2, Star, BrainCircuit, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import Image from 'next/image';
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
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleStartConsultation = async (mapType: 'GTA V' | 'GTA IV') => {
      if (!user || !db) {
          toast({ title: "Ação Necessária", description: "Faça login para iniciar uma consulta de encomenda.", variant: "destructive" });
          return;
      }
      setIsLoading(true);

      const consultationName = `consulta-${user.displayName?.toLowerCase().replace(/\s/g, '-') || user.uid.substring(0, 5)}`;
      try {
          // This function now resides in ChatContent, but we can recreate the initial channel creation here.
          const newChannelRef = await addDoc(collection(db, 'chatChannels'), {
              name: consultationName,
              categoryId: 'sales-consultation-category', // Static ID for sales
              isPrivate: true,
              isClosed: false,
              allowedUsers: [user.uid],
              createdAt: serverTimestamp(),
              initialInterest: mapType, // Pass the initial interest
          });

          toast({ title: "Consulta Iniciada!", description: `Um chat privado foi criado para você.`, className: "bg-green-600 text-white" });
          
          // Redirect the user to the chat, passing the new channel ID
          router.push(`/?tab=chat&channelId=${newChannelRef.id}`);

      } catch (error) {
          console.error("Error creating consultation channel:", error);
          toast({ title: "Erro", description: "Não foi possível iniciar a sua consulta.", variant: "destructive" });
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
       {/* Use a simplified header for this dedicated page */}
       <header className="bg-card px-4 md:px-6 py-3 flex items-center justify-between shadow-md h-[var(--header-height)] sticky top-0 z-30">
        <Button variant="outline" onClick={() => router.push('/')} className="text-sm">
          <ArrowLeft className="mr-2 h-4 w-4"/>
          Voltar para Home
        </Button>
        <h1 className="text-xl font-bold text-primary font-[Orbitron,sans-serif]">
          Planos e Serviços
        </h1>
        <div></div> {/* Spacer */}
      </header>

      <main className="flex-1 container mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                Desbloqueie Todo o Potencial
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Seja através de uma assinatura premium para acesso contínuo a conteúdo exclusivo ou por uma encomenda de mapa personalizada, temos a solução para elevar seu projeto.
              </p>
            </div>
            
            {/* Section for Map Conversion Services */}
            <section id="map-conversion" className="mb-16">
                <div className="text-center mb-8">
                    <h3 className="text-2xl md:text-3xl font-bold">Conversão de Mapas Exclusivos</h3>
                    <p className="text-md text-muted-foreground mt-2">Traga os mundos mais icônicos para o seu servidor.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                    {/* GTA V Card */}
                    <Card className="flex flex-col bg-card border rounded-lg shadow-lg overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <CardHeader className="p-0">
                            <Image src="https://i.imgur.com/XLIbJZT.png" alt="Mapa do GTA V" width={600} height={300} className="w-full h-48 object-cover" data-ai-hint="gta5 city" />
                        </CardHeader>
                        <CardContent className="p-6 flex-grow flex flex-col">
                            <CardTitle className="text-xl font-semibold mb-2">Conversão de Mapa: GTA V</CardTitle>
                            <CardDescription className="text-muted-foreground text-sm mb-4 flex-grow">
                                A vasta e detalhada Los Santos ao seu alcance. Oferecemos uma conversão de alta fidelidade, otimizada para performance e pronta para ser explorada no seu servidor.
                            </CardDescription>
                            <Button className="w-full mt-auto" size="lg" onClick={() => handleStartConsultation('GTA V')} disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BrainCircuit className="mr-2 h-5 w-5" />}
                                Solicitar Orçamento
                            </Button>
                        </CardContent>
                    </Card>

                    {/* GTA IV Card */}
                    <Card className="flex flex-col bg-card border rounded-lg shadow-lg overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                        <CardHeader className="p-0">
                             <Image src="https://i.imgur.com/wLdG12M.jpeg" alt="Mapa do GTA IV" width={600} height={300} className="w-full h-48 object-cover" data-ai-hint="gta4 city" />
                        </CardHeader>
                         <CardContent className="p-6 flex-grow flex flex-col">
                            <CardTitle className="text-xl font-semibold mb-2">Conversão de Mapa: GTA IV</CardTitle>
                             <CardDescription className="text-muted-foreground text-sm mb-4 flex-grow">
                                A atmosfera densa e o design complexo de Liberty City. Ideal para projetos que buscam uma ambientação urbana única e imersiva.
                            </CardDescription>
                            <Button className="w-full mt-auto" size="lg" onClick={() => handleStartConsultation('GTA IV')} disabled={isLoading}>
                                 {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BrainCircuit className="mr-2 h-5 w-5" />}
                                Solicitar Orçamento
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </section>

             {/* Section for Premium Plans */}
            <section id="premium-plans">
                <div className="text-center mb-8">
                    <h3 className="text-2xl md:text-3xl font-bold">Planos Premium</h3>
                    <p className="text-md text-muted-foreground mt-2">Acesso a conteúdo e ferramentas exclusivas para acelerar seu desenvolvimento.</p>
                </div>
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
