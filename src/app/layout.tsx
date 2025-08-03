
import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import '@fontsource/orbitron/700.css';
import './globals.css';
import { cn } from '@/lib/utils';
import { Toaster } from "@/components/ui/toaster";
import { Suspense } from 'react'; // Import Suspense
import { Loader2 } from 'lucide-react'; // Import Loader2

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});


export const metadata: Metadata = {
  title: 'STUDIO PECC',
  description: 'Learn game modding online',
  icons: {
    icon: 'https://media.discordapp.net/attachments/1165297478489342095/1360499211107565770/1744438683192.png?ex=681ba3e0&is=681a5260&hm=6a5bee1b15e35dab8ebed6b44a0f479541f3684d306120ddf6b6f40c3bfb535a&=&format=webp&quality=lossless&width=673&height=673',
  }
};

// Removed DISCORD_INVITE_LINK as it's no longer used

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased flex flex-col',
           inter.variable
        )}
      >
        <div className="flex-grow flex flex-col"> {/* Ensure flex-grow container is also flex column */}
          <Suspense fallback={
            <div className="flex-grow flex justify-center items-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          }>
            {children}
          </Suspense>
        </div>
        <Toaster />
        <footer className="w-full p-4 flex justify-end items-center mt-auto h-[var(--footer-height,56px)]"> {/* Define footer height */}
           {/* Removed Discord Button */}
        </footer>
      </body>
    </html>
  );
}
