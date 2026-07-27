export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({error: 'Method not allowed'});
  }

  const code = String(request.query?.code || '').replace(/\D/g, '');
  if (!/^\d{8,14}$/.test(code)) {
    return response.status(400).json({error: 'Enter a valid 8 to 14 digit UPC, EAN, or GTIN barcode.'});
  }

  const userKey = process.env.UPCITEMDB_USER_KEY;
  const endpoint = userKey
    ? 'https://api.upcitemdb.com/prod/v1/lookup'
    : 'https://api.upcitemdb.com/prod/trial/lookup';
  const headers: Record<string, string> = {Accept: 'application/json'};
  if (userKey) {
    headers.user_key = userKey;
    headers.key_type = '3scale';
  }

  try {
    const lookupResponse = await fetch(`${endpoint}?upc=${encodeURIComponent(code)}`, {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    const body = await lookupResponse.text();
    let payload: any = {};
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      return response.status(502).json({error: 'The barcode service returned an invalid response.'});
    }

    if (lookupResponse.status === 404 || !payload?.items?.length) {
      return response.status(404).json({
        error: 'No verified product information was found for this barcode.',
      });
    }
    if (!lookupResponse.ok) {
      return response.status(lookupResponse.status).json({
        error: lookupResponse.status === 429
          ? 'The barcode lookup limit has been reached. Please try again later.'
          : payload?.message || 'The barcode lookup service is unavailable.',
      });
    }

    const item = payload.items[0];
    response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return response.status(200).json({
      found: true,
      barcode: code,
      name: String(item.title || '').trim(),
      brand: String(item.brand || '').trim(),
      category: String(item.category || '').trim(),
      description: String(item.description || '').trim(),
      image: Array.isArray(item.images) ? String(item.images[0] || '') : '',
      source: 'UPCitemdb',
    });
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error && error.name === 'TimeoutError'
        ? 'The barcode lookup timed out. Please try again.'
        : 'Unable to contact the barcode lookup service.',
    });
  }
}
