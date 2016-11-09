# capture-exit

Allow cooprative async exit handlers, we unfortunately must hijack
process.exit.

It allows a handler to ensure exit, without that exit handler impeding other
similar handlers

for example, see: [sindresorhus/ora#27](https://github.com/sindresorhus/ora/issues/27)
