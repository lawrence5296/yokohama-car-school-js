const puppeteer = require('puppeteer');
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
const fs = require('fs');

(async () => {
  const url = 'https://yokojiko.obic7.obicnet.ne.jp/ZADFavo/Favorite.aspx?p=%2b5PNtFKQ%2fTmeDcqa4T4OSNIi6jF0ztX5n1jAUTEDHL6DmaYJWVuDC5jIAhCM5JwF'
  const lineUrl = "https://notify-api.line.me/api/notify"
  const id = '' // ##### input your id #####
  const password = '' // ##### input your password #####
  const lineToken = "" // ##### input your line notify token ######
  const options = {
    args: ['--disable-features=site-per-process'],
    // headless: false,
    // slowMo: 10,
  };
  const visit = async (p, selector) => {
    await Promise.all([
      p.waitForNavigation({waitUntil: ['load', 'networkidle2']}),
      p.click(selector)
    ])
  }
  const browser = await puppeteer.launch(options)
  const page = await browser.newPage()

  // login
  await page.goto(url, {waitUntil: "domcontentloaded"})
  await Promise.all([
    page.waitForNavigation({waitUntil: ['load', 'networkidle2']}),
    page.click('#lnkToLogin')
  ])
  let frameHandle = await page.$("#frameMenu")
  let frame = await frameHandle.contentFrame()
  await frame.type('#txtKyoushuuseiNO', id)
  await frame.type("#txtPassword", password)
  await visit(frame, "#btnAuthentication")

  // reserve
  await visit(frame, "#btnMenu_Kyoushuuyoyaku")

  // search available date
  const extractValue = async (element) => {
    return await (await element.getProperty('textContent')).jsonValue()
  }
  let availableList = []
  const search = async () => {
    const innerPage = await frame.$("#lst_lc > div")
    const target = await extractValue(await frame.$("#lblMessageUpper"))
    for (let j = 2; j < 21; j += 3) {
      const dayBlock = await innerPage.$("div:nth-child(" + j + ") > div")
      const date = await extractValue(await dayBlock.$("div:nth-child(1) > span"))
      const available = await extractValue(await dayBlock.$("div.shrink > span")) === '空'
      if (available) {
        const startTime = await extractValue(await innerPage.$("div:nth-child(" + (j + 1) + ") > div > div > div.list-container > div > div > div > div:nth-child(2) > span:nth-child(1)"))
        const info = target.toString().replace("　", "=") + ":" + date + ":" + startTime
        availableList.push(info)
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    await search()
    await visit(frame, "#selectWeekArea > label.cwbtn.next")
  }

  // compare previews
  let previews = new Set()
  try {
    fs.readFileSync('previews.txt', 'utf-8').split('\n').forEach(date => previews.add(date))
  } catch (e) {
    console.warn('previews file does not exists.')
  }
  const newAvailable = availableList.filter(date => !previews.has(date))

  // notify line
  if (newAvailable.length !== 0) {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', lineUrl)
    xhr.setRequestHeader('Authorization', 'Bearer ' + lineToken)
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    xhr.onload = ignore => {
      console.log(xhr.responseText)
    }
    xhr.onerror = e => {
      console.error('Unexpected Error', e)
    }
    console.log(newAvailable.join("\n"))
    xhr.send('message=\n新規空き予約情報\n' + newAvailable.join("\n"))
  }
  fs.writeFileSync('previews.txt', availableList.join('\n'))
  await browser.close()
})();
