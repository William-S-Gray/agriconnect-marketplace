'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
  aspectRatio?: string;
}

export function LazyImage({ src, alt, className, fallback, aspectRatio = '4/3', ...props }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!src || error) {
    return (
      <div ref={imgRef} className={cn('bg-gradient-to-br from-primary/10 to-fresh/10 flex items-center justify-center', className)} style={{ aspectRatio }}>
        {fallback}
      </div>
    );
  }

  return (
    <div ref={imgRef} className={cn('relative overflow-hidden bg-muted', className)} style={{ aspectRatio }}>
      {inView && (
        <img
          src={src}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          {...props}
        />
      )}
      {inView && !loaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      {!inView && (
        <div className="absolute inset-0 bg-muted" />
      )}
    </div>
  );
}
