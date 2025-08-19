
'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, ArrowLeft, X, Gift, Loader2, Star, BrainCircuit, Users, Ticket } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';
import { collection, getDocs, query, where, addDoc, serverTimestamp, writeBatch, doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { add } from 'date-fns';
import PremiumActivatedModal from '@/components/ui/premium-activated-modal'; // Import the new modal

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
    cta: 'Solicitar Acesso',
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
    cta: 'Solicitar Acesso',
  },
];

export default function PremiumPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null); // To store user's displayName etc.
  const [isRequesting, setIsRequesting] = useState<string | null>(null);
  const [redemptionCode, setRedemptionCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [premiumModalInfo, setPremiumModalInfo] = useState<{ planType: 'basic' | 'pro'; durationDays: number } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Fetch user profile to get displayName
        const userDocRef = doc(db, 'users', currentUser.uid);
        getDoc(userDocRef).then(docSnap => {
            if(docSnap.exists()){
                setUserProfile(docSnap.data());
            }
        });
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);
  
  const handleRequestPlan = async (planName: string) => {
    if (!user || !userProfile) {
        toast({ title: "Ação Necessária", description: "Faça login para solicitar um plano.", variant: "destructive" });
        return;
    }
    setIsRequesting(planName);
    try {
        const newTicketRef = await addDoc(collection(db, 'supportTickets'), {
            subject: `Solicitação de Plano Premium: ${planName}`,
            status: 'open',
            userId: user.uid,
            userName: userProfile.displayName,
            type: 'purchase', // New type for purchase requests
            createdAt: serverTimestamp(),
        });

        await addDoc(collection(newTicketRef, 'messages'), {
            text: `Olá! Recebemos sua solicitação para o plano "${planName}". Um administrador entrará em contato em breve para finalizar a compra com você.`,
            user: { uid: 'bot', name: 'Assistente', avatar: 'https://i.imgur.com/sXliRZl.png', isAdmin: true },
            createdAt: serverTimestamp(),
            isBotMessage: true,
        });

        toast({ title: "Solicitação Enviada!", description: "Um ticket foi aberto em 'Suporte'. Acompanhe por lá!", className: "bg-blue-500 text-white" });
        router.push('/?tab=suporte');

    } catch (error) {
        console.error("Error creating purchase ticket:", error);
        toast({ title: "Erro", description: "Não foi possível criar o ticket de solicitação.", variant: "destructive" });
    } finally {
        setIsRequesting(null);
    }
  };

  const handleRedeemCode = async () => {
    if (!user || !db) {
        toast({ title: "Erro", description: "Você precisa estar logado para resgatar um código.", variant: "destructive" });
        return;
    }
    if (!redemptionCode.trim()) {
        toast({ title: "Código Inválido", description: "Por favor, insira um código.", variant: "destructive" });
        return;
    }

    setIsRedeeming(true);
    const code = redemptionCode.trim().toUpperCase();

    const codesRef = collection(db, "redemptionCodes");
    const q = query(codesRef, where("code", "==", code), where("status", "==", "active"));

    try {
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({ title: "Código Inválido", description: "Este código não existe ou já foi utilizado.", variant: "destructive" });
            setIsRedeeming(false);
            return;
        }

        const codeDoc = querySnapshot.docs[0];
        const codeData = codeDoc.data();
        const userDocRef = doc(db, "users", user.uid);

        // Calculate expiry date
        const expiryDate = add(new Date(), { days: codeData.durationDays });

        // Use a batch write to update both user and code documents atomically
        const batch = writeBatch(db);
        batch.update(userDocRef, {
            isPremium: true,
            premiumPlanType: codeData.planType,
            premiumExpiryDate: expiryDate, // Store as a Date object
        });
        batch.update(codeDoc.ref, {
            status: "redeemed",
            redeemedByUserId: user.uid,
            redeemedAt: serverTimestamp(),
        });

        await batch.commit();

        setPremiumModalInfo({
            planType: codeData.planType,
            durationDays: codeData.durationDays,
        });

        setRedemptionCode('');

    } catch (error) {
        console.error("Error redeeming code:", error);
        toast({ title: "Erro", description: "Ocorreu um problema ao resgatar o código.", variant: "destructive" });
    } finally {
        setIsRedeeming(false);
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
       {premiumModalInfo && userProfile && (
            <PremiumActivatedModal
                isOpen={!!premiumModalInfo}
                onClose={() => setPremiumModalInfo(null)}
                planType={premiumModalInfo.planType}
                durationDays={premiumModalInfo.durationDays}
                userAvatar={userProfile.photoURL}
            />
        )}
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

            {/* Redemption Section */}
            <Card className="max-w-xl mx-auto mb-12 bg-secondary/50 border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Ticket /> Resgatar Código de Ativação</CardTitle>
                    <CardDescription>Já possui um código? Insira abaixo para ativar seu plano.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            type="text"
                            placeholder="SEU-CODIGO-AQUI"
                            value={redemptionCode}
                            onChange={(e) => setRedemptionCode(e.target.value)}
                            className="flex-grow bg-input text-base uppercase"
                            disabled={isRedeeming}
                        />
                        <Button onClick={handleRedeemCode} disabled={isRedeeming} className="bg-primary hover:bg-primary/90">
                            {isRedeeming ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Ativando...</> : "Ativar Plano"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
            
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
                        onClick={() => handleRequestPlan(plan.name)}
                        variant={plan.highlight ? 'default' : 'outline'}
                        className={`w-full mt-auto ${plan.highlight ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent/10'}`}
                        disabled={isRequesting === plan.name}
                    >
                       {isRequesting === plan.name ? (
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       ) : (
                           <Users className="mr-2 h-4 w-4" />
                       )}
                         {plan.cta}
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
