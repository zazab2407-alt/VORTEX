import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="container-x flex flex-col items-center py-24 text-center">
      <p className="font-display text-[8rem] font-extrabold leading-none text-brand sm:text-[12rem]">404</p>
      <h1 className="text-4xl font-extrabold">Out of bounds</h1>
      <p className="mt-2 max-w-md text-neutral-500">The page you are looking for does not exist or has moved.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn btn-primary">Back Home</Link>
        <Link to="/shop" className="btn btn-outline">Shop All</Link>
      </div>
    </div>
  );
}
