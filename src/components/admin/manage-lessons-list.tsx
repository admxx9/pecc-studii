
'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Import Badge for premium status
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Trash2, Plus, AlertTriangle, BookOpen, Star } from 'lucide-react'; // Import icons, added Star
import { useToast } from "@/hooks/use-toast";
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
} from "@/components/ui/alert-dialog"
import type { Lesson } from '@/app/page'; // Assuming Lesson type is defined here

interface ManageLessonsListProps {
    setSection: (section: 'overview' | 'add-lesson' | 'manage-users' | 'add-tool' | 'manage-tools' | 'manage-lessons' | 'edit-lesson' | 'edit-tool' | 'settings') => void;
    onEditLesson: (lesson: Lesson) => void; // Function to handle editing a lesson
}

const ManageLessonsList = ({ setSection, onEditLesson }: ManageLessonsListProps) => {
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null); // State for delete confirmation
    const { toast } = useToast();

    const fetchLessons = async () => {
         if (!db) {
             setError("Erro de conexão com o banco de dados.");
             setIsLoading(false);
             return;
         }
        setIsLoading(true);
        setError(null);
        try {
            const lessonsCol = collection(db, "lessons");
            // Order by category first, then by creation date within category
            // Ensure Firestore index exists: category ASC, createdAt ASC
            const lessonsQuery = query(lessonsCol, orderBy("category", "asc"), orderBy("createdAt", "asc")); // Changed from module
            const lessonSnapshot = await getDocs(lessonsQuery);

            const fetchedLessons = lessonSnapshot.docs.map(doc => ({
                id: doc.id,
                completed: false, // Assuming default state, might not be needed here
                category: doc.data().category ?? "Geral", // Default to 'Geral' if not set
                isPremium: doc.data().isPremium === true, // Default to false if not set
                ...doc.data()
            })) as Lesson[];

            setLessons(fetchedLessons);
        } catch (e: any) {
            console.error("Error fetching lessons: ", e);
             // Check for specific index error
            if (e.message && e.message.includes("index")) {
                 setError("Índice do Firestore ausente para ordenar/filtrar aulas. Verifique o console do navegador para o link de criação do índice.");
                 console.error("Firestore Index Required: Please create the composite index (category ASC, createdAt ASC) using the link provided in the Firebase error message in your browser's console."); // Updated index advice
             } else {
                setError(`Erro ao carregar aulas: ${e.message || 'Erro desconhecido'}`);
             }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLessons();
    }, []); // Fetch lessons on component mount

    const handleDeleteClick = (lesson: Lesson) => {
        setLessonToDelete(lesson);
    };

    const confirmDelete = async () => {
        if (!lessonToDelete || !db) return;

        const lessonId = lessonToDelete.id;
        const lessonTitle = lessonToDelete.title; // Store title for toast message

        try {
            const lessonDocRef = doc(db, "lessons", lessonId);
            await deleteDoc(lessonDocRef);

            // Update local state after successful deletion
            setLessons(prevLessons => prevLessons.filter(l => l.id !== lessonId));
            setLessonToDelete(null); // Close the dialog

            toast({
                title: "Aula Excluída!",
                description: `A aula "${lessonTitle}" foi removida com sucesso.`,
                variant: "default",
            });

        } catch (e: any) {
            console.error("Error deleting lesson: ", e);
            toast({
                title: "Erro ao Excluir",
                description: `Não foi possível remover a aula "${lessonTitle}": ${e.message}`,
                variant: "destructive",
            });
            setLessonToDelete(null); // Close the dialog even on error
        }
    };

    if (isLoading) {
        return (
             <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-md bg-muted" />
                <Skeleton className="h-10 w-full rounded-md bg-muted" />
                <Skeleton className="h-10 w-full rounded-md bg-muted" />
                <p className="text-center text-muted-foreground">Carregando aulas...</p>
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
             {/* Add New Lesson Button - Triggers the adapted form */}
            <div className="flex justify-end">
                <Button size="sm" onClick={() => setSection('add-lesson')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Nova Aula
                </Button>
            </div>

             {/* Lessons Table */}
            <div className="overflow-x-auto border rounded-md border-border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Categoria</TableHead> {/* Changed from Módulo */}
                            <TableHead>Premium</TableHead>
                            <TableHead>Descrição (Início)</TableHead>
                            <TableHead>Data de Criação</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {lessons.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center">
                                        <BookOpen className="w-8 h-8 mb-2" />
                                        <span>Nenhuma aula adicionada ainda.</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            lessons.map((lesson) => (
                                <TableRow key={lesson.id}>
                                    <TableCell className="font-medium text-foreground">{lesson.title}</TableCell>
                                    <TableCell className="text-muted-foreground">{lesson.category}</TableCell> {/* Display category */}
                                    <TableCell className="text-center">
                                        {lesson.isPremium ? (
                                            <Badge variant="default" className="bg-yellow-500 hover:bg-yellow-600 text-black px-2 py-0.5 text-xs">
                                                <Star className="h-3 w-3 mr-1" /> Premium
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-xs px-2 py-0.5">Grátis</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs max-w-xs truncate">
                                        {lesson.description.substring(0, 60)}{lesson.description.length > 60 ? '...' : ''}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {lesson.createdAt?.toDate ? lesson.createdAt.toDate().toLocaleDateString() : 'N/A'}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 text-primary border-primary hover:bg-primary/10"
                                            onClick={() => onEditLesson(lesson)} // Pass the lesson data to edit
                                            title="Editar Aula"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive border-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteClick(lesson)}
                                                    title="Excluir Aula"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Tem certeza que deseja excluir a aula "{lessonToDelete?.title}"? Esta ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel onClick={() => setLessonToDelete(null)}>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            {lessons.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    Exibindo {lessons.length} aula(s).
                </p>
            )}
        </div>
    );
};

export default ManageLessonsList;
