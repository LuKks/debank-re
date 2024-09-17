const crypto = require('crypto')
let got = null

const API_URL = 'https://api.debank.com'

module.exports = class Debank {
  constructor (opts = {}) {
    this.account = makeBrowserUID()
    this.nonce = new DebankNonce()
    this.signer = new DebankSigner()

    this._options = opts
  }

  make (method, pathname, query) {
    if (query && query[0] === '?') query = query.slice(1)

    const nonce = this.nonce.next()
    const ts = getTimestamp()
    const signature = this.signer.sign({ method, pathname, query }, { nonce, ts })

    return {
      'x-api-nonce': 'n_' + nonce,
      'x-api-sign': signature,
      'x-api-ts': ts.toString(),
      'x-api-ver': 'v2'
    }
  }

  async api (method, pathname, opts = {}) {
    if (!got) got = await importGot()

    let query = opts.query // Very hackish atm until like-fetch does what got-scraping does

    if (query && typeof query === 'object') {
      query = new URLSearchParams(opts.query).toString()
    }

    method = method.toUpperCase()
    query = (query && query[0] !== '?') ? ('?' + query) : (query || '')

    const headers = this.make(method, pathname, query)

    const response = await got(API_URL + pathname + query, {
      http2: false,
      ...this._options,
      method,
      // TODO: Investigate why fetch doesn't work for this case
      // Also, those headers are not needed for got-scraping
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US',
        'accept-encoding': 'gzip, deflate, br',

        'sec-ch-ua': '"Not-A.Brand";v="99", "Chromium";v="124"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Linux"',

        'sec-fetch-site': 'same-site',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-user': '?1',
        'sec-fetch-dest': 'document',

        'upgrade-insecure-requests': '1',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',

        source: 'web',
        account: JSON.stringify(this.account),
        ...headers
      }
    })

    const body = JSON.parse(response.body)

    if (body.error_code) {
      throw new Error(body.error_code + ': ' + body.error_msg)
    }

    return body.data
  }

  async get (pathname, query) {
    return this.api('GET', pathname, { query })
  }
}

async function importGot () {
  return (await import('got-scraping')).gotScraping
}

function getTimestamp () {
  return Math.floor(Date.now() / 1e3)
}

function makeBrowserUID () {
  return {
    random_at: Math.floor(Date.now() / 1e3),
    random_id: uuidv4().replace(/-/g, ''),
    user_addr: null
  }
}

function uuidv4 () {
  return 'xxxxxxxx-xxxx-4xxx-bxxx-xxxxxxxxxxxx'.replace(/[xb]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)

    return v.toString(16)
  })
}

class DebankNonce {
  constructor () {
    this.abc = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'
    this.local = 0n
  }

  pcg32 () {
    const loadValue = BigInt(this.local)
    const tmp = loadValue * 6364136223846793005n + 1n

    this.local = BigInt.asIntN(64, tmp)

    return Number(BigInt.asUintN(64, this.local) >> 33n)
  }

  next () {
    const result = []

    for (let i = 0; i < 40; i++) {
      const index = parseInt(this.pcg32() / 2147483647.0 * 61.0)

      result.push(this.abc[index])
    }

    return result.join('')
  }
}

class DebankSigner {
  sign (a, b) {
    const data1 = a.method + '\n' + a.pathname + '\n' + a.query
    const data2 = 'debank-api\nn_' + b.nonce + '\n' + b.ts

    const hash1 = sha256(data1).toString('hex')
    const hash2 = sha256(data2).toString('hex')
    const xorData = this.xor(hash2)

    const xor1 = xorData[0]
    const xor2 = xorData[1]

    const h1 = sha256(Buffer.from(xor1 + hash1, 'utf-8'))
    const h2 = sha256(Buffer.concat([(Buffer.from(xor2, 'utf-8')), h1]))

    return h2.toString('hex')
  }

  xor (hash) {
    const rez1 = []
    const rez2 = []

    for (let i = 0; i < 64; i++) {
      const char1 = hash[i].charCodeAt(0) ^ 54
      const char2 = hash[i].charCodeAt(0) ^ 92

      rez1.push(String.fromCharCode(char1))
      rez2.push(String.fromCharCode(char2))
    }

    return [rez1.join(''), rez2.join('')]
  }
}

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest()
}
