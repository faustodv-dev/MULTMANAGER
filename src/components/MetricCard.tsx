import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'destructive';
  onClick?: () => void;
}

const variantStyles = {
  default: 'bg-gradient-to-br from-card via-card to-muted/30 border-border/50',
  accent: 'bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 border-primary/20',
  success: 'bg-gradient-to-br from-emerald-50 via-emerald-100/50 to-emerald-50 dark:from-emerald-950/30 dark:via-emerald-900/20 dark:to-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  warning: 'bg-gradient-to-br from-amber-50 via-amber-100/50 to-amber-50 dark:from-amber-950/30 dark:via-amber-900/20 dark:to-amber-950/30 border-amber-200 dark:border-amber-800',
  destructive: 'bg-gradient-to-br from-red-50 via-red-100/50 to-red-50 dark:from-red-950/30 dark:via-red-900/20 dark:to-red-950/30 border-red-200 dark:border-red-800',
};

const iconContainerStyles = {
  default: 'bg-primary/10 text-primary ring-primary/20',
  accent: 'bg-primary/20 text-primary ring-primary/30',
  success: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 ring-amber-500/30',
  destructive: 'bg-red-500/20 text-red-600 dark:text-red-400 ring-red-500/30',
};

const valueStyles = {
  default: 'text-foreground',
  accent: 'text-primary',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  destructive: 'text-red-600 dark:text-red-400',
};

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  variant = 'default',
  onClick
}: MetricCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 transition-all duration-300",
        "hover:shadow-xl hover:-translate-y-1 hover:border-primary/30",
        "group",
        onClick && "cursor-pointer",
        !onClick && "cursor-default",
        variantStyles[variant]
      )}
    >
      {/* Decorative elements */}
      <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-2xl group-hover:from-primary/10 transition-all" />
      <div className="absolute -left-4 -bottom-4 w-16 h-16 rounded-full bg-gradient-to-tr from-primary/5 to-transparent blur-xl" />
      
      <div className="relative flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </p>
          
          <div className="flex items-baseline gap-3">
            <p className={cn(
              "text-4xl font-bold tracking-tight",
              valueStyles[variant]
            )}>
              {value}
            </p>
            
            {trend && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                trend === 'up' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400",
                trend === 'down' && "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400",
                trend === 'neutral' && "bg-muted text-muted-foreground"
              )}>
                <TrendIcon className="w-3 h-3" />
                {trendValue && <span>{trendValue}</span>}
              </div>
            )}
          </div>
          
          {subtitle && (
            <p className="text-xs text-muted-foreground font-medium">{subtitle}</p>
          )}
        </div>
        
        <div className={cn(
          "p-3.5 rounded-2xl ring-2 ring-offset-2 ring-offset-background transition-all duration-300",
          "group-hover:scale-110 group-hover:rotate-3",
          iconContainerStyles[variant]
        )}>
          <Icon className="w-6 h-6" strokeWidth={2} />
        </div>
      </div>

      {/* Bottom progress bar decoration */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
