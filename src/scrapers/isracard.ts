import puppeteer from 'puppeteer';
import moment from 'moment';
import lodash from 'lodash';
import { fetchGetWithinPage, fetchPostWithinPage } from '../utils/fetch';
import { IsracardDashboardMonth } from '../../generatedTypes/isracardDashboardMonth';
import { IsracardCardsTransactionsList } from '../../generatedTypes/isracardCardsTransactionsList';
import isracardDashboardMonth from '../schemas/isracardDashboardMonth.json';
import isracardCardsTransactionsList from '../schemas/isracardCardsTransactionsList.json';
import { validateSchema } from '../utils/validateSchema';
import { terminatePage } from '../utils/terminatePage';


const BASE_URL = 'https://digital.isracard.co.il';
const SERVICE_URL =
  'https://digital.isracard.co.il/services/ProxyRequestHandler.ashx';

async function fetchMonth(page: puppeteer.Page, monthMoment: moment.Moment) {
  // get accounts data
  const billingDate = monthMoment.format('YYYY-MM-DD');
  const accountsUrl = `${SERVICE_URL}?reqName=DashboardMonth&actionCode=0&billingDate=${billingDate}&format=Json`;
  const dashboardMonthData = await 
    fetchGetWithinPage<IsracardDashboardMonth>(page, accountsUrl)
  ;

  validateSchema("IsracardDashboardMonth",isracardDashboardMonth , dashboardMonthData)

  // create conainer object by user accounts
  if (dashboardMonthData) {
    const accounts = dashboardMonthData.DashboardMonthBean.cardsCharges.map(
      (cardCharge: {
        cardIndex: string;
        cardNumber: any;
        billingDate: moment.MomentInput;
      }) => {
        return {
          index: parseInt(cardCharge.cardIndex, 10),
          accountNumber: cardCharge.cardNumber,
          processedDate: moment(
            cardCharge.billingDate,
            'DD/MM/YYYY'
          ).toISOString(),
        };
      }
    );

    // get transactions data
    const month = monthMoment.month() + 1;
    const monthStr = month < 10 ? `0${month}` : month.toString();
    const transUrl = `${SERVICE_URL}?reqName=CardsTransactionsList&month=${monthStr}&year=${monthMoment.year()}&requiredDate=N`;
    const transResult = await fetchGetWithinPage<IsracardCardsTransactionsList>(page, transUrl);
  
    validateSchema("IsracardCardsTransactionsList",isracardCardsTransactionsList , transResult)

    const accountTxns: { [key: string]: any } = {};
    accounts.forEach(account => {
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
  return 0
}

async function fetchTransactions(page: puppeteer.Page) {
  // dates logic
  let startMoment = moment().subtract(1, 'years').startOf('month');
  const allMonths = [];
  let lastMonth = moment().startOf('month').add(1, 'month');

  while (startMoment.isSameOrBefore(lastMonth)) {
    allMonths.push(startMoment);
    startMoment = moment(startMoment).add(1, 'month');
  }

  // get monthly results
  const results = await Promise.all(
    allMonths.map(async (monthMoment) => {
      return fetchMonth(page, monthMoment);
    })
  );

  // handle/merge months
  //////////////////////////

  return results;
}

async function login(page: puppeteer.Page) {
  const validateUrl = `${SERVICE_URL}?reqName=performLogonI`;
  const validateRequest = {
    MisparZihuy: process.env.ISRACARD_ID,
    Sisma: process.env.ISRACARD_PASSWORD,
    cardSuffix: process.env.ISRACARD_6_DIGITS,
    countryCode: '212',
    idType: '1',
  };
  return fetchPostWithinPage(page, validateUrl, validateRequest);
}

export async function isracard(browser: puppeteer.Browser) {
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/personalarea/Login`);
  await login(page);
  await fetchTransactions(page);
  terminatePage(page);
  return 0
}
