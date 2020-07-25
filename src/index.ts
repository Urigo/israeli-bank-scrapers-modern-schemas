import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import * as scraper from './scrapers/scrapersExport';

const { config } = dotenv;
config();

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      USER_CODE: string;
      PASSWORD: string;
      ISRACARD_ID: string;
      ISRACARD_PASSWORD: string;
      ISRACARD_6_DIGITS: string;
    }
  }
}

const isBiz: boolean = false;

async function main(bizFlag: boolean) {
  const browser = await puppeteer.launch({ headless: false });

  if (bizFlag) {
    await scraper.poalimBuisness(browser);
  } else {
    await scraper.poalimPersonal(browser);
  }

  const page = await browser.newPage();

  await scraper.isracard(page);

  browser.close();
  return 0
}

main(isBiz);
