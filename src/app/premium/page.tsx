
'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ArrowLeft, X, Gift, Loader2, Copy } from 'lucide-react'; // Added Copy icon
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, serverTimestamp, getDocs, query, where, writeBatch, Timestamp, collection } from 'firebase/firestore';
import { User, updateProfile } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Image from 'next/image';

const DISCORD_PURCHASE_INFO_LINK = "https://discord.gg/YP9UraDH4k";

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
    cta: 'Assinar com PIX',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 299.00,
    period: '/mês',
    features: [
        { text: 'Acesso a todas as aulas (Premium)', included: true },
        { text: 'Suporte prioritário', included: true },
        { text: 'Acesso a ferramentas exclusivas', included: true },
        { text: 'Acesso a mapas prontos', included: true },
        { text: 'Acesso ao Launcher exclusivo', included: true },
    ],
    highlight: true,
    cta: 'Assinar com PIX',
  },
];

interface PixData {
    qr_code_text: string;
    qr_code_url: string;
}

export default function PremiumPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof plans[0] | null>(null);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleGoToPurchaseInfo = () => {
    window.open(DISCORD_PURCHASE_INFO_LINK, '_blank', 'noopener,noreferrer');
  };

  const handleCheckout = async (plan: typeof plans[0]) => {
      if (!user) {
          toast({ title: "Erro", description: "Você precisa estar logado para fazer uma assinatura.", variant: "destructive" });
          return;
      }
      if (!user.email) { // Check if user has an email
           toast({ title: "Erro", description: "Seu perfil de usuário não tem um email associado, não é possível continuar.", variant: "destructive" });
           return;
      }
      setSelectedPlan(plan);
      setIsCheckoutLoading(true);

      try {
          const response = await fetch('/api/checkout/pagbank', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  planId: plan.id,
                  planName: plan.name,
                  amount: plan.price,
                  userId: user.uid,
                  userName: user.displayName || 'N/A',
                  userEmail: user.email, // Pass the user's email
              }),
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Falha ao gerar o QR Code PIX.');
          }

          const data: PixData = await response.json();
          setPixData(data);
          setIsPixModalOpen(true);
      } catch (error: any) {
          console.error("Checkout error:", error);
          toast({
              title: "Erro no Checkout",
              description: error.message,
              variant: "destructive",
          });
      } finally {
          setIsCheckoutLoading(false);
      }
  };

  const handleCopyPixCode = () => {
        if (!pixData) return;
        navigator.clipboard.writeText(pixData.qr_code_text);
        setCopied(true);
        toast({ title: "Copiado!", description: "Código PIX copiado para a área de transferência." });
        setTimeout(() => setCopied(false), 2000);
    };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="bg-card px-4 md:px-6 py-3 flex items-center justify-between shadow-md h-[var(--header-height)] sticky top-0 z-30">
        <Button variant="outline" onClick={() => router.push('/')} className="text-sm">
          <ArrowLeft className="mr-2 h-4 w-4"/>
          Voltar
        </Button>
        <h1 className="text-xl font-bold text-primary font-[Orbitron,sans-serif]">
          Planos Premium
        </h1>
        <div></div>
      </header>

      <main className="flex-1 container mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Desbloqueie Todo o Potencial</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                 Assine um de nossos planos via PIX para ter acesso a conteúdo e ferramentas exclusivas.
              </p>
               <Button variant="link" onClick={handleGoToPurchaseInfo} className="text-primary mt-2">
                  Precisa de ajuda ou um código de resgate?
               </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 md:max-w-2xl md:mx-auto mb-12">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`flex flex-col bg-card border rounded-lg shadow-lg overflow-hidden ${plan.highlight
                    ? 'border-primary border-2 scale-105'
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
                    onClick={() => handleCheckout(plan)}
                    disabled={isCheckoutLoading && selectedPlan?.id === plan.id}
                    variant={plan.highlight ? 'default' : 'outline'}
                    className={`w-full mt-auto ${plan.highlight ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'}`}
                  >
                     {isCheckoutLoading && selectedPlan?.id === plan.id ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Gerando PIX...
                        </>
                     ) : (
                        plan.cta
                     )}
                  </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Dialog open={isPixModalOpen} onOpenChange={setIsPixModalOpen}>
                <DialogContent className="sm:max-w-md bg-card">
                    <DialogHeader>
                        <DialogTitle className="text-2xl text-center">Pague com PIX</DialogTitle>
                        <DialogDescription className="text-center">
                            Escaneie o QR Code com o app do seu banco ou use o "Copia e Cola".
                        </DialogDescription>
                    </DialogHeader>
                    {pixData?.qr_code_url && (
                        <div className="flex justify-center p-4 bg-white rounded-md">
                            <Image src={pixData.qr_code_url} alt="PIX QR Code" width={256} height={256} />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="pix-code">PIX Copia e Cola</Label>
                        <div className="flex items-center space-x-2">
                            <Input id="pix-code" value={pixData?.qr_code_text || ''} readOnly className="bg-input text-xs" />
                            <Button variant="outline" size="icon" onClick={handleCopyPixCode}>
                                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                     <p className="text-xs text-center text-muted-foreground mt-4">
                        Após o pagamento, sua assinatura será ativada automaticamente. Isso pode levar alguns minutos. Você receberá uma notificação.
                    </p>
                </DialogContent>
            </Dialog>

      </main>
    </div>
  );
}

