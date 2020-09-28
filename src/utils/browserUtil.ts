import * as puppeteer from 'puppeteer';

export async function newPage(
  browser: puppeteer.Browser
): Promise<puppeteer.Page> {
  // creates new page in browser
  const VIEWPORT_WIDTH = 1024;
  const VIEWPORT_HEIGHT = 768;

  const page = await browser.newPage();

  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
  });

  return page;
}
