import * as puppeteer from 'puppeteer';
import * as scraper from './scrapers/scrapersIndex';
import * as browserUtil from './utils/browserUtil';

export async function init() {
  /* this initiates browser and returns every scraper as function */
  /* each scraper opens its own page                              */
  const browser = await puppeteer.launch({ headless: true });

  return {
    hapoalim: async (
      credentials: scraper.hapoalimCredentials,
      options?: scraper.hapoalimOptions
    ) => {
      //return hapoalim.init
      const page = await browserUtil.newPage(browser);
      return scraper.hapoalim(page, credentials, options);
    },
    isracard: async (
      credentials: scraper.isracardCredentials,
      options?: scraper.isracardOptions
    ) => {
      //return isracard.init
      const page = await browserUtil.newPage(browser);
      return scraper.isracard(page, credentials, options);
    },
    close: () => {
      return browser.close();
    },
  };
}
