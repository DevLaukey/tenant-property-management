import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Account', 'Business details', 'Choose plan'];

/** currentStep is 1-based. Steps before it render as completed. */
export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <ol className="flex items-center w-full" aria-label="Setup progress">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < currentStep;
        const active = step === currentStep;
        const isLast = step === STEPS.length;

        return (
          <li key={label} className={cn('flex items-center', !isLast && 'flex-1')}>
            <div className="flex flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                  done && 'bg-blue-600 text-white',
                  active && 'border-2 border-blue-600 bg-white text-blue-600',
                  !done && !active && 'border-2 border-gray-300 bg-white text-gray-400'
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : step}
              </span>
              <span
                className={cn(
                  'text-xs font-medium sm:text-sm whitespace-nowrap',
                  active ? 'text-gray-900' : done ? 'text-blue-600' : 'text-gray-400'
                )}
              >
                {label}
              </span>
            </div>
            {!isLast && (
              <div className={cn('mx-2 h-0.5 flex-1 sm:mx-4', done ? 'bg-blue-600' : 'bg-gray-200')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
