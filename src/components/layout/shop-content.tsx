
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, BrainCircuit, ShoppingCart, Tag, Search, ArrowRight, LayoutGrid, List, Bot } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { Tool } from './tools-content';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as LucideIcons from 'lucide-react';

export interface QuoteService {
    id: string;
    title: string;
    description: string;
    icon: keyof typeof LucideIcons;
    createdAt?: any;
}


interface ShopContentProps {
  onServiceRequest: (type: 'quote' | 'purchase', details: string) => void;
}

// Reusable component to render a grid of items
const ItemsGrid = ({ items, isLoading, onPurchaseClick }: { items: Tool[], isLoading: boolean, onPurchaseClick: (itemName: string) => void }) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-16 bg-secondary/30 rounded-lg">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhum produto encontrado</h3>
                <p className="mt-1 text-sm text-muted-foreground">Não há itens nesta categoria no momento.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map(item => (
              <Card 
                key={item.id} 
                className="flex flex-col bg-card border rounded-lg shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                  <CardHeader className="p-0 relative">
                     {item.price !== undefined && item.price > 0 ? (
                         <Badge className="absolute top-3 right-3 z-10 text-base" variant="default">
                            R$ {item.price.toFixed(2).replace('.', ',')}
                         </Badge>
                     ) : (
                         <Badge className="absolute top-3 right-3 z-10 text-base" variant="secondary">
                            Grátis
                         </Badge>
                     )}
                     <div className="aspect-video relative bg-muted">
                        {item.images && item.images.length > 0 ? (
                            <Image src={item.images[0]} alt={item.name} fill className="object-cover" data-ai-hint="store item" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                <ShoppingCart className="h-12 w-12"/>
                            </div>
                        )}
                     </div>
                  </CardHeader>
                  <CardContent className="p-4 flex-grow flex flex-col">
                      <CardTitle className="text-lg font-semibold mb-2 line-clamp-1">{item.name}</CardTitle>
                      <CardDescription className="text-sm text-muted-foreground mb-3 flex-grow line-clamp-2">
                          {item.description}
                      </CardDescription>
                       {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {item.tags.map(tag => (
                                <Badge key={tag} variant="outline" className="text-xs capitalize">{tag}</Badge>
                            ))}
                        </div>
                       )}
                  </CardContent>
                   <CardFooter className="p-4 pt-0">
                       <Button className="w-full" variant="outline" onClick={() => onPurchaseClick(item.name)}>
                           <ShoppingCart className="mr-2 h-4 w-4" />
                           Tenho Interesse
                       </Button>
                   </CardFooter>
              </Card>
            ))}
        </div>
    );
};


export default function ShopContent({ onServiceRequest }: ShopContentProps) {
  const [storeItems, setStoreItems] = useState<Tool[]>([]);
  const [quoteServices, setQuoteServices] = useState<QuoteService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Fetch all store items and quote services
  useEffect(() => {
    const fetchContent = async () => {
      if (!db) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // Fetch Store Items
        const itemsQuery = query(
          collection(db, 'tools'),
          where('category', '==', 'loja'),
          orderBy('createdAt', 'desc')
        );
        const itemsSnapshot = await getDocs(itemsQuery);
        const fetchedItems = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool));
        setStoreItems(fetchedItems);

        // Fetch Quote Services
        const quotesQuery = query(collection(db, 'quoteServices'), orderBy('createdAt', 'asc'));
        const quotesSnapshot = await getDocs(quotesQuery);
        const fetchedQuotes = quotesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuoteService));
        setQuoteServices(fetchedQuotes);

      } catch (error) {
        console.error("Error fetching shop content:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchContent();
  }, []);
  
  // Filter items based on tags for different tabs
  const readyMaps = useMemo(() => storeItems.filter(item => item.tags?.includes('mapa')), [storeItems]);
  const favelas = useMemo(() => storeItems.filter(item => item.tags?.includes('favela')), [storeItems]);

  const handlePurchaseClick = (itemName: string) => {
    onServiceRequest('purchase', itemName);
  };
  
  const handleQuoteClick = (serviceTitle: string) => {
      onServiceRequest('quote', serviceTitle);
  };

  const getIcon = (iconName: keyof typeof LucideIcons) => {
    const Icon = LucideIcons[iconName];
    return Icon ? <Icon className="w-10 h-10 mb-4 text-primary" /> : <Bot className="w-10 h-10 mb-4 text-primary"/>;
  };

  return (
    <div className="flex-1 container mx-auto py-8 md:py-12 px-4 sm:px-6 lg:px-8">
       <Tabs defaultValue="ready-maps" className="w-full">
         <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mb-8">
            <TabsTrigger value="ready-maps">Mapas Prontos</TabsTrigger>
            <TabsTrigger value="favelas">Favelas</TabsTrigger>
            <TabsTrigger value="quotes">Orçamentos de Mapas</TabsTrigger>
         </TabsList>
         
         <TabsContent value="ready-maps">
            <ItemsGrid items={readyMaps} isLoading={isLoading} onPurchaseClick={handlePurchaseClick} />
         </TabsContent>
         
         <TabsContent value="favelas">
            <ItemsGrid items={favelas} isLoading={isLoading} onPurchaseClick={handlePurchaseClick} />
         </TabsContent>

         <TabsContent value="quotes">
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {quoteServices.map(service => (
                         <Card key={service.id} className="flex flex-col bg-card border rounded-lg shadow-sm overflow-hidden text-center items-center p-6">
                            <CardHeader>
                                {getIcon(service.icon)}
                                <CardTitle>{service.title}</CardTitle>
                                <CardDescription className="text-muted-foreground pt-2">
                                    {service.description}
                                </CardDescription>
                            </CardHeader>
                            <CardFooter className="mt-auto">
                                <Button className="w-full" onClick={() => handleQuoteClick(service.title)}>
                                    <Bot className="mr-2 h-4 w-4" /> Solicitar Orçamento
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
         </TabsContent>
       </Tabs>
    </div>
  );
}
