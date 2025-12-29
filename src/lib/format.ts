export function formatCompactNumber(number: number): string {
    return Intl.NumberFormat('ko-KR', {
        notation: "compact",
        maximumFractionDigits: 1
    }).format(number);
}

export function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).format(date).replace(/\. /g, '.').replace(/\.$/, '');
}
