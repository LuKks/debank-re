# debank-re

Debank reverse engineered API

```
npm i debank-re
```

Based on [it_hueta/debank](https://teletype.in/@it_hueta/debank).

If you have a pro access key then use [lukks/debank](https://github.com/lukks/debank).

## Usage

```js
const Debank = require('debank-re')

const debank = new Debank()

const user = await debank.get('/user', { id: '<address>' })
console.log(user)

const net = await debank.get('/asset/net_curve_24h', { user_addr: '<address>' })
console.log(net.usd_value_list)
```

Each Debank instance have its own "browser" UID.

## License

MIT
