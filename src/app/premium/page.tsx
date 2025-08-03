
'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ArrowLeft, X, Gift, Loader2, Copy } from 'lucide-react'; // Added Gift icon
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, serverTimestamp, getDocs, query, where, writeBatch, Timestamp, collection } from 'firebase/firestore';
import { User, updateProfile } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

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
    cta: 'Via Código de Resgate',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29.00,
    period: '/mês',
    features: [
        { text: 'Acesso a todas as aulas (Premium)', included: true },
        { text: 'Suporte prioritário', included: true },
        { text: 'Acesso a ferramentas exclusivas', included: true },
        { text: 'Acesso a mapas prontos', included: true },
        { text: 'Acesso ao Launcher exclusivo', included: true },
    ],
    highlight: true,
    cta: 'Via Código de Resgate',
  },
];

export default function PremiumPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [redemptionCode, setRedemptionCode] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/'); // Redirect if not logged in
      }
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [router]);

  const handleGoToPurchaseInfo = () => {
    window.open(DISCORD_PURCHASE_INFO_LINK, '_blank', 'noopener,noreferrer');
  };

  const handleRedeemCode = async () => {
    if (!user) {
      toast({ title: "Erro", description: "Você precisa estar logado para resgatar um código.", variant: "destructive" });
      return;
    }
    if (!redemptionCode.trim()) {
      toast({ title: "Erro", description: "Por favor, insira um código de resgate.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      const codesRef = collection(db, "redemptionCodes");
      const q = query(codesRef, where("code", "==", redemptionCode.trim().toUpperCase()), where("status", "==", "active"));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Código inválido, expirado ou já utilizado.");
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();

      // Check if code was already redeemed in a race condition
      if (codeData.status !== 'active') {
           throw new Error("Este código já foi resgatado por outro usuário.");
      }


      // Start a transaction to ensure atomicity
      const batch = writeBatch(db);
      const userDocRef = doc(db, "users", user.uid);
      const codeDocRef = doc(db, "redemptionCodes", codeDoc.id);

      // Set expiry date
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + codeData.durationDays);

      // Update user document
      batch.update(userDocRef, {
        isPremium: true,
        premiumPlanType: codeData.planType,
        premiumExpiryDate: Timestamp.fromDate(expiryDate),
      });

      // Update code document
      batch.update(codeDocRef, {
        status: 'redeemed',
        redeemedByUserId: user.uid,
        redeemedAt: serverTimestamp(),
      });

      // Commit the transaction
      await batch.commit();

      // Update user's avatar in Auth based on premium status
      const premiumAvatarUrl = 'https://i.ibb.co/M3T30ZJ/download-1.jpg';
      if(auth.currentUser && auth.currentUser.photoURL !== premiumAvatarUrl) {
          await updateProfile(auth.currentUser, { photoURL: premiumAvatarUrl });
      }

      toast({
        title: "Sucesso!",
        description: `Plano ${codeData.planType} ativado por ${codeData.durationDays} dias!`,
        variant: 'default',
        className: "bg-green-600 border-green-600 text-white"
      });

      setRedemptionCode(''); // Clear input
      router.push('/profile'); // Redirect to profile page

    } catch (error: any) {
      console.error("Redemption error:", error);
      toast({
        title: "Erro no Resgate",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
                 Obtenha um código de resgate em nosso Discord e insira abaixo para ativar seu plano.
              </p>
               <Button variant="link" onClick={handleGoToPurchaseInfo} className="text-primary mt-2 text-lg">
                  <Gift className="mr-2 h-5 w-5"/>
                  Obter Código de Resgate
               </Button>
            </div>

             {/* Redemption Code Input Section */}
             <Card className="max-w-xl mx-auto bg-card border-border shadow-lg mb-12">
                <CardHeader>
                    <CardTitle>Resgatar Código</CardTitle>
                    <CardDescription>Insira seu código premium para ativar seu plano.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-2">
                     <Input
                        type="text"
                        placeholder="SEU-CODIGO-AQUI"
                        value={redemptionCode}
                        onChange={(e) => setRedemptionCode(e.target.value)}
                        className="flex-grow bg-input text-base"
                        disabled={isLoading}
                    />
                    <Button
                        onClick={handleRedeemCode}
                        disabled={isLoading}
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Resgatando...
                            </>
                        ) : (
                            "Ativar Plano"
                        )}
                    </Button>
                </CardContent>
            </Card>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 md:max-w-4xl md:mx-auto">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`flex flex-col bg-card border rounded-lg shadow-lg overflow-hidden ${plan.highlight
                    ? 'border-primary border-2' // Removed scale-105 for better layout
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
                    onClick={handleGoToPurchaseInfo}
                    variant={plan.highlight ? 'default' : 'outline'}
                    className={`w-full mt-auto ${plan.highlight ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'}`}
                  >
                     {plan.cta}
                  </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
      </main>
    </div>
  );
}
