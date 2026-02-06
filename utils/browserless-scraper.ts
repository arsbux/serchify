import axios from 'axios'

const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY || '2TvRz2wENDomDHnc7fe0eaccf474eb2261f450f68a3611dca'
const BROWSERLESS_URL = 'https://production-sfo.browserless.io'

export async function scrapePageData(targetUrl: string): Promise<any> {
  // Use Browserless /function endpoint to execute page scraping
  const response = await axios.post(
    `${BROWSERLESS_URL}/function?token=${BROWSERLESS_API_KEY}`,
    {
      code: `
module.exports = async ({ page }) => {
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.goto('${targetUrl.replace(/'/g, "\\'")}', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  const data = await page.evaluate(() => {
    return {
      url: window.location.href,
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') || null,
      metaKeywords: document.querySelector('meta[name="keywords"]')?.getAttribute('content') || null,
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || null,
      charset: document.querySelector('meta[charset]')?.getAttribute('charset') || document.characterSet || null,
      language: document.documentElement.lang || null,

      headings: {
        h1: Array.from(document.querySelectorAll('h1')).map(h => ({
          text: h.innerText.trim(),
          length: h.innerText.trim().length
        })),
        h2: Array.from(document.querySelectorAll('h2')).map(h => ({
          text: h.innerText.trim(),
          length: h.innerText.trim().length
        })),
        h3: Array.from(document.querySelectorAll('h3')).map(h => ({
          text: h.innerText.trim(),
          length: h.innerText.trim().length
        }))
      },

      images: Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt || null,
        width: img.width,
        height: img.height,
        loading: img.loading || null
      })),

      links: {
        internal: Array.from(document.querySelectorAll('a')).filter(a => {
          const href = a.getAttribute('href');
          return href && !href.startsWith('http') && !href.startsWith('//');
        }).length,
        external: Array.from(document.querySelectorAll('a')).filter(a => {
          const href = a.getAttribute('href');
          return href && (href.startsWith('http') || href.startsWith('//'));
        }).length
      },

      content: {
        wordCount: document.body.innerText.split(/\\s+/).filter(Boolean).length,
        paragraphs: document.querySelectorAll('p').length,
        readabilityText: document.body.innerText.substring(0, 5000)
      },

      technical: {
        hasCanonical: !!document.querySelector('link[rel="canonical"]'),
        canonicalUrl: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
        hasRobotsMeta: !!document.querySelector('meta[name="robots"]'),
        robotsContent: document.querySelector('meta[name="robots"]')?.getAttribute('content') || null,
        hasStructuredData: document.querySelectorAll('script[type="application/ld+json"]').length > 0,
        structuredDataCount: document.querySelectorAll('script[type="application/ld+json"]').length,
        hasFavicon: !!document.querySelector('link[rel*="icon"]'),
        hasOpenGraph: !!document.querySelector('meta[property^="og:"]'),
        hasTwitterCard: !!document.querySelector('meta[name^="twitter:"]')
      },

      performance: {
        domContentCount: document.querySelectorAll('*').length,
        scriptCount: document.querySelectorAll('script').length,
        stylesheetCount: document.querySelectorAll('link[rel="stylesheet"]').length,
        fontCount: document.querySelectorAll('link[rel="preload"][as="font"]').length
      },

      mobile: {
        hasViewport: !!document.querySelector('meta[name="viewport"]'),
        viewportContent: document.querySelector('meta[name="viewport"]')?.getAttribute('content') || null,
        smallTextElements: Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          const fontSize = parseFloat(style.fontSize);
          return fontSize > 0 && fontSize < 12;
        }).length,
        touchTargets: document.querySelectorAll('button, a, input, select, textarea').length
      },

      structuredData: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(script => {
        try {
          return JSON.parse(script.innerHTML);
        } catch {
          return null;
        }
      }).filter(Boolean)
    };

    return data;
  });

  return data;
};
      `,
      context: {}
    },
    {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 70000
    }
  )

  return response.data
}
