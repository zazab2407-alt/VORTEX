import { useEffect } from 'react';
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | VORTEX` : 'VORTEX | Premium Sportswear';
  }, [title]);
}
