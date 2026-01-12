export function formatCompactNumber(number: number): string {
    return Intl.NumberFormat('ko-KR', {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(number);
}

export function formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).format(date).replace(/\. /g, '.').replace(/\.$/, '');
}
