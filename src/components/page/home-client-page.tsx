
'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import MainContent from '@/components/layout/main-content';
import ToolsContent from '@/components/layout/tools-content';
import ShopContent from '@/components/layout/shop-content'; // Import ShopContent
import SupportContent from '@/components/layout/support-content'; // Import SupportContent
import AdminPanel from '@/components/layout/admin-panel';
import SignUpForm from '@/components/auth/sign-up-form';
import LevelUpModal from '@/components/ui/level-up-modal';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, doc, setDoc, getDoc, updateDoc, getDocs, query, orderBy, onSnapshot, Unsubscribe } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { Loader2, Wrench } from 'lucide-react';
import { ranks } from '@/config/ranks';


export interface Lesson {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  videoUrl: string;
  supportToolIds?: string[];
  completed: boolean;
  category: string;
  isPremium?: boolean;
  createdAt?: any;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  rank: string;
  isAdmin: boolean;
  photoURL: string | null;
  email?: string;
  isPremium?: boolean;
  bannerURL?: string | null;
  premiumPlanType?: 'basic' | 'pro' | null;
  premiumExpiryDate?: any | null;
  redeemedCode?: string | null;
}


export type ActiveTab = 'aulas' | 'ferramentas' | 'loja' | 'suporte' | 'admin';

const LOGO_URL = "https://i.imgur.com/sXliRZl.png";

interface SiteSettings {
    isMaintenanceMode: boolean;
    maintenanceMessage: string;
    isSalesBotEnabled: boolean;
}

type ServiceRequest = { type: 'quote' | 'purchase'; details: string } | null;

export default function HomeClientPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('aulas');
  const [selectedToolCategory, setSelectedToolCategory] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSignIn, setIsLoadingSignIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [levelUpInfo, setLevelUpInfo] = useState<{ oldRank: string, newRank: string } | null>(null);
  const previousRankRef = useRef<string | undefined>();
  const [serviceRequest, setServiceRequest] = useState<ServiceRequest>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const isLoggedIn = !!user;

  // Effect to handle tab and channel changes from URL
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as ActiveTab | null;
    if (tabFromUrl && ['aulas', 'ferramentas', 'loja', 'suporte', 'admin'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Effect to set initial lesson from URL param
  useEffect(() => {
    const lessonIdFromUrl = searchParams.get('lessonId');
    if (lessonIdFromUrl && !selectedLessonId) {
      setSelectedLessonId(lessonIdFromUrl);
      setActiveTab('aulas'); // Ensure correct tab is active
    }
  }, [searchParams, selectedLessonId]);


  // Combined Auth and Data Fetching Effect
  useEffect(() => {
    let isMounted = true;
    let unsubscribeProfile: Unsubscribe | null = null;
    let unsubscribeProgress: Unsubscribe | null = null;
    let unsubscribeSettings: Unsubscribe | null = null;

    if (db) {
        const settingsDocRef = doc(db, 'settings', 'site_config');
        unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
            if (!isMounted) return;
            if (docSnap.exists()) {
                setSiteSettings(docSnap.data() as SiteSettings);
            } else {
                setSiteSettings({ isMaintenanceMode: false, maintenanceMessage: 'O site está em manutenção. Voltamos em breve!', isSalesBotEnabled: true });
            }
        });
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      setUser(currentUser);

      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeProgress) unsubscribeProgress();

      setIsLoading(true);
      setError("");

      if (currentUser) {
        try {
          const lessonsCol = collection(db, "lessons");
          const lessonsQuery = query(lessonsCol, orderBy("category", "asc"), orderBy("createdAt", "asc"));
          const lessonSnapshot = await getDocs(lessonsQuery);
          const fetchedLessons = lessonSnapshot.docs.map(doc => ({
            id: doc.id,
            completed: false,
            category: doc.data().category ?? "Geral",
            isPremium: doc.data().isPremium === true,
            supportToolIds: doc.data().supportToolIds ?? [],
            ...doc.data()
          })) as Lesson[];

           if (!isMounted) return;
          setLessons(fetchedLessons);

          const userDocRef = doc(db, "users", currentUser.uid);
          unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
            if (!isMounted) return;
            if (docSnap.exists()) {
              const data = docSnap.data();
              const profileData = {
                uid: currentUser.uid,
                displayName: data.displayName || currentUser.displayName || 'Usuário',
                rank: data.rank || 'iniciante',
                isAdmin: data.isAdmin === true,
                photoURL: data.photoURL || currentUser.photoURL || null,
                email: data.email || currentUser.email || undefined,
                isPremium: data.isPremium === true,
                premiumPlanType: data.premiumPlanType || null,
                premiumExpiryDate: data.premiumExpiryDate || null,
                bannerURL: data.bannerURL || null,
                redeemedCode: data.redeemedCode || null,
              } as UserProfile;
              setUserProfile(profileData);

                if (!profileData?.isAdmin && activeTab === 'admin') {
                     if (isMounted) setActiveTab('aulas');
                }

            } else {
              setUserProfile(null);
            }
          });

           if (fetchedLessons.length > 0) {
                const progressDocRef = doc(db, "userProgress", currentUser.uid);
                unsubscribeProgress = onSnapshot(progressDocRef, (docSnap) => {
                    if (!isMounted) return;
                    let progressData = { completedLessons: {} };
                    if (docSnap.exists()) {
                        progressData = docSnap.data() as { completedLessons: Record<string, boolean> };
                    }
                    setLessons(currentLessons => currentLessons.map(lesson => ({
                        ...lesson,
                        completed: progressData.completedLessons?.[lesson.id] ?? false,
                    })));
                });
           }

            if (!selectedLessonId && fetchedLessons.length > 0) {
                const lessonIdFromUrl = searchParams.get('lessonId');
                 const targetLessonId = lessonIdFromUrl && fetchedLessons.some(l => l.id === lessonIdFromUrl)
                     ? lessonIdFromUrl
                     : fetchedLessons[0].id;
                 if (isMounted) setSelectedLessonId(targetLessonId);
            } else if (fetchedLessons.length === 0) {
                 if (isMounted) setSelectedLessonId(null);
            }


        } catch (error: any) {
           if (isMounted) {
               setError(`Erro ao carregar dados: ${error.message}`);
               setLessons([]);
               setUserProfile(null);
           }
        } finally {
             if (isMounted) setIsLoading(false);
        }

      } else {
         try {
            const lessonsCol = collection(db, "lessons");
            const lessonsQuery = query(lessonsCol, orderBy("category", "asc"), orderBy("createdAt", "asc"));
            const lessonSnapshot = await getDocs(lessonsQuery);
            const fetchedLessons = lessonSnapshot.docs.map(doc => ({
                id: doc.id,
                completed: false,
                category: doc.data().category ?? "Geral",
                isPremium: doc.data().isPremium === true,
                supportToolIds: doc.data().supportToolIds ?? [],
                ...doc.data()
            })) as Lesson[];

            if (!isMounted) return;
            setLessons(fetchedLessons);
            setUserProfile(null);
             setActiveTab('aulas');

             if (!selectedLessonId && fetchedLessons.length > 0) {
                 const lessonIdFromUrl = searchParams.get('lessonId');
                 const targetLessonId = lessonIdFromUrl && fetchedLessons.some(l => l.id === lessonIdFromUrl)
                     ? lessonIdFromUrl
                     : fetchedLessons[0].id;
                 if (isMounted) setSelectedLessonId(targetLessonId);
             } else if (fetchedLessons.length === 0) {
                 if (isMounted) setSelectedLessonId(null);
             }

         } catch (error: any) {
             if (isMounted) {
                 setError(`Erro ao carregar aulas públicas: ${error.message}`);
                 setLessons([]);
             }
         } finally {
             if (isMounted) setIsLoading(false);
         }
      }
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeProgress) unsubscribeProgress();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    useEffect(() => {
        if (userProfile && userProfile.rank) {
            if (previousRankRef.current && previousRankRef.current !== userProfile.rank && ranks[previousRankRef.current] && ranks[userProfile.rank]) {
                setLevelUpInfo({
                    oldRank: previousRankRef.current,
                    newRank: userProfile.rank,
                });
            }
            previousRankRef.current = userProfile.rank;
        }
    }, [userProfile]);


  const updateUserProgress = async (lessonId: string, completed: boolean) => {
    if (!db || !user) {
      toast({ title: "Erro", description: "Não foi possível salvar o progresso (não conectado).", variant: "destructive" });
      return;
    }
    const userDocRef = doc(db, "userProgress", user.uid);
    try {
      await updateDoc(userDocRef, {
        [`completedLessons.${lessonId}`]: completed,
      }).catch(async (error) => {
         if (error.code === 'not-found') {
           await setDoc(userDocRef, { completedLessons: { [lessonId]: completed } });
         } else {
           throw error;
         }
      });
    } catch (e: any) {
      setError(`Erro ao salvar progresso (${e.code || 'desconhecido'}).`);
       toast({ title: "Erro", description: "Não foi possível salvar seu progresso.", variant: "destructive" });
        setLessons(prevLessons =>
            prevLessons.map(l =>
                l.id === lessonId ? { ...l, completed: !completed } : l
            )
         );
    }
  };

  const handleMarkComplete = async (lessonId: string) => {
    if (!user) {
        toast({
            title: "Ação Necessária",
            description: "Faça login para marcar aulas como concluídas.",
            variant: "default",
            className: "bg-yellow-500 border-yellow-500 text-black"
        });
        return;
    }

    const lessonIndex = lessons.findIndex(l => l.id === lessonId);
    if (lessonIndex === -1) return;

    const updatedLessons = [...lessons];
    const currentLesson = updatedLessons[lessonIndex];
    const newCompletedStatus = !currentLesson.completed;

    updatedLessons[lessonIndex] = { ...currentLesson, completed: newCompletedStatus };
    setLessons(updatedLessons);

    await updateUserProgress(lessonId, newCompletedStatus);

    toast({
        title: `Aula ${newCompletedStatus ? 'Concluída' : 'Pendente'}!`,
        description: `Você marcou a aula "${currentLesson.title}" como ${newCompletedStatus ? 'concluída' : 'pendente'}.`,
        variant: newCompletedStatus ? "default" : "destructive",
        className: newCompletedStatus ? "bg-green-600 border-green-600 text-white" : ""
      });
  };


  const handleSelectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
        const mainContentElement = document.getElementById('main-content');
        if (mainContentElement) {
          mainContentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
     router.push(`/?lessonId=${lessonId}`, { scroll: false });
  };

  const handleSelectTool = (toolId: string) => {
    setActiveTab('ferramentas');
    setSelectedLessonId(null);
     router.push(`/tools/${toolId}`);
  };
  
    const handleServiceRequest = useCallback((type: 'quote' | 'purchase', details: string) => {
        setActiveTab('suporte');
        setServiceRequest({ type, details });
    }, []);

  const selectedLessonData = lessons.find(lesson => lesson.id === selectedLessonId);
  const completedLessonsCount = lessons.filter(l => l.completed).length;
  const progressPercentage = lessons.length > 0 ? Math.round((completedLessonsCount / lessons.length) * 100) : 0;


  const renderContent = () => {
     if (isLoading || !siteSettings) {
      return (
        <div className="flex justify-center items-center flex-1 flex-grow">
            <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
           <p className="text-muted-foreground text-lg">Carregando Studio...</p>
        </div>
      );
    }
     if (error && (!auth || !db)) {
         return (
            <div className="flex justify-center items-center flex-1 flex-grow p-4">
                <Card className="w-full max-w-md bg-destructive/10 border border-destructive/30 p-6 text-center text-destructive">
                    <h3 className="text-xl font-semibold mb-2">Erro Crítico</h3>
                    <p className="text-sm">{error}</p>
                    <p className="text-xs mt-2">Não foi possível conectar aos serviços necessários. Verifique a configuração do Firebase.</p>
                </Card>
            </div>
         );
     }


    if (!isLoggedIn) {
      return (
         <div className="flex flex-col justify-center items-center flex-1 flex-grow p-4">
            <div className="mb-6">
                 <Image
                     src={LOGO_URL}
                     alt="STUDIO PECC Logo"
                    width={80}
                    height={80}
                    className="rounded-sm object-contain"
                    priority
                    data-ai-hint="logo game"
                />
            </div>
            <Card className="w-full max-w-md bg-card shadow-xl border-border rounded-lg">
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-6 text-foreground">Login</h2>
                {error && !isLoadingSignIn && (
                  <div className="bg-destructive/10 text-destructive border border-destructive/30 p-3 rounded-md mb-4 text-sm flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                    {error}
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email-login" className="text-muted-foreground">Email</Label>
                    <Input
                      type="email"
                      id="email-login"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="bg-input border-border focus:ring-primary focus:border-primary"
                      required
                      disabled={isLoadingSignIn}
                    />
                  </div>
                  <div>
                    <Label htmlFor="password-login" className="text-muted-foreground">Senha</Label>
                    <Input
                      type="password"
                      id="password-login"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha"
                      className="bg-input border-border focus:ring-primary focus:border-primary"
                      required
                      disabled={isLoadingSignIn}
                    />
                  </div>
                  <Button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base py-3"
                    onClick={handleSignIn}
                    disabled={isLoadingSignIn}
                    >
                     {isLoadingSignIn ? (
                         <>
                           <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                           Entrando...
                         </>
                     ) : (
                         "Entrar na Academia"
                     )}
                  </Button>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">
                        Ou
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-primary text-primary hover:bg-primary/10"
                    onClick={() => setIsSignUpOpen(true)}
                    disabled={isLoadingSignIn}
                  >
                    Criar Conta
                  </Button>
                </div>
              </CardContent>
            </Card>
          <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
              <SignUpForm setOpen={setIsSignUpOpen} />
          </Dialog>
        </div>
      );
    }
    
    if (siteSettings.isMaintenanceMode && !userProfile?.isAdmin) {
         return (
            <div className="flex flex-col justify-center items-center flex-1 flex-grow p-4">
                <Card className="w-full max-w-lg bg-card shadow-xl border-border rounded-lg p-8 text-center">
                    <Wrench className="w-12 h-12 mx-auto text-primary mb-4" />
                    <h2 className="text-2xl font-bold text-foreground mb-2">Em Manutenção</h2>
                    <p className="text-muted-foreground">{siteSettings.maintenanceMessage}</p>
                    <Button onClick={handleSignOut} className="mt-6">Sair</Button>
                </Card>
            </div>
        )
    }

    const showSidebar = ['aulas', 'ferramentas'].includes(activeTab);

    return (
        <div className={cn("flex flex-col md:flex-row flex-1 overflow-hidden", "md:space-x-4")}>
            {showSidebar && (
                <div className="hidden md:block w-full md:w-72 lg:w-80 flex-shrink-0 md:pl-4">
                    <Sidebar
                        activeTab={activeTab}
                        selectedToolCategory={selectedToolCategory}
                        setSelectedToolCategory={setSelectedToolCategory}
                        selectedLessonId={selectedLessonId}
                        setSelectedLessonId={handleSelectLesson}
                        lessons={lessons}
                        progressPercentage={progressPercentage}
                        isLoading={isLoading}
                    />
                </div>
            )}

          <div id="main-content" className="flex-1 overflow-y-auto flex flex-col p-2 md:p-0 md:pr-4">
             {isLoading && (
               <div className="flex justify-center items-center flex-grow">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin text-muted-foreground" />
                 <p className="text-muted-foreground">Carregando conteúdo...</p>
               </div>
             )}
             {!isLoading && activeTab === 'aulas' && (
                <>
                  {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-sm">Erro: {error}</div>}
                  
                  {lessons.length === 0 && !isLoading && !error ? (
                     <div className="flex justify-center items-center flex-grow"><p className="text-muted-foreground">Nenhuma aula disponível.</p></div>
                  ) : selectedLessonData ? (
                    <div className="w-full max-w-3xl mx-auto">
                      <MainContent
                        lesson={selectedLessonData}
                        onMarkComplete={handleMarkComplete}
                        isCompleted={selectedLessonData.completed || false}
                        isPremium={selectedLessonData.isPremium}
                        userIsPremium={userProfile?.isPremium}
                         onSelectTool={handleSelectTool}
                      />
                    </div>
                  ) : !error && lessons.length > 0 ? (
                    <div className="flex justify-center items-center flex-grow"><p className="text-muted-foreground">Selecione uma aula para começar.</p></div>
                  ) : null }

                  {showSidebar && <div className="block md:hidden mt-4 p-2"><Sidebar activeTab={activeTab} selectedToolCategory={selectedToolCategory} setSelectedToolCategory={setSelectedToolCategory} selectedLessonId={selectedLessonId} setSelectedLessonId={handleSelectLesson} lessons={lessons} progressPercentage={progressPercentage} isLoading={isLoading}/></div>}
                </>
             )}
             {!isLoading && activeTab === 'ferramentas' && (
              <>
                 {showSidebar && <div className="block md:hidden mb-4 p-2"><Sidebar activeTab={activeTab} selectedToolCategory={selectedToolCategory} setSelectedToolCategory={setSelectedToolCategory} selectedLessonId={selectedLessonId} setSelectedLessonId={handleSelectLesson} lessons={lessons} progressPercentage={progressPercentage} isLoading={isLoading}/></div>}
                 <div className="w-full">
                   <Suspense fallback={<div className="flex justify-center items-center h-full flex-grow"><Loader2 className="mr-2 h-6 w-6 animate-spin text-muted-foreground" /><p className="text-muted-foreground">Carregando ferramentas...</p></div>}>
                    <ToolsContent selectedCategory={selectedToolCategory} />
                   </Suspense>
                </div>
              </>
             )}
            {!isLoading && activeTab === 'loja' && (
                <div className="w-full">
                    <ShopContent onServiceRequest={handleServiceRequest} />
                </div>
            )}
            {!isLoading && activeTab === 'suporte' && (
              <SupportContent 
                userProfile={userProfile} 
                serviceRequest={serviceRequest}
                onServiceRequestHandled={() => setServiceRequest(null)}
              />
            )}
            {!isLoading && activeTab === 'admin' && userProfile?.isAdmin && (
                <div className="w-full"><AdminPanel /></div>
            )}
             {!isLoading && activeTab === 'admin' && !userProfile?.isAdmin && (
               <div className="flex justify-center items-center flex-grow p-6">
                 <Card className="bg-destructive/10 border-destructive/30 text-destructive p-6 text-center">
                   <h3 className="text-xl font-semibold mb-2">Acesso Negado</h3>
                   <p>Você não tem permissão para acessar o Painel de Administração.</p>
                 </Card>
               </div>
             )}
          </div>
        </div>
      );
  };


  async function handleSignIn() {
    setError("");
    if (!auth) {
      setError("Autenticação não inicializada.");
      return;
    }
     if (!email || !password) {
        setError("Por favor, preencha o email e a senha.");
        return;
    }
    setIsLoadingSignIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
       toast({ title: "Login realizado com sucesso!", description: "Bem-vindo de volta!", variant: "default", className: "bg-green-600 border-green-600 text-white" });
    } catch (error: any) {
       if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
           setError("Email ou senha inválidos.");
       } else {
            setError("Erro ao fazer login. Tente novamente.");
       }
    } finally {
        setIsLoadingSignIn(false);
    }
  }

  async function handleSignOut() {
    if (!auth) {
      setError("Erro ao sair (Auth não inicializado).");
      return;
    }
    setIsSigningOut(true);
    setError("");
    try {
      await signOut(auth);
      toast({ title: "Logout realizado com sucesso!", variant: "default" });
    } catch (error: any) {
      setError("Erro ao sair: " + error.message);
       toast({ title: "Erro ao Sair", description: error.message, variant: "destructive" });
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
       {levelUpInfo && userProfile && (
            <LevelUpModal
                isOpen={!!levelUpInfo}
                onClose={() => setLevelUpInfo(null)}
                oldRank={levelUpInfo.oldRank}
                newRank={levelUpInfo.newRank}
                userAvatar={userProfile.photoURL}
            />
        )}
      <style jsx global>{`
        :root {
          --header-height: 64px;
          --footer-height: 56px;
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: hsl(var(--muted) / 0.2); border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.5); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.7); }
        .login-container-layout { display: flex; flex-direction: column; min-height: calc(100vh - var(--footer-height)); }
        .login-content-wrapper { flex-grow: 1; display: flex; justify-content: center; align-items: center; padding: 1rem; }
        .logged-in-layout { display: flex; flex-direction: column; min-height: screen; }
        .logged-in-content-wrapper { display: flex; flex: 1; overflow: hidden; padding: 1rem; padding-top: 1rem; padding-bottom: 1rem; padding-right: 1rem; padding-left: 0; }
        @media (min-width: 768px) { .logged-in-content-wrapper { padding-left: 1rem; } }
      `}</style>

       {isLoggedIn && (
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isLoggedIn={isLoggedIn}
            onSignOut={handleSignOut}
            userName={userProfile?.displayName}
            userRank={userProfile?.rank}
            isAdmin={userProfile?.isAdmin ?? false}
            userAvatarUrl={userProfile?.photoURL}
            isSigningOut={isSigningOut}
          />
      )}
        <div className={cn(!isLoggedIn ? "login-container-layout" : "logged-in-layout")}>
            <div className={cn(!isLoggedIn ? "login-content-wrapper" : "logged-in-content-wrapper")}>
                <Suspense fallback={<div className="flex justify-center items-center flex-1 flex-grow"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /><p className="text-muted-foreground">Carregando...</p></div>}>
                 {renderContent()}
                </Suspense>
            </div>
        </div>
    </div>
  );
}
