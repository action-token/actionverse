import { Progress } from "~/components/shadcn/ui/progress";
import { CheckCircle, Circle } from 'lucide-react';

interface ScavengerProgressProps {
    currentStep: number;
    totalSteps: number;
    className?: string;
}

export function ScavengerProgress({ currentStep, totalSteps, className = "" }: ScavengerProgressProps) {
    const progressPercentage = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

    return (
        <div className={`space-y-3 ${className}`}>
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Progress
                </span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                    {currentStep} / {totalSteps} steps
                </span>
            </div>

            <Progress
                value={progressPercentage}
                className="h-2 bg-slate-200 dark:bg-slate-700"
            />

            <div className="flex items-center space-x-2">
                {Array.from({ length: Math.min(totalSteps, 5) }).map((_, index) => (
                    <div key={index} className="flex items-center">
                        {index < currentStep ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                            <Circle className="h-4 w-4 text-slate-400" />
                        )}
                        {index < Math.min(totalSteps, 5) - 1 && (
                            <div className="w-2 h-0.5 bg-slate-300 dark:bg-slate-600 mx-1" />
                        )}
                    </div>
                ))}
                {totalSteps > 5 && (
                    <span className="text-xs text-slate-500 ml-2">+{totalSteps - 5} more</span>
                )}
            </div>
        </div>
    );
}
