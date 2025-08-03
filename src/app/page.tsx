
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import HomeDynamicLoader from '@/components/page/home-dynamic-loader'; // Import the new client component

// Metadata should remain in the server component (page.tsx)
export const metadata: Metadata = {
  title: 'STUDIO PECC',
  description: 'Learn game modding online',
};

export default function Page() {
  return (
    // The Suspense boundary here wraps the client component that handles dynamic import.
    // The loading state for the dynamically imported component is handled within HomeDynamicLoader.
    <Suspense fallback={
      <div className="flex-grow flex justify-center items-center min-h-[calc(100vh-var(--header-height,0px)-var(--footer-height,0px))]">  {/* Adjusted height */}
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Carregando...</p>
      </div>
    }>
      <HomeDynamicLoader />
    </Suspense>
  );
}
