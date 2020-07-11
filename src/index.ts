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
    }
  }
}

const isBiz: boolean = false;

async function main(bizFlag: boolean) {
  const browser = await puppeteer.launch({ headless: true });

  if (bizFlag) {
    scraper.poalimBuisness(browser);
  } else {
    scraper.poalimPersonal(browser);
  }
}

main(isBiz);
