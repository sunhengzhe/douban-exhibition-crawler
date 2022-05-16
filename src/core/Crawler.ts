import got from 'got'
import cheerio from 'cheerio'
import { PrismaClient } from '@prisma/client'
import dayjs, { Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import fs from 'fs'
import path from 'path'
import {HttpProxyAgent} from 'hpagent';

dayjs.extend(customParseFormat)

const city: string = 'shanghai'

const cursorFile = path.join(__dirname, `../../cursor-${city}`)

const sleepBetween = () => Math.random() * 500 + 500

/**
 * 休眠一段时间
 * @param ms 毫秒数
 * @returns
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface ListEntry {
  cover: string
  url: string
  eventId: number
  title: string
  tags: string
  time: string
  location: string
  fee: string
  owner: string
  participants: number
  interested: number
}

/**
 * 有些网站限制了访问频率，需要配置一些动态 ip
 * 参考:
 * - https://free.kuaidaili.com/free/
 * - http://www.66ip.cn/areaindex_1/1.html
 * - https://www.89ip.cn/
 */
const ipPool = [
  '101.200.49.180:8118',
  '221.122.91.76:9480',
  '39.175.85.98:30001',
  '120.24.33.141:8000',
  '114.55.84.12:30001',
  '221.122.91.75:10286',
  '39.175.75.24:30001',
  '39.175.92.35:30001',
  '39.175.75.5:30001',
  '223.70.126.84:3128',
  '221.122.91.34:80',
  '101.33.73.209:8118',
  '221.122.91.74:9401',
  '221.122.91.64:9401',
  '221.122.91.65:80',
  '118.31.1.154:80',
]

/**
 *
 */
export default class Crawler {
  constructor(private prisma: PrismaClient) {}

  /**
   * 程序入口
   */
  async kickoff() {
    if (!fs.existsSync(cursorFile)) {
      fs.writeFileSync(cursorFile, '')
    }

    // 从上一次保存的位置开始抓
    const [cursorDate, cursorPage] = fs.readFileSync(cursorFile).toString().split(' ')

    // 默认从今天开始
    let date = cursorDate ? dayjs(cursorDate, 'YYYYMMDD') : dayjs().startOf('day')
    let page = cursorPage || ''

    while (true) {
      // 抓取 date 日期的数
      await this.fetchByDate(date, page)

      /**
       * 抓完一天，抓上一天
       * 使用 dayjs，API 文档:
       * https://day.js.org/docs/en/installation/installation
       */
      date = date.subtract(1, 'day')
      page = ''
    }
  }

  /**
   * 从某一页开始，抓取某一天的数据
   * @param date 日期
   * @param page 页数
   */
  async fetchByDate(date: Dayjs, page: string = '') {
    const dateFormat = date.format('YYYYMMDD')

    let url = `https://${city}.douban.com/events/${dateFormat}-exhibition${page}`

    if (city === 'chengdu' || city === 'nanjing') {
      url = `https://www.douban.com/location/${city}/events/${dateFormat}-exhibition${page}`
    }

    // 具体抓取页面逻辑
    const [entrys, nextPage] = await this.fetchPage(url)

    // 存入数据库
    const savedCount = await this.saveExhibitions(date, entrys)

    console.log('++ saved', savedCount, 'items')

    // 写入已抓取天数
    fs.writeFileSync(cursorFile, `${dateFormat} ${nextPage}`)

    // 休息一会，防止过于频繁
    await sleep(sleepBetween())

    // 如果有下一页，继续递归
    if (nextPage) {
      await this.fetchByDate(date, nextPage)
    }
  }

  /**
   * 前往目标地址，抓取数据
   * @param url 目标地址
   * @returns
   */
  async fetchPage(url: string): Promise<[ListEntry[], string]> {
    const ip = 'http://' + ipPool[(Math.random() * ipPool.length | 0)]
    console.log(`+ fetch ${url} by ${ip}`)

    /**
     * 使用 got 拿到响应
     * https://github.com/sindresorhus/got
     */
    const resp = await got.get(
      url,
      {
        agent: {
          http: new HttpProxyAgent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 256,
            maxFreeSockets: 256,
            scheduling: 'lifo',
            proxy: ip
          })
        },
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          /**
           * Cookie, 如果需要的话
           */
          Cookie: 'place your cookie here',
          Host: (new URL(url)).host,
          Pragma: 'no-cache',
          Referer: 'https://open.weixin.qq.com/',
          'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="100", "Google Chrome";v="100"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'cross-site',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
        },
      }
    )

    /**
     * 使用 cheerio 解析 HTML
     * https://github.com/cheeriojs/cheerio
     */
    const $ = cheerio.load(resp.body)

    /**
     * 类 jQuery 的 API
     */
    const $listEntrys = $('.events-list .list-entry')

    const listEntrys = $listEntrys
      .map((i, ele) => {
        const $ele = $(ele)
        const cover = $ele.find('.pic img').attr('data-lazy')
        const $title = $ele.find('.info .title a')
        const url = $title.attr('href') || ''
        const eventIdMatch = url.match(/event\/(\d+)\/?$/)
        const eventId = eventIdMatch ? Number(eventIdMatch[1]) : 0
        const title = $title.attr('title')
        const $tags = $ele.find('.event-cate-tag a')

        /**
         * 获取页面内需要的信息
         */
        const tags = $tags
          .map((i, e) => {
            const match = $(e).attr('href')?.match('search_text=([^&$]+)')
            return match ? decodeURIComponent(match[1]) : ''
          })
          .get()
          .join(',')

        const time = $ele.find('.event-meta .event-time').contents().eq(2).text().trim()
        const location = $ele.find('.event-meta li').eq(1).attr('title')
        const fee = $ele.find('.event-meta .fee strong').text()
        const owner = $ele.find('.event-meta a[target="db-event-owner"]').text()
        const $counts = $ele.find('.counts span')
        const participants = Number(($counts.eq(0).text().match(/\d+/) || ['0'])[0])
        const interested = Number(($counts.eq(2).text().match(/\d+/) || ['0'])[0])

        if (i === 0) {
          // console.log($ele.html())
        }

        return {
          cover,
          url,
          eventId,
          title,
          tags,
          time,
          location,
          fee,
          owner,
          participants,
          interested,
        } as ListEntry
      })
      .get()

    const nextPage = $('.paginator .next a').attr('href') || ''

    return [ listEntrys, nextPage ]
  }

  /**
   * 批量写入数据库
   */
  async saveExhibitions(date: Dayjs, entrys: ListEntry[]) {
    const exhibitions = entrys.map(item => {
      return {
        eventId: item.eventId,
        title: item.title,
        time: item.time,
        location: item.location,
        fee: item.fee,
        cover: item.cover,
        owner: item.owner,
        participants: item.participants,
        interested: item.interested,
        tags: item.tags,
        date: date.format('YYYY-MM-DD'),
        city,
      }
    })

    let success = 0

    for (let exhibition of exhibitions) {
      try {
        await this.prisma.exhibition.create({
          data: exhibition
        })

        success++
      } catch (e) {
        console.log(date.format('YYYY-MM-DD'), exhibition.eventId, exhibition.title)
      }
    }

    return success
  }
}
