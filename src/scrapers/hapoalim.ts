import * as puppeteer from 'puppeteer';
import * as inquirer from 'inquirer';
import { fetchPoalimXSRFWithinPage, fetchGetWithinPage } from '../utils/fetch';
import * as accountDataSchemaFile from '../schemas/accountDataSchema.json';
import * as ILSCheckingTransactionsDataSchemaFile from '../schemas/ILSCheckingTransactionsDataSchema.json';
import * as foreignTransactionsSchema from '../schemas/foreignTransactionsSchema.json';
import { AccountDataSchema } from '../../generatedTypes/accountDataSchema';
import { ILSCheckingTransactionsDataSchema } from '../../generatedTypes/ILSCheckingTransactionsDataSchema';
import { ForeignTransactionsSchema } from '../../generatedTypes/foreignTransactionsSchema';
import { validateSchema } from '../utils/validateSchema';

declare namespace window {
  const bnhpApp: any;
}

async function businessLogin(
  credentials: hapoalimCredentials,
  page: puppeteer.Page
) {
  const BASE_URL = 'https://biz2.bankhapoalim.co.il/authenticate/logon/main';
  await page.goto(BASE_URL);

  await page.waitFor('#inputSend');

  await page.type(
    '#userID',
    credentials.userCode
  );
  await page.type(
    '#userPassword',
    credentials.password
  );

  page.click('#inputSend');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'SMSPassword',
      message: 'Enter the code you got in SMS:',
    },
  ]);

  await page.type('#codeForOtp', answers.SMSPassword);

  await Promise.all([
    page.waitForNavigation(),
    page.keyboard.press('Enter'),
    page.click('#buttonNo'),
  ]);
}

async function personalLogin(
  credentials: hapoalimCredentials,
  page: puppeteer.Page
) {
  const BASE_URL = 'https://login.bankhapoalim.co.il/ng-portals/auth/he/';
  await page.goto(BASE_URL);

  const userCode: string =
    credentials.userCode
  const password: string =
    credentials.password

  await page.waitForSelector('.login-btn');

  await page.type('#userCode', userCode);
  await page.type('#password', password);

  await page.click('.login-btn');

  await page.waitForNavigation();
  return 0;
}

export async function hapoalim(
  page: puppeteer.Page,
  credentials: hapoalimCredentials,
  options?: hapoalimOptions
) {
  options?.isBusiness
    ? await businessLogin(credentials, page)
    : await personalLogin(credentials, page);

  const result = await page.evaluate(() => {
    return window.bnhpApp.restContext;
  });
  const apiSiteUrl = `https://${
    options?.isBusiness ? 'biz2' : 'login'
  }.bankhapoalim.co.il/${result.slice(1)}`;

  const now = new Date();
  const startMonth = options?.duration ?? 12;
  const startDate = new Date(now.getFullYear(), now.getMonth()-startMonth, now.getDate()+1);
  const startDateString = startDate.toISOString().substr(0, 10).replace(/-/g, '');
  const endDateString = new Date().toISOString().substr(0, 10).replace(/-/g, '');
  // TODO: https://www.npmjs.com/package/node-fetch-cookies

  return {
    getAccountsData: async () => {
      const accountDataUrl = `${apiSiteUrl}/general/accounts`;
      const getAccountsFunction = fetchGetWithinPage<AccountDataSchema>(
        page,
        accountDataUrl
      );
      if (options?.validateSchema) {
        const data = await getAccountsFunction;
        const validation = await validateSchema(accountDataSchemaFile, data);
        return {
          data,
          ...validation,
        };
      } else {
        return { data: await getAccountsFunction };
      }
    },
    getILSTransactions: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }) => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const ILSCheckingTransactionsUrl = `${apiSiteUrl}/current-account/transactions?accountId=${fullAccountNumber}&numItemsPerPage=200&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&sortCode=1`;
      const getIlsTransactionsFunction = fetchPoalimXSRFWithinPage<
        ILSCheckingTransactionsDataSchema
      >(page, ILSCheckingTransactionsUrl, '/current-account/transactions');
      if (options?.validateSchema) {
        const data = await getIlsTransactionsFunction;
        const validation = await validateSchema(
          ILSCheckingTransactionsDataSchemaFile,
          data
        );
        return {
          data,
          ...validation,
        };
      } else {
        return { data: await getIlsTransactionsFunction };
      }
    },
    getForeignTransactions: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }) => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const foreignTransactionsUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}&type=business&view=details&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&currencyCodeList=19,100&detailedAccountTypeCodeList=142&lang=he`;
      const getForeignTransactionsFunction = fetchGetWithinPage<
        ForeignTransactionsSchema
      >(page, foreignTransactionsUrl);
      if (options?.validateSchema) {
        const data = await getForeignTransactionsFunction;
        const validation = await validateSchema(
          foreignTransactionsSchema,
          data
        );
        return {
          data,
          ...validation,
        };
      } else {
        return { data: await getForeignTransactionsFunction };
      }
    },
  };
}

export class hapoalimOptions {
  validateSchema?: boolean = false;
  isBusiness?: boolean = true;
  duration?: number = 12;
}

class hapoalimPersonalCredentials {
  userCode: string = '';
  password: string = '';
}

class hapoalimBusinessCredentials extends hapoalimPersonalCredentials {}

export type hapoalimCredentials =
  | hapoalimPersonalCredentials
  | hapoalimBusinessCredentials;
