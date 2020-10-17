import * as puppeteer from 'puppeteer';
import * as lodash from 'lodash';
import { fetchGetWithinPage, fetchPostWithinPage } from '../utils/fetch';
import { IsracardDashboardMonth } from '../../generatedTypes/isracardDashboardMonth';
import { IsracardCardsTransactionsList } from '../../generatedTypes/isracardCardsTransactionsList';
import * as isracardDashboardMonth from '../schemas/isracardDashboardMonth.json';
import * as isracardCardsTransactionsList from '../schemas/isracardCardsTransactionsList.json';
import { validateSchema } from '../utils/validateSchema';

const SERVICE_URL =
  'https://digital.isracard.co.il/services/ProxyRequestHandler.ashx';

async function login(credentials: isracardCredentials, page: puppeteer.Page) {
  const validateUrl = `${SERVICE_URL}?reqName=performLogonI`;
  const validateRequest = {
    MisparZihuy: credentials.ID || process.env.ISRACARD_ID,
    Sisma: credentials.password || process.env.ISRACARD_PASSWORD,
    cardSuffix: credentials.card6Digits || process.env.ISRACARD_6_DIGITS,
    countryCode: '212',
    idType: '1',
  };
  return fetchPostWithinPage(page, validateUrl, validateRequest);
}

async function fetchAndEditMonth(
  page: puppeteer.Page,
  monthDate: Date,
  options?: isracardOptions
) {
  // get accounts data
  const billingDate = `${monthDate.getFullYear()}-${("0"+(monthDate.getMonth()+1)).slice(-2)}-${("0" + monthDate.getDate()).slice(-2)}`; // get date in format YYYY-MM-DD
  const accountsUrl = `${SERVICE_URL}?reqName=DashboardMonth&actionCode=0&billingDate=${billingDate}&format=Json`;
  const dashboardMonthData = await fetchGetWithinPage<IsracardDashboardMonth>(
    page,
    accountsUrl
  );

  if (options && options.validateSchema) {
    let validation = await validateSchema(
      isracardDashboardMonth,
      dashboardMonthData
    );
    Object.assign(dashboardMonthData, validation);
  }

  /* create conainer object by user accounts */
  if (dashboardMonthData) {
    const accounts = dashboardMonthData.DashboardMonthBean.cardsCharges.map(
      (cardCharge: {
        cardIndex: string;
        cardNumber: string;
        billingDate: string;
      }) => {
        return {
          index: parseInt(cardCharge.cardIndex, 10),
          accountNumber: cardCharge.cardNumber,
          processedDate: new Date(cardCharge.billingDate).toISOString,
        };
      }
    );

    /* get transactions data */
    const monthStr = ("0"+(monthDate.getMonth()+1)).slice(-2);
    const transUrl = `${SERVICE_URL}?reqName=CardsTransactionsList&month=${monthStr}&year=${monthDate.getFullYear()}&requiredDate=N`;
    const transResult = await fetchGetWithinPage<IsracardCardsTransactionsList>(
      page,
      transUrl
    );

    if (options && options.validateSchema) {
      let validation = await validateSchema(
        isracardCardsTransactionsList,
        transResult
      );
      Object.assign(transResult, validation);
    }

    const accountTxns: { [key: string]: any } = {};
    accounts.forEach((account) => {
      const txnGroups = lodash.get(
        transResult,
        `CardsTransactionsListBean.Index${account.index}.CurrentCardTransactions`
      );

      if (txnGroups) {
        let txnIsrael: any[] = [];
        let txnAbroad: any[] = [];
        txnGroups.forEach((txnGroup: { txnIsrael: any; txnAbroad: any }) => {
          if (txnGroup.txnIsrael) {
            const txns = txnGroup.txnIsrael.map((txn: any) => {
              return Object.assign(txn, {
                processedDate: account.processedDate,
              });
            });
            txnIsrael.push(...txns);
          }

          if (txnGroup.txnAbroad) {
            const txns = txnGroup.txnAbroad.map((txn: any) => {
              return Object.assign(txn, {
                processedDate: account.processedDate,
              });
            });
            txnAbroad.push(...txns);
          }
        });
        const accountNum = lodash.get(account, 'accountNumber');
        accountTxns[accountNum] = {
          accountNumber: accountNum,
          index: account.index,
          txnIsrael: txnIsrael,
          txnAbroad: txnAbroad,
        };
      }
    });
    return accountTxns;
  }
  return 0;
}

async function getMonthDashboard(
  page: puppeteer.Page,
  monthDate: Date,
  options?: isracardOptions
) {
  // get accounts data
  const billingDate = `${monthDate.getFullYear()}-${("0"+(monthDate.getMonth()+1)).slice(-2)}-${("0" + monthDate.getDate()).slice(-2)}`; // get date in format YYYY-MM-DD
  const accountsUrl = `${SERVICE_URL}?reqName=DashboardMonth&actionCode=0&billingDate=${billingDate}&format=Json`;
  const getDashboardFunction = fetchGetWithinPage<IsracardDashboardMonth>(
    page,
    accountsUrl
  );

  if (options && options.validateSchema) {
    const data = await getDashboardFunction;
    let validation = await validateSchema(isracardDashboardMonth, data);
    return {
      data,
      ...validation,
    };
  } else {
    return { data: await getDashboardFunction };
  }
}

async function getMonthTransactions(
  page: puppeteer.Page,
  monthDate: Date,
  options?: isracardOptions
) {
  /* get transactions data */
  const monthStr = ("0"+(monthDate.getMonth()+1)).slice(-2);
  const transUrl = `${SERVICE_URL}?reqName=CardsTransactionsList&month=${monthStr}&year=${monthDate.getFullYear()}&requiredDate=N`;
  const getTransactionsFunction = fetchGetWithinPage<
    IsracardCardsTransactionsList
  >(page, transUrl);

  if (options && options.validateSchema) {
    const data = await getTransactionsFunction;
    let validation = await validateSchema(isracardCardsTransactionsList, data);
    return {
      data,
      ...validation,
    };
  } else {
    return { data: await getTransactionsFunction };
  }
}

export async function isracard(
  page: puppeteer.Page,
  credentials: isracardCredentials,
  options: isracardOptions = new isracardOptions(),
) {
  const BASE_URL = 'https://digital.isracard.co.il';
  await page.goto(`${BASE_URL}/personalarea/Login`, {waitUntil: 'load', timeout: 0});

  await login(credentials, page);

  /* dates logic  */
  const now = new Date();
  const monthStart = () => new Date(now.getFullYear(), now.getMonth(), 1);
  let firstMonth = new Date(monthStart().setMonth(monthStart().getMonth() - (options.duration ?? 30)));
  const finalMonth = new Date(monthStart().setMonth(monthStart().getMonth()))
  const allMonths: Date[] = [];
  while (firstMonth <= finalMonth) {
    allMonths.push(new Date(firstMonth));
    firstMonth = new Date(firstMonth.setMonth(firstMonth.getMonth()+1));
  }


  return {
    getDashboard: async () => {
      return Promise.all(
        /* get monthly results */
        allMonths.map(async (monthDate) => {
          return getMonthDashboard(page, monthDate, options);
        })
      );
    },
    getMonthTransactions: async (RequestedMonthDate: Date) => {
      return getMonthTransactions(page, RequestedMonthDate, options);
    },
    getTransactions: async () => {
      return Promise.all(
        /* get monthly results */
        allMonths.map(async (monthDate) => {
          return getMonthTransactions(page, monthDate, options);
        })
      );
    },
    getEditedTransactions: async () => {
      return Promise.all(
        /* get monthly results */
        allMonths.map(async (monthDate) => {
          return fetchAndEditMonth(page, monthDate, options);
        })
      );
    },
  };
}

export class isracardOptions {
  validateSchema: boolean = false;
  duration?: number;
}

export class isracardCredentials {
  ID: string = '';
  password: string = '';
  card6Digits: string = '';
}
