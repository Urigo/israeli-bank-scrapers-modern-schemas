import * as puppeteer from 'puppeteer';
import * as inquirer from 'inquirer';
import * as moment from 'moment';
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

async function login(userCode: string, password: string, page: puppeteer.Page) {
  await page.waitFor('#inputSend');

  await page.type('#userID', userCode);
  await page.type('#userPassword', password);

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

export async function hapoalim(
  page: puppeteer.Page,
  options?: hapoalimOptions
) {
  const BASE_URL = 'https://biz2.bankhapoalim.co.il/authenticate/logon/main';

  await page.goto(BASE_URL);
  await login(process.env.USER_CODE, process.env.PASSWORD, page);

  const result = await page.evaluate(() => {
    return window.bnhpApp.restContext;
  });
  const apiSiteUrl = `https://biz2.bankhapoalim.co.il/${result.slice(1)}`;

  const API_DATE_FORMAT = 'YYYYMMDD';
  const defaultStartMoment = moment().subtract(1, 'years').add(1, 'day');
  const startDateString = defaultStartMoment.format(API_DATE_FORMAT);
  const endDateString = moment().format(API_DATE_FORMAT);
  // TODO: https://www.npmjs.com/package/node-fetch-cookies

  return {
    getAccountsData: async () => {
      const accountDataUrl = `${apiSiteUrl}/general/accounts`;
      const getAccountsFunction = fetchGetWithinPage<AccountDataSchema>(page, accountDataUrl);
      if (options?.validateSchema) {
        const data = await getAccountsFunction;
        const validation = await validateSchema(accountDataSchemaFile, data);
        return {
          data,
          ...validation
        };
      } else {
        return {data: getAccountsFunction};
      }
    },
    getILSTransactions: async (account: {
      bankNumber: number;
      branchNumber: number;
      accountNumber: number;
    }) => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const ILSCheckingTransactionsUrl = `${apiSiteUrl}/current-account/transactions?accountId=${fullAccountNumber}&numItemsPerPage=200&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&sortCode=1`;
      const getIlsTransactionsFunction = fetchPoalimXSRFWithinPage<ILSCheckingTransactionsDataSchema>(
        page,
        ILSCheckingTransactionsUrl,
        '/current-account/transactions'
      );
      if (options?.validateSchema) {
        const data = await getIlsTransactionsFunction;
        const validation = await validateSchema(
          ILSCheckingTransactionsDataSchemaFile,
          data
        );
        return {
          data,
          ...validation
        };
      } else {
        return {data: getIlsTransactionsFunction};
      }
    },
    getForeignTransactions: async (account: {
      bankNumber: string;
      branchNumber: number;
      accountNumber: number;
    }) => {
      const fullAccountNumber = `${account.bankNumber}-${account.branchNumber}-${account.accountNumber}`;
      const foreignTransactionsUrl = `${apiSiteUrl}/foreign-currency/transactions?accountId=${fullAccountNumber}&type=business&view=details&retrievalEndDate=${endDateString}&retrievalStartDate=${startDateString}&currencyCodeList=19,100&detailedAccountTypeCodeList=142&lang=he`;
      const getForeignTransactionsFunction = fetchGetWithinPage<ForeignTransactionsSchema>(
        page,
        foreignTransactionsUrl
      );
      if (options?.validateSchema) {
        const  data = await getForeignTransactionsFunction;
        const validation = await validateSchema(
          foreignTransactionsSchema,
          data
        );
        return {
          data,
          ...validation
        };
      } else {
        return {data: getForeignTransactionsFunction};
      }
    },
  };
}

export class hapoalimOptions {
  validateSchema: boolean = false;
  isBusiness: boolean = true;
}
