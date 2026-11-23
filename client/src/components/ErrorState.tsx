import { AlertTriangle, RotateCw, WifiOff } from 'lucide-react';
import { ApiClientError } from '../services/http';

interface Props { error: Error; onRetry?: () => void; title?: string; compact?: boolean }

/** Friendly, consistent failure message with a Retry button. */
export default function ErrorState({ error, onRetry, title, compact }: Props) {
  const offline = error instanceof ApiClientError && error.status === 0;
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div role="alert" className={`flex flex-col items-center text-center ${compact ? 'py-10' : 'py-20'}`}>
      <Icon size={compact ? 36 : 48} className="text-neutral-300" />
      <p className="mt-3 font-display text-3xl font-bold uppercase">{title ?? (offline ? 'Connection problem' : 'Something went wrong')}</p>
      <p className="mt-1 max-w-md text-sm text-neutral-500">{error.message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-dark mt-6"><RotateCw size={18} /> Try again</button>
      )}
    </div>
  );
}
