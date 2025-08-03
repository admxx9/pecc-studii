
'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Dynamically import the client-side Home component with ssr: false
const HomeClientPage = dynamic(() => import('@/components/page/home-client-page'), {
  ssr: false, // Ensure it's only rendered on the client side
  loading: () => (
    <div className="flex-grow flex justify-center items-center min-h-[calc(100vh-var(--header-height,0px)-var(--footer-height,0px))]"> {/* Adjusted height */}
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="ml-2 text-muted-foreground">Carregando Studio...</p>
    </div>
  ),
});

export default function HomeDynamicLoader() {
  return <HomeClientPage />;
}
