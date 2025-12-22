const crypto = require('crypto')
const { Impit } = require('impit')

const API_URL = 'https://api.debank.com'

module.exports = class Debank {
  constructor (opts = {}) {
    this.account = makeBrowserUID()
    this.nonce = new DebankNonce()
    this.signer = new DebankSigner()

    this.impit = new Impit({ browser: 'chrome', proxyUrl: opts.proxyUrl })
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
    let query = opts.query

    if (query && typeof query === 'object') {
      query = new URLSearchParams(opts.query)

      // Must be reversed for valid signature
      query = [...query.entries()].reverse().map(encodeParams).join('&')
    }

    method = method.toUpperCase()
    query = (query && query[0] !== '?') ? ('?' + query) : (query || '')

    const headers = this.make(method, pathname, query)

    const response = await this.impit.fetch(API_URL + pathname + query, {
      method,
      headers: {
        source: 'web',
        account: JSON.stringify(this.account),
        ...headers
      }
    })

    const body = await response.json()

    if (body.error_code) {
      throw new Error(body.error_code + ': ' + body.error_msg)
    }

    return body.data
  }

  async get (pathname, query) {
    return this.api('GET', pathname, { query })
  }
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

function encodeParams ([k, v]) {
  return encodeURIComponent(k) + '=' + encodeURIComponent(v)
}
