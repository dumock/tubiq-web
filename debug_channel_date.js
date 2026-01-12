
const parseDate = (dateStr) => {
    if (!dateStr) return null;
    try {
        console.log(`Parsing input: "${dateStr}"`);
        // Remove common prefixes
        const cleanStr = String(dateStr)
            .replace(/Joined|가입일|:|Se unió|Beitritt|Rejoit/gi, '')
            .trim();

        console.log(`Cleaned string: "${cleanStr}"`);

        // Keep only numeric and separator chars for standard parsing
        // Note: "2020. 1. 3." with dot needs care.
        const dotDate = cleanStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
        if (dotDate) {
            console.log('Matched Regex:', dotDate);
            return new Date(`${dotDate[1]}-${dotDate[2]}-${dotDate[3]}`).toISOString();
        }

        const date = new Date(cleanStr);
        if (!isNaN(date.getTime())) {
            console.log('Parsed by Date constructor');
            return date.toISOString();
        }
    } catch (e) {
        console.error('Date parse error:', e);
    }
    return null;
};

// Test cases
console.log('Test 1 (Standard):', parseDate('2026. 1. 5.'));
console.log('Test 2 (With Text):', parseDate('가입일: 2026. 1. 5.'));
console.log('Test 3 (With Spaces):', parseDate('2026.  1.   5'));
console.log('Test 4 (Invalid):', parseDate('invalid date'));
