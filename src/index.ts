import * as puppeteer from 'puppeteer';
import { config } from 'dotenv';
config();

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      USER_CODE: string; // suggested: rename 'HAPOALIM_BUISNESS_USER_CODE'
      PASSWORD: string; // suggested: rename 'HAPOALIM_BUISNESS_PASSWORD'
      //HAPOALIM_BUISNESS_USER_CODE: string;
      //HAPOALIM_BUISNESS_PASSWORD: string;
      HAPOALIM_PERSONAL_USER_CODE: string;
      HAPOALIM_PERSONAL_PASSWORD: string;
      ISRACARD_ID: string;
      ISRACARD_PASSWORD: string;
      ISRACARD_6_DIGITS: string;
    }
  }
}

export async function init() {
  /* this initiates browser and returns every scraper as function */
  /* each scraper opens its own page                              */
  const browser = await puppeteer.launch({ headless: true });

  return {
    hapoalim: () => {
      //return hapoalim.init
    },
    isracard: () => {
      //return isracard.init
    },
    close: () => {
      return browser.close();
    },
  };
}
