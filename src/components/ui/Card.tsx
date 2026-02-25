interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className = "p-5" }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-warm-200 ${className}`}>
      {children}
    </div>
  );
}
