
'use client';

import React, { useState, useEffect } from 'react';
import { useWindowSize } from 'react-use';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star, Gem } from 'lucide-react';
import Confetti from 'react-confetti';

interface PremiumActivatedModalProps {
    isOpen: boolean;
    onClose: () => void;
    planType: 'basic' | 'pro';
    durationDays: number;
    userAvatar: string | null;
}

const PremiumActivatedModal: React.FC<PremiumActivatedModalProps> = ({ isOpen, onClose, planType, durationDays, userAvatar }) => {
    const { width, height } = useWindowSize();
    const [showConfetti, setShowConfetti] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShowConfetti(true);
            const timer = setTimeout(() => {
                setShowConfetti(false);
            }, 5000); // Let confetti run for 5 seconds

            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleClose = () => {
        setShowConfetti(false);
        onClose();
    };

    if (!isOpen) return null;

    const planName = planType === 'pro' ? 'Pro' : 'Básico';
    const PlanIcon = planType === 'pro' ? Gem : Star;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl overflow-hidden p-0">
                {showConfetti && (
                    <Confetti
                        width={width}
                        height={height}
                        recycle={false}
                        numberOfPieces={300}
                        gravity={0.15}
                        className="!z-[100]"
                    />
                )}
                <div className="p-8 text-center relative z-10">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-3xl font-bold text-primary flex items-center justify-center gap-2">
                            <Star className="h-8 w-8 text-yellow-400" />
                            Plano Ativado!
                        </DialogTitle>
                        <DialogDescription className="text-lg text-muted-foreground">
                            Parabéns! Você agora é um membro Premium.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="bg-secondary/50 rounded-lg p-6 mb-8 border border-border">
                        <div className="flex flex-col items-center gap-2">
                             <PlanIcon className="w-12 h-12 text-yellow-500 mb-2" />
                            <p className="text-2xl font-bold text-foreground">
                                Você ativou o Plano {planName}
                            </p>
                            <p className="text-lg font-medium text-muted-foreground">
                                Válido por {durationDays} dias.
                            </p>
                        </div>
                    </div>

                    <Button onClick={handleClose} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        Explorar Benefícios
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PremiumActivatedModal;
