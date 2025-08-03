import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Import Image component
import { Search, User, LogOut, Crown, Settings, UserCircle, Bell, Info, CheckCircle, AlertTriangle, Menu, Loader2, LifeBuoy, Hash } from 'lucide-react'; // Added LifeBuoy, Hash
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import { db, auth } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
  getDocs,
  or,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import type { ActiveTab } from '@/components/page/home-client-page'; // Updated import path
import { ranks } from '@/config/ranks';


interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'urgent';
  read: boolean;
  createdAt: Timestamp;
  target: 'global' | 'specific';
  targetUserId: string | null;
  targetUserEmail: string | null;
  lessonId: string | null;
}

const getNotificationStyle = (type: Notification['type']) => {
  switch (type) {
    case 'success': return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/50' };
    case 'warning': return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/50' };
    case 'urgent': return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-600/10', border: 'border-red-600/50' };
    case 'info':
    default: return { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/50' };
  }
};

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isLoggedIn: boolean;
  onSignOut: () => void;
  userName?: string | null;
  userRank?: string | null;
  isAdmin: boolean;
  userAvatarUrl?: string | null;
  isSigningOut?: boolean;
}

const LOGO_URL = "https://i.imgur.com/sXliRZl.png"; // Updated Logo URL
const DISCORD_INVITE_LINK = "https://discord.gg/YP9UraDH4k"; // Discord invite link

export default function Header({
  activeTab,
  setActiveTab,
  isLoggedIn,
  onSignOut,
  userName,
  userRank,
  isAdmin,
  userAvatarUrl,
  isSigningOut,
}: HeaderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { toast } = useToast();
  const currentUser = auth?.currentUser;
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getButtonClass = (tabName: ActiveTab) => {
    return cn(
      "hover:bg-primary/10 hover:text-primary font-semibold text-base",
      activeTab === tabName ? 'text-primary' : 'text-muted-foreground'
    );
  };

  const displayRank = ranks[userRank?.toLowerCase() || 'iniciante'] || 'Iniciante';

  useEffect(() => {
    if (!isLoggedIn || !currentUser?.email || !db) {
        console.log("Notifications: Not logged in, user email not available, or DB/Auth not ready.");
        setNotifications([]);
        setUnreadCount(0);
        return () => {};
    }

    console.log("Notifications: Setting up listener for user email:", currentUser.email);
    const notificationsCol = collection(db, "notifications");

    const queryConstraints = [
      or(
        where("target", "==", "global"),
        where("targetUserEmail", "==", currentUser.email)
      ),
      orderBy("createdAt", "desc"),
      limit(20)
    ];

    const q = query(notificationsCol, ...queryConstraints);
    console.log("Notifications: Constructed Firestore query:", q);


    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`Notifications: Received snapshot with ${snapshot.docs.length} potential docs.`);
      if (snapshot.metadata.hasPendingWrites) {
        console.log("Notifications: Snapshot has pending writes, waiting for server data.");
      }

      const fetchedNotifications = snapshot.docs.map(doc => {
          const data = doc.data();

          if (!data.title || !data.message || !data.type || !data.createdAt) {
              console.warn(`Notifications: Skipping invalid notification doc (ID: ${doc.id}):`, data);
              return null;
          }
          const createdAtTimestamp = data.createdAt?.toDate ? data.createdAt : null;
          if (!createdAtTimestamp) {
              console.warn(`Notifications: Skipping notification doc with invalid createdAt (ID: ${doc.id}):`, data.createdAt);
              return null;
          }

          return {
              id: doc.id,
              title: data.title,
              message: data.message,
              type: data.type,
              read: data.read ?? false,
              createdAt: data.createdAt,
              target: data.target ?? 'global',
              targetUserId: data.targetUserId ?? null,
              targetUserEmail: data.targetUserEmail ?? null,
              lessonId: data.lessonId ?? null,
             };
         })
        .filter(Boolean) as Notification[]; // Remove nulls from invalid docs and cast to Notification[]

      console.log("Notifications: Processed notifications:", fetchedNotifications.length, "items");

      setNotifications(fetchedNotifications); // Update state with fully typed array
      const count = fetchedNotifications.filter(n => !n.read).length;
      setUnreadCount(count);
      console.log("Notifications: Unread count:", count);

    }, (error: any) => {
      console.error("Notifications: Error fetching snapshot:", error);
       if (error.code === 'failed-precondition' || (error.message && error.message.includes("index"))) {
           console.error("Notifications: Firestore index missing! Please check the Firebase console for the required index based on this query: targetUserEmail (ASC), createdAt (DESC) OR target (ASC), createdAt (DESC). The error message link might be specific.");
           toast({
               title: "Erro Interno",
               description: "Erro ao carregar notificações. Verifique o console para detalhes (possível índice ausente).",
               variant: "destructive",
           });
       } else {
            toast({
               title: "Erro",
               description: "Não foi possível carregar notificações.",
               variant: "destructive"
           });
       }
       setNotifications([]);
       setUnreadCount(0);
    });

    return () => {
      console.log("Notifications: Cleaning up listener.");
      unsubscribe();
    }

  }, [isLoggedIn, currentUser?.email, toast, router]);


  const handlePopoverOpenChange = async (open: boolean) => {
     setIsPopoverOpen(open);
    if (open && unreadCount > 0 && db && currentUser) {
      console.log("Notifications: Popover opened, marking", unreadCount, "notifications as read for user", currentUser.uid);
      const unreadNotifications = notifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      unreadNotifications.forEach(notification => {
        const notifRef = doc(db, "notifications", notification.id);
        batch.update(notifRef, { read: true });
      });

      try {
        await batch.commit();
        console.log("Notifications: Successfully marked as read in Firestore.");
      } catch (error) {
        console.error("Notifications: Error marking as read:", error);
        toast({ title: "Erro", description: "Não foi possível marcar notificações como lidas.", variant: "destructive" });
      }
    }
  };

  const formatDate = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'Data inválida';
    try {
        if (timestamp && typeof timestamp.toDate === 'function') {
             return timestamp.toDate().toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
            });
        } else {
             console.warn("Notifications: Invalid date format received (not a Timestamp):", timestamp);
            const date = new Date(timestamp as any);
            if (!isNaN(date.getTime())) {
                 return date.toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                });
            }
        }
         return 'Data inválida';

    } catch (e) {
        console.error("Notifications: Error formatting date:", e, timestamp);
        return 'Data inválida';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setIsPopoverOpen(false); // Close popover on click

    if (notification.lessonId) {
        setActiveTab('aulas'); // Switch to Aulas tab
        router.push(`/?lessonId=${notification.lessonId}#main-content`); // Navigate to the lesson and scroll
    }
    // Add other navigation logic if needed, e.g., for tool notifications
  };

  // Added semicolon before return statement
  return (
    <header className="bg-card text-foreground px-4 md:px-6 py-3 flex items-center justify-between shadow-md h-[var(--header-height)] sticky top-0 z-30">
      {/* Left Section - Logo */}
      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Mobile Menu Button */}
         {isLoggedIn && (
             <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-primary"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Abrir Menu</span>
             </Button>
         )}
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src={LOGO_URL}
            alt="STUDIO PECC Logo"
            width={40}
            height={40}
            className="rounded-sm object-contain"
            priority
            data-ai-hint="logo game"
          />
           <span className="text-lg md:text-xl font-bold text-primary font-[Orbitron,sans-serif] ml-2">
            STUDIO PECC
          </span>
        </Link>
      </div>

       {/* Center Section - Navigation (Conditional Rendering) */}
       {isLoggedIn && (
          <nav className="hidden md:flex items-center space-x-4 md:space-x-6 absolute left-1/2 transform -translate-x-1/2">
              <Button
                variant="ghost"
                className={getButtonClass('aulas')}
                onClick={() => setActiveTab('aulas')}
              >
                Aulas
              </Button>
              <Button
                variant="ghost"
                className={getButtonClass('ferramentas')}
                onClick={() => setActiveTab('ferramentas')}
              >
                Ferramentas
              </Button>
               <Button
                variant="ghost"
                className={getButtonClass('chat')}
                onClick={() => setActiveTab('chat')}
              >
                Chat
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  className={getButtonClass('admin')}
                  onClick={() => setActiveTab('admin')}
                >
                  Painel Admin
                </Button>
              )}
          </nav>
       )}

       {/* Right Section - Profile, Notifications */}
       <div className="flex items-center space-x-2 md:space-x-3">
        {isLoggedIn ? (
          <>
             {/* User Settings Dropdown Menu */}
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button
                   variant="ghost"
                   className="relative text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full flex items-center gap-2 px-2 md:px-3 py-1 h-8 md:h-9 group" // Added group class
                 >
                   <Avatar className="h-6 w-6 md:h-7 md:w-7 border"> {/* Slightly smaller avatar */}
                       <AvatarImage src={userAvatarUrl || undefined} alt={userName || 'User Avatar'} />
                       <AvatarFallback>
                         {userName ? userName.substring(0, 2).toUpperCase() : <User className="h-3 w-3 md:h-4 md:w-4" />}
                       </AvatarFallback>
                   </Avatar>
                    <div className="hidden sm:flex items-center gap-1.5"> {/* Align items vertically */}
                       <span className="text-xs font-semibold text-foreground truncate leading-tight">{userName || 'Usuário'}</span>
                       {isAdmin ? (
                         <Badge variant="default" className="bg-primary text-primary-foreground px-1 py-0 text-[9px] font-bold flex items-center w-fit">
                           <Crown className="h-2 w-2 mr-0.5" /> ADMIN
                         </Badge>
                       ) : (
                         <Badge variant="secondary" className="text-[9px] px-1 py-0 w-fit leading-tight">{displayRank}</Badge>
                       )}
                    </div>
                    <Settings className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground group-hover:text-primary ml-1 flex-shrink-0" /> {/* Settings icon at the end */}
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-lg">
                 <DropdownMenuLabel className="px-2 py-2">
                   <div className="flex items-center gap-2">
                     <Avatar className="h-8 w-8 border">
                       <AvatarImage src={userAvatarUrl || undefined} alt={userName || 'User Avatar'} />
                       <AvatarFallback>
                         {userName ? userName.substring(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                       </AvatarFallback>
                     </Avatar>
                     <div className="flex flex-col">
                       <span className="text-sm font-semibold text-foreground truncate">{userName || 'Usuário'}</span>
                       {isAdmin ? (
                         <Badge variant="default" className="bg-primary text-primary-foreground px-1.5 py-0 text-[10px] font-bold mt-0.5 flex items-center w-fit">
                           <Crown className="h-2.5 w-2.5 mr-1" /> ADMIN
                         </Badge>
                       ) : (
                         <Badge variant="secondary" className="text-[10px] mt-0.5 px-1.5 py-0 w-fit">{displayRank}</Badge>
                       )}
                     </div>
                   </div>
                 </DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem asChild>
                   <Link href="/profile" className="flex items-center cursor-pointer text-sm">
                     <UserCircle className="mr-2 h-4 w-4" />
                     <span>Ver Perfil</span>
                   </Link>
                 </DropdownMenuItem>
                  {/* Support Link */}
                  <DropdownMenuItem asChild>
                     <Link href={DISCORD_INVITE_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer text-sm">
                       <LifeBuoy className="mr-2 h-4 w-4" />
                       <span>Suporte</span>
                     </Link>
                 </DropdownMenuItem>
                  {/* Discord Link */}
                  <DropdownMenuItem asChild>
                     <Link href={DISCORD_INVITE_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer text-sm">
                        {/* Use the provided SVG for Discord icon */}
                         <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="16" height="16" viewBox="0 0 50 50" fill="currentColor" className="mr-2 h-4 w-4">
                           <path d="M 18.90625 7 C 18.90625 7 12.539063 7.4375 8.375 10.78125 C 8.355469 10.789063 8.332031 10.800781 8.3125 10.8125 C 7.589844 11.480469 7.046875 12.515625 6.375 14 C 5.703125 15.484375 4.992188 17.394531 4.34375 19.53125 C 3.050781 23.808594 2 29.058594 2 34 C 1.996094 34.175781 2.039063 34.347656 2.125 34.5 C 3.585938 37.066406 6.273438 38.617188 8.78125 39.59375 C 11.289063 40.570313 13.605469 40.960938 14.78125 41 C 15.113281 41.011719 15.429688 40.859375 15.625 40.59375 L 18.0625 37.21875 C 20.027344 37.683594 22.332031 38 25 38 C 27.667969 38 29.972656 37.683594 31.9375 37.21875 L 34.375 40.59375 C 34.570313 40.859375 34.886719 41.011719 35.21875 41 C 36.394531 40.960938 38.710938 40.570313 41.21875 39.59375 C 43.726563 38.617188 46.414063 37.066406 47.875 34.5 C 47.960938 34.347656 48.003906 34.175781 48 34 C 48 29.058594 46.949219 23.808594 45.65625 19.53125 C 45.007813 17.394531 44.296875 15.484375 43.625 14 C 42.953125 12.515625 42.410156 11.480469 41.6875 10.8125 C 41.667969 10.800781 41.644531 10.789063 41.625 10.78125 C 37.460938 7.4375 31.09375 7 31.09375 7 C 31.019531 6.992188 30.949219 6.992188 30.875 7 C 30.527344 7.046875 30.234375 7.273438 30.09375 7.59375 C 30.09375 7.59375 29.753906 8.339844 29.53125 9.40625 C 27.582031 9.09375 25.941406 9 25 9 C 24.058594 9 22.417969 9.09375 20.46875 9.40625 C 20.246094 8.339844 19.90625 7.59375 19.90625 7.59375 C 19.734375 7.203125 19.332031 6.964844 18.90625 7 Z M 18.28125 9.15625 C 18.355469 9.359375 18.40625 9.550781 18.46875 9.78125 C 16.214844 10.304688 13.746094 11.160156 11.4375 12.59375 C 11.074219 12.746094 10.835938 13.097656 10.824219 13.492188 C 10.816406 13.882813 11.039063 14.246094 11.390625 14.417969 C 11.746094 14.585938 12.167969 14.535156 12.46875 14.28125 C 17.101563 11.410156 22.996094 11 25 11 C 27.003906 11 32.898438 11.410156 37.53125 14.28125 C 37.832031 14.535156 38.253906 14.585938 38.609375 14.417969 C 38.960938 14.246094 39.183594 13.882813 39.175781 13.492188 C 39.164063 13.097656 38.925781 12.746094 38.5625 12.59375 C 36.253906 11.160156 33.785156 10.304688 31.53125 9.78125 C 31.59375 9.550781 31.644531 9.359375 31.71875 9.15625 C 32.859375 9.296875 37.292969 9.894531 40.3125 12.28125 C 40.507813 12.460938 41.1875 13.460938 41.8125 14.84375 C 42.4375 16.226563 43.09375 18.027344 43.71875 20.09375 C 44.9375 24.125 45.921875 29.097656 45.96875 33.65625 C 44.832031 35.496094 42.699219 36.863281 40.5 37.71875 C 38.5 38.496094 36.632813 38.84375 35.65625 38.9375 L 33.96875 36.65625 C 34.828125 36.378906 35.601563 36.078125 36.28125 35.78125 C 38.804688 34.671875 40.15625 33.5 40.15625 33.5 C 40.570313 33.128906 40.605469 32.492188 40.234375 32.078125 C 39.863281 31.664063 39.226563 31.628906 38.8125 32 C 38.8125 32 37.765625 32.957031 35.46875 33.96875 C 34.625 34.339844 33.601563 34.707031 32.4375 35.03125 C 32.167969 35 31.898438 35.078125 31.6875 35.25 C 29.824219 35.703125 27.609375 36 25 36 C 22.371094 36 20.152344 35.675781 18.28125 35.21875 C 18.070313 35.078125 17.8125 35.019531 17.5625 35.0625 C 16.394531 34.738281 15.378906 34.339844 14.53125 33.96875 C 12.234375 32.957031 11.1875 32 11.1875 32 C 10.960938 31.789063 10.648438 31.699219 10.34375 31.75 C 9.957031 31.808594 9.636719 32.085938 9.53125 32.464844 C 9.421875 32.839844 9.546875 33.246094 9.84375 33.5 C 9.84375 33.5 11.195313 34.671875 13.71875 35.78125 C 14.398438 36.078125 15.171875 36.378906 16.03125 36.65625 L 14.34375 38.9375 C 13.367188 38.84375 11.5 38.496094 9.5 37.71875 C 7.300781 36.863281 5.167969 35.496094 4.03125 33.65625 C 4.078125 29.097656 5.0625 24.125 6.28125 20.09375 C 6.90625 18.027344 7.5625 16.226563 8.1875 14.84375 C 8.8125 13.460938 9.492188 12.460938 9.6875 12.28125 C 12.707031 9.894531 17.140625 9.296875 18.28125 9.15625 Z M 18.5 21 C 15.949219 21 14 23.316406 14 26 C 14 28.683594 15.949219 31 18.5 31 C 21.050781 31 23 28.683594 23 26 C 23 23.316406 21.050781 21 18.5 21 Z M 31.5 21 C 28.949219 21 27 23.316406 27 26 C 27 28.683594 28.949219 31 31.5 31 C 34.050781 31 36 28.683594 36 26 C 36 23.316406 34.050781 21 31.5 21 Z M 18.5 23 C 19.816406 23 21 24.265625 21 26 C 21 27.734375 19.816406 29 18.5 29 C 17.183594 29 16 27.734375 16 26 C 16 24.265625 17.183594 23 18.5 23 Z M 31.5 23 C 32.816406 23 34 24.265625 34 26 C 34 27.734375 32.816406 29 31.5 29 C 30.183594 29 29 27.734375 29 26 C 29 24.265625 30.183594 23 31.5 23 Z"></path>
                         </svg>
                       <span>Discord</span>
                     </Link>
                 </DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem
                   onClick={onSignOut}
                   className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer flex items-center text-sm"
                   disabled={isSigningOut}
                 >
                   {isSigningOut ? (
                     <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       <span>Saindo...</span>
                     </>
                   ) : (
                     <>
                       <LogOut className="mr-2 h-4 w-4" />
                       <span>Sair</span>
                     </>
                   )}
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>

              {/* Notification Popover */}
             <Popover open={isPopoverOpen} onOpenChange={handlePopoverOpenChange}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full h-8 w-8 md:h-9 md:w-9">
                  <Bell className="h-4 w-4 md:h-5 md:w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold ring-2 ring-background">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  <span className="sr-only">Ver Notificações ({unreadCount})</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 md:w-96 bg-card border-border shadow-lg p-0">
                <div className="p-3 font-medium border-b border-border text-foreground text-sm">Notificações</div>
                  <ScrollArea className="h-[300px] md:h-[400px]">
                    <div className="p-2 space-y-2">
                      {notifications.length === 0 ? (
                         <div className="p-4 text-sm text-muted-foreground text-center">
                          Nenhuma notificação nova.
                        </div>
                      ) : (
                         notifications.map(notification => {
                           const style = getNotificationStyle(notification.type);
                           const Icon = style.icon;
                           return (
                             <div
                               key={notification.id}
                               className={cn(
                                 "mb-2 p-3 rounded-md border text-xs relative transition-colors duration-150 cursor-pointer",
                                 style.border,
                                 !notification.read ? style.bg : 'bg-secondary/50 border-border/30',
                                 'hover:bg-accent/50'
                                )}
                               onClick={() => handleNotificationClick(notification)}
                             >
                                <div className="flex items-start gap-2">
                                   <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", style.color)} />
                                  <div className="flex-grow">
                                    <p className={cn("font-semibold text-foreground", !notification.read && style.color)}>{notification.title}</p>
                                    <p className={cn("text-muted-foreground text-[11px] leading-snug mt-0.5", !notification.read && "text-foreground/80")}>{notification.message}</p>
                                     <p className="text-[10px] text-muted-foreground/70 mt-1 text-right">{formatDate(notification.createdAt)}</p>
                                   </div>
                                 </div>
                             </div>
                           );
                         })
                      )}
                    </div>
                  </ScrollArea>
              </PopoverContent>
            </Popover>



          </>
        ) : (
           <div className="w-10 md:w-24"></div> // Placeholder to maintain layout when logged out
        )}
      </div>

       {/* Mobile Menu Overlay (Conditional Rendering) */}
       {isLoggedIn && isMobileMenuOpen && (
         <div className="absolute top-[var(--header-height)] left-0 right-0 bg-card border-t border-border shadow-md p-4 md:hidden z-40">
           <nav className="flex flex-col space-y-2">
             <Button
               variant="ghost"
               className={cn(getButtonClass('aulas'), "justify-start")}
               onClick={() => { setActiveTab('aulas'); setIsMobileMenuOpen(false); }}
             >
               Aulas
             </Button>
             <Button
               variant="ghost"
               className={cn(getButtonClass('ferramentas'), "justify-start")}
               onClick={() => { setActiveTab('ferramentas'); setIsMobileMenuOpen(false); }}
             >
               Ferramentas
             </Button>
             <Button
                variant="ghost"
                className={cn(getButtonClass('chat'), "justify-start")}
                onClick={() => { setActiveTab('chat'); setIsMobileMenuOpen(false); }}
              >
                Chat
              </Button>
             {isAdmin && (
               <Button
                 variant="ghost"
                 className={cn(getButtonClass('admin'), "justify-start")}
                 onClick={() => { setActiveTab('admin'); setIsMobileMenuOpen(false); }}
               >
                 Painel Admin
               </Button>
             )}
              {/* Mobile Menu Support and Discord Links */}
              <Button variant="ghost" className="justify-start text-muted-foreground" asChild>
                <Link href={DISCORD_INVITE_LINK} target="_blank" rel="noopener noreferrer" onClick={() => setIsMobileMenuOpen(false)}>
                   <LifeBuoy className="mr-1.5 h-4 w-4" />
                    Suporte
                </Link>
              </Button>
               <Button variant="ghost" className="justify-start text-muted-foreground" asChild>
                 <Link href={DISCORD_INVITE_LINK} target="_blank" rel="noopener noreferrer" aria-label="Join Discord Server" onClick={() => setIsMobileMenuOpen(false)}>
                   {/* Use the provided SVG for Discord icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="16" height="16" viewBox="0 0 50 50" fill="currentColor" className="mr-1.5 h-5 w-5">
                      <path d="M 18.90625 7 C 18.90625 7 12.539063 7.4375 8.375 10.78125 C 8.355469 10.789063 8.332031 10.800781 8.3125 10.8125 C 7.589844 11.480469 7.046875 12.515625 6.375 14 C 5.703125 15.484375 4.992188 17.394531 4.34375 19.53125 C 3.050781 23.808594 2 29.058594 2 34 C 1.996094 34.175781 2.039063 34.347656 2.125 34.5 C 3.585938 37.066406 6.273438 38.617188 8.78125 39.59375 C 11.289063 40.570313 13.605469 40.960938 14.78125 41 C 15.113281 41.011719 15.429688 40.859375 15.625 40.59375 L 18.0625 37.21875 C 20.027344 37.683594 22.332031 38 25 38 C 27.667969 38 29.972656 37.683594 31.9375 37.21875 L 34.375 40.59375 C 34.570313 40.859375 34.886719 41.011719 35.21875 41 C 36.394531 40.960938 38.710938 40.570313 41.21875 39.59375 C 43.726563 38.617188 46.414063 37.066406 47.875 34.5 C 47.960938 34.347656 48.003906 34.175781 48 34 C 48 29.058594 46.949219 23.808594 45.65625 19.53125 C 45.007813 17.394531 44.296875 15.484375 43.625 14 C 42.953125 12.515625 42.410156 11.480469 41.6875 10.8125 C 41.667969 10.800781 41.644531 10.789063 41.625 10.78125 C 37.460938 7.4375 31.09375 7 31.09375 7 C 31.019531 6.992188 30.949219 6.992188 30.875 7 C 30.527344 7.046875 30.234375 7.273438 30.09375 7.59375 C 30.09375 7.59375 29.753906 8.339844 29.53125 9.40625 C 27.582031 9.09375 25.941406 9 25 9 C 24.058594 9 22.417969 9.09375 20.46875 9.40625 C 20.246094 8.339844 19.90625 7.59375 19.90625 7.59375 C 19.734375 7.203125 19.332031 6.964844 18.90625 7 Z M 18.28125 9.15625 C 18.355469 9.359375 18.40625 9.550781 18.46875 9.78125 C 16.214844 10.304688 13.746094 11.160156 11.4375 12.59375 C 11.074219 12.746094 10.835938 13.097656 10.824219 13.492188 C 10.816406 13.882813 11.039063 14.246094 11.390625 14.417969 C 11.746094 14.585938 12.167969 14.535156 12.46875 14.28125 C 17.101563 11.410156 22.996094 11 25 11 C 27.003906 11 32.898438 11.410156 37.53125 14.28125 C 37.832031 14.535156 38.253906 14.585938 38.609375 14.417969 C 38.960938 14.246094 39.183594 13.882813 39.175781 13.492188 C 39.164063 13.097656 38.925781 12.746094 38.5625 12.59375 C 36.253906 11.160156 33.785156 10.304688 31.53125 9.78125 C 31.59375 9.550781 31.644531 9.359375 31.71875 9.15625 C 32.859375 9.296875 37.292969 9.894531 40.3125 12.28125 C 40.507813 12.460938 41.1875 13.460938 41.8125 14.84375 C 42.4375 16.226563 43.09375 18.027344 43.71875 20.09375 C 44.9375 24.125 45.921875 29.097656 45.96875 33.65625 C 44.832031 35.496094 42.699219 36.863281 40.5 37.71875 C 38.5 38.496094 36.632813 38.84375 35.65625 38.9375 L 33.96875 36.65625 C 34.828125 36.378906 35.601563 36.078125 36.28125 35.78125 C 38.804688 34.671875 40.15625 33.5 40.15625 33.5 C 40.570313 33.128906 40.605469 32.492188 40.234375 32.078125 C 39.863281 31.664063 39.226563 31.628906 38.8125 32 C 38.8125 32 37.765625 32.957031 35.46875 33.96875 C 34.625 34.339844 33.601563 34.707031 32.4375 35.03125 C 32.167969 35 31.898438 35.078125 31.6875 35.25 C 29.824219 35.703125 27.609375 36 25 36 C 22.371094 36 20.152344 35.675781 18.28125 35.21875 C 18.070313 35.078125 17.8125 35.019531 17.5625 35.0625 C 16.394531 34.738281 15.378906 34.339844 14.53125 33.96875 C 12.234375 32.957031 11.1875 32 11.1875 32 C 10.960938 31.789063 10.648438 31.699219 10.34375 31.75 C 9.957031 31.808594 9.636719 32.085938 9.53125 32.464844 C 9.421875 32.839844 9.546875 33.246094 9.84375 33.5 C 9.84375 33.5 11.195313 34.671875 13.71875 35.78125 C 14.398438 36.078125 15.171875 36.378906 16.03125 36.65625 L 14.34375 38.9375 C 13.367188 38.84375 11.5 38.496094 9.5 37.71875 C 7.300781 36.863281 5.167969 35.496094 4.03125 33.65625 C 4.078125 29.097656 5.0625 24.125 6.28125 20.09375 C 6.90625 18.027344 7.5625 16.226563 8.1875 14.84375 C 8.8125 13.460938 9.492188 12.460938 9.6875 12.28125 C 12.707031 9.894531 17.140625 9.296875 18.28125 9.15625 Z M 18.5 21 C 15.949219 21 14 23.316406 14 26 C 14 28.683594 15.949219 31 18.5 31 C 21.050781 31 23 28.683594 23 26 C 23 23.316406 21.050781 21 18.5 21 Z M 31.5 21 C 28.949219 21 27 23.316406 27 26 C 27 28.683594 28.949219 31 31.5 31 C 34.050781 31 36 28.683594 36 26 C 36 23.316406 34.050781 21 31.5 21 Z M 18.5 23 C 19.816406 23 21 24.265625 21 26 C 21 27.734375 19.816406 29 18.5 29 C 17.183594 29 16 27.734375 16 26 C 16 24.265625 17.183594 23 18.5 23 Z M 31.5 23 C 32.816406 23 34 24.265625 34 26 C 34 27.734375 32.816406 29 31.5 29 C 30.183594 29 29 27.734375 29 26 C 29 24.265625 30.183594 23 31.5 23 Z"></path>
                    </svg>
                    Discord
                 </Link>
               </Button>
           </nav>
         </div>
       )}
    </header>
  );
}
