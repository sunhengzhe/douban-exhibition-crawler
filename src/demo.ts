import got from 'got'
import cheerio from 'cheerio'

/**
 * 请求 api
 * @param url
 */
async function fetchApi(url: string) {
  console.log('### start fetch api', url)

  const resp = await got.get(url).json()

  console.log(resp)
}

/**
 * 请求页面并解析
 * @param url
 */
async function fetchPage(url: string) {
  console.log('### start fetch page', url)

  const resp = await got.get(
    url,
    {
      headers: {
        Cookie: 'place your cookie here',
        // ...
      },
    }
  )

  const $ = cheerio.load(resp.body)

  console.log($.html().slice(0, 100))
}

const run = async () => {
  await fetchApi('https://doc.youzanyun.com/api/new-doc/list-detail/show-list?catId=1297&source=2')

  await fetchPage('https://doc.youzanyun.com/list/API/1297')
}

run()