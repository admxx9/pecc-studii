
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, BrainCircuit, ShoppingCart, Tag, Search, ArrowRight, LayoutGrid, List } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { Tool } from './tools-content';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';


interface ShopContentProps {
  // Props are kept in case they are needed in the future, e.g., for passing user profile
}

export default function ShopContent({}: ShopContentProps) {
  const [items, setItems] = useState<Tool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const router = useRouter();

  // Fetch store items from Firestore
  useEffect(() => {
    const fetchItems = async () => {
      if (!db) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const itemsQuery = query(
          collection(db, 'tools'),
          where('category', '==', 'loja'),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(itemsQuery);
        const fetchedItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tool));
        setItems(fetchedItems);
      } catch (error) {
        console.error("Error fetching store items:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, []);
  
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    items.forEach(item => item.tags?.forEach(tag => tagsSet.add(tag)));
    return Array.from(tagsSet).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const searchMatch = searchTerm === '' ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const tagsMatch = activeTags.length === 0 ||
        activeTags.every(tag => item.tags?.includes(tag));
      
      return searchMatch && tagsMatch;
    });
  }, [items, searchTerm, activeTags]);

  const handleTagClick = (tag: string) => {
    setActiveTags(prev => 
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleNavigateToItem = (itemId: string) => {
    router.push(`/tools/${itemId}`);
  };

  return (
    <div className="flex-1 container mx-auto py-8 md:py-12 px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="relative bg-card border border-border rounded-lg overflow-hidden mb-12 p-8 md:p-12 text-center flex flex-col items-center">
         <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
         <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-3">
              Studio PECC Store
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Encontre assets, mapas e ferramentas exclusivas para levar seu projeto para o próximo nível.
            </p>
            <Button size="lg" onClick={() => document.getElementById('store-items')?.scrollIntoView({ behavior: 'smooth' })}>
                Explorar Produtos
                <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
         </div>
      </div>

       {/* Filters Section */}
      <div id="store-items" className="mb-8 p-4 bg-secondary/50 rounded-lg border">
         <div className="flex flex-col md:flex-row gap-4">
             <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                 <Input 
                    placeholder="Buscar por nome ou descrição..."
                    className="pl-10 h-11"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
             <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-5 w-5 text-muted-foreground"/>
                 {allTags.length > 0 ? allTags.map(tag => (
                    <Button key={tag} variant={activeTags.includes(tag) ? 'default' : 'outline'} size="sm" onClick={() => handleTagClick(tag)} className="capitalize text-xs h-9">
                        {tag}
                    </Button>
                 )) : <p className="text-sm text-muted-foreground">Sem tags para filtrar.</p>}
             </div>
         </div>
      </div>

      {/* Items Grid */}
      <section>
        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
            </div>
        ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-secondary/30 rounded-lg">
                <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold text-foreground">Nenhum item encontrado</h3>
                <p className="mt-1 text-sm text-muted-foreground">Tente ajustar seus filtros de busca ou volte mais tarde.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredItems.map(item => (
              <Card 
                key={item.id} 
                className="flex flex-col bg-card border rounded-lg shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                onClick={() => handleNavigateToItem(item.id)}
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
                       <Button className="w-full" variant="outline">
                           Ver Detalhes
                           <ArrowRight className="ml-2 h-4 w-4" />
                       </Button>
                   </CardFooter>
              </Card>
            ))}
            </div>
        )}
      </section>
       <style jsx global>{`
        .bg-grid-pattern {
          background-image:
            linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px);
          background-size: 2rem 2rem;
        }
      `}</style>
    </div>
  );
}
