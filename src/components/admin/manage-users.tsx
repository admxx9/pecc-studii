
'use client';

import React, { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase'; // Import auth if needed for future actions
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, updateDoc, Timestamp } from "firebase/firestore"; // Added updateDoc, Timestamp
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { User, Pencil, Trash2, AlertTriangle, MoreHorizontal, Star, Crown, CalendarClock } from 'lucide-react'; // Added Star, Crown, CalendarClock
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button'; // Import Button
import { useToast } from "@/hooks/use-toast"; // Import useToast
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Import AlertDialog components
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"; // Import Dialog for editing
import EditUserForm from './edit-user-form'; // Import the new EditUserForm component
import { ranks } from '@/config/ranks'; // Import ranks from config file
import { cn } from '@/lib/utils'; // Import cn
import { format } from 'date-fns'; // Import format function for dates
import { ptBR } from 'date-fns/locale'; // Import ptBR locale

// Define ranks and their display names/descriptions (Moved to config/ranks.ts)
// export const ranks: { [key: string]: string } = { ... };

export interface UserProfile {
    id: string;
    uid?: string; // Keep uid if used elsewhere, id is Firestore doc ID
    displayName: string;
    rank: string;
    isAdmin: boolean;
    photoURL: string | null;
    email?: string;
    isPremium?: boolean; // Keep isPremium for filtering/checks if needed
    premiumPlanType?: 'basic' | 'pro' | null; // Added premium plan type
    premiumExpiryDate?: Timestamp | null; // Added premium expiry date
    // Removed redeemedCode as it's not stored directly in the user profile
    bannerURL?: string | null;
}

interface UserProgress {
    completedLessons?: { [lessonId: string]: boolean };
}


const ManageUsers = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [progressData, setProgressData] = useState<{ [userId: string]: UserProgress }>({}); // Corrected useState syntax
    const [totalLessons, setTotalLessons] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null); // Corrected useState syntax
    const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null); // State for delete confirmation
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); // State for edit dialog
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null); // State for user being edited
    const { toast } = useToast();

     // Fetch total number of lessons for progress calculation
     useEffect(() => {
        const fetchLessonCount = async () => {
            if (!db) return;
            const lessonsCol = collection(db, "lessons");
            try {
                const snapshot = await getDocs(lessonsCol);
                setTotalLessons(snapshot.size);
                 console.log("Total lessons count:", snapshot.size);
            } catch (e) {
                console.error("Error fetching lesson count: ", e);
                 setError("Erro ao carregar contagem de aulas.");
            }
        };
        fetchLessonCount();
    }, []);


    useEffect(() => {
        const fetchUsersAndProgress = async () => {
            if (!db) {
                 console.error("Firestore DB instance is not available.");
                setError("Erro de conexão com o banco de dados.");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            console.log("Attempting to fetch users from 'users' collection...");

            try {
                // Fetch all users from the 'users' collection
                const usersCol = collection(db, "users");
                const usersQuery = query(usersCol, orderBy("displayName", "asc"));
                const userSnapshot = await getDocs(usersQuery);

                 console.log(`Fetched ${userSnapshot.size} documents from 'users' collection.`);

                 if (userSnapshot.empty) {
                    console.warn("No documents found in the 'users' collection.");
                 }


                const fetchedUsers: UserProfile[] = userSnapshot.docs.map(doc => {
                     const data = doc.data();
                    return {
                        id: doc.id, // Firestore document ID
                        uid: data.uid || doc.id, // Auth UID, fallback to doc ID if needed
                        displayName: data.displayName || 'Nome Indisponível',
                        email: data.email || undefined,
                        rank: data.rank || 'iniciante',
                        isAdmin: data.isAdmin === true,
                        photoURL: data.photoURL || null,
                        isPremium: data.isPremium === true, // Fetch isPremium
                        premiumPlanType: data.premiumPlanType || null, // Fetch plan type
                        premiumExpiryDate: data.premiumExpiryDate || null, // Fetch expiry date
                        bannerURL: data.bannerURL || null,
                    }
                });

                 console.log("Processed users array:", fetchedUsers);
                setUsers(fetchedUsers);

                // Fetch progress for each user if users were found
                if (fetchedUsers.length > 0) {
                    console.log("Fetching progress for fetched users...");
                    const progressPromises = fetchedUsers.map(user =>
                        // Use user.id (Firestore doc ID) which should be same as uid
                        getDoc(doc(db, "userProgress", user.id)).catch(err => {
                           console.error(`Error fetching progress for user ${user.id}:`, err);
                           return null;
                        })
                    );

                    const progressSnapshots = await Promise.all(progressPromises);

                    const fetchedProgress: { [userId: string]: UserProgress } = {};
                    progressSnapshots.forEach((docSnap, index) => {
                         if (!docSnap) return;

                        const userId = fetchedUsers[index].id;
                        if (docSnap.exists()) {
                            fetchedProgress[userId] = docSnap.data() as UserProgress;
                        } else {
                            fetchedProgress[userId] = { completedLessons: {} };
                        }
                    });
                    setProgressData(fetchedProgress);
                } else {
                     console.log("No users found, skipping progress fetch.");
                     setProgressData({});
                }


            } catch (e: any) {
                 console.error("Error fetching users or progress: ", e);
                 setError(`Erro ao carregar dados dos usuários: ${e.message || 'Verifique o console'}.`);
                 if (e instanceof Error && (e as any).code === 'permission-denied') {
                    setError("Permissão negada para acessar usuários. Verifique as regras do Firestore.");
                    console.error("Firestore permission denied. Check your rules to ensure the admin user can read the 'users' collection.");
                 } else if (e instanceof Error && (e as any).code === 'unimplemented' && e.message.includes('orderBy')) {
                     setError("Erro ao ordenar usuários. Certifique-se de que o campo 'displayName' existe ou remova a ordenação.");
                     console.error("Error ordering by 'displayName'. Ensure the field exists or remove the orderBy clause.", e);
                 } else if (e.message && e.message.includes('index')) {
                     setError("Índice do Firestore ausente. Verifique o console para o link de criação.");
                     console.error("Firestore index required for query. Check console for creation link.");
                 }
                 setUsers([]);
                 setProgressData({});
            } finally {
                setIsLoading(false);
                 console.log("Finished fetching users and progress.");
            }
        };

        fetchUsersAndProgress();
    }, []); // Rerun when db instance potentially changes (though unlikely)

     const calculateProgressPercentage = (userId: string): number => {
        if (totalLessons === 0) return 0;
        const userProgress = progressData[userId];
        const completedCount = userProgress?.completedLessons
            ? Object.values(userProgress.completedLessons).filter(Boolean).length
            : 0;
        return Math.round((completedCount / totalLessons) * 100);
    };

    const getDisplayRank = (rankKey: string | null | undefined): string => {
        return ranks[rankKey?.toLowerCase() || 'iniciante'] || 'Iniciante';
    };

    const formatExpiryDate = (timestamp: Timestamp | null | undefined): string => {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        try {
            return format(timestamp.toDate(), 'dd/MM/yyyy', { locale: ptBR });
        } catch {
            return 'Data Inválida';
        }
    };


    const handleDeleteClick = (user: UserProfile) => {
        setUserToDelete(user);
    };

    // Function to delete user data (Firestore only for now)
    const confirmDelete = async () => {
        if (!userToDelete || !db) return;

        const userId = userToDelete.id;
        const userName = userToDelete.displayName;

        console.log(`Attempting to delete data for user: ${userId} (${userName})`);

        const userDocRef = doc(db, "users", userId);
        const userProgressDocRef = doc(db, "userProgress", userId);

        try {
            // 1. Delete user document from 'users' collection
            await deleteDoc(userDocRef);
            console.log(`Deleted user document for ${userId}`);

            // 2. Delete user progress document from 'userProgress' collection
            try {
                 await deleteDoc(userProgressDocRef);
                 console.log(`Deleted user progress document for ${userId}`);
            } catch (progressError: any) {
                 console.warn(`Could not delete user progress for ${userId} (might not exist):`, progressError.message);
            }

            // 3. Update local state
            setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
            setUserToDelete(null); // Close the dialog

            toast({
                title: "Dados do Usuário Excluídos!",
                description: `Os dados de ${userName} foram removidos do Firestore.`,
                variant: "default",
            });

        } catch (e: any) {
            console.error(`Error deleting data for user ${userId}: `, e);
            toast({
                title: "Erro ao Excluir Dados",
                description: `Não foi possível remover os dados de ${userName}: ${e.message}`,
                variant: "destructive",
            });
            setUserToDelete(null); // Close the dialog even on error
        }
    };

     const handleEditClick = (user: UserProfile) => {
         setEditingUser(user);
         setIsEditDialogOpen(true);
     };

     // Callback function to handle successful user update from EditUserForm
     // Updates displayName, rank, isAdmin, premiumPlanType, and implicitly isPremium
     const handleUserUpdateSuccess = (updatedUserData: Partial<UserProfile>) => {
        console.log("Received update data from form:", updatedUserData);
         setUsers(prevUsers =>
            prevUsers.map(user => {
                if (user.id === editingUser?.id) {
                    // Determine new isPremium status based on updated plan type
                    const newIsPremium = !!updatedUserData.premiumPlanType;
                    const updates = {
                        ...user,
                        displayName: updatedUserData.displayName ?? user.displayName,
                        rank: updatedUserData.rank ?? user.rank,
                        isAdmin: updatedUserData.isAdmin ?? user.isAdmin,
                        premiumPlanType: updatedUserData.premiumPlanType, // Directly use the updated plan type
                        isPremium: newIsPremium, // Update isPremium based on plan type
                         // Keep expiry date unless explicitly cleared (which happens if plan is 'none')
                        premiumExpiryDate: updatedUserData.premiumPlanType === null ? null : (updatedUserData.premiumExpiryDate ?? user.premiumExpiryDate),
                    };
                    console.log("Updating local user state for", user.id, ":", updates);
                    return updates;
                }
                return user;
            })
        );
        setIsEditDialogOpen(false); // Close the dialog
        setEditingUser(null);
         toast({
            title: "Usuário Atualizado!",
            description: `Os dados de ${updatedUserData.displayName || editingUser?.displayName} foram atualizados.`,
             variant: "default",
             className: "bg-green-600 border-green-600 text-white"
        });
     };


    if (isLoading) {
        return (
             <div className="space-y-4">
                <div className="overflow-x-auto border rounded-md border-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[60px]"><Skeleton className="h-5 w-10" /></TableHead>
                                <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                                <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                                <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                                <TableHead><Skeleton className="h-5 w-28" /></TableHead>
                                <TableHead className="text-right"><Skeleton className="h-5 w-16" /></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...Array(3)].map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                        <Skeleton className="h-8 w-8 rounded-md" />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <p className="text-center text-muted-foreground animate-pulse">Carregando usuários...</p>
            </div>
        );
    }

    if (error) {
        return (
             <div className="flex flex-col items-center justify-center h-40 text-destructive bg-destructive/10 p-4 rounded-md border border-destructive/30">
                 <AlertTriangle className="w-10 h-10 mb-2" />
                <p className="text-center font-medium">{error}</p>
                 {error.includes("Índice do Firestore ausente") && (
                     <p className="text-xs text-center mt-2">Clique no link no console do desenvolvedor (F12) para criar o índice necessário.</p>
                 )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto border rounded-md border-border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[60px]">Avatar</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Status</TableHead> {/* Combined status column */}
                            <TableHead>Premium</TableHead> {/* Added Premium Info column */}
                            <TableHead>Progresso</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 && !isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground"> {/* Adjusted colSpan */}
                                     <div className="flex flex-col items-center justify-center">
                                         <User className="w-8 h-8 mb-2" />
                                        <span>Nenhum usuário encontrado na coleção 'users'.</span>
                                        <span className="text-xs mt-1">(Certifique-se de que a coleção existe e há documentos nela)</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => {
                                const progressPercent = calculateProgressPercentage(user.id);
                                return (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <Avatar className="h-10 w-10 border-2 border-border">
                                                <AvatarImage src={user.photoURL || undefined} alt={user.displayName} />
                                                <AvatarFallback>
                                                    {user.displayName && user.displayName !== 'Nome Indisponível' ? user.displayName.substring(0, 2).toUpperCase() : <User className="h-5 w-5 text-muted-foreground" />}
                                                </AvatarFallback>
                                            </Avatar>
                                        </TableCell>
                                        <TableCell className="font-medium text-foreground">{user.displayName}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{user.email || 'N/A'}</TableCell>
                                        <TableCell>
                                             {/* Rank / Admin Status Badges */}
                                             <div className="flex flex-col items-start gap-1">
                                                {user.isAdmin ? (
                                                    <Badge variant="default" className="bg-primary text-primary-foreground text-xs px-2 py-0.5">
                                                        <Crown className="w-3 h-3 mr-1" /> ADMIN
                                                    </Badge>
                                                ) : (
                                                     <Badge variant="secondary" className="text-xs px-2 py-0.5">
                                                        {getDisplayRank(user.rank)}
                                                    </Badge>
                                                 )}
                                            </div>
                                        </TableCell>
                                         {/* Premium Info Cell */}
                                         <TableCell>
                                            {user.isPremium ? (
                                                <div className="flex flex-col items-start gap-1 text-xs">
                                                    <Badge variant="outline" className="border-yellow-500 text-yellow-600 px-2 py-0.5 capitalize"> {/* Capitalize plan name */}
                                                        <Star className="w-3 h-3 mr-1 text-yellow-500" /> Premium
                                                         ({user.premiumPlanType || 'N/A'})
                                                     </Badge>
                                                    {user.premiumExpiryDate && (
                                                        <span className="text-muted-foreground flex items-center gap-1 text-[10px] pl-1">
                                                          <CalendarClock className="w-2.5 h-2.5" /> Expira: {formatExpiryDate(user.premiumExpiryDate)}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="text-muted-foreground text-xs px-2 py-0.5">Não Premium</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Progress value={progressPercent} className="w-24 h-1.5 [&>div]:bg-accent" aria-label={`Progresso ${progressPercent}%`} />
                                                <span className="text-xs text-muted-foreground w-8 text-right">{progressPercent}%</span>
                                            </div>
                                        </TableCell>
                                         <TableCell className="text-right space-x-2">
                                             {/* Edit Button with Dialog Trigger */}
                                             <Dialog open={isEditDialogOpen && editingUser?.id === user.id} onOpenChange={(isOpen) => {
                                                    if (!isOpen) {
                                                        setEditingUser(null); // Clear editing user when dialog closes
                                                    }
                                                    setIsEditDialogOpen(isOpen);
                                                }}>
                                                <DialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 text-primary border-primary hover:bg-primary/10"
                                                        onClick={() => handleEditClick(user)}
                                                        title="Editar Usuário"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                </DialogTrigger>
                                                 {/* Ensure DialogContent is rendered only when editing a user */}
                                                {editingUser && editingUser.id === user.id && (
                                                      <DialogContent className="sm:max-w-[480px] bg-card border-border">
                                                        <EditUserForm
                                                            user={editingUser}
                                                            onUpdateSuccess={handleUserUpdateSuccess}
                                                            setOpen={setIsEditDialogOpen} // Pass function to close dialog
                                                        />
                                                    </DialogContent>
                                                 )}
                                            </Dialog>


                                             {/* Delete Button with Confirmation */}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive border-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDeleteClick(user)}
                                                        title="Excluir Dados do Usuário"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Confirmar Exclusão de Dados</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Tem certeza que deseja excluir os dados do usuário "{userToDelete?.displayName}" do Firestore?
                                                            <br />
                                                            <span className="font-bold text-destructive">Esta ação não pode ser desfeita e não excluirá a conta de autenticação do usuário.</span>
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Excluir Dados</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
            {users.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    Exibindo {users.length} usuário(s).
                </p>
            )}
        </div>
    );
};

export default ManageUsers;


    