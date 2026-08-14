const PHONE_BRANDS = [
  'apple', 'samsung', 'oppo', 'vivo', 'xiaomi', 'redmi', 'realme', 'oneplus',
  'nothing', 'google', 'motorola', 'nokia', 'honor', 'huawei', 'poco', 'infinix',
  'tecno', 'lava', 'asus', 'sony', 'lenovo', 'lg', 'jio', 'itel',
];

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') return response.status(405).json({error: 'Method not allowed'});

  const fragment = String(request.query?.text || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9 -]{1,18}$/.test(fragment)) {
    return response.status(400).json({found: false});
  }

  try {
    const searchResponse = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(`${fragment} 5g phone`)}`,
      {headers: {'User-Agent': 'Mozilla/5.0 QPOS product lookup'}, signal: AbortSignal.timeout(6000)}
    );
    if (!searchResponse.ok) return response.status(200).json({found: false});

    const payload = await searchResponse.json();
    const suggestions = Array.isArray(payload?.[1]) ? payload[1].map(String) : [];
    const suggestion = suggestions.find((value: string) => {
      const lower = value.toLowerCase();
      return PHONE_BRANDS.some((brand) => lower.includes(brand)) &&
        !/cover|case|price|screen|protector|charger|specification/.test(lower);
    });
    if (!suggestion) return response.status(200).json({found: false});

    const brand = PHONE_BRANDS.find((candidate) => suggestion.toLowerCase().includes(candidate));
    const cleaned = suggestion
      .replace(/\b(mobile|smartphone|phone|model)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    const name = cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());

    response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return response.status(200).json({
      found: true,
      name,
      brand: brand ? brand.replace(/^./, (letter) => letter.toUpperCase()) : '',
      category: 'Smartphones',
    });
  } catch {
    return response.status(200).json({found: false});
  }
}
