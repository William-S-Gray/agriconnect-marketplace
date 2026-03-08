export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="neo-card w-20 h-20 flex items-center justify-center mx-auto mb-4 rounded-full">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-muted-foreground text-sm">{text}</p>
      </div>
    </div>
  );
}
