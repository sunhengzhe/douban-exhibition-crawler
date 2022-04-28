import got from 'got'
import cheerio from 'cheerio'
import { PrismaClient } from '@prisma/client'
import dayjs, { Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import fs from 'fs'
import path from 'path'
import {HttpProxyAgent} from 'hpagent';

dayjs.extend(customParseFormat)

const cursorFile = path.join(__dirname, '../../cursor.json')

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

const ipPool = [
  '101.132.186.175:9090',
  '101.33.73.209:8118',
  '106.54.128.253:999',
  '124.204.33.162:8000',
  '221.122.91.34:80',
  '221.122.91.65:80',
  '221.122.91.75:10286',
  '221.122.91.76:9480',
  '223.70.126.84:3128',
  '39.175.75.24:30001',
  '39.175.92.35:30001',
  '39.175.75.5:30001',
  '39.175.85.98:30001'
]

export default class Crawler {
  constructor(private prisma: PrismaClient) {}

  async fetchPage(url: string): Promise<[ListEntry[], string]> {
    const ip = 'http://' + ipPool[(Math.random() * ipPool.length | 0)]
    console.log(`+ fetch ${url} by ${ip}`)

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
          Cookie: 'bid=eHJbUc6ZrE4; ll="108288"; gr_user_id=0fe57a9a-b6fc-4ca6-8b22-386c20648cde; __utmc=30149280; __utmz=30149280.1650362696.4.4.utmcsr=google|utmccn=(organic)|utmcmd=organic|utmctr=(not%20provided); viewed="35469273_1467587_1438119_26638316"; ct=y; _vwo_uuid_v2=DEA093611EFD7C4302D6C53D74A5DB9F1|2d5bb2b754e5fc27bd0d8b0d14406b06; _pk_ses.100001.f666=*; __utma=30149280.1487150550.1647053377.1651120859.1651126139.10; dbcl2="223939429:+SBPJRfv4zI"; ck=m0hv; push_noty_num=0; push_doumail_num=0; __utmt=1; __utmv=30149280.22393; _pk_id.100001.f666=0aed0545740d5f1c.1651056196.6.1651128055.1651120858.; __utmb=30149280.10.10.1651126139',
          Host: 'beijing.douban.com',
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

    const $ = cheerio.load(resp.body)

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

  async fetchByDate(date: Dayjs, page: string = '') {
    const dateFormat = date.format('YYYYMMDD')

    const url = `https://beijing.douban.com/events/${dateFormat}-exhibition${page}`

    const [entrys, nextPage] = await this.fetchPage(url)

    await this.saveExhibitions(date, entrys)

    console.log('++ saved', entrys.length, 'items')

    if (entrys.length === 0) {
      console.log('No date found:', url)
      return
    }

    // 写入已抓取天数
    fs.writeFileSync(cursorFile, JSON.stringify({
      page: page,
      date: dateFormat,
    }))

    // 下一页
    await sleep((Math.random() * 2 + 1) * 1000)

    if (nextPage) {
      await this.fetchByDate(date, nextPage)
    }
  }

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
      }
    })

    for (let exhibition of exhibitions) {
      try {
        await this.prisma.exhibition.create({
          data: exhibition
        })
      } catch (e) {
        console.log(date.format('YYYY-MM-DD'), exhibition.eventId, exhibition.title)
      }
    }
  }

  async kickoff() {
    const cursor = JSON.parse(
      fs.readFileSync(cursorFile).toString() || '{}'
    )

    // 默认从今天开始
    let date = cursor.date ? dayjs(cursor.date, 'YYYYMMDD') : dayjs().startOf('day')

    while (true) {
      const page = cursor.page || ''

      await this.fetchByDate(date, page)

      date = date.subtract(1, 'day')
    }
  }
}
