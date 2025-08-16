
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, BrainCircuit } from 'lucide-react';
import Image from 'next/image';

interface ShopContentProps {
  onCreateSalesTicket: (mapType: 'GTA V' | 'GTA IV') => void;
}

export default function ShopContent({ onCreateSalesTicket }: ShopContentProps) {
  const [isLoading, setIsLoading] = useState<'GTA V' | 'GTA IV' | null>(null);

  const handleStartConsultation = (mapType: 'GTA V' | 'GTA IV') => {
    setIsLoading(mapType);
    onCreateSalesTicket(mapType);
    // The loading state will be reset when the user is navigated away
    // or if the parent component handles it.
  };

  return (
    <div className="flex-1 container mx-auto py-8 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          Loja & Serviços Exclusivos
        </h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
          Adquira itens únicos para seu servidor ou solicite uma conversão de mapa personalizada para elevar seu projeto a outro nível.
        </p>
      </div>

      <section id="map-conversion">
        <div className="text-center mb-8">
            <h3 className="text-2xl md:text-3xl font-bold">Conversão de Mapas Exclusivos</h3>
            <p className="text-md text-muted-foreground mt-2">Traga os mundos mais icônicos para o seu servidor.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="flex flex-col bg-card border rounded-lg shadow-lg overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="p-0">
                    <Image src="https://i.imgur.com/XLIbJZT.png" alt="Mapa do GTA V" width={600} height={300} className="w-full h-48 object-cover" data-ai-hint="gta5 city" />
                </CardHeader>
                <CardContent className="p-6 flex-grow flex flex-col">
                    <CardTitle className="text-xl font-semibold mb-2">Conversão de Mapa: GTA V</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm mb-4 flex-grow">
                        A vasta e detalhada Los Santos ao seu alcance. Oferecemos uma conversão de alta fidelidade, otimizada para performance e pronta para ser explorada no seu servidor.
                    </CardDescription>
                    <Button className="w-full mt-auto" size="lg" onClick={() => handleStartConsultation('GTA V')} disabled={!!isLoading}>
                        {isLoading === 'GTA V' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BrainCircuit className="mr-2 h-5 w-5" />}
                        Solicitar Orçamento
                    </Button>
                </CardContent>
            </Card>

            <Card className="flex flex-col bg-card border rounded-lg shadow-lg overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <CardHeader className="p-0">
                     <Image src="https://i.imgur.com/wLdG12M.jpeg" alt="Mapa do GTA IV" width={600} height={300} className="w-full h-48 object-cover" data-ai-hint="gta4 city" />
                </CardHeader>
                 <CardContent className="p-6 flex-grow flex flex-col">
                    <CardTitle className="text-xl font-semibold mb-2">Conversão de Mapa: GTA IV</CardTitle>
                     <CardDescription className="text-muted-foreground text-sm mb-4 flex-grow">
                        A atmosfera densa e o design complexo de Liberty City. Ideal para projetos que buscam uma ambientação urbana única e imersiva.
                    </CardDescription>
                    <Button className="w-full mt-auto" size="lg" onClick={() => handleStartConsultation('GTA IV')} disabled={!!isLoading}>
                         {isLoading === 'GTA IV' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <BrainCircuit className="mr-2 h-5 w-5" />}
                        Solicitar Orçamento
                    </Button>
                </CardContent>
            </Card>
        </div>
      </section>
    </div>
  );
}
