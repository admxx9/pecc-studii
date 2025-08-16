
'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import MainContent from '@/components/layout/main-content';
import ToolsContent from '@/components/layout/tools-content';
import ChatContent from '@/components/layout/chat-content'; // Import ChatContent
import AdminPanel from '@/components/layout/admin-panel';
import SignUpForm from '@/components/auth/sign-up-form';
import LevelUpModal from '@/components/ui/level-up-modal'; // Import the new modal
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog } from "@/components/ui/dialog"; // Removed DialogContent import as SignUpForm handles it
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, doc, setDoc, getDoc, updateDoc, getDocs, query, orderBy, serverTimestamp, QueryConstraint, where, onSnapshot, Unsubscribe, addDoc } from "firebase/firestore"; // Added onSnapshot, Unsubscribe, addDoc
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { Loader2, Wrench } from 'lucide-react';
import HomeDynamicLoader from '@/components/page/home-dynamic-loader';
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
  premiumPlanType?: 'basic' | 'pro' | null; // Added from manage-users
  premiumExpiryDate?: any | null; // Added from manage-users
  redeemedCode?: string | null; // Added for profile display
}


export type ActiveTab = 'aulas' | 'ferramentas' | 'chat' | 'admin';

const LOGO_URL = "https://i.imgur.com/sXliRZl.png"; // Use the correct Logo URL

// New type for site settings
interface SiteSettings {
    isMaintenanceMode: boolean;
    maintenanceMessage: string;
}

const SALES_CONSULTATION_CATEGORY_ID = 'sales-consultation-category';

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
  const [activeChatChannelId, setActiveChatChannelId] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const isLoggedIn = !!user;

  // Function to safely get search params - needed for dynamic Suspense
  const GetLessonIdFromUrl = () => {
    const params = useSearchParams();
    return params.get('lessonId');
  }
  
  // Effect to handle tab and channel changes from URL
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as ActiveTab | null;
    const channelIdFromUrl = searchParams.get('channelId');

    if (tabFromUrl && Object.keys({aulas:1, ferramentas:1, chat:1, admin:1}).includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
    if (channelIdFromUrl) {
      setActiveChatChannelId(channelIdFromUrl);
    }
  }, [searchParams]);

  // Effect to set initial lesson from URL param
  useEffect(() => {
    const lessonIdFromUrl = searchParams.get('lessonId');
    if (lessonIdFromUrl && !selectedLessonId) {
      console.log("URL param lessonId found:", lessonIdFromUrl);
      setSelectedLessonId(lessonIdFromUrl);
      setActiveTab('aulas'); // Ensure correct tab is active
    }
  }, [searchParams, selectedLessonId]);


  // Combined Auth and Data Fetching Effect
  useEffect(() => {
    let isMounted = true;
    let unsubscribeProfile: Unsubscribe | null = null; // For real-time profile updates
    let unsubscribeProgress: Unsubscribe | null = null; // For real-time progress updates
    let unsubscribeSettings: Unsubscribe | null = null;

    // Listener for site settings (maintenance mode)
    if (db) {
        const settingsDocRef = doc(db, 'settings', 'site_config');
        unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
            if (!isMounted) return;
            if (docSnap.exists()) {
                setSiteSettings(docSnap.data() as SiteSettings);
            } else {
                setSiteSettings({ isMaintenanceMode: false, maintenanceMessage: 'O site está em manutenção. Voltamos em breve!' });
            }
        });
    }

    console.log("Setting up Firebase Auth listener...");
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      console.log("Auth state changed. Current user:", currentUser?.uid || "null");
      setUser(currentUser); // Update user state

      // Clean up previous listeners before setting new ones or if user logs out
      if (unsubscribeProfile) {
          console.log("Cleaning up previous profile listener.");
          unsubscribeProfile();
          unsubscribeProfile = null;
      }
      if (unsubscribeProgress) {
          console.log("Cleaning up previous progress listener.");
          unsubscribeProgress();
          unsubscribeProgress = null;
      }

      setIsLoading(true); // Start loading when auth state changes
      setError(""); // Clear errors on auth change

      if (currentUser) {
        // --- User is Logged In ---
        try {
          // Fetch lessons (only once needed unless they change frequently)
          // Consider fetching lessons outside the auth listener if they are static for all users
          console.log("Fetching lessons for logged-in user...");
          const lessonsCol = collection(db, "lessons");
          const lessonsQuery = query(lessonsCol, orderBy("category", "asc"), orderBy("createdAt", "asc"));
          const lessonSnapshot = await getDocs(lessonsQuery);
          const fetchedLessons = lessonSnapshot.docs.map(doc => ({
            id: doc.id,
            completed: false, // Initial state
            category: doc.data().category ?? "Geral",
            isPremium: doc.data().isPremium === true,
            supportToolIds: doc.data().supportToolIds ?? [],
            ...doc.data()
          })) as Lesson[];

           if (!isMounted) return;
           console.log(`Fetched ${fetchedLessons.length} lessons.`);
          // Set lessons initially without progress
          setLessons(fetchedLessons);

          // Set up real-time listener for User Profile
          console.log(`Setting up profile listener for user: ${currentUser.uid}`);
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
                isPremium: data.isPremium === true, // Read premium status
                premiumPlanType: data.premiumPlanType || null, // Read plan type
                premiumExpiryDate: data.premiumExpiryDate || null, // Read expiry
                bannerURL: data.bannerURL || null,
                redeemedCode: data.redeemedCode || null, // Fetch redeemed code
              } as UserProfile;
              console.log("Profile snapshot received:", profileData);
              setUserProfile(profileData);

               // Handle Admin Tab Access based on real-time data
                if (profileData?.isAdmin && activeTab !== 'admin') {
                    console.log("User is admin.");
                } else if (!profileData?.isAdmin && activeTab === 'admin') {
                     console.log("User is not admin but admin tab active, switching to aulas.");
                     if (isMounted) setActiveTab('aulas');
                }

            } else {
              console.log("User profile not found for:", currentUser.uid, "Attempting to create default.");
              setUserProfile(null); // Clear profile if doc doesn't exist
              // Try creating default profile if needed (handle potential race conditions)
                const standardAvatarUrl = 'https://i.ibb.co/VGBd4FG/Chat-GPT-Image-2-de-ago-de-2025-15-33-39.png';
                const defaultProfile: UserProfile = {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName || 'Novo Usuário',
                    rank: 'iniciante',
                    isAdmin: false,
                    photoURL: currentUser.photoURL || standardAvatarUrl,
                    email: currentUser.email || undefined,
                    isPremium: false,
                    bannerURL: null,
                 };
                setDoc(userDocRef, {
                    ...defaultProfile,
                    createdAt: serverTimestamp(),
                }).then(() => {
                    console.log("Default profile created on-the-fly.");
                     if (isMounted) setUserProfile(defaultProfile);
                }).catch(err => console.error("Error creating default profile:", err));
            }
          }, (error) => {
            console.error("Error listening to profile snapshot:", error);
            if (isMounted) {
                 setError("Erro ao carregar perfil em tempo real.");
                 setUserProfile(null);
            }
          });

           // Set up real-time listener for User Progress
           if (fetchedLessons.length > 0) {
                console.log(`Setting up progress listener for user: ${currentUser.uid}`);
                const progressDocRef = doc(db, "userProgress", currentUser.uid);
                unsubscribeProgress = onSnapshot(progressDocRef, (docSnap) => {
                    if (!isMounted) return;
                    let progressData = { completedLessons: {} };
                    if (docSnap.exists()) {
                        progressData = docSnap.data() as { completedLessons: Record<string, boolean> };
                         console.log("Progress snapshot received.");
                    } else {
                         console.log("No progress document found, creating stub.");
                         // Optionally create the document if it's absolutely necessary on first load
                        setDoc(progressDocRef, { completedLessons: {} }).catch(err => console.error("Error creating progress doc stub:", err));
                    }
                    // Update lessons with the latest progress
                    setLessons(currentLessons => currentLessons.map(lesson => ({
                        ...lesson,
                        completed: progressData.completedLessons?.[lesson.id] ?? false,
                    })));

                }, (error) => {
                    console.error("Error listening to progress snapshot:", error);
                     if (isMounted) setError("Erro ao carregar progresso em tempo real.");
                    // Reset progress on error?
                    setLessons(currentLessons => currentLessons.map(l => ({ ...l, completed: false })));
                });
           } else {
               console.log("No lessons, skipping progress listener setup.");
               setLessons([]); // Ensure lessons are empty if fetch resulted in empty
           }

            // Set initial lesson selection if none selected and lessons exist
            if (!selectedLessonId && fetchedLessons.length > 0) {
                const lessonIdFromUrl = searchParams.get('lessonId');
                 const targetLessonId = lessonIdFromUrl && fetchedLessons.some(l => l.id === lessonIdFromUrl)
                     ? lessonIdFromUrl
                     : fetchedLessons[0].id;
                 console.log(`Setting initial/URL lesson: ${targetLessonId}`);
                 if (isMounted) setSelectedLessonId(targetLessonId);
            } else if (fetchedLessons.length === 0) {
                 console.log("No lessons available, clearing selected lesson.");
                 if (isMounted) setSelectedLessonId(null);
            }


        } catch (error: any) {
           console.error("Error fetching initial data for logged-in user:", error);
           if (isMounted) {
               setError(`Erro ao carregar dados: ${error.message}`);
               setLessons([]);
               setUserProfile(null);
           }
        } finally {
             if (isMounted) setIsLoading(false); // Finish loading
        }

      } else {
        // --- User is Logged Out ---
         console.log("User logged out. Fetching public lessons only.");
         try {
            const lessonsCol = collection(db, "lessons");
            // Fetch only non-premium lessons for logged-out users
            const lessonsQuery = query(lessonsCol, where("isPremium", "!=", true), orderBy("isPremium"), orderBy("category", "asc"), orderBy("createdAt", "asc"));
            const lessonSnapshot = await getDocs(lessonsQuery);
            const fetchedLessons = lessonSnapshot.docs.map(doc => ({
                id: doc.id,
                completed: false, // Logged out users have no progress
                category: doc.data().category ?? "Geral",
                isPremium: false, // Only fetching non-premium
                supportToolIds: doc.data().supportToolIds ?? [],
                ...doc.data()
            })) as Lesson[];

            if (!isMounted) return;
            console.log(`Fetched ${fetchedLessons.length} public lessons.`);
            setLessons(fetchedLessons);
            setUserProfile(null); // Clear profile
             setActiveTab('aulas'); // Default to aulas tab

             // Set initial lesson for logged-out user
             if (!selectedLessonId && fetchedLessons.length > 0) {
                 const lessonIdFromUrl = searchParams.get('lessonId');
                 const targetLessonId = lessonIdFromUrl && fetchedLessons.some(l => l.id === lessonIdFromUrl)
                     ? lessonIdFromUrl
                     : fetchedLessons[0].id;
                  console.log(`Setting initial/URL lesson for logged-out user: ${targetLessonId}`);
                 if (isMounted) setSelectedLessonId(targetLessonId);
             } else if (fetchedLessons.length === 0) {
                  console.log("No public lessons available.");
                 if (isMounted) setSelectedLessonId(null);
             }

         } catch (error: any) {
              console.error("Error fetching public lessons:", error);
             if (isMounted) {
                 setError(`Erro ao carregar aulas públicas: ${error.message}`);
                 setLessons([]);
             }
         } finally {
             if (isMounted) setIsLoading(false); // Finish loading
         }
      }
    }, (error) => {
       // Handle auth listener errors
       console.error("Error in Firebase Auth listener:", error);
       if (isMounted) {
           setError("Erro na verificação de autenticação.");
           setUser(null);
           setUserProfile(null);
           setLessons([]);
           setIsLoading(false);
       }
    });

    // Cleanup function
    return () => {
      isMounted = false;
      console.log("Cleaning up Firebase Auth listener and data listeners.");
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeProgress) unsubscribeProgress();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Rerun only on mount/unmount

    // Effect to detect rank changes and trigger the modal
    useEffect(() => {
        if (userProfile && userProfile.rank) {
            // Check if there was a previous rank and it's different from the current one
            if (previousRankRef.current && previousRankRef.current !== userProfile.rank && ranks[previousRankRef.current] && ranks[userProfile.rank]) {
                console.log(`Rank changed from ${previousRankRef.current} to ${userProfile.rank}. Triggering level up modal.`);
                setLevelUpInfo({
                    oldRank: previousRankRef.current,
                    newRank: userProfile.rank,
                });
            }
            // Update the ref with the current rank for the next comparison
            previousRankRef.current = userProfile.rank;
        }
    }, [userProfile]);


  const updateUserProgress = async (lessonId: string, completed: boolean) => {
    if (!db || !user) {
      console.warn("Firestore or user not available for update.");
      toast({ title: "Erro", description: "Não foi possível salvar o progresso (não conectado).", variant: "destructive" });
      return;
    }
    const userDocRef = doc(db, "userProgress", user.uid);
    console.log(`Attempting to update progress for lesson ${lessonId} to ${completed} for user ${user.uid}`);
    try {
      // Use updateDoc to only modify the specific lesson field
      // This avoids overwriting other completed lessons if the doc exists
      await updateDoc(userDocRef, {
        [`completedLessons.${lessonId}`]: completed,
      }).catch(async (error) => {
         // If update fails because the document doesn't exist, create it first
         // This is also handled by the snapshot listener, but good to have redundancy
         if (error.code === 'not-found') {
           console.log("Progress document not found during update, creating it.");
           await setDoc(userDocRef, { completedLessons: { [lessonId]: completed } });
         } else {
           // Re-throw other errors
           throw error;
         }
      });
       console.log(`Successfully updated lesson ${lessonId} to completed=${completed} in Firestore.`);
    } catch (e: any) {
      console.error(`Error updating user progress for lesson ${lessonId}:`, e);
      setError(`Erro ao salvar progresso (${e.code || 'desconhecido'}).`);
       toast({ title: "Erro", description: "Não foi possível salvar seu progresso.", variant: "destructive" });
        // Revert optimistic update on failure? (Consider complexity)
        // Find the lesson and set its completed status back
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
            variant: "default", // More informational
            className: "bg-yellow-500 border-yellow-500 text-black" // Yellow warning toast
        });
        return;
    }

    const lessonIndex = lessons.findIndex(l => l.id === lessonId);
    if (lessonIndex === -1) {
        console.error(`Lesson with ID ${lessonId} not found locally.`);
        return;
    }

    // Optimistic UI update
    const updatedLessons = [...lessons];
    const currentLesson = updatedLessons[lessonIndex];
    const newCompletedStatus = !currentLesson.completed; // Toggle status

    updatedLessons[lessonIndex] = { ...currentLesson, completed: newCompletedStatus };
    setLessons(updatedLessons); // Update local state immediately
    console.log(`Optimistic UI: Marked lesson ${lessonId} as completed=${newCompletedStatus}.`);

    // Update Firestore in the background
    await updateUserProgress(lessonId, newCompletedStatus);

    // Show toast notification
    toast({
        title: `Aula ${newCompletedStatus ? 'Concluída' : 'Pendente'}!`,
        description: `Você marcou a aula "${currentLesson.title}" como ${newCompletedStatus ? 'concluída' : 'pendente'}.`,
        variant: newCompletedStatus ? "default" : "destructive", // Use destructive for un-marking? Or default?
        className: newCompletedStatus ? "bg-green-600 border-green-600 text-white" : ""
      });
  };


  const handleSelectLesson = (lessonId: string) => {
    console.log("Selecting lesson:", lessonId);
    setSelectedLessonId(lessonId);
     // Optionally, scroll to the main content area on mobile when a lesson is selected
    if (typeof window !== 'undefined' && window.innerWidth < 768) { // Check if mobile view (adjust breakpoint if needed)
        const mainContentElement = document.getElementById('main-content'); // Ensure MainContent has an ID
        if (mainContentElement) {
            console.log("Scrolling to main content on mobile.");
          mainContentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
     // Update URL without full page reload
     router.push(`/?lessonId=${lessonId}`, { scroll: false });
  };

  const handleSelectTool = (toolId: string) => {
    console.log("Selecting tool, navigating to:", toolId);
    // Trigger loading state for ToolsContent if needed, though direct navigation might be simpler
    setActiveTab('ferramentas'); // Ensure tools tab is active
    setSelectedLessonId(null); // Deselect any lesson
     router.push(`/tools/${toolId}`); // Navigate to the dedicated tool page
    // Optionally highlight the tool card after navigation
    // (using searchParams in ToolsContent is better for this)
  };

  const selectedLessonData = lessons.find(lesson => lesson.id === selectedLessonId);
  const completedLessonsCount = lessons.filter(l => l.completed).length;
  const progressPercentage = lessons.length > 0 ? Math.round((completedLessonsCount / lessons.length) * 100) : 0;


  const renderContent = () => {
     // Show loading indicator only if truly loading and not just waiting for auth/initial data
     if (isLoading || !siteSettings) { // Adjust condition to be more specific
      return (
        <div className="flex justify-center items-center flex-1 flex-grow">
            <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
           <p className="text-muted-foreground text-lg">Carregando Studio...</p>
        </div>
      );
    }
    // Show critical error message if Firebase failed
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
        // Centered Login Form Container
         <div className="flex flex-col justify-center items-center flex-1 flex-grow p-4">
            <div className="mb-6"> {/* Reduced margin */}
                 <Image
                     src={LOGO_URL} // Use constant for logo URL
                     alt="STUDIO PECC Logo"
                    width={80} // Slightly smaller logo
                    height={80}
                    className="rounded-sm object-contain"
                    priority
                    data-ai-hint="logo game"
                />
            </div>
            <Card className="w-full max-w-md bg-card shadow-xl border-border rounded-lg">
              <CardContent className="p-6 sm:p-8">
                <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-6 text-foreground">Login</h2>
                {error && !isLoadingSignIn && ( // Show login error only when not loading
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
                      id="email-login" // Ensure ID matches htmlFor
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
                      id="password-login" // Ensure ID matches htmlFor
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
          {/* Dialog is self-contained */}
          <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
              <SignUpForm setOpen={setIsSignUpOpen} />
          </Dialog>
        </div>
      );
    }
    
    // Show maintenance screen for non-admins if active
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

    // Logged-in user view
    const showSidebar = activeTab === 'aulas' || activeTab === 'ferramentas';

    return (
        <div className={cn(
            "flex flex-col md:flex-row flex-1 overflow-hidden",
             "md:space-x-4" // Keep space for desktop, reduced from 6
          )}>
             {/* Desktop Sidebar */}
            {showSidebar && (
                <div className="hidden md:block w-full md:w-72 lg:w-80 flex-shrink-0 md:pl-4"> {/* Added left padding for desktop */}
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

          {/* Main Content Area */}
          <div id="main-content" className="flex-1 overflow-y-auto flex flex-col p-2 md:p-0 md:pr-4"> {/* Added ID and padding adjustments */}
             {isLoading && ( // Show loading overlay for content area if loading
               <div className="flex justify-center items-center flex-grow">
                  <Loader2 className="mr-2 h-6 w-6 animate-spin text-muted-foreground" />
                 <p className="text-muted-foreground">Carregando conteúdo...</p>
               </div>
             )}
             {!isLoading && activeTab === 'aulas' && (
                <>
                  {error && !error.includes("Índice do Firestore ausente") && ( // Display non-critical errors here
                     <div className="mb-4 p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-md text-sm">
                        Erro: {error}
                     </div>
                   )}
                   {error && error.includes("Índice do Firestore ausente") && ( // Specific message for index error
                        <div className="mb-4 p-3 bg-yellow-500/10 text-yellow-600 border border-yellow-500/30 rounded-md text-sm">
                            Erro: Índice do Firestore necessário. Verifique o console (F12) para o link de criação.
                        </div>
                   )}
                  {lessons.length === 0 && !isLoading && !error ? ( // Check isLoading false as well
                     <div className="flex justify-center items-center flex-grow">
                        <p className="text-muted-foreground">Nenhuma aula disponível.</p>
                     </div>
                  ) : selectedLessonData ? (
                    <div className="w-full max-w-3xl mx-auto"> {/* Adjust max-width as needed */}
                      <MainContent
                        lesson={selectedLessonData}
                        onMarkComplete={handleMarkComplete}
                        isCompleted={selectedLessonData.completed || false}
                        isPremium={selectedLessonData.isPremium}
                        userIsPremium={userProfile?.isPremium} // Pass real-time premium status
                         onSelectTool={handleSelectTool}
                      />
                    </div>
                  ) : !error && lessons.length > 0 ? ( // Only show if no error and lessons exist
                    <div className="flex justify-center items-center flex-grow">
                        <p className="text-muted-foreground">Selecione uma aula para começar.</p>
                    </div>
                  ) : null } {/* Don't show anything if error occurred */}

                  {/* Mobile Sidebar */}
                  {showSidebar && (
                      <div className="block md:hidden mt-4 p-2"> {/* Sidebar for mobile below content */}
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
                </>
             )}
             {!isLoading && activeTab === 'ferramentas' && (
              <>
                 {/* Mobile Sidebar */}
                 {showSidebar && (
                    <div className="block md:hidden mb-4 p-2"> {/* Sidebar for mobile above content */}
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
                 <div className="w-full">
                   {/* Wrap ToolsContent in Suspense as it uses useSearchParams */}
                   <Suspense fallback={ // Add Suspense here
                     <div className="flex justify-center items-center h-full flex-grow">
                       <Loader2 className="mr-2 h-6 w-6 animate-spin text-muted-foreground" />
                       <p className="text-muted-foreground">Carregando ferramentas...</p>
                     </div>
                   }>
                    <ToolsContent selectedCategory={selectedToolCategory} />
                   </Suspense>
                </div>
              </>
             )}
            {!isLoading && activeTab === 'chat' && (
              <ChatContent userProfile={userProfile} activeChannelId={activeChatChannelId} setActiveChannelId={setActiveChatChannelId} />
            )}
            {!isLoading && activeTab === 'admin' && userProfile?.isAdmin && (
                <div className="w-full">
                  <AdminPanel />
                </div>
            )}
             {!isLoading && activeTab === 'admin' && !userProfile?.isAdmin && ( // Show access denied if not admin
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
    setError(""); // Clear previous errors
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
      console.log("Sign in successful for:", email);
       toast({ title: "Login realizado com sucesso!", description: "Bem-vindo de volta!", variant: "default", className: "bg-green-600 border-green-600 text-white" });
       // User state will be updated by onAuthStateChanged listener
       // Data fetching will be triggered by the useEffect hook watching the 'user' state
    } catch (error: any) {
       console.error("Signin Error:", error.code, error.message);
       if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
           setError("Email ou senha inválidos.");
       } else if (error.code === 'auth/invalid-email') {
           setError("O formato do email é inválido.");
       } else if (error.code === 'auth/network-request-failed') {
            setError("Erro de rede. Verifique sua conexão.");
       } else if (error.code === 'auth/too-many-requests') {
            setError("Muitas tentativas de login. Tente novamente mais tarde.");
       } else if (error.code === 'auth/operation-not-allowed') {
            setError("Login por email/senha desativado para este projeto.");
       } else {
            setError("Erro ao fazer login. Tente novamente.");
       }
    } finally {
        setIsLoadingSignIn(false);
    }
  }

  async function handleSignOut() {
    if (!auth) {
      console.error("Signout failed: Auth not initialized.");
      setError("Erro ao sair (Auth não inicializado).");
      return;
    }
    setIsSigningOut(true);
    setError(""); // Clear previous errors
    try {
      await signOut(auth);
      console.log("Sign out successful via button click.");
      toast({ title: "Logout realizado com sucesso!", variant: "default" });
      // State clearing (userProfile, lessons completion) happens in the onAuthStateChanged listener
      // Resetting tabs/selection also happens there
    } catch (error: any) {
       console.error("Signout Error:", error);
      setError("Erro ao sair: " + error.message);
       toast({ title: "Erro ao Sair", description: error.message, variant: "destructive" });
    } finally {
      setIsSigningOut(false);
    }
  }

   // Log user profile changes for debugging
   useEffect(() => {
     console.log("UserProfile state updated in component:", userProfile);
   }, [userProfile]);


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
          --header-height: 64px; /* Consistent header height */
          --footer-height: 56px; /* Consistent footer height */
        }
        /* Basic scrollbar styling */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: hsl(var(--muted) / 0.2);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.5);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
           background: hsl(var(--muted-foreground) / 0.7);
        }
        /* Login container specific styles */
         .login-container-layout {
             display: flex;
             flex-direction: column;
             min-height: calc(100vh - var(--footer-height)); /* Subtract only footer */
             /* No header subtracted here */
         }
         .login-content-wrapper {
             flex-grow: 1; /* Allow content to grow */
             display: flex;
             justify-content: center; /* Center horizontally */
             align-items: center; /* Center vertically */
             padding: 1rem; /* Add some padding */
         }
         /* Logged-in layout */
         .logged-in-layout {
            display: flex;
            flex-direction: column;
            min-height: screen; /* Full height */
         }
          .logged-in-content-wrapper {
              display: flex;
              flex: 1; /* Grow to fill space between header/footer */
              overflow: hidden; /* Prevent double scrollbars */
              padding: 1rem; /* Base padding */
              padding-top: 1rem; /* Adjust top padding */
               padding-bottom: 1rem; /* Adjust bottom padding */
              padding-right: 1rem; /* Adjust right padding */
              padding-left: 0; /* Remove left padding for sidebar integration */
               /* Media query for desktop */
              @media (min-width: 768px) {
                padding-left: 1rem; /* Add left padding back on desktop */
               }
          }
      `}</style>

       {/* Conditionally render Header */}
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
       {/* Apply layout classes conditionally */}
        <div className={cn(
            !isLoggedIn ? "login-container-layout" : "logged-in-layout"
         )}>
            {/* Apply content wrapper class */}
            <div className={cn(
                !isLoggedIn ? "login-content-wrapper" : "logged-in-content-wrapper"
             )}>
               {/* Wrap the content rendering in Suspense */}
                <Suspense fallback={
                   <div className="flex justify-center items-center flex-1 flex-grow">
                        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                       <p className="text-muted-foreground">Carregando...</p>
                    </div>
                }>
                 {renderContent()}
                </Suspense>
            </div>
        </div>
    </div>
  );
}
