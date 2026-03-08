export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">{text}</p>
      </div>
    </div>
  );
}
