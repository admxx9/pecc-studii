
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
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, Trash2, Plus, AlertTriangle, ClipboardList } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import type { QuoteService } from '@/components/layout/shop-content';

interface ManageQuoteServicesListProps {
    setSection: (section: any) => void;
    onEditQuote: (quote: QuoteService) => void;
}

const ManageQuoteServicesList = ({ setSection, onEditQuote }: ManageQuoteServicesListProps) => {
    const [services, setServices] = useState<QuoteService[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [serviceToDelete, setServiceToDelete] = useState<QuoteService | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchServices = async () => {
            if (!db) {
                setError("Erro de conexão com o banco de dados.");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const servicesCol = collection(db, "quoteServices");
                const servicesQuery = query(servicesCol, orderBy("createdAt", "asc"));
                const serviceSnapshot = await getDocs(servicesQuery);
                const fetchedServices = serviceSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as QuoteService[];
                setServices(fetchedServices);
            } catch (e: any) {
                console.error("Error fetching quote services: ", e);
                setError(`Erro ao carregar serviços: ${e.message || 'Erro desconhecido'}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchServices();
    }, []);

    const handleDeleteClick = (service: QuoteService) => {
        setServiceToDelete(service);
    };

    const confirmDelete = async () => {
        if (!serviceToDelete || !db) return;

        try {
            await deleteDoc(doc(db, "quoteServices", serviceToDelete.id));
            setServices(prev => prev.filter(s => s.id !== serviceToDelete.id));
            toast({
                title: "Serviço Excluído!",
                description: `O serviço "${serviceToDelete.title}" foi removido.`,
            });
        } catch (e: any) {
            toast({
                title: "Erro ao Excluir",
                description: e.message,
                variant: "destructive",
            });
        } finally {
            setServiceToDelete(null);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <p className="text-center text-muted-foreground">Carregando serviços...</p>
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
            <div className="flex justify-end">
                <Button size="sm" onClick={() => setSection('add-quote')}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Novo Serviço
                </Button>
            </div>
            <div className="overflow-x-auto border rounded-md border-border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>URL da Imagem</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {services.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center">
                                        <ClipboardList className="w-8 h-8 mb-2" />
                                        <span>Nenhum serviço de orçamento cadastrado.</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            services.map((service) => (
                                <TableRow key={service.id}>
                                    <TableCell className="font-medium text-foreground">{service.title}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs max-w-xs truncate">{service.description}</TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs truncate max-w-xs">{service.imageUrl}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 text-primary border-primary hover:bg-primary/10"
                                            onClick={() => onEditQuote(service)}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive border-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteClick(service)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Tem certeza que deseja excluir o serviço "{serviceToDelete?.title}"? Esta ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel onClick={() => setServiceToDelete(null)}>Cancelar</AlertDialogCancel>
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
        </div>
    );
};

export default ManageQuoteServicesList;
