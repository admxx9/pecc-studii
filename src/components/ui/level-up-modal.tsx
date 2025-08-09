
'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ranks, rankIcons } from '@/config/ranks';
import { Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import Confetti from 'react-confetti';

interface LevelUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    oldRank: string;
    newRank: string;
    userAvatar: string | null;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ isOpen, onClose, oldRank, newRank, userAvatar }) => {
    // State to control the multiple steps of the animation
    const [animationStep, setAnimationStep] = useState<'initial' | 'progress' | 'reveal' | 'finished'>('initial');
    const [progress, setProgress] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);

    // Get rank details
    const oldRankName = ranks[oldRank] || 'Desconhecido';
    const newRankName = ranks[newRank] || 'Novo Nível';
    const NewRankIcon = rankIcons[newRank] || Award;

    // This effect orchestrates the entire animation sequence
    useEffect(() => {
        if (isOpen) {
            // 1. Reset state when modal opens
            setAnimationStep('initial');
            setProgress(0);
            setShowConfetti(false);

            // 2. Start the progress bar animation after a short delay
            const progressTimer = setTimeout(() => {
                setAnimationStep('progress');
                setProgress(100);
            }, 500);

            // 3. Trigger the 'reveal' state after the progress bar animation completes
            const revealTimer = setTimeout(() => {
                setAnimationStep('reveal');
                setShowConfetti(true); // Start confetti on reveal
            }, 1700); // This delay should be slightly longer than the progress bar's CSS transition

            // 4. Set a final state for the confetti to stop
            const finishTimer = setTimeout(() => {
                setAnimationStep('finished');
            }, 4000); // Let confetti run for a few seconds

            // Cleanup timers if the component unmounts or isOpen changes
            return () => {
                clearTimeout(progressTimer);
                clearTimeout(revealTimer);
                clearTimeout(finishTimer);
            };
        }
    }, [isOpen]);

    const handleClose = () => {
        setShowConfetti(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl overflow-hidden p-0">
                {/* Render confetti when the reveal step is active */}
                {showConfetti && (
                    <Confetti
                        width={window.innerWidth}
                        height={window.innerHeight}
                        recycle={animationStep !== 'finished'} // Stop recycling when animation is 'finished'
                        numberOfPieces={animationStep === 'finished' ? 0 : 250} // Make confetti disappear
                        className="!z-[100]" // Ensure confetti is on top
                    />
                )}
                <div className="p-8 text-center relative z-10">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-3xl font-bold text-primary">Você Subiu de Nível!</DialogTitle>
                        <DialogDescription className="text-lg text-muted-foreground">Parabéns pela sua promoção!</DialogDescription>
                    </DialogHeader>

                    {/* Central Avatar Display */}
                    <div className="flex justify-center items-center mb-4 h-32">
                        <div className="relative">
                            <Avatar className={cn(
                                'h-32 w-32 border-4 transition-all duration-500 ease-out',
                                animationStep === 'reveal' || animationStep === 'finished'
                                ? 'border-yellow-500 scale-110 shadow-lg'
                                : 'border-border'
                            )}>
                                <AvatarImage src={userAvatar || undefined} />
                                <AvatarFallback>{'AV'}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>

                    {/* Rank Name Display */}
                    <div className="h-10 mb-4 flex flex-col justify-center items-center">
                         <div className={cn(
                            "flex items-center gap-2 text-muted-foreground transition-opacity duration-500",
                            animationStep === 'reveal' || animationStep === 'finished' ? 'opacity-0' : 'opacity-100'
                         )}>
                             <span className="font-semibold text-lg">{oldRankName}</span>
                         </div>
                         <div className={cn(
                            "absolute flex items-center gap-2 text-yellow-500 transition-opacity duration-500",
                             animationStep === 'reveal' || animationStep === 'finished' ? 'opacity-100' : 'opacity-0'
                         )}>
                             <NewRankIcon className="w-8 h-8" />
                             <span className="font-bold text-xl">{newRankName}</span>
                         </div>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="w-full bg-secondary rounded-full h-4 mb-8 border border-border">
                        <div
                            style={{ width: `${progress}%` }}
                            className="bg-primary h-full rounded-full transition-all duration-1000 ease-in-out"
                        ></div>
                    </div>

                    <Button onClick={handleClose} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        Continuar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default LevelUpModal;
