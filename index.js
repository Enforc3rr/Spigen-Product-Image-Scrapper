'use strict';
const excelToJson = require('convert-excel-to-json');
const puppeteer = require("puppeteer");
const Scraper = require("images-scraper");
const imageSourceDatabase = require("./imageSourceModel");
const databaseConfig = require("./databaseConfig");
require('events').EventEmitter.prototype._maxListeners = 100;

//Connection To Database
databaseConfig()
    .then(()=>{
        console.log("Connected To Database");
        // Async For Each
        const asyncForEach =  async (array, callback) => {
            for (let index = 0; index < array.length; index++) {
                await callback(array[index], index, array);
            }
        }

        const result = excelToJson({
            sourceFile: `spigen.xlsx`,
            columnToKey: {
                A: 'manufacturer',
                B: 'device',
                C: 'brand',
                D: 'productName',
                E: 'sku',
                F: 'co',
                G: 'ean',
                H: 'unitCost',
                I: 'orderQty',
                J: 'packageSize',
                K: 'productWeight',
                L: 'boxQty',
            }
        });

        const savingData = async ()=>{
            await asyncForEach(result.Order, async (data, index) => {

                if (index === 0) return;

                console.log(data.productName);

                await imageScrapping(data.productName,data.sku);
            });
        }
        savingData()
            .then(()=>console.log("Finished Indexing"));

        const imageScrapping = async (productName,sku) => {
            const skuCheck = await imageSourceDatabase.findOne({sku:sku});
            if(!skuCheck){
                let browser = await puppeteer.launch({
                    headless : true,
                    args: ['--no-sandbox']
                });
                try {
                    // const url = "https://www.spigen.com/products/iphone-12-pro-max-case-slim-wallet";
                    const url = "https://www.spigen.com.sg/";
                    let page = await browser.newPage();
                    await page.goto(url,{waitUntil : "networkidle2"});
                    await page.waitForTimeout(5000);
                    await page.waitForSelector('div[class="nav-toggle"]');
                    await page.click('div[class="nav-toggle"]');
                    await page.type("#mobile_search",productName,{delay : 30});
                    await page.waitForTimeout(6000);
                    await page.keyboard.press("Enter");
                    await page.waitForTimeout(6000);
                    const exists = await page.$eval('a[class="product-item-photo"]', () => true).catch(() => false)
                    if(exists){
                        const href = await page.$eval('a[class="product-item-photo"]', (elm) => elm.href);
                        await page.goto(href);
                    }
                    const sourcesOfImages = [];
                    for(let i = 0 ; i < 6 ; i++){
                        await page.waitForTimeout(10000);
                        const exist = await page.$eval('div[class="fotorama__arr fotorama__arr--next"]', () => true).catch(() => false)
                        if(!exist) {
                            throw "not found";
                        }
                        let imgs = [];
                        if(i===0){
                            imgs = await page.$$eval('div[class="fotorama__stage__frame fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img magnify-wheel-loaded fotorama__active"] > img',
                                imgs => imgs.map(img => img.getAttribute('src')));
                        }else{
                            imgs = await page.$$eval('div[class="fotorama__stage__frame fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img fotorama__active magnify-wheel-loaded"] > img',
                                imgs => imgs.map(img => img.getAttribute('src')));
                        }
                        if(imgs[0] !== undefined){
                            sourcesOfImages.push(imgs[0]);
                        }
                        await page.waitForTimeout(5000);
                        await page.click('div[class="fotorama__arr fotorama__arr--next"]');
                    }
                    await browser.close();

                    const imgSrc = {};

                    imgSrc.sku = sku ;
                    imgSrc.src = sourcesOfImages;

                    await imageSourceDatabase.create(imgSrc);
                }catch (e) {
                    if(e === "not found"){
                        await imageScrappingFromGoogle(productName,sku);
                    }else{
                        console.log("Non Unique SKU found");
                    }
                }finally{
                    console.log("Reached here");
                    await browser.close();
                    if (browser && browser.process() != null) browser.process().kill('SIGINT');
                }
            }
        };

        const imageScrappingFromGoogle = async (productName , sku)=>{
            const google = new Scraper({
                puppeteer: {
                    headless: true,
                    args: ['--no-sandbox']
                },
            });

            const sourcesOfImages = [];
            await (async () => {
                const results = await google.scrape(productName, 2);
                results.forEach(data=>{
                    sourcesOfImages.push(data.url);
                });
            })();

            const imgSrc = {};

            imgSrc.sku = sku ;
            imgSrc.src = sourcesOfImages;

            await imageSourceDatabase.create(imgSrc);
        }

    })
    .catch(()=>console.log("Connection To Database Failed"));

