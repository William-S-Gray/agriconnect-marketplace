import Link from 'next/link';
import { Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="neo-card w-20 h-20 rounded-full flex items-center justify-center mb-6">
        <Sprout className="h-10 w-10 text-muted-foreground" />
      </div>
      <h1 className="font-heading text-3xl font-bold text-foreground">Page not found</h1>
      <p className="text-muted-foreground mt-2 max-w-sm">
        That page does not exist, or the listing has been removed.
      </p>
      <div className="flex gap-3 mt-6">
        <Link href="/"><Button className="neo-btn bg-primary text-primary-foreground">Go home</Button></Link>
        <Link href="/browse"><Button variant="outline" className="neo-flat border-none">Browse produce</Button></Link>
      </div>
    </main>
  );
}
