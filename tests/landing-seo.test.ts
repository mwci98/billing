import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('landing page exposes one keyword-rich h1 and verified product sections', async () => {
  const source = await read('src/components/LandingPage.tsx');
  assert.equal((source.match(/<h1\b/g) ?? []).length, 1);
  for (const content of ['GST billing', 'Proposals', 'Restaurant', 'Online Store', 'estimated-profit', '20-day free trial']) {
    assert.match(source, new RegExp(content, 'i'));
  }
  assert.match(source, /id="online-store"/);
  assert.match(source, /One online ordering storefront/);
  assert.match(source, /Online card payments are not included/);
});

test('index contains canonical social metadata and SoftwareApplication schema', async () => {
  const html = await read('index.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/qpos\.neospec\.co\.in\/"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /"@type": "SoftwareApplication"/);
  assert.doesNotMatch(html, /aggregateRating|reviewCount/);
  for (const phrase of ['billing software', 'POS software', 'inventory management software', 'Kohima', 'Nagaland']) {
    assert.match(html, new RegExp(phrase, 'i'));
  }
  assert.match(html, /"areaServed"/);
  assert.match(html, /"keywords"/);
  assert.doesNotMatch(html, /<meta\s+name="keywords"/i);
});

test('landing copy covers Kohima search intent naturally', async () => {
  const source = await read('src/components/LandingPage.tsx');
  for (const phrase of ['billing software in Kohima', 'POS software in Kohima', 'inventory management in Kohima', 'Kohima, Nagaland', 'businesses across India']) {
    assert.match(source, new RegExp(phrase, 'i'));
  }
  assert.doesNotMatch(source, /inventry/i);
});

test('public marketing surfaces use the dedicated amber QPOS brand treatment', async () => {
  const [landing, chat, splash, index, logo] = await Promise.all([
    read('src/components/LandingPage.tsx'),
    read('src/components/HomepageFaqChat.tsx'),
    read('src/components/SplashScreen.tsx'),
    read('index.html'),
    read('public/icons/qpos-marketing-logo.svg'),
  ]);
  assert.match(landing, /\/icons\/qpos-marketing-logo\.svg/);
  assert.match(chat, /\/icons\/qpos-marketing-logo\.svg/);
  assert.match(splash, /\/icons\/qpos-marketing-logo\.svg/);
  assert.match(index, /name="theme-color" content="#090909"/);
  assert.match(index, /qpos-startup-splash[\s\S]*qpos-marketing-logo\.svg/);
  assert.match(logo, /#ffb900/);
  assert.match(logo, /#FFFFFF/);
  for (const source of [landing, chat, splash, logo]) {
    assert.doesNotMatch(source, /emerald|green|teal|#00bc7d|16,185,129/i);
    assert.doesNotMatch(source, /(?:bg|text|border|ring|selection:bg)-amber-/i);
    assert.doesNotMatch(source, /#fcd34d|#fbbf24|252,\s*211,\s*77|251,\s*191,\s*36/i);
  }
});

test('robots and sitemap point to the canonical homepage', async () => {
  const [robots, sitemap] = await Promise.all([read('public/robots.txt'), read('public/sitemap.xml')]);
  assert.match(robots, /Sitemap: https:\/\/qpos\.neospec\.co\.in\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/qpos\.neospec\.co\.in\/<\/loc>/);
});

test('trial entitlement and onboarding use the 20-day duration', async () => {
  const [state, onboarding, manager, landing, faq] = await Promise.all([
    read('src/lib/stateContext.tsx'),
    read('src/components/BusinessOnboarding.tsx'),
    read('src/components/SaaSManagerModal.tsx'),
    read('src/components/LandingPage.tsx'),
    read('src/lib/homepageFaq.ts'),
  ]);
  assert.match(state, /TRIAL_DURATION_MS = 20 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(onboarding, /Your 20-day Basic trial starts now/);
  assert.match(manager, /20-day free trial/);
  for (const source of [state, onboarding, manager, landing, faq]) {
    assert.doesNotMatch(source, /(?:5[- ]day|five[- ]day|five days)/i);
  }
});
