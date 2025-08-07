'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Import Badge
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Trash2, Plus, AlertTriangle, Wrench, Star } from 'lucide-react'; // Import icons, added Star
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
import type { Tool } from '@/components/layout/tools-content'; // Assuming Tool type is defined here

// Define categories - reuse or import from AddToolForm/Sidebar
const toolCategoriesMap = {
  'mapas': 'Mapas',
  'texturas': 'Texturas',
  'scripts': 'Scripts',
  'modelos': 'Modelos 3D',
  'geral': 'Geral',
  'loja': 'Loja',
};

const getCategoryName = (categoryId: string): string => {
    return toolCategoriesMap[categoryId as keyof typeof toolCategoriesMap] || categoryId;
};


interface ManageToolsListProps {
    setSection: (section: 'overview' | 'add-lesson' | 'manage-users' | 'add-tool' | 'manage-tools' | 'manage-lessons' | 'edit-lesson' | 'edit-tool' | 'settings' | 'manage-codes') => void;
    onEditTool: (tool: Tool) => void; // Function to handle editing a tool
}

const ManageToolsList = ({ setSection, onEditTool }: ManageToolsListProps) => {
    const [tools, setTools] = useState<Tool[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toolToDelete, setToolToDelete] = useState<Tool | null>(null); // State for delete confirmation
    const { toast } = useToast();

    const fetchTools = async () => {
         if (!db) {
             setError("Erro de conexão com o banco de dados.");
             setIsLoading(false);
             return;
         }
        setIsLoading(true);
        setError(null);
        try {
            const toolsCol = collection(db, "tools");
            const toolsQuery = query(toolsCol, orderBy("createdAt", "desc"));
            const toolSnapshot = await getDocs(toolsQuery);

            const fetchedTools = toolSnapshot.docs.map(doc => ({
                id: doc.id,
                requiredPlan: doc.data().requiredPlan || 'none', // Fetch requiredPlan
                ...doc.data()
            })) as Tool[];

            setTools(fetchedTools);
        } catch (e: any) {
            console.error("Error fetching tools: ", e);
            setError(`Erro ao carregar ferramentas: ${e.message || 'Erro desconhecido'}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTools();
    }, []); // Fetch tools on component mount

    const handleDeleteClick = (tool: Tool) => {
        setToolToDelete(tool);
    };

    const confirmDelete = async () => {
        if (!toolToDelete || !db) return;

        const toolId = toolToDelete.id;
        const toolName = toolToDelete.name; // Store name for toast message

        try {
            const toolDocRef = doc(db, "tools", toolId);
            await deleteDoc(toolDocRef);

            // Update local state after successful deletion
            setTools(prevTools => prevTools.filter(t => t.id !== toolId));
            setToolToDelete(null); // Close the dialog

            toast({
                title: "Ferramenta Excluída!",
                description: `A ferramenta "${toolName}" foi removida com sucesso.`,
                variant: "default",
            });

        } catch (e: any) {
            console.error("Error deleting tool: ", e);
            toast({
                title: "Erro ao Excluir",
                description: `Não foi possível remover a ferramenta "${toolName}": ${e.message}`,
                variant: "destructive",
            });
            setToolToDelete(null); // Close the dialog even on error
        }
    };

     const getPlanBadgeVariant = (plan: string | null | undefined) => {
        switch (plan) {
            case 'basic': return 'outline'; // Yellow outline for basic
            case 'pro': return 'default'; // Default (primary) for pro
            default: return 'secondary'; // Secondary for free/none
        }
     };

    const getPlanBadgeClassName = (plan: string | null | undefined) => {
        switch (plan) {
            case 'basic': return 'border-yellow-500 text-yellow-600';
            case 'pro': return 'bg-primary text-primary-foreground'; // Adjust if needed
            default: return ''; // Default secondary styling
        }
     };


    if (isLoading) {
        return (
             <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-md bg-muted" />
                <Skeleton className="h-10 w-full rounded-md bg-muted" />
                <Skeleton className="h-10 w-full rounded-md bg-muted" />
                <p className="text-center text-muted-foreground">Carregando ferramentas...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-destructive bg-destructive/10 p-4 rounded-md border border-destructive/30">
                 <AlertTriangle className="w-10 h-10 mb-2" />
                <p className="text-center font-medium">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
             {/* Add New Tool Button */}
            <div className="flex justify-end">
                <Button size="sm" onClick={() => setSection('add-tool')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Nova Ferramenta
                </Button>
            </div>

             {/* Tools Table */}
            <div className="overflow-x-auto border rounded-md border-border">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Categoria</TableHead>
                            <TableHead>Versão</TableHead>
                            <TableHead>Tamanho</TableHead>
                            <TableHead>Plano Necessário</TableHead> {/* Changed column header */}
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tools.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground"> {/* Adjusted colSpan */}
                                    <div className="flex flex-col items-center justify-center">
                                        <Wrench className="w-8 h-8 mb-2" />
                                        <span>Nenhuma ferramenta adicionada ainda.</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            tools.map((tool) => (<TableRow key={tool.id}>
                                    <TableCell className="font-medium text-foreground">{tool.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{getCategoryName(tool.category)}</TableCell>
                                    <TableCell className="text-muted-foreground">{tool.version}</TableCell>
                                    <TableCell className="text-muted-foreground">{tool.size}</TableCell>
                                    {/* Required Plan Cell */}
                                     <TableCell className="text-center">
                                         <Badge
                                            variant={getPlanBadgeVariant(tool.requiredPlan)}
                                            className={`capitalize text-xs px-2 py-0.5 ${getPlanBadgeClassName(tool.requiredPlan)}`}
                                        >
                                             {tool.requiredPlan === 'basic' || tool.requiredPlan === 'pro' ? <Star className="h-3 w-3 mr-1" /> : null}
                                            {tool.requiredPlan || 'Grátis'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 text-primary border-primary hover:bg-primary/10"
                                            onClick={() => onEditTool(tool)} // Pass the tool data to edit
                                            title="Editar Ferramenta"
                                            disabled={isLoading} // Disable while loading?
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive border-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteClick(tool)}
                                                    title="Excluir Ferramenta"
                                                    disabled={isLoading} // Disable while loading?
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            {/* Keep DialogContent inside trigger scope if needed, or manage open state */}
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Tem certeza que deseja excluir a ferramenta "{toolToDelete?.name}"? Esta ação não pode ser desfeita.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel onClick={() => setToolToDelete(null)}>Cancelar</AlertDialogCancel>
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
              {tools.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    Exibindo {tools.length} ferramenta(s).
                </p>
            )}
        </div>
    );
};

export default ManageToolsList;
