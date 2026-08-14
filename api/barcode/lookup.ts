export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    return response.status(405).json({error: 'Method not allowed'});
  }

  const code = String(request.query?.code || '').replace(/\D/g, '');
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) {
    return response.status(400).json({error: 'Scan the complete retail barcode. UPC/EAN/GTIN codes must contain 8, 12, 13, or 14 digits.'});
  }

  const verifiedLabelProducts: Record<string, {
    name: string;
    brand: string;
    category: string;
    description: string;
  }> = {
    '6974434228290': {
      name: 'Nothing Phone (4a) Pro 8GB / 128GB Silver',
      brand: 'Nothing',
      category: 'Electronics > Mobile Phones > Smartphones',
      description: 'Nothing Phone (4a) Pro, 8GB RAM, 128GB storage, Silver.',
    },
  };
  const verifiedLabelProduct = verifiedLabelProducts[code];
  if (verifiedLabelProduct) {
    response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return response.status(200).json({
      found: true,
      barcode: code,
      ...verifiedLabelProduct,
      image: '',
      source: 'Verified product label',
    });
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

    if (!lookupResponse.ok || !payload?.items?.length) {
      const codeVariants = Array.from(new Set([code, code.padStart(12, '0'), code.padStart(13, '0')]));
      const openFactsHosts = [
        'world.openfoodfacts.org',
        'world.openproductsfacts.org',
        'world.openbeautyfacts.org',
      ];
      const fallbackResults = await Promise.all(openFactsHosts.flatMap((host) =>
        codeVariants.map(async (candidateCode) => {
          try {
            const fallbackResponse = await fetch(`https://${host}/api/v2/product/${encodeURIComponent(candidateCode)}.json`, {
              headers: {Accept: 'application/json', 'User-Agent': 'QPOS/1.0 (barcode lookup)'},
              signal: AbortSignal.timeout(6000),
            });
            if (!fallbackResponse.ok) return null;
            const fallbackPayload = await fallbackResponse.json();
            const product = fallbackPayload?.product;
            const productName = String(product?.product_name || product?.generic_name || '').trim();
            if (!productName) return null;
            const categoryTag = Array.isArray(product.categories_tags) ? product.categories_tags.at(-1) : '';
            return {
              found: true,
              barcode: candidateCode,
              name: productName,
              brand: String(product.brands || '').split(',')[0].trim(),
              category: String(product.categories || categoryTag || '').replace(/^en:/, '').trim(),
              description: String(product.generic_name || '').trim(),
              image: String(product.image_front_url || product.image_url || '').trim(),
              source: host.includes('openfoodfacts')
                ? 'Open Food Facts'
                : host.includes('openbeautyfacts')
                  ? 'Open Beauty Facts'
                  : 'Open Products Facts',
            };
          } catch {
            return null;
          }
        })
      ));
      const fallbackProduct = fallbackResults.find(Boolean);
      if (fallbackProduct) {
        response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        return response.status(200).json(fallbackProduct);
      }

      if (lookupResponse.status === 404 || !payload?.items?.length) {
        return response.status(404).json({
          error: 'No public product record exists for this barcode. Enter the item details manually once; QPOS will load them from your catalog next time.',
        });
      }
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
