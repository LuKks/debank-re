const test = require('brittle')
const Debank = require('./index.js')

test('basic', async function (t) {
  const debank = new Debank()

  const a = await debank.api('GET', '/user', { query: '?id=0x0000000000000000000000000000000000001000' })
  t.is(a.user.id, '0x0000000000000000000000000000000000001000')

  const b = await debank.api('GET', '/user', { query: { id: '0x0000000000000000000000000000000000001000' } })
  t.is(b.user.id, '0x0000000000000000000000000000000000001000')
})

test('get', async function (t) {
  const debank = new Debank()

  const b = await debank.get('/user', { id: '0x0000000000000000000000000000000000001000' })
  t.is(b.user.id, '0x0000000000000000000000000000000000001000')
})

test('net curve 24h', async function (t) {
  const debank = new Debank()

  const data = await debank.get('/asset/net_curve_24h', { user_addr: '0x0000000000000000000000000000000000001000' })

  t.ok(data.usd_value_list.length > 0)
})

test('multi query', async function (t) {
  const debank = new Debank()

  const data = await debank.get('/asset/total_net_curve', {
    user_addr: '0x0000000000000000000000000000000000001000',
    days: 1
  })

  t.ok(data.usd_value_list.length > 0)
})
