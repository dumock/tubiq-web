import { ArrowUpRight, ArrowDownRight, LucideIcon } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string;
    change: number;
    icon: LucideIcon;
    description?: string;
    onClick?: () => void;
}

export default function MetricCard({ title, value, change, icon: Icon, description, onClick }: MetricCardProps) {
    const isPositive = change >= 0;

    return (
        <div
            onClick={onClick}
            className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${onClick ? 'cursor-pointer hover:border-indigo-500 hover:ring-4 hover:ring-indigo-500/5 transition-all active:scale-[0.98]' : ''}`}
        >
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <span className="rounded-lg bg-gray-100 p-2 dark:bg-zinc-800">
                    <Icon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
            </div>

            <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex items-center text-xs font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isPositive ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
                    {Math.abs(change)}%
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {description || '전월 대비'}
                </span>
            </div>
        </div>
    );
}
